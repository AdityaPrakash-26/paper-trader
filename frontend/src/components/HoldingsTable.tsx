import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { Holding } from "@/lib/types";

export default function HoldingsTable({
  holdings,
  loading,
}: {
  holdings: Holding[];
  loading: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Holdings
          </p>
          <p className="text-sm text-slate-500">
            Current positions with live pricing.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Shares</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Daily</th>
              <th className="px-4 py-3">Avg Cost</th>
              <th className="px-4 py-3">Total Gain</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading holdings...
                </td>
              </tr>
            ) : holdings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No holdings yet.
                </td>
              </tr>
            ) : (
              holdings.map((holding) => {
                const gainTone = holding.gain >= 0 ? "text-emerald-600" : "text-red-600";
                const dailyTone = holding.dailyPercent >= 0 ? "text-emerald-600" : "text-red-600";
                return (
                  <tr key={holding.symbol} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {holding.symbol}
                    </td>
                    <td className="px-4 py-4 text-slate-700 font-mono">
                      {formatNumber(holding.shares)}
                    </td>
                    <td className="px-4 py-4 text-slate-700 font-mono">
                      {formatCurrency(holding.currentPrice)}
                    </td>
                    <td className={`px-4 py-4 font-mono ${dailyTone}`}>
                      {formatPercent(holding.dailyPercent)}
                    </td>
                    <td className="px-4 py-4 text-slate-700 font-mono">
                      {formatCurrency(holding.avgCost)}
                    </td>
                    <td className={`px-4 py-4 font-mono ${gainTone}`}>
                      {formatCurrency(holding.gain)} ({formatPercent(holding.gainPercent)})
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
