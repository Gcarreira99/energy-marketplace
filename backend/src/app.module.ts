import { Module } from "@nestjs/common";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";

@Module({
  imports: [MarketplaceModule, TransactionsModule],
})
export class AppModule {}
