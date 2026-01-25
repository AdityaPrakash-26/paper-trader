const WebSocket = require('ws');
const { config } = require('../config');

function openFinnhubStream(symbols) {
  if (!config.finnhubApiKey || !config.finnhubWsUrl) {
    throw new Error('Finnhub WebSocket is not configured.');
  }

  const ws = new WebSocket(config.finnhubWsUrl);

  const subscribe = () => {
    symbols.forEach((symbol) => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    });
  };

  const unsubscribe = () => {
    symbols.forEach((symbol) => {
      ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    });
  };

  return { ws, subscribe, unsubscribe };
}

module.exports = { openFinnhubStream };
