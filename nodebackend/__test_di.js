Object.keys(require.cache).forEach(k => delete require.cache[k]);
const { getNiftyOptionTokens, fetchCandle } = require('./models/hdfcSkyModel');
const { toFiveMinCandles } = require('./models/indicatorModel');

function rma(vals, len) {
  const res = new Array(vals.length).fill(null);
  let sum = 0, cnt = 0, seed = false, prev = null;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v === null || v === undefined || Number.isNaN(v)) { res[i] = null; continue; }
    if (!seed) {
      sum += v; cnt++;
      if (cnt === len) { prev = sum / len; res[i] = prev; seed = true; }
      continue;
    }
    prev = ((prev * (len - 1)) + v) / len;
    res[i] = prev;
  }
  return res;
}

function last(a) {
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i] !== null && Number.isFinite(a[i])) return a[i];
  }
  return null;
}

function calcAll(candles, len) {
  const closes = candles.map(c => c.close);
  const changes = closes.map((c, i) => i === 0 ? null : c - closes[i - 1]);
  const agArr = rma(changes.map(x => x === null ? null : Math.max(x, 0)), len);
  const alArr = rma(changes.map(x => x === null ? null : Math.max(-x, 0)), len);
  const rsiArr = closes.map((_, i) => {
    const g = agArr[i], l = alArr[i];
    if (g === null || l === null) return null;
    if (l === 0) return 100;
    if (g === 0) return 0;
    return 100 - 100 / (1 + g / l);
  });
  const roc = closes.length > len
    ? ((closes[closes.length - 1] - closes[closes.length - 1 - len]) / closes[closes.length - 1 - len]) * 100
    : null;

  const trRaw = [], pmRaw = [], mmRaw = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const up = i === 0 ? null : c.high - p.high;
    const down = i === 0 ? null : -(c.low - p.low);
    const pc = i === 0 ? 0 : p.close;
    trRaw.push(Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc)));
    pmRaw.push(up === null ? null : (up > down && up > 0 ? up : 0));
    mmRaw.push(down === null ? null : (down > up && down > 0 ? down : 0));
  }
  const trR = rma(trRaw, len), pmR = rma(pmRaw, len), mmR = rma(mmRaw, len);
  const dip = [], dim = [], dx = [];
  for (let i = 0; i < candles.length; i++) {
    const t = trR[i], p2 = pmR[i], m = mmR[i];
    if (t === null || p2 === null || m === null || t === 0) { dip.push(null); dim.push(null); dx.push(null); continue; }
    const pv = 100 * p2 / t, mv = 100 * m / t, de = pv + mv;
    dip.push(pv); dim.push(mv);
    dx.push(de === 0 ? 0 : 100 * Math.abs(pv - mv) / de);
  }
  const adxA = rma(dx, len);

  const chopArr = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (i < len - 1) continue;
    let ts = 0, hi = -Infinity, lo = Infinity;
    for (let j = i - len + 1; j <= i; j++) {
      ts += trRaw[j];
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    const rng = hi - lo;
    if (rng === 0) continue;
    chopArr[i] = 100 * Math.log10(ts / rng) / Math.log10(len);
  }
  return {
    rsi: last(rsiArr) !== null ? last(rsiArr).toFixed(1) : 'N/A',
    roc: roc !== null ? roc.toFixed(1) : 'N/A',
    plusDI: last(dip) !== null ? last(dip).toFixed(1) : 'N/A',
    minusDI: last(dim) !== null ? last(dim).toFixed(1) : 'N/A',
    adx: last(adxA) !== null ? last(adxA).toFixed(1) : 'N/A',
    chop: last(chopArr) !== null ? last(chopArr).toFixed(1) : 'N/A',
  };
}

async function test() {
  const allTokens = await getNiftyOptionTokens();
  const info = allTokens.get(23100);
  const [ce1, pe1] = await Promise.all([
    fetchCandle(info.ceSymbol, 'NFO', 'XX', 'MINUTE'),
    fetchCandle(info.peSymbol, 'NFO', 'XX', 'MINUTE'),
  ]);
  const pe1Map = new Map(pe1.map(c => [c.date, c]));
  const comb1 = ce1.map(ce => {
    const pe = pe1Map.get(ce.date);
    if (!pe) return null;
    return { date: ce.date, open: ce.open + pe.open, close: ce.close + pe.close };
  }).filter(Boolean);
  const candles5 = toFiveMinCandles(comb1);

  console.log('5-min bars:', candles5.length);
  console.log('First:', JSON.stringify(candles5[0]));
  console.log('Last: ', JSON.stringify(candles5[candles5.length - 1]));
  console.log('');
  console.log('LEN  RSI    ROC     +DI    -DI    CHOP   ADX');
  for (const len of [5, 7, 9, 10, 12, 14]) {
    const r = calcAll(candles5, len);
    console.log(`${String(len).padEnd(4)} ${String(r.rsi).padEnd(6)} ${String(r.roc).padEnd(7)} ${String(r.plusDI).padEnd(6)} ${String(r.minusDI).padEnd(6)} ${String(r.chop).padEnd(6)} ${r.adx}`);
  }
  console.log('');
  console.log('TARGET: RSI 22  ROC -10.1  +DI 15  -DI 62  CHOP 19');
}
test().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
