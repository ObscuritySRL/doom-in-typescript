import { describe, expect, test } from 'bun:test';

import {
  VANILLA_AUTOMAP_MARK_EMPTY_X,
  VANILLA_AUTOMAP_MARK_HEIGHT,
  VANILLA_AUTOMAP_MARK_PATCH_PREFIX,
  VANILLA_AUTOMAP_MARK_WIDTH,
  VANILLA_AUTOMAP_NUM_MARKPOINTS,
  vanillaAutomapAdvanceMarkIndex,
  vanillaAutomapMarkDepositPoint,
  vanillaAutomapMarkIsOccupied,
  vanillaAutomapMarkPatchName,
} from '../../../src/ui/implement-automap-markers.ts';

describe('vanilla automap marker constants', () => {
  test('AM_NUMMARKPOINTS = 10', () => {
    expect(VANILLA_AUTOMAP_NUM_MARKPOINTS).toBe(10);
  });

  test('empty-slot sentinel x = -1', () => {
    expect(VANILLA_AUTOMAP_MARK_EMPTY_X).toBe(-1);
  });

  test('mark patch display = 5 x 6 pixels (hardcoded in AM_drawMarks)', () => {
    expect(VANILLA_AUTOMAP_MARK_WIDTH).toBe(5);
    expect(VANILLA_AUTOMAP_MARK_HEIGHT).toBe(6);
  });

  test('mark patch prefix = AMMNUM', () => {
    expect(VANILLA_AUTOMAP_MARK_PATCH_PREFIX).toBe('AMMNUM');
  });
});

describe('vanillaAutomapMarkPatchName', () => {
  test('slot 0..9 → AMMNUM0..AMMNUM9', () => {
    expect(vanillaAutomapMarkPatchName(0)).toBe('AMMNUM0');
    expect(vanillaAutomapMarkPatchName(5)).toBe('AMMNUM5');
    expect(vanillaAutomapMarkPatchName(9)).toBe('AMMNUM9');
  });

  test('rejects out-of-range slots', () => {
    expect(() => vanillaAutomapMarkPatchName(-1)).toThrow();
    expect(() => vanillaAutomapMarkPatchName(10)).toThrow();
    expect(() => vanillaAutomapMarkPatchName(1.5)).toThrow();
  });
});

describe('vanillaAutomapAdvanceMarkIndex circular buffer', () => {
  test('advances by 1 modulo 10', () => {
    expect(vanillaAutomapAdvanceMarkIndex(0)).toBe(1);
    expect(vanillaAutomapAdvanceMarkIndex(5)).toBe(6);
    expect(vanillaAutomapAdvanceMarkIndex(8)).toBe(9);
  });

  test('wraps from 9 to 0', () => {
    expect(vanillaAutomapAdvanceMarkIndex(9)).toBe(0);
  });

  test('rejects out-of-range markpointnum', () => {
    expect(() => vanillaAutomapAdvanceMarkIndex(-1)).toThrow();
    expect(() => vanillaAutomapAdvanceMarkIndex(10)).toThrow();
  });
});

describe('vanillaAutomapMarkIsOccupied', () => {
  test('-1 sentinel is empty', () => {
    expect(vanillaAutomapMarkIsOccupied(-1)).toBe(false);
  });

  test('any other value (including 0) is occupied', () => {
    expect(vanillaAutomapMarkIsOccupied(0)).toBe(true);
    expect(vanillaAutomapMarkIsOccupied(100)).toBe(true);
    expect(vanillaAutomapMarkIsOccupied(-2)).toBe(true);
  });
});

describe('vanillaAutomapMarkDepositPoint', () => {
  test('center of (0, 0) window with size (320, 200)', () => {
    expect(vanillaAutomapMarkDepositPoint(0, 0, 320, 200)).toEqual({ x: 160, y: 100 });
  });

  test('non-zero origin shifts deposit point', () => {
    expect(vanillaAutomapMarkDepositPoint(1000, 2000, 320, 200)).toEqual({ x: 1160, y: 2100 });
  });

  test('signed integer division for odd width', () => {
    // 321 / 2 → trunc → 160
    expect(vanillaAutomapMarkDepositPoint(0, 0, 321, 201)).toEqual({ x: 160, y: 100 });
  });
});
