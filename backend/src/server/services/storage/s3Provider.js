const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../../utils/logger');

const encodeS3KeyForUrl = (key) => key.split('/').map(encodeURIComponent).join('/');

const buildS3Key = (file, resourceType = 'geral') => {
  const basePrefix = String(process.env.S3_PREFIX || 'talmax').replace(/^\/+|\/+$/g, '');
  const normalizedResourceType = String(resourceType || 'geral').replace(/^\/+|\/+$/g, '');
  const parts = [basePrefix, normalizedResourceType, file.filename].filter(Boolean);

  return parts.join('/');
};

const buildS3PublicUrl = (key) => {
  const publicBaseUrl = String(process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  const encodedKey = encodeS3KeyForUrl(key);

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${encodedKey}`;
  }

  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;

  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
};

const uploadFileToS3 = async (file, options = {}) => {
  const key = buildS3Key(file, options.resourceType);
  const client = new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  logger.info({
    bucket: process.env.S3_BUCKET,
    key,
    fileName: file.filename
  }, 'Enviando arquivo para S3.');

  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fs.createReadStream(file.path),
    ContentType: file.mimetype || undefined,
    CacheControl: process.env.S3_CACHE_CONTROL || 'public, max-age=31536000, immutable'
  }));

  const finalUrl = buildS3PublicUrl(key);
  logger.info({
    fileName: file.filename,
    finalUrl
  }, 'Upload S3 finalizado com sucesso.');

  return finalUrl;
};

module.exports = {
  buildS3Key,
  buildS3PublicUrl,
  uploadFileToS3
};
