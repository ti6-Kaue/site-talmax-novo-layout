import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

const API_BASE_URL = `${API_URL}/admin`;

const createAdminApiError = (response, data, fallbackMessage) => {
  const error = new Error(data.error || fallbackMessage);
  const retryAfterSeconds = Number.parseInt(data.retry_after_seconds, 10);

  error.statusCode = response.status;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    error.retryAfterSeconds = retryAfterSeconds;
  }

  return error;
};

const normalizeAdminRequestError = (error) => {
  if (error instanceof TypeError) {
    return new Error(
      'Falha de conexão com a API do painel. Verifique se o backend publicado liberou CORS para este dominio.'
    );
  }

  return error;
};

const parseApiResponse = async (response) => {
  const responseText = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(`A API de login não respondeu em JSON. Verifique se o backend esta rodando em ${API_BASE_URL}.`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error('A resposta da API de login veio inválida. Confira o backend do admin.');
  }
};

export const loginAdmin = async (credentials) => {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/login`, createAdminRequestOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    }));
  } catch (error) {
    throw normalizeAdminRequestError(error);
  }

  const data = await parseApiResponse(response);

  if (!response.ok) {
    throw createAdminApiError(response, data, 'Não foi possível entrar no painel.');
  }

  return data;
};

export const validateAdminSession = async (options = {}) => {
  const { timeoutMs = 0 } = options;

  let response;
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timerApi = typeof window !== 'undefined' ? window : globalThis;
  const timeoutId = controller
    ? timerApi.setTimeout(() => {
      controller.abort();
    }, timeoutMs)
    : null;

  try {
    response = await fetch(`${API_BASE_URL}/session`, createAdminRequestOptions({
      signal: controller?.signal
    }));
  } catch (error) {
    throw normalizeAdminRequestError(error);
  } finally {
    if (timeoutId) {
      timerApi.clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    return { authenticated: false };
  }

  const data = await parseApiResponse(response);
  return { authenticated: true, ...data };
};

export const unlockAdminLoginByUser = async (username) => {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/login-unlock`, createAdminRequestOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    }));
  } catch (error) {
    throw normalizeAdminRequestError(error);
  }

  await ensureAdminResponse(response, 'Não foi possível liberar uma nova tentativa de login.');
  return parseApiResponse(response);
};

export const logoutAdmin = async () => {
  try {
    await fetch(`${API_BASE_URL}/logout`, createAdminRequestOptions({ method: 'POST' }));
  } catch (error) {
    throw normalizeAdminRequestError(error);
  }
};
