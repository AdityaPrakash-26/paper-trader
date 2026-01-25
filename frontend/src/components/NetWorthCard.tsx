import { formatCurrency, formatPercent } from "@/lib/format";
import type { PortfolioSummary } from "@/lib/types";

export default function NetWorthCard({
  summary,
  loading,
}: {
  summary: PortfolioSummary | null;
  loading: boolean;
}) {
  const change = summary?.dailyChange ?? 0;
  const changePercent = summary?.dailyChangePercent ?? 0;
  const changeTone = change >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Net Worth
          </p>
          <h2 className="mt-2 text-4xl font-semibold text-slate-900 font-mono">
            {loading ? "--" : formatCurrency(summary?.netWorth ?? 0)}
          </h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
          <p className={`text-sm font-semibold font-mono ${changeTone}`}>
            {loading ? "--" : formatCurrency(change)}
          </p>
          <p className={`text-xs ${changeTone}`}>
            {loading ? "--" : formatPercent(changePercent)} today
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em]">Cash</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 font-mono">
            {loading ? "--" : formatCurrency(summary?.cashBalance ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em]">Holdings</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 font-mono">
            {loading ? "--" : formatCurrency(summary?.holdingsValue ?? 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
