// ─────────────────────────────────────────────
// Morphia — Normalized API error
// Wraps Axios errors into a consistent shape so features
// never need to inspect raw error.response structures.
// ─────────────────────────────────────────────

/**
 * Consistent error shape returned by all API calls.
 *
 * @typedef {Object} NormalizedError
 * @property {number}  status    - HTTP status (0 for network errors)
 * @property {string}  code      - Backend error code or 'NETWORK' / 'TIMEOUT' / 'UNKNOWN'
 * @property {string}  message   - Human-readable message
 * @property {*}       details   - Optional extra payload from the backend
 * @property {boolean} isNetwork - True when the request never reached the server
 * @property {boolean} isTimeout - True when the request timed out
 */
export class ApiError extends Error {
  constructor(axiosError) {
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Đã xảy ra lỗi không xác định';

    super(message);
    this.name = 'ApiError';

    this.status = axiosError.response?.status || 0;
    this.code = axiosError.response?.data?.code || this._inferCode(axiosError);
    this.details = axiosError.response?.data?.details || null;
    this.isNetwork = !axiosError.response && axiosError.code !== 'ECONNABORTED';
    this.isTimeout = axiosError.code === 'ECONNABORTED';
  }

  _inferCode(err) {
    if (err.code === 'ECONNABORTED') return 'TIMEOUT';
    if (!err.response) return 'NETWORK';
    return 'UNKNOWN';
  }

  /** True when the user's session is invalid */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** True when the user lacks permission */
  get isForbidden() {
    return this.status === 403;
  }

  /** True when the resource was not found */
  get isNotFound() {
    return this.status === 404;
  }

  /** True when backend validation failed */
  get isValidation() {
    return this.status === 422 || this.status === 400;
  }

  /** True when the server had an internal error */
  get isServer() {
    return this.status >= 500;
  }
}

/**
 * Convert any Axios error into a normalised ApiError.
 * Safe to call with non-Axios errors too.
 */
export function normalizeError(error) {
  if (error instanceof ApiError) return error;
  return new ApiError(error);
}
