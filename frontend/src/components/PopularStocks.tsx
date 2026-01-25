"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { WatchlistItem } from "@/lib/types";

type Quote = {
  symbol: string;
  current: number;
  percentChange: number;
};

type SearchResult = {
  symbol: string;
  description: string;
  type?: string;
};

const popularStockNames: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla, Inc.",
  AMZN: "Amazon.com, Inc.",
  META: "Meta Platforms, Inc.",
  GOOGL: "Alphabet Inc.",
  JPM: "JPMorgan Chase & Co.",
  V: "Visa Inc.",
  NFLX: "Netflix, Inc.",
};

const defaultSymbols = Object.keys(popularStockNames);

const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    aria-hidden
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m12 3 2.45 4.96 5.47.78-3.96 3.86.93 5.44L12 15.98 6.11 18.04l.93-5.44-3.96-3.86 5.47-.78Z"
    />
  </svg>
);

type PopularStocksProps = {
  token?: string | null;
};

export default function PopularStocks({ token }: PopularStocksProps) {
  const symbols = useMemo(() => defaultSymbols, []);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [watchlisted, setWatchlisted] = useState<Set<string>>(new Set());
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistUpdatingSymbol, setWatchlistUpdatingSymbol] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadQuotes = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ quotes: Quote[] }>(
          `/api/market/quotes?symbols=${symbols.join(",")}`
        );
        if (mounted) {
          setQuotes(data.quotes || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load quotes.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadQuotes();

    return () => {
      mounted = false;
    };
  }, [symbols]);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      setWatchlisted(new Set());
      setWatchlistError(null);
      setWatchlistLoading(false);
      return () => {};
    }

    const loadWatchlist = async () => {
      setWatchlistLoading(true);
      setWatchlistError(null);
      try {
        const data = await apiFetch<{ items: WatchlistItem[] }>("/api/watchlist?includeQuotes=false", {
          token,
        });
        if (mounted) {
          setWatchlisted(new Set((data.items || []).map((item) => item.symbol)));
        }
      } catch (err) {
        if (mounted) {
          setWatchlistError(err instanceof Error ? err.message : "Watchlist unavailable.");
        }
      } finally {
        if (mounted) {
          setWatchlistLoading(false);
        }
      }
    };

    loadWatchlist();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return () => {};
    const timer = setInterval(() => {
      apiFetch<{ items: WatchlistItem[] }>("/api/watchlist?includeQuotes=false", { token })
        .then((data) => setWatchlisted(new Set((data.items || []).map((item) => item.symbol))))
        .catch(() => {
          /* swallow periodic errors */
        });
    }, 25000);
    return () => clearInterval(timer);
  }, [token]);

  useEffect(() => {
    let mounted = true;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return () => {};
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const data = await apiFetch<{ results: SearchResult[] }>(
          `/api/market/search?query=${encodeURIComponent(trimmed)}`
        );
        if (mounted) {
          setSearchResults(data.results || []);
        }
      } catch (err) {
        if (mounted) {
          setSearchError(err instanceof Error ? err.message : "Search failed.");
          setSearchResults([]);
        }
      } finally {
        if (mounted) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleToggleWatchlist = async (symbol: string) => {
    const normalized = symbol.toUpperCase();
    if (!token) {
      setWatchlistError("Sign in to save symbols to your watchlist.");
      return;
    }

    setWatchlistUpdatingSymbol(normalized);
    setWatchlistError(null);
    try {
      if (watchlisted.has(normalized)) {
        await apiFetch(`/api/watchlist/${normalized}`, {
          token,
          method: "DELETE",
        });
        setWatchlisted((prev) => {
          const next = new Set(prev);
          next.delete(normalized);
          return next;
        });
      } else {
        await apiFetch("/api/watchlist", {
          token,
          method: "POST",
          body: { symbol: normalized },
        });
        setWatchlisted((prev) => new Set([...prev, normalized]));
      }
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Unable to update watchlist.");
    } finally {
      setWatchlistUpdatingSymbol(null);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Popular Stocks
          </p>
          <p className="text-sm text-slate-500">
            Tap a symbol to view history and trade.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">
          Live quotes
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="sr-only" htmlFor="stock-search">
            Search stocks
          </label>
          <input
            id="stock-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ticker or company..."
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
          />
        </div>
      </div>

      {watchlistError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
          {watchlistError}
        </div>
      ) : null}

      <div className="mt-5">
        {query.trim().length >= 2 ? (
          searchLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
              Searching stocks...
            </div>
          ) : searchError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-4 text-sm text-red-600">
              {searchError}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
              No results found.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((item) => {
                const normalizedSymbol = item.symbol.toUpperCase();
                const isWatchlisted = watchlisted.has(normalizedSymbol);
                const busy = watchlistUpdatingSymbol === normalizedSymbol;
                return (
                  <div
                    key={item.symbol}
                    className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 transition hover:border-teal-400 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/stocks/${item.symbol}`} className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.symbol}
                        </p>
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                          {item.description}
                        </p>
                        {item.type ? (
                          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            {item.type}
                          </p>
                        ) : null}
                      </Link>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleToggleWatchlist(item.symbol);
                        }}
                        disabled={busy || watchlistLoading}
                        className={`rounded-full border px-2 py-2 text-xs font-semibold transition ${
                          isWatchlisted
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        aria-label={
                          isWatchlisted ? "Remove from watchlist" : "Add to watchlist"
                        }
                      >
                        <StarIcon filled={isWatchlisted} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {symbols.map((symbol) => (
              <div
                key={symbol}
                className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-400"
              >
                Loading {symbol}...
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-4 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quotes.map((quote) => {
              const stockName = popularStockNames[quote.symbol] || "Tap to view details";
              const tone = quote.percentChange >= 0 ? "text-emerald-600" : "text-red-600";
              const normalizedSymbol = quote.symbol.toUpperCase();
              return (
                <div
                  key={quote.symbol}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 transition hover:border-teal-400 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/stocks/${quote.symbol}`} className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {quote.symbol}
                        </p>
                        <span className={`text-xs font-mono ${tone}`}>
                          {formatPercent(quote.percentChange)}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900 font-mono">
                        {formatCurrency(quote.current)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{stockName}</p>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleToggleWatchlist(normalizedSymbol);
                      }}
                      disabled={watchlistUpdatingSymbol === normalizedSymbol || watchlistLoading}
                      className={`rounded-full border px-2 py-2 text-xs font-semibold transition ${
                        watchlisted.has(normalizedSymbol)
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-label={
                        watchlisted.has(normalizedSymbol)
                          ? "Remove from watchlist"
                          : "Add to watchlist"
                      }
                    >
                      <StarIcon filled={watchlisted.has(normalizedSymbol)} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
