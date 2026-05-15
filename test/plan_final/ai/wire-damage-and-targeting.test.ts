import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MISSILE_BASE_CUTOFF,
  MISSILE_CYBORG_DIST_CLAMP,
  MISSILE_DIST_CLAMP,
  MISSILE_NO_MELEE_CUTOFF,
  MISSILE_UNDEAD_DIST_MIN,
  MISSILE_VILE_DIST_MAX,
  VANILLA_DAMAGE_TARGETING_INVARIANTS,
  checkMissileRange,
  checkSight,
  createSoundState,
  lookForPlayers,
  noiseAlert,
  radiusAttack,
} from '../../../src/vanilla/wireDamageAndTargeting.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireDamageAndTargeting.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final ai: wire-damage-and-targeting', () => {
  test('src/vanilla/wireDamageAndTargeting.ts exists, is a regular file, and cites plan_final step 10-002', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('10-002');
    expect(fileText).toContain('VANILLA_DAMAGE_TARGETING_INVARIANTS');
  });

  test('the facade re-exports only from the three read-only combat modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/soundPropagation.ts', '../ai/targeting.ts', '../world/radiusAttack.ts']);
  });

  test('VANILLA_DAMAGE_TARGETING_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_DAMAGE_TARGETING_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_DAMAGE_TARGETING_INVARIANTS)).toBe(true);
    const ids = VANILLA_DAMAGE_TARGETING_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'LOOKFORPLAYERS_FOV_GATED_BY_ALLAROUND',
      'MELEE_AND_MISSILE_RANGE_USE_FIXED_CUTOFFS',
      'NOISE_ALERT_FLOOD_FILLS_THROUGH_SOUND_LINES',
      'RADIUS_ATTACK_DAMAGE_FALLS_OFF_BY_DISTANCE',
      'TARGET_ACQUISITION_REQUIRES_LINE_OF_SIGHT',
    ]);
    for (const invariant of VANILLA_DAMAGE_TARGETING_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the missile range cutoffs and clamps match vanilla p_enemy.c', () => {
    expect(MISSILE_BASE_CUTOFF).toBe(64 * FRACUNIT);
    expect(MISSILE_NO_MELEE_CUTOFF).toBe(128 * FRACUNIT);
    expect(MISSILE_DIST_CLAMP).toBe(200);
    expect(MISSILE_CYBORG_DIST_CLAMP).toBe(160);
    expect(MISSILE_VILE_DIST_MAX).toBe(14 * 64);
    expect(MISSILE_UNDEAD_DIST_MIN).toBe(196);
  });

  test('createSoundState allocates a zero-initialized generation-stamped state sized to the sector count', () => {
    const state = createSoundState(7);
    expect(state.validcount).toBe(0);
    expect(state.sectorValidcount).toBeInstanceOf(Int32Array);
    expect(state.sectorValidcount.length).toBe(7);
    expect(state.sectorSoundTraversed.length).toBe(7);
    expect(state.sectorSoundTarget.length).toBe(7);
    expect(state.sectorSoundTarget.every((entry) => entry === null)).toBe(true);
  });

  test('every wired combat primitive is re-exported as a callable function', () => {
    expect(typeof checkSight).toBe('function');
    expect(typeof lookForPlayers).toBe('function');
    expect(typeof checkMissileRange).toBe('function');
    expect(typeof radiusAttack).toBe('function');
    expect(typeof noiseAlert).toBe('function');
    expect(typeof createSoundState).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const targetingSource = await import('../../../src/ai/targeting.ts');
    const soundSource = await import('../../../src/ai/soundPropagation.ts');
    const radiusSource = await import('../../../src/world/radiusAttack.ts');
    expect(checkSight).toBe(targetingSource.checkSight);
    expect(MISSILE_BASE_CUTOFF).toBe(targetingSource.MISSILE_BASE_CUTOFF);
    expect(createSoundState).toBe(soundSource.createSoundState);
    expect(radiusAttack).toBe(radiusSource.radiusAttack);
  });
});
