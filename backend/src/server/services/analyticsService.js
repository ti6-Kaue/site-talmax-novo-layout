const db = require('../../config/database');
const { sanitizeTextInput } = require('../utils/inputSanitization');
const {
  ensureProductDatabaseTables,
  PRODUCTS_TABLE_NAME
} = require('./productService');

const ANALYTICS_EVENTS_TABLE_QUERY = `
  CREATE TABLE IF NOT EXISTS site_analytics_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    visitor_id VARCHAR(80) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    path VARCHAR(255) DEFAULT NULL,
    search_term VARCHAR(160) DEFAULT NULL,
    product_id INT DEFAULT NULL,
    product_name VARCHAR(255) DEFAULT NULL,
    result_count INT DEFAULT NULL,
    metadata_json TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_site_analytics_type_created_at (event_type, created_at),
    KEY idx_site_analytics_visitor_created_at (visitor_id, created_at),
    KEY idx_site_analytics_product_created_at (product_id, created_at),
    KEY idx_site_analytics_created_at (created_at)
  )
`;

const ALLOWED_EVENT_TYPES = new Set([
  'page_view',
  'product_view',
  'product_click',
  'search',
  'quote_click',
  'whatsapp_click'
]);

let analyticsEventsTableReady = false;

const ensureAnalyticsEventsTable = async () => {
  if (analyticsEventsTableReady) {
    return;
  }

  await db.query(ANALYTICS_EVENTS_TABLE_QUERY);
  analyticsEventsTableReady = true;
};

const normalizeText = (value, maxLength) => (
  sanitizeTextInput(value || '', { preserveNewlines: false, maxLength })
);

const normalizePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeResultCount = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const cleanMetadata = Object.entries(value).reduce((metadata, [key, item]) => {
    const cleanKey = normalizeText(key, 60);

    if (!cleanKey) {
      return metadata;
    }

    metadata[cleanKey] = normalizeText(item, 180);
    return metadata;
  }, {});

  return Object.keys(cleanMetadata).length > 0 ? JSON.stringify(cleanMetadata) : null;
};

const normalizeAnalyticsEventPayload = (input = {}) => {
  const eventType = normalizeText(input.event_type || input.eventType, 40);

  return {
    visitorId: normalizeText(input.visitor_id || input.visitorId, 80),
    eventType,
    path: normalizeText(input.path, 255),
    searchTerm: normalizeText(input.search_term || input.searchTerm, 160),
    productId: normalizePositiveInteger(input.product_id || input.productId),
    productName: normalizeText(input.product_name || input.productName, 255),
    resultCount: normalizeResultCount(input.result_count ?? input.resultCount),
    metadataJson: normalizeMetadata(input.metadata)
  };
};

const validateAnalyticsEventPayload = (payload) => {
  const details = [];

  if (!payload.visitorId) {
    details.push({ field: 'visitor_id', message: 'Identificador anônimo ausente.' });
  }

  if (!ALLOWED_EVENT_TYPES.has(payload.eventType)) {
    details.push({ field: 'event_type', message: 'Evento de analytics inválido.' });
  }

  return details;
};

const recordAnalyticsEvent = async (input = {}) => {
  await ensureAnalyticsEventsTable();

  const payload = normalizeAnalyticsEventPayload(input);
  const details = validateAnalyticsEventPayload(payload);

  if (details.length > 0) {
    return { ok: false, details };
  }

  await db.query(
    `
      INSERT INTO site_analytics_events (
        visitor_id,
        event_type,
        path,
        search_term,
        product_id,
        product_name,
        result_count,
        metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.visitorId,
      payload.eventType,
      payload.path || null,
      payload.searchTerm || null,
      payload.productId,
      payload.productName || null,
      payload.resultCount,
      payload.metadataJson
    ]
  );

  return { ok: true };
};

const getCountValue = (rows) => Number(rows?.[0]?.total || 0);

const buildDateKey = (date) => date.toISOString().slice(0, 10);

const buildDailyActivitySeries = (rows = [], days = 14) => {
  const rowsByDate = new Map(
    rows.map((row) => [
      row.activity_date,
      {
        date: row.activity_date,
        label: String(row.activity_date || '').slice(5).split('-').reverse().join('/'),
        visitors: Number(row.visitors || 0),
        page_views: Number(row.page_views || 0),
        product_views: Number(row.product_views || 0),
        searches: Number(row.searches || 0),
        quote_clicks: Number(row.quote_clicks || 0),
        whatsapp_clicks: Number(row.whatsapp_clicks || 0)
      }
    ])
  );

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const dateKey = buildDateKey(date);

    return rowsByDate.get(dateKey) || {
      date: dateKey,
      label: dateKey.slice(5).split('-').reverse().join('/'),
      visitors: 0,
      page_views: 0,
      product_views: 0,
      searches: 0,
      quote_clicks: 0,
      whatsapp_clicks: 0
    };
  });
};

const getAnalyticsSummary = async ({ days = 30 } = {}) => {
  await ensureAnalyticsEventsTable();
  await ensureProductDatabaseTables(db);

  const boundedDays = Math.min(Math.max(Number.parseInt(days, 10) || 30, 1), 90);
  const rangeExpression = 'created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';

  const connection = await db.getConnection();

  try {
    const [todayVisitorsRows] = await connection.query(`
      SELECT COUNT(DISTINCT visitor_id) AS total
      FROM site_analytics_events
      WHERE event_type = 'page_view'
        AND created_at >= CURDATE()
        AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);
    const [periodVisitorsRows] = await connection.query(`
      SELECT COUNT(DISTINCT visitor_id) AS total
      FROM site_analytics_events
      WHERE event_type = 'page_view' AND ${rangeExpression}
    `, [boundedDays]);
    const [pageViewRows] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'page_view' AND ${rangeExpression}
    `, [boundedDays]);
    const [searchRows] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'search' AND ${rangeExpression}
    `, [boundedDays]);
    const [productViewRows] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'product_view' AND ${rangeExpression}
    `, [boundedDays]);
    const [quoteRows] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'quote_click' AND ${rangeExpression}
    `, [boundedDays]);
    const [whatsappRows] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'whatsapp_click' AND ${rangeExpression}
    `, [boundedDays]);
    const [topPages] = await connection.query(`
      SELECT
        COALESCE(
          CONCAT('Produto / ', NULLIF(${PRODUCTS_TABLE_NAME}.name, '')),
          NULLIF(events.path, ''),
          '/'
        ) AS label,
        COUNT(*) AS total
      FROM site_analytics_events events
      LEFT JOIN ${PRODUCTS_TABLE_NAME}
        ON events.path LIKE '/produto/%'
        AND ${PRODUCTS_TABLE_NAME}.id = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(events.path, '?', 1), '/', -1) AS UNSIGNED)
      WHERE events.event_type = 'page_view' AND events.${rangeExpression}
      GROUP BY label
      ORDER BY total DESC, label ASC
      LIMIT 5
    `, [boundedDays]);
    const [topProductsViewed] = await connection.query(`
      SELECT
        COALESCE(NULLIF(product_name, ''), CONCAT('Produto #', product_id)) AS label,
        product_id,
        COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'product_view' AND product_id IS NOT NULL AND ${rangeExpression}
      GROUP BY product_id, label
      ORDER BY total DESC, label ASC
      LIMIT 10
    `, [boundedDays]);
    const [topProductsClicked] = await connection.query(`
      SELECT
        COALESCE(NULLIF(product_name, ''), CONCAT('Produto #', product_id)) AS label,
        product_id,
        COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'product_click' AND product_id IS NOT NULL AND ${rangeExpression}
      GROUP BY product_id, label
      ORDER BY total DESC, label ASC
      LIMIT 5
    `, [boundedDays]);
    const [topQuoteProducts] = await connection.query(`
      SELECT
        COALESCE(NULLIF(product_name, ''), CONCAT('Produto #', product_id)) AS label,
        product_id,
        COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'quote_click' AND ${rangeExpression}
      GROUP BY product_id, label
      ORDER BY total DESC, label ASC
      LIMIT 5
    `, [boundedDays]);
    const [topSearchTerms] = await connection.query(`
      SELECT search_term AS label, COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'search' AND search_term IS NOT NULL AND search_term <> '' AND ${rangeExpression}
      GROUP BY search_term
      ORDER BY total DESC, label ASC
      LIMIT 8
    `, [boundedDays]);
    const [searchesWithoutResults] = await connection.query(`
      SELECT search_term AS label, COUNT(*) AS total
      FROM site_analytics_events
      WHERE event_type = 'search'
        AND result_count = 0
        AND search_term IS NOT NULL
        AND search_term <> ''
        AND ${rangeExpression}
      GROUP BY search_term
      ORDER BY total DESC, label ASC
      LIMIT 8
    `, [boundedDays]);
    const [recentInterests] = await connection.query(`
      SELECT
        event_type,
        path,
        search_term,
        product_id,
        product_name,
        result_count,
        created_at
      FROM site_analytics_events
      WHERE event_type IN ('quote_click', 'whatsapp_click', 'product_view', 'product_click', 'search') AND ${rangeExpression}
      ORDER BY created_at DESC
      LIMIT 8
    `, [boundedDays]);
    const [dailyActivityRows] = await connection.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d') AS activity_date,
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_id END) AS visitors,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) AS product_views,
        SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) AS searches,
        SUM(CASE WHEN event_type = 'quote_click' THEN 1 ELSE 0 END) AS quote_clicks,
        SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END) AS whatsapp_clicks
      FROM site_analytics_events
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY activity_date
      ORDER BY activity_date ASC
    `);

    return {
      period_days: boundedDays,
      totals: {
        visitors_today: getCountValue(todayVisitorsRows),
        visitors_period: getCountValue(periodVisitorsRows),
        page_views: getCountValue(pageViewRows),
        searches: getCountValue(searchRows),
        product_views: getCountValue(productViewRows),
        quote_clicks: getCountValue(quoteRows),
        whatsapp_clicks: getCountValue(whatsappRows)
      },
      top_pages: topPages,
      top_products_viewed: topProductsViewed,
      top_products_clicked: topProductsClicked,
      top_quote_products: topQuoteProducts,
      top_search_terms: topSearchTerms,
      searches_without_results: searchesWithoutResults,
      recent_interests: recentInterests,
      daily_activity: buildDailyActivitySeries(dailyActivityRows, 14)
    };
  } finally {
    connection.release();
  }
};

module.exports = {
  ensureAnalyticsEventsTable,
  getAnalyticsSummary,
  recordAnalyticsEvent
};
