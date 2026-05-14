import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ST_AMMOX,
  VANILLA_ST_ARMORX,
  VANILLA_ST_FRAGSX,
  VANILLA_ST_HEALTHX,
  VANILLA_ST_MAXAMMOX,
  VANILLA_ST_NUMBER_Y,
  VANILLA_ST_PATCH_SHORTNUM_PREFIX,
  VANILLA_ST_PATCH_SHORT_PERCENT,
  VANILLA_ST_PATCH_TALLNUM_PREFIX,
  VANILLA_ST_PATCH_TALL_PERCENT,
  VANILLA_ST_SHORTNUM_WIDTH,
  VANILLA_ST_TALLNUM_WIDTH,
} from '../../../src/render/implement-status-bar-numbers-and-percent-widgets.ts';

describe('vanilla status bar number widget positions', () => {
  test('widget X positions match st_stuff.c', () => {
    expect(VANILLA_ST_HEALTHX).toBe(90);
    expect(VANILLA_ST_ARMORX).toBe(221);
    expect(VANILLA_ST_AMMOX).toBe(44);
    expect(VANILLA_ST_MAXAMMOX).toBe(314);
    expect(VANILLA_ST_FRAGSX).toBe(138);
    expect(VANILLA_ST_NUMBER_Y).toBe(171);
  });

  test('large numbers 14px, small numbers 4px wide', () => {
    expect(VANILLA_ST_TALLNUM_WIDTH).toBe(14);
    expect(VANILLA_ST_SHORTNUM_WIDTH).toBe(4);
  });

  test('patch name prefixes match WAD lump names', () => {
    expect(VANILLA_ST_PATCH_TALLNUM_PREFIX).toBe('STTNUM');
    expect(VANILLA_ST_PATCH_SHORTNUM_PREFIX).toBe('STYSNUM');
    expect(VANILLA_ST_PATCH_TALL_PERCENT).toBe('STTPRCNT');
    expect(VANILLA_ST_PATCH_SHORT_PERCENT).toBe('STYSPRCNT');
  });
});
