import assert from 'node:assert/strict';
import test from 'node:test';
import { CART_QUARANTINE_KEY, CART_STORAGE_KEY, persistCart, restoreCart } from './cartStorage.js';
import { mergeExistingCartItem } from './cartState.js';

function createStorage(initial = {}, { failSetItem = () => false } = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => {
            if (failSetItem(key, value)) throw new Error('storage denied');
            values.set(key, String(value));
        },
        value: key => values.get(key) ?? null,
    };
}

function product(overrides = {}) {
    return {
        id: 42,
        visibility: 'public-approved',
        title: 'Pocket item',
        priceNum: 125000,
        priceConfirmed: true,
        readyForSale: true,
        purchaseOptions: [{ id: 'small', label: 'Nhỏ', priceDelta: 0 }],
        materials: [{ id: 'pink', name: 'Hồng', premium: 10000 }],
        publicMedia: { images: ['/approved.jpg'], modelUrl: '/approved.glb' },
        ...overrides,
    };
}

function storedItem(overrides = {}) {
    return {
        key: 'tampered-key',
        productId: 42,
        title: 'Tampered title',
        img: '/models/internal.jpg',
        filePath3d: '/models/internal.glb',
        priceNum: 1,
        materialPremium: 0,
        variantId: 'small',
        materialId: 'pink',
        quantity: 2,
        ...overrides,
    };
}

test('restores a legacy cart by recalculating current price and approved media', () => {
    const storage = createStorage({ [CART_STORAGE_KEY]: JSON.stringify([storedItem()]) });
    const result = restoreCart(storage, [product()]);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].priceNum, 125000);
    assert.equal(result.items[0].materialPremium, 10000);
    assert.equal(result.items[0].img, '/approved.jpg');
    assert.equal(result.items[0].filePath3d, '/approved.glb');
    assert.equal(result.items[0].quantity, 2);
    assert.equal(result.invalidCount, 0);
});

test('quarantines malformed JSON and restores an empty cart', () => {
    const storage = createStorage({ [CART_STORAGE_KEY]: '{broken json' });
    const result = restoreCart(storage, [product()]);
    const quarantine = JSON.parse(storage.value(CART_QUARANTINE_KEY));

    assert.deepEqual(result.items, []);
    assert.equal(result.invalidCount, 1);
    assert.equal(quarantine.entries[0].raw, '{broken json');
});

test('quarantines legacy items whose products are internal-only or no longer public', () => {
    const storage = createStorage({ [CART_STORAGE_KEY]: JSON.stringify([storedItem()]) });
    const result = restoreCart(storage, [product({ visibility: 'internal-only' })]);

    assert.deepEqual(result.items, []);
    assert.equal(result.invalidCount, 1);
});

test('uses the current catalog price when a listed product price changes', () => {
    const storage = createStorage({ [CART_STORAGE_KEY]: JSON.stringify([storedItem()]) });
    const result = restoreCart(storage, [product({ priceNum: 140000 })]);

    assert.equal(result.items[0].priceNum, 140000);
    assert.equal(result.items[0].materialPremium, 10000);
});

test('quarantines items with removed variants or materials', () => {
    const storage = createStorage({
        [CART_STORAGE_KEY]: JSON.stringify([
            storedItem({ key: 'removed-variant', variantId: 'removed' }),
            storedItem({ key: 'removed-material', materialId: 'removed' }),
        ]),
    });
    const result = restoreCart(storage, [product()]);

    assert.deepEqual(result.items, []);
    assert.equal(result.invalidCount, 2);
});

test('quarantines invalid quantities instead of coercing them', () => {
    const storage = createStorage({
        [CART_STORAGE_KEY]: JSON.stringify([
            storedItem({ key: 'zero', quantity: 0 }),
            storedItem({ key: 'fraction', quantity: 1.5 }),
            storedItem({ key: 'string', quantity: '2' }),
        ]),
    });
    const result = restoreCart(storage, [product()]);

    assert.deepEqual(result.items, []);
    assert.equal(result.invalidCount, 3);
});

test('restores items without approved media without exposing legacy media paths', () => {
    const storage = createStorage({ [CART_STORAGE_KEY]: JSON.stringify([storedItem()]) });
    const result = restoreCart(storage, [product({ publicMedia: null })]);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].img, null);
    assert.equal(result.items[0].filePath3d, null);
});

test('keeps quarantine bounded to three records and 64 KiB per record', () => {
    const storage = createStorage();
    for (let index = 0; index < 5; index += 1) {
        storage.setItem(CART_STORAGE_KEY, JSON.stringify([storedItem({ productId: 100 + index })]));
        restoreCart(storage, [product()]);
    }
    const quarantine = JSON.parse(storage.value(CART_QUARANTINE_KEY));

    assert.equal(quarantine.entries.length, 3);
    assert.ok(quarantine.entries.every(entry => entry.raw.length <= 64 * 1024));
});

test('preserves the original cart when storage refuses the quarantine write', () => {
    const original = JSON.stringify([storedItem(), storedItem({ productId: 404 })]);
    const storage = createStorage({ [CART_STORAGE_KEY]: original }, {
        failSetItem: key => key === CART_QUARANTINE_KEY,
    });
    const result = restoreCart(storage, [product()]);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productId, 42);
    assert.equal(result.migrationBlocked, true);
    assert.equal(result.backupStatus, 'storage-denied');
    assert.equal(persistCart(storage, result.items, { migrationBlocked: result.migrationBlocked }), false);
    assert.equal(storage.value(CART_STORAGE_KEY), original);
});

test('replaces blocked legacy data only after an explicit unblocked persist call', () => {
    const original = '{broken json';
    const storage = createStorage({ [CART_STORAGE_KEY]: original }, {
        failSetItem: key => key === CART_QUARANTINE_KEY,
    });
    const result = restoreCart(storage, [product()]);

    assert.equal(persistCart(storage, [], { migrationBlocked: result.migrationBlocked }), false);
    assert.equal(storage.value(CART_STORAGE_KEY), original);
    assert.equal(persistCart(storage, []), true);
    assert.equal(storage.value(CART_STORAGE_KEY), '[]');
});

test('does not save a truncated quarantine record when the source exceeds 64 KiB', () => {
    const original = `${'x'.repeat(64 * 1024)}!`;
    const storage = createStorage({ [CART_STORAGE_KEY]: original });
    const result = restoreCart(storage, [product()]);

    assert.equal(result.migrationBlocked, true);
    assert.equal(result.backupStatus, 'record-too-large');
    assert.equal(storage.value(CART_QUARANTINE_KEY), null);
    assert.equal(persistCart(storage, result.items, { migrationBlocked: result.migrationBlocked }), false);
    assert.equal(storage.value(CART_STORAGE_KEY), original);
});

test('preserves malformed JSON when it cannot be quarantined', () => {
    const original = '{broken json';
    const storage = createStorage({ [CART_STORAGE_KEY]: original }, {
        failSetItem: key => key === CART_QUARANTINE_KEY,
    });
    const result = restoreCart(storage, [product()]);

    assert.deepEqual(result.items, []);
    assert.equal(result.migrationBlocked, true);
    assert.equal(result.backupStatus, 'storage-denied');
    assert.equal(storage.value(CART_STORAGE_KEY), original);
});

test('persists only validated cart data after quarantine succeeds', () => {
    const original = JSON.stringify([storedItem(), storedItem({ productId: 404 })]);
    const storage = createStorage({ [CART_STORAGE_KEY]: original });
    const result = restoreCart(storage, [product()]);

    assert.equal(result.migrationBlocked, false);
    assert.equal(result.backupStatus, 'saved');
    assert.equal(persistCart(storage, result.items, { migrationBlocked: result.migrationBlocked }), true);
    assert.deepEqual(JSON.parse(storage.value(CART_STORAGE_KEY)), result.items);
    assert.notEqual(storage.value(CART_STORAGE_KEY), original);
    assert.equal(JSON.parse(storage.value(CART_QUARANTINE_KEY)).entries.length, 1);
});

test('merges consecutive additions of the same product option and material atomically', () => {
    const snapshot = {
        key: '42-small-pink', productId: 42, variantId: 'small', materialId: 'pink',
        priceNum: 125000, materialPremium: 10000, img: '/approved.jpg',
        filePath3d: '/approved.glb', quantity: 1,
    };
    const afterFirstAdd = mergeExistingCartItem([], snapshot);
    const afterSecondAdd = mergeExistingCartItem(afterFirstAdd, snapshot);
    const afterThirdAdd = mergeExistingCartItem(afterSecondAdd, snapshot);

    assert.equal(afterThirdAdd.length, 1);
    assert.equal(afterThirdAdd[0].quantity, 3);
    assert.equal(afterThirdAdd[0].priceNum, 125000);
    assert.equal(afterThirdAdd[0].materialPremium, 10000);
    assert.equal(afterThirdAdd[0].img, '/approved.jpg');
    assert.equal(afterThirdAdd[0].filePath3d, '/approved.glb');
});

test('refuses a consecutive add that would exceed the safe integer quantity limit', () => {
    const current = [{ key: '42-small-pink', quantity: Number.MAX_SAFE_INTEGER }];
    const result = mergeExistingCartItem(current, { key: '42-small-pink', quantity: 1 });

    assert.equal(result, current);
    assert.equal(result[0].quantity, Number.MAX_SAFE_INTEGER);
});

test('does not add an item with an invalid requested quantity', () => {
    const current = [];
    const result = mergeExistingCartItem(current, { key: '42-small-pink', quantity: Number.MAX_SAFE_INTEGER + 1 });

    assert.equal(result, current);
});
