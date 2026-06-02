const express = require('express');
const db = require('../../config/database');
const upload = require('../config/upload');
const {
  getAuthenticatedAdminSession,
  requireAdminSession
} = require('../auth/adminSession');
const { parseBooleanFlag, parseInteger } = require('../utils/requestParsers');
const { persistUploadedFile } = require('../services/fileStorageService');
const { safe } = require('../utils/common');
const { createHttpError, wrapError } = require('../utils/errorHandling');
const {
  sanitizeAssetReference,
  sanitizeNavigationTarget,
  sanitizeTextInput
} = require('../utils/inputSanitization');
const logger = require('../utils/logger');

const router = express.Router();

const DIGITAL_GROUPS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS digital_groups (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(180) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )
`;

const DIGITAL_GROUP_CARDS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS digital_group_cards (
    id INT NOT NULL AUTO_INCREMENT,
    group_id INT NOT NULL,
    custom_page_id INT DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    link_url VARCHAR(500) DEFAULT NULL,
    is_external BOOLEAN DEFAULT FALSE,
    front_image_url VARCHAR(500) DEFAULT NULL,
    back_image_url VARCHAR(500) DEFAULT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_digital_group_cards_group_id (group_id),
    CONSTRAINT fk_digital_group_cards_group
      FOREIGN KEY (group_id) REFERENCES digital_groups(id) ON DELETE CASCADE
  )
`;

let tablesReady = false;

const tableExists = async (tableName) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );

  return Number(rows?.[0]?.total || 0) > 0;
};

const normalizePublicPath = (value = '') => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
);

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
  }
};

const ensureUniqueIndex = async (tableName, indexName, columnName) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  if (Number(rows?.[0]?.total || 0) === 0) {
    await db.query(`ALTER TABLE ${tableName} ADD UNIQUE KEY ${indexName} (${columnName})`);
  }
};

const buildFallbackSlug = (title, id) => normalizePublicPath(title) || `grupo-${id}`;

const resolveUniqueSlug = async (connection, value, { excludeId = null } = {}) => {
  const baseSlug = normalizePublicPath(value);

  if (!baseSlug) {
    return '';
  }

  let nextSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const query = excludeId
      ? 'SELECT id FROM digital_groups WHERE slug = ? AND id <> ? LIMIT 1'
      : 'SELECT id FROM digital_groups WHERE slug = ? LIMIT 1';
    const params = excludeId ? [nextSlug, excludeId] : [nextSlug];
    const [rows] = await connection.query(query, params);

    if (!rows[0]) {
      return nextSlug;
    }

    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const ensureExistingGroupSlugs = async () => {
  const [rows] = await db.query(
    'SELECT id, title, slug FROM digital_groups WHERE slug IS NULL OR TRIM(slug) = "" ORDER BY id ASC'
  );

  for (const row of rows) {
    const nextSlug = await resolveUniqueSlug(db, buildFallbackSlug(row.title, row.id), { excludeId: Number(row.id) });
    await db.query('UPDATE digital_groups SET slug = ? WHERE id = ?', [nextSlug, row.id]);
  }
};

const ensureTables = async () => {
  if (tablesReady) return;

  if (!(await tableExists('digital_groups'))) {
    await db.query(DIGITAL_GROUPS_TABLE_QUERY);
  }

  if (!(await tableExists('digital_group_cards'))) {
    await db.query(DIGITAL_GROUP_CARDS_TABLE_QUERY);
  }

  await ensureColumn('digital_groups', 'slug', 'VARCHAR(180) DEFAULT NULL AFTER title');
  await ensureColumn('digital_groups', 'overline', 'VARCHAR(255) DEFAULT NULL AFTER description');
  await ensureColumn('digital_groups', 'hero_title', 'VARCHAR(255) DEFAULT NULL AFTER overline');
  await ensureColumn('digital_groups', 'hero_description', 'TEXT DEFAULT NULL AFTER hero_title');
  await ensureColumn('digital_groups', 'logo_url', 'VARCHAR(500) DEFAULT NULL AFTER hero_description');
  await ensureColumn('digital_group_cards', 'custom_page_id', 'INT DEFAULT NULL AFTER group_id');
  await ensureExistingGroupSlugs();
  await ensureUniqueIndex('digital_groups', 'uk_digital_groups_slug', 'slug');
  tablesReady = true;
};

const isMissingTableError = (error) => (
  error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_TABLE_ERROR'
);

const isSchemaPermissionError = (error) => (
  error?.code === 'ER_TABLEACCESS_DENIED_ERROR' ||
  error?.code === 'ER_DBACCESS_DENIED_ERROR' ||
  error?.code === 'ER_ACCESS_DENIED_ERROR'
);

const parseCards = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
};

const getUploadedFileByField = (files = [], fieldName) => (
  Array.isArray(files) ? files.find((file) => file.fieldname === fieldName) || null : null
);

const buildCustomPagePath = (slug = '') => (slug ? `/pagina/${slug}` : '');

const listGroups = async ({ onlyActive = false } = {}) => {
  await ensureTables();
  const hasCustomPagesTable = await tableExists('custom_pages');

  const [groups] = await db.query(
    `
      SELECT groups.*
      FROM digital_groups groups
      ${onlyActive ? 'WHERE groups.is_active = 1' : ''}
      ORDER BY groups.display_order ASC, groups.id ASC
    `
  );

  const [cards] = await db.query(
    hasCustomPagesTable
      ? `
          SELECT
            cards.*,
            custom_pages.title AS custom_page_title,
            custom_pages.slug AS custom_page_slug
          FROM digital_group_cards cards
          LEFT JOIN custom_pages ON custom_pages.id = cards.custom_page_id
          ${onlyActive ? 'WHERE cards.is_active = 1' : ''}
          ORDER BY cards.display_order ASC, cards.id ASC
        `
      : `
          SELECT
            cards.*,
            '' AS custom_page_title,
            '' AS custom_page_slug
          FROM digital_group_cards cards
          ${onlyActive ? 'WHERE cards.is_active = 1' : ''}
          ORDER BY cards.display_order ASC, cards.id ASC
        `
  );

  const cardsByGroupId = cards.reduce((map, card) => {
    const key = Number(card.group_id);
    const current = map.get(key) || [];
    current.push({
      id: Number(card.id),
      custom_page_id: card.custom_page_id ? Number(card.custom_page_id) : null,
      custom_page_title: sanitizeTextInput(card.custom_page_title || '', { preserveNewlines: false }),
      title: sanitizeTextInput(card.title || '', { preserveNewlines: false }),
      description: sanitizeTextInput(card.description || '', { preserveNewlines: true }),
      link_url: card.custom_page_slug
        ? buildCustomPagePath(card.custom_page_slug)
        : sanitizeNavigationTarget(card.link_url || ''),
      is_external: Number(card.is_external) === 1,
      front_image_url: sanitizeAssetReference(card.front_image_url || ''),
      back_image_url: sanitizeAssetReference(card.back_image_url || ''),
      display_order: Number(card.display_order || 0),
      is_active: Number(card.is_active ?? 1) === 1
    });
    map.set(key, current);
    return map;
  }, new Map());

  return groups.map((group) => ({
    id: Number(group.id),
    title: sanitizeTextInput(group.title || '', { preserveNewlines: false }),
    slug: group.slug || buildFallbackSlug(group.title, group.id),
    description: sanitizeTextInput(group.description || '', { preserveNewlines: true }),
    overline: sanitizeTextInput(group.overline || '', { preserveNewlines: false }),
    hero_title: sanitizeTextInput(group.hero_title || '', { preserveNewlines: false }),
    hero_description: sanitizeTextInput(group.hero_description || '', { preserveNewlines: true }),
    logo_url: sanitizeAssetReference(group.logo_url || ''),
    display_order: Number(group.display_order || 0),
    is_active: Number(group.is_active ?? 1) === 1,
    cards: cardsByGroupId.get(Number(group.id)) || []
  }));
};

const replaceGroupCards = async (connection, groupId, files, cards = []) => {
  const hasCustomPagesTable = await tableExists('custom_pages');
  await connection.query('DELETE FROM digital_group_cards WHERE group_id = ?', [groupId]);

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const customPageId = Number(card?.custom_page_id);
    const tempId = String(card?.temp_id || card?.id || `card-${index}`).trim();
    const frontImageFile = getUploadedFileByField(files, `card_front_${tempId}`);
    const backImageFile = getUploadedFileByField(files, `card_back_${tempId}`);

    const frontImageUrl = frontImageFile
      ? await persistUploadedFile(frontImageFile, { resourceType: 'digital-groups' })
      : sanitizeAssetReference(card.front_image_url || '');
    const backImageUrl = backImageFile
      ? await persistUploadedFile(backImageFile, { resourceType: 'digital-groups' })
      : sanitizeAssetReference(card.back_image_url || '');
    let resolvedLinkUrl = sanitizeNavigationTarget(card.link_url || '');
    let resolvedCustomPageId = null;

    if (hasCustomPagesTable && Number.isInteger(customPageId) && customPageId > 0) {
      const [customPageRows] = await connection.query(
        'SELECT id, slug FROM custom_pages WHERE id = ? LIMIT 1',
        [customPageId]
      );

      if (customPageRows[0]) {
        resolvedCustomPageId = Number(customPageRows[0].id);
        resolvedLinkUrl = buildCustomPagePath(customPageRows[0].slug);
      }
    }

    await connection.query(
      `
        INSERT INTO digital_group_cards (
          group_id, custom_page_id, title, description, link_url, is_external, front_image_url, back_image_url, display_order, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        groupId,
        resolvedCustomPageId,
        safe(sanitizeTextInput(card.title || '', { preserveNewlines: false })),
        safe(sanitizeTextInput(card.description || '', { preserveNewlines: true })),
        resolvedLinkUrl,
        parseBooleanFlag(card.is_external) ? 1 : 0,
        safe(frontImageUrl || null),
        safe(backImageUrl || null),
        index,
        card.is_active === false ? 0 : 1
      ]
    );
  }
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

router.get('/', async (req, res, next) => {
  try {
    const isAdminView = await resolveAdminReadAccess(req, res);

    if (isAdminView === null) {
      return undefined;
    }

    const onlyActive = !isAdminView;
    const items = await listGroups({ onlyActive });
    res.json(items);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar grupos digitais.');

     if (isMissingTableError(error) || isSchemaPermissionError(error)) {
      return res.json([]);
    }

    return next(wrapError(error, { publicMessage: 'Erro ao listar grupos digitais.' }));
  }
});

router.get('/public/:slug', async (req, res, next) => {
  try {
    const items = await listGroups({ onlyActive: true });
    const target = String(req.params.slug || '').trim().toLowerCase();
    const item = items.find((group) => (
      String(group.slug || '').trim().toLowerCase() === target ||
      String(group.id) === target
    ));

    if (!item) {
      return res.status(404).json({ error: 'Grupo digital não encontrado.' });
    }

    res.json(item);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar grupo digital público.');

    if (isMissingTableError(error) || isSchemaPermissionError(error)) {
      return res.status(404).json({ error: 'Grupo digital não encontrado.' });
    }

    return next(wrapError(error, { publicMessage: 'Erro ao buscar grupo digital público.' }));
  }
});

router.post('/', requireAdminSession, upload.any(), async (req, res, next) => {
  const connection = await db.getConnection();

  try {
    await ensureTables();
    const cards = parseCards(req.body.cards);
    const logoFile = getUploadedFileByField(req.files, 'logo');
    const logoUrl = logoFile
      ? await persistUploadedFile(logoFile, { resourceType: 'digital-groups' })
      : sanitizeAssetReference(req.body.logo_url || '');
    const requestedSlug = sanitizeTextInput(req.body.slug || '', { preserveNewlines: false, maxLength: 180 });

    await connection.beginTransaction();
    const [result] = await connection.query(
      `
        INSERT INTO digital_groups (title, slug, description, overline, hero_title, hero_description, logo_url, display_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        safe(sanitizeTextInput(req.body.title || '', { preserveNewlines: false })),
        null,
        safe(sanitizeTextInput(req.body.description || '', { preserveNewlines: true })),
        safe(sanitizeTextInput(req.body.overline || '', { preserveNewlines: false })),
        safe(sanitizeTextInput(req.body.hero_title || '', { preserveNewlines: false })),
        safe(sanitizeTextInput(req.body.hero_description || '', { preserveNewlines: true })),
        safe(logoUrl || null),
        parseInteger(req.body.display_order, 0),
        req.body.is_active === 'false' ? 0 : 1
      ]
    );

    const nextSlug = await resolveUniqueSlug(
      connection,
      requestedSlug || buildFallbackSlug(req.body.title, result.insertId),
      { excludeId: Number(result.insertId) }
    );

    await connection.query('UPDATE digital_groups SET slug = ? WHERE id = ?', [nextSlug, result.insertId]);

    await replaceGroupCards(connection, result.insertId, req.files, cards);
    await connection.commit();

    res.status(201).json({ message: 'Grupo digital criado com sucesso.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    logger.error({ err: error }, 'Erro ao criar grupo digital.');

    if (isMissingTableError(error) || isSchemaPermissionError(error)) {
      return next(createHttpError(503, 'As tabelas de grupos digitais não estão disponíveis no banco de produção.', {
        code: error.code,
        expose: true,
        cause: error
      }));
    }

    return next(wrapError(error, { publicMessage: 'Erro ao criar grupo digital.' }));
  } finally {
    connection.release();
  }
});

router.put('/:id', requireAdminSession, upload.any(), async (req, res, next) => {
  const connection = await db.getConnection();

  try {
    await ensureTables();
    const groupId = Number(req.params.id);
    const cards = parseCards(req.body.cards);
    const logoFile = getUploadedFileByField(req.files, 'logo');
    const logoUrl = logoFile
      ? await persistUploadedFile(logoFile, { resourceType: 'digital-groups' })
      : sanitizeAssetReference(req.body.logo_url || '');
    const requestedSlug = sanitizeTextInput(req.body.slug || '', { preserveNewlines: false, maxLength: 180 });
    const nextSlug = await resolveUniqueSlug(
      connection,
      requestedSlug || buildFallbackSlug(req.body.title, groupId),
      { excludeId: groupId }
    );

    await connection.beginTransaction();
    await connection.query(
      `
        UPDATE digital_groups
        SET title = ?, slug = ?, description = ?, overline = ?, hero_title = ?, hero_description = ?, logo_url = ?, display_order = ?, is_active = ?
        WHERE id = ?
      `,
      [
        safe(sanitizeTextInput(req.body.title || '', { preserveNewlines: false })),
        nextSlug,
        safe(sanitizeTextInput(req.body.description || '', { preserveNewlines: true })),
        safe(sanitizeTextInput(req.body.overline || '', { preserveNewlines: false })),
        safe(sanitizeTextInput(req.body.hero_title || '', { preserveNewlines: false })),
        safe(sanitizeTextInput(req.body.hero_description || '', { preserveNewlines: true })),
        safe(logoUrl || null),
        parseInteger(req.body.display_order, 0),
        req.body.is_active === 'false' ? 0 : 1,
        groupId
      ]
    );

    await replaceGroupCards(connection, groupId, req.files, cards);
    await connection.commit();

    res.json({ message: 'Grupo digital atualizado com sucesso.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    logger.error({ err: error }, 'Erro ao atualizar grupo digital.');

    if (isMissingTableError(error) || isSchemaPermissionError(error)) {
      return next(createHttpError(503, 'As tabelas de grupos digitais não estão disponíveis no banco de produção.', {
        code: error.code,
        expose: true,
        cause: error
      }));
    }

    return next(wrapError(error, { publicMessage: 'Erro ao atualizar grupo digital.' }));
  } finally {
    connection.release();
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  try {
    await ensureTables();
    await db.query('DELETE FROM digital_groups WHERE id = ?', [req.params.id]);
    res.json({ message: 'Grupo digital removido com sucesso.' });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao remover grupo digital.');

    if (isMissingTableError(error) || isSchemaPermissionError(error)) {
      return next(createHttpError(503, 'As tabelas de grupos digitais não estão disponíveis no banco de produção.', {
        code: error.code, 
        expose: true,
        cause: error
      }));
    }

    return next(wrapError(error, { publicMessage: 'Erro ao remover grupo digital.' }));
  }
});

module.exports = router;
