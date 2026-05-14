/**
 * Servico para interagir com a API de servicos/segmentos da home.
 */
import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

const homeService = {
  async getAll({ admin = false } = {}) {
    const response = await fetch(
      `${API_URL}/home-services${admin ? '?admin=1' : ''}`,
      admin ? createAdminRequestOptions() : undefined
    );

    if (admin) {
      await ensureAdminResponse(response, 'Erro ao buscar serviços da home');
    } else if (!response.ok) {
      throw new Error('Erro ao buscar serviços da home');
    }

    return response.json();
  },

  async create(formData) {
    const response = await fetch(`${API_URL}/home-services`, createAdminRequestOptions({
      method: 'POST',
      body: formData
    }));
    await ensureAdminResponse(response, 'Erro ao criar serviço');
    return response.json();
  },

  async update(id, formData) {
    const response = await fetch(`${API_URL}/home-services/${id}`, createAdminRequestOptions({
      method: 'PUT',
      body: formData
    }));
    await ensureAdminResponse(response, 'Erro ao atualizar serviço');
    return response.json();
  },

  async updateActiveStatus(id, active) {
    const response = await fetch(`${API_URL}/home-services/${id}/active`, createAdminRequestOptions({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ active }),
    }));
    await ensureAdminResponse(response, 'Erro ao atualizar status do serviço');
    return response.json();
  },

  async delete(id) {
    const response = await fetch(`${API_URL}/home-services/${id}`, createAdminRequestOptions({
      method: 'DELETE',
    }));
    await ensureAdminResponse(response, 'Erro ao excluir serviço');
    return response.json();
  }
};

export default homeService;
