/**
 * Gerencia textos e logos das paginas especiais do site.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../../config/database');
const upload = require('../config/upload');
const { requireAdminSession } = require('../auth/adminSession');
const { persistUploadedFile, persistExistingLocalFile, hasCloudinaryConfig } = require('../services/fileStorageService');
const { getServedImageDirs } = require('../config/imageStorage');
const { safe } = require('../utils/common');
const { wrapError } = require('../utils/errorHandling');
const {
  sanitizeAssetReference,
  sanitizeNavigationTarget,
  sanitizeTextInput
} = require('../utils/inputSanitization');

const router = express.Router();
const LEGACY_TECHNICAL_ASSISTANCE_DEFAULT_BANNER = '/img/assistenciatecnica-2.jpg.webp';
const LEGACY_SUPPORT_DEFAULT_LOGO = '/img/logo-talmax-suporte.png.webp';

const PAGE_SETTINGS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS page_settings (
    id INT NOT NULL AUTO_INCREMENT,
    page_name VARCHAR(50) NOT NULL,
    logo_url VARCHAR(500) DEFAULT NULL,
    content JSON DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_page_settings_page_name (page_name)
  )
`;

const DEFAULT_PAGE_SETTINGS = {
  'talmax-digital': {
    page_name: 'talmax-digital',
    label: 'Talmax Digital',
    overline: 'TECNOLOGIA ODONTOLOGICA',
    title: 'Talmax Digital',
    description: 'O futuro da protese dentaria com tecnologia de ponta e precisao absoluta.',
    logo_url: '/img/logo-talmax-digital-pos.png',
    carousel_categories: []
  },
  upcera: {
    page_name: 'upcera',
    label: 'Upcera',
    overline: '',
    title: 'Innovation in Restorative Dentistry',
    description: 'Lider mundial em ceramicas odontologicas de alta performance, unindo estetica natural e resistencia extrema.',
    logo_url: '/img/logo-upcera-.webp'
  },
  scanners: {
    page_name: 'scanners',
    label: 'Scanners',
    overline: '',
    title: 'Digital Reality Capture',
    description: 'A mais alta tecnologia em digitalizacao 3D, transformando o fluxo fisico em digital com precisao absoluta.',
    logo_url: '/img/titulo-pag-scanners.png'
  },
  printers: {
    page_name: 'printers',
    label: 'Impressoras 3D',
    overline: '',
    title: 'High Precision Printing',
    description: 'A revolucao da manufatura aditiva com precisao industrial para o fluxo digital odontologico.',
    logo_url: '/img/impressoras3d.png'
  },
  'assistencia-tecnica': {
    page_name: 'assistencia-tecnica',
    label: 'Assistencia Tecnica',
    overline: '',
    title: 'Assistencia Tecnica',
    description: 'Confianca em cada servico, com\npecas originais e alto\npadrao de qualidade.',
    logo_url: '',
    banner_url: '',
    hero_content_x: 50,
    hero_content_y: 45,
    logo_width: 238,
    hero_tagline: 'Confianca em cada servico, com pecas originais e alto padrao de qualidade.',
    card_title: 'Assistencia Tecnica',
    card_description: 'Um time altamente especializado em qualidade, pronto para entregar rapidez, precisao e seguranca na manutencao dos seus equipamentos.',
    card_description_secondary: 'Trabalhamos para reduzir o tempo de parada e garantir o maximo desempenho, levando mais confianca e excelencia a cada atendimento.',
    card_button_label: 'Abrir chamado',
    card_url: 'https://talmax.tomticket.com/'
  },
  support: {
    page_name: 'support',
    label: 'Suporte',
    overline: '',
    title: 'Suporte Talmax',
    description: 'Estamos com voc\u00ea todos os dias, investindo em solu\u00e7\u00f5es, tecnologias e pessoas.',
    logo_url: '',
    banner_url: '',
    hero_content_x: 72,
    hero_content_y: 48,
    logo_width: 225,
    hero_tagline: 'Estamos com voc\u00ea todos os dias, investindo em solu\u00e7\u00f5es, tecnologias e pessoas.',
    info_title: 'Ao seu lado em cada resultado',
    info_subtitle: 'Atendimento especializado, \u00e1gil e conectado para impulsionar seus resultados todos os dias',
    info_body: [
      'Na Talmax, suporte vai al\u00e9m do atendimento. \u00c9 parceria no seu dia a dia. Investimos continuamente em tecnologia, processos e pessoas para entregar uma experi\u00eancia \u00e1gil, pr\u00f3xima e realmente eficiente.',
      'Nosso time est\u00e1 preparado para entender suas demandas e transformar desafios em solu\u00e7\u00f5es, trazendo mais dinamismo, seguran\u00e7a e excel\u00eancia para a rotina de t\u00e9cnicos e dentistas em laborat\u00f3rios, cl\u00ednicas e dentais em todo o Brasil.',
      'Com uma plataforma digital completa, voc\u00ea tem acesso a abertura de chamados, atendimento via chat, hist\u00f3rico integrado e um portal de conhecimento sempre dispon\u00edvel para apoiar sua opera\u00e7\u00e3o.'
    ].join('\n\n')
  }
};

let pageSettingsTableReady = false;

const ensurePageSettingsTable = async () => {
  if (pageSettingsTableReady) {
    return;
  }

  await db.query(PAGE_SETTINGS_TABLE_QUERY);
  await db.query('ALTER TABLE page_settings ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) DEFAULT NULL AFTER page_name');
  await db.query(`
    UPDATE page_settings
    SET logo_url = JSON_UNQUOTE(JSON_EXTRACT(content, '$.logo_url'))
    WHERE (logo_url IS NULL OR logo_url = '')
      AND JSON_EXTRACT(content, '$.logo_url') IS NOT NULL
  `);
  pageSettingsTableReady = true;
};

const parseContent = (value) => {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  return value && typeof value === 'object' ? value : {};
};

const clampNumber = (value, fallback, min, max) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
};

const resolveLegacyImagePath = (assetUrl) => {
  if (!assetUrl || typeof assetUrl !== 'string' || !assetUrl.startsWith('/img/')) {
    return null;
  }

  const fileName = assetUrl.replace(/^\/img\//, '');
  const candidatePath = getServedImageDirs()
    .map((directoryPath) => path.join(directoryPath, fileName))
    .find((currentPath) => fs.existsSync(currentPath));

  return candidatePath || null;
};

const normalizePageSetting = (pageName, content = {}, explicitLogoUrl = null) => {
  const defaults = DEFAULT_PAGE_SETTINGS[pageName];

  if (!defaults) {
    return null;
  }

  const bannerUrl = sanitizeAssetReference(content.banner_url ?? defaults.banner_url ?? '');

  const logoUrl = sanitizeAssetReference(explicitLogoUrl ?? content.logo_url ?? defaults.logo_url);

  return {
    ...defaults,
    overline: sanitizeTextInput(content.overline ?? defaults.overline, { preserveNewlines: false }),
    title: sanitizeTextInput(content.title ?? defaults.title, { preserveNewlines: false }),
    description: sanitizeTextInput(content.description ?? defaults.description, { preserveNewlines: true }),
    logo_url: pageName === 'support' && logoUrl === LEGACY_SUPPORT_DEFAULT_LOGO
      ? ''
      : logoUrl,
    banner_url: pageName === 'assistencia-tecnica' && bannerUrl === LEGACY_TECHNICAL_ASSISTANCE_DEFAULT_BANNER
      ? ''
      : bannerUrl,
    hero_content_x: clampNumber(content.hero_content_x ?? defaults.hero_content_x, defaults.hero_content_x ?? 50, 0, 100),
    hero_content_y: clampNumber(content.hero_content_y ?? defaults.hero_content_y, defaults.hero_content_y ?? 45, 0, 100),
    logo_width: clampNumber(content.logo_width ?? defaults.logo_width, defaults.logo_width ?? 238, 80, 520),
    hero_tagline: sanitizeTextInput(content.hero_tagline ?? defaults.hero_tagline ?? '', { preserveNewlines: false, maxLength: 240 }),
    card_title: sanitizeTextInput(content.card_title ?? defaults.card_title ?? '', { preserveNewlines: false, maxLength: 120 }),
    card_description: sanitizeTextInput(content.card_description ?? defaults.card_description ?? '', { preserveNewlines: true, maxLength: 700 }),
    card_description_secondary: sanitizeTextInput(content.card_description_secondary ?? defaults.card_description_secondary ?? '', { preserveNewlines: true, maxLength: 700 }),
    card_button_label: sanitizeTextInput(content.card_button_label ?? defaults.card_button_label ?? '', { preserveNewlines: false, maxLength: 80 }),
    card_url: sanitizeNavigationTarget(content.card_url ?? defaults.card_url ?? '', { allowExternal: true, allowRelative: true }),
    info_title: sanitizeTextInput(content.info_title ?? defaults.info_title ?? '', { preserveNewlines: false, maxLength: 160 }),
    info_subtitle: sanitizeTextInput(content.info_subtitle ?? defaults.info_subtitle ?? '', { preserveNewlines: false, maxLength: 240 }),
    info_body: sanitizeTextInput(content.info_body ?? defaults.info_body ?? '', { preserveNewlines: true, maxLength: 2400 }),
    carousel_categories: Array.isArray(content.carousel_categories)
      ? content.carousel_categories
        .map((item) => ({
          id: Number(item?.id || 0),
          name: sanitizeTextInput(item?.name || '', { preserveNewlines: false, maxLength: 120 }),
          slug: sanitizeTextInput(item?.slug || '', { preserveNewlines: false, maxLength: 160 }),
          parent_id: item?.parent_id ? Number(item.parent_id) : null
        }))
        .filter((item) => item.id > 0 && item.name && item.slug)
      : defaults.carousel_categories || []
  };
};

const buildStoredContent = (setting) => {
  const {
    logo_url: _logoUrl,
    updated_at: _updatedAt,
    ...content
  } = setting;

  return content;
};

const ensureDefaultRows = async () => {
  await ensurePageSettingsTable();

  for (const [pageName, defaults] of Object.entries(DEFAULT_PAGE_SETTINGS)) {
    await db.query(
      `
        INSERT INTO page_settings (page_name, logo_url, content)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE page_name = VALUES(page_name)
      `,
      [pageName, defaults.logo_url, JSON.stringify(buildStoredContent(defaults))]
    );
  }
};

router.get('/', async (req, res, next) => {
  try {
    await ensureDefaultRows();

    const [rows] = await db.query(
      'SELECT page_name, logo_url, content, updated_at FROM page_settings WHERE page_name IN (?) ORDER BY page_name ASC',
      [Object.keys(DEFAULT_PAGE_SETTINGS)]
    );

    const items = rows
      .map((row) => {
        const normalized = normalizePageSetting(row.page_name, parseContent(row.content), row.logo_url);

        if (!normalized) {
          return null;
        }

        return {
          ...normalized,
          updated_at: row.updated_at
        };
      })
      .filter(Boolean);

    res.json(items);
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao carregar configuracoes das paginas.' }));
  }
});

router.put('/:pageName', requireAdminSession, upload.any(), async (req, res, next) => {
  const { pageName } = req.params;

  if (!DEFAULT_PAGE_SETTINGS[pageName]) {
    return res.status(404).json({ error: 'Pagina especial nao encontrada.' });
  }

  try {
    await ensureDefaultRows();

    const [rows] = await db.query(
      'SELECT logo_url, content FROM page_settings WHERE page_name = ? LIMIT 1',
      [pageName]
    );

    const currentContent = normalizePageSetting(pageName, parseContent(rows[0]?.content), rows[0]?.logo_url);
    const logoFile = Array.isArray(req.files) ? req.files.find((file) => file.fieldname === 'logo') : null;
    const bannerFile = Array.isArray(req.files) ? req.files.find((file) => file.fieldname === 'banner') : null;
    let nextLogoUrl = logoFile
      ? await persistUploadedFile(logoFile, { resourceType: 'page-settings' })
      : sanitizeAssetReference(req.body.logo_url ?? currentContent.logo_url ?? '');
    let nextBannerUrl = bannerFile
      ? await persistUploadedFile(bannerFile, { resourceType: 'page-settings' })
      : sanitizeAssetReference(req.body.banner_url ?? currentContent.banner_url ?? '');

    if (!logoFile && hasCloudinaryConfig() && typeof nextLogoUrl === 'string' && nextLogoUrl.startsWith('/img/')) {
      const existingAssetPath = resolveLegacyImagePath(nextLogoUrl);

      if (existingAssetPath) {
        nextLogoUrl = await persistExistingLocalFile(existingAssetPath, { resourceType: 'page-settings' });
      }
    }

    if (!bannerFile && hasCloudinaryConfig() && typeof nextBannerUrl === 'string' && nextBannerUrl.startsWith('/img/')) {
      const existingAssetPath = resolveLegacyImagePath(nextBannerUrl);

      if (existingAssetPath) {
        nextBannerUrl = await persistExistingLocalFile(existingAssetPath, { resourceType: 'page-settings' });
      }
    }

    const updatedContent = normalizePageSetting(pageName, {
      ...currentContent,
      overline: req.body.overline,
      title: req.body.title,
      description: req.body.description,
      banner_url: nextBannerUrl,
      hero_content_x: req.body.hero_content_x,
      hero_content_y: req.body.hero_content_y,
      logo_width: req.body.logo_width,
      hero_tagline: req.body.hero_tagline,
      card_title: req.body.card_title,
      card_description: req.body.card_description,
      card_description_secondary: req.body.card_description_secondary,
      card_button_label: req.body.card_button_label,
      card_url: req.body.card_url,
      info_title: req.body.info_title,
      info_subtitle: req.body.info_subtitle,
      info_body: req.body.info_body,
      carousel_categories: parseContent(req.body.carousel_categories)
    }, nextLogoUrl);

    await db.query(
      'UPDATE page_settings SET logo_url = ?, content = ? WHERE page_name = ?',
      [
        safe(nextLogoUrl || null),
        JSON.stringify(buildStoredContent(updatedContent)),
        pageName
      ]
    );

    res.json({
      message: 'Configuracao atualizada com sucesso.',
      item: {
        ...updatedContent,
        logo_url: sanitizeAssetReference(nextLogoUrl)
      }
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao salvar configuracao da pagina especial.' }));
  }
});

module.exports = router;
