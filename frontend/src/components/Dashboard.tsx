"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import type { Holding, PortfolioSummary, RangeFilter, Snapshot, Trade } from "@/lib/types";
import NetWorthCard from "@/components/NetWorthCard";
import NetWorthChart from "@/components/NetWorthChart";
import HoldingsTable from "@/components/HoldingsTable";
import TradeHistory from "@/components/TradeHistory";
import TradeForm from "@/components/TradeForm";

const ranges: RangeFilter[] = ["1W", "1M", "6M", "YTD", "1Y", "MAX"];

export default function Dashboard({ session }: { session: Session }) {
  const token = session.access_token;
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [range, setRange] = useState<RangeFilter>("1M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const data = await apiFetch<{
      cashBalance: number;
      holdingsValue: number;
      netWorth: number;
      dailyChange: number;
      dailyChangePercent: number;
      asOf: string;
      holdings: Holding[];
    }>("/api/portfolio/summary", { token });

    setSummary({
      cashBalance: data.cashBalance,
      holdingsValue: data.holdingsValue,
      netWorth: data.netWorth,
      dailyChange: data.dailyChange,
      dailyChangePercent: data.dailyChangePercent,
      asOf: data.asOf,
    });
    setHoldings(data.holdings || []);
  }, [token]);

  const loadHoldings = useCallback(async () => {
    const data = await apiFetch<{ holdings: Holding[] }>("/api/portfolio/holdings", {
      token,
    });
    setHoldings(data.holdings || []);
  }, [token]);

  const loadTrades = useCallback(async () => {
    const data = await apiFetch<{ trades: Trade[] }>("/api/trades", { token });
    setTrades(data.trades || []);
  }, [token]);

  const loadSnapshots = useCallback(
    async (selectedRange: RangeFilter) => {
      const data = await apiFetch<{ snapshots: Snapshot[] }>(
        `/api/portfolio/snapshots?range=${selectedRange}`,
        { token }
      );
      setSnapshots(data.snapshots || []);
    },
    [token]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadSummary(), loadTrades()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [loadSummary, loadTrades]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    loadSnapshots(range).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load snapshots.");
    });
  }, [loadSnapshots, range]);

  const userEmail = useMemo(() => session.user.email ?? "", [session.user.email]);

  return (
    <div className="flex-1 px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/70 px-6 py-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Paper Trader
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Welcome back{userEmail ? "," : ""} {userEmail}
              </h1>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Sign out
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Trade US equities with a simulated balance and real-time quotes.
          </p>
        </header>

        {error ? (
          <div className="glass-panel rounded-2xl border border-red-200 bg-red-50/80 px-6 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-6">
            <NetWorthCard summary={summary} loading={loading} />
            <NetWorthChart
              snapshots={snapshots}
              range={range}
              ranges={ranges}
              onRangeChange={setRange}
            />
          </div>

          <div className="glass-panel flex flex-col gap-6 rounded-3xl p-6">
            <TradeForm
              token={token}
              onTradeComplete={async () => {
                await Promise.all([loadSummary(), loadHoldings(), loadTrades(), loadSnapshots(range)]);
              }}
            />
            <TradeHistory trades={trades} />
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6">
          <HoldingsTable holdings={holdings} loading={loading} />
        </section>
      </div>
    </div>
  );
}
