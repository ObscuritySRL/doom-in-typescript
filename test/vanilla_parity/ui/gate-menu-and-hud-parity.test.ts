import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MENU_AND_HUD_GATE_INVARIANTS,
  VANILLA_TITLE_CYCLE_LENGTH,
  assertVanillaMenuAndHudGateInvariants,
  getVanillaMainMenuItemCount,
  getVanillaMenuSfx,
  getVanillaMenuNavigationOracle,
} from '../../../src/ui/gate-menu-and-hud-parity.ts';

describe('VANILLA_MENU_AND_HUD_GATE_INVARIANTS', () => {
  test('records the three top-level menu invariants', () => {
    expect(VANILLA_MENU_AND_HUD_GATE_INVARIANTS.titleCycleLength).toBe(6);
    expect(VANILLA_MENU_AND_HUD_GATE_INVARIANTS.mainMenuNonCommercialItemCount).toBe(6);
    expect(VANILLA_MENU_AND_HUD_GATE_INVARIANTS.mainMenuCommercialItemCount).toBe(5);
  });

  test('invariants object is frozen', () => {
    expect(Object.isFrozen(VANILLA_MENU_AND_HUD_GATE_INVARIANTS)).toBe(true);
  });
});

describe('assertVanillaMenuAndHudGateInvariants', () => {
  test('passes against the canonical menu/HUD wiring', () => {
    expect(() => assertVanillaMenuAndHudGateInvariants()).not.toThrow();
  });
});

describe('re-exports surface', () => {
  test('VANILLA_TITLE_CYCLE_LENGTH matches the invariant', () => {
    expect(VANILLA_TITLE_CYCLE_LENGTH).toBe(VANILLA_MENU_AND_HUD_GATE_INVARIANTS.titleCycleLength);
  });

  test('main menu counts match per game mode', () => {
    expect(getVanillaMainMenuItemCount('shareware')).toBe(6);
    expect(getVanillaMainMenuItemCount('commercial')).toBe(5);
  });

  test('menu sfx + navigation oracles are reachable via the gate module', () => {
    expect(getVanillaMenuSfx('cursor-move')).toBe('sfx_pstop');
    expect(getVanillaMenuNavigationOracle('select-fires-routine-with-sfx_pistol').expectedSfx).toBe('sfx_pistol');
  });
});
