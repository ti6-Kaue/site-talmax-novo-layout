/**
 * Define as rotas de banners do site.
 * Cuida da leitura publica e da manutencao protegida pelo admin.
 */
const express = require('express');
const db = require('../../config/database');
const upload = require('../config/upload');
const { safe } = require('../utils/common');
const {
  getAuthenticatedAdminSession,
  requireAdminSession
} = require('../auth/adminSession');
const { parseBooleanFlag, parseInteger } = require('../utils/requestParsers');
const { validateBannerWritePayload } = require('../validation/contentSchemas');
const { persistUploadedFile } = require('../services/fileStorageService');
const { listBackupBanners } = require('../services/backupContentService');
const { sanitizeServedImageUrl } = require('../config/imageStorage');
const { wrapError } = require('../utils/errorHandling');
const {
  sanitizeAssetReference,
  sanitizeNavigationTarget,
  sanitizeTextInput
} = require('../utils/inputSanitization');
const logger = require('../utils/logger');

const router = express.Router();
let cachedBannerSchemaState = null;

const shouldUseBackupFallback = process.env.NODE_ENV !== 'production';

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

const getBannerSchemaState = async () => {
  if (cachedBannerSchemaState) {
    return cachedBannerSchemaState;
  }

  const columns = await getTableColumnSet('banners');

  cachedBannerSchemaState = {
    hasTitle: columns.has('title'),
    hasSubtitle: columns.has('subtitle'),
    hasLinkUrl: columns.has('link_url'),
    hasDisplayOrder: columns.has('display_order'),
    hasActive: columns.has('active')
  };

  return cachedBannerSchemaState;
};

const buildBannerListQuery = (schemaState) => {
  const titleSelect = schemaState.hasTitle ? 'title' : 'NULL AS title';
  const subtitleSelect = schemaState.hasSubtitle ? 'subtitle' : 'NULL AS subtitle';
  const linkUrlSelect = schemaState.hasLinkUrl ? 'link_url' : 'NULL AS link_url';
  const displayOrderSelect = schemaState.hasDisplayOrder ? 'display_order' : '0 AS display_order';
  const activeSelect = schemaState.hasActive ? 'active' : '1 AS active';
  const orderByClause = schemaState.hasDisplayOrder ? 'ORDER BY display_order ASC, id ASC' : 'ORDER BY id ASC';

  return `
    SELECT
      id,
      ${titleSelect},
      ${subtitleSelect},
      image_url,
      ${linkUrlSelect},
      ${displayOrderSelect},
      ${activeSelect}
    FROM banners
    ${orderByClause}
  `;
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

    const schemaState = await getBannerSchemaState();
    const [rows] = await db.query(buildBannerListQuery(schemaState));
    const normalizedRows = rows.map((row) => ({
      ...row,
      title: sanitizeTextInput(row.title || '', { preserveNewlines: false }),
      subtitle: sanitizeTextInput(row.subtitle || '', { preserveNewlines: true }),
      image_url: sanitizeAssetReference(sanitizeServedImageUrl(row.image_url) || ''),
      link_url: sanitizeNavigationTarget(row.link_url || '')
    }));

    res.json(isAdminView ? normalizedRows : normalizedRows.filter((row) => row.active));
  } catch (err) {
    if (shouldUseBackupFallback) {
      const normalizedRows = listBackupBanners().map((row) => ({
        ...row,
        title: sanitizeTextInput(row.title || '', { preserveNewlines: false }),
        subtitle: sanitizeTextInput(row.subtitle || '', { preserveNewlines: true }),
        image_url: sanitizeAssetReference(sanitizeServedImageUrl(row.image_url) || ''),
        link_url: sanitizeNavigationTarget(row.link_url || '')
      }));

      const isAdminView = parseBooleanFlag(req.query.admin) && Boolean(req.adminSession);
      res.json(isAdminView ? normalizedRows : normalizedRows.filter((row) => row.active !== false));
      return;
    }

    logger.error({ err }, 'Erro ao buscar banners.');
    res.json([]);
  }
});

router.post('/', requireAdminSession, upload.single('image'), async (req, res, next) => {
  try {
    const payload = validateBannerWritePayload(req.body || {});
    const image_url = req.file
      ? await persistUploadedFile(req.file, { resourceType: 'banners' })
      : null;

    if (!image_url) {
      return res.status(400).json({ error: 'A imagem do banner é obrigatória.' });
    }

    const isActive = payload.active === false ? 0 : 1;
    const order = parseInteger(payload.display_order, 0);

    await db.query(
      'INSERT INTO banners (image_url, title, link_url, display_order, active) VALUES (?, ?, ?, ?, ?)',
      [sanitizeAssetReference(image_url) || null, safe(payload.title), safe(payload.link_url), order, isActive]
    );
    return res.status(201).json({ message: 'Banner criado!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao criar banner.' }));
  }
});

router.put('/:id', requireAdminSession, upload.single('image'), async (req, res, next) => {
  try {
    const payload = validateBannerWritePayload(req.body || {});
    const { id } = req.params;
    const isActive = payload.active === false ? 0 : 1;
    const order = parseInteger(payload.display_order, 0);

    let query = 'UPDATE banners SET title = ?, link_url = ?, display_order = ?, active = ?';
    const params = [safe(payload.title), safe(payload.link_url), order, isActive];

    if (req.file) {
      query += ', image_url = ?';
      params.push(sanitizeAssetReference(await persistUploadedFile(req.file, { resourceType: 'banners' })) || null);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);
    return res.json({ message: 'Banner atualizado!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao atualizar banner.' }));
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  try {
    await db.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Banner excluído!' });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao excluir banner.' }));
  }
});

module.exports = router;
