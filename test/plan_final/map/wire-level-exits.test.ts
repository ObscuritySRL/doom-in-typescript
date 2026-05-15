import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BOSS_DEATH_TAG,
  SP_STATE_FINAL,
  SP_STATE_INITIAL_PAUSE,
  TICRATE,
  VANILLA_LEVEL_EXIT_INVARIANTS,
  WI_MAX_PERCENT,
  WI_SHOW_NEXT_LOC_SECONDS,
  WI_SHOW_NEXT_LOC_TICS,
  aBossDeath,
  createIntermissionState,
} from '../../../src/vanilla/wireLevelExits.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireLevelExits.ts');

describe('plan_final map: wire-level-exits', () => {
  test('src/vanilla/wireLevelExits.ts exists, is a regular file, and cites plan_final step 08-008', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-008');
    expect(fileText).toContain('VANILLA_LEVEL_EXIT_INVARIANTS');
  });

  test('the facade re-exports only from the read-only bossSpecials + intermission modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/bossSpecials.ts', '../ui/intermission.ts']);
  });

  test('VANILLA_LEVEL_EXIT_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_LEVEL_EXIT_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_LEVEL_EXIT_INVARIANTS)).toBe(true);
    const ids = VANILLA_LEVEL_EXIT_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['E1M8_BOSS_DEATH_ENDS_THE_EPISODE', 'INTERMISSION_SP_STATE_MACHINE_HAS_TEN_STATES', 'NEXT_LOCATION_POINTER_SHOWS_FOR_FOUR_SECONDS', 'NORMAL_EXIT_ADVANCES_TO_THE_NEXT_MAP', 'SECRET_EXIT_ROUTES_TO_THE_SECRET_MAP']);
    for (const invariant of VANILLA_LEVEL_EXIT_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the exit/intermission constants match vanilla wi_stuff.c / p_enemy.c', () => {
    expect(BOSS_DEATH_TAG).toBe(666);
    expect(TICRATE).toBe(35);
    expect(SP_STATE_INITIAL_PAUSE).toBe(1);
    expect(SP_STATE_FINAL).toBe(10);
    expect(WI_SHOW_NEXT_LOC_SECONDS).toBe(4);
    expect(WI_SHOW_NEXT_LOC_TICS).toBe(WI_SHOW_NEXT_LOC_SECONDS * TICRATE);
    expect(WI_SHOW_NEXT_LOC_TICS).toBe(140);
    expect(WI_MAX_PERCENT).toBe(100);
  });

  test('the exit and intermission entry points are re-exported as callable functions', () => {
    expect(typeof aBossDeath).toBe('function');
    expect(typeof createIntermissionState).toBe('function');
    expect(typeof createIntermissionState()).toBe('object');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const bossSource = await import('../../../src/ai/bossSpecials.ts');
    const intermissionSource = await import('../../../src/ui/intermission.ts');
    expect(aBossDeath).toBe(bossSource.aBossDeath);
    expect(BOSS_DEATH_TAG).toBe(bossSource.BOSS_DEATH_TAG);
    expect(createIntermissionState).toBe(intermissionSource.createIntermissionState);
    expect(SP_STATE_FINAL).toBe(intermissionSource.SP_STATE_FINAL);
  });
});
