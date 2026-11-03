import assert from 'node:assert/strict';
import test from 'node:test';
import { getKpiTrendLabel } from './kpiTrend.js';

test('KPI trend labels only recognize up, down, and flat', () => {
  assert.equal(typeof getKpiTrendLabel, 'function');
  assert.equal(getKpiTrendLabel('up'), 'Tăng');
  assert.equal(getKpiTrendLabel('down'), 'Giảm');
  assert.equal(getKpiTrendLabel('flat'), 'Ổn định');
  assert.equal(getKpiTrendLabel(undefined), null);
  assert.equal(getKpiTrendLabel('unknown'), null);
  assert.equal(getKpiTrendLabel('neutral'), null);
});
