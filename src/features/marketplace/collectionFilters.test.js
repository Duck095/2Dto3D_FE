import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { clearCollectionAndSearchParams, filterProductsByCollectionAndSearch } from './collectionFilters.js';

const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { middlewareMode: true, hmr: false },
});
const productData = await vite.ssrLoadModule('/src/data/productModels.js');
after(() => vite.close());

const fixtureProducts = [
    { id: 'fixture-clicker', title: 'Pink clicker', description: 'Soft click', collections: ['clicky-fidget'] },
    { id: 'fixture-charm', title: 'Lavender charm', description: 'Tiny collectible', collections: ['cute-collect'] },
    { id: 'fixture-unclassified', title: 'Unclassified sample' },
];

test('collection filter uses explicit tags and tolerates missing collections', () => {
    assert.deepEqual(
        filterProductsByCollectionAndSearch(fixtureProducts, { collection: 'clicky-fidget' }).map(product => product.id),
        ['fixture-clicker'],
    );
    assert.deepEqual(filterProductsByCollectionAndSearch(undefined, { collection: 'clicky-fidget' }), []);
});

test('collection and text search combine independently', () => {
    assert.deepEqual(
        filterProductsByCollectionAndSearch(fixtureProducts, { collection: 'clicky-fidget', search: 'PINK' }).map(product => product.id),
        ['fixture-clicker'],
    );
    assert.deepEqual(filterProductsByCollectionAndSearch(fixtureProducts, { collection: 'cute-collect', search: 'pink' }), []);
});

test('clearing filters removes collection and search query parameters', () => {
    const cleared = clearCollectionAndSearchParams(new URLSearchParams('collection=clicky-fidget&search=pink&sort=newest'));
    assert.equal(cleared.has('collection'), false);
    assert.equal(cleared.has('search'), false);
    assert.equal(cleared.get('sort'), 'newest');
    assert.equal(filterProductsByCollectionAndSearch(fixtureProducts, {
        collection: cleared.get('collection') || '',
        search: cleared.get('search') || '',
    }).length, fixtureProducts.length);
});

test('store product contract forwards collection tags and defaults to an empty array', () => {
    const baseModel = {
        id: 'fixture',
        visibility: 'public-approved',
        name: 'Fixture product',
        modelImages: [{ id: 1, imagePath: '/images/internal-fixture.jpg', isPrimary: true }],
        filePath3d: '/models/internal-fixture.glb',
        commerce: {},
        category: 'KEYCHAIN',
        modelParts: [],
        sizeXMm: 0,
        sizeYMm: 0,
        sizeZMm: 0,
    };

    assert.deepEqual(productData.toStoreProduct({ ...baseModel, collections: ['cute-collect'] }).collections, ['cute-collect']);
    assert.deepEqual(productData.toStoreProduct(baseModel).collections, []);
    assert.deepEqual(productData.toStoreProduct({ ...baseModel, collections: 'cute-collect' }).collections, []);
    const saleReady = productData.toStoreProduct({
        ...baseModel,
        publicDetails: [{ label: 'Chất liệu', value: 'PLA xác nhận' }],
        publicMedia: {
            images: ['/approved/fixture.webp'],
            modelImages: [{ imagePath: '/images/internal-fixture.jpg' }],
            filePath3d: '/models/internal-fixture.glb',
        },
        commerce: {
            priceNum: 125000,
            priceLabel: '125.000 ₫',
            priceConfirmed: true,
            readyForSale: true,
            materials: [{ id: 'resin', name: 'Resin', premium: 0 }],
            purchaseOptions: [{ id: 'pink', label: 'Hồng', color: '#ee91ae' }],
            verifiedReviews: [{ id: 'review-1', rating: 5, text: 'Fixture review' }],
        },
    });
    assert.equal(saleReady.priceConfirmed, true);
    assert.equal(saleReady.readyForSale, true);
    assert.equal(saleReady.priceLabel, '125.000 ₫');
    assert.deepEqual(saleReady.publicMedia, {
        images: ['/approved/fixture.webp'],
        videoUrl: null,
        modelUrl: null,
    });
    assert.deepEqual(saleReady.materials, [{ id: 'resin', name: 'Resin', premium: 0 }]);
    assert.deepEqual(saleReady.publicDetails, [{ label: 'Chất liệu', value: 'PLA xác nhận' }]);
    assert.deepEqual(saleReady.purchaseOptions, [{ id: 'pink', label: 'Hồng', color: '#ee91ae' }]);
    assert.deepEqual(saleReady.verifiedReviews, [{ id: 'review-1', rating: 5, text: 'Fixture review' }]);
    for (const legacyField of ['img', 'filePath3d', 'thumbnails', 'specs', 'customParts']) {
        assert.equal(Object.hasOwn(saleReady, legacyField), false, `public product must not expose ${legacyField}`);
    }
    assert.equal(productData.toStoreProduct(baseModel).readyForSale, false);
    assert.equal(productData.toStoreProduct(baseModel).priceConfirmed, false);
    assert.ok(productData.STORE_PRODUCTS.every(product => product.visibility === 'public-approved'));
    assert.ok(productData.PRODUCT_LIST_ITEMS.every(item => item.visibility === 'public-approved'));
    assert.ok(productData.PRODUCT_LIST_ITEMS.every(item => !Object.hasOwn(item, 'filePath3d') && !Object.hasOwn(item, 'modelImages')));
    assert.ok(productData.PRODUCT_MODELS.every(product => ['internal-only', 'public-approved'].includes(product.visibility)));
});
