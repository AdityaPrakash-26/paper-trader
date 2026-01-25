"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Quote, WatchlistItem } from "@/lib/types";

type WatchlistProps = {
  token: string;
};

export default function Watchlist({ token }: WatchlistProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: WatchlistItem[]; quotes: Quote[] }>("/api/watchlist", {
        token,
      });
      setItems(data.items || []);
      const mapped = (data.quotes || []).reduce<Record<string, Quote>>((acc, quote) => {
        acc[quote.symbol] = quote;
        return acc;
      }, {});
      setQuotes(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load watchlist.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadWatchlist();
    }, 20000);
    return () => clearInterval(timer);
  }, [loadWatchlist]);

  const handleAdd = async () => {
    const raw = symbolInput.trim().toUpperCase();
    if (!raw) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ item: WatchlistItem; quote: Quote | null }>("/api/watchlist", {
        token,
        method: "POST",
        body: { symbol: raw },
      });
      setItems((prev) => {
        const existing = prev.find((item) => item.symbol === data.item.symbol);
        if (existing) {
          return prev.map((item) => (item.symbol === data.item.symbol ? data.item : item));
        }
        return [data.item, ...prev];
      });
      if (data.quote) {
        setQuotes((prev) => ({ ...prev, [data.quote!.symbol]: data.quote! }));
      }
      setSymbolInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add symbol.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (symbol: string) => {
    setRemoving(symbol);
    setError(null);
    try {
      await apiFetch(`/api/watchlist/${symbol}`, {
        token,
        method: "DELETE",
      });
      setItems((prev) => prev.filter((item) => item.symbol !== symbol));
      setQuotes((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update watchlist.");
    } finally {
      setRemoving(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitting) {
      handleAdd();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Watchlist</p>
          <p className="text-sm text-slate-500">
            Keep tabs on symbols without opening a position.
          </p>
        </div>
        <button
          type="button"
          onClick={loadWatchlist}
          disabled={loading}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-45">
          <label className="sr-only" htmlFor="watchlist-symbol">
            Add ticker
          </label>
          <input
            id="watchlist-symbol"
            type="text"
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder="Add ticker (e.g. AAPL)"
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            maxLength={10}
          />
          <p className="mt-1 text-xs text-slate-500">Press enter to save.</p>
        </div>
        <button
          type="submit"
          disabled={submitting || symbolInput.trim() === ""}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
      </form>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
            Loading watchlist...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-4 text-sm text-slate-500">
            No symbols yet. Add a ticker above to start tracking price moves.
          </div>
        ) : (
          items.map((item) => {
            const quote = quotes[item.symbol];
            const tone = quote
              ? quote.percentChange >= 0
                ? "text-emerald-600"
                : "text-red-600"
              : "text-slate-500";
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/stocks/${item.symbol}`}
                    className="text-sm font-semibold text-slate-900 transition hover:text-teal-700"
                  >
                    {item.symbol}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {quote ? "Live price" : "Awaiting quote"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-mono text-slate-900">
                      {quote ? formatCurrency(quote.current) : "--"}
                    </p>
                    <p className={`text-xs font-mono ${tone}`}>
                      {quote ? formatPercent(quote.percentChange) : "--"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.symbol)}
                    disabled={removing === item.symbol}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removing === item.symbol ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
