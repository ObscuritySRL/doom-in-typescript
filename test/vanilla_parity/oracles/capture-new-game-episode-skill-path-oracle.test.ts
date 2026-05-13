import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import { REFERENCE_RUN_MANIFEST } from '../../../src/oracles/referenceRunManifest.ts';
import capture from './capture-new-game-episode-skill-path-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-019-capture-new-game-episode-skill-path-oracle.md';
const VALID_CAPTURE_STATUSES = new Set(['captured', 'pending-external-reference-run']);
const VALID_RUN_MODES = new Set(['demo-playback', 'title-loop']);
const ESCAPE_SCANCODE = 1;
const ENTER_SCANCODE = 28;
const DOWN_SCANCODE = 80;

interface ScriptEntry {
  readonly kind: string;
  readonly tic: number;
  readonly scanCode: number;
  readonly description: string;
}

describe('capture identity and metadata', () => {
  test('declares OR-VP-NEW-GAME-019 oracle id, step 02-019, and oracle lane', () => {
    expect(capture.id).toBe('OR-VP-NEW-GAME-019');
    expect(capture.stepId).toBe('02-019');
    expect(capture.stepTitle).toBe('Capture New Game Episode Skill Path Oracle');
    expect(capture.lane).toBe('oracle');
  });

  test('capture status is pending until an external reference run lands', () => {
    expect(VALID_CAPTURE_STATUSES.has(capture.captureStatus)).toBe(true);
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE / DOOM1.WAD / title-loop / 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(VALID_RUN_MODES.has(capture.targetRunMode)).toBe(true);
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });
});

describe('input script shape', () => {
  test('script uses only ESCAPE, ENTER, and DOWN DOS scancodes', () => {
    const allowedScanCodes = new Set([ESCAPE_SCANCODE, ENTER_SCANCODE, DOWN_SCANCODE]);
    for (const event of capture.inputScript as readonly ScriptEntry[]) {
      expect(allowedScanCodes.has(event.scanCode)).toBe(true);
    }
  });

  test('every key-down has a matching key-up at a later tic with the same scanCode', () => {
    const downByScancode = new Map<number, number>();
    for (const event of capture.inputScript as readonly ScriptEntry[]) {
      if (event.kind === 'key-down') {
        downByScancode.set(event.scanCode, event.tic);
      } else if (event.kind === 'key-up') {
        const matchingDownTic = downByScancode.get(event.scanCode);
        expect(matchingDownTic).toBeDefined();
        expect(event.tic).toBeGreaterThan(matchingDownTic!);
        downByScancode.delete(event.scanCode);
      }
    }
    expect(downByScancode.size).toBe(0);
  });

  test('script tics are non-decreasing', () => {
    for (let scriptIndex = 1; scriptIndex < capture.inputScript.length; scriptIndex += 1) {
      const previousEvent = capture.inputScript[scriptIndex - 1] as ScriptEntry;
      const currentEvent = capture.inputScript[scriptIndex] as ScriptEntry;
      expect(currentEvent.tic).toBeGreaterThanOrEqual(previousEvent.tic);
    }
  });
});

describe('expected startup parameters match the canonical reference manifest', () => {
  test('expected parameters match REFERENCE_RUN_MANIFEST.startup', () => {
    expect(capture.expectedStartupParameters.episode).toBe(REFERENCE_RUN_MANIFEST.startup.episode);
    expect(capture.expectedStartupParameters.map).toBe(REFERENCE_RUN_MANIFEST.startup.map);
    expect(capture.expectedStartupParameters.skill).toBe(REFERENCE_RUN_MANIFEST.startup.skill);
    expect(capture.expectedStartupParameters.deathmatch).toBe(REFERENCE_RUN_MANIFEST.startup.deathmatch);
    expect(capture.expectedStartupParameters.playerCount).toBe(REFERENCE_RUN_MANIFEST.startup.playerCount);
  });

  test('skill 2 is Hurt Me Plenty (vanilla default)', () => {
    expect(capture.expectedStartupParameters.skill).toBe(2);
  });
});

describe('capture tic alignment and pending entries', () => {
  test('state capture lands strictly after the final ENTER release', () => {
    const lastEvent = capture.inputScript[capture.inputScript.length - 1] as ScriptEntry;
    expect(lastEvent.kind).toBe('key-up');
    expect(lastEvent.scanCode).toBe(ENTER_SCANCODE);
    expect(capture.stateCaptureTic).toBeGreaterThan(lastEvent.tic);
  });

  test('state entries array is empty while pending', () => {
    expect(Array.isArray(capture.stateEntries)).toBe(true);
    expect(capture.stateEntries).toHaveLength(0);
  });
});

describe('alignment with plan_vanilla_parity step 02-019', () => {
  test('step file write lock pins the capture json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-new-game-episode-skill-path-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-new-game-episode-skill-path-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});
