/**
 * Define as rotas de categorias e subcategorias.
 * Cuida de listagem pública e operações administrativas de CRUD.
 */
const express = require('express');
const db = require('../../config/database');
const upload = require('../config/upload');
const { safe } = require('../utils/common');
const { requireAdminSession } = require('../auth/adminSession');
const { validateCategoryWritePayload } = require('../validation/contentSchemas');
const { persistUploadedFile } = require('../services/fileStorageService');
const { listBackupCategories } = require('../services/backupContentService');
const { sanitizeServedImageUrl } = require('../config/imageStorage');
const { wrapError } = require('../utils/errorHandling');
const {
  sanitizeAssetReference,
  sanitizeTextInput
} = require('../utils/inputSanitization');
const logger = require('../utils/logger');

const router = express.Router();
let cachedCategorySchemaState = null;

const shouldUseBackupFallback = process.env.NODE_ENV !== 'production';
const CATEGORY_ICON_FILE_FIELDS = ['icon', 'logo', 'icon_url'];
const CATEGORY_BACKGROUND_FILE_FIELDS = [
  'background',
  'background_url',
  'backgroundImage',
  'background_image',
  'categoryBackground',
  'category_background'
];
const CATEGORY_PAGE_BANNER_FILE_FIELDS = [
  'page_banner',
  'page_banner_categorias_url',
  'page_banner_url',
  'pageBanner',
  'page_banner_image',
  'categoryPageBanner',
  'category_page_banner'
];
const CATEGORY_PAGE_BANNER_COLUMN = 'page_banner_categorias_url';
const LEGACY_CATEGORY_PAGE_BANNER_COLUMN = 'page_banner_url';

const categoryUpload = upload.any();

const getTableColumnSet = async (tableName) => {
  const [rows] = await db.query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
};

const getCategorySchemaState = async () => {
  if (cachedCategorySchemaState) {
    return cachedCategorySchemaState;
  }

  const [categoryColumns, subCategoryColumns] = await Promise.all([
    getTableColumnSet('categorias'),
    getTableColumnSet('sub_categorias')
  ]);

  if (!categoryColumns.has('background_url')) {
    try {
      await db.query('ALTER TABLE categorias ADD COLUMN background_url VARCHAR(500) DEFAULT NULL AFTER icon_url');
      categoryColumns.add('background_url');
    } catch (err) {
      logger.warn({ err }, 'Não foi possível garantir a coluna background_url em categorias.');
    }
  }

  if (!categoryColumns.has(CATEGORY_PAGE_BANNER_COLUMN)) {
    try {
      await db.query(`ALTER TABLE categorias ADD COLUMN ${CATEGORY_PAGE_BANNER_COLUMN} VARCHAR(500) DEFAULT NULL AFTER background_url`);
      categoryColumns.add(CATEGORY_PAGE_BANNER_COLUMN);

      if (categoryColumns.has(LEGACY_CATEGORY_PAGE_BANNER_COLUMN)) {
        await db.query(`UPDATE categorias SET ${CATEGORY_PAGE_BANNER_COLUMN} = ${LEGACY_CATEGORY_PAGE_BANNER_COLUMN} WHERE ${CATEGORY_PAGE_BANNER_COLUMN} IS NULL AND ${LEGACY_CATEGORY_PAGE_BANNER_COLUMN} IS NOT NULL`);
      }
    } catch (err) {
      logger.warn({ err }, `Não foi possível garantir a coluna ${CATEGORY_PAGE_BANNER_COLUMN} em categorias.`);
    }
  }

  if (!subCategoryColumns.has('background_url')) {
    try {
      await db.query('ALTER TABLE sub_categorias ADD COLUMN background_url VARCHAR(500) DEFAULT NULL AFTER slug');
      subCategoryColumns.add('background_url');
    } catch (err) {
      logger.warn({ err }, 'Não foi possível garantir a coluna background_url em sub_categorias.');
    }
  }

  cachedCategorySchemaState = {
    categoryHasIconUrl: categoryColumns.has('icon_url'),
    categoryHasBackgroundUrl: categoryColumns.has('background_url'),
    categoryHasPageBannerUrl: categoryColumns.has(CATEGORY_PAGE_BANNER_COLUMN),
    categoryHasDisplayOrder: categoryColumns.has('display_order'),
    categoryHasIsVisible: categoryColumns.has('is_visible'),
    subCategoryHasBackgroundUrl: subCategoryColumns.has('background_url'),
    subCategoryHasDisplayOrder: subCategoryColumns.has('display_order'),
    subCategoryHasIsVisible: subCategoryColumns.has('is_visible')
  };

  return cachedCategorySchemaState;
};

const buildCategoryListQuery = (schemaState) => {
  const categoryIconSelect = schemaState.categoryHasIconUrl ? 'icon_url' : 'NULL AS icon_url';
  const categoryBackgroundSelect = schemaState.categoryHasBackgroundUrl ? 'background_url' : 'NULL AS background_url';
  const categoryPageBannerSelect = schemaState.categoryHasPageBannerUrl
    ? `${CATEGORY_PAGE_BANNER_COLUMN} AS page_banner_categorias_url`
    : 'NULL AS page_banner_categorias_url';
  const categoryDisplayOrderSelect = schemaState.categoryHasDisplayOrder ? 'display_order' : '0 AS display_order';
  const categoryVisibleSelect = schemaState.categoryHasIsVisible ? 'is_visible' : '1 AS is_visible';
  const subCategoryBackgroundSelect = schemaState.subCategoryHasBackgroundUrl ? 'background_url' : 'NULL AS background_url';
  const subCategoryDisplayOrderSelect = schemaState.subCategoryHasDisplayOrder ? 'display_order' : '0 AS display_order';
  const subCategoryVisibleSelect = schemaState.subCategoryHasIsVisible ? 'IFNULL(is_visible, 1)' : '1';

  return `
    SELECT id, name, slug, ${categoryIconSelect}, ${categoryBackgroundSelect}, ${categoryPageBannerSelect}, ${categoryDisplayOrderSelect}, ${categoryVisibleSelect}, NULL as parent_id
    FROM categorias
    UNION ALL
    SELECT id, name, slug, NULL as icon_url, ${subCategoryBackgroundSelect}, NULL AS page_banner_categorias_url, ${subCategoryDisplayOrderSelect}, ${subCategoryVisibleSelect} as is_visible, category_id as parent_id
    FROM sub_categorias
    ORDER BY display_order, id
  `;
};

const getUploadedFieldFile = (files, fieldNames) => {
  const normalizedFieldNames = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

  if (Array.isArray(files)) {
    return files.find((file) => normalizedFieldNames.includes(file.fieldname)) || null;
  }

  for (const fieldName of normalizedFieldNames) {
    if (Array.isArray(files?.[fieldName]) && files[fieldName][0]) {
      return files[fieldName][0];
    }
  }

  return null;
};

router.get('/', async (req, res) => {
  try {
    const schemaState = await getCategorySchemaState();
    const query = buildCategoryListQuery(schemaState);
    const [rows] = await db.query(query);
    res.json(rows.map((row) => ({
      ...row,
      name: sanitizeTextInput(row.name || '', { preserveNewlines: false }),
      slug: sanitizeTextInput(row.slug || '', { preserveNewlines: false }),
      icon_url: sanitizeAssetReference(sanitizeServedImageUrl(row.icon_url) || ''),
      background_url: sanitizeAssetReference(sanitizeServedImageUrl(row.background_url) || ''),
      page_banner_categorias_url: sanitizeAssetReference(sanitizeServedImageUrl(row.page_banner_categorias_url) || '')
    })));
  } catch (err) {
    if (shouldUseBackupFallback) {
      res.json(listBackupCategories().map((category) => ({
        ...category,
        name: sanitizeTextInput(category.name || '', { preserveNewlines: false }),
        slug: sanitizeTextInput(category.slug || '', { preserveNewlines: false }),
        icon_url: sanitizeAssetReference(sanitizeServedImageUrl(category.icon_url) || ''),
        background_url: sanitizeAssetReference(sanitizeServedImageUrl(category.background_url) || ''),
        page_banner_categorias_url: sanitizeAssetReference(sanitizeServedImageUrl(category.page_banner_categorias_url) || '')
      })));
      return;
    }

    logger.error({ err }, 'Erro ao buscar categorias.');
    res.json([]);
  }
});

router.post('/', requireAdminSession, categoryUpload, async (req, res, next) => {
  try {
    const schemaState = await getCategorySchemaState();
    const payload = validateCategoryWritePayload({
      name: req.body.name,
      slug: req.body.slug,
      is_visible: req.body.is_visible,
      parent_id: req.body.parent_id === 'null' || req.body.parent_id === '' ? undefined : req.body.parent_id
    });
    const visible = payload.is_visible === false ? 0 : 1;

    if (payload.parent_id) {
      const backgroundFile = getUploadedFieldFile(req.files, CATEGORY_BACKGROUND_FILE_FIELDS);
      const background_url = schemaState.subCategoryHasBackgroundUrl && backgroundFile
        ? await persistUploadedFile(backgroundFile, { resourceType: 'categorias' })
        : null;
      const fields = ['category_id', 'name', 'slug'];
      const values = [payload.parent_id, safe(payload.name) || '', safe(payload.slug) || ''];

      if (schemaState.subCategoryHasBackgroundUrl) {
        fields.push('background_url');
        values.push(safe(sanitizeAssetReference(background_url || '') || null));
      }

      fields.push('display_order');
      values.push(0);

      await db.query(
        `INSERT INTO sub_categorias (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
        values
      );
      return res.status(201).json({ message: 'Subcategoria criada!' });
    }

    const iconFile = getUploadedFieldFile(req.files, CATEGORY_ICON_FILE_FIELDS);
    const backgroundFile = getUploadedFieldFile(req.files, CATEGORY_BACKGROUND_FILE_FIELDS);
    const pageBannerFile = getUploadedFieldFile(req.files, CATEGORY_PAGE_BANNER_FILE_FIELDS);
    const icon_url = iconFile
      ? await persistUploadedFile(iconFile, { resourceType: 'categorias' })
      : null;
    const background_url = schemaState.categoryHasBackgroundUrl && backgroundFile
      ? await persistUploadedFile(backgroundFile, { resourceType: 'categorias' })
      : null;
    const page_banner_categorias_url = schemaState.categoryHasPageBannerUrl && pageBannerFile
      ? await persistUploadedFile(pageBannerFile, { resourceType: 'categorias' })
      : null;

    const fields = ['name', 'slug', 'icon_url'];
    const values = [
      safe(payload.name) || '',
      safe(payload.slug) || '',
      safe(sanitizeAssetReference(icon_url || '') || null)
    ];

    if (schemaState.categoryHasBackgroundUrl) {
      fields.push('background_url');
      values.push(safe(sanitizeAssetReference(background_url || '') || null));
    }

    if (schemaState.categoryHasPageBannerUrl) {
      fields.push(CATEGORY_PAGE_BANNER_COLUMN);
      values.push(safe(sanitizeAssetReference(page_banner_categorias_url || '') || null));
    }

    fields.push('display_order', 'is_visible');
    values.push(0, visible);

    await db.query(
      `INSERT INTO categorias (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
      values
    );
    return res.status(201).json({ message: 'Categoria criada!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao criar categoria.' }));
  }
});

router.put('/:id', requireAdminSession, categoryUpload, async (req, res, next) => {
  try {
    const schemaState = await getCategorySchemaState();
    const payload = validateCategoryWritePayload({
      name: req.body.name,
      slug: req.body.slug,
      is_visible: req.body.is_visible,
      parent_id: req.body.parent_id === 'null' || req.body.parent_id === '' ? undefined : req.body.parent_id
    });
    const visible = payload.is_visible === false ? 0 : 1;
    const { id } = req.params;

    if (payload.parent_id) {
      let query = 'UPDATE sub_categorias SET name = ?, slug = ?, category_id = ?, is_visible = ?';
      const params = [safe(payload.name) || '', safe(payload.slug) || '', payload.parent_id, visible];
      const backgroundFile = getUploadedFieldFile(req.files, CATEGORY_BACKGROUND_FILE_FIELDS);

      if (schemaState.subCategoryHasBackgroundUrl && backgroundFile) {
        query += ', background_url = ?';
        params.push(sanitizeAssetReference(await persistUploadedFile(backgroundFile, { resourceType: 'categorias' })) || null);
      }

      query += ' WHERE id = ?';
      params.push(id);

      await db.query(query, params.map(safe));
      return res.json({ message: 'Subcategoria atualizada!' });
    }

    let query = 'UPDATE categorias SET name = ?, slug = ?, is_visible = ?';
    const params = [safe(payload.name) || '', safe(payload.slug) || '', visible];
    const iconFile = getUploadedFieldFile(req.files, CATEGORY_ICON_FILE_FIELDS);
    const backgroundFile = getUploadedFieldFile(req.files, CATEGORY_BACKGROUND_FILE_FIELDS);
    const pageBannerFile = getUploadedFieldFile(req.files, CATEGORY_PAGE_BANNER_FILE_FIELDS);

    if (iconFile) {
      query += ', icon_url = ?';
      params.push(sanitizeAssetReference(await persistUploadedFile(iconFile, { resourceType: 'categorias' })) || null);
    }

    if (schemaState.categoryHasBackgroundUrl && backgroundFile) {
      query += ', background_url = ?';
      params.push(sanitizeAssetReference(await persistUploadedFile(backgroundFile, { resourceType: 'categorias' })) || null);
    }

    if (schemaState.categoryHasPageBannerUrl && pageBannerFile) {
      query += `, ${CATEGORY_PAGE_BANNER_COLUMN} = ?`;
      params.push(sanitizeAssetReference(await persistUploadedFile(pageBannerFile, { resourceType: 'categorias' })) || null);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params.map(safe));
    return res.json({ message: 'Categoria atualizada!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar categoria.' }));
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM sub_categorias WHERE id = ?', [id]);
    await db.query('DELETE FROM categorias WHERE id = ?', [id]);

    return res.json({ message: 'Categoria/Subcategoria excluída com sucesso!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao excluir categoria.' }));
  }
});

module.exports = router;
