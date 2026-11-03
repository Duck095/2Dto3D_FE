// ─────────────────────────────────────────────
// Morphia — Centralized application configuration
// All VITE_* env vars are resolved here once.
// Components / services import config — never import.meta.env directly.
// ─────────────────────────────────────────────

export const config = Object.freeze({
  /** Base URL for all API calls (Vite proxy in dev, full URL in prod) */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',

  /** When true, services return mock data instead of calling the backend */
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',

  /** Vite built-in flags */
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
});
