import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-full-e1-route-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-033-capture-full-e1-route-oracle.md';
const E1_LEVEL_PATTERN = /^E1M[1-9]$/;

describe('full E1 route capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-FULL-E1-033');
    expect(capture.stepId).toBe('02-033');
    expect(capture.stepTitle).toBe('Capture Full E1 Route Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('expected level order covers all nine E1 maps in canonical sequence', () => {
    expect(capture.expectedLevelOrder).toHaveLength(9);
    for (let levelIndex = 0; levelIndex < capture.expectedLevelOrder.length; levelIndex += 1) {
      const levelName = capture.expectedLevelOrder[levelIndex];
      expect(levelName).toMatch(E1_LEVEL_PATTERN);
      expect(levelName).toBe(`E1M${levelIndex + 1}`);
    }
  });

  test('entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.framebufferEntries).toHaveLength(0);
    expect(capture.musicEventEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-full-e1-route-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-full-e1-route-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: a level outside E1Mx range would not match shareware scope', () => {
    expect(E1_LEVEL_PATTERN.test('E2M1')).toBe(false);
    expect(E1_LEVEL_PATTERN.test('MAP01')).toBe(false);
  });
});
