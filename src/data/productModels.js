import babyCarrotCustomization from './babycarrotCustomization.json';
import captainShieldCustomization from './captainShieldCustomization.json';

const CATEGORY_META = {
    KEYCHAIN: { label: 'Móc khóa', icon: 'key' },
    LOGO: { label: 'Logo', icon: 'interests' },
    DECOR: { label: 'Đồ trang trí', icon: 'home' },
};

export const PRODUCT_COLLECTIONS = [
    { id: 'clicky-fidget', title: 'Clicky & Fidget', description: 'Móc khóa bấm vui tay' },
    { id: 'cute-collect', title: 'Cute & Collect', description: 'Đồ dễ thương và món sưu tầm' },
    { id: 'cute-sweet', title: 'Cute & Sweet', description: 'Những món đồ nhỏ xinh' },
    { id: 'characters-collectibles', title: 'Characters & Collectibles', description: 'Nhân vật để mang theo và sưu tầm' },
    { id: 'personalized-gifts', title: 'Personalized Gifts', description: 'Món quà mang dấu ấn riêng' },
];

const BABY_CARROT_PARTS = [
    {
        id: 1,
        partName: 'Thân cà rốt',
        partKey: babyCarrotCustomization.customizableParts.body.meshName,
        color: { id: 1, name: 'Cam', hexCode: babyCarrotCustomization.customizableParts.body.defaultColor },
    },
    {
        id: 2,
        partName: 'Lá cà rốt',
        partKey: babyCarrotCustomization.customizableParts.top.meshName,
        color: { id: 2, name: 'Xanh lá', hexCode: babyCarrotCustomization.customizableParts.top.defaultColor },
    },
];

const CAPTAIN_SHIELD_PARTS = Object.values(captainShieldCustomization.customizableParts).map((part, index) => ({
    id: index + 1,
    partName: part.partName,
    partKey: part.meshName,
    color: {
        id: index + 1,
        name: part.colorName || part.partName,
        hexCode: part.defaultColor,
    },
}));

// Mirrors the API detail response. Commerce is kept as a storefront extension
// until price and material options are exposed by the backend.
const INTERNAL_PRODUCT_MODELS = [
    {
        id: 101,
        visibility: 'internal-only',
        sourceType: 'LOCAL',
        userId: 5,
        name: 'Mô Hình Bò Mini Lắp Ráp 3D',
        description: 'Mô hình Bò Minecraft mini dạng kit card để tự lắp ráp. Kích thước nhỏ gọn, phù hợp làm móc khóa và quà tặng sưu tầm.',
        filePath3d: '/models/kit card - cow.stl',
        category: 'KEYCHAIN',
        subcategory: 'Minecraft',
        collections: ['characters-collectibles', 'cute-collect'],
        sizeXMm: 25,
        sizeYMm: 20,
        sizeZMm: 25,
        weight: 5,
        createdAt: '2026-07-21T09:15:00',
        modelImages: [
            { id: 1, imagePath: '/images/minecraft-inspired-cow-1.png', isPrimary: true, uploadedAt: '2026-07-21T09:15:00' },
            { id: 2, imagePath: '/images/minecraft-inspired-cow-2.png', isPrimary: false, uploadedAt: '2026-07-21T09:15:00' },
            { id: 3, imagePath: '/images/minecraft-inspired-cow-3.png', isPrimary: false, uploadedAt: '2026-07-21T09:15:00' },
        ],
        modelParts: [],
        commerce: { priceNum: 149000, author: 'Morphia 3D', rating: '4.9', reviews: 52, badges: ['Minecraft', 'Kit Card', 'New'] },
    },
    {
        id: 103,
        visibility: 'internal-only',
        sourceType: 'LOCAL',
        userId: 5,
        name: "Captain America's Shield Keychain",
        description: 'Móc khóa khiên Captain America gồm năm phần riêng biệt: mặt sau, vòng đỏ, vòng trắng, tâm xanh và ngôi sao. Mỗi phần có thể chọn màu riêng trước khi xuất mô hình hoặc đặt in.',
        filePath3d: '/models/captain_america_shield_keychain_customizable.glb',
        category: 'KEYCHAIN',
        subcategory: 'Character / Hero',
        collections: ['characters-collectibles', 'cute-collect'],
        sizeXMm: captainShieldCustomization.dimensionsMm.x,
        sizeYMm: captainShieldCustomization.dimensionsMm.y,
        sizeZMm: captainShieldCustomization.dimensionsMm.z,
        weight: null,
        createdAt: '2026-07-21T11:00:00',
        modelImages: [
            { id: 1, imagePath: '/images/captain-americas-shield.png', isPrimary: true, uploadedAt: '2026-07-21T11:00:00' },
            { id: 2, imagePath: '/images/captain-americas-shield2.png', isPrimary: false, uploadedAt: '2026-07-21T11:00:00' },
            { id: 3, imagePath: '/images/captain-americas-shield1.png', isPrimary: false, uploadedAt: '2026-07-21T11:00:00' },
            { id: 4, imagePath: '/images/captain-shield-color-segmentation.png', isPrimary: false, uploadedAt: '2026-07-22T21:00:00' },
        ],
        modelParts: CAPTAIN_SHIELD_PARTS,
        customizationConfig: captainShieldCustomization,
        license: captainShieldCustomization.license,
        commerce: { priceNum: 0, priceLabel: 'Thử nghiệm nội bộ', priceOnRequest: true, author: 'Morphia 3D', rating: '4.8', reviews: 201, badges: ['Test only', 'Custom Color'] },
    },
    {
        id: 104,
        visibility: 'internal-only',
        sourceType: 'LOCAL',
        userId: 5,
        name: 'Baby Carrot Customizable',
        description: 'Mô hình cà rốt Baby Carrot dễ thương với thân và lá có thể tùy chỉnh màu riêng. Phần mắt trắng và con ngươi được khóa màu để giữ biểu cảm nguyên bản.',
        filePath3d: '/models/babycarrot_customizable.glb',
        category: 'KEYCHAIN',
        subcategory: 'Đồ trang trí để bàn',
        collections: ['cute-sweet', 'cute-collect'],
        sizeXMm: 72.63,
        sizeYMm: 23.86,
        sizeZMm: 15.77,
        weight: null,
        createdAt: '2026-07-22T17:00:00',
        modelImages: [
            { id: 1, imagePath: '/images/flexible-baby-carrot1.png', isPrimary: true, uploadedAt: '2026-07-22T17:00:00' },
            { id: 2, imagePath: '/images/flexible-baby-carrot2.png', isPrimary: false, uploadedAt: '2026-07-22T17:00:00' },
            { id: 3, imagePath: '/images/flexible-baby-carrot3.png', isPrimary: false, uploadedAt: '2026-07-22T17:00:00' },
            { id: 4, imagePath: '/images/flexible-baby-carrot4.png', isPrimary: false, uploadedAt: '2026-07-22T17:00:00' },
        ],
        modelParts: BABY_CARROT_PARTS,
        customizationConfig: babyCarrotCustomization,
        commerce: { priceNum: 0, priceLabel: 'Liên hệ', priceOnRequest: true, author: 'Morphia 3D', rating: '5.0', reviews: 0, badges: ['New', 'Custom Color'] },
    },
];

// Keep the public catalog explicit. It stays empty until product and media
// permissions are verified and a record is moved here.
const PUBLIC_PRODUCT_MODELS = [];

// Internal catalog records remain available to local development only.
export const PRODUCT_MODELS = import.meta.env.DEV
    ? [...PUBLIC_PRODUCT_MODELS, ...INTERNAL_PRODUCT_MODELS]
    : PUBLIC_PRODUCT_MODELS;

export const PRODUCT_CATEGORIES = Object.entries(CATEGORY_META).map(([key, value]) => ({ key, ...value }));

export const PRODUCT_LIST_ITEMS = PUBLIC_PRODUCT_MODELS
    .filter(model => model.visibility === 'public-approved')
    .map(model => {
        return {
            id: model.id,
            visibility: 'public-approved',
            collections: Array.isArray(model.collections) ? model.collections : [],
            name: model.name,
            description: model.description,
            thumbnail: Array.isArray(model.publicMedia?.images) ? model.publicMedia.images[0] || '' : '',
            category: model.category,
        };
    });

function toPublicMedia(model) {
    if (model.visibility !== 'public-approved' || !model.publicMedia || typeof model.publicMedia !== 'object') return null;
    const media = model.publicMedia;
    return {
        images: Array.isArray(media.images)
            ? media.images.filter(image => typeof image === 'string' && image.trim())
            : [],
        videoUrl: typeof media.videoUrl === 'string' && media.videoUrl.trim() ? media.videoUrl : null,
        modelUrl: typeof media.modelUrl === 'string' && media.modelUrl.trim() ? media.modelUrl : null,
    };
}

export function toStoreProduct(model) {
    const commerce = model.commerce || {};
    return {
        id: model.id,
        visibility: model.visibility === 'public-approved' ? 'public-approved' : 'internal-only',
        collections: Array.isArray(model.collections) ? model.collections : [],
        slug: model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        title: model.name,
        priceNum: commerce.priceNum,
        priceLabel: typeof commerce.priceLabel === 'string' ? commerce.priceLabel : null,
        priceConfirmed: commerce.priceConfirmed === true,
        readyForSale: commerce.readyForSale === true,
        priceOnRequest: commerce.priceOnRequest === true,
        category: model.category,
        categoryLabel: CATEGORY_META[model.category]?.label || model.category,
        subcategory: model.subcategory || CATEGORY_META[model.category]?.label || model.category,
        description: model.description,
        materials: Array.isArray(commerce.materials) ? commerce.materials : [],
        publicMedia: toPublicMedia(model),
        publicDetails: Array.isArray(model.publicDetails) ? model.publicDetails : [],
        purchaseOptions: Array.isArray(commerce.purchaseOptions) ? commerce.purchaseOptions : [],
        verifiedReviews: Array.isArray(commerce.verifiedReviews) ? commerce.verifiedReviews : [],
        publicModelColor: model.publicModelColor || null,
        publicModelDimensions: model.publicModelDimensions || null,
        publicModelParts: Array.isArray(model.publicModelParts) ? model.publicModelParts : [],
    };
}

export const STORE_PRODUCTS = PUBLIC_PRODUCT_MODELS
    .filter(model => model.visibility === 'public-approved')
    .map(toStoreProduct);

export function getStoreProductById(id) {
    return STORE_PRODUCTS.find(product => product.id === Number(id));
}
