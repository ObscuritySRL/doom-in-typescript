import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_MF_AMBUSH_RUNTIME, VANILLA_MTF_AMBUSH, VANILLA_MTF_EASY, VANILLA_MTF_HARD, VANILLA_MTF_NETGAME, VANILLA_MTF_NORMAL, evaluateMonsterSpawn } from '../../../src/vanilla/monsterSpawnFlags.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RELATIVE_PATH = 'src/vanilla/monsterSpawnFlags.ts';
const ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RELATIVE_PATH);

describe('plan_final ai-specials: wire-monster-spawn-flags', () => {
  test('src/vanilla/monsterSpawnFlags.ts exists and cites plan_final step 10-001', () => {
    expect(existsSync(ABSOLUTE_PATH)).toBe(true);
    expect(statSync(ABSOLUTE_PATH).isFile()).toBe(true);
    const text = readFileSync(ABSOLUTE_PATH, 'utf8');
    expect(text).toContain('10-001');
    expect(text).toContain('evaluateMonsterSpawn');
    expect(text).toContain("from '../ai/implement-monster-spawn-flags.ts'");
  });

  test('exported MTF and MF runtime constants match the vanilla bitfield values', () => {
    expect(VANILLA_MTF_EASY).toBe(1);
    expect(VANILLA_MTF_NORMAL).toBe(2);
    expect(VANILLA_MTF_HARD).toBe(4);
    expect(VANILLA_MTF_AMBUSH).toBe(8);
    expect(VANILLA_MTF_NETGAME).toBe(16);
    expect(VANILLA_MF_AMBUSH_RUNTIME).toBe(0x8000);
  });

  test('returns a frozen verdict with shouldSpawn=true when the skill bit matches and the netgame guard does not trip', () => {
    const verdict = evaluateMonsterSpawn(VANILLA_MTF_EASY | VANILLA_MTF_NORMAL | VANILLA_MTF_HARD, 0, false);
    expect(Object.isFrozen(verdict)).toBe(true);
    expect(verdict.shouldSpawn).toBe(true);
    expect(verdict.ambush).toBe(false);
    expect(verdict.mobjFlagsToOr).toBe(0);
    expect(verdict.initialState.threshold).toBe(0);
    expect(verdict.initialState.movecount).toBe(0);
    expect(verdict.initialState.movedir).toBe(0);
    expect(verdict.initialState.target).toBeNull();
    expect(verdict.initialState.lastenemy).toBeNull();
    expect(verdict.initialState.tracer).toBeNull();
  });

  test('skill 0 and skill 1 both consult MTF_EASY (vanilla baby/easy bucket)', () => {
    const onlyEasy = VANILLA_MTF_EASY;
    expect(evaluateMonsterSpawn(onlyEasy, 0, false).shouldSpawn).toBe(true);
    expect(evaluateMonsterSpawn(onlyEasy, 1, false).shouldSpawn).toBe(true);
    expect(evaluateMonsterSpawn(onlyEasy, 2, false).shouldSpawn).toBe(false);
    expect(evaluateMonsterSpawn(onlyEasy, 3, false).shouldSpawn).toBe(false);
    expect(evaluateMonsterSpawn(onlyEasy, 4, false).shouldSpawn).toBe(false);
  });

  test('skill 2 consults only MTF_NORMAL', () => {
    expect(evaluateMonsterSpawn(VANILLA_MTF_NORMAL, 2, false).shouldSpawn).toBe(true);
    expect(evaluateMonsterSpawn(VANILLA_MTF_EASY, 2, false).shouldSpawn).toBe(false);
    expect(evaluateMonsterSpawn(VANILLA_MTF_HARD, 2, false).shouldSpawn).toBe(false);
  });

  test('skill 3 (UV) and skill 4 (Nightmare) both consult MTF_HARD', () => {
    expect(evaluateMonsterSpawn(VANILLA_MTF_HARD, 3, false).shouldSpawn).toBe(true);
    expect(evaluateMonsterSpawn(VANILLA_MTF_HARD, 4, false).shouldSpawn).toBe(true);
    expect(evaluateMonsterSpawn(VANILLA_MTF_EASY, 3, false).shouldSpawn).toBe(false);
    expect(evaluateMonsterSpawn(VANILLA_MTF_NORMAL, 4, false).shouldSpawn).toBe(false);
  });

  test('MTF_NETGAME guard drops the thing in single-player but allows it in co-op / deathmatch', () => {
    const flags = VANILLA_MTF_EASY | VANILLA_MTF_NORMAL | VANILLA_MTF_HARD | VANILLA_MTF_NETGAME;
    expect(evaluateMonsterSpawn(flags, 2, false).shouldSpawn).toBe(false);
    expect(evaluateMonsterSpawn(flags, 2, true).shouldSpawn).toBe(true);
  });

  test('MTF_AMBUSH propagates to the runtime ambush flag and OR mask', () => {
    const flags = VANILLA_MTF_EASY | VANILLA_MTF_NORMAL | VANILLA_MTF_HARD | VANILLA_MTF_AMBUSH;
    const verdict = evaluateMonsterSpawn(flags, 2, false);
    expect(verdict.shouldSpawn).toBe(true);
    expect(verdict.ambush).toBe(true);
    expect(verdict.mobjFlagsToOr).toBe(VANILLA_MF_AMBUSH_RUNTIME);
  });

  test('MTF_AMBUSH bit survives even when shouldSpawn is false (mapthing_t records the raw bit)', () => {
    const flags = VANILLA_MTF_AMBUSH; // no skill bits set
    const verdict = evaluateMonsterSpawn(flags, 0, false);
    expect(verdict.shouldSpawn).toBe(false);
    expect(verdict.ambush).toBe(true);
    expect(verdict.mobjFlagsToOr).toBe(0);
  });

  test('a mapthing with zero options (no skill bits, no flags) never spawns in single-player at any skill', () => {
    for (const skill of [0, 1, 2, 3, 4] as const) {
      expect(evaluateMonsterSpawn(0, skill, false).shouldSpawn).toBe(false);
    }
  });

  test('a mapthing with every flag set spawns at every skill in netgame and respects ambush', () => {
    const flags = VANILLA_MTF_EASY | VANILLA_MTF_NORMAL | VANILLA_MTF_HARD | VANILLA_MTF_AMBUSH | VANILLA_MTF_NETGAME;
    for (const skill of [0, 1, 2, 3, 4] as const) {
      const verdict = evaluateMonsterSpawn(flags, skill, true);
      expect(verdict.shouldSpawn).toBe(true);
      expect(verdict.ambush).toBe(true);
      expect(verdict.mobjFlagsToOr).toBe(VANILLA_MF_AMBUSH_RUNTIME);
    }
  });
});
