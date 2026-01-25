"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Holding, RangeFilter } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const RANGE_OPTIONS: RangeFilter[] = ["1D", "1W", "1M", "6M", "YTD", "1Y", "MAX"];
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;
const POINTS_BY_RANGE: Record<RangeFilter, number | null> = {
  "1D": null,
  "1W": 7,
  "1M": 30,
  "6M": 180,
  "YTD": 366,
  "1Y": 365,
  "MAX": 1825,
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

  return formatter.formatToParts(new Date()).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
};

const isMarketOpenNow = () => {
  const parts = getEasternTimeParts();
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const dayOfWeek = date.getUTCDay();
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
  peRatio?: number;
  pegRatio?: number;
  pbRatio?: number;
  psRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHighDate?: string;
  fiftyTwoWeekLowDate?: string;
  fiftyTwoWeekPriceReturn?: number;
  beta?: number;
  tenDayAverageTradingVolume?: number;
  threeMonthAverageTradingVolume?: number;
  dividendYield?: number;
  dividendPerShare?: number;
  epsGrowth?: number;
  revenueGrowth?: number;
  roeTTM?: number;
  roaTTM?: number;
  grossMarginTTM?: number;
  netMarginTTM?: number;
  debtToEquity?: number;
  currentRatio?: number;
  quickRatio?: number;
  marketCap?: number;
  bookValuePerShare?: number;
  revenuePerShare?: number;
  tenDayEMA?: number;
  fiftyDayMA?: number;
  twoHundredDayMA?: number;
};

type TradeStatus = {
  tone: "success" | "error" | "info";
  message: string;
};

const formatLargeNumber = (value: number) => {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
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
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

const startOfUTCMonth = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);

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
      return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    case "month":
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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

export function useStockPage(symbolParam: string | string[] | undefined) {
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

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const updateMarketStatus = () => setMarketOpen(isMarketOpenNow());
    updateMarketStatus();
    const timer = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!symbol) return;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setFundamentalsError(null);
      setMetricsError(null);
      setCandlesError(null);

      try {
        const quoteData = await apiFetch<Quote>(`/api/market/quote?symbol=${symbol}`);
        setQuote(quoteData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quote.");
      }

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

      try {
        const fundamentalsData = await apiFetch<Fundamentals>(
          `/api/market/fundamentals?symbol=${symbol}`
        );
        setFundamentals(fundamentalsData);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Fundamentals unavailable.";
        const friendly =
          raw.includes("403") || raw.includes("access to this resource")
            ? "Company profile is unavailable for this symbol."
            : raw;
        setFundamentals(null);
        setFundamentalsError(friendly);
      }

      try {
        const metricsData = await apiFetch<Metrics>(`/api/market/metrics?symbol=${symbol}`);
        setMetrics(metricsData);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Metrics unavailable.";
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

  useEffect(() => {
    if (!symbol || !marketOpen) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    const streamUrl = `${API_BASE}/api/market/stream?symbol=${symbol}`;
    try {
      const eventSource = new EventSource(streamUrl);
      wsRef.current = eventSource;
      eventSource.onopen = () => setWsConnected(true);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "trade" && Array.isArray(data.data)) {
            const trade = data.data.find((t: { s: string }) => t.s === symbol);
            if (trade && typeof trade.p === "number") {
              setLivePrice(trade.p);
            }
          }
        } catch {
          /* ignore */
        }
      };
      eventSource.onerror = () => setWsConnected(false);
      return () => {
        eventSource.close();
        wsRef.current = null;
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
    }
  }, [symbol, marketOpen]);

  useEffect(() => {
    if (!symbol || wsConnected || !marketOpen) return;
    const pollPrice = async () => {
      try {
        const quoteData = await apiFetch<Quote>(`/api/market/quote?symbol=${symbol}`);
        setQuote(quoteData);
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(pollPrice, 15000);
    return () => clearInterval(interval);
  }, [symbol, wsConnected, marketOpen]);

  const chartData = useMemo(() => {
    if (!candles || candles.status !== "ok") return [];
    const grouping = getGroupingForRange(range);
    const rawPoints = candles.timestamps.map((timestamp, index) => ({
      timestamp: timestamp * 1000,
      close: candles.close[index],
    }));
    if (rawPoints.length === 0) return [];
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
    return limit ? groupedPoints.slice(-limit) : groupedPoints;
  }, [candles, range]);

  const yDomain = useMemo(() => {
    if (!chartData.length) return undefined;
    const prices = chartData.map((point) => point.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = Math.max(max - min, Math.abs(max) * 0.01 || 1);
    const pad = span * 0.05;
    return [min - pad, max + pad] as [number, number];
  }, [chartData]);

  const metricItems = useMemo(() => {
    const toNumber = (value: unknown) => {
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const formatRatio = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--";
    return [
      {
        label: "Company",
        value: fundamentals?.name || fundamentals?.ticker || symbol,
        format: (v: unknown) => (typeof v === "string" ? v : "--"),
      },
      {
        label: "Industry",
        value: fundamentals?.finnhubIndustry,
        format: (v: unknown) => (typeof v === "string" ? v : "--"),
      },
      {
        label: "Market Cap",
        value: toNumber(fundamentals?.marketCap ?? metrics?.marketCap),
        format: (v: unknown) => (typeof v === "number" ? formatLargeNumber(v) : "--"),
      },
      { label: "P/E Ratio", value: toNumber(metrics?.peRatio), format: formatRatio },
      { label: "P/B Ratio", value: toNumber(metrics?.pbRatio), format: formatRatio },
      { label: "Beta", value: toNumber(metrics?.beta), format: formatRatio },
      {
        label: "Dividend Yield",
        value: toNumber(metrics?.dividendYield),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}%` : "--",
      },
      {
        label: "52W High",
        value: toNumber(metrics?.fiftyTwoWeekHigh),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? formatCurrency(v) : "--",
      },
      {
        label: "52W Low",
        value: toNumber(metrics?.fiftyTwoWeekLow),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? formatCurrency(v) : "--",
      },
      {
        label: "52W Return",
        value: toNumber(metrics?.fiftyTwoWeekPriceReturn),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v)
            ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
            : "--",
      },
      {
        label: "Avg Volume (10D)",
        value: toNumber(metrics?.tenDayAverageTradingVolume),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v)
            ? `${formatLargeNumber(v * 1e6)}`
            : "--",
      },
      {
        label: "EPS Growth",
        value: toNumber(metrics?.epsGrowth),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v)
            ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
            : "--",
      },
      {
        label: "Revenue Growth",
        value: toNumber(metrics?.revenueGrowth),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v)
            ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
            : "--",
      },
      {
        label: "ROE",
        value: toNumber(metrics?.roeTTM),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}%` : "--",
      },
      {
        label: "Gross Margin",
        value: toNumber(metrics?.grossMarginTTM),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}%` : "--",
      },
      {
        label: "50D MA",
        value: toNumber(metrics?.fiftyDayMA),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? formatCurrency(v) : "--",
      },
      {
        label: "200D MA",
        value: toNumber(metrics?.twoHundredDayMA),
        format: (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? formatCurrency(v) : "--",
      },
    ];
  }, [fundamentals, metrics, symbol]);

  const currentPrice =
    (marketOpen ? livePrice ?? quote?.current ?? quote?.prevClose : quote?.prevClose ?? quote?.current) ?? 0;
  const effectiveAmountType = amountType;
  const showLive = marketOpen && wsConnected;

  const { estimatedShares, estimatedCost } = useMemo(() => {
    const parsedAmount = parseFloat(quantity) || 0;
    if (effectiveAmountType === "DOLLARS") {
      const shares = currentPrice > 0 ? parsedAmount / currentPrice : 0;
      return { estimatedShares: shares, estimatedCost: parsedAmount };
    }
    const cost = parsedAmount * currentPrice;
    return { estimatedShares: parsedAmount, estimatedCost: cost };
  }, [quantity, currentPrice, effectiveAmountType]);

  const projectedBuyingPower = useMemo(() => {
    if (buyingPower === null) return null;
    if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) return buyingPower;
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
    if (!buyingPower || buyingPower <= 0) return [50, 100, 250];
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
    insufficientBuyingPower && projectedBuyingPower !== null ? Math.abs(projectedBuyingPower) : 0;

  const rangeChangeData = useMemo(() => {
    if (!chartData.length) return { change: null, percent: null };
    const start = chartData[0]?.close ?? null;
    const end = currentPrice || chartData[chartData.length - 1]?.close || null;
    if (!start || !end || start <= 0) return { change: null, percent: null };
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
    if (!symbol) return;
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

  const handleTrade = async () => {
    if (!symbol) return;
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
        body: { symbol, side, quantity: estimatedShares },
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

  const changeTone = (rangeChangeData.change ?? quote?.change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600";

  return {
    symbol,
    session,
    ranges: RANGE_OPTIONS,
    loading,
    error,
    quote,
    metrics,
    fundamentals,
    fundamentalsError,
    metricsError,
    range,
    setRange,
    chartData,
    yDomain,
    rangeStats,
    rangeChangeData,
    metricItems,
    formatBucketLabel,
    getGroupingForRange,
    marketOpen,
    showLive,
    watchlisted,
    watchlistCta,
    watchlistDisabled: watchlistUpdating || watchlistChecking,
    watchlistError,
    toggleWatchlist,
    side,
    setSide,
    amountType,
    setAmountType,
    quantity,
    setQuantity,
    dollarShortcuts,
    shareShortcuts,
    estimatedCost,
    estimatedShares,
    projectedBuyingPower,
    insufficientBuyingPower,
    buyingPowerDeficit,
    orderDisabled,
    orderCta,
    handleTrade,
    tradeStatus,
    setTradeStatus,
    accountLoading,
    accountError,
    loadAccountState,
    buyingPower,
    ownedShares,
    positionValue,
    changeTone,
    currentPrice,
    showLivePrice: showLive,
    candlesError,
  };
}
