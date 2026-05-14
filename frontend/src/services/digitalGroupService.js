import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

const digitalGroupService = {
  async getAll({ admin = false } = {}) {
    const response = await fetch(
      `${API_URL}/digital-groups${admin ? '?admin=1' : ''}`,
      admin ? createAdminRequestOptions() : { credentials: 'same-origin' }
    );

    if (admin) {
      await ensureAdminResponse(response, 'Erro ao buscar grupos digitais');
    } else if (!response.ok) {
      throw new Error('Erro ao buscar grupos digitais');
    }

    return response.json();
  },

  async getPublicBySlug(slug) {
    const response = await fetch(`${API_URL}/digital-groups/public/${encodeURIComponent(slug)}`);

    if (!response.ok) {
      throw new Error('Grupo digital não encontrado');
    }

    return response.json();
  },

  async create(formData) {
    const response = await fetch(`${API_URL}/digital-groups`, createAdminRequestOptions({
      method: 'POST',
      body: formData
    }));

    await ensureAdminResponse(response, 'Erro ao criar grupo digital');
    return response.json();
  },

  async update(id, formData) {
    const response = await fetch(`${API_URL}/digital-groups/${id}`, createAdminRequestOptions({
      method: 'PUT',
      body: formData
    }));

    await ensureAdminResponse(response, 'Erro ao atualizar grupo digital');
    return response.json();
  },

  async remove(id) {
    const response = await fetch(`${API_URL}/digital-groups/${id}`, createAdminRequestOptions({ method: 'DELETE' }));

    await ensureAdminResponse(response, 'Erro ao remover grupo digital');
    return response.json();
  }
};

export default digitalGroupService;
