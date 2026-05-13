import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-main-menu-open-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-018-capture-main-menu-open-oracle.md';
const VALID_CAPTURE_STATUSES = new Set(['captured', 'pending-external-reference-run']);
const VALID_RUN_MODES = new Set(['demo-playback', 'title-loop']);
const VALID_INPUT_KINDS = new Set(['key-down', 'key-up', 'mouse-button-down', 'mouse-button-up', 'mouse-move', 'quit']);
const ESCAPE_SCANCODE = 1;

interface ScriptEntry {
  readonly kind: string;
  readonly tic: number;
  readonly scanCode: number;
  readonly description: string;
}

describe('capture identity and metadata', () => {
  test('declares OR-VP-MENU-OPEN-018 oracle id, step 02-018, and oracle lane', () => {
    expect(capture.id).toBe('OR-VP-MENU-OPEN-018');
    expect(capture.stepId).toBe('02-018');
    expect(capture.stepTitle).toBe('Capture Main Menu Open Oracle');
    expect(capture.lane).toBe('oracle');
  });

  test('capture status is pending until an external reference run lands', () => {
    expect(VALID_CAPTURE_STATUSES.has(capture.captureStatus)).toBe(true);
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE, DOOM1.WAD, title-loop run mode, and 35 Hz tic rate', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(VALID_RUN_MODES.has(capture.targetRunMode)).toBe(true);
    expect(capture.ticRateHz).toBe(35);
  });

  test('research source files exist under the read-only doom/ tree', () => {
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });
});

describe('input script shape', () => {
  test('script has exactly one ESCAPE key-down followed by one key-up', () => {
    expect(capture.inputScript).toHaveLength(2);
    const downEvent = capture.inputScript[0] as ScriptEntry;
    const upEvent = capture.inputScript[1] as ScriptEntry;
    expect(downEvent.kind).toBe('key-down');
    expect(downEvent.scanCode).toBe(ESCAPE_SCANCODE);
    expect(upEvent.kind).toBe('key-up');
    expect(upEvent.scanCode).toBe(ESCAPE_SCANCODE);
  });

  test('script events are non-decreasing by tic', () => {
    for (let scriptIndex = 1; scriptIndex < capture.inputScript.length; scriptIndex += 1) {
      const previousEvent = capture.inputScript[scriptIndex - 1] as ScriptEntry;
      const currentEvent = capture.inputScript[scriptIndex] as ScriptEntry;
      expect(currentEvent.tic).toBeGreaterThanOrEqual(previousEvent.tic);
    }
  });

  test('every script event uses a valid input kind', () => {
    for (const scriptEvent of capture.inputScript as readonly ScriptEntry[]) {
      expect(VALID_INPUT_KINDS.has(scriptEvent.kind)).toBe(true);
      expect(scriptEvent.description.length).toBeGreaterThan(0);
    }
  });
});

describe('capture tic alignment and pending entries', () => {
  test('framebuffer, state, and audio captures all land at the same tic after the ESCAPE release', () => {
    const upTic = (capture.inputScript[1] as ScriptEntry).tic;
    expect(capture.framebufferCaptureTic).toBeGreaterThan(upTic);
    expect(capture.framebufferCaptureTic).toBe(capture.stateCaptureTic);
    expect(capture.framebufferCaptureTic).toBe(capture.audioWindowCaptureTic);
  });

  test('framebuffer, state, and audio entry arrays are empty while pending', () => {
    expect(Array.isArray(capture.framebufferEntries)).toBe(true);
    expect(Array.isArray(capture.stateEntries)).toBe(true);
    expect(Array.isArray(capture.audioEntries)).toBe(true);
    expect(capture.framebufferEntries).toHaveLength(0);
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.audioEntries).toHaveLength(0);
  });
});

describe('alignment with plan_vanilla_parity step 02-018', () => {
  test('step file write lock pins the capture json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-main-menu-open-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-main-menu-open-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('unknown capture statuses are rejected', () => {
    expect(VALID_CAPTURE_STATUSES.has('done')).toBe(false);
    expect(VALID_CAPTURE_STATUSES.has('')).toBe(false);
  });

  test('non-ESCAPE scancodes would fail the open-menu contract', () => {
    expect(ESCAPE_SCANCODE).toBe(1);
    expect(ESCAPE_SCANCODE).not.toBe(0);
    expect(ESCAPE_SCANCODE).not.toBe(2);
  });

  test('downstream follow-ups list is non-empty and unique', () => {
    expect(capture.downstreamFollowUps.length).toBeGreaterThan(0);
    expect(new Set(capture.downstreamFollowUps).size).toBe(capture.downstreamFollowUps.length);
  });
});
