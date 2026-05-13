import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-scripted-combat-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-024-capture-scripted-combat-oracle.md';

describe('capture identity and metadata', () => {
  test('declares OR-VP-COMBAT-024 oracle id, step 02-024, oracle lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-COMBAT-024');
    expect(capture.stepId).toBe('02-024');
    expect(capture.stepTitle).toBe('Capture Scripted Combat Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE / DOOM1.WAD / 35 Hz with disk presence', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('fire scancode is 29 (LCTRL) per default.cfg key_fire', () => {
    expect(capture.fireScancode).toBe(29);
  });

  test('pistol damage range matches vanilla 5-15 (P_DamageMobj 5*(P_Random()&3)+5)', () => {
    expect(capture.expectedPistolDamageMinPerShot).toBe(5);
    expect(capture.expectedPistolDamageMaxPerShot).toBe(15);
    expect(capture.expectedPistolDamageMaxPerShot - capture.expectedPistolDamageMinPerShot).toBe(10);
  });

  test('zombieman spawn health is 20 per mobjinfo[MT_POSSESSED]', () => {
    expect(capture.expectedZombiemanSpawnHealth).toBe(20);
  });

  test('state entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-combat-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-combat-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('zombieman health of 19 or 21 would not match vanilla mobjinfo', () => {
    expect(capture.expectedZombiemanSpawnHealth).not.toBe(19);
    expect(capture.expectedZombiemanSpawnHealth).not.toBe(21);
  });

  test('pistol damage outside [5,15] would not match vanilla P_DamageMobj for pistol bullet', () => {
    expect(capture.expectedPistolDamageMinPerShot).not.toBe(4);
    expect(capture.expectedPistolDamageMaxPerShot).not.toBe(16);
  });
});
