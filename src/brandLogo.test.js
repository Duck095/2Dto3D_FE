import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const files = {
    navbar: await readFile(new URL('./components/Navbar.jsx', import.meta.url), 'utf8'),
    footer: await readFile(new URL('./components/Footer.jsx', import.meta.url), 'utf8'),
    auth: await readFile(new URL('./pages/AuthPage.jsx', import.meta.url), 'utf8'),
    pricing: await readFile(new URL('./pages/PricingPage.jsx', import.meta.url), 'utf8'),
    styles: await readFile(new URL('./styles/storefront.css', import.meta.url), 'utf8'),
    authStyles: await readFile(new URL('./pages/auth-page.css', import.meta.url), 'utf8'),
    pricingStyles: await readFile(new URL('./pages/pricing.css', import.meta.url), 'utf8'),
};

test('approved logo source is preserved and a smaller web asset is available', async () => {
    const original = await readFile(new URL('./assets/approved-3d-keychain-logo.png', import.meta.url));
    const optimized = await readFile(new URL('./assets/approved-3d-keychain-logo.webp', import.meta.url));

    assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(optimized.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(optimized.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok((await stat(new URL('./assets/approved-3d-keychain-logo.webp', import.meta.url))).size < original.length);
});

test('header and footer use the approved image while keeping 2Dto3D and Pocket Joy labels', () => {
    for (const source of [files.navbar, files.footer]) {
        assert.match(source, /import approvedLogo from ['"]\.\.\/assets\/approved-3d-keychain-logo\.webp['"]/);
        assert.match(source, /<img src=\{approvedLogo\} alt="" aria-hidden="true" className="site-brand__logo"\s*\/>/);
        assert.match(source, /2Dto3D/);
        assert.match(source, /POCKET JOY/);
        assert.doesNotMatch(source, /site-brand__mark/);
    }
});

test('login, registration, and pricing use the approved logo instead of temporary brand marks', () => {
    assert.match(files.auth, /import approvedLogo from ['"]\.\.\/assets\/approved-3d-keychain-logo\.webp['"]/);
    assert.match(files.auth, /className="joy-auth__brand-logo"/);
    assert.doesNotMatch(files.auth, /joy-auth__brand-mark/);
    assert.match(files.pricing, /import approvedLogo from ['"]\.\.\/assets\/approved-3d-keychain-logo\.webp['"]/);
    assert.match(files.pricing, /className="pricing-page__brand-logo"/);
    assert.doesNotMatch(files.pricing, /pricing-page__brand-mark|material-symbols-outlined">favorite/);
});

test('logo styles preserve the entire image without cropping or distortion at responsive sizes', () => {
    assert.match(files.styles, /\.site-brand__logo\s*\{[^}]*object-fit:\s*contain/s);
    assert.match(files.styles, /\.site-footer \.site-brand__logo\s*\{[^}]*object-fit:\s*contain/s);
    assert.match(files.authStyles, /\.joy-auth__brand-logo\s*\{[^}]*object-fit:\s*contain/s);
    assert.match(files.pricingStyles, /\.pricing-page__brand-logo\s*\{[^}]*object-fit:\s*contain/s);
});
