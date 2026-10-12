import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DataSource } from "typeorm";
import { CreateIndexedOffers1710000000000 } from "../src/database/migrations/1710000000000-create-indexed-offers";
import { CreateMarketActivity1710000000001 } from "../src/database/migrations/1710000000001-create-market-activity";
import { IndexedOffer } from "../src/modules/marketplace/entities/indexed-offer.entity";
import { MarketActivity } from "../src/modules/marketplace/entities/market-activity.entity";
import { MarketActivityRepository } from "../src/modules/marketplace/repositories/market-activity.repository";

const SELLER = "0x00000000000000000000000000000000000000Aa";
const BUYER = "0x00000000000000000000000000000000000000Bb";
const OTHER = "0x00000000000000000000000000000000000000Cc";

test("market activity is deduplicated, newest first, and filterable by account", async () => {
  const directory = await mkdtemp(join(tmpdir(), "energy-marketplace-"));
  const dataSource = new DataSource({
    type: "better-sqlite3",
    database: join(directory, "activity.sqlite"),
    entities: [IndexedOffer, MarketActivity],
    migrations: [CreateIndexedOffers1710000000000, CreateMarketActivity1710000000001],
    migrationsRun: true,
  });
  await dataSource.initialize();
  const repository = new MarketActivityRepository(dataSource.getRepository(MarketActivity));

  const created = {
    kind: "created" as const,
    orderId: "1",
    seller: SELLER,
    buyer: null,
    quantity: "4",
    priceWei: "100",
    blockNumber: 10,
    blockTimestamp: "1720000000",
    txHash: "0xaaa",
    logIndex: 0,
  };
  await repository.record(created);
  // The backfill replays events the live listener already stored.
  await repository.record(created);
  await repository.record({
    ...created,
    kind: "purchased",
    buyer: BUYER,
    blockNumber: 11,
    blockTimestamp: "1720000012",
    txHash: "0xbbb",
  });
  await repository.record({
    ...created,
    orderId: "2",
    seller: OTHER,
    blockNumber: 12,
    txHash: "0xccc",
  });

  const all = await repository.findRecent();
  assert.deepEqual(all.map((activity) => activity.txHash), ["0xccc", "0xbbb", "0xaaa"]);

  const buyerHistory = await repository.findRecent(BUYER.toLowerCase());
  assert.deepEqual(buyerHistory.map((activity) => activity.kind), ["purchased"]);

  const sellerHistory = await repository.findRecent(SELLER);
  assert.deepEqual(sellerHistory.map((activity) => activity.kind), ["purchased", "created"]);

  await dataSource.destroy();
  await rm(directory, { recursive: true, force: true });
});
