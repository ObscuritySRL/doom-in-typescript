import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BOSS_DEATH_BABY_TAG,
  BOSS_DEATH_FATSO_TAG,
  BOSS_DEATH_TAG,
  KEEN_DIE_DOOR_TAG,
  MAX_BRAIN_TARGETS,
  SFX_BOSDTH,
  SFX_BOSPIT,
  SFX_HOOF,
  SFX_METAL,
  SFX_TELEPT,
  VANILLA_BOSS_SPECIALS_INVARIANTS,
  aBossDeath,
  aKeenDie,
  aPainDie,
  resetBrainTargets,
} from '../../../src/vanilla/wireBossSpecials.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireBossSpecials.ts');

describe('plan_final ai: wire-boss-specials', () => {
  test('src/vanilla/wireBossSpecials.ts exists, is a regular file, and cites plan_final step 10-006', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('10-006');
    expect(fileText).toContain('VANILLA_BOSS_SPECIALS_INVARIANTS');
  });

  test('the facade re-exports only from the read-only bossSpecials module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/bossSpecials.ts']);
  });

  test('VANILLA_BOSS_SPECIALS_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_BOSS_SPECIALS_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_BOSS_SPECIALS_INVARIANTS)).toBe(true);
    const ids = VANILLA_BOSS_SPECIALS_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['BRAIN_TARGETS_CAP_IS_32_COMMERCIAL_ONLY', 'E1M8_BARON_DEATH_LOWERS_TAG_666_FLOOR', 'KEEN_DIE_OPENS_TAG_666_DOOR', 'PAIN_DIE_USES_TAG_667_BABY_PATH', 'REGISTERED_ULTIMATE_BOSS_PATHS_ARE_IWAD_AGNOSTIC']);
    for (const invariant of VANILLA_BOSS_SPECIALS_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the boss-death tags and sfx ids match vanilla p_enemy.c', () => {
    expect(BOSS_DEATH_TAG).toBe(666);
    expect(BOSS_DEATH_FATSO_TAG).toBe(666);
    expect(KEEN_DIE_DOOR_TAG).toBe(666);
    expect(BOSS_DEATH_BABY_TAG).toBe(667);
    expect(MAX_BRAIN_TARGETS).toBe(32);
    expect(SFX_TELEPT).toBe(35);
    expect(SFX_HOOF).toBe(84);
    expect(SFX_METAL).toBe(85);
    expect(SFX_BOSPIT).toBe(94);
    expect(SFX_BOSDTH).toBe(98);
  });

  test('every wired boss-death codepointer is re-exported as a callable function', () => {
    expect(typeof aBossDeath).toBe('function');
    expect(typeof aKeenDie).toBe('function');
    expect(typeof aPainDie).toBe('function');
    expect(typeof resetBrainTargets).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only bossSpecials module', async () => {
    const bossSource = await import('../../../src/ai/bossSpecials.ts');
    expect(aBossDeath).toBe(bossSource.aBossDeath);
    expect(aKeenDie).toBe(bossSource.aKeenDie);
    expect(BOSS_DEATH_TAG).toBe(bossSource.BOSS_DEATH_TAG);
    expect(MAX_BRAIN_TARGETS).toBe(bossSource.MAX_BRAIN_TARGETS);
  });
});
