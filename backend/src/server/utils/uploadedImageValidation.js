const fs = require('fs');
const path = require('path');
const { createHttpError } = require('./errorHandling');

const ALLOWED_UPLOAD_IMAGE_FORMATS = {
  jpeg: {
    extensions: new Set(['.jpg', '.jpeg']),
    mimeTypes: new Set(['image/jpeg'])
  },
  png: {
    extensions: new Set(['.png']),
    mimeTypes: new Set(['image/png'])
  },
  webp: {
    extensions: new Set(['.webp']),
    mimeTypes: new Set(['image/webp'])
  },
  gif: {
    extensions: new Set(['.gif']),
    mimeTypes: new Set(['image/gif'])
  }
};

const ALLOWED_UPLOAD_IMAGE_EXTENSIONS = new Set(
  Object.values(ALLOWED_UPLOAD_IMAGE_FORMATS).flatMap((format) => Array.from(format.extensions))
);
const ALLOWED_UPLOAD_IMAGE_MIME_TYPES = new Set(
  Object.values(ALLOWED_UPLOAD_IMAGE_FORMATS).flatMap((format) => Array.from(format.mimeTypes))
);
const ALLOWED_UPLOAD_IMAGE_DESCRIPTION = 'JPG, JPEG, PNG, WEBP e GIF';
const FILE_SIGNATURE_READ_LENGTH = 16;

const getFileExtension = (value = '') => path.extname(String(value || '')).trim().toLowerCase();

const createInvalidUploadImageError = (publicMessage, meta = null) => createHttpError(400, publicMessage, {
  code: 'INVALID_UPLOAD_IMAGE_TYPE',
  expose: true,
  meta
});

const detectUploadedImageFormat = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'png';
  }

  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString('ascii');

    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return 'gif';
    }
  }

  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
};

const readFileSignature = async (filePath) => {
  const fileHandle = await fs.promises.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(FILE_SIGNATURE_READ_LENGTH);
    const { bytesRead } = await fileHandle.read(buffer, 0, FILE_SIGNATURE_READ_LENGTH, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fileHandle.close();
  }
};

const assertAllowedUploadImageCandidate = (file) => {
  const originalName = file?.originalname || file?.filename || '';
  const extension = getFileExtension(originalName);
  const mimeType = String(file?.mimetype || '').trim().toLowerCase();

  if (!ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(extension) || !ALLOWED_UPLOAD_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createInvalidUploadImageError(`Somente imagens ${ALLOWED_UPLOAD_IMAGE_DESCRIPTION} são permitidas.`, {
      originalName,
      mimeType
    });
  }
};

const assertUploadedImageFile = async (file) => {
  const originalName = file?.originalname || file?.filename || file?.path || '';
  const extension = getFileExtension(originalName);
  const mimeType = String(file?.mimetype || '').trim().toLowerCase();

  if (!file?.path || !ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(extension)) {
    throw createInvalidUploadImageError(`Somente imagens ${ALLOWED_UPLOAD_IMAGE_DESCRIPTION} são permitidas.`, {
      originalName,
      mimeType
    });
  }

  const signature = await readFileSignature(file.path);
  const detectedFormat = detectUploadedImageFormat(signature);

  if (!detectedFormat) {
    throw createInvalidUploadImageError('Não foi possível validar o formato real da imagem enviada.', {
      originalName,
      mimeType
    });
  }

  const allowedFormatConfig = ALLOWED_UPLOAD_IMAGE_FORMATS[detectedFormat];

  if (!allowedFormatConfig.extensions.has(extension)) {
    throw createInvalidUploadImageError('A extensão do arquivo não corresponde ao formato real da imagem enviada.', {
      originalName,
      mimeType,
      detectedFormat
    });
  }

  if (mimeType && !allowedFormatConfig.mimeTypes.has(mimeType)) {
    throw createInvalidUploadImageError('O tipo informado da imagem não corresponde ao arquivo enviado.', {
      originalName,
      mimeType,
      detectedFormat
    });
  }

  return detectedFormat;
};

module.exports = {
  ALLOWED_UPLOAD_IMAGE_DESCRIPTION,
  assertAllowedUploadImageCandidate,
  assertUploadedImageFile
};
