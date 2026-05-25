import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

export const productService = {
  getAll: async () => {
    const res = await fetch(`${API_URL}/products?include_inactive=true`, createAdminRequestOptions());
    await ensureAdminResponse(res, 'Erro ao carregar produtos');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_URL}/products/${id}`, createAdminRequestOptions());
    if (!res.ok) throw new Error('Erro ao carregar produto');
    return res.json();
  },

  create: async (formData) => {
    const res = await fetch(`${API_URL}/products`, createAdminRequestOptions({
      method: 'POST',
      body: formData
    }));
    await ensureAdminResponse(res, 'Erro ao criar produto');
    return res.json();
  },

  update: async (id, formData) => {
    const res = await fetch(`${API_URL}/products/${id}`, createAdminRequestOptions({
      method: 'PUT',
      body: formData
    }));
    await ensureAdminResponse(res, 'Erro ao atualizar produto');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/products/${id}`, createAdminRequestOptions({ method: 'DELETE' }));
    await ensureAdminResponse(res, 'Erro ao excluir produto');
    return res.json();
  },

  updateActiveStatus: async (id, isActive) => {
    const res = await fetch(`${API_URL}/products/${id}/active`, createAdminRequestOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    }));
    await ensureAdminResponse(res, 'Erro ao atualizar status do produto');
    return res.json();
  },

  updateQuoteButtonStatus: async (id, showQuoteButton) => {
    const res = await fetch(`${API_URL}/products/${id}/quote-button`, createAdminRequestOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showQuoteButton })
    }));
    await ensureAdminResponse(res, 'Erro ao atualizar botão de orçamento');
    return res.json();
  },

  updateFeatured: async (selectedProducts) => {
    const res = await fetch(`${API_URL}/featured-products`, createAdminRequestOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_products: selectedProducts })
    }));
    await ensureAdminResponse(res, 'Erro ao atualizar produtos em destaque');
    return res.json();
  }
};
