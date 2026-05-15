import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SAVEGAME_EOF, VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER, VANILLA_SAVEGAME_LOAD_INVARIANTS, readLoadGame, vanillaPostLoadResetOrderIndex, vanillaPostLoadResetSubsystemFor } from '../../../src/vanilla/wireSavegameLoad.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSavegameLoad.ts');
const EXPECTED_ORDER = ['R_FillBackScreen', 'R_ExecuteSetViewSize', 'R_SetupFrame', 'S_Start', 'I_ResetKey', 'D_ResetMouseDeltas'];

describe('plan_final save: wire-savegame-load', () => {
  test('src/vanilla/wireSavegameLoad.ts exists, is a regular file, and cites plan_final step 12-005', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-005');
    expect(fileText).toContain('VANILLA_SAVEGAME_LOAD_INVARIANTS');
  });

  test('the facade re-exports only from the two read-only load modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../save/loadgame.ts', '../save/restore-post-load-render-audio-input-state.ts']);
  });

  test('VANILLA_SAVEGAME_LOAD_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_SAVEGAME_LOAD_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_SAVEGAME_LOAD_INVARIANTS)).toBe(true);
    const ids = VANILLA_SAVEGAME_LOAD_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'CORRUPTED_OR_WRONG_VERSION_LOAD_RETURNS_NULL',
      'POST_LOAD_RESET_ORDER_IS_SIX_FIXED_STEPS',
      'POST_LOAD_RESET_RUNS_RENDER_THEN_AUDIO_THEN_INPUT',
      'SAVEGAME_EOF_MARKER_IS_0x1D',
      'STATE_RESTORE_GOES_THROUGH_READLOADGAME',
    ]);
    for (const invariant of VANILLA_SAVEGAME_LOAD_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('SAVEGAME_EOF is the 0x1d terminator and readLoadGame is callable', () => {
    expect(SAVEGAME_EOF).toBe(0x1d);
    expect(typeof readLoadGame).toBe('function');
  });

  test('the post-load reset order is the fixed render -> audio -> input six-step list', () => {
    expect([...VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER]).toEqual(EXPECTED_ORDER);
    expect(Object.isFrozen(VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER)).toBe(true);
    EXPECTED_ORDER.forEach((stepName, expectedIndex) => {
      expect(vanillaPostLoadResetOrderIndex(stepName)).toBe(expectedIndex);
    });
    expect(vanillaPostLoadResetOrderIndex('not-a-reset-step')).toBe(-1);
  });

  test('vanillaPostLoadResetSubsystemFor classifies each step and rejects unknown steps', () => {
    for (const stepName of EXPECTED_ORDER) {
      expect(vanillaPostLoadResetSubsystemFor(stepName)).not.toBeNull();
    }
    expect(vanillaPostLoadResetSubsystemFor('not-a-reset-step')).toBeNull();
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const loadgameSource = await import('../../../src/save/loadgame.ts');
    const restoreSource = await import('../../../src/save/restore-post-load-render-audio-input-state.ts');
    expect(readLoadGame).toBe(loadgameSource.readLoadGame);
    expect(SAVEGAME_EOF).toBe(loadgameSource.SAVEGAME_EOF);
    expect(VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER).toBe(restoreSource.VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER);
    expect(vanillaPostLoadResetOrderIndex).toBe(restoreSource.vanillaPostLoadResetOrderIndex);
  });
});
