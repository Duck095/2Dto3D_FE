// ─────────────────────────────────────────────
// Morphia — Currency formatting utilities
// ─────────────────────────────────────────────

const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/**
 * Format a number as Vietnamese Dong.
 * @param {number} amount
 * @returns {string} e.g. "150.000 ₫"
 */
export function formatVND(amount) {
  if (amount == null || isNaN(amount)) return '';
  return VND_FORMATTER.format(amount);
}

/**
 * Simple numeric format with dot separators.
 * @param {number} num
 * @returns {string} e.g. "150.000₫"
 */
export function formatPrice(num) {
  if (num == null || isNaN(num)) return '';
  return num.toLocaleString('vi-VN') + '₫';
}
