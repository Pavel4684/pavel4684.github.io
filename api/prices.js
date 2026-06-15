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

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`;
    const response = await fetch(url);
    const q = await response.json();

    if (q.c === 0 && q.pc === 0) {
      return res.status(404).json({ error: 'No data for symbol' });
    }

    const today = new Date().toISOString().split('T')[0];

    const data = {
      meta: { symbol: symbol, interval: '1day', currency: 'USD' },
      values: [
        {
          datetime: today,
          open: String(q.o),
          high: String(q.h),
          low: String(q.l),
          close: String(q.c),
          volume: '0'
        }
      ],
      price: q.c,
      change: q.d,
      percent_change: q.dp,
      previous_close: q.pc,
      status: 'ok'
    };

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
}
