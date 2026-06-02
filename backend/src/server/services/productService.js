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
const PRODUCT_CATEGORIES_TABLE_NAME = 'produto_categorias';
const PRODUCT_SUB_CATEGORIES_TABLE_NAME = 'produto_sub_categorias';
const PRODUCT_TABS_TABLE_NAME = 'abas_produto';
const LEGACY_PRODUCTS_TABLE_NAME = 'products';
const LEGACY_PRODUCT_TABS_TABLE_NAME = 'product_tabs';

const PRODUCT_SELECT_QUERY = `
  SELECT p.*,
         TRIM(BOTH ', ' FROM CONCAT_WS(', ',
           GROUP_CONCAT(DISTINCT rel_c.name ORDER BY rel_c.name SEPARATOR ', '),
           GROUP_CONCAT(DISTINCT rel_sc.name ORDER BY rel_sc.name SEPARATOR ', ')
         )) as category_names,
         GROUP_CONCAT(DISTINCT rel_c.id ORDER BY rel_c.id SEPARATOR ',') as main_category_ids,
         GROUP_CONCAT(DISTINCT rel_sc.id ORDER BY rel_sc.id SEPARATOR ',') as sub_category_ids
  FROM ${PRODUCTS_TABLE_NAME} p
  LEFT JOIN ${PRODUCT_CATEGORIES_TABLE_NAME} pc ON pc.product_id = p.id
  LEFT JOIN categorias rel_c ON rel_c.id = COALESCE(pc.category_id, p.category_id)
  LEFT JOIN ${PRODUCT_SUB_CATEGORIES_TABLE_NAME} psc ON psc.product_id = p.id
  LEFT JOIN sub_categorias rel_sc ON rel_sc.id = COALESCE(psc.sub_category_id, p.sub_category_id)
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

const PRODUCT_CATEGORIES_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS ${PRODUCT_CATEGORIES_TABLE_NAME} (
    product_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (product_id, category_id),
    KEY idx_produto_categorias_category_id (category_id),
    CONSTRAINT fk_produto_categorias_product
      FOREIGN KEY (product_id) REFERENCES ${PRODUCTS_TABLE_NAME}(id) ON DELETE CASCADE,
    CONSTRAINT fk_produto_categorias_category
      FOREIGN KEY (category_id) REFERENCES categorias(id) ON DELETE CASCADE
  )
`;

const PRODUCT_SUB_CATEGORIES_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS ${PRODUCT_SUB_CATEGORIES_TABLE_NAME} (
    product_id INT NOT NULL,
    sub_category_id INT NOT NULL,
    PRIMARY KEY (product_id, sub_category_id),
    KEY idx_produto_sub_categorias_sub_category_id (sub_category_id),
    CONSTRAINT fk_produto_sub_categorias_product
      FOREIGN KEY (product_id) REFERENCES ${PRODUCTS_TABLE_NAME}(id) ON DELETE CASCADE,
    CONSTRAINT fk_produto_sub_categorias_sub_category
      FOREIGN KEY (sub_category_id) REFERENCES sub_categorias(id) ON DELETE CASCADE
  )
`;

let productTablesReady = false;
let productTabsTableReady = false;
let productIndexesReady = false;

const renameTableIfNeeded = async (db, legacyTableName, tableName) => {
  try {
    await db.query(`RENAME TABLE ${legacyTableName} TO ${tableName}`);
  } catch {
    // Legacy table is absent or canonical table already exists.
  }
};

const ensureProductDatabaseTables = async (db) => {
  if (productTablesReady) {
    if (!productIndexesReady) {
      await ensureProductIndexes(db);
    }
    return;
  }

  await renameTableIfNeeded(db, LEGACY_PRODUCTS_TABLE_NAME, PRODUCTS_TABLE_NAME);
  await db.query(PRODUCT_CATEGORIES_TABLE_QUERY);
  await db.query(PRODUCT_SUB_CATEGORIES_TABLE_QUERY);
  await ensureProductIndexes(db);

  productTablesReady = true;
};

const addIndexIfNeeded = async (db, indexSql) => {
  try {
    await db.query(indexSql);
  } catch {
    // Index already exists or current MySQL variant rejected the duplicate add.
  }
};

const ensureProductIndexes = async (db) => {
  if (productIndexesReady) {
    return;
  }

  await addIndexIfNeeded(db, `ALTER TABLE ${PRODUCTS_TABLE_NAME} ADD INDEX idx_produtos_active_id (is_active, id)`);
  await addIndexIfNeeded(db, `ALTER TABLE ${PRODUCTS_TABLE_NAME} ADD INDEX idx_produtos_featured_active (is_featured, is_active)`);
  await addIndexIfNeeded(db, `ALTER TABLE ${PRODUCTS_TABLE_NAME} ADD INDEX idx_produtos_name (name)`);
  await addIndexIfNeeded(db, `ALTER TABLE ${PRODUCTS_TABLE_NAME} ADD INDEX idx_produtos_upcera_order (is_upcera, upcera_order)`);
  await addIndexIfNeeded(db, `ALTER TABLE ${PRODUCTS_TABLE_NAME} ADD INDEX idx_produtos_scanner_order (is_scanner, scanner_order)`);
  await addIndexIfNeeded(db, `ALTER TABLE ${PRODUCTS_TABLE_NAME} ADD INDEX idx_produtos_printer_order (is_3d_printer, printer_order)`);

  productIndexesReady = true;
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
  sku: sanitizeTextInput(row.sku || '', { preserveNewlines: false }),
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

const buildProductGroupByClause = () => ' GROUP BY p.id';

const buildPublicCompleteProductCondition = () => `
  p.main_image IS NOT NULL
  AND TRIM(p.main_image) <> ''
  AND p.description IS NOT NULL
  AND TRIM(p.description) <> ''
`;

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
    conditions.push(buildPublicCompleteProductCondition());
  }

  if (normalizedSearch) {
    const searchWildcard = `%${normalizedSearch}%`;

    conditions.push(`
      (
        LOWER(TRIM(p.name)) LIKE ?
        OR LOWER(TRIM(COALESCE(p.sku, ''))) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM categorias c
          LEFT JOIN ${PRODUCT_CATEGORIES_TABLE_NAME} search_pc
            ON search_pc.product_id = p.id AND search_pc.category_id = c.id
          WHERE (
              c.id = p.category_id
              OR search_pc.product_id IS NOT NULL
              OR c.id = (SELECT parent_sc.category_id FROM sub_categorias parent_sc WHERE parent_sc.id = p.sub_category_id LIMIT 1)
            )
            AND LOWER(TRIM(c.name)) LIKE ?
        )
        OR EXISTS (
          SELECT 1
          FROM sub_categorias sc
          LEFT JOIN ${PRODUCT_SUB_CATEGORIES_TABLE_NAME} search_psc
            ON search_psc.product_id = p.id AND search_psc.sub_category_id = sc.id
          WHERE (sc.id = p.sub_category_id OR search_psc.product_id IS NOT NULL)
            AND LOWER(TRIM(sc.name)) LIKE ?
        )
      )
    `);

    params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
  }

  if (filteredCategorySlugs.length > 0) {
    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM categorias c
          LEFT JOIN ${PRODUCT_CATEGORIES_TABLE_NAME} filter_pc
            ON filter_pc.product_id = p.id AND filter_pc.category_id = c.id
          WHERE (
              c.id = p.category_id
              OR filter_pc.product_id IS NOT NULL
              OR c.id = (SELECT parent_sc.category_id FROM sub_categorias parent_sc WHERE parent_sc.id = p.sub_category_id LIMIT 1)
            )
            AND c.slug IN (?)
        )
        OR EXISTS (
          SELECT 1
          FROM sub_categorias sc
          LEFT JOIN ${PRODUCT_SUB_CATEGORIES_TABLE_NAME} filter_psc
            ON filter_psc.product_id = p.id AND filter_psc.sub_category_id = sc.id
          WHERE (sc.id = p.sub_category_id OR filter_psc.product_id IS NOT NULL)
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
  const { includeInactive = false, includeTabs = false } = options;
  const whereClause = includeInactive ? '' : ` WHERE p.is_active = 1 AND ${buildPublicCompleteProductCondition()}`;
  const [rows] = await db.query(`${PRODUCT_SELECT_QUERY}${whereClause}${buildProductGroupByClause()} ORDER BY p.id DESC`);
  const products = rows.map(formatProductRow);
  return includeTabs ? attachTabsToProducts(db, products) : products;
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
    `${PRODUCT_SELECT_QUERY}${whereClause}${buildProductGroupByClause()}${orderClause} LIMIT ? OFFSET ?`,
    [...params, ...orderParams, limit, offset]
  );

  const items = rows.map(formatProductRow);

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
    `${PRODUCT_SELECT_QUERY} WHERE p.id = ?${includeInactive ? '' : ' AND p.is_active = 1'}${buildProductGroupByClause()}`,
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
  const validMainIds = Array.from(new Set(
    (Array.isArray(mainCategoryIds) ? mainCategoryIds : [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
  ));
  const validSubIds = Array.from(new Set(
    (Array.isArray(subCategoryIds) ? subCategoryIds : [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
  ));

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

  await connection.query(`DELETE FROM ${PRODUCT_CATEGORIES_TABLE_NAME} WHERE product_id = ?`, [productId]);
  await connection.query(`DELETE FROM ${PRODUCT_SUB_CATEGORIES_TABLE_NAME} WHERE product_id = ?`, [productId]);

  if (validMainIds.length > 0) {
    await connection.query(
      `INSERT IGNORE INTO ${PRODUCT_CATEGORIES_TABLE_NAME} (product_id, category_id) VALUES ?`,
      [validMainIds.map((id) => [productId, id])]
    );
  }

  if (validSubIds.length > 0) {
    await connection.query(
      `INSERT IGNORE INTO ${PRODUCT_SUB_CATEGORIES_TABLE_NAME} (product_id, sub_category_id) VALUES ?`,
      [validSubIds.map((id) => [productId, id])]
    );
  }
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
