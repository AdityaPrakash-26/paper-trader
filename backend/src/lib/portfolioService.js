const { getPositions, calculateHoldings, calculateNetWorth } = require('./portfolio');
const { getQuotes } = require('./quotes');

async function buildPortfolioState({ userId, cashBalance }) {
  const positions = await getPositions(userId);
  const quotesBySymbol = await getQuotes(positions.map((pos) => pos.symbol));
  const holdings = calculateHoldings(positions, quotesBySymbol);
  const summary = calculateNetWorth(cashBalance, holdings, quotesBySymbol);

  return {
    positions,
    quotesBySymbol,
    holdings,
    summary,
  };
}

module.exports = {
  buildPortfolioState,
};
