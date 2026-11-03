import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const viewer = await readFile(new URL('./ThreeDViewer.jsx', import.meta.url), 'utf8');

test('customization panel download title, format selector, and button are behind allowDownload', () => {
    const downloadTitle = viewer.indexOf('Tải mô hình</p>');
    assert.notEqual(downloadTitle, -1);

    const gate = viewer.lastIndexOf('{allowDownload && <div', downloadTitle);
    assert.notEqual(gate, -1);
    assert.ok(downloadTitle - gate < 300);

    const nextPanel = viewer.indexOf('{activePanel && (activePanel !==', downloadTitle);
    const downloadSection = viewer.slice(downloadTitle, nextPanel);
    assert.match(downloadSection, /<select/);
    assert.match(downloadSection, /Tải về/);
});

test('a stale download panel is not rendered or focusable after permission is disabled', () => {
    assert.equal((viewer.match(/activePanel && \(activePanel !== 'download' \|\| allowDownload\) && \(/g) || []).length, 2);
});

test('all other download entry points stay permission-gated and the handler keeps its guard', () => {
    assert.match(viewer, /activePanel === 'download' && allowDownload/);
    assert.match(viewer, /tool\.id !== 'download' \|\| allowDownload/);
    assert.match(viewer, /presentationMode && allowDownload/);
    assert.match(viewer, /function handleDownload\(\)\s*\{\s*if \(!allowDownload\) return;/);
});

test('color, size, and AI edit tools remain available under their existing permissions', () => {
    assert.match(viewer, /activePanel === 'color' && allowColorCustomization/);
    assert.match(viewer, /activePanel === 'size' && allowDimensionCustomization/);
    assert.match(viewer, /activePanel === 'edit'/);
    assert.match(viewer, /label: 'Tùy chỉnh màu'/);
    assert.match(viewer, /label: 'Tùy chỉnh kích thước'/);
    assert.match(viewer, /label: 'Chỉnh bằng văn bản hoặc ảnh'/);
});

test('viewer reports confirmed color and scale changes through the parent callback without prop-effect callbacks', () => {
    assert.match(viewer, /onCustomizationChange/);
    assert.match(viewer, /function emitCustomizationChange/);
    assert.match(viewer, /emitCustomizationChange\(\{ partColors: nextPartColors/);
    assert.match(viewer, /emitCustomizationChange\(\{ modelColor: hex/);
    assert.match(viewer, /emitCustomizationChange\(\{ modelScale: getViewerModelScale/);
    assert.match(viewer, /function resetProductDimensions\(\)/);
});

test('parent customization overrides are applied without emitting a callback loop', () => {
    const propSync = viewer.slice(viewer.indexOf('// Sync external overrides'), viewer.indexOf('function handlePreset'));
    assert.doesNotMatch(propSync, /onCustomizationChange|emitCustomizationChange/);
});

test('model URL changes reset viewer dimensions even when backend dimensions are unchanged', () => {
    assert.match(viewer, /setProductDimensions\(baseDimensionsCm\);\s*\}, \[baseDimensionsCm, resolvedModelUrl\]\);/);
});
