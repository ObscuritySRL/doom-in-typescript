import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  VANILLA_GAME_STATE_TRANSITIONS,
  VanillaGameState,
  beginIntermission,
  createFinaleState,
  createFrontEndSequence,
  createIntermissionState,
  isLegalGameStateTransition,
  isWipeTransition,
  startFinale,
  tickFinale,
  tickFrontEnd,
  tickIntermission,
} from '../../../src/vanilla/wireGameStateTransitions.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireGameStateTransitions.ts');

describe('plan_final runtime: wire-game-state-transitions', () => {
  test('src/vanilla/wireGameStateTransitions.ts exists, is a regular file, and cites plan_final step 04-005', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('04-005');
    expect(fileText).toContain('VANILLA_GAME_STATE_TRANSITIONS');
  });

  test('the facade re-exports from the read-only frontEndSequence + intermission + finale modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/frontEndSequence.ts'");
    expect(fileText).toContain("from '../ui/intermission.ts'");
    expect(fileText).toContain("from '../ui/finale.ts'");
  });

  test('VanillaGameState pins the doomstat.h gamestate_t numeric values and is frozen', () => {
    expect(VanillaGameState.GS_LEVEL).toBe(0);
    expect(VanillaGameState.GS_INTERMISSION).toBe(1);
    expect(VanillaGameState.GS_FINALE).toBe(2);
    expect(VanillaGameState.GS_DEMOSCREEN).toBe(3);
    expect(Object.isFrozen(VanillaGameState)).toBe(true);
  });

  test('VANILLA_GAME_STATE_TRANSITIONS pins the six canonical gameaction-driven transitions and is frozen', () => {
    expect(VANILLA_GAME_STATE_TRANSITIONS.length).toBe(6);
    expect(Object.isFrozen(VANILLA_GAME_STATE_TRANSITIONS)).toBe(true);
    const pairs = VANILLA_GAME_STATE_TRANSITIONS.map((transition) => `${transition.from}->${transition.to}:${transition.gameAction}`);
    expect(pairs).toEqual(['0->1:G_DoCompleted', '1->0:G_DoWorldDone', '1->2:F_StartFinale', '2->0:G_DoWorldDone', '0->3:D_StartTitle', '3->0:G_DeferedInitNew']);
  });

  test('isWipeTransition returns true for any actual state change and false for a no-op (D_Display wipe rule)', () => {
    expect(isWipeTransition(VanillaGameState.GS_LEVEL, VanillaGameState.GS_INTERMISSION)).toBe(true);
    expect(isWipeTransition(VanillaGameState.GS_INTERMISSION, VanillaGameState.GS_FINALE)).toBe(true);
    expect(isWipeTransition(VanillaGameState.GS_DEMOSCREEN, VanillaGameState.GS_LEVEL)).toBe(true);
    expect(isWipeTransition(VanillaGameState.GS_DEMOSCREEN, VanillaGameState.GS_DEMOSCREEN)).toBe(false);
    expect(isWipeTransition(VanillaGameState.GS_LEVEL, VanillaGameState.GS_LEVEL)).toBe(false);
  });

  test('isLegalGameStateTransition accepts the canonical transitions and rejects illegal ones', () => {
    expect(isLegalGameStateTransition(VanillaGameState.GS_LEVEL, VanillaGameState.GS_INTERMISSION)).toBe(true);
    expect(isLegalGameStateTransition(VanillaGameState.GS_INTERMISSION, VanillaGameState.GS_FINALE)).toBe(true);
    expect(isLegalGameStateTransition(VanillaGameState.GS_FINALE, VanillaGameState.GS_LEVEL)).toBe(true);
    expect(isLegalGameStateTransition(VanillaGameState.GS_LEVEL, VanillaGameState.GS_FINALE)).toBe(false);
    expect(isLegalGameStateTransition(VanillaGameState.GS_FINALE, VanillaGameState.GS_INTERMISSION)).toBe(false);
  });

  test('every wired per-state primitive is re-exported as a callable function', () => {
    expect(typeof createFrontEndSequence).toBe('function');
    expect(typeof tickFrontEnd).toBe('function');
    expect(typeof createIntermissionState).toBe('function');
    expect(typeof beginIntermission).toBe('function');
    expect(typeof tickIntermission).toBe('function');
    expect(typeof createFinaleState).toBe('function');
    expect(typeof startFinale).toBe('function');
    expect(typeof tickFinale).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const frontEndSource = await import('../../../src/ui/frontEndSequence.ts');
    const intermissionSource = await import('../../../src/ui/intermission.ts');
    const finaleSource = await import('../../../src/ui/finale.ts');
    expect(tickFrontEnd).toBe(frontEndSource.tickFrontEnd);
    expect(tickIntermission).toBe(intermissionSource.tickIntermission);
    expect(tickFinale).toBe(finaleSource.tickFinale);
  });
});
