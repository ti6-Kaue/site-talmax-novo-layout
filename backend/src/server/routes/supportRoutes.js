/**
 * CRUD dos cards de conteudo da pagina de Suporte.
 */
const express = require('express');
const db = require('../../config/database');
const { requireAdminSession } = require('../auth/adminSession');
const { wrapError } = require('../utils/errorHandling');
const {
  sanitizeNavigationTarget,
  sanitizeTextInput
} = require('../utils/inputSanitization');

const router = express.Router();

const SUPPORT_CONTENT_CARDS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS support_content_cards (
    id INT NOT NULL AUTO_INCREMENT,
    seed_key VARCHAR(80) DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    description_secondary TEXT DEFAULT NULL,
    button_label VARCHAR(80) DEFAULT NULL,
    link_url VARCHAR(1000) DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_support_content_cards_seed_key (seed_key)
  )
`;

const DEFAULT_SUPPORT_CONTENT_CARDS = [
  {
    seed_key: 'digital',
    title: 'Suporte Digital',
    description: 'Uma equipe especializada em gerar resultados reais para o seu negócio. Oferecemos atendimento personalizado desde a aquisição do sistema CAD/CAM, com treinamentos práticos, orientação completa no uso de softwares e produtos, e um suporte pós-venda próximo e contínuo.',
    description_secondary: 'Estamos ao lado de laboratórios e clínicas em 24 estados e 95 municípios, garantindo performance, segurança e evolução constante.',
    button_label: 'Saiba mais',
    link_url: 'https://talmax.com.br/suportetalmax/',
    display_order: 0
  },
  {
    seed_key: 'produto',
    title: 'Suporte de Produto',
    description: 'Mais do que suporte, entregamos soluções.',
    description_secondary: 'Comprometido em entregar soluções eficientes, nosso time de produtos oferece um suporte técnico especializado para cada necessidade. Trabalhamos com materiais desenvolvidos a partir de rigorosos processos de pesquisa, análise e testes, garantindo qualidade, confiabilidade e segurança em cada aplicação.',
    button_label: 'Saiba mais',
    link_url: 'https://talmax.tomticket.com/?account=3097344P21072020051958',
    display_order: 1
  }
];

let supportContentCardsTableReady = false;

const ensureSupportContentCardsTable = async () => {
  if (supportContentCardsTableReady) {
    return;
  }

  await db.query(SUPPORT_CONTENT_CARDS_TABLE_QUERY);
  await db.query('ALTER TABLE support_content_cards ADD COLUMN IF NOT EXISTS seed_key VARCHAR(80) DEFAULT NULL AFTER id');
  await db.query('ALTER TABLE support_content_cards ADD COLUMN IF NOT EXISTS description_secondary TEXT DEFAULT NULL AFTER description');
  await db.query('ALTER TABLE support_content_cards ADD COLUMN IF NOT EXISTS button_label VARCHAR(80) DEFAULT NULL AFTER description_secondary');
  await db.query('ALTER TABLE support_content_cards ADD COLUMN IF NOT EXISTS link_url VARCHAR(1000) DEFAULT NULL AFTER button_label');
  await db.query('ALTER TABLE support_content_cards ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0 AFTER link_url');
  await db.query('ALTER TABLE support_content_cards ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER display_order');
  supportContentCardsTableReady = true;
};

const normalizeSimpleText = (value, maxLength) => (
  sanitizeTextInput(value || '', { preserveNewlines: false, maxLength })
);

const normalizeSupportContentCardPayload = (input = {}) => ({
  title: normalizeSimpleText(input.title, 255),
  description: sanitizeTextInput(input.description || '', { preserveNewlines: true, maxLength: 1000 }),
  description_secondary: sanitizeTextInput(input.description_secondary || input.descriptionSecondary || '', { preserveNewlines: true, maxLength: 1000 }),
  button_label: normalizeSimpleText(input.button_label || input.buttonLabel || 'Saiba mais', 80),
  link_url: sanitizeNavigationTarget(input.link_url || input.linkUrl || '', { allowExternal: true, allowRelative: true }),
  display_order: Number.isFinite(Number(input.display_order ?? input.displayOrder))
    ? Math.max(0, Math.trunc(Number(input.display_order ?? input.displayOrder)))
    : 0,
  is_active: input.is_active === undefined && input.isActive === undefined
    ? true
    : ['true', '1', 'yes', 'on', true, 1].includes(input.is_active ?? input.isActive)
});

const buildValidationErrors = (payload, rawInput = {}) => {
  const details = [];

  if (!payload.title) {
    details.push({ field: 'title', message: 'Informe o titulo do card.' });
  }

  if ((rawInput.link_url || rawInput.linkUrl) && !payload.link_url) {
    details.push({ field: 'link_url', message: 'Informe uma URL valida para o link do card.' });
  }

  return details;
};

const normalizeSupportContentCardRow = (row) => ({
  id: Number(row.id),
  title: normalizeSimpleText(row.title, 255),
  description: sanitizeTextInput(row.description || '', { preserveNewlines: true, maxLength: 1000 }),
  description_secondary: sanitizeTextInput(row.description_secondary || '', { preserveNewlines: true, maxLength: 1000 }),
  button_label: normalizeSimpleText(row.button_label || 'Saiba mais', 80),
  link_url: sanitizeNavigationTarget(row.link_url || '', { allowExternal: true, allowRelative: true }),
  display_order: Number(row.display_order) || 0,
  is_active: row.is_active === true || Number(row.is_active) === 1,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const ensureDefaultSupportContentCards = async () => {
  await ensureSupportContentCardsTable();

  const [countRows] = await db.query('SELECT COUNT(*) AS total FROM support_content_cards');

  if (Number(countRows[0]?.total) > 0) {
    return;
  }

  for (const card of DEFAULT_SUPPORT_CONTENT_CARDS) {
    await db.query(
      `
        INSERT INTO support_content_cards (
          seed_key,
          title,
          description,
          description_secondary,
          button_label,
          link_url,
          display_order,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        card.seed_key,
        card.title,
        card.description,
        card.description_secondary,
        card.button_label,
        card.link_url,
        card.display_order
      ]
    );
  }
};

const getSupportContentCardRows = async ({ includeInactive = false } = {}) => {
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
      FROM support_content_cards
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY display_order ASC, created_at ASC, id ASC
    `
  );

  return rows.map(normalizeSupportContentCardRow);
};

router.get('/content-cards', async (req, res, next) => {
  try {
    await ensureDefaultSupportContentCards();
    res.json(await getSupportContentCardRows());
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao carregar os cards de suporte.' }));
  }
});

router.get('/content-cards/admin', requireAdminSession, async (req, res, next) => {
  try {
    await ensureDefaultSupportContentCards();
    res.json(await getSupportContentCardRows({ includeInactive: true }));
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao carregar os cards de suporte.' }));
  }
});

router.post('/content-cards', requireAdminSession, async (req, res, next) => {
  try {
    await ensureSupportContentCardsTable();

    const payload = normalizeSupportContentCardPayload(req.body);
    const details = buildValidationErrors(payload, req.body);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados invalidos para o card de suporte.',
        details
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO support_content_cards (
          title,
          description,
          description_secondary,
          button_label,
          link_url,
          display_order,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
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

    const [rows] = await db.query('SELECT * FROM support_content_cards WHERE id = ? LIMIT 1', [result.insertId]);

    res.status(201).json({
      message: 'Card de suporte criado com sucesso.',
      item: normalizeSupportContentCardRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao criar o card de suporte.' }));
  }
});

router.put('/content-cards/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureSupportContentCardsTable();

    const [existingRows] = await db.query('SELECT id FROM support_content_cards WHERE id = ? LIMIT 1', [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Card de suporte nao encontrado.' });
    }

    const payload = normalizeSupportContentCardPayload(req.body);
    const details = buildValidationErrors(payload, req.body);

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Dados invalidos para o card de suporte.',
        details
      });
    }

    await db.query(
      `
        UPDATE support_content_cards
        SET
          title = ?,
          description = ?,
          description_secondary = ?,
          button_label = ?,
          link_url = ?,
          display_order = ?,
          is_active = ?
        WHERE id = ?
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

    const [rows] = await db.query('SELECT * FROM support_content_cards WHERE id = ? LIMIT 1', [id]);

    res.json({
      message: 'Card de suporte atualizado com sucesso.',
      item: normalizeSupportContentCardRow(rows[0])
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao atualizar o card de suporte.' }));
  }
});

router.delete('/content-cards/:id', requireAdminSession, async (req, res, next) => {
  const { id } = req.params;

  try {
    await ensureSupportContentCardsTable();
    await db.query('DELETE FROM support_content_cards WHERE id = ?', [id]);

    res.json({ message: 'Card de suporte removido com sucesso.' });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao remover o card de suporte.' }));
  }
});

module.exports = router;
