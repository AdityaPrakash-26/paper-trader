const { getQuote } = require('./finnhub');

async function getQuotes(symbols) {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const quotes = await Promise.all(uniqueSymbols.map((symbol) => getQuote(symbol)));
  return quotes.reduce((acc, quote) => {
    acc[quote.symbol] = quote;
    return acc;
  }, {});
}

module.exports = {
  getQuotes,
};
