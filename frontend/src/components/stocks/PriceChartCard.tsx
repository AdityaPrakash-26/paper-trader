"use client";

import { useMemo } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { RangeFilter } from "@/lib/types";

type PricePoint = { timestamp: number; close: number };

type PriceChartCardProps = {
  range: RangeFilter;
  ranges: RangeFilter[];
  onRangeChange: (value: RangeFilter) => void;
  chartData: PricePoint[];
  xDomain?: [number, number] | undefined;
  liveTimestamp?: number | null;
  tone?: "up" | "down";
  showMarkers?: boolean;
  candlesError: string | null;
  loading: boolean;
  yDomain: [number, number] | undefined;
  formatBucketLabel: (value: number) => string;
};

export function PriceChartCard({
  range,
  ranges,
  onRangeChange,
  chartData,
  xDomain,
  liveTimestamp,
  tone = "up",
  showMarkers = true,
  candlesError,
  loading,
  yDomain,
  formatBucketLabel,
}: PriceChartCardProps) {
  const strokeColor = tone === "down" ? "#dc2626" : "#0f766e";
  const fillColor = tone === "down" ? "#dc2626" : "#0f766e";
  const ticks = useMemo(() => {
    if (!xDomain) return undefined;
    const [start, end] = xDomain;
    const interval = 60 * 60 * 1000; // 1 hour
    const values: number[] = [];
    for (let t = start; t <= end; t += interval) {
      values.push(t);
    }
    if (values[values.length - 1] !== end) {
      values.push(end);
    }
    return values;
  }, [xDomain]);

  const nowMarker =
    xDomain &&
    liveTimestamp &&
    liveTimestamp >= xDomain[0] &&
    liveTimestamp <= xDomain[1]
      ? liveTimestamp
      : null;
  const showMarkerLines = Boolean(showMarkers && xDomain);

  return (
    <div className="glass-panel rounded-3xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Price History</p>
      <p className="mt-2 text-sm text-slate-500">Charted by your selected interval.</p>

      <div className="mt-6 flex flex-wrap gap-2">
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

      <div className="mt-6 h-64">
        {candlesError ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="font-medium text-slate-600">Price Chart Unavailable</p>
            <p className="mt-1 text-xs text-slate-400">Historical data requires a premium API plan</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {loading ? "Loading chart..." : "No price history available."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 28, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fillColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={fillColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={
                  xDomain ?? (["dataMin", "dataMax"] as [
                    number | "dataMin",
                    number | "dataMax"
                  ])
                }
                ticks={ticks}
                allowDataOverflow
                tickFormatter={formatBucketLabel}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={10}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={80}
                domain={yDomain || ["auto", "auto"]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null;
                  }
                  const point = payload[0].payload as { timestamp: number; close: number };
                  const label = formatBucketLabel(point.timestamp);
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
                      <p className="font-semibold">{formatCurrency(point.close)}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                    </div>
                  );
                }}
              />
              {showMarkerLines ? (
                <ReferenceLine
                  x={xDomain[1]}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  isFront={false}
                  label={{
                    value: "EOD",
                    position: "top",
                    dy: 14,
                    dx: -12,
                    fill: "#94a3b8",
                    fontSize: 11,
                  }}
                />
              ) : null}
              {showMarkerLines && nowMarker ? (
                <ReferenceLine
                  x={nowMarker}
                  stroke="#0f766e"
                  strokeDasharray="3 3"
                  isFront
                  label={{
                    value: "Now",
                    position: "top",
                    dy: 14,
                    dx: 6,
                    fill: strokeColor,
                    fontSize: 11,
                  }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#priceFill)"
                isAnimationActive
                animateNewValues
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
