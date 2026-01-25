"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";

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

const defaultSymbols = [
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "META",
  "GOOGL",
  "JPM",
  "V",
  "NFLX",
];

export default function PopularStocks() {
  const symbols = useMemo(() => defaultSymbols, []);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
        <span className="text-xs text-slate-500">
          {query.trim().length >= 2 ? "Search results" : "Top movers"}
        </span>
      </div>

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
              {searchResults.map((item) => (
                <Link
                  key={item.symbol}
                  href={`/stocks/${item.symbol}`}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 transition hover:border-teal-400 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {item.symbol}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.description}
                  </p>
                  {item.type ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {item.type}
                    </p>
                  ) : null}
                </Link>
              ))}
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
              const tone = quote.percentChange >= 0 ? "text-emerald-600" : "text-red-600";
              return (
                <Link
                  key={quote.symbol}
                  href={`/stocks/${quote.symbol}`}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 transition hover:border-teal-400 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                >
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
                  <p className="mt-1 text-xs text-slate-500">
                    View history & fundamentals
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
