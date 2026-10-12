"use client";

import { startTransition, useEffect, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  energyTokenAbi,
  energyTokenAddress,
  marketplaceAbi,
  marketplaceAddress,
} from "@/lib/contracts";

type ActiveOffer = {
  orderId: string;
  seller: string;
  quantity: string;
  priceWei: string;
  timestamp: string;
  active: boolean;
};

type PendingCreateStep = "approve" | "create" | null;

export function OnchainMarketplace() {
  const [orderId, setOrderId] = useState("1");
  const [quantityInput, setQuantityInput] = useState("4");
  const [priceInput, setPriceInput] = useState("100");
  const [offers, setOffers] = useState<ActiveOffer[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [walletAvailabilityError, setWalletAvailabilityError] = useState<string | null>(null);
  const [pendingCreateStep, setPendingCreateStep] = useState<PendingCreateStep>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();

  function refreshOffers() {
    const apiUrl = process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ?? "http://localhost:3001";
    fetch(`${apiUrl}/v1/marketplace/offers`)
      .then((response) => {
        if (!response.ok) throw new Error("Offers API unavailable");
        return response.json() as Promise<ActiveOffer[]>;
      })
      .then((activeOffers) => {
        setOffers(activeOffers);
        setOffersError(null);
      })
      .catch(() => setOffersError("Connect the backend to load indexed offers."));
  }
  const {
    data: buyHash,
    error: buyError,
    isPending: isBuyPending,
    writeContract: writeBuy,
  } = useWriteContract();
  const {
    data: approvalHash,
    error: approvalError,
    isPending: isApprovalPending,
    writeContract: writeApproval,
  } = useWriteContract();
  const {
    data: createHash,
    error: createError,
    isPending: isCreatePending,
    writeContract: writeCreate,
  } = useWriteContract();
  const {
    data: cancelHash,
    error: cancelError,
    isPending: isCancelPending,
    writeContract: writeCancel,
  } = useWriteContract();
  const { isLoading: isBuyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({ hash: buyHash });
  const { isLoading: isCancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });
  const { isLoading: isApprovalConfirming, isSuccess: approvalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });
  const { isLoading: isCreateConfirming, isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createHash });
  const numericOrderId = BigInt(orderId || "0");
  const contractConfigured = Boolean(process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS);

  useEffect(() => {
    refreshOffers();
  }, []);

  const { data: order, isLoading: isReading, refetch } = useReadContract({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "getOrder",
    args: [numericOrderId],
    query: { enabled: contractConfigured && numericOrderId > 0n },
  });

  const { data: energyBalance, refetch: refetchBalance } = useReadContract({
    address: energyTokenAddress,
    abi: energyTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(process.env.NEXT_PUBLIC_ENERGY_TOKEN_ADDRESS) && Boolean(address) },
  });
  const isOwnOrder = Boolean(order && address && order.seller.toLowerCase() === address.toLowerCase());

  function cancelSelectedOrder() {
    if (!order?.active || !isOwnOrder || !contractConfigured) return;
    writeCancel({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "cancelOrder",
      args: [numericOrderId],
    });
  }

  function buyOrder() {
    if (!order || !contractConfigured) return;
    writeBuy({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "buyEnergy",
      args: [numericOrderId],
      value: order.price,
    });
  }

  function connectWallet() {
    const connector = connectors.find((candidate) => candidate.id === "mock") ?? connectors[0];
    if (typeof window === "undefined" || !("ethereum" in window)) {
      if (connector?.id === "mock") {
        connect({ connector });
        return;
      }
      setWalletAvailabilityError("No browser wallet detected. Install MetaMask or another injected wallet, then reload this page.");
      return;
    }
    if (connector) connect({ connector });
  }

  function submitOffer() {
    const quantity = BigInt(quantityInput || "0");
    const price = BigInt(priceInput || "0");
    if (!isConnected || !contractConfigured || quantity <= 0n || price <= 0n) {
      return;
    }

    setPendingCreateStep("approve");
    writeApproval({
      address: energyTokenAddress,
      abi: energyTokenAbi,
      functionName: "approve",
      args: [marketplaceAddress, quantity],
    });
  }

  useEffect(() => {
    if (pendingCreateStep !== "approve" || !approvalSuccess || !approvalHash) return;

    const quantity = BigInt(quantityInput || "0");
    const price = BigInt(priceInput || "0");
    if (quantity <= 0n || price <= 0n) return;

    startTransition(() => setPendingCreateStep("create"));
    writeCreate({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "createSellOrder",
      args: [quantity, price],
    });
  }, [approvalHash, approvalSuccess, pendingCreateStep, priceInput, quantityInput, writeCreate]);

  useEffect(() => {
    if (pendingCreateStep !== "create" || !createSuccess || !createHash) return;
    startTransition(() => {
      setPendingCreateStep(null);
      setOrderId("1");
    });
    refreshOffers();
    void refetch();
    void refetchBalance();
  }, [createHash, createSuccess, pendingCreateStep, refetch, refetchBalance]);

  useEffect(() => {
    if (!buySuccess && !cancelSuccess) return;
    refreshOffers();
    void refetch();
    void refetchBalance();
  }, [buySuccess, cancelSuccess, refetch, refetchBalance]);

  const transactionError = buyError ?? cancelError ?? approvalError ?? createError;
  const hasTransactionError = Boolean(transactionError);
  const activePendingCreateStep = hasTransactionError ? null : pendingCreateStep;

  const actionStatus = activePendingCreateStep === "approve"
    ? "Approving token for marketplace escrow..."
    : activePendingCreateStep === "create"
      ? "Submitting sell order..."
      : isBuyPending
        ? "Waiting for buy confirmation..."
        : isCancelPending
          ? "Waiting for cancel confirmation..."
          : isApprovalPending
            ? "Waiting for approval confirmation..."
            : isCreatePending
              ? "Waiting for offer confirmation..."
              : isBuyConfirming
                ? "Confirming purchase..."
                : isCancelConfirming
                  ? "Cancelling order and refunding escrow..."
                  : isApprovalConfirming
                    ? "Approving token..."
                    : isCreateConfirming
                      ? "Confirming sell order..."
                      : null;

  return (
    <section id="onchain-marketplace" className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">On-chain desk</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Trade a live energy order</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Connect an injected wallet to read an escrowed order and purchase it with the exact ETH price.
          </p>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-emerald-300">
              {energyBalance === undefined ? "-" : energyBalance.toString()} ENRG
            </span>
            <button onClick={() => disconnect()} className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          </div>
        ) : (
          <button onClick={connectWallet} disabled={isConnectPending} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
            {isConnectPending ? "Connecting..." : "Connect wallet"}
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
              {isOwnOrder && <span className="text-cyan-300">Your offer</span>}
            </div>
          ) : "No order found"}
        </div>
        {isOwnOrder ? (
          <button disabled={!order?.active || isCancelPending || isCancelConfirming} onClick={cancelSelectedOrder} className="rounded-2xl bg-rose-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {isCancelPending ? "Confirm in wallet..." : isCancelConfirming ? "Cancelling..." : "Cancel offer"}
          </button>
        ) : (
          <button disabled={!isConnected || !order?.active || isBuyPending || isBuyConfirming} onClick={buyOrder} className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {isBuyPending ? "Confirm in wallet..." : isBuyConfirming ? "Confirming..." : "Buy energy"}
          </button>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <p className="text-sm font-medium text-slate-300">Create a sell offer</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Quantity (kWh)
            <input value={quantityInput} onChange={(event) => setQuantityInput(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" />
          </label>
          <label className="text-sm text-slate-300">
            Price (wei)
            <input value={priceInput} onChange={(event) => setPriceInput(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" />
          </label>
        </div>
        <button
          disabled={!isConnected || !contractConfigured || isApprovalPending || isApprovalConfirming || isCreatePending || isCreateConfirming || activePendingCreateStep !== null}
          onClick={submitOffer}
          className="mt-4 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {activePendingCreateStep === "approve"
            ? "Approving token..."
            : activePendingCreateStep === "create"
              ? "Listing offer..."
              : isApprovalPending || isCreatePending
                ? "Awaiting wallet..."
                : "Create offer"}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-5">
        <p className="text-sm font-medium text-slate-300">Indexed active offers</p>
        {offers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {offers.map((offer) => (
              <button key={offer.orderId} onClick={() => setOrderId(offer.orderId)} className="rounded-full border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 hover:border-cyan-300">
                Order #{offer.orderId} · {offer.quantity} kWh · {formatEther(BigInt(offer.priceWei))} ETH
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">{offersError ?? "No active offers indexed."}</p>
        )}
      </div>

      {actionStatus && <p className="mt-4 text-sm text-cyan-300">{actionStatus}</p>}
      {(walletAvailabilityError || connectError) && <p className="mt-2 text-sm text-rose-300">{walletAvailabilityError ?? `Wallet connection failed: ${connectError?.message.slice(0, 160)}`}</p>}
      {buyHash && <p className="mt-2 text-sm text-slate-300">Transaction: {buyHash.slice(0, 12)}...</p>}
      {buySuccess && <p className="mt-2 text-sm text-emerald-300">Purchase confirmed. <button onClick={() => refetch()} className="underline">Refresh order</button></p>}
      {approvalHash && <p className="mt-2 text-sm text-slate-300">Approval tx: {approvalHash.slice(0, 12)}...</p>}
      {createHash && <p className="mt-2 text-sm text-slate-300">Offer tx: {createHash.slice(0, 12)}...</p>}
      {createSuccess && <p className="mt-2 text-sm text-emerald-300">Offer created successfully.</p>}
      {cancelHash && <p className="mt-2 text-sm text-slate-300">Cancel tx: {cancelHash.slice(0, 12)}...</p>}
      {cancelSuccess && <p className="mt-2 text-sm text-emerald-300">Offer cancelled and energy returned to your wallet.</p>}
      {transactionError && <p className="mt-2 text-sm text-rose-300">{transactionError.message.slice(0, 160)}</p>}
    </section>
  );
}
