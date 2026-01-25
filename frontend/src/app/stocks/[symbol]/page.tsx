"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { RangeFilter } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ranges: RangeFilter[] = ["1W", "1M", "6M", "YTD", "1Y", "MAX"];

type Quote = {
  symbol: string;
  current: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
};

type Candles = {
  status: string;
  timestamps: number[];
  close: number[];
};

type Fundamentals = {
  name?: string;
  ticker?: string;
  exchange?: string;
  currency?: string;
  marketCap?: number;
  shareOutstanding?: number;
  ipo?: string;
  country?: string;
  finnhubIndustry?: string;
  weburl?: string;
  logo?: string;
};

type Metrics = {
  // Valuation
  peRatio?: number;
  pegRatio?: number;
  pbRatio?: number;
  psRatio?: number;
  
  // Price metrics
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHighDate?: string;
  fiftyTwoWeekLowDate?: string;
  fiftyTwoWeekPriceReturn?: number;
  
  // Risk
  beta?: number;
  
  // Trading
  tenDayAverageTradingVolume?: number;
  threeMonthAverageTradingVolume?: number;
  
  // Dividend
  dividendYield?: number;
  dividendPerShare?: number;
  
  // Profitability
  epsGrowth?: number;
  revenueGrowth?: number;
  roeTTM?: number;
  roaTTM?: number;
  grossMarginTTM?: number;
  netMarginTTM?: number;
  
  // Debt
  debtToEquity?: number;
  currentRatio?: number;
  quickRatio?: number;
  
  // Market cap
  marketCap?: number;
  
  // Per share
  bookValuePerShare?: number;
  revenuePerShare?: number;
  
  // Moving averages
  tenDayEMA?: number;
  fiftyDayMA?: number;
  twoHundredDayMA?: number;
};

const formatLargeNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (value >= 1e12) {
    return `${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  return formatNumber(value);
};

const toEpochRange = (range: RangeFilter) => {
  const now = new Date();
  let fromDate = new Date(now);

  switch (range) {
    case "1W":
      fromDate.setDate(now.getDate() - 7);
      break;
    case "1M":
      fromDate.setMonth(now.getMonth() - 1);
      break;
    case "6M":
      fromDate.setMonth(now.getMonth() - 6);
      break;
    case "YTD":
      fromDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "1Y":
      fromDate.setFullYear(now.getFullYear() - 1);
      break;
    case "MAX":
      fromDate.setFullYear(now.getFullYear() - 5);
      break;
    default:
      break;
  }

  return {
    from: Math.floor(fromDate.getTime() / 1000),
    to: Math.floor(now.getTime() / 1000),
  };
};

export default function StockDetailPage() {
  const params = useParams();
  const symbolParam = params?.symbol;
  const symbol = Array.isArray(symbolParam)
    ? symbolParam[0]?.toUpperCase()
    : symbolParam?.toUpperCase();

  const [session, setSession] = useState<Session | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candles | null>(null);
  const [candlesError, setCandlesError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>("6M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amountType, setAmountType] = useState<"SHARES" | "DOLLARS">("SHARES");
  const [quantity, setQuantity] = useState("");
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setFundamentalsError(null);
      setMetricsError(null);
      setCandlesError(null);

      // Fetch quote (FREE on Finnhub)
      try {
        const quoteData = await apiFetch<Quote>(`/api/market/quote?symbol=${symbol}`);
        setQuote(quoteData);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Failed to load quote.";
        setError(raw);
      }

      // Fetch candles (using Twelve Data free API)
      try {
        const { from, to } = toEpochRange(range);
        const candleData = await apiFetch<Candles>(
          `/api/market/candles?symbol=${symbol}&resolution=D&from=${from}&to=${to}`
        );
        if (candleData.status === "ok") {
          setCandles(candleData);
        } else {
          setCandlesError("Historical price data unavailable for this symbol.");
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Candles unavailable.";
        setCandlesError(raw);
      }

      // Fetch fundamentals (company profile) - FREE on Finnhub
      try {
        const fundamentalsData = await apiFetch<Fundamentals>(
          `/api/market/fundamentals?symbol=${symbol}`
        );
        setFundamentals(fundamentalsData);
      } catch (err) {
        const raw =
          err instanceof Error ? err.message : "Fundamentals unavailable.";
        const friendly =
          raw.includes("403") || raw.includes("access to this resource")
            ? "Company profile is unavailable for this symbol."
            : raw;
        setFundamentals(null);
        setFundamentalsError(friendly);
      }

      // Fetch basic metrics (52-week high/low, P/E, beta, etc.) - FREE on Finnhub
      try {
        const metricsData = await apiFetch<Metrics>(
          `/api/market/metrics?symbol=${symbol}`
        );
        setMetrics(metricsData);
      } catch (err) {
        const raw =
          err instanceof Error ? err.message : "Metrics unavailable.";
        setMetrics(null);
        setMetricsError(raw);
      }

      setLoading(false);
    };

    loadData();
  }, [range, symbol]);

  // WebSocket/SSE for real-time price updates
  useEffect(() => {
    if (!symbol) return;

    // Connect to the backend SSE stream for real-time prices
    const streamUrl = `${API_BASE}/api/market/stream?symbol=${symbol}`;
    
    try {
      const eventSource = new EventSource(streamUrl);
      wsRef.current = eventSource;

      eventSource.onopen = () => {
        setWsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Finnhub trade data format: { type: "trade", data: [{ s: symbol, p: price, t: timestamp, v: volume }] }
          if (data.type === "trade" && Array.isArray(data.data)) {
            const trade = data.data.find((t: { s: string }) => t.s === symbol);
            if (trade && typeof trade.p === "number") {
              setLivePrice(trade.p);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setWsConnected(false);
        // Don't show error - just fallback to polling
      };

      return () => {
        eventSource.close();
        wsRef.current = null;
        setWsConnected(false);
      };
    } catch {
      // SSE not supported or failed, will use polling
      setWsConnected(false);
    }
  }, [symbol]);

  // Polling fallback for price updates when WebSocket isn't connected
  useEffect(() => {
    if (!symbol || wsConnected) return;

    const pollPrice = async () => {
      try {
        const quoteData = await apiFetch<Quote>(`/api/market/quote?symbol=${symbol}`);
        setQuote(quoteData);
      } catch {
        // Ignore polling errors
      }
    };

    const interval = setInterval(pollPrice, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [symbol, wsConnected]);

  const chartData = useMemo(() => {
    if (!candles || candles.status !== "ok") {
      return [];
    }
    return candles.timestamps.map((timestamp, index) => ({
      timestamp,
      close: candles.close[index],
    }));
  }, [candles]);

  const metricItems = useMemo(() => {
    const toNumber = (value: unknown) => {
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const formatRatio = (value: number) => value.toFixed(2);

    return [
      {
        label: "Company",
        value: fundamentals?.name || fundamentals?.ticker || symbol,
        format: (value: string) => value,
      },
      {
        label: "Industry",
        value: fundamentals?.finnhubIndustry,
        format: (value: string) => value,
      },
      {
        label: "Market Cap",
        value: toNumber(fundamentals?.marketCap ?? metrics?.marketCap),
        format: formatLargeNumber,
      },
      {
        label: "P/E Ratio",
        value: toNumber(metrics?.peRatio),
        format: formatRatio,
      },
      {
        label: "P/B Ratio",
        value: toNumber(metrics?.pbRatio),
        format: formatRatio,
      },
      {
        label: "Beta",
        value: toNumber(metrics?.beta),
        format: formatRatio,
      },
      {
        label: "Dividend Yield",
        value: toNumber(metrics?.dividendYield),
        format: (value: number) => `${value.toFixed(2)}%`,
      },
      {
        label: "52W High",
        value: toNumber(metrics?.fiftyTwoWeekHigh),
        format: (value: number) => formatCurrency(value),
      },
      {
        label: "52W Low",
        value: toNumber(metrics?.fiftyTwoWeekLow),
        format: (value: number) => formatCurrency(value),
      },
      {
        label: "52W Return",
        value: toNumber(metrics?.fiftyTwoWeekPriceReturn),
        format: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
      },
      {
        label: "Avg Volume (10D)",
        value: toNumber(metrics?.tenDayAverageTradingVolume),
        format: (value: number) => `${formatLargeNumber(value * 1e6)}`,
      },
      {
        label: "EPS Growth",
        value: toNumber(metrics?.epsGrowth),
        format: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
      },
      {
        label: "Revenue Growth",
        value: toNumber(metrics?.revenueGrowth),
        format: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
      },
      {
        label: "ROE",
        value: toNumber(metrics?.roeTTM),
        format: (value: number) => `${value.toFixed(2)}%`,
      },
      {
        label: "Gross Margin",
        value: toNumber(metrics?.grossMarginTTM),
        format: (value: number) => `${value.toFixed(2)}%`,
      },
      {
        label: "50D MA",
        value: toNumber(metrics?.fiftyDayMA),
        format: (value: number) => formatCurrency(value),
      },
      {
        label: "200D MA",
        value: toNumber(metrics?.twoHundredDayMA),
        format: (value: number) => formatCurrency(value),
      },
    ];
  }, [fundamentals, metrics, symbol]);

  useEffect(() => {
    if (side === "SELL" && amountType === "DOLLARS") {
      setAmountType("SHARES");
    }
  }, [amountType, side]);

  // Use live price if available, otherwise fall back to quote price
  const currentPrice = livePrice ?? quote?.current ?? 0;
  const effectiveAmountType = side === "SELL" ? "SHARES" : amountType;
  
  // Calculate estimated shares and cost based on input
  const { estimatedShares, estimatedCost } = useMemo(() => {
    const parsedAmount = parseFloat(quantity) || 0;
    
    if (effectiveAmountType === "DOLLARS") {
      const shares = currentPrice > 0 ? parsedAmount / currentPrice : 0;
      return { estimatedShares: shares, estimatedCost: parsedAmount };
    } else {
      const cost = parsedAmount * currentPrice;
      return { estimatedShares: parsedAmount, estimatedCost: cost };
    }
  }, [quantity, currentPrice, effectiveAmountType]);

  const handleTrade = async () => {
    if (!symbol) {
      return;
    }
    if (!session?.access_token) {
      setTradeStatus("Sign in to place trades.");
      return;
    }

    if (!Number.isFinite(estimatedShares) || estimatedShares <= 0) {
      setTradeStatus("Enter a valid order size.");
      return;
    }
    if (!currentPrice || currentPrice <= 0) {
      setTradeStatus("Price unavailable. Try again shortly.");
      return;
    }

    setTradeSubmitting(true);
    setTradeStatus(null);
    try {
      await apiFetch("/api/trades", {
        token: session.access_token,
        method: "POST",
        body: {
          symbol,
          side,
          quantity: estimatedShares,
        },
      });
      setTradeStatus("Order executed.");
    } catch (err) {
      setTradeStatus(err instanceof Error ? err.message : "Trade failed.");
    } finally {
      setTradeSubmitting(false);
    }
  };

  const changeTone = (quote?.change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="flex-1 px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.3em] text-slate-500 hover:text-slate-700"
          >
            {"< Back to portfolio"}
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Market</p>
        </div>

        {error ? (
          <div className="glass-panel rounded-2xl border border-red-200 bg-red-50/80 px-6 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-6">
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {fundamentals?.logo ? (
                    <Image 
                      src={fundamentals.logo} 
                      alt={`${fundamentals.name || symbol} logo`}
                      width={48}
                      height={48}
                      className="rounded-xl object-contain bg-white p-1 border border-slate-200"
                      unoptimized
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
                      {symbol}
                      {wsConnected && (
                        <span className="flex items-center gap-1 text-emerald-600 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </p>
                    <h1 className="mt-2 text-4xl font-semibold text-slate-900 font-mono">
                      {loading ? "--" : formatCurrency(currentPrice)}
                    </h1>
                    <p className={`mt-2 text-sm font-mono ${changeTone}`}>
                      {loading
                        ? "--"
                        : `${formatCurrency(quote?.change ?? 0)} (${formatPercent(
                            quote?.percentChange ?? 0
                          )})`}
                    </p>
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
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
                  <p>Day range</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 font-mono">
                    {loading
                      ? "--"
                      : `${formatCurrency(quote?.low ?? 0)} - ${formatCurrency(
                          quote?.high ?? 0
                        )}`}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {ranges.map((item) => (
                  <button
                    key={item}
                    onClick={() => setRange(item)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      range === item
                        ? "bg-teal-700 text-white"
                        : "border border-slate-200 bg-white/70 text-slate-600"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-6 h-64">
                {candlesError ? (
                  <div className="flex h-full flex-col items-center justify-center text-sm text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="font-medium text-slate-600">Price Chart Unavailable</p>
                    <p className="mt-1 text-xs text-slate-400">Historical data requires a premium API plan</p>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {loading ? "Loading chart..." : "No price history available."}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) =>
                          new Date(value * 1000).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) => formatCurrency(value)}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) {
                            return null;
                          }
                          const value = payload[0].value as number;
                          return (
                            <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
                              {formatCurrency(value)}
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="#0f766e"
                        strokeWidth={2}
                        fill="url(#priceFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Key Statistics
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Valuation, performance, and financial metrics.
              </p>
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
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 font-mono">
                      {item.value === null || item.value === undefined || item.value === ""
                        ? "--"
                        : item.format(item.value as never)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="glass-panel rounded-3xl p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Order Ticket
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Place a market order for {symbol}.
              </p>

              <div className="mt-4 flex gap-2">
                {["BUY", "SELL"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSide(item as "BUY" | "SELL")}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
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

              {side === "BUY" ? (
                <div className="mt-3 flex gap-2">
                  {(["SHARES", "DOLLARS"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setAmountType(item)}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        amountType === item
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white/70 text-slate-600"
                      }`}
                    >
                      {item === "SHARES" ? "Shares" : "Dollars"}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-slate-500">
                {effectiveAmountType === "DOLLARS"
                  ? "Amount in dollars"
                  : "Shares (fractional allowed)"}
                <input
                  type="number"
                  min="0"
                  step={effectiveAmountType === "DOLLARS" ? "0.01" : "0.0001"}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </label>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {side === "SELL" ? "Est. proceeds:" : "Est. cost:"}{" "}
                    <span className="font-mono text-slate-900">
                      {currentPrice ? formatCurrency(estimatedCost) : "--"}
                    </span>
                  </span>
                  <span>
                    Est. shares:{" "}
                    <span className="font-mono text-slate-900">
                      {currentPrice ? formatNumber(estimatedShares) : "--"}
                    </span>
                  </span>
                </div>
              </div>

              {tradeStatus ? (
                <p className="mt-3 text-xs text-slate-500">{tradeStatus}</p>
              ) : null}

              <button
                type="button"
                onClick={handleTrade}
                disabled={tradeSubmitting}
                className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tradeSubmitting ? "Submitting..." : "Place order"}
              </button>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Quick Stats
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Open</span>
                  <span className="font-mono text-slate-900">
                    {loading ? "--" : formatCurrency(quote?.open ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Previous Close</span>
                  <span className="font-mono text-slate-900">
                    {loading ? "--" : formatCurrency(quote?.prevClose ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Day High</span>
                  <span className="font-mono text-slate-900">
                    {loading ? "--" : formatCurrency(quote?.high ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Day Low</span>
                  <span className="font-mono text-slate-900">
                    {loading ? "--" : formatCurrency(quote?.low ?? 0)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3"></div>
                <div className="flex items-center justify-between">
                  <span>52W High</span>
                  <span className="font-mono text-slate-900">
                    {metrics?.fiftyTwoWeekHigh ? formatCurrency(metrics.fiftyTwoWeekHigh) : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>52W Low</span>
                  <span className="font-mono text-slate-900">
                    {metrics?.fiftyTwoWeekLow ? formatCurrency(metrics.fiftyTwoWeekLow) : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Beta</span>
                  <span className="font-mono text-slate-900">
                    {metrics?.beta ? metrics.beta.toFixed(2) : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>P/E Ratio</span>
                  <span className="font-mono text-slate-900">
                    {metrics?.peRatio ? metrics.peRatio.toFixed(2) : "--"}
                  </span>
                </div>
              </div>
            </div>

            {!session ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
                Sign in from the dashboard to place trades.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
