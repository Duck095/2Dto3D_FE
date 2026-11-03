// ─────────────────────────────────────────────
// Morphia — AI Service (real backend)
//
// Wraps all AI Studio API calls.
// Page → aiService → apiClient → Backend
// ─────────────────────────────────────────────

import apiClient from '../../../services/api/apiClient';
import { ENDPOINTS } from '../../../services/api/endpoints';

export const aiService = {
  /**
   * Start a new AI generation (text-to-3D or image-to-3D).
   * @param {Object} data    { type, prompt, style, quality, ... }
   * @param {File}   [image] Optional image file for image-to-3D
   * @returns {Promise<Object>} { generationId, status }
   */
  async createGeneration(data, image) {
    const formData = new FormData();
    formData.append(
      'data',
      new Blob([JSON.stringify(data)], { type: 'application/json' }),
    );
    if (image) {
      formData.append('image', image);
    }

    return apiClient.post(ENDPOINTS.AI.GENERATIONS, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
  },

  /**
   * Poll the status of a generation.
   * @param {string|number} id
   * @returns {Promise<Object>} { status, progress, modelUrl, ... }
   */
  async getGeneration(id) {
    return apiClient.get(ENDPOINTS.AI.GENERATION(id));
  },

  /**
   * Get the user's generation history.
   * @returns {Promise<Object[]>}
   */
  async getHistory() {
    return apiClient.get(ENDPOINTS.AI.GENERATIONS);
  },

  /**
   * Refresh / retry a failed generation.
   * @param {string|number} id
   */
  async refreshGeneration(id) {
    return apiClient.post(ENDPOINTS.AI.REFRESH(id));
  },

  /**
   * Download a generated model file.
   * Triggers a browser download.
   * @param {string|number} id
   * @param {string} format  'glb' | 'stl' | 'obj'
   */
  async downloadModel(id, format) {
    const response = await apiClient.get(ENDPOINTS.AI.MODEL_DOWNLOAD(id, format), {
      responseType: 'blob',
      timeout: 120_000,
    });

    const url = URL.createObjectURL(response);
    const link = document.createElement('a');
    link.href = url;
    link.download = `morphia-studio-${id}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Record a download consumption (for membership quotas).
   * @param {string|number} id
   */
  async consumeDownload(id) {
    return apiClient.post(ENDPOINTS.AI.CONSUME_DOWNLOAD(id));
  },
};
