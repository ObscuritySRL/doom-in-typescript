import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import { FRAMEBUFFER_HEIGHT, FRAMEBUFFER_SIZE, FRAMEBUFFER_WIDTH, PALETTE_COUNT } from '../../../src/oracles/framebufferHash.ts';
import capture from './capture-initial-title-frame-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-017-capture-initial-title-frame-oracle.md';
const VALID_CAPTURE_STATUSES = new Set(['captured', 'pending-external-reference-run']);
const VALID_RUN_MODES = new Set(['demo-playback', 'title-loop']);
const SHA256_HEX_PATTERN = /^[0-9A-F]{64}$/;

interface FramebufferEntry {
  readonly tic: number;
  readonly hash: string;
  readonly paletteIndex: number;
}

describe('capture identity and metadata', () => {
  test('declares OR-VP-TITLE-FRAME-017 oracle id, step 02-017, and oracle lane', () => {
    expect(capture.id).toBe('OR-VP-TITLE-FRAME-017');
    expect(capture.stepId).toBe('02-017');
    expect(capture.stepTitle).toBe('Capture Initial Title Frame Oracle');
    expect(capture.lane).toBe('oracle');
  });

  test('capture status is a known value and is pending until an external reference run lands', () => {
    expect(VALID_CAPTURE_STATUSES.has(capture.captureStatus)).toBe(true);
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE, DOOM1.WAD, title-loop run mode, and the 35 Hz tic rate', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(VALID_RUN_MODES.has(capture.targetRunMode)).toBe(true);
    expect(capture.targetRunMode).toBe('title-loop');
    expect(capture.ticRateHz).toBe(35);
  });

  test('research source files exist under the read-only doom/ tree', () => {
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
    expect(existsSync(`doom/${capture.iwadFilename}`)).toBe(true);
  });
});

describe('framebuffer constants match the 02-011 format and source-level constants', () => {
  test('width is 320, height is 200, size is 64000 bytes', () => {
    expect(capture.framebufferWidth).toBe(FRAMEBUFFER_WIDTH);
    expect(capture.framebufferHeight).toBe(FRAMEBUFFER_HEIGHT);
    expect(capture.framebufferSizeBytes).toBe(FRAMEBUFFER_SIZE);
    expect(capture.framebufferSizeBytes).toBe(capture.framebufferWidth * capture.framebufferHeight);
  });

  test('palette count is 14 and expected title palette index is 0', () => {
    expect(capture.paletteCount).toBe(PALETTE_COUNT);
    expect(capture.expectedTitleScreenPaletteIndex).toBe(0);
  });

  test('hash algorithm is SHA-256 with 64 hex characters per hash', () => {
    expect(capture.hashAlgorithm).toBe('SHA-256');
    expect(capture.hashHexLength).toBe(64);
  });
});

describe('entry shape and pending status', () => {
  test('entry schema matches 02-011 framebuffer capture format', () => {
    expect(capture.entrySchema).toEqual(['tic', 'hash', 'paletteIndex']);
  });

  test('entries array is empty while capture is pending', () => {
    expect(Array.isArray(capture.entries)).toBe(true);
    expect(capture.entries).toHaveLength(0);
  });

  test('a hypothetical populated entry would satisfy SHA-256 hex shape and palette range', () => {
    const fabricatedEntry: FramebufferEntry = {
      tic: capture.samplingIntervalTics,
      hash: 'A'.repeat(64),
      paletteIndex: capture.expectedTitleScreenPaletteIndex,
    };
    expect(fabricatedEntry.hash).toMatch(SHA256_HEX_PATTERN);
    expect(fabricatedEntry.paletteIndex).toBeGreaterThanOrEqual(0);
    expect(fabricatedEntry.paletteIndex).toBeLessThan(capture.paletteCount);
    expect(fabricatedEntry.tic).toBeGreaterThanOrEqual(0);
  });
});

describe('alignment with plan_vanilla_parity step 02-017', () => {
  test('step file write lock pins the capture json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-initial-title-frame-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-initial-title-frame-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists DOOM.EXE and DOOM1.WAD among its research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/DOOM.EXE');
    expect(stepFileText).toContain('- doom/DOOM1.WAD');
  });
});

describe('failure-mode validation invariants', () => {
  test('unknown capture statuses are rejected', () => {
    expect(VALID_CAPTURE_STATUSES.has('done')).toBe(false);
    expect(VALID_CAPTURE_STATUSES.has('')).toBe(false);
  });

  test('SHA-256 hex pattern rejects lowercase or short hashes', () => {
    expect('a'.repeat(64)).not.toMatch(SHA256_HEX_PATTERN);
    expect('A'.repeat(63)).not.toMatch(SHA256_HEX_PATTERN);
    expect('A'.repeat(65)).not.toMatch(SHA256_HEX_PATTERN);
  });

  test('downstream follow-ups list is non-empty and unique', () => {
    expect(capture.downstreamFollowUps.length).toBeGreaterThan(0);
    expect(new Set(capture.downstreamFollowUps).size).toBe(capture.downstreamFollowUps.length);
  });
});
