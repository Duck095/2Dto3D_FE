// ─────────────────────────────────────────────
// Morphia — Auth storage abstraction
//
// All token / user persistence goes through this module.
// Today it's localStorage; tomorrow it could be httpOnly cookies.
// No other file should call localStorage for auth data directly.
// ─────────────────────────────────────────────

const TOKEN_KEY = 'morphia_access_token';
const USER_KEY = 'morphia_user';

export const authStorage = {
  // ── Token ───────────────────────────────────
  getToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return token;

    // Legacy fallback: token was inside the user object
    try {
      const savedUser = JSON.parse(localStorage.getItem(USER_KEY));
      if (savedUser?.token) {
        localStorage.setItem(TOKEN_KEY, savedUser.token);
        return savedUser.token;
      }
    } catch {
      // corrupt data — ignore
    }

    return null;
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  // ── User ────────────────────────────────────
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  // ── Clear ───────────────────────────────────
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // ── JWT expiry check ────────────────────────
  isTokenExpired(token) {
    if (!token || typeof token !== 'string') return true;

    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return true;

      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(base64 + padding));

      return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  },
};
