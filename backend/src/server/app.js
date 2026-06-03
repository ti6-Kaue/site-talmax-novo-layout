/**
 * Monta a aplicacao Express principal.
 * Registra middlewares globais, arquivos estaticos e todas as rotas da API.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const corsMiddleware = require('./config/cors');
const {
  getPrimaryImageDir,
  getServedImageDirs
} = require('./config/imageStorage');
const {
  applyPlaceholderImageCache,
  buildFrontendStaticOptions,
  buildImageStaticOptions,
  createCompressionMiddleware
} = require('./config/performance');
const applyTrustProxy = require('./seguranca/trustProxy');
const applySecurityHeaders = require('./seguranca/helmet');
const requireTrustedWriteOrigin = require('./seguranca/trustedWriteOrigin');
const {
  attachRequestId,
  apiNotFoundHandler,
  errorHandler
} = require('./utils/errorHandling');
const { createPublicApiCacheMiddleware } = require('./utils/responseCache');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const productRoutes = require('./routes/productRoutes');
const specialSectionRoutes = require('./routes/specialSectionRoutes');
const homeServiceRoutes = require('./routes/homeServiceRoutes');
const homeContentBlockRoutes = require('./routes/homeContentBlockRoutes');
const pageSettingsRoutes = require('./routes/pageSettingsRoutes');
const customPageRoutes = require('./routes/customPageRoutes');
const digitalGroupRoutes = require('./routes/digitalGroupRoutes');
const technicalAssistanceRoutes = require('./routes/technicalAssistanceRoutes');
const supportRoutes = require('./routes/supportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const normalizeBasePath = (value = '/') => {
  const trimmed = String(value || '/').trim();

  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
};

const inferFrontendBasePath = (frontendDistPath) => {
  try {
    const indexHtml = fs.readFileSync(path.join(frontendDistPath, 'index.html'), 'utf8');
    const assetMatch = indexHtml.match(/(?:src|href)=["'](\/[^"']*\/assets\/)/);

    if (!assetMatch) {
      return '/';
    }

    return normalizeBasePath(assetMatch[1].replace(/\/assets\/$/, ''));
  } catch (error) {
    return '/';
  }
};

const INLINE_IMAGE_PLACEHOLDER = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="Talmax">',
  '<defs>',
  '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
  '<stop offset="0%" stop-color="#0f3f75"/>',
  '<stop offset="100%" stop-color="#1f2937"/>',
  '</linearGradient>',
  '</defs>',
  '<rect width="1200" height="630" fill="url(#bg)"/>',
  '<circle cx="960" cy="140" r="90" fill="rgba(255,255,255,0.12)"/>',
  '<circle cx="210" cy="520" r="130" fill="rgba(255,255,255,0.08)"/>',
  '<text x="80" y="300" fill="#ffffff" font-family="Arial, sans-serif" font-size="84" font-weight="700">Talmax</text>',
  '<text x="80" y="370" fill="#dbeafe" font-family="Arial, sans-serif" font-size="32">Imagem indisponivel</text>',
  '</svg>'
].join('');

const createApp = () => {
  const app = express();
  const frontendDistPath = path.resolve(__dirname, '../../../frontend/dist');
  const frontendBasePath = normalizeBasePath(
    process.env.PUBLIC_BASE_PATH
    || process.env.VITE_PUBLIC_BASE_PATH
    || inferFrontendBasePath(frontendDistPath)
  );
  const imageDirectories = getServedImageDirs();
  const primaryImageDir = getPrimaryImageDir();

  applyTrustProxy(app);
  applySecurityHeaders(app);
  app.use(attachRequestId);
  app.use(corsMiddleware);
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  });
  app.use(createCompressionMiddleware());
  app.use(express.json());
  app.use('/api', requireTrustedWriteOrigin);
  app.use('/api', createPublicApiCacheMiddleware());
  imageDirectories.forEach((directoryPath) => {
    app.use('/img', express.static(directoryPath, buildImageStaticOptions({
      isPrimaryDirectory: directoryPath === primaryImageDir
    })));
  });
  app.use('/img', (req, res) => {
    res.type('image/svg+xml');
    applyPlaceholderImageCache(res);
    return res.send(INLINE_IMAGE_PLACEHOLDER);
  });
  const frontendStaticOptions = buildFrontendStaticOptions();
  if (frontendBasePath !== '/') {
    app.use(frontendBasePath, express.static(frontendDistPath, frontendStaticOptions));
  }
  app.use(express.static(frontendDistPath, frontendStaticOptions));

  app.use('/api/admin', adminAuthRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/banners', bannerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/home-services', homeServiceRoutes);
  app.use('/api/home-content-blocks', homeContentBlockRoutes);
  app.use('/api/technical-assistance', technicalAssistanceRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/page-settings', pageSettingsRoutes);
  app.use('/api/custom-pages', customPageRoutes);
  app.use('/api/digital-groups', digitalGroupRoutes);
  app.use('/api', specialSectionRoutes);
  app.use('/api', apiNotFoundHandler);

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    if (path.extname(req.path)) {
      return res.status(404).type('text/plain').send('Arquivo estático não encontrado.');
    }

    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
