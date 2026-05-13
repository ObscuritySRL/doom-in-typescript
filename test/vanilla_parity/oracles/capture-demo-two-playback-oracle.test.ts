import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-demo-two-playback-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-029-capture-demo-two-playback-oracle.md';

describe('demo two playback capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-DEMO2-029');
    expect(capture.stepId).toBe('02-029');
    expect(capture.stepTitle).toBe('Capture Demo Two Playback Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz; demo lump is DEMO2', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(capture.demoLumpName).toBe('DEMO2');
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('demo binary format constants match vanilla', () => {
    expect(capture.demoHeaderBytes).toBe(13);
    expect(capture.demoTiccmdBytes).toBe(4);
    expect(capture.demoTerminatorByte).toBe(0x80);
  });

  test('entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.framebufferEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-demo-two-playback-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-demo-two-playback-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: a wrong demo lump name would not match', () => {
    expect(capture.demoLumpName).not.toBe('DEMO1');
    expect(capture.demoLumpName).not.toBe('DEMO3');
  });
});
