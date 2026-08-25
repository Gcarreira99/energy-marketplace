import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Contract, JsonRpcProvider, Wallet, parseEther } from "ethers";

const rpcUrl = process.env.RPC_URL;
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const localWallet = process.env.LOCAL_WALLET_ADDRESS;
if (!rpcUrl || !ownerPrivateKey || !localWallet) {
  throw new Error("RPC_URL, OWNER_PRIVATE_KEY, and LOCAL_WALLET_ADDRESS are required");
}
const provider = new JsonRpcProvider(rpcUrl);
const owner = new Wallet(ownerPrivateKey, provider);
const deploymentPath = join(import.meta.dirname, "../ignition/deployments/chain-31337/deployed_addresses.json");
const addresses = JSON.parse(readFileSync(deploymentPath, "utf8"));
const token = new Contract(addresses["EnergyMarketplaceModule#EnergyToken"], [
  "function balanceOf(address) view returns (uint256)",
  "function mint(address,uint256) external",
], owner);
const balance = await token.balanceOf(localWallet);

if (balance < 100n) {
  const transaction = await token.mint(localWallet, 100n - balance);
  await transaction.wait();
}

if ((await provider.getBalance(localWallet)) < parseEther("1")) {
  const transaction = await owner.sendTransaction({
    to: localWallet,
    value: parseEther("1"),
  });
  await transaction.wait();
}
