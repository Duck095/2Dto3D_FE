// ─────────────────────────────────────────────
// Morphia — Shared validation helpers
//
// Used by auth forms, checkout, print quote, etc.
// Backend MUST re-validate — these are UX-only.
// ─────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validate = {
  /** Non-empty string after trim */
  required(value, fieldName = 'Trường này') {
    if (!value || !String(value).trim()) {
      return `${fieldName} không được để trống`;
    }
    return null;
  },

  /** Valid email format */
  email(value) {
    if (!value) return 'Email không được để trống';
    if (!EMAIL_REGEX.test(value)) return 'Email không hợp lệ';
    return null;
  },

  /** Minimum length (default 8 for passwords) */
  minLength(value, min = 8, fieldName = 'Trường này') {
    if (!value || value.length < min) {
      return `${fieldName} phải có ít nhất ${min} ký tự`;
    }
    return null;
  },

  /** Password validation */
  password(value) {
    return validate.minLength(value, 8, 'Mật khẩu');
  },

  /** Confirm password match */
  confirmPassword(password, confirmPassword) {
    if (password !== confirmPassword) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  },

  /**
   * Run multiple validators, return first error or null.
   * @param {Array<() => string|null>} validators
   * @returns {string|null}
   */
  first(...validators) {
    for (const fn of validators) {
      const error = fn();
      if (error) return error;
    }
    return null;
  },
};
