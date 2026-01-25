"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Holding, RangeFilter } from "@/lib/types";
import Navbar from "@/components/Navbar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ranges: RangeFilter[] = ["1D", "1W", "1M", "6M", "YTD", "1Y", "MAX"];
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;
const POINTS_BY_RANGE: Record<RangeFilter, number | null> = {
  "1D": null, // intraday points
  "1W": 7,
  "1M": 30,
  "6M": 180,
  "YTD": 366,
  "1Y": 365,
  "MAX": 1825, // ~5 years of daily points
};
type Grouping = "intraday" | "day" | "week" | "month" | "quarter";

const getEasternTimeParts = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(new Date()).reduce<Record<string, string>>(
    (acc, part) => {
      acc[part.type] = part.value;
      return acc;
    },
    {}
  );

  return parts;
};

const isMarketOpenNow = () => {
  const parts = getEasternTimeParts();
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  const minutes = hour * 60 + minute;
  return minutes >= MARKET_OPEN_MINUTES && minutes < MARKET_CLOSE_MINUTES;
};

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

type TradeStatus = {
  tone: "success" | "error" | "info";
  message: string;
};

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

const getGroupingForRange = (range: RangeFilter): Grouping => {
  switch (range) {
    case "1D":
      return "intraday";
    case "1W":
    case "1M":
      return "day";
    case "6M":
    case "YTD":
      return "week";
    case "1Y":
      return "month";
    case "MAX":
    default:
      return "quarter";
  }
};

const startOfUTCWeek = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday as start
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

const startOfUTCMonth = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);

const startOfUTCQuarter = (date: Date) => {
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1);
};

const bucketTimestamp = (timestamp: number, grouping: Grouping) => {
  const date = new Date(timestamp);
  switch (grouping) {
    case "day":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    case "week":
      return startOfUTCWeek(date);
    case "month":
      return startOfUTCMonth(date);
    case "quarter":
      return startOfUTCQuarter(date);
    case "intraday":
    default:
      return timestamp;
  }
};

const formatBucketLabel = (timestamp: number, grouping: Grouping) => {
  const date = new Date(timestamp);
  switch (grouping) {
    case "intraday":
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    case "day":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    case "week":
      return `Week of ${date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    case "month":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    case "quarter": {
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `Q${quarter} ${date.getUTCFullYear()}`;
    }
    default:
      return date.toDateString();
  }
};

const toEpochRange = (range: RangeFilter) => {
  const now = new Date();
  let fromDate = new Date(now);

  switch (range) {
    case "1D":
      fromDate.setDate(now.getDate() - 3);
      break;
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
  const [range, setRange] = useState<RangeFilter>("1D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amountType, setAmountType] = useState<"SHARES" | "DOLLARS">("SHARES");
  const [quantity, setQuantity] = useState("");
  const [tradeStatus, setTradeStatus] = useState<TradeStatus | null>(null);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [buyingPower, setBuyingPower] = useState<number | null>(null);
  const [ownedShares, setOwnedShares] = useState<number | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [marketOpen, setMarketOpen] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [watchlistChecking, setWatchlistChecking] = useState(false);
  const [watchlistUpdating, setWatchlistUpdating] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
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
    const updateMarketStatus = () => {
      setMarketOpen(isMarketOpenNow());
    };
    updateMarketStatus();
    const timer = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(timer);
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
        const resolution = range === "1D" ? "5" : "D";
        const candleData = await apiFetch<Candles>(
          `/api/market/candles?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`
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

  const loadAccountState = useCallback(async () => {
    if (!session?.access_token || !symbol) {
      setBuyingPower(null);
      setOwnedShares(null);
      return;
    }

    setAccountLoading(true);
    setAccountError(null);
    try {
      const data = await apiFetch<{
        cashBalance: number;
        holdingsValue: number;
        netWorth: number;
        dailyChange: number;
        dailyChangePercent: number;
        asOf: string;
        holdings: Holding[];
      }>("/api/portfolio/summary", { token: session.access_token });

      setBuyingPower(data.cashBalance);
      const holding = (data.holdings || []).find((item) => item.symbol === symbol);
      setOwnedShares(holding ? holding.shares : 0);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Unable to load buying power.");
    } finally {
      setAccountLoading(false);
    }
  }, [session?.access_token, symbol]);

  useEffect(() => {
    loadAccountState();
  }, [loadAccountState]);

  const loadWatchlistState = useCallback(async () => {
    if (!session?.access_token || !symbol) {
      setWatchlisted(false);
      setWatchlistError(null);
      setWatchlistChecking(false);
      return;
    }

    setWatchlistChecking(true);
    setWatchlistError(null);
    try {
      const data = await apiFetch<{ items: { symbol: string }[] }>(
        "/api/watchlist?includeQuotes=false",
        { token: session.access_token }
      );
      const exists = (data.items || []).some((item) => item.symbol === symbol);
      setWatchlisted(Boolean(exists));
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Unable to load watchlist.");
    } finally {
      setWatchlistChecking(false);
    }
  }, [session?.access_token, symbol]);

  useEffect(() => {
    loadWatchlistState();
  }, [loadWatchlistState]);

  // WebSocket/SSE for real-time price updates
  useEffect(() => {
    if (!symbol || !marketOpen) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    // Connect to the backend SSE stream for real-time prices during market hours
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
  }, [symbol, marketOpen]);

  // Polling fallback for price updates when WebSocket isn't connected
  useEffect(() => {
    if (!symbol || wsConnected || !marketOpen) return;

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
  }, [symbol, wsConnected, marketOpen]);

  const chartData = useMemo(() => {
    if (!candles || candles.status !== "ok") {
      return [];
    }

    const grouping = getGroupingForRange(range);
    const rawPoints = candles.timestamps.map((timestamp, index) => ({
      timestamp: timestamp * 1000,
      close: candles.close[index],
    }));

    if (rawPoints.length === 0) {
      return [];
    }

    // Ensure data is sorted
    rawPoints.sort((a, b) => a.timestamp - b.timestamp);

    if (grouping === "intraday") {
      const lastPoint = rawPoints[rawPoints.length - 1];
      const lastDateKey = new Date(lastPoint.timestamp).toISOString().slice(0, 10);
      return rawPoints.filter(
        (point) => new Date(point.timestamp).toISOString().slice(0, 10) === lastDateKey
      );
    }

    const buckets = new Map<number, { timestamp: number; close: number }>();
    rawPoints.forEach((point) => {
      const bucket = bucketTimestamp(point.timestamp, grouping);
      const existing = buckets.get(bucket);
      if (!existing || point.timestamp > existing.timestamp) {
        buckets.set(bucket, { timestamp: bucket, close: point.close });
      }
    });

    const groupedPoints = Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
    const limit = POINTS_BY_RANGE[range];
    const sliced = limit ? groupedPoints.slice(-limit) : groupedPoints;
    return sliced;
  }, [candles, range]);

  const yDomain = useMemo(() => {
    if (!chartData.length) return undefined;
    const prices = chartData.map((point) => point.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = Math.max(max - min, Math.abs(max) * 0.01 || 1);
    const pad = span * 0.05;
    return [min - pad, max + pad];
  }, [chartData]);

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
  }, [amountType, side]);

  // Use live price if market is open; otherwise show most recent close
  const currentPrice =
    (marketOpen ? livePrice ?? quote?.current ?? quote?.prevClose : quote?.prevClose ?? quote?.current) ?? 0;
  const effectiveAmountType = amountType;
  const showLive = marketOpen && wsConnected;
  
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

  const projectedBuyingPower = useMemo(() => {
    if (buyingPower === null) {
      return null;
    }
    if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) {
      return buyingPower;
    }
    return side === "BUY" ? buyingPower - estimatedCost : buyingPower + estimatedCost;
  }, [buyingPower, estimatedCost, side]);

  const insufficientBuyingPower =
    side === "BUY" &&
    buyingPower !== null &&
    Number.isFinite(estimatedCost) &&
    estimatedCost > 0 &&
    estimatedCost > buyingPower;

  const orderDisabled =
    tradeSubmitting ||
    !currentPrice ||
    !Number.isFinite(estimatedShares) ||
    estimatedShares <= 0 ||
    (side === "BUY" && insufficientBuyingPower);

  const orderCta = !session
    ? "Sign in to trade"
    : tradeSubmitting
    ? "Submitting..."
    : side === "BUY"
    ? "Buy now"
    : "Sell now";

  const dollarShortcuts = useMemo(() => {
    if (!buyingPower || buyingPower <= 0) {
      return [50, 100, 250];
    }
    const choices = [
      Math.max(10, Math.round(buyingPower * 0.1)),
      Math.max(25, Math.round(buyingPower * 0.25)),
      Math.round(buyingPower),
    ];
    return Array.from(new Set(choices));
  }, [buyingPower]);

  const shareShortcuts = [1, 5, 10];
  const positionValue = ownedShares !== null && currentPrice ? ownedShares * currentPrice : null;
  const buyingPowerDeficit =
    insufficientBuyingPower && projectedBuyingPower !== null
      ? Math.abs(projectedBuyingPower)
      : 0;
  const rangeChangeData = useMemo(() => {
    if (!chartData.length) {
      return { change: null, percent: null };
    }
    const start = chartData[0]?.close ?? null;
    const end = currentPrice || chartData[chartData.length - 1]?.close || null;
    if (!start || !end || start <= 0) {
      return { change: null, percent: null };
    }
    const change = end - start;
    const percent = (change / start) * 100;
    return { change, percent };
  }, [chartData, currentPrice]);

  const rangeStats = useMemo(() => {
    if (chartData.length) {
      const closes = chartData.map((point) => point.close);
      return {
        low: Math.min(...closes),
        high: Math.max(...closes),
        label: "Range (selected interval)",
      };
    }
    return {
      low: quote?.low ?? null,
      high: quote?.high ?? null,
      label: "Day range",
    };
  }, [chartData, quote?.high, quote?.low]);

  const watchlistCta = watchlistUpdating
    ? "Saving..."
    : watchlistChecking
    ? "Checking..."
    : watchlisted
    ? "Watching"
    : "Watch";

  const toggleWatchlist = async () => {
    if (!symbol) {
      return;
    }
    if (!session?.access_token) {
      setWatchlistError("Sign in to save this symbol.");
      return;
    }

    setWatchlistUpdating(true);
    setWatchlistError(null);
    try {
      if (watchlisted) {
        await apiFetch(`/api/watchlist/${symbol}`, {
          token: session.access_token,
          method: "DELETE",
        });
        setWatchlisted(false);
      } else {
        await apiFetch("/api/watchlist", {
          token: session.access_token,
          method: "POST",
          body: { symbol },
        });
        setWatchlisted(true);
      }
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Unable to update watchlist.");
    } finally {
      setWatchlistUpdating(false);
    }
  };

  const handleTrade = async () => {
    if (!symbol) {
      return;
    }
    if (!session?.access_token) {
      setTradeStatus({ tone: "error", message: "Sign in to place trades." });
      return;
    }

    if (!Number.isFinite(estimatedShares) || estimatedShares <= 0) {
      setTradeStatus({ tone: "error", message: "Enter a valid order size." });
      return;
    }
    if (!currentPrice || currentPrice <= 0) {
      setTradeStatus({ tone: "error", message: "Price unavailable. Try again shortly." });
      return;
    }
    if (insufficientBuyingPower) {
      setTradeStatus({ tone: "error", message: "Order exceeds available buying power." });
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
      setTradeStatus({
        tone: "success",
        message: side === "BUY" ? "Buy order executed." : "Sell order executed.",
      });
      setQuantity("");
      await loadAccountState();
    } catch (err) {
      setTradeStatus({
        tone: "error",
        message: err instanceof Error ? err.message : "Trade failed.",
      });
    } finally {
      setTradeSubmitting(false);
    }
  };

  const changeTone =
    (rangeChangeData.change ?? quote?.change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="flex-1 px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Navbar session={session} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.3em] text-slate-500 hover:text-slate-700"
          >
            {"< Back to portfolio"}
          </Link>
        </div>

        {error ? (
          <div className="glass-panel rounded-2xl border border-red-200 bg-red-50/80 px-6 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-6">
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-1 min-w-[260px] items-start gap-4">
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
                      {loading ? "--" : formatCurrency(currentPrice)}
                    </h1>
                    <p className={`mt-2 text-sm font-mono ${changeTone}`}>
                      {loading
                        ? "--"
                        : rangeChangeData.change !== null && rangeChangeData.percent !== null
                        ? `${formatCurrency(rangeChangeData.change)} (${formatPercent(
                            rangeChangeData.percent
                          )})`
                        : `${formatCurrency(quote?.change ?? 0)} (${formatPercent(
                            quote?.percentChange ?? 0
                          )})`}
                    </p>
                    {!marketOpen && (
                      <p className="mt-1 text-xs text-slate-500">As of last close</p>
                    )}
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
                    onClick={toggleWatchlist}
                    disabled={watchlistUpdating || watchlistChecking}
                    className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                      watchlisted
                        ? "border border-teal-600 bg-teal-50 text-teal-700"
                        : "border border-slate-200 bg-white/80 text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    <span className="flex items-center gap-2">
                      <StarIcon filled={watchlisted} />
                      <span>{watchlistCta}</span>
                    </span>
                  </button>
                  <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
                    <p>{rangeStats.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 font-mono">
                      {loading
                        ? "--"
                        : rangeStats.low === null || rangeStats.high === null
                        ? "--"
                        : `${formatCurrency(rangeStats.low)} - ${formatCurrency(rangeStats.high)}`}
                    </p>
                  </div>
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
                        tickFormatter={(value) => formatBucketLabel(value, getGroupingForRange(range))}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={10}
                      />
                      <YAxis
                        tickFormatter={(value) => formatCurrency(value)}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        domain={yDomain || ["auto", "auto"]}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) {
                            return null;
                          }
                          const point = payload[0].payload as { timestamp: number; close: number };
                          const label = formatBucketLabel(point.timestamp, getGroupingForRange(range));
                          return (
                            <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
                              <p className="font-semibold">{formatCurrency(point.close)}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{label}</p>
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    Order Ticket
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Place a market order for {symbol}.
                  </p>
                </div>
                {showLive ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    Live
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                    Market closed
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Buying power
                    </p>
                    {session ? (
                      <button
                        type="button"
                        onClick={loadAccountState}
                        disabled={accountLoading}
                        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {accountLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xl font-semibold text-slate-900 font-mono">
                    {session
                      ? accountLoading
                        ? "Loading..."
                        : formatCurrency(buyingPower ?? 0)
                      : "Sign in to view"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Cash available for immediate buys.
                  </p>
                  {accountError ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                      {accountError}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Position
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900 font-mono">
                    {ownedShares !== null ? `${formatNumber(ownedShares)} shares` : "--"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Value:{" "}
                    <span className="font-mono text-slate-900">
                      {positionValue !== null ? formatCurrency(positionValue) : "--"}
                    </span>
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Live price:{" "}
                    <span className="font-mono text-slate-900">
                      {currentPrice ? formatCurrency(currentPrice) : "Loading..."}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                {["BUY", "SELL"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSide(item as "BUY" | "SELL");
                      setTradeStatus(null);
                    }}
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

                <div className="mt-3 flex gap-2">
                  {(["SHARES", "DOLLARS"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setAmountType(item);
                        setTradeStatus(null);
                      }}
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

              <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-slate-500">
                {effectiveAmountType === "DOLLARS"
                  ? "Amount in dollars"
                  : "Shares"}
                <input
                  type="number"
                  min="0"
                  step={effectiveAmountType === "DOLLARS" ? "0.01" : "0.0001"}
                  max={
                    side === "BUY" && effectiveAmountType === "DOLLARS" && buyingPower !== null
                      ? buyingPower
                      : undefined
                  }
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    setTradeStatus(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                {(effectiveAmountType === "DOLLARS" ? dollarShortcuts : shareShortcuts).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setQuantity(value.toString());
                      setTradeStatus(null);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
                  >
                    {effectiveAmountType === "DOLLARS"
                      ? formatCurrency(value)
                      : `${value} ${value === 1 ? "share" : "shares"}`}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 text-xs text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {side === "SELL" ? "Est. proceeds:" : "Order total:"}{" "}
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
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span>Buying power after trade</span>
                  <span
                    className={`font-mono ${
                      projectedBuyingPower !== null && projectedBuyingPower < 0
                        ? "text-red-600"
                        : "text-slate-900"
                    }`}
                  >
                    {projectedBuyingPower !== null
                      ? formatCurrency(projectedBuyingPower)
                      : buyingPower !== null
                      ? formatCurrency(buyingPower)
                      : "--"}
                  </span>
                </div>
                {insufficientBuyingPower ? (
                  <p className="mt-2 text-[11px] text-red-600">
                    Exceeds buying power by {formatCurrency(buyingPowerDeficit)}
                  </p>
                ) : null}
              </div>

              {tradeStatus ? (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    tradeStatus.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : tradeStatus.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {tradeStatus.message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleTrade}
                disabled={orderDisabled}
                className={`mt-4 w-full rounded-xl px-3 py-3 text-sm font-semibold text-white transition ${
                  side === "BUY"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {orderCta}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
                Orders execute against the latest market price; fractional shares supported.
              </p>
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
