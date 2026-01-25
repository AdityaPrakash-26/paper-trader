"use client";

type MetricItem = {
  label: string;
  value: unknown;
  format: (value: unknown) => string;
};

type KeyStatsCardProps = {
  metricItems: MetricItem[];
  fundamentalsError: string | null;
  metricsError: string | null;
};

export function KeyStatsCard({ metricItems, fundamentalsError, metricsError }: KeyStatsCardProps) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Key Statistics</p>
      <p className="mt-2 text-sm text-slate-500">Valuation, performance, and financial metrics.</p>
      {fundamentalsError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
          {fundamentalsError}
        </div>
      ) : null}
      {metricsError && !fundamentalsError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
          {metricsError}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metricItems.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 font-mono">
              {item.value === null || item.value === undefined || item.value === ""
                ? "--"
                : item.format(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
