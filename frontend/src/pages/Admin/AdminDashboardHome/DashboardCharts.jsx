import React from 'react';
import { Package } from 'lucide-react';
import { apiAssetPath } from '../../../utils/assets';

const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);

const getMaxValue = (values) => Math.max(1, ...values.map((value) => Number(value) || 0));

const getProductInitials = (value = '') => (
  String(value || 'Produto')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
);

const DashboardRankingChart = ({ title, description, items = [] }) => {
  const visibleItems = items.slice(0, 5);
  const maxValue = getMaxValue(visibleItems.map((item) => item.total));

  return (
    <section className="dashboard-chart-panel">
      <div className="dashboard-chart-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <div className="dashboard-bar-chart">
          {visibleItems.map((item, index) => {
            const percent = Math.max(4, ((Number(item.total) || 0) / maxValue) * 100);

            return (
              <div className="dashboard-bar-row" key={`${item.label}-${index}`}>
                <div className="dashboard-bar-row__meta">
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.total)}</strong>
                </div>
                <div className="dashboard-bar-track" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-empty-state">Ainda não ha dados para este grafico.</p>
      )}
    </section>
  );
};

const DashboardProductAccessChart = ({ items = [] }) => {
  const visibleItems = items.slice(0, 10);
  const maxValue = getMaxValue(visibleItems.map((item) => item.total));

  return (
    <section className="dashboard-chart-panel dashboard-product-access-chart">
      <div className="dashboard-chart-header">
        <div>
          <h3>Top 10 produtos mais acessados</h3>
          <p>Produtos que mais receberam visualizações no site.</p>
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <div className="dashboard-product-chart" aria-label="Grafico dos produtos mais acessados">
          {visibleItems.map((item, index) => {
            const value = Number(item.total) || 0;
            const percent = value > 0 ? Math.max(6, (value / maxValue) * 100) : 0;

            return (
              <div className="dashboard-product-row" key={`${item.label}-${index}`}>
                <span className="dashboard-product-row__rank">{index + 1}</span>
                <span className="dashboard-product-row__media" title={item.label}>
                  {item.image_url ? (
                    <img src={apiAssetPath(item.image_url)} alt={item.label} loading="lazy" />
                  ) : (
                    <span className="dashboard-product-row__media-fallback" aria-hidden="true">
                      <Package size={18} />
                      <small>{getProductInitials(item.label)}</small>
                    </span>
                  )}
                  <span className="dashboard-product-row__sr-label">{item.label}</span>
                </span>
                <div className={`dashboard-product-row__bar dashboard-product-row__bar--${(index % 10) + 1}`} aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                  <strong>{formatNumber(value)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-empty-state">Ainda não há acessos de produtos para mostrar.</p>
      )}
    </section>
  );
};

const DashboardFunnelChart = ({ totals = {} }) => {
  const funnelItems = [
    { label: 'Visitantes', value: totals.visitors_period, color: 'blue' },
    { label: 'Produtos vistos', value: totals.product_views, color: 'green' },
    { label: 'Buscas', value: totals.searches, color: 'orange' },
    { label: 'Orcamentos', value: totals.quote_clicks, color: 'purple' }
  ];
  const maxValue = getMaxValue(funnelItems.map((item) => item.value));

  return (
    <section className="dashboard-chart-panel">
      <div className="dashboard-chart-header">
        <div>
          <h3>Funil de interesse</h3>
          <p>Do acesso ate uma ação comercial.</p>
        </div>
      </div>
      <div className="dashboard-funnel-chart">
        {funnelItems.map((item) => {
          const percent = Math.max(6, ((Number(item.value) || 0) / maxValue) * 100);

          return (
            <div className="dashboard-funnel-row" key={item.label}>
              <span>{item.label}</span>
              <div className="dashboard-funnel-track" aria-hidden="true">
                <i className={`dashboard-funnel-bar dashboard-funnel-bar--${item.color}`} style={{ width: `${percent}%` }} />
              </div>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export {
  DashboardFunnelChart,
  DashboardProductAccessChart,
  DashboardRankingChart
};
