/**
 * CRUD das unidades/cards da pagina de Assistencia Tecnica.
 */
const express = require('express');
const db = require('../../config/database');
const { requireAdminSession } = require('../auth/adminSession');
const { wrapError } = require('../utils/errorHandling');
const { sanitizeTextInput } = require('../utils/inputSanitization');

const router = express.Router();

const TECHNICAL_ASSISTANCE_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS technical_assistance_cards (
    id INT NOT NULL AUTO_INCREMENT,
    card_type VARCHAR(40) NOT NULL DEFAULT 'directory',
    company VARCHAR(255) DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    city VARCHAR(120) DEFAULT NULL,
    state_code CHAR(2) DEFAULT NULL,
    phone VARCHAR(40) DEFAULT NULL,
    phone_2 VARCHAR(40) DEFAULT NULL,
    phone_3 VARCHAR(40) DEFAULT NULL,
    email VARCHAR(160) DEFAULT NULL,
    map_url VARCHAR(1000) DEFAULT NULL,
    site_url VARCHAR(1000) DEFAULT NULL,
    title VARCHAR(255) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    description_secondary TEXT DEFAULT NULL,
    button_label VARCHAR(80) DEFAULT NULL,
    link_url VARCHAR(1000) DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )
`;

let technicalAssistanceTableReady = false;

const ensureTechnicalAssistanceTable = async () => {
  if (technicalAssistanceTableReady) {
    return;
  }

  await db.query(TECHNICAL_ASSISTANCE_TABLE_QUERY);
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS card_type VARCHAR(40) NOT NULL DEFAULT \'directory\' AFTER id');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS phone_3 VARCHAR(40) DEFAULT NULL AFTER phone_2');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL AFTER site_url');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL AFTER title');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS description_secondary TEXT DEFAULT NULL AFTER description');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS button_label VARCHAR(80) DEFAULT NULL AFTER description_secondary');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS link_url VARCHAR(1000) DEFAULT NULL AFTER button_label');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0 AFTER link_url');
  await db.query('ALTER TABLE technical_assistance_cards ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER display_order');
  await db.query('ALTER TABLE technical_assistance_cards MODIFY company VARCHAR(255) DEFAULT NULL');
  await db.query('ALTER TABLE technical_assistance_cards MODIFY address VARCHAR(255) DEFAULT NULL');
  await db.query('ALTER TABLE technical_assistance_cards MODIFY city VARCHAR(120) DEFAULT NULL');
  await db.query('ALTER TABLE technical_assistance_cards MODIFY state_code CHAR(2) DEFAULT NULL');
  await db.query("UPDATE technical_assistance_cards SET card_type = 'directory' WHERE card_type IS NULL OR card_type = ''");
  technicalAssistanceTableReady = true;
};

const normalizeSimpleText = (value, maxLength) => (
  sanitizeTextInput(value || '', { preserveNewlines: false, maxLength })
);

const normalizeStateCode = (value) => (
  normalizeSimpleText(value, 2)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
);

const normalizeEmailInput = (value) => (
  normalizeSimpleText(value, 160)
    .toLowerCase()
    .replace(/\s+/g, '')
);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeHttpUrl = (value) => {
  const sanitized = normalizeSimpleText(value, 1000);

  if (!sanitized) {
    return '';
  }

  try {
    const parsedUrl = new URL(sanitized);
    return ['http:', 'https:'].includes(parsedUrl.protocol) ? parsedUrl.toString() : '';
  } catch (error) {
    return '';
  }
};

const normalizeTechnicalAssistancePayload = (input = {}) => ({
  company: normalizeSimpleText(input.company, 255),
  address: normalizeSimpleText(input.address, 255),
  city: normalizeSimpleText(input.city, 120),
  state_code: normalizeStateCode(input.state_code || input.uf),
  phone: normalizeSimpleText(input.phone, 40),
  phone_2: normalizeSimpleText(input.phone_2, 40),
  phone_3: normalizeSimpleText(input.phone_3, 40),
  email: normalizeEmailInput(input.email),
  map_url: normalizeHttpUrl(input.map_url),
  site_url: normalizeHttpUrl(input.site_url)
});

const normalizeContentCardPayload = (input = {}) => ({
  title: normalizeSimpleText(input.title, 255),
  description: sanitizeTextInput(input.description || '', { preserveNewlines: true, maxLength: 1000 }),
  description_secondary: sanitizeTextInput(input.description_secondary || input.descriptionSecondary || '', { preserveNewlines: true, maxLength: 1000 }),
  button_label: normalizeSimpleText(input.button_label || input.buttonLabel || 'Abrir chamado', 80),
  link_url: normalizeHttpUrl(input.link_url || input.linkUrl),
  display_order: Number.isFinite(Number(input.display_order ?? input.displayOrder))
    ? Math.max(0, Math.trunc(Number(input.display_order ?? input.displayOrder)))
    : 0,
  is_active: input.is_active === undefined && input.isActive === undefined
    ? true
    : ['true', '1', 'yes', 'on', true, 1].includes(input.is_active ?? input.isActive)
});

const buildValidationErrors = (payload, rawInput = {}) => {
  const details = [];

  if (!payload.company) {
    details.push({ field: 'company', message: 'Informe a empresa.' });
  }

  if (!payload.address) {
    details.push({ field: 'address', message: 'Informe o endereço.' });
  }

  if (!payload.city) {
    details.push({ field: 'city', message: 'Informe a cidade.' });
  }

  if (!payload.state_code || payload.state_code.length !== 2) {
    details.push({ field: 'state_code', message: 'Informe a UF com 2 letras.' });
  }

  if (payload.email && !isValidEmail(payload.email)) {
    details.push({ field: 'email', message: 'Informe um e-mail válido.' });
  }

  if (rawInput.map_url && !payload.map_url) {
    details.push({ field: 'map_url', message: 'Informe uma URL válida para o mapa.' });
  }

  if (rawInput.site_url && !payload.site_url) {
    details.push({ field: 'site_url', message: 'Informe uma URL válida para o site.' });
  }

  return details;
};

const buildContentCardValidationErrors = (payload, rawInput = {}) => {
  const details = [];

  if (!payload.title) {
    details.push({ field: 'title', message: 'Informe o título do card.' });
  }

  if ((rawInput.link_url || rawInput.linkUrl) && !payload.link_url) {
    details.push({ field: 'link_url', message: 'Informe uma URL válida para o link do card.' });
  }

  return details;
};

const normalizeTechnicalAssistanceRow = (row) => ({
  id: Number(row.id),
  company: normalizeSimpleText(row.company, 255),
  address: normalizeSimpleText(row.address, 255),
  city: normalizeSimpleText(row.city, 120),
  state_code: normalizeStateCode(row.state_code),
  phone: normalizeSimpleText(row.phone, 40),
  phone_2: normalizeSimpleText(row.phone_2, 40),
  phone_3: normalizeSimpleText(row.phone_3, 40),
  email: normalizeEmailInput(row.email),
  map_url: normalizeHttpUrl(row.map_url),
  site_url: normalizeHttpUrl(row.site_url),
  created_at: row.created_at,
  updated_at: row.updated_at
});

const normalizeContentCardRow = (row) => ({
  id: Number(row.id),
  title: normalizeSimpleText(row.title, 255),
  description: sanitizeTextInput(row.description || '', { preserveNewlines: true, maxLength: 1000 }),
  description_secondary: sanitizeTextInput(row.description_secondary || '', { preserveNewlines: true, maxLength: 1000 }),
  button_label: normalizeSimpleText(row.button_label || 'Abrir chamado', 80),
  link_url: normalizeHttpUrl(row.link_url),
  display_order: Number(row.display_order) || 0,
  is_active: row.is_active === true || Number(row.is_active) === 1,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const getContentCardRows = async ({ includeInactive = false } = {}) => {
  const [rows] = await db.query(
    `
      SELECT
        id,
        title,
        description,
        description_secondary,
        button_label,
        link_url,
        display_order,
        is_active,
        created_at,
        updated_at
      FROM technical_assistance_cards
      WHERE card_type = 'content'
        ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY display_order ASC, created_at ASC, id ASC
    `
  );

  return rows.map(normalizeContentCardRow);
};

router.get('/', async (req, res, next) => {
  try {
    await ensureTechnicalAssistanceTable();

    const [rows] = await db.query(`
      SELECT
        id,
        company,
        address,
        city,
        state_code,
        phone,
        phone_2,
        phone_3,
        email,
        map_url,
        site_url,
        created_at,
        updated_at
      FROM technical_assistance_cards
      WHERE card_type = 'directory'
      ORDER BY created_at ASC, id ASC
    `);

    res.json(rows.map(normalizeTechnicalAssistanceRow));
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao carregar os cards da assistência técnica.' }));
  }
});

router.get('/content-cards', async (req, res, next) => {
  try {
    await ensureTechnicalAssistanceTable();
    res.json(await getContentCardRows());
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao carregar os cards de conteúdo da assistência técnica.' }));
  }
});

router.get('/content-cards/admin', requireAdminSession, async (req, res, next) => {
  try {
    await ensureTechnicalAssistanceTable();
    res.json(await getContentCardRows({ includeInactive: true }));
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao carregar os cards de conteúdo da assistência técnica.' }));
  }
});

router.post('/content-cards', requireAdminSession, async (req, res, next) => {
  try {
    await ensureTechnicalAssistanceTable();

    const payload = normalizeContentCardPayload(req.body);
    const details = buildContentCardValidationErrors(payload, req.body);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados inválidos para o card de conteúdo da assistência técnica.',
        details
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO technical_assistance_cards (
          card_type,
          title,
          description,
          description_secondary,
          button_label,
          link_url,
          display_order,
          is_active
        )
        VALUES ('content', ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.title,
        payload.description || null,
        payload.description_secondary || null,
        payload.button_label || null,
        payload.link_url || null,
        payload.display_order,
        payload.is_active ? 1 : 0
      ]
    );

    const [rows] = await db.query('SELECT * FROM technical_assistance_cards WHERE id = ? LIMIT 1', [result.insertId]);

    res.status(201).json({
      message: 'Card de conteúdo da assistência técnica criado com sucesso.',
      item: normalizeContentCardRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao criar o card de conteúdo da assistência técnica.' }));
  }
});

router.put('/content-cards/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureTechnicalAssistanceTable();

    const [existingRows] = await db.query(
      "SELECT id FROM technical_assistance_cards WHERE id = ? AND card_type = 'content' LIMIT 1",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Card de conteúdo da assistência técnica não encontrado.' });
    }

    const payload = normalizeContentCardPayload(req.body);
    const details = buildContentCardValidationErrors(payload, req.body);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados inválidos para o card de conteúdo da assistência técnica.',
        details
      });
    }

    await db.query(
      `
        UPDATE technical_assistance_cards
        SET
          title = ?,
          description = ?,
          description_secondary = ?,
          button_label = ?,
          link_url = ?,
          display_order = ?,
          is_active = ?
        WHERE id = ? AND card_type = 'content'
      `,
      [
        payload.title,
        payload.description || null,
        payload.description_secondary || null,
        payload.button_label || null,
        payload.link_url || null,
        payload.display_order,
        payload.is_active ? 1 : 0,
        id
      ]
    );

    const [rows] = await db.query('SELECT * FROM technical_assistance_cards WHERE id = ? LIMIT 1', [id]);

    res.json({
      message: 'Card de conteúdo da assistência técnica atualizado com sucesso.',
      item: normalizeContentCardRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao atualizar o card de conteúdo da assistência técnica.' }));
  }
});

router.delete('/content-cards/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureTechnicalAssistanceTable();
    await db.query("DELETE FROM technical_assistance_cards WHERE id = ? AND card_type = 'content'", [id]);

    res.json({ message: 'Card de conteúdo da assistência técnica removido com sucesso.' });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao remover o card de conteúdo da assistência técnica.' }));
  }
});

router.post('/', requireAdminSession, async (req, res, next) => {
  try {
    await ensureTechnicalAssistanceTable();

    const payload = normalizeTechnicalAssistancePayload(req.body);
    const details = buildValidationErrors(payload, req.body);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados inválidos para o card de assistência técnica.',
        details
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO technical_assistance_cards (
          company,
          address,
          city,
          state_code,
          phone,
          phone_2,
          phone_3,
          email,
          map_url,
          site_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.company,
        payload.address,
        payload.city,
        payload.state_code,
        payload.phone || null,
        payload.phone_2 || null,
        payload.phone_3 || null,
        payload.email || null,
        payload.map_url || null,
        payload.site_url || null
      ]
    );

    const [rows] = await db.query('SELECT * FROM technical_assistance_cards WHERE id = ? LIMIT 1', [result.insertId]);

    res.status(201).json({
      message: 'Card de assistência técnica criado com sucesso.',
      item: normalizeTechnicalAssistanceRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao criar o card de assistência técnica.' }));
  }
});

router.put('/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureTechnicalAssistanceTable();

    const [existingRows] = await db.query(
      "SELECT id FROM technical_assistance_cards WHERE id = ? AND card_type = 'directory' LIMIT 1",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Card de assistência técnica não encontrado.' });
    }

    const payload = normalizeTechnicalAssistancePayload(req.body);
    const details = buildValidationErrors(payload, req.body);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados inválidos para o card de assistência técnica.',
        details
      });
    }

    await db.query(
      `
        UPDATE technical_assistance_cards
        SET
          company = ?,
          address = ?,
          city = ?,
          state_code = ?,
          phone = ?,
          phone_2 = ?,
          phone_3 = ?,
          email = ?,
          map_url = ?,
          site_url = ?
        WHERE id = ? AND card_type = 'directory'
      `,
      [
        payload.company,
        payload.address,
        payload.city,
        payload.state_code,
        payload.phone || null,
        payload.phone_2 || null,
        payload.phone_3 || null,
        payload.email || null,
        payload.map_url || null,
        payload.site_url || null,
        id
      ]
    );

    const [rows] = await db.query('SELECT * FROM technical_assistance_cards WHERE id = ? LIMIT 1', [id]);

    res.json({
      message: 'Card de assistência técnica atualizado com sucesso.',
      item: normalizeTechnicalAssistanceRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao atualizar o card de assistência técnica.' }));
  }
});

router.delete('/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureTechnicalAssistanceTable();
    await db.query("DELETE FROM technical_assistance_cards WHERE id = ? AND card_type = 'directory'", [id]);

    res.json({ message: 'Card de assistência técnica removido com sucesso.' });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao remover o card de assistência técnica.' }));
  }
});

module.exports = router;
