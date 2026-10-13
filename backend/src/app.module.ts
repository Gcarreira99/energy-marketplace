import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { SimulationModule } from "./modules/simulation/simulation.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";

@Module({
  imports: [DatabaseModule, MarketplaceModule, SimulationModule, TransactionsModule],
})
export class AppModule {}
