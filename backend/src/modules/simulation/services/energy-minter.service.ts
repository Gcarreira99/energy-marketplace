import { Injectable } from "@nestjs/common";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

const ENERGY_TOKEN_ABI = ["function mint(address to, uint256 amount)"] as const;

// Mints ENRG for simulated surplus. Optional: without a minter key the simulation still runs.
@Injectable()
export class EnergyMinterService {
  private readonly token: Contract | null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    const rpcUrl = process.env.RPC_URL;
    const tokenAddress = process.env.ENERGY_TOKEN_ADDRESS;
    const minterKey = process.env.SIMULATION_MINTER_PRIVATE_KEY;
    this.token = rpcUrl && tokenAddress && minterKey
      ? new Contract(tokenAddress, ENERGY_TOKEN_ABI, new Wallet(minterKey, new JsonRpcProvider(rpcUrl)))
      : null;
  }

  get enabled() {
    return this.token !== null;
  }

  // Mints one at a time so concurrent claims don't race for the same nonce.
  mint(to: string, amount: number): Promise<string> {
    const run = this.queue.then(async () => {
      if (!this.token) throw new Error("Minting is not configured");
      const transaction = await this.token.mint(to, BigInt(amount));
      await transaction.wait();
      return transaction.hash as string;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
