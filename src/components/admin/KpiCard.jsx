import { getKpiTrendLabel } from './kpiTrend.js';

const tones = new Set(['sun', 'cyan', 'coral', 'pink', 'mint', 'lavender']);

export default function KpiCard({ title, value, detail, tone = 'sun', trend, className = '' }) {
  const safeTone = tones.has(tone) ? tone : 'sun';
  const trendLabel = getKpiTrendLabel(trend);

  return (
    <article className={`admin-kpi-card admin-kpi-card--${safeTone} ${className}`.trim()}>
      <h2 className="admin-kpi-card__title">{title}</h2>
      <p className="admin-kpi-card__value">{value}</p>
      {(detail || trendLabel) && (
        <p className="admin-kpi-card__detail">
          {trendLabel && <span className={`admin-kpi-card__trend admin-kpi-card__trend--${trend}`}>{trendLabel}</span>}
          {detail && <span>{detail}</span>}
        </p>
      )}
    </article>
  );
}
