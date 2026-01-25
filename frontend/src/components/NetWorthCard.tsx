"use client";

import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { PortfolioSummary } from "@/lib/types";

type NetWorthCardProps = {
  summary: PortfolioSummary | null;
  loading: boolean;
  onCashAction: (amount: number, action: "DEPOSIT" | "WITHDRAW") => Promise<void>;
};

export default function NetWorthCard({
  summary,
  loading,
  onCashAction,
}: NetWorthCardProps) {
  const change = summary?.dailyChange ?? 0;
  const changePercent = summary?.dailyChangePercent ?? 0;
  const changeTone = change >= 0 ? "text-emerald-600" : "text-red-600";
  const [showAdd, setShowAdd] = useState(false);
  const [action, setAction] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [amount, setAmount] = useState("1000");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitAddCash = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus("Enter a valid amount.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      await onCashAction(value, action);
      setStatus(action === "WITHDRAW" ? "Cash withdrawn." : "Cash added.");
      setShowAdd(false);
    } catch (err) {
      setStatus(
        err instanceof Error
          ? err.message
          : action === "WITHDRAW"
          ? "Failed to withdraw."
          : "Failed to add cash."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Portfolio Value
          </p>
          <h2 className="mt-2 text-4xl font-semibold text-slate-900 font-mono">
            {loading ? "--" : formatCurrency(summary?.netWorth ?? 0)}
          </h2>
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold ${changeTone}`}
          >
            <span>{loading ? "--" : formatCurrency(change)}</span>
            <span className="text-slate-500">/</span>
            <span>{loading ? "--" : formatPercent(changePercent)}</span>
            <span className="text-slate-500">today</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            {(["DEPOSIT", "WITHDRAW"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setAction(item);
                  setShowAdd(true);
                  setStatus(null);
                }}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  action === item && showAdd
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white/70 text-slate-700"
                }`}
              >
                {item === "WITHDRAW" ? "Withdraw" : "Add cash"}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Buying Power
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 font-mono">
              {loading ? "--" : formatCurrency(summary?.cashBalance ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {showAdd ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {(["DEPOSIT", "WITHDRAW"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setAction(item)}
                className={`rounded-full px-3 py-1 transition ${
                  action === item
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {item === "WITHDRAW" ? "Withdraw" : "Add cash"}
              </button>
            ))}
          </div>
          <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
            Amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submitAddCash}
              disabled={submitting}
              className="flex-1 rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? action === "WITHDRAW"
                  ? "Withdrawing..."
                  : "Adding..."
                : action === "WITHDRAW"
                ? "Withdraw"
                : "Add cash"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setStatus(null);
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
            >
              Cancel
            </button>
          </div>
          {status ? <p className="mt-3 text-xs text-slate-500">{status}</p> : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em]">Cash Balance</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 font-mono">
            {loading ? "--" : formatCurrency(summary?.cashBalance ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em]">Invested</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 font-mono">
            {loading ? "--" : formatCurrency(summary?.holdingsValue ?? 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
