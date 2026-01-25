"use client";

import { formatCurrency } from "@/lib/format";

type QuickStatsCardProps = {
  loading: boolean;
  quote?: {
    open?: number;
    prevClose?: number;
    high?: number;
    low?: number;
  } | null;
  metrics?: {
    fiftyTwoWeekHigh?: number | null;
    fiftyTwoWeekLow?: number | null;
    beta?: number | null;
    peRatio?: number | null;
  } | null;
};

export function QuickStatsCard({ loading, quote, metrics }: QuickStatsCardProps) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Quick Stats</p>
      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Open</span>
          <span className="font-mono text-slate-900">{loading ? "--" : formatCurrency(quote?.open ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Previous Close</span>
          <span className="font-mono text-slate-900">{loading ? "--" : formatCurrency(quote?.prevClose ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Day High</span>
          <span className="font-mono text-slate-900">{loading ? "--" : formatCurrency(quote?.high ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Day Low</span>
          <span className="font-mono text-slate-900">{loading ? "--" : formatCurrency(quote?.low ?? 0)}</span>
        </div>
        <div className="border-t border-slate-200 pt-3"></div>
        <div className="flex items-center justify-between">
          <span>52W High</span>
          <span className="font-mono text-slate-900">
            {metrics?.fiftyTwoWeekHigh ? formatCurrency(metrics.fiftyTwoWeekHigh) : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>52W Low</span>
          <span className="font-mono text-slate-900">
            {metrics?.fiftyTwoWeekLow ? formatCurrency(metrics.fiftyTwoWeekLow) : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Beta</span>
          <span className="font-mono text-slate-900">
            {metrics?.beta ? metrics.beta.toFixed(2) : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>P/E Ratio</span>
          <span className="font-mono text-slate-900">
            {metrics?.peRatio ? metrics.peRatio.toFixed(2) : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
