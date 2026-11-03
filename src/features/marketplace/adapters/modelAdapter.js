// ─────────────────────────────────────────────
// Morphia — Model Adapter
//
// Maps backend DTO → Frontend model shape.
// Components only know the frontend shape.
// When the backend renames a field, fix it HERE — not in 20 components.
// ─────────────────────────────────────────────

/**
 * Map a single model DTO from the backend to the frontend shape.
 * @param {Object} dto  Raw object from GET /models or GET /models/:id
 * @returns {Object}    Frontend-friendly model
 */
export function mapModelDto(dto) {
  return {
    id: dto.modelId ?? dto.id,
    title: dto.modelName ?? dto.title ?? dto.name,
    slug: dto.slug || null,
    description: dto.description || '',
    category: dto.category || 'other',
    img: dto.thumbnailUrl ?? dto.img ?? dto.thumbnail,
    images: dto.images || [],
    filePath3d: dto.modelUrl ?? dto.filePath3d ?? null,
    format3d: dto.format3d || 'glb',
    priceNum: dto.price ?? dto.priceNum ?? 0,
    price: dto.priceFormatted ?? formatPrice(dto.price ?? dto.priceNum ?? 0),
    materials: dto.materials || [],
    modelVariants: dto.modelVariants || dto.variants || [],
    customization: dto.customization || null,
    tags: dto.tags || [],
    createdAt: dto.createdAt || null,
  };
}

/**
 * Map an array of model DTOs.
 * @param {Object[]} dtos
 * @returns {Object[]}
 */
export function mapModelDtos(dtos) {
  return dtos.map(mapModelDto);
}

/** Simple VND formatter */
function formatPrice(num) {
  if (!num && num !== 0) return '';
  return num.toLocaleString('vi-VN') + '₫';
}
