"use client";

import type { Session } from "@supabase/supabase-js";
import { formatCurrency, formatNumber } from "@/lib/format";

type TradeStatus = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type OrderTicketCardProps = {
  symbol?: string;
  session: Session | null;
  showLive: boolean;
  accountLoading: boolean;
  accountError: string | null;
  buyingPower: number | null;
  ownedShares: number | null;
  positionValue: number | null;
  currentPrice: number;
  onRefreshAccount: () => void;
  side: "BUY" | "SELL";
  onSideChange: (value: "BUY" | "SELL") => void;
  amountType: "SHARES" | "DOLLARS";
  onAmountTypeChange: (value: "SHARES" | "DOLLARS") => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  dollarShortcuts: number[];
  shareShortcuts: number[];
  estimatedCost: number;
  estimatedShares: number;
  projectedBuyingPower: number | null;
  insufficientBuyingPower: boolean;
  buyingPowerDeficit: number;
  orderDisabled: boolean;
  orderCta: string;
  handleTrade: () => void;
  tradeStatus: TradeStatus;
};

export function OrderTicketCard({
  symbol,
  session,
  showLive,
  accountLoading,
  accountError,
  buyingPower,
  ownedShares,
  positionValue,
  currentPrice,
  onRefreshAccount,
  side,
  onSideChange,
  amountType,
  onAmountTypeChange,
  quantity,
  onQuantityChange,
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
}: OrderTicketCardProps) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Order Ticket</p>
          <p className="mt-2 text-sm text-slate-500">Place a market order for {symbol}.</p>
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Buying power</p>
            {session ? (
              <button
                type="button"
                onClick={onRefreshAccount}
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
          <p className="mt-1 text-xs text-slate-500">Cash available for immediate buys.</p>
          {accountError ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              {accountError}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Position</p>
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
            Live price: <span className="font-mono text-slate-900">{formatCurrency(currentPrice)}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {["BUY", "SELL"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSideChange(item as "BUY" | "SELL")}
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
            onClick={() => onAmountTypeChange(item)}
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
        {amountType === "DOLLARS" ? "Amount in dollars" : "Shares"}
        <input
        type="number"
        min="0"
        step={amountType === "DOLLARS" ? "0.01" : "0.0001"}
        max={
          side === "BUY" && amountType === "DOLLARS" && buyingPower !== null ? buyingPower : undefined
        }
        value={quantity}
        onChange={(event) => onQuantityChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
      />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {(amountType === "DOLLARS" ? dollarShortcuts : shareShortcuts).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onQuantityChange(value.toString())}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
          >
            {amountType === "DOLLARS" ? formatCurrency(value) : `${value} ${value === 1 ? "share" : "shares"}`}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {side === "SELL" ? "Est. proceeds:" : "Order total:"}{" "}
            <span className="font-mono text-slate-900">{formatCurrency(estimatedCost)}</span>
          </span>
          <span>
            Est. shares: <span className="font-mono text-slate-900">{formatNumber(estimatedShares)}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span>Buying power after trade</span>
          <span
            className={`font-mono ${
              projectedBuyingPower !== null && projectedBuyingPower < 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {projectedBuyingPower !== null ? formatCurrency(projectedBuyingPower) : "--"}
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
          side === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {orderCta}
      </button>
      <p className="mt-2 text-[11px] text-slate-500">
        Orders execute against the latest market price; fractional shares supported.
      </p>
    </div>
  );
}
