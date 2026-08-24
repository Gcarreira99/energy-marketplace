import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIndexedOffers1710000000000 implements MigrationInterface {
  name = "CreateIndexedOffers1710000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "indexed_offers" (
        "order_id" varchar PRIMARY KEY NOT NULL,
        "seller" varchar NOT NULL,
        "quantity" varchar NOT NULL,
        "price_wei" varchar NOT NULL,
        "timestamp" varchar NOT NULL,
        "active" boolean NOT NULL DEFAULT (1),
        "created_block" integer,
        "created_tx_hash" varchar,
        "created_log_index" integer,
        "updated_at" datetime NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_indexed_offers_active" ON "indexed_offers" ("active")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_indexed_offers_created_event"
      ON "indexed_offers" ("created_tx_hash", "created_log_index")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_indexed_offers_created_event"`);
    await queryRunner.query(`DROP INDEX "idx_indexed_offers_active"`);
    await queryRunner.query(`DROP TABLE "indexed_offers"`);
  }
}
