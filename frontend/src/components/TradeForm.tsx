"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

export default function TradeForm({
  token,
  onTradeComplete,
}: {
  token: string;
  onTradeComplete: () => Promise<void>;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const submitTrade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      await apiFetch("/api/trades", {
        token,
        method: "POST",
        body: {
          symbol: symbol.trim().toUpperCase(),
          side,
          quantity: Number(quantity),
        },
      });

      setSymbol("");
      setQuantity("1");
      setStatus("Trade executed.");
      await onTradeComplete();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Trade failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Trade Ticket
          </p>
          <p className="text-sm text-slate-500">Market orders executed instantly.</p>
        </div>
      </div>

      <form className="mt-4 space-y-4" onSubmit={submitTrade}>
        <div className="flex gap-2">
          {["BUY", "SELL"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSide(item as "BUY" | "SELL")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                side === item
                  ? item === "BUY"
                    ? "bg-emerald-600 text-white"
                    : "bg-red-600 text-white"
                  : "border border-slate-200 bg-white/70 text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="block text-sm text-slate-600">
          Symbol
          <input
            type="text"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:border-teal-600 focus:outline-none"
            placeholder="AAPL"
            required
          />
        </label>

        <label className="block text-sm text-slate-600">
          Quantity
          <input
            type="number"
            min="0.0001"
            step="0.0001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:border-teal-600 focus:outline-none"
            required
          />
        </label>

        {status ? (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            {status}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Place order"}
        </button>
      </form>
    </div>
  );
}
