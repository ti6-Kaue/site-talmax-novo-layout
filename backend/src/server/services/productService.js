/**
 * Centraliza a logica de consulta e relacionamento dos produtos.
 * Mantem as rotas menores e reaproveita SQL e transformacoes repetidas.
 */
const {
  sanitizeAssetReference,
  sanitizeTextInput
} = require('../utils/inputSanitization');
const { normalizeStoredProductExtraData } = require('../validation/productSchemas');

const PRODUCTS_TABLE_NAME = 'produtos';
const PRODUCT_TABS_TABLE_NAME = 'abas_produto';
const LEGACY_PRODUCTS_TABLE_NAME = 'products';
const LEGACY_PRODUCT_TABS_TABLE_NAME = 'product_tabs';

const PRODUCT_SELECT_QUERY = `
  SELECT p.*,
         CONCAT_WS(', ', c.name, sc.name) as category_names,
         COALESCE(p.category_id, sc.category_id) as main_category_ids,
         p.sub_category_id as sub_category_ids
  FROM ${PRODUCTS_TABLE_NAME} p
  LEFT JOIN sub_categorias sc ON sc.id = p.sub_category_id
  LEFT JOIN categorias c ON c.id = COALESCE(p.category_id, sc.category_id)
`;

const PRODUCT_TABS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS ${PRODUCT_TABS_TABLE_NAME} (
    id INT NOT NULL AUTO_INCREMENT,
    product_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT DEFAULT NULL,
    content_as_list BOOLEAN DEFAULT FALSE,
    video_url VARCHAR(2048) DEFAULT NULL,
    show_content_with_video BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_abas_produto_product_id (product_id),
    KEY idx_abas_produto_display_order (display_order),
    CONSTRAINT fk_abas_produto_product
      FOREIGN KEY (product_id) REFERENCES ${PRODUCTS_TABLE_NAME}(id) ON DELETE CASCADE
  )
`;

let productTablesReady = false;
let productTabsTableReady = false;

const renameTableIfNeeded = async (db, legacyTableName, tableName) => {
  try {
    await db.query(`RENAME TABLE ${legacyTableName} TO ${tableName}`);
  } catch {
    // Legacy table is absent or canonical table already exists.
  }
};

const ensureProductDatabaseTables = async (db) => {
  if (productTablesReady) {
    return;
  }

  await renameTableIfNeeded(db, LEGACY_PRODUCTS_TABLE_NAME, PRODUCTS_TABLE_NAME);

  productTablesReady = true;
};

const renameLegacyProductTabsTable = async (db) => {
  await renameTableIfNeeded(db, LEGACY_PRODUCT_TABS_TABLE_NAME, PRODUCT_TABS_TABLE_NAME);
};

const ensureProductTabsRuntimeColumns = async (db, tableName) => {
  try {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN video_url VARCHAR(2048) DEFAULT NULL AFTER content_as_list`);
  } catch {
    // Column already exists or legacy table is absent
  }

  try {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN show_content_with_video BOOLEAN DEFAULT TRUE AFTER video_url`);
  } catch {
    // Column already exists or legacy table is absent
  }
};

const migrateLegacyProductTabs = async (db) => {
  try {
    await ensureProductTabsRuntimeColumns(db, LEGACY_PRODUCT_TABS_TABLE_NAME);
    await db.query(`
      INSERT IGNORE INTO ${PRODUCT_TABS_TABLE_NAME}
        (id, product_id, title, content, content_as_list, video_url, show_content_with_video, display_order, is_active, created_at, updated_at)
      SELECT id, product_id, title, content, content_as_list, video_url, show_content_with_video, display_order, is_active, created_at, updated_at
      FROM ${LEGACY_PRODUCT_TABS_TABLE_NAME}
    `);
  } catch {
    // Legacy table does not exist or cannot be copied; the canonical table remains ready.
  }
};

const normalizeProductTabRow = (row) => ({
  id: Number(row.id),
  product_id: Number(row.product_id),
  title: sanitizeTextInput(row.title || '', { preserveNewlines: false }),
  content: sanitizeTextInput(row.content || '', { preserveNewlines: true }),
  content_as_list: Number(row.content_as_list ?? 0) === 1 || row.content_as_list === true,
  video_url: typeof row.video_url === 'string' ? row.video_url.trim() : '',
  show_content_with_video: Number(row.show_content_with_video ?? 1) === 1 || row.show_content_with_video === true,
  display_order: Number(row.display_order || 0),
  is_active: Number(row.is_active ?? 1) === 1
});

const ensureProductTabsTable = async (db) => {
  if (productTabsTableReady) {
    return;
  }

  await ensureProductDatabaseTables(db);
  await renameLegacyProductTabsTable(db);
  await db.query(PRODUCT_TABS_TABLE_QUERY);
  await ensureProductTabsRuntimeColumns(db, PRODUCT_TABS_TABLE_NAME);
  await migrateLegacyProductTabs(db);

  productTabsTableReady = true;
};

const normalizeIncomingTabs = (tabs = []) => (
  Array.isArray(tabs)
    ? tabs
      .map((tab, index) => ({
        title: sanitizeTextInput(tab?.title || '', { preserveNewlines: false }),
        content: sanitizeTextInput(tab?.content || '', { preserveNewlines: true }),
        content_as_list: Boolean(tab?.contentAsList || tab?.content_as_list),
        video_url: typeof (tab?.videoUrl || tab?.video_url) === 'string'
          ? (tab.videoUrl || tab.video_url).trim().slice(0, 2048)
          : '',
        show_content_with_video: tab?.showContentWithVideo ?? tab?.show_content_with_video ?? true,
        display_order: Number.isFinite(Number(tab?.display_order))
          ? Number(tab.display_order)
          : index
      }))
      .filter((tab) => tab.title && (tab.content || tab.video_url))
    : []
);

const listProductTabsByProductIds = async (db, productIds = []) => {
  await ensureProductTabsTable(db);

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const [rows] = await db.query(
    `
      SELECT id, product_id, title, content, content_as_list, video_url, display_order, is_active
           , show_content_with_video
      FROM ${PRODUCT_TABS_TABLE_NAME}
      WHERE product_id IN (?) AND is_active = 1
      ORDER BY product_id ASC, display_order ASC, id ASC
    `,
    [productIds]
  );

  return rows.reduce((map, row) => {
    const normalizedTab = normalizeProductTabRow(row);
    const currentTabs = map.get(normalizedTab.product_id) || [];
    currentTabs.push(normalizedTab);
    map.set(normalizedTab.product_id, currentTabs);
    return map;
  }, new Map());
};

const attachTabsToProducts = async (db, products = []) => {
  await ensureProductTabsTable(db);

  const productIds = products.map((product) => Number(product.id)).filter(Boolean);
  const tabsByProductId = await listProductTabsByProductIds(db, productIds);

  return products.map((product) => ({
    ...product,
    product_tabs: tabsByProductId.get(Number(product.id)) || []
  }));
};

const formatProductRow = (row) => ({
  ...row,
  name: sanitizeTextInput(row.name || '', { preserveNewlines: false }),
  description: sanitizeTextInput(row.description || '', { preserveNewlines: true }),
  main_image: sanitizeAssetReference(row.main_image || ''),
  category_names: sanitizeTextInput(row.category_names || '', { preserveNewlines: false }),
  extra_data: normalizeStoredProductExtraData(row.extra_data),
  category_ids: row.main_category_ids
    ? String(row.main_category_ids).split(',').filter(Boolean).map(Number)
    : [],
  sub_category_ids: row.sub_category_ids
    ? String(row.sub_category_ids).split(',').filter(Boolean).map(Number)
    : [],
  is_active: Number(row.is_active ?? 1) === 1,
  is_featured: Number(row.is_featured) === 1,
  is_upcera: Number(row.is_upcera) === 1,
  is_scanner: Number(row.is_scanner) === 1,
  is_3d_printer: Number(row.is_3d_printer) === 1
});

const normalizeTextSearch = (value = '') => (
  sanitizeTextInput(value || '', { preserveNewlines: false })
    .trim()
    .toLowerCase()
);

const normalizeSlugList = (value = []) => (
  Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => sanitizeTextInput(item || '', { preserveNewlines: false }).trim())
      .filter(Boolean)
  ))
);

const buildProductListWhereClause = (options = {}) => {
  const {
    includeInactive = false,
    search = '',
    categorySlugs = []
  } = options;

  const conditions = [];
  const params = [];
  const normalizedSearch = normalizeTextSearch(search);
  const filteredCategorySlugs = normalizeSlugList(categorySlugs);

  if (!includeInactive) {
    conditions.push('p.is_active = 1');
  }

  if (normalizedSearch) {
    const searchWildcard = `%${normalizedSearch}%`;

    conditions.push(`
      (
        LOWER(TRIM(p.name)) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM categorias c
          WHERE c.id = COALESCE(
              p.category_id,
              (SELECT parent_sc.category_id FROM sub_categorias parent_sc WHERE parent_sc.id = p.sub_category_id LIMIT 1)
            )
            AND LOWER(TRIM(c.name)) LIKE ?
        )
        OR EXISTS (
          SELECT 1
          FROM sub_categorias sc
          WHERE sc.id = p.sub_category_id
            AND LOWER(TRIM(sc.name)) LIKE ?
        )
      )
    `);

    params.push(searchWildcard, searchWildcard, searchWildcard);
  }

  if (filteredCategorySlugs.length > 0) {
    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM categorias c
          WHERE c.id = COALESCE(
              p.category_id,
              (SELECT parent_sc.category_id FROM sub_categorias parent_sc WHERE parent_sc.id = p.sub_category_id LIMIT 1)
            )
            AND c.slug IN (?)
        )
        OR EXISTS (
          SELECT 1
          FROM sub_categorias sc
          WHERE sc.id = p.sub_category_id
            AND sc.slug IN (?)
        )
      )
    `);

    params.push(filteredCategorySlugs, filteredCategorySlugs);
  }

  return {
    normalizedSearch,
    whereClause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params
  };
};

const listProducts = async (db, options = {}) => {
  await ensureProductDatabaseTables(db);
  const { includeInactive = false } = options;
  const whereClause = includeInactive ? '' : ' WHERE p.is_active = 1';
  const [rows] = await db.query(`${PRODUCT_SELECT_QUERY}${whereClause} ORDER BY p.id DESC`);
  return attachTabsToProducts(db, rows.map(formatProductRow));
};

const listProductsPage = async (db, options = {}) => {
  await ensureProductDatabaseTables(db);
  const requestedPage = Number(options.page) || 1;
  const requestedLimit = Number(options.limit) || 12;
  const page = Math.max(1, requestedPage);
  const limit = Math.min(Math.max(1, requestedLimit), 60);
  const { normalizedSearch, whereClause, params } = buildProductListWhereClause(options);

  const [countRows] = await db.query(
    `SELECT COUNT(DISTINCT p.id) AS total FROM ${PRODUCTS_TABLE_NAME} p${whereClause}`,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const orderParams = normalizedSearch ? [`${normalizedSearch}%`] : [];
  const orderClause = normalizedSearch
    ? ' ORDER BY CASE WHEN LOWER(TRIM(p.name)) LIKE ? THEN 0 ELSE 1 END, p.name ASC, p.id DESC'
    : ' ORDER BY p.id DESC';

  const [rows] = await db.query(
    `${PRODUCT_SELECT_QUERY}${whereClause}${orderClause} LIMIT ? OFFSET ?`,
    [...params, ...orderParams, limit, offset]
  );

  const items = await attachTabsToProducts(db, rows.map(formatProductRow));

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

const findProductById = async (db, productId, options = {}) => {
  await ensureProductDatabaseTables(db);
  const { includeInactive = false } = options;
  const [rows] = await db.query(
    `${PRODUCT_SELECT_QUERY} WHERE p.id = ?${includeInactive ? '' : ' AND p.is_active = 1'}`,
    [productId]
  );
  if (!rows[0]) {
    return null;
  }

  const [product] = await attachTabsToProducts(db, [formatProductRow(rows[0])]);
  return product || null;
};

const attachProductCategories = async (connection, productId, mainCategoryIds, subCategoryIds) => {
  await ensureProductDatabaseTables(connection);
  const validMainIds = Array.isArray(mainCategoryIds) ? mainCategoryIds : [];
  const validSubIds = Array.isArray(subCategoryIds) ? subCategoryIds : [];

  let categoryId = validMainIds[0] || null;
  let subCategoryId = validSubIds[0] || null;

  if (subCategoryId) {
    const [subCategories] = await connection.query(
      'SELECT id, category_id FROM sub_categorias WHERE id = ? LIMIT 1',
      [subCategoryId]
    );

    if (subCategories[0]) {
      subCategoryId = subCategories[0].id;
      categoryId = subCategories[0].category_id;
    } else {
      subCategoryId = null;
    }
  } else if (categoryId) {
    const [categories] = await connection.query('SELECT id FROM categorias WHERE id = ? LIMIT 1', [categoryId]);
    categoryId = categories[0]?.id || null;
  }

  await connection.query(
    `UPDATE ${PRODUCTS_TABLE_NAME} SET category_id = ?, sub_category_id = ? WHERE id = ?`,
    [categoryId, subCategoryId, productId]
  );
};

const replaceProductTabs = async (connection, productId, tabs = []) => {
  await ensureProductTabsTable(connection);
  await connection.query(`DELETE FROM ${PRODUCT_TABS_TABLE_NAME} WHERE product_id = ?`, [productId]);

  const normalizedTabs = normalizeIncomingTabs(tabs);

  if (normalizedTabs.length === 0) {
    return;
  }

  const values = normalizedTabs.map((tab, index) => [
    productId,
    tab.title,
    tab.content,
    tab.content_as_list ? 1 : 0,
    tab.video_url || null,
    tab.show_content_with_video ? 1 : 0,
    Number.isFinite(Number(tab.display_order)) ? Number(tab.display_order) : index,
    1
  ]);

  await connection.query(
    `
      INSERT INTO ${PRODUCT_TABS_TABLE_NAME} (product_id, title, content, content_as_list, video_url, show_content_with_video, display_order, is_active)
      VALUES ?
    `,
    [values]
  );
};

module.exports = {
  formatProductRow,
  listProducts,
  listProductsPage,
  findProductById,
  attachProductCategories,
  replaceProductTabs,
  ensureProductDatabaseTables,
  PRODUCTS_TABLE_NAME,
  ensureProductTabsTable
};
