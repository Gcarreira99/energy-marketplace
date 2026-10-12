import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CreateIndexedOffers1710000000000 } from "./migrations/1710000000000-create-indexed-offers";
import { CreateMarketActivity1710000000001 } from "./migrations/1710000000001-create-market-activity";
import { IndexedOffer } from "../modules/marketplace/entities/indexed-offer.entity";
import { MarketActivity } from "../modules/marketplace/entities/market-activity.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "better-sqlite3",
      database: process.env.DATABASE_PATH ?? "./marketplace.sqlite",
      entities: [IndexedOffer, MarketActivity],
      migrations: [CreateIndexedOffers1710000000000, CreateMarketActivity1710000000001],
      migrationsRun: true,
      synchronize: false,
    }),
  ],
})
export class DatabaseModule {}
