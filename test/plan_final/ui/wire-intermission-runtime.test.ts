import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  SP_ITEMS_DELTA,
  SP_KILLS_DELTA,
  SP_SECRETS_DELTA,
  SP_STATE_FINAL,
  SP_STATE_INITIAL_PAUSE,
  SP_TIME_DELTA,
  TICRATE,
  VANILLA_INTERMISSION_RUNTIME_INVARIANTS,
  WI_MAX_PERCENT,
  WI_SHOW_NEXT_LOC_TICS,
  beginIntermission,
  checkForAccelerate,
  createIntermissionState,
  tickIntermission,
} from '../../../src/vanilla/wireIntermissionRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireIntermissionRuntime.ts');

describe('plan_final ui: wire-intermission-runtime', () => {
  test('src/vanilla/wireIntermissionRuntime.ts exists, is a regular file, and cites plan_final step 07-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-007');
    expect(fileText).toContain('VANILLA_INTERMISSION_RUNTIME_INVARIANTS');
  });

  test('the facade re-exports only from the read-only intermission module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ui/intermission.ts']);
  });

  test('VANILLA_INTERMISSION_RUNTIME_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_INTERMISSION_RUNTIME_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_INTERMISSION_RUNTIME_INVARIANTS)).toBe(true);
    const ids = VANILLA_INTERMISSION_RUNTIME_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['ACCELERATE_SKIPS_THE_STAT_PAUSE', 'INTERMISSION_ANIMATES_STATS_BY_FIXED_DELTAS', 'INTERMISSION_USES_MUS_INTER', 'SP_STATE_MACHINE_HAS_TEN_STATES', 'WORLD_DONE_TRANSITIONS_AFTER_FINAL_STATE']);
    for (const invariant of VANILLA_INTERMISSION_RUNTIME_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the intermission constants match vanilla wi_stuff.c', () => {
    expect(SP_STATE_INITIAL_PAUSE).toBe(1);
    expect(SP_STATE_FINAL).toBe(10);
    expect(SP_KILLS_DELTA).toBe(2);
    expect(SP_ITEMS_DELTA).toBe(2);
    expect(SP_SECRETS_DELTA).toBe(2);
    expect(SP_TIME_DELTA).toBe(3);
    expect(WI_MAX_PERCENT).toBe(100);
    expect(TICRATE).toBe(35);
    expect(WI_SHOW_NEXT_LOC_TICS).toBe(4 * TICRATE);
  });

  test('the intermission runtime entry points are re-exported as callable functions', () => {
    expect(typeof createIntermissionState).toBe('function');
    expect(typeof beginIntermission).toBe('function');
    expect(typeof checkForAccelerate).toBe('function');
    expect(typeof tickIntermission).toBe('function');
    expect(typeof createIntermissionState()).toBe('object');
  });

  test('the re-exported symbols are the SAME references as the read-only intermission module', async () => {
    const intermissionSource = await import('../../../src/ui/intermission.ts');
    expect(createIntermissionState).toBe(intermissionSource.createIntermissionState);
    expect(tickIntermission).toBe(intermissionSource.tickIntermission);
    expect(checkForAccelerate).toBe(intermissionSource.checkForAccelerate);
    expect(SP_STATE_FINAL).toBe(intermissionSource.SP_STATE_FINAL);
  });
});
