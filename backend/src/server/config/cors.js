/**
 * Configura o CORS do backend.
 * Permite chamadas do frontend local com envio de cookies/sessao.
 */
const cors = require('cors');

const isProduction = process.env.NODE_ENV === 'production';
const developmentPorts = new Set(['3000', '4173', '5173']);
const privateNetworkHostnamePattern = /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');

const isAllowedOrigin = (origin) => {
  if (typeof origin !== 'string') {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  return allowedOrigins.has(normalizedOrigin) || isAllowedDevelopmentOrigin(normalizedOrigin);
};

const isLocalhostOrigin = (origin) => {
  try {
    const parsedOrigin = new URL(origin);
    const hostname = parsedOrigin.hostname.toLowerCase();

    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]';
  } catch (error) {
    return false;
  }
};

const isAllowedDevelopmentOrigin = (origin) => {
  try {
    const parsedOrigin = new URL(origin);
    const normalizedHostname = parsedOrigin.hostname.toLowerCase();
    const normalizedPort = parsedOrigin.port || (parsedOrigin.protocol === 'https:' ? '443' : '80');
    const isLoopbackHost = normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1' || normalizedHostname === '[::1]';
    const isPrivateNetworkHost = privateNetworkHostnamePattern.test(normalizedHostname) || normalizedHostname.endsWith('.local');

    if (isLoopbackHost) {
      return true;
    }

    if (isProduction) {
      return false;
    }

    return developmentPorts.has(normalizedPort) && isPrivateNetworkHost;
  } catch (error) {
    return false;
  }
};

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://talmax.com.br',
  'https://www.talmax.com.br',
  'https://talmax-ti.com.br',
  'https://www.talmax-ti.com.br',
  'https://site-talmax.onrender.com'
].map(normalizeOrigin);

const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...envAllowedOrigins
]);

const allowedHeaders = [
  'Content-Type',
  'Authorization'
];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin) || isLocalhostOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  allowedHeaders,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204
});

module.exports = corsMiddleware;
module.exports.allowedOrigins = allowedOrigins;
module.exports.isAllowedOrigin = isAllowedOrigin;
module.exports.normalizeOrigin = normalizeOrigin;
