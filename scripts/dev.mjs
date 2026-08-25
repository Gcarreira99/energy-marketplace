import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync, spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const rootEnvFile = join(root, ".env");
if (existsSync(rootEnvFile)) {
  for (const line of readFileSync(rootEnvFile, "utf8").split(/\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
const contractsDir = join(root, "smart-contracts");
const backendDir = join(root, "backend");
const frontendDir = join(root, "frontend");
const deploymentDir = join(contractsDir, "ignition", "deployments", "chain-31337");
const addressesFile = join(deploymentDir, "deployed_addresses.json");
const databaseFile = join(backendDir, "marketplace.sqlite");
const rpcUrl = process.env.DEV_RPC_URL;
const backendUrl = process.env.DEV_BACKEND_URL;
const frontendUrl = process.env.DEV_FRONTEND_URL;
const backendPort = process.env.DEV_BACKEND_PORT;
const frontendPort = process.env.DEV_FRONTEND_PORT;
const localWalletAddress = process.env.DEV_LOCAL_WALLET_ADDRESS;
const ownerPrivateKey = process.env.DEV_OWNER_PRIVATE_KEY;
if (!rpcUrl || !backendUrl || !frontendUrl || !backendPort || !frontendPort || !localWalletAddress || !ownerPrivateKey) {
  throw new Error("DEV_RPC_URL, DEV_BACKEND_URL, DEV_FRONTEND_URL, DEV_BACKEND_PORT, DEV_FRONTEND_PORT, DEV_LOCAL_WALLET_ADDRESS, and DEV_OWNER_PRIVATE_KEY are required in .env");
}
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

function run(command, args, cwd, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = commandFor(command, args, cwd, env);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function isRpcAvailable() {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function isDeploymentAvailable() {
  if (!existsSync(addressesFile)) return false;

  try {
    const addresses = JSON.parse(readFileSync(addressesFile, "utf8"));
    const contractAddresses = [
      addresses["EnergyMarketplaceModule#EnergyToken"],
      addresses["EnergyMarketplaceModule#Marketplace"],
    ];
    for (const address of contractAddresses) {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }),
      });
      const result = await response.json();
      if (!result.result || result.result === "0x") return false;
    }

    if (!localWalletAddress) return false;
    const balanceResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{
          to: addresses["EnergyMarketplaceModule#EnergyToken"],
          data: `0x70a08231${localWalletAddress.slice(2).padStart(64, "0")}`,
        }, "latest"],
      }),
    });
    const balanceResult = await balanceResponse.json();
    if (!balanceResult.result || BigInt(balanceResult.result) === 0n) return false;
    return true;
  } catch {
    return false;
  }
}

async function waitForRpc() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isRpcAvailable()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Hardhat node did not become ready on ${rpcUrl}`);
}

async function isHttpAvailable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

function getProjectPids() {
  try {
    const output = execSync("ps -eo pid=,args=", { encoding: "utf8" });
    return output
      .split(/\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        const [pidString, ...rest] = trimmed.split(/\s+/);
        const command = rest.join(" ");
        const projectPrefix = "/home/gonzi/personal/energy-marketplace";
        const matchesProjectProcess = [
          `${projectPrefix}/smart-contracts/node_modules/.bin/hardhat node`,
          `${projectPrefix}/backend/node_modules/.bin/nest start --watch`,
          `${projectPrefix}/frontend/node_modules/.bin/next dev`,
          `node ${join(root, "scripts/dev.mjs")}`,
        ].some((pattern) => command.includes(pattern));
        if (!matchesProjectProcess) return [];
        const pid = Number.parseInt(pidString, 10);
        if (!Number.isFinite(pid) || pid === process.pid) return [];
        return [pid];
      });
  } catch {
    return [];
  }
}

function stopProjectProcesses() {
  for (const pid of getProjectPids()) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
    }
  }
}

function writeConfiguration(privateKey) {
  const addresses = JSON.parse(readFileSync(addressesFile, "utf8"));
  const marketplaceAddress = addresses["EnergyMarketplaceModule#Marketplace"];
  const energyTokenAddress = addresses["EnergyMarketplaceModule#EnergyToken"];
  if (!marketplaceAddress || !energyTokenAddress) {
    throw new Error(`Deployment addresses not found in ${addressesFile}`);
  }

  const backendEnv = {
    RPC_URL: rpcUrl,
    BACKEND_PRIVATE_KEY: privateKey,
    MARKETPLACE_ADDRESS: marketplaceAddress,
    MARKETPLACE_DEPLOYMENT_BLOCK: "0",
    FRONTEND_ORIGIN: frontendUrl,
    PORT: backendPort,
    DATABASE_PATH: "./marketplace.sqlite",
  };
  writeFileSync(join(backendDir, ".env"), Object.entries(backendEnv).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
  writeFileSync(join(frontendDir, ".env.local"), `NEXT_PUBLIC_CHAIN=hardhat\nNEXT_PUBLIC_RPC_URL=${rpcUrl}\nNEXT_PUBLIC_USE_LOCAL_WALLET=true\nNEXT_PUBLIC_LOCAL_WALLET_ADDRESS=${localWalletAddress}\nNEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}\nNEXT_PUBLIC_ENERGY_TOKEN_ADDRESS=${energyTokenAddress}\nNEXT_PUBLIC_MARKETPLACE_API_URL=${backendUrl}\n`);

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
  let backendStarted = false;
  let frontendStarted = false;

  if (!existsSync(join(contractsDir, "node_modules")) || !existsSync(join(backendDir, "node_modules")) || !existsSync(join(frontendDir, "node_modules"))) {
    throw new Error("Dependencies are missing. Run npm install in smart-contracts, backend, and frontend first.");
  }

  const staleProcesses = getProjectPids();
  if (staleProcesses.length > 0) {
    console.log("Stopping stale local project processes before startup...");
    stopProjectProcesses();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
    for (const pid of getProjectPids()) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
      }
    }
  }

  const rpcAvailable = await isRpcAvailable();
  const deploymentAvailable = rpcAvailable && await isDeploymentAvailable();
  if (deploymentAvailable) {
    console.log(`Local blockchain already running on ${rpcUrl}. Skipping fresh startup.`);
  } else {
    let nodeOutput = "";
    rmSync(deploymentDir, { recursive: true, force: true });
    rmSync(databaseFile, { force: true });
    if (!rpcAvailable) {
      console.log("Starting local blockchain...");
      const node = commandFor("npx", ["hardhat", "node"], contractsDir);
      node.stdout.on("data", (data) => {
        nodeOutput += data.toString();
      });
      await waitForRpc();
    } else {
      console.log("Local blockchain is running without current contract deployments. Redeploying...");
    }

    console.log("Deploying contracts...");
    await run("npx", ["hardhat", "ignition", "deploy", "--network", "localhost", "ignition/modules/EnergyMarketplace.ts", "--reset"], contractsDir);
    await run("npx", ["hardhat", "run", "scripts/seed-local.ts", "--network", "localhost"], contractsDir, {
      RPC_URL: rpcUrl,
      LOCAL_WALLET_ADDRESS: localWalletAddress,
      OWNER_PRIVATE_KEY: ownerPrivateKey,
    });
    const privateKey = nodeOutput.match(/Private Key:\s*(0x[0-9a-fA-F]+)/)?.[1]
      ?? readFileSync(join(backendDir, ".env"), "utf8").match(/BACKEND_PRIVATE_KEY=(.+)/)?.[1];
    if (!privateKey) throw new Error("Could not read a funded private key from Hardhat.");
    const { marketplaceAddress, backendEnv } = writeConfiguration(privateKey);
    console.log(`Contracts ready. Marketplace: ${marketplaceAddress}`);
    console.log("Starting backend and frontend. Press Ctrl+C to stop everything.\n");
    commandFor("npm", ["run", "start:dev"], backendDir, backendEnv);
    commandFor("npm", ["run", "dev"], frontendDir, { PORT: frontendPort });
    backendStarted = true;
    frontendStarted = true;
  }

  const backendAlreadyRunning = await isHttpAvailable(`${backendUrl}/v1/marketplace/offers`);
  if (backendAlreadyRunning || backendStarted) {
    console.log(`Backend already running on ${backendUrl}. Skipping backend startup.`);
  } else {
    const privateKey = readFileSync(join(backendDir, ".env"), "utf8").match(/BACKEND_PRIVATE_KEY=(.+)/)?.[1];
    const marketplaceAddress = readFileSync(join(backendDir, ".env"), "utf8").match(/MARKETPLACE_ADDRESS=(.+)/)?.[1];
    const backendEnv = {
      RPC_URL: rpcUrl,
      BACKEND_PRIVATE_KEY: privateKey ?? "",
      MARKETPLACE_ADDRESS: marketplaceAddress ?? "",
      MARKETPLACE_DEPLOYMENT_BLOCK: "0",
      FRONTEND_ORIGIN: frontendUrl,
      PORT: backendPort,
      DATABASE_PATH: "./marketplace.sqlite",
    };
    if (!privateKey || !marketplaceAddress) {
      throw new Error("Backend configuration is missing. Start the chain from a clean state first.");
    }
    console.log("Starting backend and frontend. Press Ctrl+C to stop everything.\n");
    commandFor("npm", ["run", "start:dev"], backendDir, backendEnv);
  }

  const frontendAlreadyRunning = await isHttpAvailable(frontendUrl);
  if (!frontendAlreadyRunning && !frontendStarted) {
    commandFor("npm", ["run", "dev"], frontendDir, { PORT: frontendPort });
  } else {
    console.log(`Frontend already running on ${frontendUrl}. Skipping frontend startup.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await stopAll(1);
}
