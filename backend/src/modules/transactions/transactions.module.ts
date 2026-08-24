import { Module } from "@nestjs/common";
import { TransactionsController } from "./controllers/transactions.controller";
import { ContractClientService } from "./services/contract-client.service";
import { SettlementService } from "./services/settlement.service";

@Module({
  controllers: [TransactionsController],
  providers: [ContractClientService, SettlementService],
})
export class TransactionsModule {}
