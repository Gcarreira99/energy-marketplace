import { Injectable } from "@nestjs/common";
import { ContractTransactionResponse } from "ethers";
import { ContractClientService } from "./contract-client.service";

@Injectable()
export class SettlementService {
  constructor(private readonly contractClient: ContractClientService) {}

  async settle(orderId: bigint) {
    const order = await this.contractClient.getSellOrder(orderId);

    if (!order.active) {
      throw new Error("Order is not active");
    }

    const transaction: ContractTransactionResponse =
      await this.contractClient.buyEnergy(orderId, order.price);
    const receipt = await transaction.wait();

    return {
      orderId: orderId.toString(),
      transactionHash: transaction.hash,
      status: receipt?.status === 1 ? "confirmed" : "failed",
      priceWei: order.price.toString(),
    };
  }
}
