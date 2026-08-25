import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const contractsDir = join(root, "smart-contracts");
const backendDir = join(root, "backend");
const frontendDir = join(root, "frontend");
const deploymentDir = join(contractsDir, "ignition", "deployments", "chain-31337");
const addressesFile = join(deploymentDir, "deployed_addresses.json");
const databaseFile = join(backendDir, "marketplace.sqlite");
const children = new Set();
let shuttingDown = false;

function commandFor(command, args, cwd, env = {}) {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const child = spawn(executable, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["inherit", "pipe", "pipe"],
  });
  children.add(child);
  child.stdout.on("data", (data) => process.stdout.write(data));
  child.stderr.on("data", (data) => process.stderr.write(data));
  child.on("exit", () => children.delete(child));
  return child;
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = commandFor(command, args, cwd);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function isRpcAvailable() {
  try {
    const response = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForRpc() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isRpcAvailable()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Hardhat node did not become ready on http://127.0.0.1:8545");
}

function writeConfiguration(privateKey) {
  const addresses = JSON.parse(readFileSync(addressesFile, "utf8"));
  const marketplaceAddress = addresses["EnergyMarketplaceModule#Marketplace"];
  const energyTokenAddress = addresses["EnergyMarketplaceModule#EnergyToken"];
  if (!marketplaceAddress || !energyTokenAddress) {
    throw new Error(`Deployment addresses not found in ${addressesFile}`);
  }

  const backendEnv = {
    RPC_URL: "http://127.0.0.1:8545",
    BACKEND_PRIVATE_KEY: privateKey,
    MARKETPLACE_ADDRESS: marketplaceAddress,
    MARKETPLACE_DEPLOYMENT_BLOCK: "0",
    FRONTEND_ORIGIN: "http://localhost:3000",
    PORT: "3001",
    DATABASE_PATH: "./marketplace.sqlite",
  };
  writeFileSync(join(backendDir, ".env"), Object.entries(backendEnv).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
  writeFileSync(join(frontendDir, ".env.local"), `NEXT_PUBLIC_CHAIN=hardhat\nNEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545\nNEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}\nNEXT_PUBLIC_ENERGY_TOKEN_ADDRESS=${energyTokenAddress}\nNEXT_PUBLIC_MARKETPLACE_API_URL=http://localhost:3001\n`);

  return { marketplaceAddress, backendEnv };
}

async function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  for (const child of children) child.kill("SIGKILL");
  process.exit(exitCode);
}

process.on("SIGINT", () => void stopAll());
process.on("SIGTERM", () => void stopAll());

try {
  if (!existsSync(join(contractsDir, "node_modules")) || !existsSync(join(backendDir, "node_modules")) || !existsSync(join(frontendDir, "node_modules"))) {
    throw new Error("Dependencies are missing. Run npm install in smart-contracts, backend, and frontend first.");
  }

  if (await isRpcAvailable()) {
    console.log("Local blockchain already running on http://127.0.0.1:8545. Skipping fresh startup.");
    process.exit(0);
  }

  rmSync(deploymentDir, { recursive: true, force: true });
  rmSync(databaseFile, { force: true });
  console.log("Starting local blockchain...");
  const node = commandFor("npx", ["hardhat", "node"], contractsDir);
  let nodeOutput = "";
  node.stdout.on("data", (data) => {
    nodeOutput += data.toString();
  });
  await waitForRpc();

  console.log("Deploying contracts...");
  await run("npx", ["hardhat", "ignition", "deploy", "--network", "localhost", "ignition/modules/EnergyMarketplace.ts", "--reset"], contractsDir);
  const privateKey = nodeOutput.match(/Private Key:\s*(0x[0-9a-fA-F]+)/)?.[1];
  if (!privateKey) throw new Error("Could not read a funded private key from Hardhat.");
  const { marketplaceAddress, backendEnv } = writeConfiguration(privateKey);
  console.log(`Contracts ready. Marketplace: ${marketplaceAddress}`);
  console.log("Starting backend and frontend. Press Ctrl+C to stop everything.\n");
  commandFor("npm", ["run", "start:dev"], backendDir, backendEnv);
  commandFor("npm", ["run", "dev"], frontendDir);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await stopAll(1);
}
