const { z } = require('zod');
const {
  assetReferenceField,
  booleanLike,
  integerLike,
  parseJsonField,
  stringField,
  validateWithSchema
} = require('./requestValidation');
const { sanitizeTextInput } = require('../utils/inputSanitization');

const VALID_SPECIAL_SECTION_MODES = ['description', 'features', 'none'];

const sanitizeTextValue = (value, options = {}) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return sanitizeTextInput(value, {
      preserveNewlines: Boolean(options.preserveNewlines)
    });
  }

  return value;
};

const textValueSchema = (label, maxLength, options = {}) => z.preprocess(
  (value) => sanitizeTextValue(value, options),
  z.string({
    invalid_type_error: `${label} precisa ser um texto.`
  }).max(maxLength, `${label} deve ter no maximo ${maxLength} caracteres.`)
);

const optionalTextValueSchema = (label, maxLength, options = {}) => z.preprocess((value) => (
  sanitizeTextValue(value, options)
), z.string({
  invalid_type_error: `${label} precisa ser um texto.`
}).max(maxLength, `${label} deve ter no maximo ${maxLength} caracteres.`));

const idListSchema = (fieldLabel, options = {}) => {
  const { minItems = 0 } = options;

  return z.array(
    integerLike(fieldLabel, { min: 1 })
  )
    .min(minItems, minItems > 0 ? 'Selecione pelo menos uma categoria principal.' : `${fieldLabel} precisa ter itens validos.`)
    .max(100, `${fieldLabel} deve ter no maximo 100 itens.`)
    .transform((items) => Array.from(new Set(items)));
};

const imagePathSchema = assetReferenceField('Cada imagem', { minLength: 1, maxLength: 1000 });
const imagePathListSchema = z.array(imagePathSchema)
  .max(50, 'extra_data.images deve ter no maximo 50 itens.')
  .transform((items) => Array.from(new Set(items)));
const optionalImagePathSchema = assetReferenceField('A imagem do banner do produto', { maxLength: 1000 }).optional().default('');

const productFeatureSchema = optionalTextValueSchema('Cada destaque', 500);
const productFeaturesSchema = z.array(productFeatureSchema)
  .max(50, 'extra_data.features deve ter no maximo 50 itens.')
  .transform((items) => items.filter(Boolean));

const techSpecSchema = z.object({
  label: optionalTextValueSchema('O rótulo da especificação técnica', 160).default(''),
  value: optionalTextValueSchema('O valor da especificação técnica', 2000).default('')
}).strict().transform((item) => ({
  label: item.label,
  value: item.value
}));

const techSpecsSchema = z.array(techSpecSchema)
  .max(50, 'extra_data.techSpecs deve ter no máximo 50 itens.')
  .transform((items) => items.filter((item) => item.label || item.value));

const productTabSchema = z.object({
  id: z.union([
    integerLike('O id da aba', { min: 1 }),
    textValueSchema('O id da aba', 120)
  ]).optional(),
  title: stringField('O título da aba', { minLength: 1, maxLength: 255 }),
  content: stringField('O conteúdo da aba', { minLength: 0, maxLength: 25000, preserveNewlines: true, optional: true }),
  contentAsList: booleanLike('O indicador contentAsList', { optional: true }),
  content_as_list: booleanLike('O indicador content_as_list', { optional: true }),
  showContentWithVideo: booleanLike('O indicador showContentWithVideo', { optional: true }),
  show_content_with_video: booleanLike('O indicador show_content_with_video', { optional: true }),
  videoUrl: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(2048)).optional(),
  video_url: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(2048)).optional()
}).transform((tab) => ({
  id: tab.id,
  title: tab.title,
  content: tab.content || '',
  contentAsList: Boolean(tab.contentAsList ?? tab.content_as_list ?? false),
  showContentWithVideo: tab.showContentWithVideo ?? tab.show_content_with_video ?? true,
  videoUrl: (tab.videoUrl || tab.video_url || '').trim()
}));

const productTabsSchema = z.array(productTabSchema)
  .max(20, 'extra_data.product_tabs deve ter no maximo 20 itens.');

const mergeRangeSchema = z.object({
  startRow: integerLike('mergeRanges.startRow', { min: 0 }),
  endRow: integerLike('mergeRanges.endRow', { min: 0 }),
  startCol: integerLike('mergeRanges.startCol', { min: 0 }),
  endCol: integerLike('mergeRanges.endCol', { min: 0 })
}).strict().superRefine((range, ctx) => {
  if (range.endRow < range.startRow) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'mergeRanges.endRow não pode ser menor que mergeRanges.startRow.',
      path: ['endRow']
    });
  }

  if (range.endCol < range.startCol) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'mergeRanges.endCol não pode ser menor que mergeRanges.startCol.',
      path: ['endCol']
    });
  }
});

const modelTableSchema = z.object({
  headers: z.array(optionalTextValueSchema('Cada cabeçalho da tabela', 200))
    .min(1, 'A tabela técnica precisa ter pelo menos uma coluna.')
    .max(20, 'A tabela técnica pode ter no máximo 20 colunas.'),
  rows: z.array(
    z.array(optionalTextValueSchema('Cada célula da tabela', 4000))
  ).max(50, 'A tabela técnica pode ter no máximo 50 linhas.'),
  mergeRanges: z.array(mergeRangeSchema)
    .max(100, 'A tabela técnica pode ter no máximo 100 mesclas.')
    .optional()
    .default([]),
  mergedHeader: booleanLike('mergedHeader', { optional: true }).optional(),
  mergedHeaderEndColumn: integerLike('mergedHeaderEndColumn', { min: 0, optional: true }).optional()
}).strict().superRefine((table, ctx) => {
  const columnCount = table.headers.length;
  const rowCount = table.rows.length;

  table.rows.forEach((row, rowIndex) => {
    if (row.length !== columnCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cada linha da tabela técnica precisa ter a mesma quantidade de colunas do cabeçalho.',
        path: ['rows', rowIndex]
      });
    }
  });

  table.mergeRanges.forEach((range, rangeIndex) => {
    if (range.startCol >= columnCount || range.endCol >= columnCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Uma mescla da tabela técnica referencia uma coluna inexistente.',
        path: ['mergeRanges', rangeIndex]
      });
    }

    if (range.startRow > rowCount || range.endRow > rowCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Uma mescla da tabela técnica referencia uma linha inexistente.',
        path: ['mergeRanges', rangeIndex]
      });
    }
  });
});

const modelTableConfigSchema = z.object({
  title: optionalTextValueSchema('O título da tabela técnica', 255).default(''),
  modelTable: modelTableSchema
}).strict();

const modelTablesSchema = z.array(modelTableConfigSchema)
  .max(10, 'extra_data.modelTables deve ter no máximo 10 tabelas.');

const specialSectionDisplaySchema = z.object({
  upcera: z.enum(VALID_SPECIAL_SECTION_MODES).optional(),
  scanners: z.enum(VALID_SPECIAL_SECTION_MODES).optional(),
  printers: z.enum(VALID_SPECIAL_SECTION_MODES).optional()
}).strict();

const productExtraDataInputSchema = z.object({
  descriptionTabLabel: optionalTextValueSchema('extra_data.descriptionTabLabel', 120).default(''),
  descriptionAsList: booleanLike('extra_data.descriptionAsList', { optional: true }).optional(),
  technicalTabLabel: optionalTextValueSchema('extra_data.technicalTabLabel', 120).default(''),
  product_tabs: productTabsSchema.optional().default([]),
  dynamicSections: productTabsSchema.optional(),
  showFeatures: booleanLike('extra_data.showFeatures', { optional: true }).optional(),
  hideModelData: booleanLike('extra_data.hideModelData', { optional: true }).optional(),
  showModelSection: booleanLike('extra_data.showModelSection', { optional: true }).optional(),
  showQuoteButton: booleanLike('extra_data.showQuoteButton', { optional: true }).optional(),
  features: productFeaturesSchema.optional().default([]),
  techSpecs: techSpecsSchema.optional().default([]),
  modelTables: modelTablesSchema.optional().default([]),
  modelTitle: optionalTextValueSchema('extra_data.modelTitle', 255).default(''),
  modelTable: modelTableSchema.nullable().optional(),
  productBannerUrl: optionalImagePathSchema,
  images: imagePathListSchema.optional().default([]),
  removedImages: imagePathListSchema.optional().default([]),
  specialSectionDisplay: specialSectionDisplaySchema.optional(),
  featured_order: integerLike('extra_data.featured_order', { min: 0, optional: true }).optional()
}).strict();

const productWritePayloadSchema = z.object({
  name: stringField('O nome do produto', { minLength: 1, maxLength: 255 }),
  description: optionalTextValueSchema('A descricao do produto', 50000, { preserveNewlines: true }).default(''),
  category_ids: idListSchema('Cada categoria principal', { minItems: 1 }),
  sub_category_ids: idListSchema('Cada subcategoria').optional().default([]),
  primary_image_index: integerLike('primary_image_index', { min: 0, optional: true }).optional(),
  is_active: booleanLike('is_active', { optional: true }).optional(),
  extra_data: productExtraDataInputSchema
}).strict();

const quoteButtonPayloadSchema = z.object({
  showQuoteButton: booleanLike('showQuoteButton')
}).strict();

const selectedSpecialProductSchema = z.object({
  id: integerLike('selected_products.id', { min: 1 }),
  order: integerLike('selected_products.order', { min: 0, optional: true }).optional(),
  displayMode: z.enum(VALID_SPECIAL_SECTION_MODES).optional().default('features')
}).strict();

const specialSectionPayloadSchema = z.object({
  selected_products: z.array(selectedSpecialProductSchema)
    .max(100, 'selected_products deve ter no máximo 100 itens.')
    .superRefine((items, ctx) => {
      const seenIds = new Set();

      items.forEach((item, index) => {
        if (seenIds.has(item.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'selected_products não pode conter ids duplicados.',
            path: [index, 'id']
          });
        }

        seenIds.add(item.id);
      });
    })
}).strict();

const hasMeaningfulModelTable = (modelTable) => {
  if (!modelTable || !Array.isArray(modelTable.headers) || !Array.isArray(modelTable.rows)) {
    return false;
  }

  if (modelTable.headers.some((header) => header.trim() !== '')) {
    return true;
  }

  return modelTable.rows.some((row) => (
    Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== '')
  ));
};

const buildLegacyModelTableFromModels = (legacyModels, legacyHeaders = []) => {
  if (!Array.isArray(legacyModels) || legacyModels.length === 0) {
    return null;
  }

  const headers = Array.isArray(legacyHeaders) && legacyHeaders.length > 0
    ? legacyHeaders
      .map((header) => sanitizeTextInput(header, { preserveNewlines: false }))
      .filter(Boolean)
    : ['Tipo / Referencia', 'Codigo'];
  const rows = legacyModels
    .map((model) => {
      if (Array.isArray(model)) {
        const normalizedRow = headers.map((_, index) => (
          sanitizeTextInput(model[index] || '', { preserveNewlines: false })
        ));

        return normalizedRow.some(Boolean) ? normalizedRow : null;
      }

      if (model && typeof model === 'object') {
        const normalizedRow = [
          sanitizeTextInput(model.type || model.label || '', { preserveNewlines: false }),
          sanitizeTextInput(model.code || model.value || '', { preserveNewlines: false })
        ];

        return normalizedRow.some(Boolean) ? normalizedRow : null;
      }

      const normalizedValue = sanitizeTextInput(model || '', { preserveNewlines: false });
      return normalizedValue ? [normalizedValue, ''] : null;
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return null;
  }

  const parsedLegacyTable = modelTableSchema.safeParse({
    headers,
    rows,
    mergeRanges: []
  });

  return parsedLegacyTable.success ? parsedLegacyTable.data : null;
};

const normalizeModelTableConfigList = (modelTables = [], legacyTitle = '', legacyTable = null) => {
  let sourceTables = Array.isArray(modelTables) ? modelTables : [];

  if (sourceTables.length === 0 && legacyTable) {
    const parsedLegacyTable = modelTableSchema.safeParse(legacyTable);

    if (parsedLegacyTable.success) {
      sourceTables = [{
        title: typeof legacyTitle === 'string' ? legacyTitle.trim() : '',
        modelTable: parsedLegacyTable.data
      }];
    }
  }

  return sourceTables.filter((item) => hasMeaningfulModelTable(item?.modelTable));
};

const normalizeProductExtraDataForStorage = (input = {}) => {
  const productTabs = input.product_tabs?.length
    ? input.product_tabs
    : Array.isArray(input.dynamicSections)
      ? input.dynamicSections
      : [];
  const features = Array.isArray(input.features) ? input.features.filter(Boolean) : [];
  const techSpecs = Array.isArray(input.techSpecs) ? input.techSpecs.filter((item) => item.label || item.value) : [];
  const modelTables = normalizeModelTableConfigList(input.modelTables, input.modelTitle, input.modelTable);
  const firstModelTable = modelTables[0] || null;
  const output = {
    descriptionTabLabel: input.descriptionTabLabel || '',
    descriptionAsList: Boolean(input.descriptionAsList),
    technicalTabLabel: input.technicalTabLabel || '',
    product_tabs: productTabs,
    showFeatures: Boolean(input.showFeatures) && features.length > 0,
    hideModelData: Boolean(input.hideModelData),
    showModelSection: input.showModelSection !== false,
    showQuoteButton: input.showQuoteButton !== false,
    features: Boolean(input.showFeatures) ? features : [],
    techSpecs,
    modelTables,
    productBannerUrl: input.productBannerUrl || '',
    images: Array.isArray(input.images) ? Array.from(new Set(input.images)) : []
  };

  if (firstModelTable) {
    output.modelTitle = firstModelTable.title || '';
    output.modelTable = firstModelTable.modelTable;
  }

  if (input.specialSectionDisplay && Object.keys(input.specialSectionDisplay).length > 0) {
    output.specialSectionDisplay = input.specialSectionDisplay;
  }

  if (Number.isInteger(input.featured_order)) {
    output.featured_order = input.featured_order;
  }

  return output;
};

const normalizeStoredProductExtraData = (value) => {
  if (!value) {
    return {};
  }

  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const normalized = { ...parsed };
  const safeText = (schema, currentValue, fallback = '') => {
    const result = schema.safeParse(currentValue);
    return result.success ? result.data : fallback;
  };
  const safeBoolean = (currentValue, fallback) => {
    const result = booleanLike('valor booleano').safeParse(currentValue);
    return result.success ? result.data : fallback;
  };
  const safeArray = (schema, currentValue, fallback = []) => {
    const result = schema.safeParse(currentValue);
    return result.success ? result.data : fallback;
  };
  const safeNumber = (currentValue) => {
    const result = integerLike('valor inteiro', { min: 0, optional: true }).safeParse(currentValue);
    return result.success ? result.data : undefined;
  };

  delete normalized.descriptionTabLabel;
  delete normalized.descriptionAsList;
  delete normalized.technicalTabLabel;
  delete normalized.product_tabs;
  delete normalized.showFeatures;
  delete normalized.hideModelData;
  delete normalized.showModelSection;
  delete normalized.showQuoteButton;
  delete normalized.features;
  delete normalized.techSpecs;
  delete normalized.modelTables;
  delete normalized.modelTitle;
  delete normalized.modelTable;
  delete normalized.productBannerUrl;
  delete normalized.images;
  delete normalized.removedImages;
  delete normalized.specialSectionDisplay;
  delete normalized.featured_order;

  const productTabs = safeArray(productTabsSchema, parsed.product_tabs, []);
  const legacyProductTabs = safeArray(productTabsSchema, parsed.dynamicSections, []);
  const features = safeArray(productFeaturesSchema, parsed.features, []);
  const techSpecs = safeArray(techSpecsSchema, parsed.techSpecs, []);
  const modelTables = safeArray(modelTablesSchema, parsed.modelTables, []);
  const legacyModelTable = modelTableSchema.safeParse(parsed.modelTable);
  const legacyModelTableFromModels = buildLegacyModelTableFromModels(parsed.models, parsed.modelHeaders);
  const normalizedModelTables = normalizeModelTableConfigList(
    modelTables,
    safeText(optionalTextValueSchema('extra_data.modelTitle', 255), parsed.modelTitle, ''),
    legacyModelTable.success ? legacyModelTable.data : legacyModelTableFromModels
  );
  const firstModelTable = normalizedModelTables[0] || null;

  normalized.descriptionTabLabel = safeText(optionalTextValueSchema('extra_data.descriptionTabLabel', 120), parsed.descriptionTabLabel, '');
  normalized.descriptionAsList = safeBoolean(parsed.descriptionAsList, false);
  normalized.technicalTabLabel = safeText(optionalTextValueSchema('extra_data.technicalTabLabel', 120), parsed.technicalTabLabel, '');
  normalized.product_tabs = productTabs.length > 0 ? productTabs : legacyProductTabs;
  normalized.showFeatures = safeBoolean(parsed.showFeatures, features.length > 0);
  normalized.hideModelData = safeBoolean(parsed.hideModelData, false);
  normalized.showModelSection = safeBoolean(parsed.showModelSection, true);
  normalized.showQuoteButton = safeBoolean(parsed.showQuoteButton, true);
  normalized.features = features;
  normalized.techSpecs = techSpecs;
  normalized.modelTables = normalizedModelTables;
  normalized.productBannerUrl = safeText(optionalImagePathSchema, parsed.productBannerUrl, '');
  normalized.images = safeArray(imagePathListSchema, parsed.images, []);

  if (firstModelTable) {
    normalized.modelTitle = firstModelTable.title || '';
    normalized.modelTable = firstModelTable.modelTable;
  }

  const specialSectionDisplay = specialSectionDisplaySchema.safeParse(parsed.specialSectionDisplay);
  if (specialSectionDisplay.success && Object.keys(specialSectionDisplay.data).length > 0) {
    normalized.specialSectionDisplay = specialSectionDisplay.data;
  }

  const featuredOrder = safeNumber(parsed.featured_order);
  if (Number.isInteger(featuredOrder)) {
    normalized.featured_order = featuredOrder;
  }

  return normalized;
};

const validateProductWritePayload = (payload) => validateWithSchema(productWritePayloadSchema, payload);
const validateQuoteButtonPayload = (payload) => validateWithSchema(quoteButtonPayloadSchema, payload);
const validateSpecialSectionPayload = (payload) => validateWithSchema(specialSectionPayloadSchema, payload);
const parseProductWriteRequest = (body = {}) => validateProductWritePayload({
  name: body.name,
  description: body.description,
  category_ids: parseJsonField(body.category_ids, idListSchema('Cada categoria principal', { minItems: 1 }), 'category_ids'),
  sub_category_ids: parseJsonField(body.sub_category_ids, idListSchema('Cada subcategoria').default([]), 'sub_category_ids'),
  primary_image_index: body.primary_image_index,
  is_active: body.is_active,
  extra_data: parseJsonField(body.extra_data, productExtraDataInputSchema.default({}), 'extra_data')
});

module.exports = {
  normalizeProductExtraDataForStorage,
  normalizeStoredProductExtraData,
  parseProductWriteRequest,
  validateProductWritePayload,
  validateQuoteButtonPayload,
  validateSpecialSectionPayload
};
