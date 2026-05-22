const DEFAULT_PUBLIC_API_CACHE_TTL_MS = 30 * 1000;
const MAX_PUBLIC_API_CACHE_ENTRIES = 200;

const normalizePositiveInteger = (value, fallbackValue) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallbackValue;
};

const PUBLIC_API_CACHE_TTL_MS = normalizePositiveInteger(
  process.env.PUBLIC_API_CACHE_TTL_MS,
  DEFAULT_PUBLIC_API_CACHE_TTL_MS
);

const cache = new Map();

const shouldSkipPublicApiCache = (req) => {
  if (PUBLIC_API_CACHE_TTL_MS === 0) {
    return true;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return true;
  }

  if (req.path.startsWith('/admin') || req.path.startsWith('/analytics')) {
    return true;
  }

  if (req.query?.include_inactive !== undefined) {
    return true;
  }

  if (req.headers.authorization || req.headers.cookie) {
    return true;
  }

  return false;
};

const pruneCacheIfNeeded = () => {
  if (cache.size < MAX_PUBLIC_API_CACHE_ENTRIES) {
    return;
  }

  const firstKey = cache.keys().next().value;
  if (firstKey) {
    cache.delete(firstKey);
  }
};

const clearPublicApiCache = () => {
  cache.clear();
};

const createPublicApiCacheMiddleware = () => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    clearPublicApiCache();
    return next();
  }

  if (shouldSkipPublicApiCache(req)) {
    return next();
  }

  const cacheKey = `${req.method}:${req.originalUrl}`;
  const cachedResponse = cache.get(cacheKey);
  const now = Date.now();

  if (cachedResponse && cachedResponse.expiresAt > now) {
    res.set(cachedResponse.headers);
    res.setHeader('X-Cache', 'HIT');
    return res.status(cachedResponse.statusCode).send(cachedResponse.body);
  }

  if (cachedResponse) {
    cache.delete(cacheKey);
  }

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      pruneCacheIfNeeded();
      cache.set(cacheKey, {
        body,
        expiresAt: Date.now() + PUBLIC_API_CACHE_TTL_MS,
        headers: {
          'Cache-Control': `public, max-age=${Math.floor(PUBLIC_API_CACHE_TTL_MS / 1000)}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        statusCode: res.statusCode
      });
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(PUBLIC_API_CACHE_TTL_MS / 1000)}`);
    }

    return originalJson(body);
  };

  return next();
};

module.exports = {
  clearPublicApiCache,
  createPublicApiCacheMiddleware
};
