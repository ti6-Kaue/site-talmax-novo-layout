import React from 'react';

const DashboardMetricCard = ({ title, value, description, icon, tone = 'blue', onClick }) => {
  const Tag = onClick ? 'button' : 'article';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`dashboard-metric-card dashboard-metric-card--${tone}`}
      onClick={onClick}
    >
      <span className="dashboard-metric-card__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="dashboard-metric-card__content">
        <span className="dashboard-metric-card__title">{title}</span>
        <strong>{value}</strong>
        {description && <span className="dashboard-metric-card__description">{description}</span>}
      </span>
    </Tag>
  );
};

export default DashboardMetricCard;
