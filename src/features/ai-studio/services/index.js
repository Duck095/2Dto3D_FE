// ─────────────────────────────────────────────
// Morphia — AI Service facade
//
// Selects between real and mock AI service based on DEMO_MODE.
// Components import from here — never from mock or real directly.
//
// DEMO_MODE=true  → mockAiService (no backend needed)
// DEMO_MODE=false → aiService (real API calls)
// ─────────────────────────────────────────────

import { config } from '../../../app/config';
import { aiService } from './aiService';
import { mockAiService } from '../mock/mockAiService';

const activeService = config.demoMode ? mockAiService : aiService;

export const {
  createGeneration,
  getGeneration,
  getHistory,
  refreshGeneration,
  downloadModel,
  consumeDownload,
} = activeService;

export default activeService;
