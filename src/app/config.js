// ─────────────────────────────────────────────
// Morphia — Centralized application configuration
// All VITE_* env vars are resolved here once.
// Components / services import config — never import.meta.env directly.
// ─────────────────────────────────────────────

const env = import.meta.env || {};

export const config = Object.freeze({
  /** Base URL for all API calls (Vite proxy in dev, full URL in prod) */
  apiBaseUrl: env.VITE_API_BASE_URL || '/api',

  /** When true, services return mock data instead of calling the backend */
  demoMode: env.VITE_DEMO_MODE === 'true',

  /** Vite built-in flags */
  isDev: env.DEV,
  isProd: env.PROD,
});
