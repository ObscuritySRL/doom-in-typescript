import { describe, expect, test } from 'bun:test';

import { vanillaPostLoadResetOrderIndex, vanillaPostLoadResetSubsystemFor, VANILLA_POST_LOAD_RESET_GROUPS, VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER } from '../../../src/save/restore-post-load-render-audio-input-state.ts';

describe('vanilla DOOM 1.9 post-load subsystem refresh contract', () => {
  test('pins the canonical subsystem reset order: renderer -> audio -> input', () => {
    expect(VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER).toEqual(['R_FillBackScreen', 'R_ExecuteSetViewSize', 'R_SetupFrame', 'S_Start', 'I_ResetKey', 'D_ResetMouseDeltas']);
  });

  test('groups steps by subsystem', () => {
    const renderer = VANILLA_POST_LOAD_RESET_GROUPS.find((g) => g.subsystem === 'renderer');
    const audio = VANILLA_POST_LOAD_RESET_GROUPS.find((g) => g.subsystem === 'audio');
    const input = VANILLA_POST_LOAD_RESET_GROUPS.find((g) => g.subsystem === 'input');
    expect(renderer?.steps).toEqual(['R_FillBackScreen', 'R_ExecuteSetViewSize', 'R_SetupFrame']);
    expect(audio?.steps).toEqual(['S_Start']);
    expect(input?.steps).toEqual(['I_ResetKey', 'D_ResetMouseDeltas']);
  });

  test('vanillaPostLoadResetSubsystemFor maps each known step to its subsystem', () => {
    expect(vanillaPostLoadResetSubsystemFor('R_FillBackScreen')).toBe('renderer');
    expect(vanillaPostLoadResetSubsystemFor('R_SetupFrame')).toBe('renderer');
    expect(vanillaPostLoadResetSubsystemFor('S_Start')).toBe('audio');
    expect(vanillaPostLoadResetSubsystemFor('I_ResetKey')).toBe('input');
    expect(vanillaPostLoadResetSubsystemFor('D_ResetMouseDeltas')).toBe('input');
    expect(vanillaPostLoadResetSubsystemFor('unknown')).toBe(null);
  });

  test('renderer steps come before audio and input', () => {
    expect(vanillaPostLoadResetOrderIndex('R_FillBackScreen')).toBeLessThan(vanillaPostLoadResetOrderIndex('S_Start'));
    expect(vanillaPostLoadResetOrderIndex('R_SetupFrame')).toBeLessThan(vanillaPostLoadResetOrderIndex('I_ResetKey'));
    expect(vanillaPostLoadResetOrderIndex('S_Start')).toBeLessThan(vanillaPostLoadResetOrderIndex('D_ResetMouseDeltas'));
  });

  test('vanillaPostLoadResetOrderIndex returns -1 for unknown steps', () => {
    expect(vanillaPostLoadResetOrderIndex('unknown_step')).toBe(-1);
    expect(vanillaPostLoadResetOrderIndex('')).toBe(-1);
  });
});
