const https = require('https');
const { sendJson, sendError } = require('../response.cjs');

const CACHE_TTL_MS = 15 * 1000;
const MAX_REQUESTS_PER_MINUTE = 60;
const responseCache = new Map();
const requestBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function isRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = requestBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    requestBuckets.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return false;
  }
  if (bucket.count >= MAX_REQUESTS_PER_MINUTE) return true;
  bucket.count += 1;
  return false;
}

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'LobsterBoard/1.0' },
      timeout: 10000
    }, (proxyRes) => {
      let body = '';
      proxyRes.on('data', c => { body += c; if (body.length > 1000000) proxyRes.destroy(); });
      proxyRes.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON from upstream')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

async function handleStocks(symbols) {
  return Promise.all(symbols.map(async (symbol) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const data = await fetchJson(url);
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return { symbol, error: 'Not found' };
      const price = meta.regularMarketPrice || 0;
      const prev = meta.previousClose || meta.chartPreviousClose || price;
      const change = price - prev;
      const pctChange = prev ? (change / prev) * 100 : 0;
      return {
        symbol,
        price: price.toFixed(2),
        change: change >= 0 ? '+' + change.toFixed(2) : change.toFixed(2),
        pctChange: pctChange >= 0 ? '+' + pctChange.toFixed(2) : pctChange.toFixed(2),
        up: change >= 0,
        currency: meta.currency || 'USD'
      };
    } catch (e) {
      return { symbol, error: e.message };
    }
  }));
}

async function handleCrypto(coins, currency) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coins)}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true`;
  const data = await fetchJson(url);
  return Object.entries(data).map(([id, vals]) => {
    const price = vals[currency] || 0;
    const pctRaw = vals[`${currency}_24h_change`] || 0;
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      price: price >= 1 ? price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : price.toFixed(6),
      pctChange: pctRaw >= 0 ? '+' + pctRaw.toFixed(2) : pctRaw.toFixed(2),
      up: pctRaw >= 0,
      currency: currency.toUpperCase()
    };
  });
}

function handle(req, res, pathname, parsedUrl) {
  if (isRateLimited(req)) {
    sendError(res, 'Too many finance requests. Please try again shortly.', 429);
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/finance/stocks') {
    const raw = parsedUrl.searchParams.get('symbols') || '';
    const symbols = raw.toUpperCase().split(',').map(s => s.trim()).filter(s => /^[A-Z0-9.\-^]{1,10}$/.test(s)).slice(0, 20);
    if (!symbols.length) { sendError(res, 'Missing or invalid symbols parameter', 400); return true; }
    const cacheKey = `stocks:${symbols.join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) { sendJson(res, 200, cached); return true; }
    handleStocks(symbols)
      .then(results => { setCached(cacheKey, results); sendJson(res, 200, results); })
      .catch(e => sendError(res, e.message));
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/finance/crypto') {
    const raw = parsedUrl.searchParams.get('coins') || 'bitcoin,ethereum';
    const coins = raw.toLowerCase().split(',').map(s => s.trim()).filter(s => /^[a-z0-9\-]{1,50}$/.test(s)).slice(0, 20).join(',');
    const currency = /^[a-z]{2,5}$/.test(parsedUrl.searchParams.get('currency') || 'usd')
      ? parsedUrl.searchParams.get('currency').toLowerCase() : 'usd';
    if (!coins) { sendError(res, 'Missing or invalid coins parameter', 400); return true; }
    const cacheKey = `crypto:${coins}:${currency}`;
    const cached = getCached(cacheKey);
    if (cached) { sendJson(res, 200, cached); return true; }
    handleCrypto(coins, currency)
      .then(results => { setCached(cacheKey, results); sendJson(res, 200, results); })
      .catch(e => sendError(res, e.message));
    return true;
  }

  return false;
}

module.exports = function () {
  return { handle };
};
