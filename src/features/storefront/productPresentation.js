export function getPublicProducts(products) {
    if (!Array.isArray(products)) return [];
    return products.filter(product => product?.visibility === 'public-approved');
}

export function findPublicProduct(products, id) {
    if (id == null || String(id).trim() === '') return null;
    return getPublicProducts(products).find(product => String(product.id) === String(id)) ?? null;
}

export function getApprovedProductMedia(product) {
    const media = product?.publicMedia;
    if (product?.visibility !== 'public-approved' || !media || typeof media !== 'object') {
        return { images: [], videoUrl: null, modelUrl: null };
    }

    return {
        images: Array.isArray(media.images)
            ? media.images.filter(image => typeof image === 'string' && image.trim())
            : [],
        videoUrl: typeof media.videoUrl === 'string' && media.videoUrl.trim() ? media.videoUrl : null,
        modelUrl: typeof media.modelUrl === 'string' && media.modelUrl.trim() ? media.modelUrl : null,
    };
}

export function requiresProductDetailSelection(product) {
    return (Array.isArray(product?.purchaseOptions) && product.purchaseOptions.length > 1)
        || (Array.isArray(product?.materials) && product.materials.length > 1);
}

function invalidPricing(status) {
    return {
        status,
        valid: false,
        canPurchase: false,
        basePrice: null,
        materialPremium: null,
        totalPrice: null,
        priceLabel: null,
        option: null,
        material: null,
    };
}

function resolveChoice(choices, requested, requiredStatus, invalidStatus) {
    if (!Array.isArray(choices) || choices.length === 0) {
        return requested == null
            ? { valid: true, choice: null }
            : { valid: false, status: invalidStatus };
    }

    if (requested == null) {
        if (choices.length === 1) return { valid: true, choice: choices[0] };
        return { valid: false, status: requiredStatus };
    }

    const matches = choices.filter(choice => String(choice?.id) === String(requested.id));
    if (matches.length !== 1) return { valid: false, status: invalidStatus };
    return { valid: true, choice: matches[0] };
}

function getOptionBasePrice(product, option) {
    const hasExactPrice = option && Object.prototype.hasOwnProperty.call(option, 'priceNum');
    const hasPriceDelta = option && Object.prototype.hasOwnProperty.call(option, 'priceDelta');

    if (hasExactPrice && hasPriceDelta) return { valid: false };
    if (hasExactPrice) {
        return typeof option.priceNum === 'number' && Number.isFinite(option.priceNum) && option.priceNum > 0
            ? { valid: true, value: option.priceNum }
            : { valid: false };
    }

    if (typeof product.priceNum !== 'number' || !Number.isFinite(product.priceNum) || product.priceNum <= 0) {
        return { valid: false };
    }

    let priceDelta = 0;
    if (hasPriceDelta) {
        if (typeof option.priceDelta !== 'number' || !Number.isFinite(option.priceDelta)) return { valid: false };
        priceDelta = option.priceDelta;
    }

    const value = product.priceNum + priceDelta;
    return Number.isFinite(value) && value > 0 ? { valid: true, value } : { valid: false };
}

export function resolveStorefrontPricing(product, { option = null, material = null } = {}) {
    if (product?.visibility !== 'public-approved') return invalidPricing('not-public');
    if (product.priceConfirmed !== true) return invalidPricing('price-unconfirmed');

    const optionResult = resolveChoice(
        product.purchaseOptions,
        option,
        'option-required',
        'invalid-option',
    );
    if (!optionResult.valid) return invalidPricing(optionResult.status);

    const materialResult = resolveChoice(
        product.materials,
        material,
        'material-required',
        'invalid-material',
    );
    if (!materialResult.valid) return invalidPricing(materialResult.status);

    if (product.priceOnRequest === true) {
        return {
            ...invalidPricing('price-on-request'),
            priceLabel: typeof product.priceLabel === 'string' && product.priceLabel.trim()
                ? product.priceLabel
                : null,
            option: optionResult.choice,
            material: materialResult.choice,
        };
    }

    const price = getOptionBasePrice(product, optionResult.choice);
    if (!price.valid) return invalidPricing('invalid-option-price');

    let materialPremium = 0;
    if (materialResult.choice && Object.prototype.hasOwnProperty.call(materialResult.choice, 'premium')) {
        const premium = materialResult.choice.premium;
        if (typeof premium !== 'number' || !Number.isFinite(premium) || premium < 0) {
            return invalidPricing('invalid-material-premium');
        }
        materialPremium = premium;
    }

    const totalPrice = price.value + materialPremium;
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) return invalidPricing('invalid-total');

    const priceLabel = totalPrice.toLocaleString('vi-VN') + ' ₫';
    const canPurchase = product.readyForSale === true;

    return {
        status: canPurchase ? 'ready' : 'not-ready-for-sale',
        valid: true,
        canPurchase,
        basePrice: price.value,
        materialPremium,
        totalPrice,
        priceLabel,
        option: optionResult.choice,
        material: materialResult.choice,
    };
}

export function createCartItemSnapshot(product, { option = null, material = null, quantity = 1 } = {}) {
    const pricing = resolveStorefrontPricing(product, { option, material });
    if (!pricing.canPurchase || !Number.isSafeInteger(quantity) || quantity < 1) return null;

    const media = getApprovedProductMedia(product);
    const variantId = pricing.option?.id ?? 'default';
    const materialId = pricing.material?.id ?? null;

    return {
        key: String(product.id) + '-' + String(variantId) + '-' + String(materialId ?? 'default'),
        productId: product.id,
        title: product.title,
        img: media.images[0] ?? null,
        priceNum: pricing.basePrice,
        materialId,
        materialName: pricing.material?.name ?? null,
        materialPremium: pricing.materialPremium,
        variantId,
        variantLabel: pricing.option?.label || pricing.option?.name || null,
        filePath3d: media.modelUrl,
        quantity,
    };
}

export function isReadyForSale(product, selection) {
    return resolveStorefrontPricing(product, selection).canPurchase;
}
