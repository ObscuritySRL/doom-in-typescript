/**
 * Gate step 09-037: aggregate renderer framebuffer parity constants.
 */

import { VANILLA_RENDERER_CHECKPOINT_TICS } from './compare-scripted-renderer-path.ts';
import { VANILLA_FRAMEBUFFER_BYTE_LENGTH, VANILLA_FRAMEBUFFER_HASH_HEX_LENGTH, VANILLA_FRAMEBUFFER_HEIGHT, VANILLA_FRAMEBUFFER_WIDTH } from './compare-title-and-e1m1-framebuffers.ts';

export const RENDERER_FRAMEBUFFER_PARITY_GATE = Object.freeze({
  width: VANILLA_FRAMEBUFFER_WIDTH,
  height: VANILLA_FRAMEBUFFER_HEIGHT,
  byteLength: VANILLA_FRAMEBUFFER_BYTE_LENGTH,
  hashHexLength: VANILLA_FRAMEBUFFER_HASH_HEX_LENGTH,
  checkpointTics: VANILLA_RENDERER_CHECKPOINT_TICS,
} as const);
