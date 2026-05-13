import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-intermission-transition-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-026-capture-intermission-transition-oracle.md';

describe('intermission transition capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-INTERMISSION-026');
    expect(capture.stepId).toBe('02-026');
    expect(capture.stepTitle).toBe('Capture Intermission Transition Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('intermission animation frame count matches vanilla 6 frames', () => {
    expect(capture.expectedIntermissionAnimationFrames).toBe(6);
  });

  test('state and framebuffer entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.framebufferEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-intermission-transition-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-intermission-transition-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: an animation frame count of 5 or 7 would not match vanilla', () => {
    expect(capture.expectedIntermissionAnimationFrames).not.toBe(5);
    expect(capture.expectedIntermissionAnimationFrames).not.toBe(7);
  });
});
