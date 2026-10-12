import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMarketActivity1710000000001 implements MigrationInterface {
  name = "CreateMarketActivity1710000000001";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "market_activity" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "kind" varchar NOT NULL,
        "order_id" varchar NOT NULL,
        "seller" varchar NOT NULL,
        "buyer" varchar,
        "quantity" varchar NOT NULL,
        "price_wei" varchar NOT NULL,
        "block_number" integer NOT NULL,
        "block_timestamp" varchar NOT NULL,
        "tx_hash" varchar NOT NULL,
        "log_index" integer NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_market_activity_event"
      ON "market_activity" ("tx_hash", "log_index")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_market_activity_seller" ON "market_activity" ("seller")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_market_activity_buyer" ON "market_activity" ("buyer")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_market_activity_buyer"`);
    await queryRunner.query(`DROP INDEX "idx_market_activity_seller"`);
    await queryRunner.query(`DROP INDEX "uq_market_activity_event"`);
    await queryRunner.query(`DROP TABLE "market_activity"`);
  }
}
