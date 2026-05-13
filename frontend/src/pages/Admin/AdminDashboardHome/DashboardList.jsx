import React from 'react';

const DashboardList = ({ title, description, items = [], emptyLabel = 'Sem dados ainda.' }) => (
  <section className="dashboard-list-panel">
    <div className="dashboard-list-panel__header">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>

    {items.length > 0 ? (
      <ol className="dashboard-list">
        {items.map((item, index) => (
          <li key={`${item.label || item.product_id || index}-${index}`}>
            <span className="dashboard-list__rank">{index + 1}</span>
            <span className="dashboard-list__label">{item.label || item.product_name || item.path || 'Item'}</span>
            <strong>{item.total}</strong>
          </li>
        ))}
      </ol>
    ) : (
      <p className="dashboard-empty-state">{emptyLabel}</p>
    )}
  </section>
);

export default DashboardList;
