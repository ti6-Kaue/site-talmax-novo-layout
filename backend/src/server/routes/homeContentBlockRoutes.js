/**
 * CRUD dos blocos editaveis exibidos abaixo das categorias e antes do rodape.
 */
const express = require('express');
const db = require('../../config/database');
const {
  getAuthenticatedAdminSession,
  requireAdminSession
} = require('../auth/adminSession');
const upload = require('../config/upload');
const { parseBooleanFlag, parseInteger } = require('../utils/requestParsers');
const { wrapError } = require('../utils/errorHandling');
const { persistUploadedFile } = require('../services/fileStorageService');
const {
  sanitizeAssetReference,
  sanitizeNavigationTarget,
  sanitizeTextInput
} = require('../utils/inputSanitization');
const logger = require('../utils/logger');

const router = express.Router();

const SECTION_TYPES = new Set(['info-card', 'orange-ad', 'header-menu']);

const HOME_CONTENT_BLOCKS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS home_content_blocks (
    id INT NOT NULL AUTO_INCREMENT,
    section_type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    logo_text VARCHAR(80) DEFAULT NULL,
    logo_image_url VARCHAR(255) DEFAULT NULL,
    button_label VARCHAR(120) DEFAULT NULL,
    link_url VARCHAR(1000) DEFAULT NULL,
    is_external TINYINT(1) NOT NULL DEFAULT 0,
    background_color VARCHAR(24) DEFAULT NULL,
    text_color VARCHAR(24) DEFAULT NULL,
    button_color VARCHAR(24) DEFAULT NULL,
    button_text_color VARCHAR(24) DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_home_content_blocks_section_order (section_type, active, display_order)
  )
`;

const DEFAULT_HOME_CONTENT_BLOCKS = [
  {
    section_type: 'info-card',
    title: 'Talmax perto de Voce',
    description: 'Trabalhamos com dentais selecionadas para garantir qualidade, procedencia e suporte.',
    logo_text: '',
    logo_image_url: '',
    button_label: 'Saiba Mais',
    link_url: '/contato',
    is_external: 0,
    background_color: '#111630',
    text_color: '#ffffff',
    button_color: '#374c92',
    button_text_color: '#ffffff',
    display_order: 10,
    active: 1
  },
  {
    section_type: 'info-card',
    title: 'Trabalhe Conosco',
    description: 'Valorizamos ideias, incentivamos o desenvolvimento e acreditamos no trabalho em equipe para ir cada vez mais longe.\n\nVenha fazer parte do nosso time.',
    logo_text: '',
    logo_image_url: '',
    button_label: 'Saiba Mais',
    link_url: 'https://www.bne.com.br/talmax',
    is_external: 1,
    background_color: '#111630',
    text_color: '#ffffff',
    button_color: '#374c92',
    button_text_color: '#ffffff',
    display_order: 20,
    active: 1
  },
  {
    section_type: 'orange-ad',
    title: 'Conheca nossa linha de moveis para sua clinica ou laboratorio',
    description: '',
    logo_text: 'moby',
    logo_image_url: '',
    button_label: 'Conheca a Moby',
    link_url: 'https://mobywork.com.br',
    is_external: 1,
    background_color: '#f06400',
    text_color: '#ffffff',
    button_color: '#374c92',
    button_text_color: '#ffffff',
    display_order: 10,
    active: 1
  }
];

let homeContentBlocksTableReady = false;

const isExternalNavigationTarget = (value = '') => /^(?:https?:|mailto:|tel:)/i.test(String(value || '').trim());

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

const seedDefaultBlocks = async () => {
  for (const block of DEFAULT_HOME_CONTENT_BLOCKS) {
    await db.query(
      `
        INSERT INTO home_content_blocks (
          section_type,
          title,
          description,
          logo_text,
          logo_image_url,
          button_label,
          link_url,
          is_external,
          background_color,
          text_color,
          button_color,
          button_text_color,
          display_order,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        block.section_type,
        block.title,
        block.description,
        block.logo_text,
        block.logo_image_url,
        block.button_label,
        block.link_url,
        block.is_external,
        block.background_color,
        block.text_color,
        block.button_color,
        block.button_text_color,
        block.display_order,
        block.active
      ]
    );
  }
};

const ensureHomeContentBlocksTable = async () => {
  if (homeContentBlocksTableReady) {
    return;
  }

  const alreadyExists = await tableExists('home_content_blocks');
  await db.query(HOME_CONTENT_BLOCKS_TABLE_QUERY);
  await ensureColumn('home_content_blocks', 'logo_image_url', 'VARCHAR(255) DEFAULT NULL AFTER logo_text');

  if (!alreadyExists) {
    await seedDefaultBlocks();
  }

  homeContentBlocksTableReady = true;
};

const normalizeSectionType = (value) => {
  const normalizedValue = sanitizeTextInput(value || '', {
    preserveNewlines: false,
    maxLength: 32
  }).toLowerCase();

  return SECTION_TYPES.has(normalizedValue) ? normalizedValue : 'info-card';
};

const getSectionDefaults = (sectionType) => (
  sectionType === 'orange-ad'
    ? {
      background_color: '#f06400',
      text_color: '#ffffff',
      button_color: '#374c92',
      button_text_color: '#ffffff',
      button_label: 'Conheca'
    }
    : sectionType === 'header-menu'
      ? {
        background_color: '#ffffff',
        text_color: '#243f96',
        button_color: '#374c92',
        button_text_color: '#ffffff',
        button_label: ''
      }
    : {
      background_color: '#111630',
      text_color: '#ffffff',
      button_color: '#374c92',
      button_text_color: '#ffffff',
      button_label: 'Saiba Mais'
    }
);

const normalizeColor = (value, fallback) => {
  const sanitized = sanitizeTextInput(value || '', {
    preserveNewlines: false,
    maxLength: 24
  });

  return /^#[0-9a-f]{3,8}$/i.test(sanitized) ? sanitized : fallback;
};

const normalizeHomeContentBlockPayload = (input = {}) => {
  const sectionType = normalizeSectionType(input.section_type);
  const defaults = getSectionDefaults(sectionType);
  const linkUrl = sanitizeNavigationTarget(input.link_url || '', {
    allowExternal: true,
    allowRelative: true
  });

  return {
    section_type: sectionType,
    title: sanitizeTextInput(input.title || '', {
      preserveNewlines: false,
      maxLength: 255
    }),
    description: sanitizeTextInput(input.description || '', {
      preserveNewlines: true,
      maxLength: 4000
    }),
    logo_text: sanitizeTextInput(input.logo_text || '', {
      preserveNewlines: false,
      maxLength: 80
    }),
    logo_image_url: sanitizeAssetReference(input.logo_image_url || ''),
    button_label: sanitizeTextInput(input.button_label || defaults.button_label, {
      preserveNewlines: false,
      maxLength: 120
    }),
    link_url: linkUrl,
    is_external: (parseBooleanFlag(input.is_external) || isExternalNavigationTarget(linkUrl)) ? 1 : 0,
    background_color: normalizeColor(input.background_color, defaults.background_color),
    text_color: normalizeColor(input.text_color, defaults.text_color),
    button_color: normalizeColor(input.button_color, defaults.button_color),
    button_text_color: normalizeColor(input.button_text_color, defaults.button_text_color),
    display_order: Math.max(parseInteger(input.display_order, 0), 0),
    active: input.active === 'false' || input.active === false ? 0 : 1
  };
};

const buildValidationErrors = (payload) => {
  const details = [];

  if (!payload.title) {
    details.push({ field: 'title', message: 'Informe o texto principal.' });
  }

  if (payload.section_type === 'orange-ad' && !payload.logo_text && !payload.logo_image_url) {
    details.push({ field: 'logo_text', message: 'Informe o texto da marca ou envie uma imagem de logo.' });
  }

  return details;
};

const normalizeHomeContentBlockRow = (row) => {
  const sectionType = normalizeSectionType(row.section_type);
  const defaults = getSectionDefaults(sectionType);
  const linkUrl = sanitizeNavigationTarget(row.link_url || '', {
    allowExternal: true,
    allowRelative: true
  });

  return {
    id: Number(row.id),
    section_type: sectionType,
    title: sanitizeTextInput(row.title || '', {
      preserveNewlines: false,
      maxLength: 255
    }),
    description: sanitizeTextInput(row.description || '', {
      preserveNewlines: true,
      maxLength: 4000
    }),
    logo_text: sanitizeTextInput(row.logo_text || '', {
      preserveNewlines: false,
      maxLength: 80
    }),
    logo_image_url: sanitizeAssetReference(row.logo_image_url || ''),
    button_label: sanitizeTextInput(row.button_label || defaults.button_label, {
      preserveNewlines: false,
      maxLength: 120
    }),
    link_url: linkUrl,
    is_external: Boolean(row.is_external) || isExternalNavigationTarget(linkUrl),
    background_color: normalizeColor(row.background_color, defaults.background_color),
    text_color: normalizeColor(row.text_color, defaults.text_color),
    button_color: normalizeColor(row.button_color, defaults.button_color),
    button_text_color: normalizeColor(row.button_text_color, defaults.button_text_color),
    display_order: Math.max(parseInteger(row.display_order, 0), 0),
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const listHomeContentBlocks = async () => {
  const [rows] = await db.query(
    `
      SELECT
        id,
        section_type,
        title,
        description,
        logo_text,
        logo_image_url,
        button_label,
        link_url,
        is_external,
        background_color,
        text_color,
        button_color,
        button_text_color,
        display_order,
        active,
        created_at,
        updated_at
      FROM home_content_blocks
      ORDER BY section_type ASC, display_order ASC, id ASC
    `
  );

  return rows.map(normalizeHomeContentBlockRow);
};

const resolveAdminReadAccess = async (req, res) => {
  const isAdminRequest = parseBooleanFlag(req.query.admin);

  if (!isAdminRequest) {
    return false;
  }

  const adminSession = await getAuthenticatedAdminSession(req);

  if (!adminSession) {
    res.status(401).json({ error: 'Sessao invalida ou expirada.' });
    return null;
  }

  return true;
};

const getUploadedFileByField = (files = [], fieldName) => (
  Array.isArray(files) ? files.find((file) => file.fieldname === fieldName) || null : null
);

router.get('/', async (req, res, next) => {
  const isAdminRequest = parseBooleanFlag(req.query.admin);

  try {
    const isAdminView = await resolveAdminReadAccess(req, res);

    if (isAdminView === null) {
      return;
    }

    await ensureHomeContentBlocksTable();

    const blocks = await listHomeContentBlocks();
    res.json(isAdminView ? blocks : blocks.filter((block) => block.active));
  } catch (error) {
    logger.error({ err: error }, 'Erro ao carregar blocos editaveis da home.');

    if (isAdminRequest) {
      return next(wrapError(error, { publicMessage: 'Erro ao carregar os blocos editaveis da home.' }));
    }

    return res.json(DEFAULT_HOME_CONTENT_BLOCKS.map(normalizeHomeContentBlockRow));
  }
});

router.post('/', requireAdminSession, upload.any(), async (req, res, next) => {
  try {
    await ensureHomeContentBlocksTable();

    const logoImageFile = getUploadedFileByField(req.files, 'logo_image');
    const logoImageUrl = logoImageFile
      ? await persistUploadedFile(logoImageFile, { resourceType: 'home-content' })
      : req.body.logo_image_url;
    const payload = normalizeHomeContentBlockPayload({
      ...req.body,
      logo_image_url: logoImageUrl
    });
    const details = buildValidationErrors(payload);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados invalidos para o bloco da home.',
        details
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO home_content_blocks (
          section_type,
          title,
          description,
          logo_text,
          logo_image_url,
          button_label,
          link_url,
          is_external,
          background_color,
          text_color,
          button_color,
          button_text_color,
          display_order,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.section_type,
        payload.title,
        payload.description || null,
        payload.logo_text || null,
        payload.logo_image_url || null,
        payload.button_label || null,
        payload.link_url || null,
        payload.is_external,
        payload.background_color,
        payload.text_color,
        payload.button_color,
        payload.button_text_color,
        payload.display_order,
        payload.active
      ]
    );

    const [rows] = await db.query('SELECT * FROM home_content_blocks WHERE id = ? LIMIT 1', [result.insertId]);

    return res.status(201).json({
      message: 'Bloco da home criado com sucesso.',
      item: normalizeHomeContentBlockRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao criar o bloco da home.' }));
  }
});

router.put('/:id', requireAdminSession, upload.any(), async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureHomeContentBlocksTable();

    const [existingRows] = await db.query('SELECT id, logo_image_url FROM home_content_blocks WHERE id = ? LIMIT 1', [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Bloco da home nao encontrado.' });
    }

    const logoImageFile = getUploadedFileByField(req.files, 'logo_image');
    const logoImageUrl = logoImageFile
      ? await persistUploadedFile(logoImageFile, { resourceType: 'home-content' })
      : req.body.logo_image_url === undefined
        ? existingRows[0].logo_image_url
        : req.body.logo_image_url;
    const payload = normalizeHomeContentBlockPayload({
      ...req.body,
      logo_image_url: logoImageUrl
    });
    const details = buildValidationErrors(payload);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados invalidos para o bloco da home.',
        details
      });
    }

    await db.query(
      `
        UPDATE home_content_blocks
        SET
          section_type = ?,
          title = ?,
          description = ?,
          logo_text = ?,
          logo_image_url = ?,
          button_label = ?,
          link_url = ?,
          is_external = ?,
          background_color = ?,
          text_color = ?,
          button_color = ?,
          button_text_color = ?,
          display_order = ?,
          active = ?
        WHERE id = ?
      `,
      [
        payload.section_type,
        payload.title,
        payload.description || null,
        payload.logo_text || null,
        payload.logo_image_url || null,
        payload.button_label || null,
        payload.link_url || null,
        payload.is_external,
        payload.background_color,
        payload.text_color,
        payload.button_color,
        payload.button_text_color,
        payload.display_order,
        payload.active,
        id
      ]
    );

    const [rows] = await db.query('SELECT * FROM home_content_blocks WHERE id = ? LIMIT 1', [id]);

    return res.json({
      message: 'Bloco da home atualizado com sucesso.',
      item: normalizeHomeContentBlockRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao atualizar o bloco da home.' }));
  }
});

router.put('/:id/active', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureHomeContentBlocksTable();

    const active = parseBooleanFlag(req.body?.active) ? 1 : 0;
    await db.query('UPDATE home_content_blocks SET active = ? WHERE id = ?', [active, id]);

    res.json({ message: `Bloco ${active ? 'ativado' : 'ocultado'} com sucesso.` });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao atualizar o status do bloco da home.' }));
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureHomeContentBlocksTable();
    await db.query('DELETE FROM home_content_blocks WHERE id = ?', [id]);

    res.json({ message: 'Bloco da home removido com sucesso.' });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao remover o bloco da home.' }));
  }
});

module.exports = router;
