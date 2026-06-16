
// In-memory price cache: ticker -> { data, time }
const cache = new Map();
const TTL = 60 * 1000; // price freshness: 60 seconds

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const key = symbol.toUpperCase();
  const now = Date.now();

  // 1. Fresh price in cache -> return it, no Finnhub call
  const hit = cache.get(key);
  if (hit && (now - hit.time) < TTL) {
    return res.status(200).json({ ...hit.data, cached: true });
  }

  // 2. Otherwise fetch from Finnhub, store in cache, return
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${key}&token=${process.env.FINNHUB_KEY}`;
    const response = await fetch(url);
    const q = await response.json();

    if (q.error) {
      return res.status(403).json({ error: q.error });
    }
    if (q.c === 0 && q.pc === 0) {
      return res.status(404).json({ error: 'No data for symbol' });
    }

    const today = new Date().toISOString().split('T')[0];
    const data = {
      meta: { symbol: key, interval: '1day', currency: 'USD' },
      values: [{
        datetime: today,
        open: String(q.o),
        high: String(q.h),
        low: String(q.l),
        close: String(q.c),
        volume: '0'
      }],
      price: q.c,
      change: q.d,
      percent_change: q.dp,
      previous_close: q.pc,
      status: 'ok'
    };

    // store in cache - this ticker is now served from memory
    cache.set(key, { data, time: now });

    res.status(200).json({ ...data, cached: false });
  } catch (error) {
    // request failed but we have an old cached price -> serve stale (better than nothing)
    if (hit) {
      return res.status(200).json({ ...hit.data, cached: true, stale: true });
    }
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
}
