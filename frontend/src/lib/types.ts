export type PortfolioSummary = {
  cashBalance: number;
  holdingsValue: number;
  netWorth: number;
  dailyChange: number;
  dailyChangePercent: number;
  asOf: string;
};

export type Holding = {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  dailyPercent: number;
  marketValue: number;
  gain: number;
  gainPercent: number;
};

export type Trade = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  executed_at: string;
};

export type Snapshot = {
  id: string;
  net_worth: number;
  timestamp: string;
};

export type RangeFilter = "1W" | "1M" | "6M" | "YTD" | "1Y" | "MAX";
