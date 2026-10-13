"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRealtime } from "@/lib/realtime";

export type Weather = "sunny" | "cloudy" | "rainy";

export type Household = {
  id: string;
  name: string;
  wallet: string | null;
  solarCapacityKw: number;
  generationKw: number;
  consumptionKw: number;
  netKw: number;
  storedKwh: number;
  gridImportKwh: number;
};

export type MarketPrice = {
  weiPerKwh: string;
  baseWeiPerKwh: string;
  imbalanceKw: number;
};

export type SimulationState = {
  tick: number;
  simulatedTime: string;
  weather: Weather;
  minutesPerTick: number;
  generationKw: number;
  consumptionKw: number;
  netKw: number;
  price: MarketPrice;
  mintingEnabled: boolean;
  households: Household[];
};

export type SimulationHistoryEntry = {
  tick: number;
  simulatedTime: string;
  weather: Weather;
  generationKw: number;
  consumptionKw: number;
  netKw: number;
  priceWeiPerKwh: string;
};

type Snapshot = {
  state: SimulationState | null;
  history: SimulationHistoryEntry[];
  error: string | null;
};

// Matches the backend's history window: one simulated day at 15 minutes a tick.
const HISTORY_LENGTH = 96;
// Ticks are pushed over the realtime socket; poll only while it is down.
const FALLBACK_REFRESH_INTERVAL_MS = 5_000;

const apiUrl = process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ?? "http://localhost:3001";
const listeners = new Set<() => void>();
let snapshot: Snapshot = { state: null, history: [], error: null };

function update(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toHistoryEntry(state: SimulationState): SimulationHistoryEntry {
  return {
    tick: state.tick,
    simulatedTime: state.simulatedTime,
    weather: state.weather,
    generationKw: state.generationKw,
    consumptionKw: state.consumptionKw,
    netKw: state.netKw,
    priceWeiPerKwh: state.price.weiPerKwh,
  };
}

function applyState(state: SimulationState) {
  const last = snapshot.history.at(-1);
  // A claim re-broadcasts the current tick; only a new tick extends the history.
  const history = !last || state.tick > last.tick
    ? [...snapshot.history, toHistoryEntry(state)].slice(-HISTORY_LENGTH)
    : snapshot.history;
  update({ state, history, error: null });
}

export function refreshSimulation() {
  Promise.all([
    fetch(`${apiUrl}/v1/simulation/state`),
    fetch(`${apiUrl}/v1/simulation/history`),
  ])
    .then(async ([stateResponse, historyResponse]) => {
      if (!stateResponse.ok || !historyResponse.ok) throw new Error("Simulation API unavailable");
      const state = await stateResponse.json() as SimulationState;
      const history = await historyResponse.json() as SimulationHistoryEntry[];
      update({ state, history: history.slice(-HISTORY_LENGTH), error: null });
    })
    .catch(() => update({ error: "Connect the backend to see the energy simulation." }));
}

// Mount once per page: loads the simulation and keeps it current.
export function useSimulationFeed() {
  const isLive = useRealtime((event, data) => {
    if (event === "simulation.tick") applyState(data as SimulationState);
  });

  useEffect(() => {
    refreshSimulation();
    if (isLive) return;
    const interval = setInterval(refreshSimulation, FALLBACK_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLive]);
}

export function useSimulation() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

// Formats a wei-per-kWh price as ETH with enough digits to stay readable.
export function formatEthPerKwh(weiPerKwh: string) {
  const eth = Number(BigInt(weiPerKwh)) / 1e18;
  return `${eth.toPrecision(3)} ETH/kWh`;
}
