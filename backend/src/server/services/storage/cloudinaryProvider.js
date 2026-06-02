const { v2: cloudinary } = require('cloudinary');
const logger = require('../../utils/logger');

const buildCloudinaryFolder = (resourceType = 'geral') => {
  const baseFolder = (process.env.CLOUDINARY_FOLDER || 'talmax').replace(/^\/+|\/+$/g, '');
  const normalizedResourceType = String(resourceType || 'geral').replace(/^\/+|\/+$/g, '');

  return normalizedResourceType ? `${baseFolder}/${normalizedResourceType}` : baseFolder;
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

module.exports = {
  buildCloudinaryFolder,
  uploadFileToCloudinary
};
