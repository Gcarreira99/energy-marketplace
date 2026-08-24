import { Controller, Param, ParseIntPipe, Post } from "@nestjs/common";
import { SettlementService } from "../services/settlement.service";

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post(":orderId/settle")
  settle(@Param("orderId", ParseIntPipe) orderId: number) {
    return this.settlementService.settle(BigInt(orderId));
  }
}
