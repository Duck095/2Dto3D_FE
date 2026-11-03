import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCartItemSnapshot,
    findPublicProduct,
    getApprovedProductMedia,
    getPublicProducts,
    isReadyForSale,
    requiresProductDetailSelection,
    resolveStorefrontPricing,
} from './productPresentation.js';

const fixtures = [
    { id: 11, visibility: 'public-approved', title: 'Fixture charm' },
    { id: 12, visibility: 'internal-only', title: 'Internal fixture' },
];

test('public product list excludes internal and unapproved fixtures', () => {
    assert.deepEqual(getPublicProducts(fixtures).map(product => product.id), [11]);
    assert.deepEqual(getPublicProducts(undefined), []);
});

test('product detail lookup treats unknown and internal IDs as unavailable', () => {
    assert.equal(findPublicProduct(fixtures, '11')?.title, 'Fixture charm');
    assert.equal(findPublicProduct(fixtures, '12'), null);
    assert.equal(findPublicProduct(fixtures, '999'), null);
});

test('public approval alone does not enable purchase', () => {
    assert.equal(isReadyForSale(fixtures[0]), false);
    assert.equal(isReadyForSale({ ...fixtures[0], readyForSale: true, priceConfirmed: true, priceNum: 125000 }), true);
    assert.equal(isReadyForSale({ ...fixtures[0], readyForSale: true, priceConfirmed: false, priceNum: 125000 }), false);
    assert.equal(isReadyForSale({ ...fixtures[0], readyForSale: true, priceConfirmed: true, priceNum: 0 }), false);
});

const sellableFixture = (overrides = {}) => ({
    id: 'fixture-sellable',
    visibility: 'public-approved',
    readyForSale: true,
    priceConfirmed: true,
    priceNum: 125000,
    materials: [],
    purchaseOptions: [],
    publicMedia: { images: ['/approved/front.webp'], modelUrl: '/approved/model.glb' },
    ...overrides,
});

test('zero and negative variant prices are rejected without falling back to base price', () => {
    const product = sellableFixture({ purchaseOptions: [{ id: 'zero', priceNum: 0 }, { id: 'negative', priceNum: -1 }] });
    for (const option of product.purchaseOptions) {
        const pricing = resolveStorefrontPricing(product, { option });
        assert.equal(pricing.canPurchase, false);
        assert.equal(pricing.priceLabel, null);
        assert.equal(pricing.status, 'invalid-option-price');
        assert.equal(createCartItemSnapshot(product, { option }), null);
    }
});

test('invalid price delta and invalid totals disable purchase', () => {
    const product = sellableFixture({ purchaseOptions: [{ id: 'invalid', priceDelta: -125000 }] });
    const pricing = resolveStorefrontPricing(product, { option: product.purchaseOptions[0] });
    assert.equal(pricing.canPurchase, false);
    assert.equal(pricing.status, 'invalid-option-price');
    assert.equal(createCartItemSnapshot(product, { option: product.purchaseOptions[0] }), null);

    const malformed = sellableFixture({ purchaseOptions: [{ id: 'malformed', priceDelta: '5000' }] });
    assert.equal(resolveStorefrontPricing(malformed, { option: malformed.purchaseOptions[0] }).canPurchase, false);
});

test('material surcharge is included in both displayed and cart unit price', () => {
    const product = sellableFixture({ materials: [{ id: 'resin', name: 'Resin', premium: 12000 }] });
    const pricing = resolveStorefrontPricing(product);
    const cartItem = createCartItemSnapshot(product);
    assert.equal(pricing.priceLabel, '137.000 ₫');
    assert.equal(cartItem.priceNum + cartItem.materialPremium, pricing.totalPrice);
    assert.equal(cartItem.priceNum + cartItem.materialPremium, 137000);
    assert.equal(cartItem.materialId, 'resin');

    const variantProduct = sellableFixture({
        purchaseOptions: [{ id: 'large', priceDelta: 10000 }],
        materials: [{ id: 'resin', name: 'Resin', premium: 12000 }],
    });
    const variantPricing = resolveStorefrontPricing(variantProduct);
    const variantCartItem = createCartItemSnapshot(variantProduct);
    assert.equal(variantPricing.priceLabel, '147.000 ₫');
    assert.equal(variantCartItem.priceNum + variantCartItem.materialPremium, variantPricing.totalPrice);
});

test('invalid material surcharge disables purchase instead of defaulting to zero', () => {
    const product = sellableFixture({ materials: [{ id: 'invalid', name: 'Invalid', premium: -5000 }] });
    const pricing = resolveStorefrontPricing(product);
    assert.equal(pricing.status, 'invalid-material-premium');
    assert.equal(pricing.canPurchase, false);
    assert.equal(createCartItemSnapshot(product), null);
});

test('multiple variants require an explicit selection and preserve the selected price', () => {
    const product = sellableFixture({ purchaseOptions: [
        { id: 'small', label: 'Nhỏ', priceNum: 100000 },
        { id: 'large', label: 'Lớn', priceNum: 150000 },
    ] });
    assert.equal(requiresProductDetailSelection(product), true);
    assert.equal(resolveStorefrontPricing(product).status, 'option-required');
    assert.equal(createCartItemSnapshot(product), null);

    const selected = product.purchaseOptions[1];
    const pricing = resolveStorefrontPricing(product, { option: selected });
    const cartItem = createCartItemSnapshot(product, { option: selected });
    assert.equal(pricing.priceLabel, '150.000 ₫');
    assert.equal(cartItem.priceNum, pricing.basePrice);
    assert.equal(cartItem.variantId, 'large');
    assert.equal(cartItem.variantLabel, 'Lớn');
});

test('displayed and cart prices use the same resolver, and invalid sale data cannot enter cart', () => {
    const product = sellableFixture({ materials: [{ id: 'color', name: 'Màu', premium: 7000 }] });
    const pricing = resolveStorefrontPricing(product);
    const cartItem = createCartItemSnapshot(product);
    assert.equal(Number(pricing.priceLabel.replace(/[. ₫]/g, '')), cartItem.priceNum + cartItem.materialPremium);
    assert.equal(createCartItemSnapshot({ ...product, readyForSale: false }), null);
    assert.equal(createCartItemSnapshot({ ...product, priceConfirmed: false }), null);
    assert.equal(createCartItemSnapshot({ ...product, priceNum: 0 }), null);
});

test('cart snapshot uses approved media only and never falls back to legacy paths', () => {
    const product = sellableFixture({ img: '/images/internal.jpg', filePath3d: '/models/internal.glb' });
    const cartItem = createCartItemSnapshot(product);
    assert.equal(cartItem.img, '/approved/front.webp');
    assert.equal(cartItem.filePath3d, '/approved/model.glb');

    const noMedia = createCartItemSnapshot({ ...product, publicMedia: null });
    assert.equal(noMedia.img, null);
    assert.equal(noMedia.filePath3d, null);
});

test('only explicitly published media fields are returned', () => {
    const media = getApprovedProductMedia({
        visibility: 'public-approved',
        img: '/images/internal.jpg',
        filePath3d: '/models/internal.glb',
        publicMedia: {
            images: ['/approved/charm-front.webp'],
            videoUrl: '/approved/charm-demo.mp4',
            modelUrl: '/approved/charm.glb',
        },
    });

    assert.deepEqual(media, {
        images: ['/approved/charm-front.webp'],
        videoUrl: '/approved/charm-demo.mp4',
        modelUrl: '/approved/charm.glb',
    });
    assert.deepEqual(getApprovedProductMedia({ img: '/images/internal.jpg', filePath3d: '/models/internal.glb' }), {
        images: [],
        videoUrl: null,
        modelUrl: null,
    });
    assert.deepEqual(getApprovedProductMedia({
        visibility: 'internal-only',
        publicMedia: { images: ['/internal/hidden.jpg'], modelUrl: '/models/hidden.glb' },
    }), { images: [], videoUrl: null, modelUrl: null });
});
