/**
 * Centraliza os cabecalhos HTTP de seguranca do backend.
 * Mantem a configuracao do Helmet separada para facilitar ajustes futuros.
 */
const helmet = require('helmet');

const isProduction = process.env.NODE_ENV === 'production';

const applySecurityHeaders = (app) => {
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com'
        ],
        frameAncestors: ["'none'"],
        frameSrc: [
          "'self'",
          'https://www.youtube.com'
        ],
        imgSrc: [
          "'self'",
          'blob:',
          'data:',
          'https:'
        ],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com'
        ],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  }));
};

module.exports = applySecurityHeaders;
