// ─────────────────────────────────────────────
// Backward-compatibility shim
// The canonical API client now lives at services/api/apiClient.js
// This file re-exports it so existing imports keep working.
// New code should import from '../services/api/apiClient' directly.
// ─────────────────────────────────────────────

export { default } from '../services/api/apiClient';
