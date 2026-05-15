import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  EXPLODE_DAMAGE,
  PAIN_DEATH_ACTION_COUNT,
  PLAYER_SCREAM_GIB_HEALTH,
  SFX_BGDTH1,
  SFX_BGDTH2,
  SFX_PDIEHI,
  SFX_PLDETH,
  SFX_PODTH1,
  SFX_PODTH2,
  SFX_PODTH3,
  SFX_SLOP,
  VANILLA_STATE_TRANSITION_INVARIANTS,
  aExplode,
  aFall,
  aPain,
  aPlayerScream,
  aScream,
  aXScream,
  setMobjState,
  wirePainDeathActions,
} from '../../../src/vanilla/wireStateTransitions.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireStateTransitions.ts');

describe('plan_final ai: wire-state-transitions', () => {
  test('src/vanilla/wireStateTransitions.ts exists, is a regular file, and cites plan_final step 10-005', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('10-005');
    expect(fileText).toContain('VANILLA_STATE_TRANSITION_INVARIANTS');
  });

  test('the facade re-exports only from the read-only stateTransitions + mobj modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/stateTransitions.ts', '../world/mobj.ts']);
  });

  test('VANILLA_STATE_TRANSITION_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_STATE_TRANSITION_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_STATE_TRANSITION_INVARIANTS)).toBe(true);
    const ids = VANILLA_STATE_TRANSITION_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['EXPLODE_DAMAGE_IS_128_VIA_RADIUS_CALLBACK', 'GIB_DEATH_BELOW_NEGATIVE_FIFTY_HEALTH', 'PAIN_DEATH_REGISTRY_HAS_69_ACTIONS', 'SET_MOBJ_STATE_DRIVES_ALL_TRANSITIONS', 'SOUND_EVENTS_USE_FIXED_DEATH_SFX_IDS']);
    for (const invariant of VANILLA_STATE_TRANSITION_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the state-transition constants match vanilla', () => {
    expect(PAIN_DEATH_ACTION_COUNT).toBe(69);
    expect(EXPLODE_DAMAGE).toBe(128);
    expect(PLAYER_SCREAM_GIB_HEALTH).toBe(-50);
    expect(SFX_SLOP).toBe(31);
    expect(SFX_PLDETH).toBe(54);
    expect(SFX_PDIEHI).toBe(55);
    expect(SFX_PODTH1).toBe(56);
    expect(SFX_PODTH2).toBe(57);
    expect(SFX_PODTH3).toBe(58);
    expect(SFX_BGDTH1).toBe(59);
    expect(SFX_BGDTH2).toBe(60);
  });

  test('every wired state-transition primitive is re-exported as a callable function', () => {
    expect(typeof setMobjState).toBe('function');
    expect(typeof aPain).toBe('function');
    expect(typeof aScream).toBe('function');
    expect(typeof aXScream).toBe('function');
    expect(typeof aPlayerScream).toBe('function');
    expect(typeof aFall).toBe('function');
    expect(typeof aExplode).toBe('function');
    expect(typeof wirePainDeathActions).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const stateSource = await import('../../../src/ai/stateTransitions.ts');
    const mobjSource = await import('../../../src/world/mobj.ts');
    expect(aExplode).toBe(stateSource.aExplode);
    expect(PAIN_DEATH_ACTION_COUNT).toBe(stateSource.PAIN_DEATH_ACTION_COUNT);
    expect(setMobjState).toBe(mobjSource.setMobjState);
  });
});
