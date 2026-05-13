import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-damage-death-reborn-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-025-capture-damage-death-reborn-oracle.md';

describe('damage-death-reborn capture', () => {
  test('identity, lane, and pending status', () => {
    expect(capture.id).toBe('OR-VP-DEATH-REBORN-025');
    expect(capture.stepId).toBe('02-025');
    expect(capture.stepTitle).toBe('Capture Damage Death Reborn Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('death animation lengths match vanilla S_PLAY_DIE (7) and S_PLAY_XDIE (9)', () => {
    expect(capture.expectedDeathAnimationFrames).toBe(7);
    expect(capture.expectedExtremeDeathAnimationFrames).toBe(9);
  });

  test('reborn health is 100 single-player default', () => {
    expect(capture.expectedRebornHealth).toBe(100);
  });

  test('state entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-damage-death-reborn-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-damage-death-reborn-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure modes: non-vanilla animation lengths rejected', () => {
    expect(capture.expectedDeathAnimationFrames).not.toBe(6);
    expect(capture.expectedDeathAnimationFrames).not.toBe(8);
    expect(capture.expectedExtremeDeathAnimationFrames).not.toBe(8);
    expect(capture.expectedExtremeDeathAnimationFrames).not.toBe(10);
  });
});
