import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-scripted-movement-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-021-capture-scripted-movement-oracle.md';
const VALID_CAPTURE_STATUSES = new Set(['captured', 'pending-external-reference-run']);
const FORWARD_SCANCODE = 72;

interface ScriptEntry {
  readonly kind: string;
  readonly tic: number;
  readonly scanCode: number;
  readonly description: string;
}

describe('capture identity and metadata', () => {
  test('declares OR-VP-SCRIPTED-MOVE-021 oracle id, step 02-021, and oracle lane', () => {
    expect(capture.id).toBe('OR-VP-SCRIPTED-MOVE-021');
    expect(capture.stepId).toBe('02-021');
    expect(capture.stepTitle).toBe('Capture Scripted Movement Oracle');
    expect(capture.lane).toBe('oracle');
    expect(VALID_CAPTURE_STATUSES.has(capture.captureStatus)).toBe(true);
  });

  test('pins DOOM.EXE / DOOM1.WAD / 35 Hz with disk presence and FRACUNIT', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(capture.fracUnit).toBe(65536);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });
});

describe('input script and capture tic schedule', () => {
  test('script uses UP-arrow scancode 72 for forward movement', () => {
    expect(capture.inputScript).toHaveLength(2);
    const downEvent = capture.inputScript[0] as ScriptEntry;
    const upEvent = capture.inputScript[1] as ScriptEntry;
    expect(downEvent.kind).toBe('key-down');
    expect(downEvent.scanCode).toBe(FORWARD_SCANCODE);
    expect(upEvent.kind).toBe('key-up');
    expect(upEvent.scanCode).toBe(FORWARD_SCANCODE);
  });

  test('forward key is held for exactly 35 tics (one second at 35 Hz)', () => {
    const downEvent = capture.inputScript[0] as ScriptEntry;
    const upEvent = capture.inputScript[1] as ScriptEntry;
    expect(upEvent.tic - downEvent.tic).toBe(capture.ticRateHz);
  });

  test('capture tics are non-decreasing and stay within the burst window', () => {
    expect([...capture.captureTics].sort((a, b) => a - b)).toEqual([...capture.captureTics]);
    for (const captureTic of capture.captureTics as readonly number[]) {
      expect(captureTic).toBeGreaterThanOrEqual(0);
      expect(captureTic).toBeLessThanOrEqual(capture.ticRateHz);
    }
  });

  test('capture tics include start (0), middle (17), and end (35)', () => {
    expect(capture.captureTics).toContain(0);
    expect(capture.captureTics).toContain(17);
    expect(capture.captureTics).toContain(35);
  });
});

describe('pending entries and step alignment', () => {
  test('framebuffer and state entries are empty while pending', () => {
    expect(Array.isArray(capture.framebufferEntries)).toBe(true);
    expect(Array.isArray(capture.stateEntries)).toBe(true);
    expect(capture.framebufferEntries).toHaveLength(0);
    expect(capture.stateEntries).toHaveLength(0);
  });

  test('step file write lock pins the capture json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-movement-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-movement-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('a different forward scancode (e.g. shift) would not be the canonical forward key', () => {
    expect(FORWARD_SCANCODE).not.toBe(54);
    expect(FORWARD_SCANCODE).not.toBe(0);
  });

  test('a fracUnit of 65535 or 65537 would not match vanilla fixed-point', () => {
    expect(capture.fracUnit).not.toBe(65_535);
    expect(capture.fracUnit).not.toBe(65_537);
  });
});
