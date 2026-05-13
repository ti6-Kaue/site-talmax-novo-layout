import API_URL from './api';
import {
  COOKIE_CONSENT_ACCEPTED,
  readCookieConsentStatus
} from './cookieConsent';

const VISITOR_STORAGE_KEY = 'talmax-visitor-id';
const MAX_TEXT_LENGTH = 180;

const isBrowser = () => typeof window !== 'undefined';

const createVisitorId = () => {
  if (isBrowser() && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getVisitorId = () => {
  if (!isBrowser()) {
    return '';
  }

  try {
    const storedId = window.localStorage.getItem(VISITOR_STORAGE_KEY);

    if (storedId) {
      return storedId;
    }

    const nextId = createVisitorId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return createVisitorId();
  }
};

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) => (
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
);

const canTrackAnalytics = () => (
  isBrowser() && readCookieConsentStatus() === COOKIE_CONSENT_ACCEPTED
);

export const trackAnalyticsEvent = (eventType, payload = {}) => {
  if (!canTrackAnalytics()) {
    return false;
  }

  const eventPayload = {
    visitor_id: getVisitorId(),
    event_type: normalizeText(eventType, 40),
    path: normalizeText(payload.path || window.location.pathname, 255),
    search_term: normalizeText(payload.searchTerm || payload.search_term, 160),
    product_id: payload.productId || payload.product_id || null,
    product_name: normalizeText(payload.productName || payload.product_name, 255),
    result_count: Number.isInteger(payload.resultCount) ? payload.resultCount : payload.result_count,
    metadata: payload.metadata || {}
  };

  const body = JSON.stringify(eventPayload);
  const endpoint = `${API_URL}/analytics/events`;

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    return navigator.sendBeacon(endpoint, blob);
  }

  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body,
    keepalive: true
  }).catch(() => {});

  return true;
};

export const trackPageView = (path) => trackAnalyticsEvent('page_view', { path });

export const trackSearch = ({ searchTerm, resultCount, source } = {}) => (
  trackAnalyticsEvent('search', {
    searchTerm,
    resultCount,
    metadata: { source }
  })
);

export const trackProductView = (product) => (
  trackAnalyticsEvent('product_view', {
    productId: product?.id,
    productName: product?.name
  })
);

export const trackProductClick = (product, source = 'product_card') => (
  trackAnalyticsEvent('product_click', {
    productId: product?.id,
    productName: product?.name,
    metadata: { source }
  })
);

export const trackQuoteClick = (product, source = 'product_detail') => (
  trackAnalyticsEvent('quote_click', {
    productId: product?.id,
    productName: product?.name,
    metadata: { source }
  })
);

export const trackWhatsappClick = (source = 'footer') => (
  trackAnalyticsEvent('whatsapp_click', {
    metadata: { source }
  })
);
