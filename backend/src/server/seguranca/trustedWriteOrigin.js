/**
 * Bloqueia escritas na API quando a origem do navegador nao for confiavel.
 * Isso reduz risco de CSRF em rotas protegidas por cookie de sessao.
 */
const corsMiddleware = require('../config/cors');
const { createHttpError } = require('../utils/errorHandling');

const { isAllowedOrigin, normalizeOrigin } = corsMiddleware;

const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizeUrlOrigin = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  try {
    return normalizeOrigin(new URL(value).origin);
  } catch (error) {
    return '';
  }
};

const getTrustedRequestOrigin = (req) => {
  const requestProtocol = req.protocol || 'http';
  const requestHost = req.get('host');

  if (!requestHost) {
    return '';
  }

  return normalizeUrlOrigin(`${requestProtocol}://${requestHost}`);
};

const getRequestSourceOrigin = (req) => {
  const originHeader = typeof req.headers.origin === 'string'
    ? normalizeUrlOrigin(req.headers.origin)
    : '';

  if (originHeader) {
    return {
      source: 'origin',
      value: originHeader
    };
  }

  const refererHeader = typeof req.headers.referer === 'string'
    ? normalizeUrlOrigin(req.headers.referer)
    : '';

  if (refererHeader) {
    return {
      source: 'referer',
      value: refererHeader
    };
  }

  return {
    source: 'none',
    value: ''
  };
};

const isSameSiteBrowserWrite = (req) => {
  const fetchSite = typeof req.headers['sec-fetch-site'] === 'string'
    ? req.headers['sec-fetch-site'].trim().toLowerCase()
    : '';

  return ['same-origin', 'same-site'].includes(fetchSite);
};

const requireTrustedWriteOrigin = (req, _res, next) => {
  if (!UNSAFE_HTTP_METHODS.has(req.method)) {
    return next();
  }

  const requestOrigin = getTrustedRequestOrigin(req);
  const sourceOrigin = getRequestSourceOrigin(req);

  if (!sourceOrigin.value) {
    if (isSameSiteBrowserWrite(req)) {
      return next();
    }

    return next(createHttpError(403, 'Requisição bloqueada por política de origem confiável.', {
      code: 'TRUSTED_ORIGIN_MISSING',
      expose: true,
      meta: {
        method: req.method,
        path: req.originalUrl
      }
    }));
  }

  if (sourceOrigin.value === requestOrigin || isAllowedOrigin(sourceOrigin.value)) {
    return next();
  }

  return next(createHttpError(403, 'Requisição bloqueada por política de origem confiável.', {
    code: 'TRUSTED_ORIGIN_INVALID',
    expose: true,
    meta: {
      method: req.method,
      path: req.originalUrl,
      source: sourceOrigin.source,
      sourceOrigin: sourceOrigin.value,
      requestOrigin
    }
  }));
};

module.exports = requireTrustedWriteOrigin;
