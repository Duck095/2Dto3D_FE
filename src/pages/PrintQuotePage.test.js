import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./PrintQuotePage.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./print-quote.css', import.meta.url), 'utf8');
const tokens = await readFile(new URL('../styles/storefront.css', import.meta.url), 'utf8');

function colorToken(name) {
    const value = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
    assert.ok(value, `Missing color token --${name}`);
    return value;
}

function luminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
    const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

test('print quote keeps snapshot preview protected from model downloads', () => {
    assert.match(page, /<ThreeDViewer[\s\S]*?presentationMode[\s\S]*?allowDownload=\{false\}/);
});

test('local technical review preview never claims submission success', () => {
    assert.doesNotMatch(page, /Đã gửi duyệt kỹ thuật|Yêu cầu đã được ghi nhận/);
    assert.match(page, /chưa gửi tới (?:máy chủ|Backend)/i);
    assert.doesNotMatch(page, /setReviewRequested\(true\)/);
});

test('no unapproved hardcoded prices are presented as a quote', () => {
    assert.doesNotMatch(page, /gramPrice|machineRate|formatVND|quote\.total|VND\(/);
    assert.match(page, /đơn giá .*chưa được xác nhận/i);
    assert.match(page, /không phải báo giá/i);
});

test('rule-based advisor is disclosed as local guidance, not staff or backend AI', () => {
    assert.match(page, /Gợi ý cấu hình theo quy tắc/);
    assert.match(page, /không kết nối (?:nhân viên|đội kỹ thuật).*AI Backend/i);
});

test('print draft snapshot fields, sizing, color, and format controls remain connected', () => {
    assert.match(page, /state\?\.printDraft/);
    assert.match(page, /draft\?\.partColors/);
    assert.match(page, /draft\?\.modelScale/);
    assert.match(page, /updatePrintDimension/);
    assert.match(page, /selectFinalFormat/);
    for (const setter of ['setMaterialId', 'setLayerHeight', 'setWalls', 'setInfill', 'setNeedsSupport', 'setQuantity']) {
        assert.match(page, new RegExp(`${setter}\\(`));
    }
});

test('Print Quote applies a model color selected in AI Studio when rendering the saved draft', () => {
    assert.match(page, /draft\?\.modelColor/);
    assert.match(page, /modelColor=\{finalFormat === 'glb' && colorMode === 'color' \? \(draft\?\.modelColor/);
});

test('page styling uses Pocket Joy tokens and responsive layouts without the low-contrast active pair', () => {
    assert.match(page, /print-quote-page/);
    assert.match(styles, /background:\s*var\(--joy-paper\)/);
    assert.match(styles, /var\(--joy-ink\)/);
    assert.match(styles, /max-width:\s*767px/);
    assert.match(styles, /min-width:\s*1280px/);
    assert.doesNotMatch(page, /bg-brand-soft0\s+text-white/);
});

test('dark viewer toolbar uses the bright focus token for selected and unselected controls', () => {
    assert.match(styles, /\.print-quote-page\s+\.print-quote__viewer-controls\s+button:focus-visible\s*\{[^}]*var\(--joy-focus-dark\)/s);
    assert.match(styles, /\.print-quote-page button:focus-visible[\s\S]*?var\(--joy-focus-light\)/);
    const darkFocus = colorToken('joy-focus-dark');
    assert.ok(contrast(darkFocus, colorToken('joy-ink')) >= 3, 'selected toolbar buttons need a visible focus ring');
    assert.ok(contrast(darkFocus, colorToken('joy-ink-strong')) >= 3, 'unselected toolbar buttons need a visible focus ring');
});

test('page distinguishes raw model dimensions, AI Studio snapshot, and Print Quote scale', () => {
    assert.match(page, /Kích thước model ban đầu/);
    assert.match(page, /Kích thước nhận từ AI Studio/);
    assert.match(page, /Tỷ lệ AI Studio theo trục/);
    assert.match(page, /Tỷ lệ Print Quote so với snapshot/);
    assert.match(page, /getDimensionScalePercentages/);
});

test('invalid print drafts keep the empty state and return link', () => {
    assert.match(page, /if \(!isValidPrintDraft\(draft\)\)/);
    assert.match(page, /Chưa có dữ liệu mô hình hợp lệ/);
    assert.match(page, /to="\/studio"/);
});
