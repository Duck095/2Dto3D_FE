// ─────────────────────────────────────────────
// Morphia — Model Service
//
// Provides model data to the UI.
//
// DEMO_MODE=true  → returns mock data from productModels.js
// DEMO_MODE=false → calls the backend via apiClient
//
// Page → modelService → apiClient | mock
// ─────────────────────────────────────────────

import { config } from '../../../app/config';
import apiClient from '../../../services/api/apiClient';
import { ENDPOINTS } from '../../../services/api/endpoints';
import { mapModelDto, mapModelDtos } from '../adapters/modelAdapter';
import { getMockModels, getMockModelById } from '../mock/mockModels';

export const modelService = {
  /**
   * Fetch the model list.
   * @param {{ search?: string, category?: string, sort?: string }} filters
   * @returns {Promise<Object[]>} Frontend model[]
   */
  async getModels(filters = {}) {
    if (config.demoMode) {
      // Simulate async to keep the same loading UX
      return getMockModels(filters);
    }

    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.category && filters.category !== 'all') params.category = filters.category;
    if (filters.sort) params.sort = filters.sort;

    const data = await apiClient.get(ENDPOINTS.MODELS.LIST, { params });
    return mapModelDtos(Array.isArray(data) ? data : data.content ?? []);
  },

  /**
   * Fetch a single model by ID.
   * @param {string|number} id
   * @returns {Promise<Object|null>} Frontend model
   */
  async getModelById(id) {
    if (config.demoMode) {
      return getMockModelById(id);
    }

    const data = await apiClient.get(ENDPOINTS.MODELS.DETAIL(id));
    return data ? mapModelDto(data) : null;
  },
};
