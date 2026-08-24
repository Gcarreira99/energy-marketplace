import { Module } from "@nestjs/common";
import { TransactionsModule } from "./modules/transactions/transactions.module";

@Module({
  imports: [TransactionsModule],
})
export class AppModule {}
