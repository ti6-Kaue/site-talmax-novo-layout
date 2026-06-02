const path = require('path');
const {
  hasCloudinaryConfig,
  hasS3Config,
  hasSftpConfig,
  getStorageProvider,
  assertConfiguredStorageProvider
} = require('./storage/storageConfig');
const {
  buildLocalImageUrl,
  cleanupLocalTempFile,
  persistFileLocally
} = require('./storage/localStorageProvider');
const {
  buildCloudinaryFolder,
  uploadFileToCloudinary
} = require('./storage/cloudinaryProvider');
const {
  buildS3Key,
  uploadFileToS3
} = require('./storage/s3Provider');
const { uploadFileToSftp } = require('./storage/sftpProvider');
const logger = require('../utils/logger');
const { assertUploadedImageFile } = require('../utils/uploadedImageValidation');

// As variaveis de ambiente sao carregadas pelo server.js no topo.

const validateUploadedImageOrCleanup = async (file) => {
  try {
    await assertUploadedImageFile(file);
  } catch (error) {
    cleanupLocalTempFile(file);
    throw error;
  }
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

  return persistFileLocally(file);
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
