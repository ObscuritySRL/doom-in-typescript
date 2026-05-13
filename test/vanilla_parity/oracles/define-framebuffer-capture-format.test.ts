import { describe, expect, test } from 'bun:test';

import { DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS, FRAMEBUFFER_HEIGHT, FRAMEBUFFER_SIZE, FRAMEBUFFER_WIDTH, PALETTE_COUNT } from '../../../src/oracles/framebufferHash.ts';
import format from './define-framebuffer-capture-format.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-011-define-framebuffer-capture-format.md';

describe('format identity and metadata', () => {
  test('declares OR-VP-FRAMEBUFFER-FORMAT-011 oracle id, step 02-011, and oracle lane', () => {
    expect(format.id).toBe('OR-VP-FRAMEBUFFER-FORMAT-011');
    expect(format.stepId).toBe('02-011');
    expect(format.stepTitle).toBe('Define Framebuffer Capture Format');
    expect(format.lane).toBe('oracle');
  });

  test('points to the existing framebufferHash source module', () => {
    expect(format.sourceModule).toBe('src/oracles/framebufferHash.ts');
  });
});

describe('framebuffer dimensions match the source-level constants', () => {
  test('width is 320 and height is 200', () => {
    expect(format.framebufferWidth).toBe(FRAMEBUFFER_WIDTH);
    expect(format.framebufferWidth).toBe(320);
    expect(format.framebufferHeight).toBe(FRAMEBUFFER_HEIGHT);
    expect(format.framebufferHeight).toBe(200);
  });

  test('byte size is 64000 bytes (width times height, one byte per palette-indexed pixel)', () => {
    expect(format.framebufferSizeBytes).toBe(FRAMEBUFFER_SIZE);
    expect(format.framebufferSizeBytes).toBe(64000);
    expect(format.framebufferSizeBytes).toBe(format.framebufferWidth * format.framebufferHeight);
  });

  test('palette count is 14 and palette index range is [0, 13]', () => {
    expect(format.paletteCount).toBe(PALETTE_COUNT);
    expect(format.paletteCount).toBe(14);
    expect(format.paletteIndexMin).toBe(0);
    expect(format.paletteIndexMax).toBe(PALETTE_COUNT - 1);
    expect(format.paletteIndexMax).toBe(13);
  });
});

describe('tic and hash invariants', () => {
  test('tic rate is the canonical 35 Hz vanilla DOOM 1.9 value', () => {
    expect(format.ticRateHz).toBe(35);
  });

  test('default sampling interval matches the source-level constant', () => {
    expect(format.defaultSamplingIntervalTics).toBe(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS);
    expect(format.defaultSamplingIntervalTics).toBe(35);
  });

  test('hash algorithm is SHA-256 with 64 hex characters per hash', () => {
    expect(format.hashAlgorithm).toBe('SHA-256');
    expect(format.hashHexLength).toBe(64);
  });
});

describe('entry and payload shape', () => {
  test('entry shape lists exactly tic, hash, paletteIndex', () => {
    expect(format.entryShape).toEqual(['tic', 'hash', 'paletteIndex']);
  });

  test('payload shape covers description, run mode, sampling, dimensions, and entries', () => {
    expect(format.payloadShape).toContain('description');
    expect(format.payloadShape).toContain('targetRunMode');
    expect(format.payloadShape).toContain('samplingIntervalTics');
    expect(format.payloadShape).toContain('ticRateHz');
    expect(format.payloadShape).toContain('width');
    expect(format.payloadShape).toContain('height');
    expect(format.payloadShape).toContain('entries');
  });

  test('entry ordering rule pins ascending-by-tic order', () => {
    expect(format.entryOrderingRule).toBe('ascending-by-tic-number-strict');
  });
});

describe('alignment with plan_vanilla_parity step 02-011', () => {
  test('step file write lock pins the format json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-framebuffer-capture-format.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-framebuffer-capture-format.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('hex hash length of 63 or 65 would not satisfy a 64-hex SHA-256 contract', () => {
    expect(format.hashHexLength).not.toBe(63);
    expect(format.hashHexLength).not.toBe(65);
  });

  test('changing palette count would break parity with PLAYPAL F-027', () => {
    expect(format.paletteCount).not.toBe(13);
    expect(format.paletteCount).not.toBe(15);
  });

  test('downstream follow-ups list is non-empty and unique', () => {
    expect(format.downstreamFollowUps.length).toBeGreaterThan(0);
    expect(new Set(format.downstreamFollowUps).size).toBe(format.downstreamFollowUps.length);
  });
});
