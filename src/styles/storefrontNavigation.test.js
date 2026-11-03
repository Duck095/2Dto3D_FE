import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import test from 'node:test';

const css = await readFile(new URL('./storefront.css', import.meta.url), 'utf8');
const root = postcss.parse(css);

function declarationsFor(selector, maxWidth = null) {
    const declarations = [];
    root.walkRules(rule => {
        if (!rule.selectors.includes(selector)) return;
        const media = rule.parent.type === 'atrule' && rule.parent.name === 'media'
            ? rule.parent.params
            : null;
        if (maxWidth === null && media === null) {
            rule.walkDecls('display', decl => declarations.push({ value: decl.value, important: Boolean(decl.important) }));
        } else if (maxWidth !== null && media?.includes(`max-width:${maxWidth}px`)) {
            rule.walkDecls('display', decl => declarations.push({ value: decl.value, important: Boolean(decl.important) }));
        }
    });
    return declarations;
}

test('desktop hamburger hide rule outranks the shared actions button rule', () => {
    assert.deepEqual(declarationsFor('.site-header__actions .site-header__menu'), [{ value: 'none', important: false }]);
});

test('mobile navigation continues to expose the hamburger through the 1080px breakpoint', () => {
    const tabletRules = declarationsFor('.site-header__menu', 1080);
    const mobileRules = declarationsFor('.site-header__menu', 760);
    assert.ok(tabletRules.some(rule => rule.value === 'inline-flex' && rule.important));
    assert.ok(mobileRules.some(rule => rule.value === 'inline-flex' && rule.important));
});
