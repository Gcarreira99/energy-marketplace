import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_HOUSEHOLDS,
  SimulationEngine,
  WEATHER_SOLAR_FACTOR,
  solarShare,
} from "../src/modules/simulation/engine/simulation-engine";

// Deterministic stand-in for Math.random: 0.5 means no noise and no weather change.
const steady = () => 0.5;

function createEngine(startHour: number, random = steady) {
  const startTime = new Date("2026-06-01T00:00:00Z");
  startTime.setUTCHours(startHour);
  return new SimulationEngine({
    minutesPerTick: 60,
    startTime,
    random,
    households: [
      { id: "solar", name: "Solar", solarCapacityKw: 10, baseLoadKw: 1, wallet: "0x0000000000000000000000000000000000000001" },
      { id: "consumer", name: "Consumer", solarCapacityKw: 0, baseLoadKw: 1, wallet: null },
    ],
  });
}

test("solar output is zero at night and peaks mid-day", () => {
  assert.equal(solarShare(3), 0);
  assert.equal(solarShare(22), 0);
  assert.equal(solarShare(13), 1);
});

test("sunny weather adds 30% to solar generation", () => {
  assert.equal(WEATHER_SOLAR_FACTOR.sunny, 1.3);
  const engine = createEngine(12);
  const snapshot = engine.tick();
  const solar = snapshot.households.find((household) => household.id === "solar")!;
  assert.equal(snapshot.weather, "sunny");
  assert.equal(snapshot.simulatedTime, "2026-06-01T13:00:00.000Z");
  assert.equal(solar.generationKw, 13);
});

test("surplus accumulates and deficits are drawn from the grid", () => {
  const engine = createEngine(12);
  engine.tick();
  engine.tick();
  const solar = engine.getHousehold("solar")!;
  const consumer = engine.getHousehold("consumer")!;
  assert.ok(solar.storedKwh > 20, `stored ${solar.storedKwh}`);
  assert.equal(consumer.storedKwh, 0);
  assert.ok(consumer.gridImportKwh > 0);

  const snapshot = engine.snapshot();
  assert.equal(snapshot.generationKw, solar.generationKw);
  assert.ok(Math.abs(snapshot.netKw - (snapshot.generationKw - snapshot.consumptionKw)) < 0.01);
});

test("withdraw takes whole kWh and deposit puts them back", () => {
  const engine = createEngine(12);
  engine.tick();
  const before = engine.getHousehold("solar")!.storedKwh;
  const taken = engine.withdraw("solar");
  assert.equal(taken, Math.floor(before));
  assert.ok(engine.getHousehold("solar")!.storedKwh < 1);
  assert.equal(engine.withdraw("consumer"), 0);
  assert.equal(engine.withdraw("missing"), 0);

  engine.deposit("solar", taken);
  assert.ok(Math.abs(engine.getHousehold("solar")!.storedKwh - before) < 0.001);
});

test("weather changes only to a neighbouring state", () => {
  // Always change: sunny can only become cloudy.
  const engine = createEngine(12, () => 0);
  assert.equal(engine.tick().weather, "cloudy");
});

test("default households include a consumer-only home", () => {
  assert.ok(DEFAULT_HOUSEHOLDS.some((household) => household.solarCapacityKw === 0));
  assert.equal(DEFAULT_HOUSEHOLDS[0].id, "home");
});
