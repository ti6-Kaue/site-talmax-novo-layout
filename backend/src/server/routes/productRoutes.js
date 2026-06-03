/**
 * Define as rotas de produtos.
 * Aqui ficam a consulta publica e o CRUD administrativo com upload e transacoes.
 */
const express = require('express');
const db = require('../../config/database');
const upload = require('../config/upload');
const { safe } = require('../utils/common');
const {
  getAuthenticatedAdminSession,
  requireAdminSession
} = require('../auth/adminSession');
const {
  parseInteger,
  parseBooleanFlag,
  parseStringArray
} = require('../utils/requestParsers');
const {
  normalizeProductExtraDataForStorage,
  normalizeStoredProductExtraData,
  parseProductWriteRequest,
  validateQuoteButtonPayload
} = require('../validation/productSchemas');
const {
  listProducts,
  listProductsPage,
  findProductById,
  findProductBySku,
  attachProductCategories,
  replaceProductTabs,
  ensureProductDatabaseTables,
  PRODUCTS_TABLE_NAME
} = require('../services/productService');
const { persistUploadedFilesByType } = require('../services/fileStorageService');
const {
  listBackupProducts,
  findBackupProductById,
  listBackupCategories
} = require('../services/backupContentService');
const { wrapError } = require('../utils/errorHandling');
const logger = require('../utils/logger');

const router = express.Router();
const MAX_PRODUCT_IMAGES = 50;
const DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE = 12;
const MAX_PUBLIC_PRODUCT_PAGE_SIZE = 60;
const PRODUCT_BANNER_UPLOAD_FIELDS = ['product_banner', 'productBanner', 'banner', 'banner_image', 'bannerImage'];
const productUpload = upload.fields([
  { name: 'images', maxCount: 20 },
  ...PRODUCT_BANNER_UPLOAD_FIELDS.map((name) => ({ name, maxCount: 1 }))
]);

const normalizeProductText = (value) => safe(value || '').trim();
const normalizeSearchableText = (value = '') => (
  normalizeProductText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);
const normalizeImageList = (value) => (
  Array.isArray(value)
    ? value.map((imagePath) => safe(imagePath)).filter(Boolean)
    : []
);

const normalizeUploadedFilesByField = (files) => {
  if (!files) {
    return {};
  }

  if (Array.isArray(files)) {
    return files.reduce((map, file) => {
      const fieldName = file?.fieldname || 'images';
      map[fieldName] = [...(map[fieldName] || []), file];
      return map;
    }, {});
  }

  return files;
};

const getUploadedProductImageFiles = (files) => normalizeUploadedFilesByField(files).images || [];

const getUploadedProductBannerFiles = (files) => {
  const filesByField = normalizeUploadedFilesByField(files);

  return PRODUCT_BANNER_UPLOAD_FIELDS
    .flatMap((fieldName) => filesByField[fieldName] || [])
    .slice(0, 1);
};

const applyProductBannerToExtraData = (extra, uploadedBannerPaths = []) => {
  const productBannerUrl = safe(uploadedBannerPaths[0] || extra.productBannerUrl || '');

  if (productBannerUrl) {
    extra.productBannerUrl = productBannerUrl;
    return;
  }

  delete extra.productBannerUrl;
};

const buildStoredImageList = (mainImage, extraImages) => {
  const normalizedMainImage = safe(mainImage);
  const normalizedExtraImages = normalizeImageList(extraImages);

  if (!normalizedMainImage) {
    return Array.from(new Set(normalizedExtraImages));
  }

  return Array.from(new Set([normalizedMainImage, ...normalizedExtraImages]));
};

const reorderImagePaths = (imagePaths, primaryIndex = 0) => {
  if (imagePaths.length === 0) {
    return [];
  }

  const boundedIndex = Math.min(Math.max(parseInteger(primaryIndex, 0), 0), imagePaths.length - 1);
  const selectedImage = imagePaths[boundedIndex];

  return [
    selectedImage,
    ...imagePaths.filter((_, index) => index !== boundedIndex)
  ];
};

const rollbackIfPossible = async (connection) => {
  if (!connection) {
    return;
  }

  try {
    await connection.rollback();
  } catch (rollbackError) {
    logger.warn({ err: rollbackError }, 'Falha ao executar rollback da transação de produto.');
  }
};

const releaseIfPossible = (connection) => {
  if (!connection) {
    return;
  }

  try {
    connection.release();
  } catch (releaseError) {
    logger.warn({ err: releaseError }, 'Falha ao liberar conexão do pool de produtos.');
  }
};

const findDuplicateProductByName = async (connection, name, excludeId = null) => {
  await ensureProductDatabaseTables(connection);
  const query = `
    SELECT id
    FROM ${PRODUCTS_TABLE_NAME}
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
      ${excludeId ? 'AND id <> ?' : ''}
    LIMIT 1
  `;
  const params = excludeId ? [name, excludeId] : [name];
  const [rows] = await connection.query(query, params);
  return rows[0] || null;
};

const hasAllMainCategories = async (connection, categoryIds) => {
  if (categoryIds.length === 0) {
    return false;
  }

  const placeholders = categoryIds.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT COUNT(DISTINCT id) AS total FROM categorias WHERE id IN (${placeholders})`,
    categoryIds
  );

  return Number(rows?.[0]?.total || 0) === categoryIds.length;
};

const hasValidSubCategories = async (connection, categoryIds, subCategoryIds) => {
  if (subCategoryIds.length === 0) {
    return true;
  }

  if (categoryIds.length === 0) {
    return false;
  }

  const placeholders = subCategoryIds.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT id, category_id FROM sub_categorias WHERE id IN (${placeholders})`,
    subCategoryIds
  );

  if (rows.length !== subCategoryIds.length) {
    return false;
  }

  const mainCategorySet = new Set(categoryIds);
  return rows.every((row) => mainCategorySet.has(Number(row.category_id)));
};

const shouldUseProductPagination = (query = {}) => (
  query.page !== undefined
  || query.limit !== undefined
  || query.search !== undefined
  || query.category_slugs !== undefined
);

const buildPublicProductPagination = (query = {}) => {
  const page = Math.max(1, parseInteger(query.page, 1));
  const limit = Math.min(
    Math.max(1, parseInteger(query.limit, DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE)),
    MAX_PUBLIC_PRODUCT_PAGE_SIZE
  );

  return {
    page,
    limit,
    search: normalizeProductText(query.search || ''),
    categorySlugs: parseStringArray(query.category_slugs)
  };
};

const filterBackupProducts = (products, categories, options = {}) => {
  const normalizedSearch = normalizeSearchableText(options.search || '');
  const normalizedCategorySlugs = parseStringArray(options.categorySlugs).map(normalizeSearchableText);
  const visibleProducts = products.filter((product) => (
    options.includeInactive
    || (
      product.is_active !== false
      && product.is_active !== 0
      && safe(product.main_image).trim()
      && safe(product.description).trim()
    )
  ));

  if (!normalizedSearch && normalizedCategorySlugs.length === 0) {
    return visibleProducts;
  }

  const categoriesBySlug = new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [
      normalizeSearchableText(category.slug),
      category
    ])
  );

  const categoryNamesToMatch = new Set();

  normalizedCategorySlugs.forEach((slug) => {
    const matchedCategory = categoriesBySlug.get(slug);

    if (!matchedCategory) {
      return;
    }

    categoryNamesToMatch.add(normalizeSearchableText(matchedCategory.name));

    if (!matchedCategory.parent_id) {
      categories
        .filter((category) => Number(category.parent_id) === Number(matchedCategory.id))
        .forEach((childCategory) => categoryNamesToMatch.add(normalizeSearchableText(childCategory.name)));
    }
  });

  return visibleProducts.filter((product) => {
    const searchableText = normalizeSearchableText([
      product.name,
      product.category_names
    ].filter(Boolean).join(' '));

    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    if (categoryNamesToMatch.size === 0) {
      return true;
    }

    const productCategoryNames = String(product.category_names || '')
      .split(',')
      .map((categoryName) => normalizeSearchableText(categoryName))
      .filter(Boolean);

    return productCategoryNames.some((categoryName) => categoryNamesToMatch.has(categoryName));
  });
};

const paginateProducts = (products, options = {}) => {
  const page = Math.max(1, parseInteger(options.page, 1));
  const limit = Math.min(
    Math.max(1, parseInteger(options.limit, DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE)),
    MAX_PUBLIC_PRODUCT_PAGE_SIZE
  );
  const total = Array.isArray(products) ? products.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * limit;
  const items = (Array.isArray(products) ? products : []).slice(startIndex, startIndex + limit);

  return {
    items,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1
    }
  };
};

const resolveIncludeInactiveAccess = async (req, res) => {
  const includeInactive = parseBooleanFlag(req.query.include_inactive);

  if (!includeInactive) {
    return false;
  }

  const adminSession = await getAuthenticatedAdminSession(req);

  if (!adminSession) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return null;
  }

  return true;
};

router.get('/', async (req, res, next) => {
  const shouldPaginate = shouldUseProductPagination(req.query);
  const publicPagination = buildPublicProductPagination(req.query);
  let includeInactive = false;

  try {
    includeInactive = await resolveIncludeInactiveAccess(req, res);

    if (includeInactive === null) {
      return undefined;
    }

    if (shouldPaginate) {
      const response = await listProductsPage(db, {
        includeInactive,
        ...publicPagination
      });
      return res.json(response);
    }

    const products = await listProducts(db, { includeInactive });
    return res.json(products);
  } catch (err) {
    try {
      const backupProducts = listBackupProducts({ includeInactive });
      const visibleBackupProducts = includeInactive
        ? backupProducts
        : backupProducts.filter((product) => (
          safe(product.main_image).trim()
          && safe(product.description).trim()
        ));

      if (shouldPaginate) {
        const filteredBackupProducts = filterBackupProducts(
          visibleBackupProducts,
          listBackupCategories(),
          { ...publicPagination, includeInactive }
        );

        return res.json(paginateProducts(filteredBackupProducts, publicPagination));
      }

      return res.json(visibleBackupProducts);
    } catch (backupError) {
      return next(wrapError(err, {
        publicMessage: 'Erro ao listar produtos.',
        meta: { backupError: backupError.message }
      }));
    }
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const includeInactive = await resolveIncludeInactiveAccess(req, res);

    if (includeInactive === null) {
      return undefined;
    }

    const product = await findProductById(db, req.params.id, { includeInactive });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    return res.json(product);
  } catch (err) {
    try {
      const backupProduct = findBackupProductById(req.params.id, { includeInactive });

      if (!backupProduct) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      return res.json(backupProduct);
    } catch (backupError) {
      return next(wrapError(err, {
        publicMessage: 'Erro ao buscar produto.',
        meta: { backupError: backupError.message }
      }));
    }
  }
});

router.post('/', requireAdminSession, productUpload, async (req, res, next) => {
  const connection = await db.getConnection();

  try {
    await ensureProductDatabaseTables(connection);
    await connection.beginTransaction();

    const payload = parseProductWriteRequest(req.body);
    const normalizedSku = normalizeProductText(payload.sku);
    const normalizedName = normalizeProductText(payload.name);
    const normalizedDescription = normalizeProductText(payload.description);
    const parsedCategoryIds = payload.category_ids;
    const parsedSubCategoryIds = payload.sub_category_ids;
    const primaryImageIndex = parseInteger(payload.primary_image_index, 0);
    const uploadedImagePaths = await persistUploadedFilesByType(getUploadedProductImageFiles(req.files), { resourceType: 'produtos' });
    const uploadedBannerPaths = await persistUploadedFilesByType(getUploadedProductBannerFiles(req.files), { resourceType: 'produtos/banners' });
    const extra = normalizeProductExtraDataForStorage(payload.extra_data);
    const productTabs = Array.isArray(extra.product_tabs) ? extra.product_tabs : [];
    const retainedImagePaths = normalizeImageList(extra.images);
    const mergedImagePaths = reorderImagePaths([...retainedImagePaths, ...uploadedImagePaths], primaryImageIndex);

    const duplicateProduct = await findDuplicateProductByName(connection, normalizedName);

    if (duplicateProduct) {
      await rollbackIfPossible(connection);
      return res.status(409).json({ error: 'Já existe um produto com esse nome.' });
    }

    if (mergedImagePaths.length === 0) {
      await rollbackIfPossible(connection);
      return res.status(400).json({ error: 'Adicione pelo menos uma foto para salvar o produto.' });
    }

    if (mergedImagePaths.length > MAX_PRODUCT_IMAGES) {
      await rollbackIfPossible(connection);
      return res.status(400).json({ error: `O produto pode ter no máximo ${MAX_PRODUCT_IMAGES} imagens.` });
    }

    if (!(await hasAllMainCategories(connection, parsedCategoryIds))) {
      await rollbackIfPossible(connection);
      return res.status(400).json({ error: 'As categorias principais informadas são inválidas.' });
    }

    if (!(await hasValidSubCategories(connection, parsedCategoryIds, parsedSubCategoryIds))) {
      await rollbackIfPossible(connection);
      return res.status(400).json({
        error: 'As subcategorias informadas precisam existir e pertencer às categorias principais selecionadas.'
      });
    }

    extra.images = mergedImagePaths;
    applyProductBannerToExtraData(extra, uploadedBannerPaths);
    const isActive = payload.is_active === false ? 0 : 1;

    const [result] = await connection.query(
      `INSERT INTO ${PRODUCTS_TABLE_NAME} (sku, name, description, main_image, extra_data, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [normalizedSku || null, normalizedName, normalizedDescription, safe(mergedImagePaths[0]), JSON.stringify(extra), isActive]
    );

    const productId = result.insertId;
    await attachProductCategories(connection, productId, parsedCategoryIds, parsedSubCategoryIds);
    await replaceProductTabs(connection, productId, productTabs);

    await connection.commit();
    return res.status(201).json({ message: 'Produto criado!' });
  } catch (err) {
    await rollbackIfPossible(connection);
    return next(wrapError(err, { publicMessage: 'Erro ao criar produto.' }));
  } finally {
    releaseIfPossible(connection);
  }
});

router.put('/:id', requireAdminSession, productUpload, async (req, res, next) => {
  const connection = await db.getConnection();
  const productId = Number(req.params.id);

  try {
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Produto invalido.' });
    }

    await ensureProductDatabaseTables(connection);
    await connection.beginTransaction();

    const payload = parseProductWriteRequest(req.body);
    const sku = normalizeProductText(payload.sku);
    const name = normalizeProductText(payload.name);
    const description = normalizeProductText(payload.description);
    const parsedCategoryIds = payload.category_ids;
    const parsedSubCategoryIds = payload.sub_category_ids;
    const primaryImageIndex = parseInteger(payload.primary_image_index, 0);
    const isActive = payload.is_active === false ? 0 : 1;
    const newImagePaths = await persistUploadedFilesByType(getUploadedProductImageFiles(req.files), { resourceType: 'produtos' });
    const newBannerPaths = await persistUploadedFilesByType(getUploadedProductBannerFiles(req.files), { resourceType: 'produtos/banners' });
    const requestedExtraData = payload.extra_data;
    const extra = normalizeProductExtraDataForStorage(requestedExtraData);
    const productTabs = Array.isArray(extra.product_tabs) ? extra.product_tabs : [];
    const retainedImagePaths = normalizeImageList(extra.images);
    const removedImagePaths = normalizeImageList(requestedExtraData.removedImages);
    let resolvedProductId = productId;
    let currentProduct = await findProductById(connection, productId, { includeInactive: true });
    const productBySku = sku ? await findProductBySku(connection, sku, { includeInactive: true }) : null;

    if (productBySku && Number(productBySku.id) !== productId) {
      currentProduct = productBySku;
      resolvedProductId = Number(productBySku.id);
    } else if (!currentProduct && productBySku) {
      currentProduct = productBySku;
      resolvedProductId = Number(productBySku.id);
    }

    if (!currentProduct) {
      await rollbackIfPossible(connection);
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const duplicateProduct = await findDuplicateProductByName(connection, name, resolvedProductId);
    const currentExtra = normalizeStoredProductExtraData(currentProduct.extra_data);
    const storedImagePaths = buildStoredImageList(currentProduct.main_image, currentExtra.images);
    const preservedImagePaths = [
      ...retainedImagePaths,
      ...storedImagePaths.filter((imagePath) => (
        !removedImagePaths.includes(imagePath) && !retainedImagePaths.includes(imagePath)
      ))
    ];
    const mergedImagePaths = reorderImagePaths([...preservedImagePaths, ...newImagePaths], primaryImageIndex);

    if (duplicateProduct) {
      await rollbackIfPossible(connection);
      return res.status(409).json({ error: 'Já existe um produto com esse nome.' });
    }

    if (mergedImagePaths.length === 0) {
      await rollbackIfPossible(connection);
      return res.status(400).json({ error: 'Adicione pelo menos uma foto para salvar o produto.' });
    }

    if (mergedImagePaths.length > MAX_PRODUCT_IMAGES) {
      await rollbackIfPossible(connection);
      return res.status(400).json({ error: `O produto pode ter no máximo ${MAX_PRODUCT_IMAGES} imagens.` });
    }

    if (!(await hasAllMainCategories(connection, parsedCategoryIds))) {
      await rollbackIfPossible(connection);
      return res.status(400).json({ error: 'As categorias principais informadas são inválidas.' });
    }

    if (!(await hasValidSubCategories(connection, parsedCategoryIds, parsedSubCategoryIds))) {
      await rollbackIfPossible(connection);
      return res.status(400).json({
        error: 'As subcategorias informadas precisam existir e pertencer às categorias principais selecionadas.'
      });
    }

    extra.images = mergedImagePaths;
    applyProductBannerToExtraData(extra, newBannerPaths);

    let query = `UPDATE ${PRODUCTS_TABLE_NAME} SET sku=?, name=?, description=?, extra_data=?, main_image=?, is_active=?`;
    const params = [sku || null, name, description, JSON.stringify(extra), safe(mergedImagePaths[0]), isActive];

    query += ' WHERE id=?';
    params.push(resolvedProductId);

    await connection.query(query, params.map(safe));
    await attachProductCategories(connection, resolvedProductId, parsedCategoryIds, parsedSubCategoryIds);
    await replaceProductTabs(connection, resolvedProductId, productTabs);

    await connection.commit();
    return res.json({ message: 'Produto atualizado!' });
  } catch (err) {
    await rollbackIfPossible(connection);
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar produto.' }));
  } finally {
    releaseIfPossible(connection);
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  try {
    await ensureProductDatabaseTables(db);
    await db.query(`DELETE FROM ${PRODUCTS_TABLE_NAME} WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'Produto excluído!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao excluir produto.' }));
  }
});

router.put('/:id/active', requireAdminSession, async (req, res, next) => {
  try {
    const isActive = parseBooleanFlag(req.body?.is_active) ? 1 : 0;
    await ensureProductDatabaseTables(db);
    await db.query(`UPDATE ${PRODUCTS_TABLE_NAME} SET is_active = ? WHERE id = ?`, [isActive, req.params.id]);
    return res.json({ message: `Produto ${isActive ? 'ativado' : 'inativado'}!` });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar status do produto.' }));
  }
});

router.put('/:id/quote-button', requireAdminSession, async (req, res, next) => {
  const connection = await db.getConnection();
  const productId = Number(req.params.id);

  try {
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Produto inválido.' });
    }

    const payload = validateQuoteButtonPayload(req.body || {});
    const product = await findProductById(connection, productId, { includeInactive: true });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const extra = normalizeStoredProductExtraData(product.extra_data);
    extra.showQuoteButton = payload.showQuoteButton;

    await connection.query(`UPDATE ${PRODUCTS_TABLE_NAME} SET extra_data = ? WHERE id = ?`, [JSON.stringify(extra), productId]);

    return res.json({ message: 'Botão de orçamento atualizado!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar botão de orçamento.' }));
  } finally {
    releaseIfPossible(connection);
  }
});

module.exports = router;
