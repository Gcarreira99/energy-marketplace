"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useRealtime } from "@/lib/realtime";

type MarketActivity = {
  id: number;
  kind: "created" | "purchased" | "cancelled";
  orderId: string;
  seller: string;
  buyer: string | null;
  quantity: string;
  priceWei: string;
  blockNumber: number;
  blockTimestamp: string;
  txHash: string;
  logIndex: number;
};

type HistoryScope = "all" | "mine";

// New activity is pushed over the realtime socket; poll only while it is down.
const FALLBACK_REFRESH_INTERVAL_MS = 10_000;

const kindStyles: Record<MarketActivity["kind"], { label: string; badge: string }> = {
  created: { label: "Offer listed", badge: "bg-sky-100 text-sky-700" },
  purchased: { label: "Energy bought", badge: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Offer cancelled", badge: "bg-slate-200 text-slate-700" },
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTime(blockTimestamp: string) {
  return new Date(Number(blockTimestamp) * 1000).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function TransactionHistory() {
  const { address } = useAccount();
  const [scope, setScope] = useState<HistoryScope>("all");
  const [activity, setActivity] = useState<MarketActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const account = scope === "mine" ? address : undefined;

  const refreshHistory = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ?? "http://localhost:3001";
    const query = account ? `?account=${account}` : "";
    fetch(`${apiUrl}/v1/marketplace/history${query}`)
      .then((response) => {
        if (!response.ok) throw new Error("History API unavailable");
        return response.json() as Promise<MarketActivity[]>;
      })
      .then((entries) => {
        setActivity(entries);
        setError(null);
      })
      .catch(() => setError("Connect the backend to load transaction history."));
  }, [account]);

  const isLive = useRealtime((event) => {
    if (event === "market.activity") refreshHistory();
  });

  useEffect(() => {
    refreshHistory();
    if (isLive) return;
    const interval = setInterval(refreshHistory, FALLBACK_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLive, refreshHistory]);

  function describe(entry: MarketActivity) {
    const me = address?.toLowerCase();
    if (entry.kind === "purchased") {
      if (me && entry.buyer?.toLowerCase() === me) return `You bought from ${shortAddress(entry.seller)}`;
      if (me && entry.seller.toLowerCase() === me) return `You sold to ${shortAddress(entry.buyer ?? "")}`;
      return `${shortAddress(entry.buyer ?? "")} bought from ${shortAddress(entry.seller)}`;
    }
    return me && entry.seller.toLowerCase() === me ? "Your offer" : `Seller ${shortAddress(entry.seller)}`;
  }

  return (
    <div id="transaction-history" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">Transaction history</p>
        <div className="flex rounded-full bg-slate-100 p-1 text-sm font-semibold">
          {(["all", "mine"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setScope(option)}
              disabled={option === "mine" && !address}
              className={`rounded-full px-3 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${scope === option ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {option === "all" ? "All" : "Mine"}
            </button>
          ))}
        </div>
      </div>

      {activity.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {activity.map((entry) => (
            <li key={`${entry.txHash}-${entry.logIndex}`} className="rounded-3xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{kindStyles[entry.kind].label}</p>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${kindStyles[entry.kind].badge}`}>
                  {entry.quantity} kWh
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Order #{entry.orderId} · {formatEther(BigInt(entry.priceWei))} ETH · {describe(entry)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {formatTime(entry.blockTimestamp)} · Block {entry.blockNumber} · {entry.txHash.slice(0, 10)}...
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-slate-500">{error ?? "No transactions indexed yet."}</p>
      )}
    </div>
  );
}
