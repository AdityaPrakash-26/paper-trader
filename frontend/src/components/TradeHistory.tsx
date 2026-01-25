import { formatCurrency, formatNumber } from "@/lib/format";
import type { Trade } from "@/lib/types";

export default function TradeHistory({ trades }: { trades: Trade[] }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Trade History
          </p>
          <p className="text-sm text-slate-500">Latest executions.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {trades.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
            No trades yet.
          </div>
        ) : (
          trades.map((trade) => {
            const tone = trade.side === "BUY" ? "text-emerald-600" : "text-red-600";
            return (
              <div
                key={trade.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {trade.symbol} <span className={tone}>{trade.side}</span>
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {formatNumber(trade.quantity)} shares at {formatCurrency(trade.price)}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(trade.executed_at).toLocaleString("en-US")}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
