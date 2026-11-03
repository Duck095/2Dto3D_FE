// ─────────────────────────────────────────────
// Backward-compatibility shim
// Delegates to features/auth/authStorage.
// Existing files that import from here keep working.
// New code should import from features/auth/authStorage directly.
// ─────────────────────────────────────────────

import { authStorage } from '../features/auth/authStorage';

export const isJwtExpired = (token) => authStorage.isTokenExpired(token);
export const getStoredToken = () => authStorage.getToken();
export const clearStoredAuth = () => authStorage.clear();
