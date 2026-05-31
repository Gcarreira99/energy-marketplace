"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const marketTrends = [
  { day: "Mon", price: 42 },
  { day: "Tue", price: 48 },
  { day: "Wed", price: 45 },
  { day: "Thu", price: 53 },
  { day: "Fri", price: 49 },
  { day: "Sat", price: 56 },
  { day: "Sun", price: 51 },
];

const gridNodes = [
  { label: "Solar Farm", x: 10, y: 20, value: 185 },
  { label: "Wind Hub", x: 70, y: 12, value: 220 },
  { label: "Battery", x: 48, y: 62, value: 120 },
  { label: "Load Center", x: 28, y: 82, value: 310 },
  { label: "Market", x: 82, y: 78, value: 95 },
];

const producers = [
  { name: "BrightSun Power", capacity: "68 MW" },
  { name: "Northwind Grid", capacity: "54 MW" },
  { name: "PeakStore Battery", capacity: "30 MW" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Energy Marketplace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Market dashboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
              Create offer
            </button>
            <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400">
              Connect wallet
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Live market summary</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    Real-time energy pricing and capacity
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Market price</p>
                    <p className="mt-2 text-xl font-semibold">{formatCurrency(0.135)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Active nodes</p>
                    <p className="mt-2 text-xl font-semibold">14</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Cleared volume</p>
                    <p className="mt-2 text-xl font-semibold">4.8 GW</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,0.25fr)]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Market trend</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                      Weekly clearing price
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                    USD / kWh
                  </span>
                </div>

                <div className="mt-6 h-[320px] min-h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={marketTrends} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                  <p className="text-sm font-medium text-slate-500">Fast facts</p>
                  <dl className="mt-6 grid gap-4">
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <dt className="text-sm text-slate-500">Top seller</dt>
                      <dd className="mt-2 text-lg font-semibold">BrightSun Power</dd>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <dt className="text-sm text-slate-500">Peak demand</dt>
                      <dd className="mt-2 text-lg font-semibold">2.4 GW</dd>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <dt className="text-sm text-slate-500">Average latency</dt>
                      <dd className="mt-2 text-lg font-semibold">84 ms</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                  <p className="text-sm font-medium text-slate-500">Top producers</p>
                  <div className="mt-5 space-y-3">
                    {producers.map((producer) => (
                      <div key={producer.name} className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">{producer.name}</p>
                          <p className="text-sm text-slate-500">Capacity</p>
                        </div>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">
                          {producer.capacity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Grid topology</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    Node health and routing
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                  Stable
                </span>
              </div>

              <div className="relative mt-8 h-[320px] overflow-hidden rounded-[2rem] bg-slate-950/95 p-4 text-slate-100">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_30%)]" />
                <div className="relative h-full w-full">
                  {gridNodes.map((node) => (
                    <div
                      key={node.label}
                      className="absolute flex flex-col items-center text-center"
                      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100/10 ring-1 ring-slate-200/10 text-xs font-semibold text-white">
                        {node.value} MW
                      </div>
                      <span className="mt-3 max-w-[8rem] text-[0.78rem] text-slate-300">
                        {node.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
              <p className="text-sm font-medium text-slate-500">Recent activity</p>
              <ul className="mt-6 space-y-4">
                <li className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">Offer accepted</p>
                    <p className="text-sm text-slate-500">8:42 AM · Solar bid matched</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                    +2.8 MW
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">Price update</p>
                    <p className="text-sm text-slate-500">7:05 AM · Clearing price shifted</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">
                    +4.5%
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">Settlement ready</p>
                    <p className="text-sm text-slate-500">6:18 AM · Confirm payments</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                    Today
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
