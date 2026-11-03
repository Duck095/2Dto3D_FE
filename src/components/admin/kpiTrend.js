const trendLabels = Object.freeze({
  up: 'Tăng',
  down: 'Giảm',
  flat: 'Ổn định',
});

export function getKpiTrendLabel(trend) {
  return Object.prototype.hasOwnProperty.call(trendLabels, trend)
    ? trendLabels[trend]
    : null;
}
