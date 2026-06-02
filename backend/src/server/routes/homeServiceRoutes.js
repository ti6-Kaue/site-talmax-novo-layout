/**
 * Define as rotas para gerenciar os quadros (servicos/segmentos) da Home.
 */
const express = require('express');
const db = require('../../config/database');
const {
  getAuthenticatedAdminSession,
  requireAdminSession
} = require('../auth/adminSession');
const upload = require('../config/upload');
const { safe } = require('../utils/common');
const { parseBooleanFlag, parseInteger } = require('../utils/requestParsers');
const { persistUploadedFile } = require('../services/fileStorageService');
const { listBackupHomeServices } = require('../services/backupContentService');
const { sanitizeServedImageUrl } = require('../config/imageStorage');
const { wrapError } = require('../utils/errorHandling');
const {
  sanitizeAssetReference,
  sanitizeNavigationTarget,
  sanitizeTextInput
} = require('../utils/inputSanitization');
const logger = require('../utils/logger');

const router = express.Router();
let homeServicesColumnsReady = false;
let cachedHomeServicesSchemaState = null;

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

const getHomeServicesSchemaState = async () => {
  await ensureHomeServicesColumns();

  if (cachedHomeServicesSchemaState) {
    return cachedHomeServicesSchemaState;
  }

  const columns = await getTableColumnSet('home_services');

  cachedHomeServicesSchemaState = {
    hasLogoUrl: columns.has('logo_url'),
    hasLinkTargetType: columns.has('link_target_type'),
    hasCustomPageId: columns.has('custom_page_id'),
    hasDigitalGroupId: columns.has('digital_group_id'),
    hasActions: columns.has('actions'),
    hasLogoSize: columns.has('logo_size')
  };

  return cachedHomeServicesSchemaState;
};

const ensureColumn = async (tableName, columnName, definition) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  if (Number(rows?.[0]?.total || 0) === 0) {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    cachedHomeServicesSchemaState = null;
  }
};

const ensureHomeServicesColumns = async () => {
  if (homeServicesColumnsReady) return;
  await ensureColumn('home_services', 'logo_url', 'VARCHAR(255) DEFAULT NULL AFTER image_url');
  await ensureColumn('home_services', 'link_target_type', "VARCHAR(40) DEFAULT NULL AFTER link_url");
  await ensureColumn('home_services', 'custom_page_id', 'INT DEFAULT NULL AFTER link_target_type');
  await ensureColumn('home_services', 'digital_group_id', 'INT DEFAULT NULL AFTER custom_page_id');
  try {
    await ensureColumn('home_services', 'logo_size', 'INT DEFAULT 72 AFTER logo_url');
  } catch (err) {
    logger.warn({ err }, 'Não foi possível garantir a coluna logo_size em home_services; salvando segmentos sem esse campo.');
  }
  cachedHomeServicesSchemaState = null;
  homeServicesColumnsReady = true;
};

const buildCustomPagePath = (slug = '') => (slug ? `/pagina/${slug}` : '');
const buildDigitalGroupPath = (slugOrId = '') => (slugOrId ? `/grupo-digital/${String(slugOrId).replace(/^\/+/, '')}` : '');
const VALID_LINK_TARGET_TYPES = new Set(['custom-page', 'digital-group']);

const isExternalNavigationTarget = (value = '') => /^(?:https?:|mailto:|tel:)/i.test(String(value || '').trim());

const normalizeLinkTargetType = (value) => {
  const normalizedValue = sanitizeTextInput(value || '', { preserveNewlines: false }).toLowerCase();
  return VALID_LINK_TARGET_TYPES.has(normalizedValue) ? normalizedValue : null;
};

const normalizeLogoSize = (value) => {
  const parsedValue = parseInteger(value, 72);
  return Math.min(Math.max(parsedValue, 30), 95);
};

const buildHomeServiceInsertPayload = (values, schemaState) => {
  const columns = [
    'name',
    'description',
    'image_url',
    'logo_url',
    'link_url',
    'link_target_type',
    'custom_page_id',
    'digital_group_id',
    'is_external',
    'display_order',
    'active',
    'actions'
  ];
  const params = [
    values.name,
    values.description,
    values.image_url,
    values.logo_url,
    values.link_url,
    values.link_target_type,
    values.custom_page_id,
    values.digital_group_id,
    values.is_external,
    values.display_order,
    values.active,
    values.actions
  ];

  if (schemaState.hasLogoSize) {
    columns.splice(4, 0, 'logo_size');
    params.splice(4, 0, values.logo_size);
  }

  return {
    query: `INSERT INTO home_services (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    params
  };
};

const buildHomeServiceUpdatePayload = (values, schemaState) => {
  const fields = [
    'name = ?',
    'description = ?',
    'image_url = ?',
    'logo_url = ?',
    'link_url = ?',
    'link_target_type = ?',
    'custom_page_id = ?',
    'digital_group_id = ?',
    'is_external = ?',
    'display_order = ?',
    'active = ?',
    'actions = ?'
  ];
  const params = [
    values.name,
    values.description,
    values.image_url,
    values.logo_url,
    values.link_url,
    values.link_target_type,
    values.custom_page_id,
    values.digital_group_id,
    values.is_external,
    values.display_order,
    values.active,
    values.actions
  ];

  if (schemaState.hasLogoSize) {
    fields.splice(4, 0, 'logo_size = ?');
    params.splice(4, 0, values.logo_size);
  }

  params.push(values.id);

  return {
    query: `UPDATE home_services SET ${fields.join(', ')} WHERE id = ?`,
    params
  };
};

const parseActionsPayload = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  }

  return value;
};

const normalizeActionButtons = (items = []) => (
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const label = sanitizeTextInput(item?.label || item?.title || '', { preserveNewlines: false });
      const href = sanitizeNavigationTarget(item?.href || item?.link_url || '', {
        allowExternal: true,
        allowRelative: true
      });

      if (!label && !href) {
        return null;
      }

      return {
        label,
        href,
        external: Boolean(item?.external) || isExternalNavigationTarget(href)
      };
    })
    .filter(Boolean)
);

const normalizeActionCard = (card, index = 0) => {
  const id = sanitizeTextInput(card?.id || `card-${index}`, { preserveNewlines: false, maxLength: 120 });

  if (!id) {
    return null;
  }

  const linkUrl = sanitizeNavigationTarget(card?.link_url || '', {
    allowExternal: true,
    allowRelative: true
  });

  return {
    id,
    title: sanitizeTextInput(card?.title || '', { preserveNewlines: false }),
    description: sanitizeTextInput(card?.description || '', { preserveNewlines: true }),
    link_url: linkUrl,
    is_external: Boolean(card?.is_external) || isExternalNavigationTarget(linkUrl),
    front_image_url: sanitizeAssetReference(card?.front_image_url || ''),
    back_image_url: sanitizeAssetReference(card?.back_image_url || '')
  };
};

const normalizeActionGroups = (groups = []) => (
  (Array.isArray(groups) ? groups : [])
    .map((group, index) => {
      const id = sanitizeTextInput(group?.id || `group-${index}`, { preserveNewlines: false, maxLength: 120 });
      const cards = (Array.isArray(group?.cards) ? group.cards : [])
        .map((card, cardIndex) => normalizeActionCard(card, cardIndex))
        .filter(Boolean);

      if (!id && cards.length === 0) {
        return null;
      }

      return {
        id,
        title: sanitizeTextInput(group?.title || '', { preserveNewlines: false }),
        description: sanitizeTextInput(group?.description || '', { preserveNewlines: true }),
        cards
      };
    })
    .filter(Boolean)
);

const normalizeActionsPayload = (value) => {
  const parsedValue = parseActionsPayload(value);

  if (Array.isArray(parsedValue)) {
    const buttons = normalizeActionButtons(parsedValue);

    return buttons.length > 0
      ? { buttons, actions: buttons }
      : [];
  }

  if (!parsedValue || typeof parsedValue !== 'object') {
    return [];
  }

  const buttons = normalizeActionButtons(
    Array.isArray(parsedValue.buttons) ? parsedValue.buttons : parsedValue.actions
  );
  const digitalCards = (Array.isArray(parsedValue.digital_cards) ? parsedValue.digital_cards : [])
    .map((card, index) => normalizeActionCard(card, index))
    .filter(Boolean);
  const digitalGroups = normalizeActionGroups(parsedValue.digital_groups);
  const normalizedPayload = {};

  if (buttons.length > 0) {
    normalizedPayload.buttons = buttons;
    normalizedPayload.actions = buttons;
  }

  if (digitalCards.length > 0) {
    normalizedPayload.digital_cards = digitalCards;
  }

  if (digitalGroups.length > 0) {
    normalizedPayload.digital_groups = digitalGroups;
  }

  return Object.keys(normalizedPayload).length > 0 ? normalizedPayload : [];
};

const buildHomeServicesQuery = (schemaState) => {
  const linkTargetTypeSelect = schemaState.hasLinkTargetType
    ? 'home_services.link_target_type'
    : 'NULL AS link_target_type';
  const customPageIdSelect = schemaState.hasCustomPageId
    ? 'home_services.custom_page_id'
    : 'NULL AS custom_page_id';
  const digitalGroupIdSelect = schemaState.hasDigitalGroupId
    ? 'home_services.digital_group_id'
    : 'NULL AS digital_group_id';
  const actionsSelect = schemaState.hasActions
    ? 'home_services.actions'
    : 'NULL AS actions';
  const logoUrlSelect = schemaState.hasLogoUrl
    ? 'home_services.logo_url'
    : 'NULL AS logo_url';
  const logoSizeSelect = schemaState.hasLogoSize
    ? 'home_services.logo_size'
    : '72 AS logo_size';
  const customPageTitleSelect = schemaState.hasCustomPageId
    ? 'custom_pages.title AS custom_page_title'
    : "'' AS custom_page_title";
  const customPageSlugSelect = schemaState.hasCustomPageId
    ? 'custom_pages.slug AS custom_page_slug'
    : "'' AS custom_page_slug";
  const digitalGroupTitleSelect = schemaState.hasDigitalGroupId
    ? 'digital_groups.title AS digital_group_title'
    : "'' AS digital_group_title";
  const digitalGroupSlugSelect = schemaState.hasDigitalGroupId
    ? 'digital_groups.slug AS digital_group_slug'
    : "'' AS digital_group_slug";
  const customPageJoin = schemaState.hasCustomPageId
    ? 'LEFT JOIN custom_pages ON custom_pages.id = home_services.custom_page_id'
    : '';
  const digitalGroupJoin = schemaState.hasDigitalGroupId
    ? 'LEFT JOIN digital_groups ON digital_groups.id = home_services.digital_group_id'
    : '';

  return `
    SELECT
      home_services.id,
      home_services.name,
      home_services.description,
      home_services.image_url,
      ${logoUrlSelect},
      ${logoSizeSelect},
      home_services.link_url,
      home_services.is_external,
      home_services.display_order,
      home_services.active,
      ${actionsSelect},
      ${linkTargetTypeSelect},
      ${customPageIdSelect},
      ${digitalGroupIdSelect},
      ${customPageTitleSelect},
      ${customPageSlugSelect},
      ${digitalGroupTitleSelect},
      ${digitalGroupSlugSelect}
    FROM home_services
    ${customPageJoin}
    ${digitalGroupJoin}
    ORDER BY home_services.display_order ASC, home_services.name ASC
  `;
};

const normalizeHomeServiceRow = (row) => ({
  ...row,
  name: sanitizeTextInput(row.name || '', { preserveNewlines: false }),
  description: sanitizeTextInput(row.description || '', { preserveNewlines: true }),
  image_url: sanitizeAssetReference(sanitizeServedImageUrl(row.image_url) || ''),
  logo_url: sanitizeAssetReference(sanitizeServedImageUrl(row.logo_url) || ''),
  logo_size: normalizeLogoSize(row.logo_size),
  link_target_type: row.link_target_type || null,
  custom_page_id: row.custom_page_id ? Number(row.custom_page_id) : null,
  custom_page_title: sanitizeTextInput(row.custom_page_title || '', { preserveNewlines: false }),
  digital_group_id: row.digital_group_id ? Number(row.digital_group_id) : null,
  digital_group_title: sanitizeTextInput(row.digital_group_title || '', { preserveNewlines: false }),
  link_url:
    row.link_target_type === 'custom-page' && row.custom_page_slug
      ? buildCustomPagePath(row.custom_page_slug)
      : row.link_target_type === 'digital-group' && (row.digital_group_slug || row.digital_group_id)
        ? buildDigitalGroupPath(row.digital_group_slug || row.digital_group_id)
        : sanitizeNavigationTarget(row.link_url || ''),
  actions: normalizeActionsPayload(row.actions),
  is_external: !!row.is_external,
  active: !!row.active
});

const getUploadedFileByField = (files = [], fieldName) => (
  Array.isArray(files) ? files.find((file) => file.fieldname === fieldName) || null : null
);

const persistCardAssets = async (files, card, { frontFieldPrefix, backFieldPrefix }) => {
  const cardId = String(card?.id || '').trim();

  if (!cardId) {
    return null;
  }

  const frontImageFile = getUploadedFileByField(files, `${frontFieldPrefix}${cardId}`);
  const backImageFile = getUploadedFileByField(files, `${backFieldPrefix}${cardId}`);

  const front_image_url = frontImageFile
    ? await persistUploadedFile(frontImageFile, { resourceType: 'talmax-digital' })
    : sanitizeAssetReference(card.front_image_url || '');

  const back_image_url = backImageFile
    ? await persistUploadedFile(backImageFile, { resourceType: 'talmax-digital' })
    : sanitizeAssetReference(card.back_image_url || '');

  const linkUrl = sanitizeNavigationTarget(card.link_url || '', {
    allowExternal: true,
    allowRelative: true
  });

  return {
    id: cardId,
    title: sanitizeTextInput(card.title || '', { preserveNewlines: false }),
    description: sanitizeTextInput(card.description || '', { preserveNewlines: true }),
    link_url: linkUrl,
    is_external: (parseBooleanFlag(card.is_external) || isExternalNavigationTarget(linkUrl)) ? 1 : 0,
    front_image_url,
    back_image_url
  };
};

const persistDigitalCardsConfig = async (files, incomingActions, previousActions = {}) => {
  const currentActions = normalizeActionsPayload(incomingActions);
  const normalizedPreviousActions = normalizeActionsPayload(previousActions);

  const baseGroups = Array.isArray(currentActions.digital_groups)
    ? currentActions.digital_groups
    : Array.isArray(normalizedPreviousActions.digital_groups)
      ? normalizedPreviousActions.digital_groups
      : [];

  if (baseGroups.length > 0) {
    const digitalGroups = [];

    for (const group of baseGroups) {
      const groupId = String(group?.id || '').trim();

      if (!groupId) {
        continue;
      }

      const cards = [];
      const baseCards = Array.isArray(group?.cards) ? group.cards : [];

      for (const card of baseCards) {
        const normalizedCard = await persistCardAssets(files, card, {
          frontFieldPrefix: 'digital_group_card_front_',
          backFieldPrefix: 'digital_group_card_back_'
        });

        if (normalizedCard) {
          cards.push(normalizedCard);
        }
      }

      digitalGroups.push({
        id: groupId,
        title: sanitizeTextInput(group.title || '', { preserveNewlines: false }),
        description: sanitizeTextInput(group.description || '', { preserveNewlines: true }),
        cards
      });
    }

    return {
      ...currentActions,
      digital_groups: digitalGroups
    };
  }

  const baseCards = Array.isArray(currentActions.digital_cards)
    ? currentActions.digital_cards
    : Array.isArray(normalizedPreviousActions.digital_cards)
      ? normalizedPreviousActions.digital_cards
      : [];

  if (baseCards.length === 0) {
    return currentActions;
  }

  const digitalCards = [];

  for (const card of baseCards) {
    const cardId = String(card?.id || '').trim();

    if (!cardId) {
      continue;
    }

    const normalizedCard = await persistCardAssets(files, card, {
      frontFieldPrefix: 'digital_card_front_',
      backFieldPrefix: 'digital_card_back_'
    });

    if (normalizedCard) {
      digitalCards.push(normalizedCard);
    }
  }

  return {
    ...currentActions,
    digital_cards: digitalCards
  };
};

const resolveAdminReadAccess = async (req, res) => {
  const isAdminRequest = parseBooleanFlag(req.query.admin);

  if (!isAdminRequest) {
    return false;
  }

  const adminSession = await getAuthenticatedAdminSession(req);

  if (!adminSession) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return null;
  }

  return true;
};

router.get('/', async (req, res) => {
  try {
    const isAdminView = await resolveAdminReadAccess(req, res);

    if (isAdminView === null) {
      return;
    }

    const schemaState = await getHomeServicesSchemaState();
    const [rows] = await db.query(buildHomeServicesQuery(schemaState));
    const services = rows.map(normalizeHomeServiceRow);

    res.json(isAdminView ? services : services.filter((service) => service.active));
  } catch (err) {
    logger.error({ err }, 'Erro ao buscar serviços da home.');
    const services = listBackupHomeServices().map(normalizeHomeServiceRow);
    const isAdminView = parseBooleanFlag(req.query.admin) && Boolean(req.adminSession);
    res.json(isAdminView ? services : services.filter((service) => service.active));
  }
});

router.post('/', requireAdminSession, upload.any(), async (req, res, next) => {
  try {
    const schemaState = await getHomeServicesSchemaState();
    const { name, description, link_url, is_external, display_order, active, actions } = req.body;
    const logoSize = normalizeLogoSize(req.body.logo_size);
    const linkTargetType = normalizeLinkTargetType(req.body.link_target_type);
    const customPageId = parseInteger(req.body.custom_page_id, 0);
    const digitalGroupId = parseInteger(req.body.digital_group_id, 0);
    const incomingActions = parseActionsPayload(actions);
    const normalizedActions = await persistDigitalCardsConfig(req.files, incomingActions);
    const imageFile = getUploadedFileByField(req.files, 'image');
    const image_url = imageFile
      ? await persistUploadedFile(imageFile, { resourceType: 'segmentos' })
      : sanitizeAssetReference(req.body.image_url || '');
    const logoFile = getUploadedFileByField(req.files, 'logo');
    const logo_url = logoFile
      ? await persistUploadedFile(logoFile, { resourceType: 'segmentos' })
      : sanitizeAssetReference(req.body.logo_url || '');
    let resolvedLinkUrl = sanitizeNavigationTarget(link_url || '', {
      allowExternal: true,
      allowRelative: true
    });
    let resolvedCustomPageId = null;
    let resolvedDigitalGroupId = null;

    if (linkTargetType === 'custom-page' && customPageId > 0) {
      const [customPageRows] = await db.query('SELECT id, slug FROM custom_pages WHERE id = ? LIMIT 1', [customPageId]);
      if (customPageRows[0]) {
        resolvedCustomPageId = Number(customPageRows[0].id);
        resolvedLinkUrl = buildCustomPagePath(customPageRows[0].slug);
      }
    }

    if (linkTargetType === 'digital-group' && digitalGroupId > 0) {
      const [digitalGroupRows] = await db.query('SELECT id, slug FROM digital_groups WHERE id = ? LIMIT 1', [digitalGroupId]);
      if (digitalGroupRows[0]) {
        resolvedDigitalGroupId = Number(digitalGroupRows[0].id);
        resolvedLinkUrl = buildDigitalGroupPath(digitalGroupRows[0].slug || digitalGroupRows[0].id);
      }
    }

    const insertPayload = buildHomeServiceInsertPayload({
      name: safe(sanitizeTextInput(name || '', { preserveNewlines: false })),
      description: safe(sanitizeTextInput(description || '', { preserveNewlines: true })),
      image_url: safe(image_url || null),
      logo_url: safe(logo_url || null),
      logo_size: logoSize,
      link_url: resolvedLinkUrl,
      link_target_type: linkTargetType,
      custom_page_id: resolvedCustomPageId,
      digital_group_id: resolvedDigitalGroupId,
      is_external: parseBooleanFlag(is_external) ? 1 : 0,
      display_order: parseInteger(display_order, 0),
      active: active === 'false' || active === false ? 0 : 1,
      actions: JSON.stringify(normalizedActions)
    }, schemaState);

    const [result] = await db.query(insertPayload.query, insertPayload.params);

    res.status(201).json({ id: result.insertId, message: 'Serviço criado com sucesso' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao criar serviço da home.' }));
  }
});

router.put('/:id', requireAdminSession, upload.any(), async (req, res, next) => {
  const { id } = req.params;

  try {
    const schemaState = await getHomeServicesSchemaState();
    const { name, description, link_url, is_external, display_order, active, actions } = req.body;
    const logoSize = normalizeLogoSize(req.body.logo_size);
    const linkTargetType = normalizeLinkTargetType(req.body.link_target_type);
    const customPageId = parseInteger(req.body.custom_page_id, 0);
    const digitalGroupId = parseInteger(req.body.digital_group_id, 0);
    const [currentRows] = await db.query('SELECT image_url, logo_url, actions FROM home_services WHERE id = ? LIMIT 1', [id]);

    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado.' });
    }

    const previousActions = parseActionsPayload(currentRows[0].actions);
    const incomingActions = parseActionsPayload(actions);
    const normalizedActions = await persistDigitalCardsConfig(req.files, incomingActions, previousActions);
    let image_url = req.body.image_url;
    let logo_url = req.body.logo_url;
    const imageFile = getUploadedFileByField(req.files, 'image');
    const logoFile = getUploadedFileByField(req.files, 'logo');

    if (imageFile) {
      image_url = await persistUploadedFile(imageFile, { resourceType: 'segmentos' });
    }

    if (logoFile) {
      logo_url = await persistUploadedFile(logoFile, { resourceType: 'segmentos' });
    }

    if (image_url === undefined) {
      image_url = currentRows[0].image_url || null;
    }

    if (logo_url === undefined) {
      logo_url = currentRows[0].logo_url || null;
    }

    image_url = sanitizeAssetReference(image_url || '');
    logo_url = sanitizeAssetReference(logo_url || '');
    let resolvedLinkUrl = sanitizeNavigationTarget(link_url || '', {
      allowExternal: true,
      allowRelative: true
    });
    let resolvedCustomPageId = null;
    let resolvedDigitalGroupId = null;

    if (linkTargetType === 'custom-page' && customPageId > 0) {
      const [customPageRows] = await db.query('SELECT id, slug FROM custom_pages WHERE id = ? LIMIT 1', [customPageId]);
      if (customPageRows[0]) {
        resolvedCustomPageId = Number(customPageRows[0].id);
        resolvedLinkUrl = buildCustomPagePath(customPageRows[0].slug);
      }
    }

    if (linkTargetType === 'digital-group' && digitalGroupId > 0) {
      const [digitalGroupRows] = await db.query('SELECT id, slug FROM digital_groups WHERE id = ? LIMIT 1', [digitalGroupId]);
      if (digitalGroupRows[0]) {
        resolvedDigitalGroupId = Number(digitalGroupRows[0].id);
        resolvedLinkUrl = buildDigitalGroupPath(digitalGroupRows[0].slug || digitalGroupRows[0].id);
      }
    }

    const updatePayload = buildHomeServiceUpdatePayload({
      id,
      name: safe(sanitizeTextInput(name || '', { preserveNewlines: false })),
      description: safe(sanitizeTextInput(description || '', { preserveNewlines: true })),
      image_url: safe(image_url || null),
      logo_url: safe(logo_url || null),
      logo_size: logoSize,
      link_url: resolvedLinkUrl,
      link_target_type: linkTargetType,
      custom_page_id: resolvedCustomPageId,
      digital_group_id: resolvedDigitalGroupId,
      is_external: parseBooleanFlag(is_external) ? 1 : 0,
      display_order: parseInteger(display_order, 0),
      active: active === 'false' || active === false ? 0 : 1,
      actions: JSON.stringify(normalizedActions)
    }, schemaState);

    await db.query(updatePayload.query, updatePayload.params);

    res.json({ message: 'Serviço atualizado com sucesso' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar serviço da home.' }));
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM home_services WHERE id = ?', [id]);
    res.json({ message: 'Serviço removido com sucesso' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao remover serviço da home.' }));
  }
});

router.put('/:id/active', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    const active = parseBooleanFlag(req.body?.active) ? 1 : 0;
    await db.query('UPDATE home_services SET active = ? WHERE id = ?', [active, id]);
    res.json({ message: `Serviço ${active ? 'ativado' : 'ocultado'} com sucesso` });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar status do serviço da home.' }));
  }
});

module.exports = router;
