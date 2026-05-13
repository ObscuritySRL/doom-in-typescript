import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-scripted-use-line-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-022-capture-scripted-use-line-oracle.md';

describe('capture identity and metadata', () => {
  test('declares OR-VP-USE-LINE-022 oracle id, step 02-022, oracle lane, and pending status', () => {
    expect(capture.id).toBe('OR-VP-USE-LINE-022');
    expect(capture.stepId).toBe('02-022');
    expect(capture.stepTitle).toBe('Capture Scripted Use Line Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE / DOOM1.WAD / 35 Hz with disk presence', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });

  test('use scancode is 57 (SPACE), the default.cfg key_use value', () => {
    expect(capture.useScancode).toBe(57);
  });

  test('captures land at USE press (0), USE+1, and ~70 tics later for door open animation', () => {
    expect(capture.captureTicsRelativeToUsePress).toEqual([0, 1, 70]);
  });

  test('expected sector special references a vanilla door type', () => {
    expect(capture.expectedSectorSpecial.toLowerCase()).toContain('door');
  });

  test('state entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-use-line-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-use-line-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('use scancode of 56 or 58 would not match default.cfg key_use', () => {
    expect(capture.useScancode).not.toBe(56);
    expect(capture.useScancode).not.toBe(58);
  });
});
