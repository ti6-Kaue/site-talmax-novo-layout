import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

const API_BASE_URL = `${API_URL}/admin/users`;

const normalizeAdminRequestError = (error) => {
  if (error instanceof TypeError) {
    return new Error('Falha de conexão com a API do painel. Verifique se o backend esta acessível para o admin.');
  }

  return error;
};

const parseApiResponse = async (response, fallbackMessage) => {
  const responseText = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(fallbackMessage);
  }
};

export const listAdminUsers = async () => {
  let response;

  try {
    response = await fetch(API_BASE_URL, createAdminRequestOptions());
  } catch (error) {
    throw normalizeAdminRequestError(error);
  }

  await ensureAdminResponse(response, 'Não foi possível carregar os usuários do painel.');
  return parseApiResponse(response, 'A lista de usuários do painel veio inválida.');
};

export const createAdminUser = async (payload) => {
  let response;

  try {
    response = await fetch(API_BASE_URL, createAdminRequestOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }));
  } catch (error) {
    throw normalizeAdminRequestError(error);
  }

  await ensureAdminResponse(response, 'Não foi possível criar o usuário do painel.');
  return parseApiResponse(response, 'A resposta de criação do usuário veio inválida.');
};

export const updateAdminUser = async (adminUserId, payload) => {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/${adminUserId}`, createAdminRequestOptions({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }));
  } catch (error) {
    throw normalizeAdminRequestError(error);
  }

  await ensureAdminResponse(response, 'Não foi possível atualizar o usuário do painel.');
  return parseApiResponse(response, 'A resposta de atualização do usuário veio inválida.');
};
