import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PRICING, marketPrice } from "../src/modules/simulation/engine/pricing";

const config = { baseWeiPerKwh: 1_000_000n, kWeiPerKw: 10_000n };

test("balanced supply and demand trades at the base price", () => {
  assert.equal(marketPrice(5, 5, config).weiPerKwh, "1000000");
});

test("price follows BasePrice + k(Demand - Supply)", () => {
  const shortage = marketPrice(12.5, 2.5, config);
  assert.equal(shortage.imbalanceKw, 10);
  assert.equal(shortage.weiPerKwh, "1100000");

  const surplus = marketPrice(2, 7.25, config);
  assert.equal(surplus.imbalanceKw, -5.25);
  assert.equal(surplus.weiPerKwh, "947500");
});

test("price is clamped between a fifth and five times the base price", () => {
  assert.equal(marketPrice(0, 1_000, config).weiPerKwh, "200000");
  assert.equal(marketPrice(1_000, 0, config).weiPerKwh, "5000000");
});

test("defaults price a kWh at 0.0001 ETH", () => {
  const price = marketPrice(3, 3);
  assert.equal(price.weiPerKwh, DEFAULT_PRICING.baseWeiPerKwh.toString());
  assert.equal(price.baseWeiPerKwh, "100000000000000");
});
