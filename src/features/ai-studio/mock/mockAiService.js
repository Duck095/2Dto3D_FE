// ─────────────────────────────────────────────
// Morphia — Mock AI Service
//
// Simulates the AI generation flow with realistic delays.
// Used when DEMO_MODE=true so the UI can be demonstrated
// without a running backend.
//
// Walks through: QUEUED → PROCESSING → SUCCESS
// with configurable delay per step.
// ─────────────────────────────────────────────

import { GenerationStatus } from '../constants';

const STEP_DELAY = 2000; // ms between each state transition
let mockIdCounter = 9000;

// In-memory store of mock generations
const mockStore = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAiService = {
  /**
   * Simulate creating a generation.
   * Returns immediately with QUEUED, then internally advances state.
   */
  async createGeneration(data, _image) {
    const id = ++mockIdCounter;
    const generation = {
      id,
      prompt: data.prompt || 'Demo prompt',
      type: data.type || 'TEXT_TO_3D',
      style: data.style || 'realistic',
      quality: data.quality || 'standard',
      status: GenerationStatus.QUEUED,
      progress: 0,
      modelUrl: null,
      createdAt: new Date().toISOString(),
    };

    mockStore.set(id, generation);

    // Advance state in background
    (async () => {
      await delay(STEP_DELAY);
      generation.status = GenerationStatus.PROCESSING;
      generation.progress = 25;

      await delay(STEP_DELAY);
      generation.progress = 55;

      await delay(STEP_DELAY);
      generation.progress = 85;

      await delay(STEP_DELAY);
      generation.status = GenerationStatus.SUCCESS;
      generation.progress = 100;
      generation.modelUrl = '/models/cute_flexi_baby_dragon_toy_customizable.glb';
    })();

    return { generationId: id, status: GenerationStatus.QUEUED };
  },

  /**
   * Poll the current state of a mock generation.
   */
  async getGeneration(id) {
    const gen = mockStore.get(Number(id));
    if (!gen) throw new Error(`Generation ${id} not found`);
    return { ...gen };
  },

  /**
   * Return all mock generations as history.
   */
  async getHistory() {
    return Array.from(mockStore.values())
      .sort((a, b) => b.id - a.id);
  },

  /**
   * Simulate a refresh (restart from QUEUED).
   */
  async refreshGeneration(id) {
    const gen = mockStore.get(Number(id));
    if (!gen) throw new Error(`Generation ${id} not found`);

    gen.status = GenerationStatus.QUEUED;
    gen.progress = 0;
    gen.modelUrl = null;

    (async () => {
      await delay(STEP_DELAY);
      gen.status = GenerationStatus.PROCESSING;
      gen.progress = 50;

      await delay(STEP_DELAY * 2);
      gen.status = GenerationStatus.SUCCESS;
      gen.progress = 100;
      gen.modelUrl = '/models/cute_flexi_baby_dragon_toy_customizable.glb';
    })();

    return { status: GenerationStatus.QUEUED };
  },

  /** No-op in mock mode */
  async downloadModel(_id, _format) {
    console.info('[MockAI] Download requested — returning demo model');
  },

  /** No-op in mock mode */
  async consumeDownload(_id) {},
};
