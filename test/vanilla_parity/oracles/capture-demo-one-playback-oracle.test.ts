import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-demo-one-playback-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-028-capture-demo-one-playback-oracle.md';
const VALID_RUN_MODES = new Set(['demo-playback', 'title-loop']);
const DEMO_LUMP_PATTERN = /^DEMO[1-3]$/;

describe('demo one playback capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-DEMO1-028');
    expect(capture.stepId).toBe('02-028');
    expect(capture.stepTitle).toBe('Capture Demo One Playback Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(VALID_RUN_MODES.has(capture.targetRunMode)).toBe(true);
    expect(capture.targetRunMode).toBe('demo-playback');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });

  test('demo lump name matches DEMO[1-3] pattern', () => {
    expect(capture.demoLumpName).toMatch(DEMO_LUMP_PATTERN);
    expect(capture.demoLumpName).toBe('DEMO1');
  });

  test('demo binary format constants match vanilla', () => {
    expect(capture.demoHeaderBytes).toBe(13);
    expect(capture.demoTiccmdBytes).toBe(4);
    expect(capture.demoTerminatorByte).toBe(0x80);
  });

  test('state and framebuffer entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.framebufferEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-demo-one-playback-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-demo-one-playback-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: a demo header size of 12 or 14 would not match vanilla', () => {
    expect(capture.demoHeaderBytes).not.toBe(12);
    expect(capture.demoHeaderBytes).not.toBe(14);
  });

  test('failure mode: a ticcmd size of 3 or 5 would not match vanilla', () => {
    expect(capture.demoTiccmdBytes).not.toBe(3);
    expect(capture.demoTiccmdBytes).not.toBe(5);
  });
});
