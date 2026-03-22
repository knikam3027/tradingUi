const { USER_AGENT } = require('../config');

let nseCookies = '';
let cookieTimestamp = 0;
const COOKIE_TTL = 60_000; // refresh cookies every 60s

async function getNSECookies() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    const setCookies = response.headers.getSetCookie?.() || [];
    nseCookies = setCookies.map(c => c.split(';')[0]).join('; ');
    cookieTimestamp = Date.now();
    return nseCookies;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNiftyData() {
  // Refresh cookies if stale or missing
  if (!nseCookies || Date.now() - cookieTimestamp > COOKIE_TTL) {
    await getNSECookies();
  }

  const fetchIndex = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050', {
        headers: {
          'User-Agent': USER_AGENT,
          'Cookie': nseCookies,
          'Accept': 'application/json',
          'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await fetchIndex();

  // If cookies expired, refresh and retry once
  if (response.status === 401 || response.status === 403) {
    await getNSECookies();
    response = await fetchIndex();
  }

  const data = await response.json();
  return data?.data?.[0] || null;
}

// Helper for NSE fetch with retry
async function nseFetch(url, referer) {
  if (!nseCookies || Date.now() - cookieTimestamp > COOKIE_TTL) {
    await getNSECookies();
  }

  const doFetch = async () => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Cookie': nseCookies,
          'Accept': 'application/json',
          'Referer': referer,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }
  };

  let response = await doFetch();
  if (response.status === 401 || response.status === 403) {
    await getNSECookies();
    response = await doFetch();
  }
  return response;
}

// Fetch NIFTY option chain
async function fetchNiftyChain() {
  const response = await nseFetch(
    'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY',
    'https://www.nseindia.com/option-chain'
  );
  const data = await response.json();
  return data?.records || null;
}

// Fetch NIFTY intraday chart data (array of [timestamp, price])
async function fetchNiftyIntraday() {
  const response = await nseFetch(
    'https://www.nseindia.com/api/chart-databyindex?index=NIFTY%2050',
    'https://www.nseindia.com/market-data/live-equity-market'
  );
  const data = await response.json();
  const rawSeries = data?.grapthData || data?.grappiData || data?.graphData || null;
  if (!Array.isArray(rawSeries)) {
    return null;
  }

  const normalizedSeries = rawSeries
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const ts = Number(point[0]);
        const price = Number(point[1]);
        return Number.isFinite(ts) && Number.isFinite(price) ? [ts, price] : null;
      }

      if (point && typeof point === 'object') {
        const ts = Number(point.x ?? point.time ?? point.timestamp);
        const price = Number(point.y ?? point.price ?? point.close ?? point.value);
        return Number.isFinite(ts) && Number.isFinite(price) ? [ts, price] : null;
      }

      return null;
    })
    .filter(Boolean);

  return normalizedSeries.length ? normalizedSeries : null;
}

module.exports = { fetchNiftyData, fetchNiftyChain, fetchNiftyIntraday };
