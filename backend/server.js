/**
 * Ponto de entrada do backend.
 * Carrega variaveis de ambiente de todas as formas possiveis.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '.env');
const envFileLoaded = fs.existsSync(envPath);

if (envFileLoaded) {
  dotenv.config({ path: envPath });
}

dotenv.config();

const logger = require('./src/server/utils/logger');
const createApp = require('./src/server/app');
const { ensureBootstrapAdmin } = require('./src/server/auth/adminBootstrap');

logger.info({
  cwd: process.cwd(),
  scriptDir: __dirname,
  envFileLoaded
}, 'Iniciando servidor');

const app = createApp();
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await ensureBootstrapAdmin();

  app.listen(PORT, '0.0.0.0', () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const requestedStorageProvider = process.env.IMAGE_STORAGE_PROVIDER || null;
    const s3Bucket = process.env.S3_BUCKET;

    logger.info({
      port: PORT,
      host: '0.0.0.0',
      environment: process.env.NODE_ENV || 'development',
      requestedStorageProvider,
      cloudinary: {
        cloudName: cloudName || null,
        apiKeyConfigured: !!apiKey,
        apiSecretConfigured: !!apiSecret,
        storageMode: cloudName && apiKey && apiSecret ? 'cloudinary' : 'local'
      },
      s3: {
        bucket: s3Bucket || null,
        region: process.env.AWS_REGION || null,
        accessKeyConfigured: !!process.env.AWS_ACCESS_KEY_ID,
        secretKeyConfigured: !!process.env.AWS_SECRET_ACCESS_KEY
      }
    }, 'Servidor rodando');
  });
};

startServer().catch((error) => {
  logger.error({ err: error }, 'Falha ao iniciar o servidor.');
  process.exit(1);
});
