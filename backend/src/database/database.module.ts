import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CreateIndexedOffers1710000000000 } from "./migrations/1710000000000-create-indexed-offers";
import { IndexedOffer } from "../modules/marketplace/entities/indexed-offer.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "better-sqlite3",
      database: process.env.DATABASE_PATH ?? "./marketplace.sqlite",
      entities: [IndexedOffer],
      migrations: [CreateIndexedOffers1710000000000],
      migrationsRun: true,
      synchronize: false,
    }),
  ],
})
export class DatabaseModule {}
