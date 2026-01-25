function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundMoney(value) {
  return round(value, 2);
}

function roundShares(value) {
  return round(value, 4);
}

module.exports = {
  toNumber,
  roundMoney,
  roundShares,
};
