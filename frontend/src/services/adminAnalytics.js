import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

export const getAdminAnalyticsSummary = async ({ days = 30 } = {}) => {
  const params = new URLSearchParams({
    days: String(days)
  });

  const response = await fetch(
    `${API_URL}/analytics/summary?${params.toString()}`,
    createAdminRequestOptions()
  );

  await ensureAdminResponse(response, 'Não foi possivel carregar as metricas do dashboard.');
  return response.json();
};
