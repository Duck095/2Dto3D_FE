// ─────────────────────────────────────────────
// Morphia — Central API client (Axios instance)
//
// Every service must use this client.
// • Automatically attaches JWT from authStorage
// • Returns response.data (unwrapped)
// • 401 on other protected routes → ask AuthContext to revalidate /api/v1/me
// ─────────────────────────────────────────────

import axios from 'axios';
import { config } from '../../app/config';
import { getStoredToken } from '../../utils/authToken';
import { AUTH_IDENTITY_REVALIDATION_EVENT, shouldRevalidateIdentityOn401 } from './auth401Policy';

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor ──────────────────────
apiClient.interceptors.request.use(
  (reqConfig) => {
    const token = getStoredToken();
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor ─────────────────────
apiClient.interceptors.response.use(
  // Unwrap: callers receive response.data directly
  (response) => response.data,

  (error) => {
    if (
      error.response?.status === 401
      && shouldRevalidateIdentityOn401(error.config?.url, error.config?.baseURL || config.apiBaseUrl)
      && typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event(AUTH_IDENTITY_REVALIDATION_EVENT));
    }

    return Promise.reject(error);
  },
);

export default apiClient;
