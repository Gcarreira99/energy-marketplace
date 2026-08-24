"use client";

import { useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { marketplaceAbi, marketplaceAddress } from "@/lib/contracts";

export function OnchainMarketplace() {
  const [orderId, setOrderId] = useState("1");
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const numericOrderId = BigInt(orderId || "0");
  const contractConfigured = Boolean(process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS);
  const { data: order, isLoading: isReading, refetch } = useReadContract({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "getOrder",
    args: [numericOrderId],
    query: { enabled: contractConfigured && numericOrderId > 0n },
  });

  function buyOrder() {
    if (!order || !contractConfigured) return;
    writeContract({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "buyEnergy",
      args: [numericOrderId],
      value: order.price,
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">On-chain desk</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Trade a live energy order</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Connect an injected wallet to read an escrowed order and purchase it with the exact ETH price.
          </p>
        </div>
        {isConnected ? (
          <button onClick={() => disconnect()} className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        ) : (
          <button onClick={() => connect({ connector: connectors[0] })} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
            Connect wallet
          </button>
        )}
      </div>

      {!contractConfigured && (
        <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          Configure NEXT_PUBLIC_MARKETPLACE_ADDRESS before using on-chain actions.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-[0.65fr_1fr_auto] md:items-end">
        <label className="text-sm text-slate-300">
          Order ID
          <input value={orderId} onChange={(event) => setOrderId(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300" />
        </label>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
          {isReading ? "Reading order..." : order ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>{order.quantity.toString()} kWh</span>
              <span>{formatEther(order.price)} ETH</span>
              <span className={order.active ? "text-emerald-300" : "text-slate-400"}>{order.active ? "Active" : "Closed"}</span>
            </div>
          ) : "No order found"}
        </div>
        <button disabled={!isConnected || !order?.active || isPending || isConfirming} onClick={buyOrder} className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
          {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Buy energy"}
        </button>
      </div>

      {hash && <p className="mt-4 text-sm text-slate-300">Transaction: {hash.slice(0, 12)}...</p>}
      {isSuccess && <p className="mt-2 text-sm text-emerald-300">Purchase confirmed. <button onClick={() => refetch()} className="underline">Refresh order</button></p>}
      {writeError && <p className="mt-2 text-sm text-rose-300">{writeError.message.slice(0, 160)}</p>}
    </section>
  );
}
