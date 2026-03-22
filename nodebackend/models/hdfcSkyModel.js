const { HDFC_BASE_URL, HDFC_API_KEY, USER_AGENT } = require('../config');
const { getAccessToken, setAccessToken } = require('./authModel');

function handleHdfcAuthError(status, context) {
  if (status === 401 || status === 403) {
    console.warn(`HDFC Sky: ${context} returned ${status} - token expired, disconnecting`);
    setAccessToken(null);
    throw new Error(`HDFC Sky token expired (${status}) - please re-login at /auth/login`);
  }
}
const fs = require('fs/promises');
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const SECURITY_MASTER_URL = 'https://hdfcsky.com/api/v1/contract/Compact?info=download';
const CACHE_DIR = path.join(__dirname, '..', 'data');
const MASTER_CACHE = path.join(CACHE_DIR, 'security-master.json');
const MASTER_TTL = 6 * 60 * 60 * 1000; // 6 hours

let masterCache = null; // { ts, instruments: [] }

// ── helpers ──────────────────────────────────────────────────────────────────

function hdfcHeaders() {
  return {
    Authorization: getAccessToken(),
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
  };
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Security Master ─────────────────────────────────────────────────────────

/**
 * Download the HDFC Sky security master (ZIP containing CSV) and parse it.
 * CSV columns: exchange_token,trading_symbol,company_name,close_price,expiry,
 *              strike,tick_size,lot_size,instrument_name,option_type,segment,exchange,...
 */
async function downloadSecurityMaster() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(SECURITY_MASTER_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Security master download failed: ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());

    // Save ZIP, extract with OS tools, read CSV
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    const zipPath = path.join(CACHE_DIR, 'security-master.zip');
    const extractDir = path.join(CACHE_DIR, 'sm-extract');
    writeFileSync(zipPath, buf);

    // Extract using PowerShell (Windows) or unzip (Linux/Mac)
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
        { timeout: 15000 }
      );
    } else {
      execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { timeout: 15000 });
    }

    // Find the CSV file inside
    const { readdirSync } = require('fs');
    const files = readdirSync(extractDir);
    const csvFile = files.find((f) => f.endsWith('.csv')) || files[0];
    const csv = readFileSync(path.join(extractDir, csvFile), 'utf8');

    return parseSecurityMasterCSV(csv);
  } finally {
    clearTimeout(timeout);
  }
}

function parseSecurityMasterCSV(csv) {
  const lines = csv.split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  // Known columns: exchange_token,trading_symbol,company_name,close_price,expiry,
  //                strike,tick_size,lot_size,instrument_name,option_type,segment,exchange,...
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const colIdx = {};
  headers.forEach((h, i) => { colIdx[h] = i; });

  const instruments = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    instruments.push({
      exchange: cols[colIdx.exchange] || '',
      token: cols[colIdx.exchange_token] || '',
      tradingsymbol: cols[colIdx.trading_symbol] || '',
      name: cols[colIdx.company_name] || '',
      closePrice: parseFloat(cols[colIdx.close_price] || '0'),
      expiry: cols[colIdx.expiry] || '',
      strike: parseFloat(cols[colIdx.strike] || '0'),
      lotSize: parseInt(cols[colIdx.lot_size] || '0', 10),
      instrumentType: cols[colIdx.instrument_name] || '',
      optionType: cols[colIdx.option_type] || '',
    });
  }

  return instruments;
}

async function getSecurityMaster() {
  // Memory cache
  if (masterCache && Date.now() - masterCache.ts < MASTER_TTL) {
    return masterCache.instruments;
  }

  // Disk cache
  try {
    const raw = await fs.readFile(MASTER_CACHE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.ts && Date.now() - parsed.ts < MASTER_TTL && parsed.instruments?.length) {
      masterCache = parsed;
      return parsed.instruments;
    }
  } catch (_) { /* no cache */ }

  // Fresh download
  const instruments = await downloadSecurityMaster();
  masterCache = { ts: Date.now(), instruments };

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(MASTER_CACHE, JSON.stringify(masterCache), 'utf8');
  } catch (_) { /* ignore write errors */ }

  return instruments;
}

/**
 * Parse expiry date "07-Apr-2026" (DD-MMM-YYYY) to sortable ISO string.
 */
function parseExpiry(expiryStr) {
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
                   Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const parts = expiryStr.split('-');
  if (parts.length !== 3) return '';
  const [dd, mmm, yyyy] = parts;
  return `${yyyy}-${months[mmm] || '00'}-${dd.padStart(2, '0')}`;
}

/**
 * Get NFO token map for NIFTY options at given strikes for nearest expiry.
 * Returns Map<strike, { ceToken, peToken, ceSymbol, peSymbol, expiry, ceClose, peClose }>
 */
async function getNiftyOptionTokens(targetStrikes = []) {
  const instruments = await getSecurityMaster();

  // Filter NIFTY options on NFO exchange
  const niftyOpts = instruments.filter(
    (i) => i.exchange === 'NFO' &&
           i.name === 'NIFTY' &&
           i.instrumentType === 'OPTIDX' &&
           (i.optionType === 'CE' || i.optionType === 'PE')
  );

  if (!niftyOpts.length) return new Map();

  // Find nearest expiry (parse DD-MMM-YYYY to sortable format)
  const today = todayDateStr();
  const expiriesISO = [...new Set(niftyOpts.map((i) => parseExpiry(i.expiry)))].filter(Boolean).sort();
  const futureExpiries = expiriesISO.filter((e) => e >= today);
  const nearestExpiryISO = futureExpiries[0] || expiriesISO[expiriesISO.length - 1];

  // Filter to nearest expiry
  const expiryOpts = niftyOpts.filter((i) => parseExpiry(i.expiry) === nearestExpiryISO);

  // Build token map
  const tokenMap = new Map();
  const strikeSet = targetStrikes.length
    ? new Set(targetStrikes.map(Number))
    : null;

  for (const opt of expiryOpts) {
    if (strikeSet && !strikeSet.has(opt.strike)) continue;

    const key = opt.strike;
    const entry = tokenMap.get(key) || {
      ceToken: null, peToken: null, ceSymbol: '', peSymbol: '',
      expiry: opt.expiry, ceClose: 0, peClose: 0,
    };

    if (opt.optionType === 'CE') {
      entry.ceToken = opt.token;
      entry.ceSymbol = opt.tradingsymbol;
      entry.ceClose = opt.closePrice;
    } else if (opt.optionType === 'PE') {
      entry.peToken = opt.token;
      entry.peSymbol = opt.tradingsymbol;
      entry.peClose = opt.closePrice;
    }

    tokenMap.set(key, entry);
  }

  return tokenMap;
}

// ── Fetch LTP ───────────────────────────────────────────────────────────────

/**
 * Fetch LTP for multiple exchange:token pairs (batches to respect 10-item limit).
 * @param {Array<{exchange:string, token:string}>} tokens
 * @returns {Map<string, {ltp:number, prevClose:number}>} keyed by token
 */
async function fetchLTP(tokens) {
  if (!tokens.length) return new Map();

  const BATCH_SIZE = 10;
  const result = new Map();

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const url = `${HDFC_BASE_URL}/fetch-ltp?api_key=${encodeURIComponent(HDFC_API_KEY)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: hdfcHeaders(),
        body: JSON.stringify({ data: batch }),
        signal: controller.signal,
      });

      if (!res.ok) {
        handleHdfcAuthError(res.status, 'fetch-ltp');
        const text = await res.text();
        throw new Error(`fetch-ltp ${res.status}: ${text}`);
      }

      const json = await res.json();
      for (const item of json.data || []) {
        result.set(String(item.token), {
          ltp: item.ltp ?? 0,
          prevClose: item.prev_close ?? 0,
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return result;
}

// ── Fetch Candle Data ───────────────────────────────────────────────────────

/**
 * Fetch intraday candle data for a single instrument.
 * @returns {Array<{open,high,low,close,volume,date}>}
 */
async function fetchCandle(symbol, exchange, seriesType = 'EQ', chartType = 'MINUTE', start, end) {
  // If caller supplied explicit dates, use them directly (no retry)
  if (start && end) {
    return _fetchCandleOnce(symbol, exchange, seriesType, chartType, start, end);
  }

  // Otherwise try recent weekdays, go back up to 5 calendar days (covers weekends + 1 holiday)
  for (let back = 0; back <= 5; back++) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    const day = d.getDay();
    if (day === 0 || day === 6) continue; // skip weekends
    const dateStr = d.toISOString().slice(0, 10);
    const results = await _fetchCandleOnce(symbol, exchange, seriesType, chartType, dateStr, dateStr);
    if (results?.length) return results;
  }
  return [];
}

async function _fetchCandleOnce(symbol, exchange, seriesType, chartType, start, end) {
  const params = new URLSearchParams({
    api_key: HDFC_API_KEY,
    symbol,
    exchange,
    chartType,
    seriesType,
    start,
    end,
  });

  const url = `${HDFC_BASE_URL.replace('/oapi/v1', '')}/oapi/charts-api/charts/v1/fetch-candle?${params}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      headers: { Authorization: getAccessToken(), 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) {
      handleHdfcAuthError(res.status, 'fetch-candle');
      const text = await res.text();
      throw new Error(`fetch-candle ${res.status}: ${text}`);
    }

    const json = await res.json();
    const results = json?.data?.results || [];
    return results.map(([open, high, low, close, volume, , date]) => ({
      open, high, low, close, volume, date,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// ── Composite: Fetch NIFTY Option Chain via HDFC Sky ────────────────────────

/**
 * Build NIFTY option chain data equivalent to NSE chain using HDFC Sky APIs.
 * @param {number} spotPrice - current NIFTY spot price (for ATM calculation)
 * @param {number} rangeStrikes - number of strikes above/below ATM
 * @returns {{ spotPrice, expiryDates, strikePrices, data: [{strikePrice, CE:{}, PE:{}}] }}
 */
async function fetchNiftyOptionChain(spotPrice, rangeStrikes = 4) {
  // Step 1: Get all NIFTY option tokens
  const allTokens = await getNiftyOptionTokens();
  if (!allTokens.size) throw new Error('No NIFTY option tokens found in security master');

  const allStrikes = [...allTokens.keys()].filter((s) => s > 0).sort((a, b) => a - b);
  if (!allStrikes.length) throw new Error('No valid strikes found');

  // Step 2: Find ATM and select range
  let atmStrike;
  if (spotPrice && Number.isFinite(spotPrice)) {
    let minDiff = Infinity;
    for (const s of allStrikes) {
      const diff = Math.abs(s - spotPrice);
      if (diff < minDiff) { minDiff = diff; atmStrike = s; }
    }
  } else {
    // No spot — use middle of available strikes
    atmStrike = allStrikes[Math.floor(allStrikes.length / 2)];
  }

  const atmIdx = allStrikes.indexOf(atmStrike);
  const start = Math.max(0, atmIdx - rangeStrikes);
  const end = Math.min(allStrikes.length - 1, atmIdx + rangeStrikes);
  const selectedStrikes = allStrikes.slice(start, end + 1);

  // Step 3: Build token list for LTP fetch
  const ltpTokens = [];
  const tokenToStrike = new Map(); // token -> { strike, type: 'CE'|'PE' }

  for (const strike of selectedStrikes) {
    const info = allTokens.get(strike);
    if (!info) continue;
    if (info.ceToken) {
      ltpTokens.push({ exchange: 'NFO', token: String(info.ceToken) });
      tokenToStrike.set(String(info.ceToken), { strike, type: 'CE' });
    }
    if (info.peToken) {
      ltpTokens.push({ exchange: 'NFO', token: String(info.peToken) });
      tokenToStrike.set(String(info.peToken), { strike, type: 'PE' });
    }
  }

  // Step 4: Fetch LTP for all tokens
  const ltpMap = await fetchLTP(ltpTokens);

  // Step 4b: Fetch candle data for volume and open price (sequential to avoid rate limits)
  const candleDataMap = new Map(); // symbol -> { open, volume }
  const candleSymbols = [];
  for (const strike of selectedStrikes) {
    const info = allTokens.get(strike);
    if (!info) continue;
    if (info.ceSymbol) candleSymbols.push({ symbol: info.ceSymbol, key: info.ceSymbol });
    if (info.peSymbol) candleSymbols.push({ symbol: info.peSymbol, key: info.peSymbol });
  }

  // Process in batches of 2 with small delay between batches
  const CANDLE_BATCH = 2;
  for (let i = 0; i < candleSymbols.length; i += CANDLE_BATCH) {
    const batch = candleSymbols.slice(i, i + CANDLE_BATCH);
    const results = await Promise.all(
      batch.map(({ symbol, key }) =>
        // Use native 5-min candles: 75 bars instead of 375, exchange-computed OHLC
        fetchCandle(symbol, 'NFO', 'XX', 'MINUTE5')
          .then((candles) => {
            if (candles?.length) {
              const totalVol = candles.reduce((s, c) => s + (c.volume || 0), 0);
              candleDataMap.set(key, { open: candles[0].open || 0, volume: totalVol, candles });
            }
          })
          .catch(() => {})
      )
    );
    // Small delay between batches to respect rate limits
    if (i + CANDLE_BATCH < candleSymbols.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Step 5: Build chain data in NSE-compatible format
  const data = selectedStrikes.map((strike) => {
    const info = allTokens.get(strike) || {};
    const ceLTP = ltpMap.get(String(info.ceToken));
    const peLTP = ltpMap.get(String(info.peToken));
    const ceCandle = candleDataMap.get(info.ceSymbol) || {};
    const peCandle = candleDataMap.get(info.peSymbol) || {};

    // Use security master close_price as prevClose fallback
    const cePrevClose = ceLTP?.prevClose || info.ceClose || 0;
    const pePrevClose = peLTP?.prevClose || info.peClose || 0;

    // Use candle open as real open, fallback to prevClose
    const ceOpen = ceCandle.open || cePrevClose;
    const peOpen = peCandle.open || pePrevClose;

    return {
      strikePrice: strike,
      expiryDate: info.expiry || '',
      CE: {
        strikePrice: strike,
        lastPrice: ceLTP?.ltp ?? 0,
        previousClose: cePrevClose,
        openPrice: ceOpen,
        change: ceLTP ? (ceLTP.ltp - cePrevClose) : 0,
        impliedVolatility: 0,
        totalTradedVolume: ceCandle.volume || 0,
        token: info.ceToken,
        tradingsymbol: info.ceSymbol,
      },
      PE: {
        strikePrice: strike,
        lastPrice: peLTP?.ltp ?? 0,
        previousClose: pePrevClose,
        openPrice: peOpen,
        change: peLTP ? (peLTP.ltp - pePrevClose) : 0,
        impliedVolatility: 0,
        totalTradedVolume: peCandle.volume || 0,
        token: info.peToken,
        tradingsymbol: info.peSymbol,
      },
    };
  });

  const expiry = data[0]?.expiryDate || '';

  return {
    spotPrice: spotPrice || null,
    underlyingValue: spotPrice || null,
    expiryDates: expiry ? [expiry] : [],
    strikePrices: selectedStrikes,
    data,
    candleArrays: candleDataMap, // Map<symbol, { open, volume, candles[] }>
  };
}

// ── Fetch NIFTY Intraday via HDFC Sky (fallback for NSE) ────────────────────

/**
 * Fetch NIFTY intraday price data using the nearest NIFTY futures contract.
 * Returns [[timestamp, price], ...] compatible with calculateAll().
 */
async function fetchNiftyIntraday() {
  const instruments = await getSecurityMaster();
  // Find nearest-month NIFTY futures
  const now = new Date();
  const niftyFuts = instruments
    .filter((i) => i.exchange === 'NFO' && i.tradingsymbol?.startsWith('NIFTY') && i.instrumentType === 'FUTIDX')
    .map((i) => ({ ...i, expiryDate: new Date(parseExpiry(i.expiry)) }))
    .filter((i) => i.expiryDate >= now)
    .sort((a, b) => a.expiryDate - b.expiryDate);

  if (!niftyFuts.length) return null;

  const futSymbol = niftyFuts[0].tradingsymbol;
  const candles = await fetchCandle(futSymbol, 'NFO', 'XX', 'MINUTE');
  if (!candles?.length) return null;

  // Convert to [timestamp, price] format for calculateAll()
  return candles.map((c) => {
    const ts = new Date(c.date?.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$2-$1')).getTime() || Date.now();
    return [ts, c.close];
  }).filter(([ts]) => Number.isFinite(ts));
}

module.exports = {
  getSecurityMaster,
  getNiftyOptionTokens,
  fetchLTP,
  fetchCandle,
  fetchNiftyOptionChain,
  fetchNiftyIntraday,
};
