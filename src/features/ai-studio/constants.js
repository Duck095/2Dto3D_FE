// ─────────────────────────────────────────────
// Morphia — AI Studio constants
// ─────────────────────────────────────────────

/** State machine for a generation lifecycle */
export const GenerationStatus = Object.freeze({
  IDLE: 'idle',
  UPLOADING: 'uploading',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
});

/** Generation input types */
export const GenerationType = Object.freeze({
  TEXT: 'TEXT_TO_3D',
  IMAGE: 'IMAGE_TO_3D',
});

/** Available style presets */
export const StylePreset = Object.freeze({
  REALISTIC: 'realistic',
  CARTOON: 'cartoon',
  SCULPTURE: 'sculpture',
  PBR: 'pbr',
});

/** Quality levels */
export const QualityLevel = Object.freeze({
  DRAFT: 'draft',
  STANDARD: 'standard',
  HIGH: 'high',
});
