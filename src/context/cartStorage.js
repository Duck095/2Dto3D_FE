import { createCartItemSnapshot, findPublicProduct } from '../features/storefront/productPresentation.js';

export const CART_STORAGE_KEY = 'morphia-keychain-cart';
export const CART_QUARANTINE_KEY = `${CART_STORAGE_KEY}:quarantine`;
const MAX_QUARANTINE_RECORDS = 3;
const MAX_QUARANTINE_RECORD_BYTES = 64 * 1024;

function byteLength(value) {
    return new TextEncoder().encode(value).length;
}

function appendQuarantine(storage, raw, reason, now) {
    let entries = [];
    let previousRaw;
    try {
        previousRaw = storage.getItem(CART_QUARANTINE_KEY);
    } catch {
        return 'storage-denied';
    }
    if (previousRaw) {
        let previous;
        try {
            previous = JSON.parse(previousRaw);
        } catch {
            return 'quarantine-unreadable';
        }
        if (!Array.isArray(previous?.entries)) return 'quarantine-unreadable';
        entries = previous.entries;
    }

    const safeRaw = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const record = { at: new Date(now).toISOString(), reason, raw: safeRaw };
    if (byteLength(JSON.stringify(record)) > MAX_QUARANTINE_RECORD_BYTES) return 'record-too-large';
    if (!entries.some(entry => entry?.reason === reason && entry?.raw === safeRaw)) entries.push(record);

    try {
        storage.setItem(CART_QUARANTINE_KEY, JSON.stringify({ version: 1, entries: entries.slice(-MAX_QUARANTINE_RECORDS) }));
        return 'saved';
    } catch {
        return 'storage-denied';
    }
}

function getSelectionFromLegacyItem(item) {
    return {
        option: item.variantId == null || item.variantId === 'default' ? null : { id: item.variantId },
        material: item.materialId == null || item.materialId === 'default' ? null : { id: item.materialId },
        quantity: item.quantity,
    };
}

function restoreItem(item, products) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { valid: false, reason: 'invalid-item' };
    if ((typeof item.productId !== 'string' && typeof item.productId !== 'number') || String(item.productId).trim() === '') {
        return { valid: false, reason: 'invalid-product-id' };
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return { valid: false, reason: 'invalid-quantity' };

    const product = findPublicProduct(products, item.productId);
    if (!product) return { valid: false, reason: 'product-unavailable' };

    const restored = createCartItemSnapshot(product, getSelectionFromLegacyItem(item));
    if (!restored) return { valid: false, reason: 'selection-or-price-unavailable' };

    return {
        valid: true,
        item: { ...restored, quantity: item.quantity },
        priceChanged: item.priceNum !== restored.priceNum || item.materialPremium !== restored.materialPremium,
    };
}

export function restoreCart(storage, products, { now = Date.now() } = {}) {
    if (!storage) {
        return {
            items: [], invalidCount: 0, updatedPriceCount: 0,
            backupStatus: 'storage-denied', migrationBlocked: true,
        };
    }
    let raw;
    try {
        raw = storage?.getItem(CART_STORAGE_KEY);
    } catch {
        return {
            items: [], invalidCount: 0, updatedPriceCount: 0,
            backupStatus: 'storage-denied', migrationBlocked: true,
        };
    }
    if (!raw) {
        return {
            items: [], invalidCount: 0, updatedPriceCount: 0,
            backupStatus: 'not-needed', migrationBlocked: false,
        };
    }

    let storedItems;
    try {
        storedItems = JSON.parse(raw);
    } catch {
        const backupStatus = appendQuarantine(storage, raw, 'malformed-json', now);
        return {
            items: [], invalidCount: 1, updatedPriceCount: 0, backupStatus,
            migrationBlocked: backupStatus !== 'saved',
        };
    }

    if (!Array.isArray(storedItems)) {
        const backupStatus = appendQuarantine(storage, raw, 'invalid-cart-format', now);
        return {
            items: [], invalidCount: 1, updatedPriceCount: 0, backupStatus,
            migrationBlocked: backupStatus !== 'saved',
        };
    }

    const items = [];
    const invalidEntries = [];
    let updatedPriceCount = 0;
    for (const storedItem of storedItems) {
        const result = restoreItem(storedItem, products);
        if (!result.valid) {
            invalidEntries.push({ item: storedItem, reason: result.reason });
            continue;
        }

        if (result.priceChanged) updatedPriceCount += 1;
        const existing = items.find(item => item.key === result.item.key);
        if (existing) {
            const quantity = existing.quantity + result.item.quantity;
            if (!Number.isSafeInteger(quantity)) {
                invalidEntries.push({ item: storedItem, reason: 'invalid-quantity-total' });
            } else {
                existing.quantity = quantity;
            }
        } else {
            items.push(result.item);
        }
    }

    const backupStatus = invalidEntries.length > 0
        ? appendQuarantine(storage, JSON.stringify(invalidEntries), 'items-removed-during-validation', now)
        : 'not-needed';
    return {
        items,
        invalidCount: invalidEntries.length,
        updatedPriceCount,
        backupStatus,
        migrationBlocked: invalidEntries.length > 0 && backupStatus !== 'saved',
    };
}

export function persistCart(storage, items, { migrationBlocked = false } = {}) {
    if (migrationBlocked) return false;
    try {
        storage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        return true;
    } catch {
        return false;
    }
}
