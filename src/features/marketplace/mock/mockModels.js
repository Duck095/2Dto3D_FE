// ─────────────────────────────────────────────
// Morphia — Mock model repository
//
// Re-exports the existing productModels data as
// the mock data source for DEMO_MODE.
// ─────────────────────────────────────────────

import { productModels } from '../../../data/productModels';

/**
 * Get all models (mock).
 * Supports basic filter/search to mirror the real API.
 */
export function getMockModels({ search, category, sort } = {}) {
  let result = [...productModels];

  // Search
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q),
    );
  }

  // Category filter
  if (category && category !== 'all') {
    result = result.filter((m) => m.category === category);
  }

  // Sort
  if (sort === 'price-asc') {
    result.sort((a, b) => (a.priceNum ?? 0) - (b.priceNum ?? 0));
  } else if (sort === 'price-desc') {
    result.sort((a, b) => (b.priceNum ?? 0) - (a.priceNum ?? 0));
  } else if (sort === 'name') {
    result.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  }

  return result;
}

/**
 * Get a single model by ID (mock).
 */
export function getMockModelById(id) {
  return productModels.find((m) => String(m.id) === String(id)) || null;
}
