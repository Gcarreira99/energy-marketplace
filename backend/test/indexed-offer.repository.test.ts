import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DataSource } from "typeorm";
import { IndexedOffer } from "../src/modules/marketplace/entities/indexed-offer.entity";
import { CreateIndexedOffers1710000000000 } from "../src/database/migrations/1710000000000-create-indexed-offers";
import { IndexedOfferRepository } from "../src/modules/marketplace/repositories/indexed-offer.repository";

test("indexed offers survive repository recreation and state updates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "energy-marketplace-"));
  const databasePath = join(directory, "offers.sqlite");
  const firstDataSource = new DataSource({
    type: "better-sqlite3",
    database: databasePath,
    entities: [IndexedOffer],
    migrations: [CreateIndexedOffers1710000000000],
    migrationsRun: true,
  });

  await firstDataSource.initialize();
  const firstRepository = new IndexedOfferRepository(
    firstDataSource.getRepository(IndexedOffer),
  );
  await firstRepository.upsertCreated({
    orderId: "1",
    seller: "0x0000000000000000000000000000000000000001",
    quantity: "4",
    priceWei: "100",
    timestamp: "1720000000",
    active: true,
    createdBlock: 12,
    createdTxHash: "0xabc",
    createdLogIndex: 0,
  });
  await firstDataSource.destroy();

  const secondDataSource = new DataSource({
    type: "better-sqlite3",
    database: databasePath,
    entities: [IndexedOffer],
    migrations: [CreateIndexedOffers1710000000000],
    migrationsRun: true,
  });
  await secondDataSource.initialize();
  const secondRepository = new IndexedOfferRepository(
    secondDataSource.getRepository(IndexedOffer),
  );

  const persistedOffers = await secondRepository.findActive();
  assert.equal(persistedOffers.length, 1);
  assert.equal(persistedOffers[0].orderId, "1");
  assert.equal(persistedOffers[0].quantity, "4");
  assert.equal(persistedOffers[0].priceWei, "100");
  assert.equal(persistedOffers[0].active, true);

  await secondRepository.markInactive(1n);
  assert.deepEqual(await secondRepository.findActive(), []);
  await secondDataSource.destroy();
  await rm(directory, { recursive: true, force: true });
});
