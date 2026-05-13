import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-save-load-roundtrip-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-031-capture-save-load-roundtrip-oracle.md';

describe('save load roundtrip capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-SAVE-LOAD-031');
    expect(capture.stepId).toBe('02-031');
    expect(capture.stepTitle).toBe('Capture Save Load Roundtrip Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('save slot under test is 0 and vanilla constants match 02-015', () => {
    expect(capture.saveSlotUnderTest).toBe(0);
    expect(capture.saveHeaderSizeBytes).toBe(24);
    expect(capture.vanillaSaveBytesLimit).toBe(180_224);
  });

  test('state and save entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.saveEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-save-load-roundtrip-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-save-load-roundtrip-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: a save header of 23 or 25 would not match vanilla', () => {
    expect(capture.saveHeaderSizeBytes).not.toBe(23);
    expect(capture.saveHeaderSizeBytes).not.toBe(25);
  });
});
