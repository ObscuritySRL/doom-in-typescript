import { describe, expect, test } from 'bun:test';

import { VANILLA_MENU_NAVIGATION_ORACLES, getVanillaMenuNavigationOracle } from '../../../src/ui/compare-menu-navigation-oracles.ts';
import { getVanillaMenuSfx } from '../../../src/ui/implement-menu-sound-events.ts';

describe('VANILLA_MENU_NAVIGATION_ORACLES — shape', () => {
  test('contains 8 scripted oracles', () => {
    expect(VANILLA_MENU_NAVIGATION_ORACLES.length).toBe(8);
  });

  test('every scenarioId is unique', () => {
    const ids = VANILLA_MENU_NAVIGATION_ORACLES.map((o) => o.scenarioId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every oracle is frozen', () => {
    expect(Object.isFrozen(VANILLA_MENU_NAVIGATION_ORACLES)).toBe(true);
    for (const oracle of VANILLA_MENU_NAVIGATION_ORACLES) {
      expect(Object.isFrozen(oracle)).toBe(true);
    }
  });
});

describe('oracle sfx mappings cross-validate getVanillaMenuSfx', () => {
  test('cursor-up maps to cursor-move event', () => {
    expect(getVanillaMenuNavigationOracle('cursor-up-moves-to-prev-item').expectedSfx).toBe(getVanillaMenuSfx('cursor-move'));
  });

  test('cursor-down maps to cursor-move event', () => {
    expect(getVanillaMenuNavigationOracle('cursor-down-moves-to-next-item').expectedSfx).toBe(getVanillaMenuSfx('cursor-move'));
  });

  test('select maps to select event', () => {
    expect(getVanillaMenuNavigationOracle('select-fires-routine-with-sfx_pistol').expectedSfx).toBe(getVanillaMenuSfx('select'));
  });

  test('submenu maps to menu-open event', () => {
    expect(getVanillaMenuNavigationOracle('submenu-enters-with-sfx_swtchn').expectedSfx).toBe(getVanillaMenuSfx('menu-open'));
  });

  test('escape maps to menu-close event', () => {
    expect(getVanillaMenuNavigationOracle('escape-closes-with-sfx_swtchx').expectedSfx).toBe(getVanillaMenuSfx('menu-close'));
  });

  test('slider left and right both map to slider-step event', () => {
    expect(getVanillaMenuNavigationOracle('slider-left-step-plays-sfx_stnmov').expectedSfx).toBe(getVanillaMenuSfx('slider-step'));
    expect(getVanillaMenuNavigationOracle('slider-right-step-plays-sfx_stnmov').expectedSfx).toBe(getVanillaMenuSfx('slider-step'));
  });

  test('guarded-invalid maps to invalid event', () => {
    expect(getVanillaMenuNavigationOracle('guarded-invalid-plays-sfx_oof').expectedSfx).toBe(getVanillaMenuSfx('invalid'));
  });
});

describe('getVanillaMenuNavigationOracle', () => {
  test('returns the matching oracle for a known scenarioId', () => {
    expect(getVanillaMenuNavigationOracle('select-fires-routine-with-sfx_pistol').input).toBe('select');
  });

  test('throws on unknown scenarioId', () => {
    expect(() => getVanillaMenuNavigationOracle('not-a-real-scenario')).toThrow(Error);
  });
});
