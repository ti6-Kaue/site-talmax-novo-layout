const fs = require('fs');
const path = require('path');
const { ensurePrimaryImageDir } = require('../../config/imageStorage');
const logger = require('../../utils/logger');

const buildLocalImageUrl = (file) => `/img/${file.filename}`;

const cleanupLocalTempFile = (file) => {
  if (!file || !file.path) return;

  fs.promises.unlink(file.path).catch((err) => {
    logger.warn({
      err,
      fileName: file.filename,
      filePath: file.path
    }, 'Não foi possível apagar arquivo temporário.');
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

const persistFileLocally = async (file) => {
  const storedFile = await moveFileToPrimaryImageDir(file);
  const localUrl = buildLocalImageUrl(storedFile);

  logger.info({
    fileName: storedFile.filename,
    localUrl
  }, 'Usando armazenamento local como fallback.');

  return localUrl;
};

module.exports = {
  buildLocalImageUrl,
  cleanupLocalTempFile,
  moveFileToPrimaryImageDir,
  persistFileLocally
};
