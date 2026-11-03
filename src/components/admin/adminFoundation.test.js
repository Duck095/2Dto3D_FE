import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postcss from 'postcss';

async function readText(url) {
  try {
    return await readFile(url, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

const css = await readText(new URL('../../styles/admin-workspace.css', import.meta.url));
const storefrontCss = await readText(new URL('../../styles/storefront.css', import.meta.url));
const layout = await readText(new URL('../../layouts/AdminLayout.jsx', import.meta.url));
const sharedButton = await readText(new URL('../ui/Button.jsx', import.meta.url));
const componentFiles = await Promise.all([
  'PopCard.jsx',
  'KpiCard.jsx',
  'StatusBadge.jsx',
  'AdminTable.jsx',
  'AdminField.jsx',
].map(file => readText(new URL(`./${file}`, import.meta.url))));

test('Admin skin is imported only by the namespaced Admin layout', () => {
  assert.match(layout, /import ['"].*admin-workspace\.css['"];/);
  assert.match(layout, /className=["']admin-workspace["']/);
  const root = postcss.parse(css);
  const selectors = [];
  root.walkRules(rule => selectors.push(...postcss.list.comma(rule.selector)));

  assert.ok(selectors.length > 0, 'Admin stylesheet must define component selectors');
  for (const selector of selectors) {
    assert.match(selector.trim(), /^\.admin-workspace(?=$|\s|[.:#[>+~])/,
      `selector must stay under .admin-workspace: ${selector}`);
  }
});

test('Admin component foundation provides cards, status tones, semantic table, and labeled native fields', () => {
  const [card, kpi, badge, table, field] = componentFiles;

  assert.match(card, /admin-pop-card/);
  assert.match(kpi, /admin-kpi-card/);
  assert.match(kpi, /getKpiTrendLabel\(trend\)/);
  assert.match(kpi, /detail \|\| trendLabel/);
  assert.match(kpi, /\{trendLabel &&/);
  assert.match(badge, /admin-status-badge/);
  assert.match(table, /<table/);
  assert.match(table, /<caption/);
  assert.match(field, /<label/);
  assert.match(field, /as === 'select' \? 'select' : 'input'/);
  assert.match(field, /aria-describedby/);
  assert.match(field, /aria-invalid/);
});

test('Admin skin defines visible Pop Art states and keyboard focus within its namespace', () => {
  assert.match(css, /--admin-shadow-pop/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:disabled/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /admin-pop-card--sun/);
  assert.match(css, /admin-pop-card--cyan/);
  assert.match(css, /admin-pop-card--coral/);
  assert.match(css, /admin-pop-card--pink/);
  assert.match(css, /max-width: 640px/);
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*transition-duration/);
  assert.match(css, /\.admin-workspace main :focus-visible/);
  assert.doesNotMatch(css, /\.admin-workspace\s+:focus-visible/);
});

test('Pop Art text and focus colors retain WCAG contrast on every card accent', () => {
  const token = name => {
    const match = css.match(new RegExp(`--admin-${name}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(match, `Expected --admin-${name} color token`);
    return match[1];
  };
  const luminance = hex => {
    const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const ink = token('ink');
  const joyInk = storefrontCss.match(/--joy-ink:\s*(#[0-9a-f]{6})/i)?.[1];
  assert.equal(ink.toLowerCase(), '#39234f');
  assert.ok(joyInk, 'Pocket Joy focus color must remain available');
  assert.match(css, /--admin-focus:\s*var\(--joy-ink/);

  for (const accent of ['sun', 'cyan', 'coral', 'pink', 'mint', 'lavender']) {
    const background = token(accent);
    assert.ok(contrast(ink, background) >= 4.5, `ink contrast on ${accent} must reach 4.5:1`);
    assert.ok(contrast(joyInk, background) >= 3, `focus contrast on ${accent} must reach 3:1`);
  }
});

test('table and field expose semantic labels, descriptions, and validation state', () => {
  const table = componentFiles[3];
  const field = componentFiles[4];

  assert.match(table, /role="region" aria-label=\{label\}/);
  assert.match(table, /label = 'Bảng dữ liệu'/);
  assert.match(table, /<caption className="admin-sr-only">\{label\}<\/caption>/);
  assert.match(field, /<label[^>]*htmlFor=\{fieldId\}/);
  assert.match(field, /aria-invalid=\{error \? 'true' : undefined\}/);
  assert.match(field, /aria-describedby=\{helpIds\}/);
  assert.match(field, /as === 'select' \? 'select' : 'input'/);
  assert.match(field, /admin-field__error/);
});

test('shared Button supports native disabled and loading behavior without a duplicate Admin button', () => {
  assert.match(sharedButton, /disabled=\{disabled \|\| loading\}/);
  assert.match(sharedButton, /loading &&/);
});
