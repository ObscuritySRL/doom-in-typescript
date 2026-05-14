import { describe, expect, test } from 'bun:test';

import { VANILLA_STATUS_BAR_ARMS_PATCH_NAME, VANILLA_STATUS_BAR_PATCH_NAME, VANILLA_ST_HEIGHT, VANILLA_ST_WIDTH, VANILLA_ST_Y_OFFSET } from '../../../src/render/implement-status-bar-background.ts';

describe('vanilla status bar dimensions', () => {
  test('ST_HEIGHT = 32, ST_WIDTH = 320, ST_Y = 168', () => {
    expect(VANILLA_ST_HEIGHT).toBe(32);
    expect(VANILLA_ST_WIDTH).toBe(320);
    expect(VANILLA_ST_Y_OFFSET).toBe(168);
    expect(VANILLA_ST_Y_OFFSET + VANILLA_ST_HEIGHT).toBe(200);
  });

  test('background patch is STBAR; arms overlay is STARMS', () => {
    expect(VANILLA_STATUS_BAR_PATCH_NAME).toBe('STBAR');
    expect(VANILLA_STATUS_BAR_ARMS_PATCH_NAME).toBe('STARMS');
  });
});
