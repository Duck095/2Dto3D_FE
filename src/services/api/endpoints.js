// ─────────────────────────────────────────────
// Morphia — All backend endpoints in one place
//
// No service or component should hardcode a URL path.
// Import ENDPOINTS from here instead.
// ─────────────────────────────────────────────

export const ENDPOINTS = Object.freeze({
  AUTH: Object.freeze({
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PING: '/auth/ping',
    ME: '/v1/me',
  }),

  MODELS: Object.freeze({
    LIST: '/models',
    DETAIL: (id) => `/models/${id}`,
  }),

  AI: Object.freeze({
    GENERATIONS: '/ai-studio/generations',
    GENERATION: (id) => `/ai-studio/generations/${id}`,
    REFRESH: (id) => `/ai-studio/generations/${id}/refresh`,
    INPUT_IMAGE: (id) => `/ai-studio/generations/${id}/input-image`,
    MODEL_ASSET: (id, format) => `/ai-studio/generations/${id}/models/model.${format}`,
    MODEL_DOWNLOAD: (id, format) => `/ai-studio/generations/${id}/models/model.${format}/download`,
    CONSUME_DOWNLOAD: (id) => `/ai-studio/generations/${id}/downloads`,
  }),

  CART: Object.freeze({
    GET: '/cart',
    ITEMS: '/cart/items',
    ITEM: (id) => `/cart/items/${id}`,
  }),

  ORDERS: Object.freeze({
    CREATE: '/orders',
    LIST: '/orders',
    DETAIL: (id) => `/orders/${id}`,
  }),

  MEMBERSHIPS: Object.freeze({
    PLANS: '/memberships/plans',
    ME: '/memberships/me',
    COMMUNITY_DOWNLOAD: (modelId) => `/memberships/community-downloads/${encodeURIComponent(modelId)}`,
  }),

  PAYMENTS: Object.freeze({
    CREATE: '/payments',
  }),

  STAFF: Object.freeze({
    LIST: '/admin/staff',
    CREATE: '/admin/staff',
    DETAIL: (id) => `/admin/staff/${id}`,
    UPDATE: (id) => `/admin/staff/${id}`,
    STATUS: (id) => `/admin/staff/${id}/status`,
  }),
});
