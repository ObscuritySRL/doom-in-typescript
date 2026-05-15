import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { NUMSFX, PITCH_CLAMP_MAX, PITCH_CLAMP_MIN, SFX_ID_MAX, SFX_ID_MIN, START_SOUND_LINK_MIN_VOLUME, VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS, startSound } from '../../../src/vanilla/wireSoundCallbackBridge.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSoundCallbackBridge.ts');

describe('plan_final audio: wire-sound-callback-bridge', () => {
  test('src/vanilla/wireSoundCallbackBridge.ts exists, is a regular file, and cites plan_final step 11-004', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('11-004');
    expect(fileText).toContain('VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS');
  });

  test('the facade re-exports only from the read-only soundSystem module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../audio/soundSystem.ts']);
  });

  test('VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS)).toBe(true);
    const ids = VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'LINK_VOLUME_EARLY_RETURN_PRECEDES_AUDIBILITY',
      'PITCH_PERTURBATION_BY_SFX_CLASS',
      'REMOTE_ORIGIN_ADJUSTS_WITH_SAME_POSITION_NORM_SEP_OVERRIDE',
      'SFX_ID_RANGE_INCLUDES_THE_NUMSFX_QUIRK',
      'STOP_THEN_ALLOCATE_CHANNEL_ORDER_IS_PRESERVED',
    ]);
    for (const invariant of VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the sfx-id range and pitch-clamp constants match vanilla s_sound.c / i_sound.c', () => {
    expect(NUMSFX).toBe(109);
    expect(SFX_ID_MIN).toBe(1);
    expect(SFX_ID_MAX).toBe(NUMSFX);
    expect(SFX_ID_MAX).toBe(109);
    expect(START_SOUND_LINK_MIN_VOLUME).toBe(1);
    expect(PITCH_CLAMP_MIN).toBe(0);
    expect(PITCH_CLAMP_MAX).toBe(255);
  });

  test('startSound is re-exported as a callable function', () => {
    expect(typeof startSound).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only soundSystem module', async () => {
    const soundSource = await import('../../../src/audio/soundSystem.ts');
    expect(startSound).toBe(soundSource.startSound);
    expect(NUMSFX).toBe(soundSource.NUMSFX);
    expect(SFX_ID_MAX).toBe(soundSource.SFX_ID_MAX);
    expect(PITCH_CLAMP_MAX).toBe(soundSource.PITCH_CLAMP_MAX);
  });
});
