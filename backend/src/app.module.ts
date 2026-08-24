import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";

@Module({
  imports: [DatabaseModule, MarketplaceModule, TransactionsModule],
})
export class AppModule {}
