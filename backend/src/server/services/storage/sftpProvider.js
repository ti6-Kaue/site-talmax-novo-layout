const crypto = require('crypto');
const SftpClient = require('ssh2-sftp-client');
const logger = require('../../utils/logger');

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

const buildRemoteImageUrl = (fileName) => {
  const publicBaseUrl = (process.env.SFTP_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return `${publicBaseUrl}/${encodeURIComponent(fileName)}`;
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

module.exports = {
  buildRemoteImageUrl,
  uploadFileToSftp
};
