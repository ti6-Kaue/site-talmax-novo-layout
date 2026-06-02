const fs = require('fs');
const path = require('path');
const { formatProductRow } = require('./productService');
const { normalizeStoredProductExtraData } = require('../validation/productSchemas');

const BACKUPS_DIR = path.resolve(__dirname, '../../../backups');

let cachedBackupFilePath = null;
let cachedBackupMtimeMs = null;
let cachedBackupData = null;

const getLatestBackupFilePath = () => {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return null;
  }

  const backupFiles = fs
    .readdirSync(BACKUPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('-summary.json'))
    .map((entry) => path.join(BACKUPS_DIR, entry.name));

  if (backupFiles.length === 0) {
    return null;
  }

  return backupFiles
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
};

const loadBackupData = () => {
  const backupFilePath = getLatestBackupFilePath();

  if (!backupFilePath) {
    return { tables: {} };
  }

  const { mtimeMs } = fs.statSync(backupFilePath);

  if (
    cachedBackupData &&
    cachedBackupFilePath === backupFilePath &&
    cachedBackupMtimeMs === mtimeMs
  ) {
    return cachedBackupData;
  }

  const parsedData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

  cachedBackupFilePath = backupFilePath;
  cachedBackupMtimeMs = mtimeMs;
  cachedBackupData = parsedData;

  return parsedData;
};

const getBackupTable = (tableName) => {
  const backupData = loadBackupData();
  const tables = backupData.tables || {};
  const rows = tables[tableName];

  return Array.isArray(rows) ? rows : [];
};

const normalizeExtraData = (value) => normalizeStoredProductExtraData(value);

const listBackupBanners = () => (
  getBackupTable('banners')
    .slice()
    .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0))
);

const listBackupCategories = () => {
  const mainCategories = getBackupTable('categorias').map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon_url: category.icon_url || null,
    background_url: category.background_url || null,
    display_order: Number(category.display_order || 0),
    is_visible: Number(category.is_visible ?? 1),
    parent_id: null
  }));

  const subCategories = getBackupTable('sub_categorias').map((subCategory) => ({
    id: subCategory.id,
    name: subCategory.name,
    slug: subCategory.slug,
    icon_url: null,
    background_url: null,
    display_order: Number(subCategory.display_order || 0),
    is_visible: Number(subCategory.is_visible ?? 1),
    parent_id: subCategory.category_id
  }));

  return [...mainCategories, ...subCategories].sort(
    (left, right) => Number(left.display_order || 0) - Number(right.display_order || 0)
  );
};

const listBackupHomeServices = () => (
  [
    {
      id: 'backup-mobywork',
      name: 'Moby Work',
      description: 'Conheça a linha de móveis e projetos planejados para clínicas e laboratórios.',
      image_url: '/img/mobywork.png',
      logo_url: '',
      logo_size: 72,
      link_url: 'https://mobywork.com.br',
      link_target_type: null,
      custom_page_id: null,
      custom_page_title: '',
      digital_group_id: null,
      digital_group_title: '',
      is_external: true,
      display_order: 1,
      active: true,
      actions: [{ label: 'Acessar Site', href: 'https://mobywork.com.br', external: true }]
    },
    {
      id: 'backup-talmax-digital',
      name: 'Talmax Digital',
      description: 'Explore nossas soluções digitais e tecnologias para fluxo CAD/CAM odontológico.',
      image_url: '/img/talmaxdigita1.png',
      logo_url: '',
      logo_size: 72,
      link_url: '/categoria/talmax-digital',
      link_target_type: null,
      custom_page_id: null,
      custom_page_title: '',
      digital_group_id: null,
      digital_group_title: '',
      is_external: false,
      display_order: 2,
      active: true,
      actions: [{ label: 'Ver Soluções', href: '/categoria/talmax-digital', external: false }]
    },
    {
      id: 'backup-cursos',
      name: 'Cursos',
      description: 'Acesse treinamentos, atualizações e conteúdos para evoluir com a Talmax.',
      image_url: '/img/cursostalmax.png',
      logo_url: '',
      logo_size: 72,
      link_url: '/cursos',
      link_target_type: null,
      custom_page_id: null,
      custom_page_title: '',
      digital_group_id: null,
      digital_group_title: '',
      is_external: false,
      display_order: 3,
      active: true,
      actions: [{ label: 'Ver Cursos', href: '/cursos', external: false }]
    },
    {
      id: 'backup-servicos',
      name: 'Serviços',
      description: 'Escolha o canal ideal para atendimento especializado e suporte da Talmax.',
      image_url: '/img/testeservicos.png',
      logo_url: '',
      logo_size: 72,
      link_url: '/suporte',
      link_target_type: null,
      custom_page_id: null,
      custom_page_title: '',
      digital_group_id: null,
      digital_group_title: '',
      is_external: false,
      display_order: 4,
      active: true,
      actions: [
        { label: 'Assistência Técnica', href: '/assistencia-tecnica', external: false },
        { label: 'Suporte', href: '/suporte', external: false }
      ]
    }
  ]
);

const buildProductLookups = () => {
  const categories = getBackupTable('categorias');
  const subCategories = getBackupTable('sub_categorias');
  const productCategories = getBackupTable('product_categorias');
  const productSubCategories = getBackupTable('product_sub_categorias');

  const categoryById = new Map(categories.map((category) => [Number(category.id), category]));
  const subCategoryById = new Map(subCategories.map((subCategory) => [Number(subCategory.id), subCategory]));
  const mainCategoryIdsByProductId = new Map();
  const subCategoryIdsByProductId = new Map();

  for (const relation of productCategories) {
    const productId = Number(relation.product_id);
    const categoryId = Number(relation.category_id);
    const existingIds = mainCategoryIdsByProductId.get(productId) || [];
    existingIds.push(categoryId);
    mainCategoryIdsByProductId.set(productId, existingIds);
  }

  for (const relation of productSubCategories) {
    const productId = Number(relation.product_id);
    const subCategoryId = Number(relation.sub_category_id);
    const existingIds = subCategoryIdsByProductId.get(productId) || [];
    existingIds.push(subCategoryId);
    subCategoryIdsByProductId.set(productId, existingIds);
  }

  return {
    categoryById,
    subCategoryById,
    mainCategoryIdsByProductId,
    subCategoryIdsByProductId
  };
};

const buildBackupProductRow = (product, lookups) => {
  const productId = Number(product.id);
  const extraData = normalizeExtraData(product.extra_data);
  const mainCategoryIds = lookups.mainCategoryIdsByProductId.get(productId) || [];
  const subCategoryIds = lookups.subCategoryIdsByProductId.get(productId) || [];
  const categoryNames = [
    ...mainCategoryIds
      .map((categoryId) => lookups.categoryById.get(categoryId)?.name)
      .filter(Boolean),
    ...subCategoryIds
      .map((subCategoryId) => lookups.subCategoryById.get(subCategoryId)?.name)
      .filter(Boolean)
  ];

  return formatProductRow({
    ...product,
    extra_data: extraData,
    product_tabs: Array.isArray(extraData.dynamicSections)
      ? extraData.dynamicSections.map((section, index) => ({
        id: -(index + 1),
        product_id: productId,
        title: section?.title || '',
        content: section?.content || '',
        content_as_list: Boolean(section?.contentAsList),
        display_order: index,
        is_active: true
      })).filter((section) => section.title && section.content)
      : [],
    category_names: categoryNames.join(', '),
    main_category_ids: mainCategoryIds.join(','),
    sub_category_ids: subCategoryIds.join(',')
  });
};

const listBackupProducts = (options = {}) => {
  const { includeInactive = false } = options;
  const products = getBackupTable('products');
  const lookups = buildProductLookups();

  return products
    .filter((product) => includeInactive || Number(product.is_active ?? 1) === 1)
    .slice()
    .sort((left, right) => Number(right.id) - Number(left.id))
    .map((product) => buildBackupProductRow(product, lookups));
};

const findBackupProductById = (productId, options = {}) => {
  const { includeInactive = false } = options;
  const normalizedId = Number(productId);
  const product = getBackupTable('products').find((item) => (
    Number(item.id) === normalizedId && (includeInactive || Number(item.is_active ?? 1) === 1)
  ));

  if (!product) {
    return null;
  }

  return buildBackupProductRow(product, buildProductLookups());
};

module.exports = {
  listBackupBanners,
  listBackupCategories,
  listBackupHomeServices,
  listBackupProducts,
  findBackupProductById
};
