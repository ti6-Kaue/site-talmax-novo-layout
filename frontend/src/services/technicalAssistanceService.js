import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

const TECHNICAL_ASSISTANCE_API_URL = `${API_URL}/technical-assistance`;

const technicalAssistanceService = {
  async getAll() {
    const response = await fetch(TECHNICAL_ASSISTANCE_API_URL);

    if (!response.ok) {
      throw new Error('Erro ao buscar cards da assistencia técnica');
    }

    return response.json();
  },

  async getContentCards({ includeInactive = false } = {}) {
    const response = await fetch(
      `${TECHNICAL_ASSISTANCE_API_URL}/content-cards${includeInactive ? '/admin' : ''}`,
      includeInactive ? createAdminRequestOptions() : undefined
    );

    if (includeInactive) {
      await ensureAdminResponse(response, 'Erro ao buscar cards de conteudo da assistencia técnica');
    } else if (!response.ok) {
      throw new Error('Erro ao buscar cards de conteudo da assistencia técnica');
    }

    return response.json();
  },

  async createContentCard(payload) {
    const response = await fetch(`${TECHNICAL_ASSISTANCE_API_URL}/content-cards`, createAdminRequestOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }));

    await ensureAdminResponse(response, 'Erro ao criar card de conteudo da assistencia técnica');
    return response.json();
  },

  async updateContentCard(id, payload) {
    const response = await fetch(`${TECHNICAL_ASSISTANCE_API_URL}/content-cards/${id}`, createAdminRequestOptions({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }));

    await ensureAdminResponse(response, 'Erro ao atualizar card de conteudo da assistencia técnica');
    return response.json();
  },

  async removeContentCard(id) {
    const response = await fetch(`${TECHNICAL_ASSISTANCE_API_URL}/content-cards/${id}`, createAdminRequestOptions({
      method: 'DELETE'
    }));

    await ensureAdminResponse(response, 'Erro ao remover card de conteudo da assistencia técnica');
    return response.json();
  },

  async create(payload) {
    const response = await fetch(TECHNICAL_ASSISTANCE_API_URL, createAdminRequestOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }));

    await ensureAdminResponse(response, 'Erro ao criar card da assistencia técnica');
    return response.json();
  },

  async update(id, payload) {
    const response = await fetch(`${TECHNICAL_ASSISTANCE_API_URL}/${id}`, createAdminRequestOptions({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }));

    await ensureAdminResponse(response, 'Erro ao atualizar card da assistencia técnica');
    return response.json();
  },

  async remove(id) {
    const response = await fetch(`${TECHNICAL_ASSISTANCE_API_URL}/${id}`, createAdminRequestOptions({
      method: 'DELETE'
    }));

    await ensureAdminResponse(response, 'Erro ao remover card da assistencia técnica');
    return response.json();
  }
};

export default technicalAssistanceService;
