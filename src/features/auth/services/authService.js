// ─────────────────────────────────────────────
// Morphia — Auth service
//
// Thin layer between UI (AuthContext / LoginPage) and the API client.
// Handles login, register, session restore, and logout.
//
// Page → authService → apiClient → Backend
// ─────────────────────────────────────────────

import apiClient from '../../services/api/apiClient';
import { ENDPOINTS } from '../../services/api/endpoints';
import { authStorage } from './authStorage';

export const authService = {
  /**
   * Authenticate user. Stores JWT + user data on success.
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<Object>} User data (with token)
   */
  async login({ email, password }) {
    const data = await apiClient.post(ENDPOINTS.AUTH.LOGIN, { email, password });
    authStorage.setToken(data.token);
    authStorage.setUser(data);
    return data;
  },

  /**
   * Register a new account.
   * @param {{ name: string, email: string, password: string }} payload
   * @returns {Promise<Object>} Registration result
   */
  async register({ name, email, password }) {
    return apiClient.post(ENDPOINTS.AUTH.REGISTER, { name, email, password });
  },

  /**
   * Verify the server still accepts our stored token.
   * @returns {Promise<Object>} User data
   */
  async ping() {
    return apiClient.get(ENDPOINTS.AUTH.PING);
  },

  /**
   * Attempt to restore a session from storage.
   * Returns the saved user if token is still valid, or null.
   * @returns {Object|null}
   */
  restoreSession() {
    const token = authStorage.getToken();
    const user = authStorage.getUser();

    if (!token || authStorage.isTokenExpired(token)) {
      authStorage.clear();
      return null;
    }

    return user;
  },

  /** Clear stored session data */
  logout() {
    authStorage.clear();
  },
};
