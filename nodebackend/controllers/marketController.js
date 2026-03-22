const { fetchNiftyData, fetchNiftyChain, fetchNiftyIntraday } = require('../models/marketModel');
const { isConnected, getAccessToken } = require('../models/authModel');
const { fetchNiftyOptionChain, fetchNiftyIntraday: fetchHdfcIntraday } = require('../models/hdfcSkyModel');
const fs = require('fs/promises');
const path = require('path');
const {
  calcRegime, calcIndReg, calcMode, calcTradeType, translateStrikePayload, calcDelta, calculateAll, calculateAllFromCandles, toFiveMinCandles, calcImpliedVolatility,
} = require('../models/indicatorModel');

const MARKET_TZ = 'Asia/Kolkata';
const SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'last-close-strikes.json');
const STRADDLE_HISTORY_FILE = path.join(__dirname, '..', 'data', 'straddle-history.json');
const MAX_STRADDLE_HISTORY = 120;

function getISTNowParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MARKET_TZ,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());

  const pick = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    weekday: pick('weekday'),
    hour: Number(pick('hour') || 0),
    minute: Number(pick('minute') || 0),
  };
}

function isMarketHoursIST() {
  const { weekday, hour, minute } = getISTNowParts();
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
  if (!isWeekday) return false;
  const nowMins = hour * 60 + minute;
  return nowMins >= (9 * 60 + 15) && nowMins <= (15 * 60 + 30);
}

function hasValidNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function hasValidPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function normalizeIndicators(indicators) {
  const source = indicators && typeof indicators === 'object' ? indicators : {};
  const toNumberOrNull = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  return {
    roc: toNumberOrNull(source.roc),
    rsi: toNumberOrNull(source.rsi),
    minusDI: toNumberOrNull(source.minusDI),
    plusDI: toNumberOrNull(source.plusDI),
    adx: toNumberOrNull(source.adx),
    chop: toNumberOrNull(source.chop),
  };
}

function hasIndicatorValues(indicators = {}) {
  return Object.values(normalizeIndicators(indicators)).some((value) => value !== null);
}

function pickLastClosePrice(leg = {}) {
  const prevClose = Number(leg.previousClose);
  if (Number.isFinite(prevClose) && prevClose > 0) return prevClose;

  const close = Number(leg.closePrice);
  if (Number.isFinite(close) && close > 0) return close;

  const settled = Number(leg.settlePrice);
  if (Number.isFinite(settled) && settled > 0) return settled;

  return 0;
}

function pickLTP(leg = {}) {
  const lastPrice = Number(leg.lastPrice);
  if (Number.isFinite(lastPrice) && lastPrice > 0) {
    return lastPrice;
  }
  const lastClose = pickLastClosePrice(leg);
  if (Number.isFinite(lastClose) && lastClose > 0) {
    return lastClose;
  }
  return Number.isFinite(lastPrice) ? lastPrice : 0;
}

function mapByStrike(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(row?.strike ?? '');
    if (key) map.set(key, row);
  });
  return map;
}

function mergeRowsWithFallback(currentRows = [], fallbackRows = []) {
  if (!currentRows.length) return fallbackRows;
  if (!fallbackRows.length) return currentRows;

  const fallbackMap = mapByStrike(fallbackRows);

  return currentRows.map((row) => {
    const prev = fallbackMap.get(String(row?.strike ?? ''));
    if (!prev) return row;

    return {
      ...row,
      open: hasValidPrice(row.open) ? row.open : prev.open,
      ltp: hasValidPrice(row.ltp) ? row.ltp : prev.ltp,
      ce: hasValidPrice(row.ce) ? row.ce : prev.ce,
      pe: hasValidPrice(row.pe) ? row.pe : prev.pe,
      change: hasValidNumber(row.change) ? row.change : prev.change,
      cIV: hasValidNumber(row.cIV) ? row.cIV : prev.cIV,
      cDelta: hasValidNumber(row.cDelta) ? row.cDelta : prev.cDelta,
      cVolume: row.cVolume || prev.cVolume,
      lead: row.lead || prev.lead,
      regime: row.regime || prev.regime,
      indReg: row.indReg || prev.indReg,
      tMode: row.tMode || prev.tMode,
      tType: row.tType || prev.tType,
      combinedIV: hasValidNumber(row.combinedIV) ? row.combinedIV : prev.combinedIV,
      combinedDelta: hasValidNumber(row.combinedDelta) ? row.combinedDelta : prev.combinedDelta,
      combinedVolume: hasValidNumber(row.combinedVolume) ? row.combinedVolume : prev.combinedVolume,
    };
  });
}

async function readLastCloseSnapshot() {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.strikes?.length) return parsed;
  } catch (_) {
    // Ignore cache read errors
  }
  return null;
}

async function writeLastCloseSnapshot(data) {
  try {
    await fs.mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
    await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing close snapshot cache:', err.message);
  }
}

exports.niftyPrice = async (req, res) => {
  try {
    const nifty = await fetchNiftyData();

    if (nifty) {
      return res.json({
        status: 'success',
        connected: isConnected(),
        data: {
          symbol: 'NIFTY 50',
          price: nifty.lastPrice || nifty.last,
          prevClose: nifty.previousClose,
          change: parseFloat(nifty.change?.toFixed(2) ?? 0),
          changePercent: parseFloat(nifty.pChange?.toFixed(1) ?? 0),
          timestamp: new Date().toISOString(),
          source: 'nse',
        },
      });
    }

    return res.json({ status: 'error', connected: isConnected(), message: 'No NIFTY data' });
  } catch (err) {
    console.error('Error fetching NIFTY price:', err.message);
    return res.status(500).json({ status: 'error', connected: isConnected(), message: err.message });
  }
};

exports.translateStraddleSeries = async (req, res) => {
  try {
    const translated = translateStrikePayload(req.body, { length: 14 });

    return res.json({
      status: 'success',
      connected: isConnected(),
      data: translated,
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      connected: isConnected(),
      message: err.message,
    });
  }
};

exports.translateStraddleSeriesSelfTest = async (req, res) => {
  try {
    const candles = Array.from({ length: 40 }, (_, index) => ({
      datetime: `2026-01-01T09:${String(index).padStart(2, '0')}:00+05:30`,
      ce: {
        open: 100 + index,
        high: 0,
        low: 0,
        close: 101 + index,
        volume: 1000 + index,
        delta: 0.35 + (index * 0.002),
        iv: 16 + (index * 0.05),
      },
      pe: {
        open: 90 - (index * 0.4),
        high: 0,
        low: 0,
        close: 89.5 - (index * 0.35),
        volume: 900 + index,
        delta: -0.28 + (index * 0.001),
        iv: 15 + (index * 0.04),
      },
    }));

    const translated = translateStrikePayload([{
      strike: 23000,
      candles,
    }], { length: 14 });

    const sample = translated[0];
    const indicators = sample?.indicators || {};
    const passed = [
      indicators.rsi,
      indicators.roc,
      indicators.adx,
      indicators.di_plus,
      indicators.di_minus,
      indicators.chop,
    ].every((value) => Number.isFinite(value));

    return res.json({
      status: 'success',
      connected: isConnected(),
      data: {
        passed,
        sample,
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      connected: isConnected(),
      message: err.message,
    });
  }
};

// GET /api/v1/market/strikes - Full strike data with indicators
exports.niftyStrikes = async (req, res) => {
  try {
    const cached = await readLastCloseSnapshot();

    // Try HDFC Sky first when connected, fallback to NSE
    let chain = null;
    let intraday = null;
    let dataSource = 'nse';

    if (isConnected() && getAccessToken()) {
      try {
        // Fetch spot price from NSE first (fast, always available)
        let spotPrice = cached?.spotPrice || null;
        try {
          const nifty = await fetchNiftyData();
          if (nifty?.lastPrice) spotPrice = nifty.lastPrice;
        } catch (_) { /* use cached spot */ }

        const [hdfcChain, nseIntraday] = await Promise.all([
          fetchNiftyOptionChain(spotPrice, 4),
          fetchNiftyIntraday(),
        ]);
        if (hdfcChain?.data?.length) {
          chain = hdfcChain;
          dataSource = 'hdfc_sky';
        }
        intraday = nseIntraday;
      } catch (hdfcErr) {
        console.warn('HDFC Sky fetch failed, falling back to NSE:', hdfcErr.message);
      }
    }

    // Fallback to NSE if HDFC Sky didn't return data
    if (!chain) {
      const [nseChain, nseIntraday] = await Promise.all([
        fetchNiftyChain(),
        intraday ? Promise.resolve(intraday) : fetchNiftyIntraday(),
      ]);
      chain = nseChain;
      if (!intraday) intraday = nseIntraday;
      dataSource = 'nse';
    }

    // If NSE intraday failed, try HDFC Sky intraday (NIFTY futures candles)
    if (!intraday && isConnected() && getAccessToken()) {
      try {
        intraday = await fetchHdfcIntraday();
      } catch (_) { /* ignore */ }
    }

    // Fallback indicators from spot intraday (overridden by combined premium later if available)
    const spotIndicators = normalizeIndicators(intraday ? calculateAll(intraday) : null);

    if (!chain || !chain.data || chain.data.length === 0) {
      if (cached) {
        return res.json({
          status: 'success',
          connected: isConnected(),
          data: {
            ...cached,
            indicators: normalizeIndicators(cached.indicators),
            marketOpen: false,
            fallbackSource: 'last_snapshot',
          },
        });
      }

      return res.json({
        status: 'success',
        connected: isConnected(),
          data: { spotPrice: null, strikes: [], indicators: spotIndicators, marketOpen: false },
      });
    }

    const spot = chain.underlyingValue || cached?.spotPrice || null;
    const strikePrices = chain.strikePrices || [];
    const nearestExpiry = chain.expiryDates?.[0];

    if (!strikePrices.length) {
      if (cached) {
        return res.json({
          status: 'success',
          connected: isConnected(),
          data: {
            ...cached,
            indicators: normalizeIndicators(cached.indicators),
            marketOpen: false,
            fallbackSource: 'last_snapshot',
          },
        });
      }

      return res.json({
        status: 'success',
        connected: isConnected(),
        data: { spotPrice: spot, strikes: [], indicators: spotIndicators, marketOpen: false },
      });
    }

    let atmStrike = strikePrices[0];
    let minDiff = Infinity;
    for (const s of strikePrices) {
      const diff = Math.abs(s - (spot || s));
      if (diff < minDiff) {
        minDiff = diff;
        atmStrike = s;
      }
    }

    // Build combined premium OHLC candle series from ATM CE+PE candles for indicators
    const candleArrays = chain.candleArrays; // Map<symbol, { open, volume, candles[] }>
    let combinedPremiumCandles = null;
    if (candleArrays) {
      const atmData = (chain.data || []).find((d) => d.strikePrice === atmStrike);
      const ceSymbol = atmData?.CE?.tradingsymbol;
      const peSymbol = atmData?.PE?.tradingsymbol;
      const ceCandles = ceSymbol && candleArrays.get(ceSymbol)?.candles;
      const peCandles = peSymbol && candleArrays.get(peSymbol)?.candles;

      if (ceCandles?.length && peCandles?.length) {
        // Native 5-min candles from HDFC Sky (MINUTE5). CE and PE move in opposite
        // directions so adding individual highs/lows OVERSTATES the combined range.
        // Use max/min of the synchronized open and close prices instead — these are
        // combined prices at known simultaneous moments (bar open and bar close).
        const peByDate = new Map(peCandles.map((c) => [c.date, c]));
        combinedPremiumCandles = ceCandles
          .map((ce) => {
            const pe = peByDate.get(ce.date);
            if (!pe) return null;
            const combinedOpen  = ce.open  + pe.open;
            const combinedClose = ce.close + pe.close;
            return {
              open:  combinedOpen,
              high:  Math.max(combinedOpen, combinedClose),
              low:   Math.min(combinedOpen, combinedClose),
              close: combinedClose,
            };
          })
          .filter(Boolean);
      }
    }

    const premiumIndicators = normalizeIndicators(
      combinedPremiumCandles?.length ? calculateAllFromCandles(combinedPremiumCandles) : null
    );
    const indicators = hasIndicatorValues(premiumIndicators) ? premiumIndicators : spotIndicators;

    const atmIdx = strikePrices.indexOf(atmStrike);
    const rangeStart = Math.max(0, atmIdx - 4);
    const rangeEnd = Math.min(strikePrices.length - 1, atmIdx + 4);
    const selectedStrikes = strikePrices.slice(rangeStart, rangeEnd + 1);

    const chainData = chain.data || [];
    const filteredData = chainData.filter(
      (d) => selectedStrikes.includes(d.strikePrice) && d.expiryDate === nearestExpiry
    );

    if (!filteredData.length && cached?.strikes?.length) {
      return res.json({
        status: 'success',
        connected: isConnected(),
        data: {
          ...cached,
          indicators: normalizeIndicators(cached.indicators),
          marketOpen: false,
          fallbackSource: 'last_snapshot',
        },
      });
    }

    const expiryDate = new Date(nearestExpiry || Date.now());
    const now = new Date();
    const daysToExpiry = Math.max(1, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));

    const marketOpenByClock = isMarketHoursIST();

    const rawRows = filteredData.map((d) => {
      const ce = d.CE || {};
      const pe = d.PE || {};
      const strike = d.strikePrice;

      // Real individual CE / PE last-traded prices
      const ceLTP = pickLTP(ce);
      const peLTP = pickLTP(pe);

      // straddle_close = ce_close + pe_close  (LTP column)
      // straddle_open  = ce_open  + pe_open   (OPEN column)
      // CHANGE = straddle_close - straddle_open
      const ceOpen = Number(ce.openPrice || 0);
      const peOpen = Number(pe.openPrice || 0);
      const straddleOpen = ceOpen + peOpen;
      const straddleClose = ceLTP + peLTP;
      const change = Number((straddleClose - straddleOpen).toFixed(2));

      const ceChange = Number(ce.change || 0);
      const peChange = Number(pe.change || 0);
      const ceIV = Number(ce.impliedVolatility || 0);
      const peIV = Number(pe.impliedVolatility || 0);
      const ceVol = Number(ce.totalTradedVolume || 0);
      const peVol = Number(pe.totalTradedVolume || 0);

      // --- Raw combined values (stored for next snapshot) ---
      // combined_iv = average of CE and PE IV (compute from prices if broker doesn't provide)
      let ceIVCalc = ceIV;
      let peIVCalc = peIV;
      if (!ceIVCalc && ceLTP > 0 && spot) {
        ceIVCalc = calcImpliedVolatility(spot, strike, ceLTP, daysToExpiry, 'CE');
      }
      if (!peIVCalc && peLTP > 0 && spot) {
        peIVCalc = calcImpliedVolatility(spot, strike, peLTP, daysToExpiry, 'PE');
      }
      const combinedIV = ceIVCalc || peIVCalc
        ? Number((((ceIVCalc || 0) + (peIVCalc || 0)) / (ceIVCalc && peIVCalc ? 2 : 1)).toFixed(1))
        : 0;

      // combined_delta = ce_delta - pe_delta
      const chainCeDelta = Number(ce.delta ?? ce.callDelta ?? NaN);
      const chainPeDelta = Number(pe.delta ?? pe.putDelta ?? NaN);
      let combinedDelta;
      if (Number.isFinite(chainCeDelta) && Number.isFinite(chainPeDelta)) {
        combinedDelta = Number((chainCeDelta - Math.abs(chainPeDelta)).toFixed(4));
      } else if (combinedIV > 0) {
        // BS: ce_delta from IV, pe_delta = ce_delta - 1
        const callDelta = calcDelta(spot || strike, strike, combinedIV, daysToExpiry);
        const putDelta = callDelta - 1;
        combinedDelta = Number((callDelta - Math.abs(putDelta)).toFixed(4));
      } else {
        combinedDelta = 0;
      }
      // combined_volume = ce_volume + pe_volume
      const combinedVolume = ceVol + peVol;

      // --- C. columns = Combined values ---
      // C.IV = combined IV (average of CE IV and PE IV)
      const cIV = combinedIV;

      // C.Delta = combined_delta = ce_delta - pe_delta
      const cDelta = Number(combinedDelta.toFixed(2));

      // C.Volume = combined_volume = ce_volume + pe_volume
      const cVolume = combinedVolume >= 1_000_000
        ? `${(combinedVolume / 1_000_000).toFixed(1)}M`
        : combinedVolume >= 1_000
          ? `${(combinedVolume / 1_000).toFixed(0)}K`
          : String(combinedVolume);

      // Leg dominance: CE Gain = CE LTP - CE Open, PE Gain = PE LTP - PE Open
      const ceGain = ceLTP - ceOpen;
      const peGain = peLTP - peOpen;

      // Lead: [Dominance text] + [Dominance symbol] + [Direction symbol]
      const leadLeg = ceGain >= peGain ? 'CE' : 'PE';
      const dominanceSymbol = ceGain >= peGain ? '▲' : '▼';
      const directionSymbol = straddleClose > straddleOpen ? '↑' : '↓';
      const lead = `${leadLeg} ${dominanceSymbol} ${directionSymbol}`;

      const regime = calcRegime(straddleClose, straddleOpen, ceGain, peGain);
      const indReg = indicators
        ? calcIndReg(indicators.rsi, indicators.plusDI, indicators.minusDI, indicators.adx)
        : 'NoTrend';
      const tMode = indicators
        ? calcMode(indicators.rsi, indicators.plusDI, indicators.minusDI, indicators.adx)
        : 'WAIT...';
      const tType = calcTradeType(
        tMode,
        indicators?.chop ?? null,
        straddleClose,
        straddleOpen,
        ceGain,
        peGain
      );

      return {
        strike,
        cIV,
        open: Number(straddleOpen.toFixed(2)),
        ltp: Number(straddleClose.toFixed(2)),
        ce: Number(ceLTP.toFixed(2)),
        pe: Number(peLTP.toFixed(2)),
        change,
        lead,
        cDelta,
        cVolume,
        regime,
        indReg,
        tMode,
        tType,
        isATM: strike === atmStrike,
        // Raw combined values (persisted for next C.* calculation)
        combinedIV,
        combinedDelta,
        combinedVolume,
      };
    });

    const strikes = mergeRowsWithFallback(rawRows, cached?.strikes || []);
    const resolvedIndicators = hasIndicatorValues(indicators)
      ? indicators
      : normalizeIndicators(cached?.indicators);

    if (strikes.length > 0) {
      await writeLastCloseSnapshot({
        spotPrice: spot,
        atmStrike,
        expiry: nearestExpiry,
        daysToExpiry,
        strikes,
        indicators: resolvedIndicators,
        cachedAt: new Date().toISOString(),
      });
    }

    return res.json({
      status: 'success',
      connected: isConnected(),
      data: {
        spotPrice: spot,
        atmStrike,
        expiry: nearestExpiry,
        daysToExpiry,
        strikes,
        indicators: resolvedIndicators,
        marketOpen: marketOpenByClock,
        fallbackSource: dataSource,
      },
    });
  } catch (err) {
    console.error('Error fetching strike data:', err.message);

    const cached = await readLastCloseSnapshot();
    if (cached) {
      return res.json({
        status: 'success',
        connected: isConnected(),
        data: {
          ...cached,
          indicators: normalizeIndicators(cached.indicators),
          marketOpen: false,
          fallbackSource: 'last_snapshot',
        },
      });
    }

    return res.status(500).json({ status: 'error', connected: isConnected(), message: err.message });
  }
};
