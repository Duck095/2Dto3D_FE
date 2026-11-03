import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const layout = await readFile(new URL('./MainLayout.jsx', import.meta.url), 'utf8');
const pagePaths = [
    '../pages/AuthPage.jsx',
    '../pages/AIStudioPage.jsx',
    '../pages/PrintQuotePage.jsx',
    '../pages/ProductsPage.jsx',
    '../pages/WorkflowPage.jsx',
    '../pages/PricingPage.jsx',
    '../pages/ResourcesPage.jsx',
    '../pages/AboutPage.jsx',
];
const pages = await Promise.all(pagePaths.map(path => readFile(new URL(path, import.meta.url), 'utf8')));

test('MainLayout owns the single main landmark around the route outlet', () => {
    assert.match(layout, /<main>\s*<Outlet\s*\/?>\s*<\/main>/);
});

test('customer route pages do not add nested main landmarks', () => {
    for (const [index, page] of pages.entries()) {
        assert.doesNotMatch(page, /<\/?main\b/, `${pagePaths[index]} should use a non-landmark wrapper`);
    }
});

test('Print Quote keeps both empty and valid page wrappers without nested landmarks', () => {
    const printQuote = pages[pagePaths.indexOf('../pages/PrintQuotePage.jsx')];
    assert.match(printQuote, /if \(!isValidPrintDraft\(draft\)\)[\s\S]*?<div className="print-quote-page print-quote-page--empty">/);
    assert.match(printQuote, /return \([\s\S]*?<div className="print-quote-page">/);
    assert.doesNotMatch(printQuote, /<\/?main\b/);
});
