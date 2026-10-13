"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export type RealtimeEvent = "simulation.tick" | "market.activity";
type Listener = (event: RealtimeEvent, data: unknown) => void;

const MAX_RETRY_DELAY_MS = 30_000;

// One socket shared by every component on the page.
const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
let socket: WebSocket | null = null;
let connected = false;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function realtimeUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ?? "http://localhost:3001";
  return `${apiUrl.replace(/^http/, "ws")}/v1/realtime`;
}

function setConnected(value: boolean) {
  connected = value;
  for (const listener of statusListeners) listener();
}

function connect() {
  if (socket || retryTimer || listeners.size === 0) return;
  const next = new WebSocket(realtimeUrl());
  socket = next;
  next.onopen = () => {
    if (socket !== next) return;
    retries = 0;
    setConnected(true);
  };
  next.onmessage = (message) => {
    try {
      const { event, data } = JSON.parse(message.data as string) as { event: RealtimeEvent; data: unknown };
      for (const listener of listeners) listener(event, data);
    } catch {
      // Ignore anything that isn't one of our JSON events.
    }
  };
  next.onclose = () => {
    // A socket we already replaced (e.g. after a remount) must not touch the current one.
    if (socket !== next) return;
    socket = null;
    setConnected(false);
    if (listeners.size === 0) return;
    const delay = Math.min(1_000 * 2 ** retries, MAX_RETRY_DELAY_MS);
    retries += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };
}

function subscribeToStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function disconnectIfUnused() {
  if (listeners.size > 0) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const current = socket;
  socket = null;
  current?.close();
  if (connected) setConnected(false);
}

// Subscribes to backend push events and reports whether the socket is up,
// so callers can fall back to polling while it isn't.
export function useRealtime(handler?: Listener) {
  const handlerRef = useRef(handler);
  const isConnected = useSyncExternalStore(subscribeToStatus, () => connected, () => false);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener: Listener = (event, data) => handlerRef.current?.(event, data);
    listeners.add(listener);
    connect();
    return () => {
      listeners.delete(listener);
      disconnectIfUnused();
    };
  }, []);

  return isConnected;
}
