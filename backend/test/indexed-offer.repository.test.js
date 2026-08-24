"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = require("node:assert/strict");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const typeorm_1 = require("typeorm");
const indexed_offer_entity_1 = require("../src/modules/marketplace/entities/indexed-offer.entity");
const _1710000000000_create_indexed_offers_1 = require("../src/database/migrations/1710000000000-create-indexed-offers");
const indexed_offer_repository_1 = require("../src/modules/marketplace/repositories/indexed-offer.repository");
(0, node_test_1.test)("indexed offers survive repository recreation and state updates", async () => {
    const directory = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "energy-marketplace-"));
    const databasePath = (0, node_path_1.join)(directory, "offers.sqlite");
    const firstDataSource = new typeorm_1.DataSource({
        type: "better-sqlite3",
        database: databasePath,
        entities: [indexed_offer_entity_1.IndexedOffer],
        migrations: [_1710000000000_create_indexed_offers_1.CreateIndexedOffers1710000000000],
        migrationsRun: true,
    });
    await firstDataSource.initialize();
    const firstRepository = new indexed_offer_repository_1.IndexedOfferRepository(firstDataSource.getRepository(indexed_offer_entity_1.IndexedOffer));
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
    const secondDataSource = new typeorm_1.DataSource({
        type: "better-sqlite3",
        database: databasePath,
        entities: [indexed_offer_entity_1.IndexedOffer],
        migrations: [_1710000000000_create_indexed_offers_1.CreateIndexedOffers1710000000000],
        migrationsRun: true,
    });
    await secondDataSource.initialize();
    const secondRepository = new indexed_offer_repository_1.IndexedOfferRepository(secondDataSource.getRepository(indexed_offer_entity_1.IndexedOffer));
    const persistedOffers = await secondRepository.findActive();
    strict_1.default.equal(persistedOffers.length, 1);
    strict_1.default.equal(persistedOffers[0].orderId, "1");
    strict_1.default.equal(persistedOffers[0].quantity, "4");
    strict_1.default.equal(persistedOffers[0].priceWei, "100");
    strict_1.default.equal(persistedOffers[0].active, true);
    await secondRepository.markInactive(1n);
    strict_1.default.deepEqual(await secondRepository.findActive(), []);
    await secondDataSource.destroy();
    await (0, promises_1.rm)(directory, { recursive: true, force: true });
});
//# sourceMappingURL=indexed-offer.repository.test.js.map