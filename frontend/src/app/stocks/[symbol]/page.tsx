"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { StockHeader } from "@/components/stocks/StockHeader";
import { PriceChartCard } from "@/components/stocks/PriceChartCard";
import { KeyStatsCard } from "@/components/stocks/KeyStatsCard";
import { OrderTicketCard } from "@/components/stocks/OrderTicketCard";
import { QuickStatsCard } from "@/components/stocks/QuickStatsCard";
import { useStockPage } from "./useStockPage";

export default function StockDetailPage() {
  const params = useParams();
  const {
    symbol,
    session,
    ranges,
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
    xDomain,
    livePriceTimestamp,
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
    watchlistDisabled,
    watchlistError,
    toggleWatchlist,
    side,
    setSide,
    amountType,
    setAmountType,
    quantity,
    setQuantity,
    setTradeStatus,
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
    accountLoading,
    accountError,
    loadAccountState,
    buyingPower,
    ownedShares,
    positionValue,
    changeTone,
    chartTone,
    currentPrice,
    candlesError,
  } = useStockPage(params?.symbol);

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
              <StockHeader
                symbol={symbol}
                fundamentals={fundamentals}
                loading={loading}
                currentPrice={currentPrice}
                changeTone={changeTone}
                rangeChangeData={rangeChangeData}
                quoteChange={{ change: quote?.change, percentChange: quote?.percentChange }}
                marketOpen={marketOpen}
                showLive={showLive}
                rangeStats={rangeStats}
                watchlisted={watchlisted}
                watchlistCta={watchlistCta}
                watchlistDisabled={watchlistDisabled}
                watchlistError={watchlistError}
                session={session}
                onToggleWatchlist={toggleWatchlist}
              />
            </div>

            <PriceChartCard
              range={range}
              ranges={ranges}
              onRangeChange={setRange}
              chartData={chartData}
              xDomain={xDomain}
              liveTimestamp={livePriceTimestamp}
              tone={chartTone}
              showMarkers={marketOpen}
              candlesError={candlesError}
              loading={loading}
              yDomain={yDomain}
              formatBucketLabel={(value) => formatBucketLabel(value, getGroupingForRange(range))}
            />

            <KeyStatsCard
              metricItems={metricItems}
              fundamentalsError={fundamentalsError}
              metricsError={metricsError}
            />
          </div>

          <div className="flex flex-col gap-6">
            <OrderTicketCard
              symbol={symbol}
              session={session}
              showLive={showLive}
              accountLoading={accountLoading}
              accountError={accountError}
              buyingPower={buyingPower}
              ownedShares={ownedShares}
              positionValue={positionValue}
              currentPrice={currentPrice}
              onRefreshAccount={loadAccountState}
              side={side}
              onSideChange={(value) => {
                setSide(value);
                setTradeStatus(null);
              }}
              amountType={amountType}
              onAmountTypeChange={(value) => {
                setAmountType(value);
                setTradeStatus(null);
              }}
              quantity={quantity}
              onQuantityChange={(value) => {
                setQuantity(value);
                setTradeStatus(null);
              }}
              dollarShortcuts={dollarShortcuts}
              shareShortcuts={shareShortcuts}
              estimatedCost={estimatedCost}
              estimatedShares={estimatedShares}
              projectedBuyingPower={projectedBuyingPower}
              insufficientBuyingPower={insufficientBuyingPower}
              buyingPowerDeficit={buyingPowerDeficit}
              orderDisabled={orderDisabled}
              orderCta={orderCta}
              handleTrade={handleTrade}
              tradeStatus={tradeStatus}
            />

            <QuickStatsCard loading={loading} quote={quote} metrics={metrics} />

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
