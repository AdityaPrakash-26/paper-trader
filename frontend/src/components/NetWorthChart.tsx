"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RangeFilter, Snapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export default function NetWorthChart({
  snapshots,
  range,
  ranges,
  onRangeChange,
}: {
  snapshots: Snapshot[];
  range: RangeFilter;
  ranges: readonly RangeFilter[];
  onRangeChange: (range: RangeFilter) => void;
}) {
  const chartData = [...snapshots]
    .sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .map((snapshot) => ({
      timestamp: snapshot.timestamp,
      netWorth: snapshot.net_worth,
    }));

  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Performance
          </p>
          <p className="text-sm text-slate-500">
            Portfolio value over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item}
              onClick={() => onRangeChange(item)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                range === item
                  ? "bg-teal-700 text-white"
                  : "border border-slate-200 bg-white/70 text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-64">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No snapshots yet. Execute a trade to start tracking.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDate}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null;
                  }
                  const value = payload[0].value as number;
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
                      {formatCurrency(value)}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#0f766e"
                strokeWidth={2}
                fill="url(#netWorthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
