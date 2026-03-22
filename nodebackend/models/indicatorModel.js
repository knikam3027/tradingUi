function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveCombinedDeltaFromCandle(candle = {}) {
  const ce = candle.ce || {};
  const pe = candle.pe || {};

  const direct = toFiniteNumber(candle.c_delta);
  if (direct !== null) {
    return direct;
  }

  const ceDelta = toFiniteNumber(candle.ce_delta ?? ce.delta);
  const peDelta = toFiniteNumber(candle.pe_delta ?? pe.delta);

  if (ceDelta !== null && peDelta !== null) {
    return ceDelta - peDelta;
  }

  return null;
}

function resolveIvFromCandle(candle = {}) {
  const ce = candle.ce || {};
  const pe = candle.pe || {};

  const direct = toFiniteNumber(candle.iv);
  if (direct !== null) {
    return direct;
  }

  const ceIv = toFiniteNumber(candle.ce_iv ?? ce.iv);
  const peIv = toFiniteNumber(candle.pe_iv ?? pe.iv);

  if (ceIv !== null && peIv !== null) {
    return (ceIv + peIv) / 2;
  }

  return null;
}

function buildStraddleCandle(candle = {}) {
  const ce = candle.ce || {};
  const pe = candle.pe || {};

  const ceOpen = toFiniteNumber(ce.open);
  const ceClose = toFiniteNumber(ce.close);
  const peOpen = toFiniteNumber(pe.open);
  const peClose = toFiniteNumber(pe.close);
  const ceVolume = toFiniteNumber(ce.volume) ?? 0;
  const peVolume = toFiniteNumber(pe.volume) ?? 0;

  if (
    ceOpen === null
    || ceClose === null
    || peOpen === null
    || peClose === null
  ) {
    throw new Error('Each candle must include finite ce/pe open and close values');
  }

  const open = ceOpen + peOpen;
  const close = ceClose + peClose;

  return {
    datetime: candle.datetime ?? null,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    ce_ltp: ceClose,
    pe_ltp: peClose,
    ce_volume: ceVolume,
    pe_volume: peVolume,
    c_volume_total: ceVolume + peVolume,
    c_delta_total: resolveCombinedDeltaFromCandle(candle),
    iv_total: resolveIvFromCandle(candle),
  };
}

function buildStraddleCandles(candles = []) {
  return candles.map((candle) => buildStraddleCandle(candle));
}

function computeRmaSeries(values, length) {
  const result = new Array(values.length).fill(null);
  let sum = 0;
  let seedCount = 0;
  let seeded = false;
  let prev = null;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];

    if (value === null || value === undefined || Number.isNaN(value)) {
      result[i] = null;
      continue;
    }

    if (!seeded) {
      sum += value;
      seedCount += 1;

      if (seedCount === length) {
        prev = sum / length;
        result[i] = prev;
        seeded = true;
      }

      continue;
    }

    prev = ((prev * (length - 1)) + value) / length;
    result[i] = prev;
  }

  return result;
}

function computeRsiSeries(closes, length = 14) {
  const changes = closes.map((close, index) => {
    if (index === 0) return null;
    return close - closes[index - 1];
  });

  const gains = changes.map((change) => (
    change === null ? null : Math.max(change, 0)
  ));
  const losses = changes.map((change) => (
    change === null ? null : Math.max(-change, 0)
  ));

  const avgGain = computeRmaSeries(gains, length);
  const avgLoss = computeRmaSeries(losses, length);

  return closes.map((_, index) => {
    const gain = avgGain[index];
    const loss = avgLoss[index];

    if (gain === null || loss === null) {
      return null;
    }

    if (loss === 0) {
      return 100;
    }

    if (gain === 0) {
      return 0;
    }

    const rs = gain / loss;
    return 100 - (100 / (1 + rs));
  });
}

function computeRocSeries(closes, length = 14) {
  return closes.map((close, index) => {
    if (index < length) {
      return null;
    }

    const previous = closes[index - length];
    if (!Number.isFinite(previous) || previous === 0) {
      return null;
    }

    return ((close - previous) / previous) * 100;
  });
}

function computeDmiSeries(candles, length = 14) {
  const trRaw = [];
  const plusDmRaw = [];
  const minusDmRaw = [];

  for (let i = 0; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];

    const up = i === 0 ? null : current.high - previous.high;
    const down = i === 0 ? null : -(current.low - previous.low);
    const prevClose = i === 0 ? 0 : previous.close;

    trRaw.push(
      Math.max(
        Math.max(current.high - current.low, Math.abs(current.high - prevClose)),
        Math.abs(current.low - prevClose),
      ),
    );

    plusDmRaw.push(
      up === null
        ? null
        : (up > down && up > 0 ? up : 0)
    );
    minusDmRaw.push(
      down === null
        ? null
        : (down > up && down > 0 ? down : 0)
    );
  }

  const trRma = computeRmaSeries(trRaw, length);
  const plusRma = computeRmaSeries(plusDmRaw, length);
  const minusRma = computeRmaSeries(minusDmRaw, length);

  const diPlus = new Array(candles.length).fill(null);
  const diMinus = new Array(candles.length).fill(null);
  const dx = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i += 1) {
    const tr = trRma[i];
    const plus = plusRma[i];
    const minus = minusRma[i];

    if (
      tr === null
      || plus === null
      || minus === null
      || tr === 0
    ) {
      continue;
    }

    const plusValue = (100 * plus) / tr;
    const minusValue = (100 * minus) / tr;
    const denominator = plusValue + minusValue;

    diPlus[i] = plusValue;
    diMinus[i] = minusValue;
    dx[i] = denominator === 0
      ? 0
      : (100 * Math.abs(plusValue - minusValue)) / denominator;
  }

  const adx = computeRmaSeries(dx, length);

  return {
    diPlus,
    diMinus,
    adx,
  };
}

function computeChopSeries(candles, length = 14) {
  const trRaw = [];

  for (let i = 0; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    const prevClose = i === 0 ? 0 : previous.close;

    trRaw.push(
      Math.max(
        Math.max(current.high - current.low, Math.abs(current.high - prevClose)),
        Math.abs(current.low - prevClose),
      ),
    );
  }

  const chop = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i += 1) {
    if (i < length - 1) {
      continue;
    }

    let trSum = 0;
    let highest = -Infinity;
    let lowest = Infinity;

    for (let j = i - length + 1; j <= i; j += 1) {
      trSum += trRaw[j];
      highest = Math.max(highest, candles[j].high);
      lowest = Math.min(lowest, candles[j].low);
    }

    const range = highest - lowest;
    if (range === 0) {
      chop[i] = null;
      continue;
    }

    chop[i] = 100 * (Math.log10(trSum / range) / Math.log10(length));
  }

  return chop;
}

function getLastFiniteValue(values = []) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function calculateLatestStraddleIndicators(straddleCandles, length = 14) {
  if (!Array.isArray(straddleCandles) || straddleCandles.length === 0) {
    return {
      rsi: null,
      roc: null,
      adx: null,
      di_plus: null,
      di_minus: null,
      chop: null,
    };
  }

  const closes = straddleCandles.map((candle) => candle.close);
  const rsiSeries = computeRsiSeries(closes, length);
  const rocSeries = computeRocSeries(closes, length);
  const dmiSeries = computeDmiSeries(straddleCandles, length);
  const chopSeries = computeChopSeries(straddleCandles, length);

  return {
    rsi: getLastFiniteValue(rsiSeries),
    roc: getLastFiniteValue(rocSeries),
    adx: getLastFiniteValue(dmiSeries.adx),
    di_plus: getLastFiniteValue(dmiSeries.diPlus),
    di_minus: getLastFiniteValue(dmiSeries.diMinus),
    chop: getLastFiniteValue(chopSeries),
  };
}

function resolveCombinedVolumeChange(latest, previous) {
  if (!previous) {
    return null;
  }

  return latest.c_volume_total - previous.c_volume_total;
}

function resolveCombinedDeltaChange(latest, previous) {
  if (!previous) {
    return null;
  }

  if (latest.c_delta_total === null || previous.c_delta_total === null) {
    return null;
  }

  return latest.c_delta_total - previous.c_delta_total;
}

function resolveIvChange(latest, previous) {
  if (!previous) {
    return null;
  }

  if (latest.iv_total === null || previous.iv_total === null) {
    return null;
  }

  return latest.iv_total - previous.iv_total;
}

function translateStrikeSeries(series = {}, options = {}) {
  const strike = Number(series.strike);
  if (!Number.isFinite(strike)) {
    throw new Error('Strike payload must include a finite strike');
  }

  const sourceCandles = Array.isArray(series.candles) ? series.candles : [];
  if (!sourceCandles.length) {
    throw new Error(`Strike ${strike} must include a non-empty candles array`);
  }

  const straddleCandles = buildStraddleCandles(sourceCandles);
  const latest = straddleCandles[straddleCandles.length - 1];
  const previous = straddleCandles.length > 1 ? straddleCandles[straddleCandles.length - 2] : null;
  const indicators = calculateLatestStraddleIndicators(straddleCandles, options.length ?? 14);

  return {
    strike,
    straddle_open: latest.open,
    straddle_close: latest.close,
    straddle_high: latest.high,
    straddle_low: latest.low,
    straddle_ltp: latest.close,
    change: latest.close - latest.open,
    ce_ltp: latest.ce_ltp,
    pe_ltp: latest.pe_ltp,
    c_volume: resolveCombinedVolumeChange(latest, previous),
    c_delta: resolveCombinedDeltaChange(latest, previous),
    iv: resolveIvChange(latest, previous),
    indicators,
  };
}

function translateStrikePayload(payload, options = {}) {
  const strikeSeries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.strikes)
      ? payload.strikes
      : [];

  if (!strikeSeries.length) {
    throw new Error('Payload must be an array of strike series or an object with a strikes array');
  }

  return strikeSeries.map((series) => translateStrikeSeries(series, options));
}

// Legacy helpers kept for the existing market endpoint.
function toCandles(pricePoints, intervalMs = 5 * 60 * 1000) {
  if (!Array.isArray(pricePoints) || pricePoints.length === 0) {
    return [];
  }

  const candles = [];
  let current = null;
  let bucket = null;

  for (const point of pricePoints) {
    if (!Array.isArray(point) || point.length < 2) {
      continue;
    }

    const timestamp = Number(point[0]);
    const price = Number(point[1]);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price)) {
      continue;
    }

    const nextBucket = Math.floor(timestamp / intervalMs);
    if (current === null || nextBucket !== bucket) {
      if (current) {
        candles.push(current);
      }

      bucket = nextBucket;
      current = {
        time: timestamp,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.close = price;
    }
  }

  if (current) {
    candles.push(current);
  }

  return candles;
}

function calculateAll(pricePoints) {
  const candles = toCandles(pricePoints, 5 * 60 * 1000);
  const indicators = calculateLatestStraddleIndicators(candles, 14);

  return {
    rsi: indicators.rsi,
    roc: indicators.roc,
    adx: indicators.adx,
    plusDI: indicators.di_plus,
    minusDI: indicators.di_minus,
    chop: indicators.chop,
  };
}

/**
 * Bucket 1-minute COMBINED STRADDLE candles into 5-minute candles.
 *
 * For a synthetic straddle (CE + PE), CE and PE move in opposite directions,
 * so adding individual option highs/lows OVERSTATES the combined range.
 * The correct H/L for each 5-min bucket is the max/min of the per-minute
 * combined close prices — this is the actual high/low the straddle reached.
 * The open is also included so that every candle's high >= open >= low.
 *
 * Expects each candle to have a `date` string like "YYYY-MM-DD HH:MM" and
 * already-combined open/close values (ce_open+pe_open, ce_close+pe_close).
 *
 * @param {Array<{date,open,close}>} candles - 1-min combined straddle candles
 * @returns {Array<{date,open,high,low,close}>}
 */
function toFiveMinCandles(candles) {
  const buckets = new Map();
  for (const c of candles) {
    const [datePart, timePart] = (c.date || '').split(' ');
    if (!datePart || !timePart) continue;
    const [hh, mm] = timePart.split(':').map(Number);
    const roundedMin = Math.floor(mm / 5) * 5;
    const key = `${datePart} ${String(hh).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`;
    if (!buckets.has(key)) {
      // First minute of this 5-min bar: open is the combined open of that minute
      buckets.set(key, {
        date:  key,
        open:  c.open,
        high:  Math.max(c.open, c.close),
        low:   Math.min(c.open, c.close),
        close: c.close,
      });
    } else {
      const b = buckets.get(key);
      // Extend H/L from the per-minute combined close (and open for first bar was already seeded)
      b.high  = Math.max(b.high, c.open, c.close);
      b.low   = Math.min(b.low,  c.open, c.close);
      b.close = c.close;
    }
  }
  return [...buckets.values()];
}

/**
 * Calculate indicators from prebuilt OHLC candles (no conversion needed).
 * @param {Array<{open,high,low,close}>} candles - 1-min or 5-min OHLC candles
 * @returns {{ rsi, roc, adx, plusDI, minusDI, chop }}
 */
function calculateAllFromCandles(candles) {
  if (!candles?.length) return { rsi: null, roc: null, adx: null, plusDI: null, minusDI: null, chop: null };
  const indicators = calculateLatestStraddleIndicators(candles, 14);
  return {
    rsi: indicators.rsi,
    roc: indicators.roc,
    adx: indicators.adx,
    plusDI: indicators.di_plus,
    minusDI: indicators.di_minus,
    chop: indicators.chop,
  };
}

function calcRegime(combinedLTP, combinedOpen, ceGain, peGain) {
  const direction = combinedLTP > combinedOpen ? 'UP' : combinedLTP < combinedOpen ? 'DOWN' : 'FLAT';
  const dominance = ceGain >= peGain ? 'CE' : 'PE';

  if (direction === 'UP' && dominance === 'CE') return 'BULLISH';
  if (direction === 'UP' && dominance === 'PE') return 'SHORT COV';
  if (direction === 'DOWN' && dominance === 'PE') return 'BEARISH';
  if (direction === 'DOWN' && dominance === 'CE') return 'DECAY';
  return 'SIDEWAYS';
}

function calcIndReg(rsi, plusDI, minusDI, adx) {
  if (adx === null || rsi === null) return 'NoTrend';
  if (adx < 15) return 'NoTrend';
  if (rsi > 55 && plusDI > minusDI) return 'Bullish';
  if (rsi < 45 && minusDI > plusDI) return 'Bearish';
  return 'Neutral';
}

function calcMode(rsi, plusDI, minusDI, adx) {
  if (rsi === null || adx === null) return 'WAIT...';
  if (adx < 15) return 'SHORT';
  if (rsi > 50 && plusDI > minusDI) return 'BUY CE';
  if (rsi < 40 && minusDI > plusDI) return 'BUY PE';
  if (adx > 20 && rsi >= 40 && rsi <= 60) return 'LONG STR';
  return 'SHORT';
}

function calcTradeType(mode, chop, combinedLTP, combinedOpen, ceGain, peGain) {
  // Safety filter
  if (chop > 61.8 || mode === 'WAIT...') return 'NoTrade';

  // Short filter
  if (mode === 'SHORT') {
    return combinedLTP < combinedOpen ? 'Sell Str' : 'NoTrade';
  }

  // Long filter (BUY CE, BUY PE, LONG STR)
  if (mode === 'BUY CE' || mode === 'BUY PE' || mode === 'LONG STR') {
    if (ceGain >= peGain) return 'Buy CE';
    if (peGain > ceGain) return 'Buy PE';
    return 'Buy Str';
  }

  return 'NoTrade';
}

function calcDelta(spot, strike, iv, daysToExpiry) {
  if (!iv || !daysToExpiry || daysToExpiry <= 0) return 0;
  const T = daysToExpiry / 365;
  const sigma = iv / 100;
  const r = 0.07;
  const d1 = (Math.log(spot / strike) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  return 0.5 * (1 + erf(d1 / Math.sqrt(2)));
}

// Black-Scholes call price
function bsCallPrice(spot, strike, T, sigma, r) {
  if (sigma <= 0 || T <= 0) return Math.max(spot - strike, 0);
  const d1 = (Math.log(spot / strike) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const Nd1 = 0.5 * (1 + erf(d1 / Math.sqrt(2)));
  const Nd2 = 0.5 * (1 + erf(d2 / Math.sqrt(2)));
  return spot * Nd1 - strike * Math.exp(-r * T) * Nd2;
}

// Implied Volatility from option price using Newton-Raphson
// Returns IV as a percentage (e.g. 15.5 means 15.5%)
function calcImpliedVolatility(spot, strike, price, daysToExpiry, optionType) {
  if (!spot || !strike || !price || price <= 0 || daysToExpiry <= 0) return 0;
  const T = daysToExpiry / 365;
  const r = 0.07;
  const intrinsic = optionType === 'PE'
    ? Math.max(strike - spot, 0)
    : Math.max(spot - strike, 0);
  if (price <= intrinsic) return 0;

  let sigma = 0.3; // Initial guess 30%
  for (let i = 0; i < 50; i++) {
    let modelPrice;
    if (optionType === 'PE') {
      // put = call - S + K*e^(-rT)  (put-call parity)
      modelPrice = bsCallPrice(spot, strike, T, sigma, r) - spot + strike * Math.exp(-r * T);
    } else {
      modelPrice = bsCallPrice(spot, strike, T, sigma, r);
    }
    const diff = modelPrice - price;
    if (Math.abs(diff) < 0.01) break;

    // Vega = S * sqrt(T) * N'(d1)
    const d1 = (Math.log(spot / strike) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const vega = spot * Math.sqrt(T) * Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
    if (vega < 1e-10) break;
    sigma -= diff / vega;
    if (sigma <= 0.001) sigma = 0.001;
    if (sigma > 5) sigma = 5;
  }
  return Number((sigma * 100).toFixed(1));
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

module.exports = {
  buildStraddleCandle,
  buildStraddleCandles,
  calculateLatestStraddleIndicators,
  translateStrikeSeries,
  translateStrikePayload,
  calculateAll,
  calculateAllFromCandles,
  toFiveMinCandles,
  calcRegime,
  calcIndReg,
  calcMode,
  calcTradeType,
  calcDelta,
  calcImpliedVolatility,
};
