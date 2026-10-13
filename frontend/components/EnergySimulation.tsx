"use client";

import { useState } from "react";
import { ENERGY_BALANCE_CHANGED } from "@/lib/events";
import { Household, Weather, refreshSimulation, useSimulation } from "@/lib/simulation";

const weatherStyles: Record<Weather, { label: string; badge: string }> = {
  sunny: { label: "Sunny · solar +30%", badge: "bg-amber-100 text-amber-700" },
  cloudy: { label: "Cloudy · solar -40%", badge: "bg-slate-200 text-slate-700" },
  rainy: { label: "Rainy · solar -75%", badge: "bg-sky-100 text-sky-700" },
};

function formatKw(value: number) {
  return `${value.toFixed(1)} kW`;
}

function formatSimulatedTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function EnergySimulation() {
  const apiUrl = process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ?? "http://localhost:3001";
  const { state, error } = useSimulation();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function claimSurplus(household: Household) {
    setClaiming(household.id);
    setClaimMessage(null);
    fetch(`${apiUrl}/v1/simulation/households/${household.id}/claim`, { method: "POST" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Claim failed");
        setClaimMessage({ text: `Minted ${body.amount} ENRG to your wallet.`, ok: true });
        window.dispatchEvent(new Event(ENERGY_BALANCE_CHANGED));
      })
      .catch((claimError: Error) => setClaimMessage({ text: claimError.message, ok: false }))
      .finally(() => {
        setClaiming(null);
        refreshSimulation();
      });
  }

  if (!state) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <p className="text-sm font-medium text-slate-500">Energy simulation</p>
        <p className="mt-6 text-sm text-slate-500">{error ?? "Loading simulation..."}</p>
      </div>
    );
  }

  const peakKw = Math.max(...state.households.map((household) => Math.max(household.generationKw, household.consumptionKw)), 1);

  return (
    <div id="energy-simulation" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Energy simulation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            Neighbourhood at {formatSimulatedTime(state.simulatedTime)}
          </h2>
          <p className="mt-1 text-xs text-slate-400">Each update moves the clock {state.minutesPerTick} minutes.</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${weatherStyles[state.weather].badge}`}>
          {weatherStyles[state.weather].label}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-3xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Supply</dt>
          <dd className="mt-1 font-semibold text-emerald-700">{formatKw(state.generationKw)}</dd>
        </div>
        <div className="rounded-3xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Demand</dt>
          <dd className="mt-1 font-semibold text-rose-700">{formatKw(state.consumptionKw)}</dd>
        </div>
        <div className="rounded-3xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Balance</dt>
          <dd className={`mt-1 font-semibold ${state.netKw >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {state.netKw >= 0 ? "+" : ""}{formatKw(state.netKw)}
          </dd>
        </div>
      </dl>

      <ul className="mt-6 space-y-3">
        {state.households.map((household) => {
          const claimable = Math.floor(household.storedKwh);
          const canClaim = household.wallet !== null && state.mintingEnabled;
          return (
            <li key={household.id} className={`rounded-3xl px-4 py-3 ${household.wallet ? "bg-cyan-50 ring-1 ring-cyan-200" : "bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{household.name}</p>
                <span className="text-sm text-slate-500">{household.storedKwh.toFixed(1)} kWh stored</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-20">Solar {formatKw(household.generationKw)}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(household.generationKw / peakKw) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20">Use {formatKw(household.consumptionKw)}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                    <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${(household.consumptionKw / peakKw) * 100}%` }} />
                  </div>
                </div>
              </div>
              {canClaim && (
                <button
                  onClick={() => claimSurplus(household)}
                  disabled={claimable < 1 || claiming !== null}
                  className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {claiming === household.id ? "Minting..." : `Claim ${claimable} kWh as ENRG`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {claimMessage && (
        <p className={`mt-4 text-sm ${claimMessage.ok ? "text-emerald-700" : "text-rose-700"}`}>{claimMessage.text}</p>
      )}
    </div>
  );
}
