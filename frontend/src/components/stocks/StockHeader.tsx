"use client";

import Image from "next/image";
import { memo, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { formatCurrency, formatPercent } from "@/lib/format";

type Fundamentals = {
  name?: string;
  ticker?: string;
  weburl?: string;
  logo?: string;
};

type RangeStats = {
  label: string;
  low: number | null;
  high: number | null;
};

type StockHeaderProps = {
  symbol?: string;
  fundamentals: Fundamentals | null;
  loading: boolean;
  currentPrice: number;
  changeTone: string;
  rangeChangeData: { change: number | null; percent: number | null };
  quoteChange?: { change?: number | null; percentChange?: number | null };
  marketOpen: boolean;
  showLive: boolean;
  rangeStats: RangeStats;
  watchlisted: boolean;
  watchlistCta: string;
  watchlistDisabled: boolean;
  watchlistError: string | null;
  session: Session | null;
  onToggleWatchlist: () => void;
};

const StockLogo = memo(function StockLogo({
  src,
  alt,
}: {
  src?: string;
  alt: string;
}) {
  const [visible, setVisible] = useState(true);
  if (!src || !visible) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={48}
      height={48}
      className="rounded-xl object-contain bg-white p-1 border border-slate-200"
      unoptimized
      onError={() => setVisible(false)}
      priority
    />
  );
});

const RollingNumber = memo(function RollingNumber({
  value,
  precision = 2,
  prefix = "$",
}: {
  value: number;
  precision?: number;
  prefix?: string;
}) {
  const display = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    const negative = value < 0;
    const numeric = formatter.format(Math.abs(value));
    return `${negative ? "-" : ""}${prefix}${numeric}`;
  }, [value, precision, prefix]);

  const chars = useMemo(() => display.split(""), [display]);

  return (
    <span
      className="inline-flex items-center gap-[1px] font-mono text-4xl font-semibold text-slate-900"
      aria-live="polite"
    >
      {chars.map((char, idx) => {
        const isDigit = /\d/.test(char);
        if (!isDigit) {
          return (
            <span
              key={`${idx}-${char}`}
              className="inline-flex h-[1.15em] w-[0.75em] items-center justify-center leading-[1.15em] text-slate-900"
            >
              {char}
            </span>
          );
        }
        const digit = Number(char);
        return (
          <span
            key={`col-${idx}`}
            className="relative h-[1.15em] w-[0.75em] overflow-hidden text-center"
            aria-hidden="true"
          >
            <span
              className="absolute left-0 top-0 block w-full"
              style={{
                transform: `translateY(-${digit * 10}%)`,
                transition: "transform 360ms cubic-bezier(.2,.8,.2,1)",
                willChange: "transform",
              }}
            >
              {Array.from({ length: 10 }).map((_, n) => (
                <span
                  key={n}
                  className="block h-[1.15em] leading-[1.15em]"
                  style={{ color: "#0f172a" }}
                >
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
      <span className="sr-only">{display}</span>
    </span>
  );
});

export function StockHeader({
  symbol,
  fundamentals,
  loading,
  currentPrice,
  changeTone,
  rangeChangeData,
  quoteChange,
  marketOpen,
  showLive,
  rangeStats,
  watchlisted,
  watchlistCta,
  watchlistDisabled,
  watchlistError,
  session,
  onToggleWatchlist,
}: StockHeaderProps) {
  const renderChange = () => {
    if (loading) return "--";
    if (rangeChangeData.change !== null && rangeChangeData.percent !== null) {
      return `${formatCurrency(rangeChangeData.change)} (${formatPercent(
        rangeChangeData.percent
      )}) over selected range`;
    }
    return `${formatCurrency(quoteChange?.change ?? 0)} (${formatPercent(
      quoteChange?.percentChange ?? 0
    )})`;
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-1 min-w-[260px] items-start gap-4">
        <StockLogo src={fundamentals?.logo} alt={`${fundamentals?.name || symbol} logo`} />
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
            {symbol}
            {showLive && (
              <span className="flex items-center gap-1 text-emerald-600 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
            {!showLive && !marketOpen && (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Market closed
              </span>
            )}
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-900 font-mono">
            {loading ? "--" : <RollingNumber value={currentPrice} />}
          </h1>
          <p className={`mt-2 text-sm font-mono ${changeTone}`}>{renderChange()}</p>
          {!marketOpen && <p className="mt-1 text-xs text-slate-500">As of last close</p>}
          {fundamentals?.name ? (
            <p className="mt-1 text-sm text-slate-500">
              {fundamentals.name}
              {fundamentals.weburl ? (
                <a
                  href={fundamentals.weburl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-teal-600 hover:text-teal-700"
                >
                  ↗
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-3 self-start">
        <button
          type="button"
          onClick={onToggleWatchlist}
          disabled={watchlistDisabled}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
            watchlisted
              ? "border border-teal-600 bg-teal-50 text-teal-700"
              : "border border-slate-200 bg-white/80 text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-70`}
        >
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 text-teal-700">
              <svg
                aria-hidden
                className="h-full w-full"
                viewBox="0 0 24 24"
                fill={watchlisted ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m12 3 2.45 4.96 5.47.78-3.96 3.86.93 5.44L12 15.98 6.11 18.04l.93-5.44-3.96-3.86 5.47-.78Z"
                />
              </svg>
            </span>
            <span>{watchlistCta}</span>
          </span>
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
          <p>{rangeStats.label}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900 font-mono">
            {loading || rangeStats.low === null || rangeStats.high === null
              ? "--"
              : `${formatCurrency(rangeStats.low)} - ${formatCurrency(rangeStats.high)}`}
          </p>
        </div>
        {watchlistError ? (
          <p className="text-[11px] text-red-600 md:text-right">{watchlistError}</p>
        ) : null}
        {!session && !watchlistError ? (
          <p className="text-[11px] text-slate-500 md:text-right">
            Sign in to save this ticker to your watchlist.
          </p>
        ) : null}
      </div>
    </div>
  );
}
