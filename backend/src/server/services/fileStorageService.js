const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v2: cloudinary } = require('cloudinary');
const SftpClient = require('ssh2-sftp-client');
const { ensurePrimaryImageDir } = require('../config/imageStorage');
const logger = require('../utils/logger');
const { assertUploadedImageFile } = require('../utils/uploadedImageValidation');

// As variaveis de ambiente sao carregadas pelo server.js no topo.

const hasCloudinaryConfig = () => {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  return !!(name && key && secret);
};

const hasSftpConfig = () => {
  return !!(
    process.env.SFTP_HOST &&
    process.env.SFTP_USER &&
    process.env.SFTP_PASSWORD &&
    process.env.SFTP_REMOTE_DIR &&
    process.env.SFTP_PUBLIC_BASE_URL
  );
};

const hasS3Config = () => {
  return !!(
    process.env.S3_BUCKET &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
};

const getStorageProvider = () => {
  const requestedProvider = String(process.env.IMAGE_STORAGE_PROVIDER || '').trim().toLowerCase();

  if (requestedProvider) {
    return requestedProvider;
  }

  if (hasCloudinaryConfig()) return 'cloudinary';
  if (hasS3Config()) return 's3';
  if (hasSftpConfig()) return 'sftp';

  return 'local';
};

const assertConfiguredStorageProvider = (storageProvider) => {
  if (storageProvider === 'cloudinary' && !hasCloudinaryConfig()) {
    throw new Error('IMAGE_STORAGE_PROVIDER=cloudinary definido, mas faltam variaveis CLOUDINARY_*.');
  }

  if (storageProvider === 's3' && !hasS3Config()) {
    throw new Error('IMAGE_STORAGE_PROVIDER=s3 definido, mas faltam AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY ou S3_BUCKET.');
  }

  if (storageProvider === 'sftp' && !hasSftpConfig()) {
    throw new Error('IMAGE_STORAGE_PROVIDER=sftp definido, mas faltam variaveis SFTP_*.');
  }

  if (!['cloudinary', 's3', 'sftp', 'local'].includes(storageProvider)) {
    throw new Error('IMAGE_STORAGE_PROVIDER invalido. Use cloudinary, s3, sftp ou local.');
  }
};

const normalizeFingerprintValue = (value, options = {}) => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return '';
  }

  if (options.type === 'sha256') {
    return normalizedValue.replace(/^SHA256:/i, '').replace(/\s+/g, '');
  }

  if (options.type === 'md5') {
    return normalizedValue
      .replace(/^MD5:/i, '')
      .replace(/:/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  return normalizedValue;
};

const getConfiguredSftpHostFingerprints = () => ({
  sha256: normalizeFingerprintValue(process.env.SFTP_HOST_FINGERPRINT_SHA256, { type: 'sha256' }),
  md5: normalizeFingerprintValue(process.env.SFTP_HOST_FINGERPRINT_MD5, { type: 'md5' })
});

const assertSftpHostVerificationConfig = () => {
  const fingerprints = getConfiguredSftpHostFingerprints();

  if (fingerprints.sha256 || fingerprints.md5) {
    return fingerprints;
  }

  throw new Error(
    'Configure SFTP_HOST_FINGERPRINT_SHA256 ou SFTP_HOST_FINGERPRINT_MD5 para validar a identidade do servidor SFTP.'
  );
};

const safeStringEquals = (valueA, valueB) => {
  const bufferA = Buffer.from(String(valueA || ''), 'utf8');
  const bufferB = Buffer.from(String(valueB || ''), 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const buildSftpHostVerifier = () => {
  const expectedFingerprints = assertSftpHostVerificationConfig();

  return (hostKey) => {
    const hostKeyBuffer = Buffer.isBuffer(hostKey)
      ? hostKey
      : Buffer.from(hostKey);
    const providedSha256 = crypto.createHash('sha256').update(hostKeyBuffer).digest('base64');
    const providedMd5 = crypto.createHash('md5').update(hostKeyBuffer).digest('hex');

    if (expectedFingerprints.sha256 && safeStringEquals(providedSha256, expectedFingerprints.sha256)) {
      return true;
    }

    if (expectedFingerprints.md5 && safeStringEquals(providedMd5, expectedFingerprints.md5)) {
      return true;
    }

    logger.error({
      sftpHost: process.env.SFTP_HOST || null,
      providedSha256Fingerprint: `SHA256:${providedSha256}`,
      providedMd5Fingerprint: providedMd5.match(/.{1,2}/g)?.join(':') || providedMd5
    }, 'Fingerprint do servidor SFTP nao confere com o valor configurado.');

    return false;
  };
};

const buildLocalImageUrl = (file) => `/img/${file.filename}`;

const buildRemoteImageUrl = (fileName) => {
  const publicBaseUrl = (process.env.SFTP_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return `${publicBaseUrl}/${encodeURIComponent(fileName)}`;
};

const buildCloudinaryFolder = (resourceType = 'geral') => {
  const baseFolder = (process.env.CLOUDINARY_FOLDER || 'talmax').replace(/^\/+|\/+$/g, '');
  const normalizedResourceType = String(resourceType || 'geral').replace(/^\/+|\/+$/g, '');

  return normalizedResourceType ? `${baseFolder}/${normalizedResourceType}` : baseFolder;
};

const buildS3Key = (file, resourceType = 'geral') => {
  const basePrefix = String(process.env.S3_PREFIX || 'talmax').replace(/^\/+|\/+$/g, '');
  const normalizedResourceType = String(resourceType || 'geral').replace(/^\/+|\/+$/g, '');
  const parts = [basePrefix, normalizedResourceType, file.filename].filter(Boolean);

  return parts.join('/');
};

const buildS3PublicUrl = (key) => {
  const publicBaseUrl = String(process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;

  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}`;
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

const uploadFileToCloudinary = async (file, options = {}) => {
  const folder = buildCloudinaryFolder(options.resourceType);

  logger.debug({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    folder,
    fileName: file.filename
  }, 'Configurando Cloudinary para upload.');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  const uploadOptions = {
    resource_type: 'image',
    folder,
    use_filename: true,
    unique_filename: true
  };

  logger.info({
    fileName: file.filename,
    filePath: file.path,
    folder
  }, 'Enviando arquivo para Cloudinary.');

  const result = await cloudinary.uploader.upload(file.path, uploadOptions);

  if (!result || (!result.secure_url && !result.url)) {
    throw new Error('Falha total no upload para Cloudinary: nenhum link retornado.');
  }

  const finalUrl = result.secure_url || result.url;
  logger.info({
    fileName: file.filename,
    finalUrl
  }, 'Upload Cloudinary finalizado com sucesso.');
  return finalUrl;
};

const persistExistingLocalFile = async (filePath, options = {}) => {
  if (!filePath) return null;

  const storageProvider = getStorageProvider();
  const normalizedPath = path.resolve(filePath);
  const fileName = path.basename(normalizedPath);
  const file = {
    path: normalizedPath,
    filename: fileName,
    originalname: fileName
  };

  assertConfiguredStorageProvider(storageProvider);
  await assertUploadedImageFile(file);

  if (storageProvider === 'cloudinary' && hasCloudinaryConfig()) {
    return uploadFileToCloudinary(file, options);
  }

  if (storageProvider === 's3' && hasS3Config()) {
    return uploadFileToS3(file, options);
  }

  if (storageProvider === 'sftp' && hasSftpConfig()) {
    return uploadFileToSftp(file);
  }

  return buildLocalImageUrl(file);
};

const uploadFileToSftp = async (file) => {
  const sftp = new SftpClient();
  const remoteDir = process.env.SFTP_REMOTE_DIR.replace(/\\/g, '/').replace(/\/+$/, '');
  const remoteFilePath = `${remoteDir}/${file.filename}`;
  const hostVerifier = buildSftpHostVerifier();

  try {
    await sftp.connect({
      host: process.env.SFTP_HOST,
      port: Number(process.env.SFTP_PORT || 22),
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PASSWORD,
      hostVerifier
    });

    await sftp.mkdir(remoteDir, true).catch(() => {});
    await sftp.put(file.path, remoteFilePath);

    return buildRemoteImageUrl(file.filename);
  } finally {
    await sftp.end().catch(() => {});
  }
};

const cleanupLocalTempFile = (file) => {
  if (!file || !file.path) return;

  fs.promises.unlink(file.path).catch((err) => {
    logger.warn({
      err,
      fileName: file.filename,
      filePath: file.path
    }, 'Nao foi possivel apagar arquivo temporario.');
  });
};

const moveFileToPrimaryImageDir = async (file) => {
  const primaryImageDir = ensurePrimaryImageDir();
  const sourcePath = path.resolve(file.path);
  const targetPath = path.resolve(path.join(primaryImageDir, file.filename));

  if (sourcePath === targetPath) {
    return {
      ...file,
      path: targetPath
    };
  }

  try {
    await fs.promises.rename(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== 'EXDEV') {
      throw error;
    }

    await fs.promises.copyFile(sourcePath, targetPath);
    await fs.promises.unlink(sourcePath);
  }

  return {
    ...file,
    path: targetPath
  };
};

const validateUploadedImageOrCleanup = async (file) => {
  try {
    await assertUploadedImageFile(file);
  } catch (error) {
    cleanupLocalTempFile(file);
    throw error;
  }
};

const persistUploadedFile = async (file, options = {}) => {
  if (!file) return null;

  const storageProvider = getStorageProvider();

  logger.debug({
    fileName: file.filename,
    filePath: file.path,
    storageProvider,
    resourceType: options.resourceType || 'geral'
  }, 'Iniciando persistencia de arquivo.');

  try {
    assertConfiguredStorageProvider(storageProvider);
  } catch (error) {
    cleanupLocalTempFile(file);
    throw error;
  }
  await validateUploadedImageOrCleanup(file);

  if (storageProvider === 'cloudinary' && hasCloudinaryConfig()) {
    try {
      const publicUrl = await uploadFileToCloudinary(file, options);
      cleanupLocalTempFile(file);
      return publicUrl;
    } catch (error) {
      cleanupLocalTempFile(file);
      logger.error({
        err: error,
        fileName: file.filename,
        filePath: file.path,
        resourceType: options.resourceType || 'geral'
      }, 'Falha fatal ao subir arquivo no Cloudinary.');
      throw error;
    }
  }

  if (storageProvider === 's3' && hasS3Config()) {
    try {
      const publicUrl = await uploadFileToS3(file, options);
      cleanupLocalTempFile(file);
      return publicUrl;
    } catch (error) {
      cleanupLocalTempFile(file);
      logger.error({
        err: error,
        fileName: file.filename,
        filePath: file.path,
        resourceType: options.resourceType || 'geral'
      }, 'Falha fatal ao subir arquivo no S3.');
      throw error;
    }
  }

  if (storageProvider === 'sftp' && hasSftpConfig()) {
    try {
      const publicUrl = await uploadFileToSftp(file);
      cleanupLocalTempFile(file);
      return publicUrl;
    } catch (error) {
      cleanupLocalTempFile(file);
      logger.error({
        err: error,
        fileName: file.filename,
        filePath: file.path,
        resourceType: options.resourceType || 'geral'
      }, 'Falha fatal ao subir arquivo no SFTP.');
      throw error;
    }
  }

  const storedFile = await moveFileToPrimaryImageDir(file);
  const localUrl = buildLocalImageUrl(storedFile);
  logger.info({
    fileName: storedFile.filename,
    localUrl
  }, 'Usando armazenamento local como fallback.');
  return localUrl;
};

const persistUploadedFiles = async (files = []) => {
  return Promise.all(files.map((file) => persistUploadedFile(file)));
};

const persistUploadedFilesByType = async (files = [], options = {}) => {
  return Promise.all(files.map((file) => persistUploadedFile(file, options)));
};

module.exports = {
  hasCloudinaryConfig,
  hasS3Config,
  hasSftpConfig,
  buildCloudinaryFolder,
  buildS3Key,
  persistUploadedFile,
  persistExistingLocalFile,
  persistUploadedFiles,
  persistUploadedFilesByType
};
