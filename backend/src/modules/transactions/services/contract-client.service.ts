import { Injectable } from "@nestjs/common";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

const MARKETPLACE_ABI = [
  "function buyEnergy(uint256 orderId) payable",
  "function getOrder(uint256 orderId) view returns (tuple(address seller, uint256 quantity, uint256 price, uint256 timestamp, bool active))",
] as const;

export type SellOrder = {
  seller: string;
  quantity: bigint;
  price: bigint;
  timestamp: bigint;
  active: boolean;
};

@Injectable()
export class ContractClientService {
  readonly marketplace: Contract;

  constructor() {
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.BACKEND_PRIVATE_KEY;
    const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;

    if (!rpcUrl || !privateKey || !marketplaceAddress) {
      throw new Error(
        "RPC_URL, BACKEND_PRIVATE_KEY, and MARKETPLACE_ADDRESS are required",
      );
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    this.marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, signer);
  }

  async getSellOrder(orderId: bigint): Promise<SellOrder> {
    const order = await this.marketplace.getOrder(orderId);
    return {
      seller: order.seller,
      quantity: order.quantity,
      price: order.price,
      timestamp: order.timestamp,
      active: order.active,
    };
  }

  buyEnergy(orderId: bigint, price: bigint) {
    return this.marketplace.buyEnergy(orderId, { value: price });
  }
}
