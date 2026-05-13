import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-e1m1-spawn-state-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-020-capture-e1m1-spawn-state-oracle.md';
const VALID_CAPTURE_STATUSES = new Set(['captured', 'pending-external-reference-run']);
const VALID_RUN_MODES = new Set(['demo-playback', 'title-loop']);

describe('capture identity and metadata', () => {
  test('declares OR-VP-E1M1-SPAWN-020 oracle id, step 02-020, and oracle lane', () => {
    expect(capture.id).toBe('OR-VP-E1M1-SPAWN-020');
    expect(capture.stepId).toBe('02-020');
    expect(capture.stepTitle).toBe('Capture E1M1 Spawn State Oracle');
    expect(capture.lane).toBe('oracle');
  });

  test('capture status is pending until an external reference run lands', () => {
    expect(VALID_CAPTURE_STATUSES.has(capture.captureStatus)).toBe(true);
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE / DOOM1.WAD / title-loop / 35 Hz with disk presence', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(VALID_RUN_MODES.has(capture.targetRunMode)).toBe(true);
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });
});

describe('vanilla DOOM 1.9 E1M1 player spawn invariants', () => {
  test('episode is 1, map is 1, player count is 1 (single player)', () => {
    expect(capture.expectedSpawnInvariants.episode).toBe(1);
    expect(capture.expectedSpawnInvariants.map).toBe(1);
    expect(capture.expectedSpawnInvariants.playerCount).toBe(1);
  });

  test('player spawns with 100 health, 0 armor, pistol weapon, 50 bullets', () => {
    expect(capture.expectedSpawnInvariants.playerHealth).toBe(100);
    expect(capture.expectedSpawnInvariants.playerArmor).toBe(0);
    expect(capture.expectedSpawnInvariants.playerStartingWeapon).toBe('pistol');
    expect(capture.expectedSpawnInvariants.playerStartingBulletAmmo).toBe(50);
  });

  test('starting frags, kills, items, secrets are all zero', () => {
    expect(capture.expectedSpawnInvariants.playerStartingFrags).toBe(0);
    expect(capture.expectedSpawnInvariants.playerStartingKills).toBe(0);
    expect(capture.expectedSpawnInvariants.playerStartingItems).toBe(0);
    expect(capture.expectedSpawnInvariants.playerStartingSecrets).toBe(0);
  });
});

describe('capture pending entries and alignment', () => {
  test('state entries array is empty while pending', () => {
    expect(Array.isArray(capture.stateEntries)).toBe(true);
    expect(capture.stateEntries).toHaveLength(0);
  });

  test('state capture tic is non-negative', () => {
    expect(capture.stateCaptureTic).toBeGreaterThanOrEqual(0);
  });

  test('step file write lock pins the capture json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-e1m1-spawn-state-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-e1m1-spawn-state-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('non-pistol starting weapons would not match vanilla', () => {
    expect(capture.expectedSpawnInvariants.playerStartingWeapon).not.toBe('shotgun');
    expect(capture.expectedSpawnInvariants.playerStartingWeapon).not.toBe('fist');
  });

  test('starting bullet ammo of 49 or 51 would not match vanilla', () => {
    expect(capture.expectedSpawnInvariants.playerStartingBulletAmmo).not.toBe(49);
    expect(capture.expectedSpawnInvariants.playerStartingBulletAmmo).not.toBe(51);
  });
});
