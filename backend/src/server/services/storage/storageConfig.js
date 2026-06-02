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

module.exports = {
  hasCloudinaryConfig,
  hasS3Config,
  hasSftpConfig,
  getStorageProvider,
  assertConfiguredStorageProvider
};
