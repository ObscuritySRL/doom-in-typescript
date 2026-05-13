import { describe, expect, test } from 'bun:test';

import format from './define-save-byte-capture-format.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-015-define-save-byte-capture-format.md';

describe('format identity and metadata', () => {
  test('declares OR-VP-SAVE-BYTE-015 oracle id, step 02-015, and oracle lane', () => {
    expect(format.id).toBe('OR-VP-SAVE-BYTE-015');
    expect(format.stepId).toBe('02-015');
    expect(format.stepTitle).toBe('Define Save Byte Capture Format');
    expect(format.lane).toBe('oracle');
  });

  test('description references SAVE_HEADER_SIZE plus payload structure', () => {
    expect(format.description).toContain('SAVE_HEADER_SIZE');
  });
});

describe('vanilla DOOM 1.9 save constants', () => {
  test('save header size is 24 bytes', () => {
    expect(format.saveHeaderSizeBytes).toBe(24);
  });

  test('vanilla save bytes limit is 180224 bytes (176 KiB)', () => {
    expect(format.vanillaSaveBytesLimit).toBe(180_224);
    expect(format.vanillaSaveBytesLimit).toBe(176 * 1024);
  });

  test('save slot id range is [0, 5] for the six save slots', () => {
    expect(format.saveSlotIdMin).toBe(0);
    expect(format.saveSlotIdMax).toBe(5);
  });

  test('tic rate is 35 Hz', () => {
    expect(format.ticRateHz).toBe(35);
  });

  test('hash algorithm is SHA-256 with 64 hex characters per hash', () => {
    expect(format.hashAlgorithm).toBe('SHA-256');
    expect(format.hashHexLength).toBe(64);
  });
});

describe('entry shape and rules', () => {
  test('entry shape lists slotId, captureTic, byteLength, sha256, vanillaLimitRespected', () => {
    expect(format.entryShape).toEqual(['slotId', 'captureTic', 'byteLength', 'sha256', 'vanillaLimitRespected']);
  });

  test('entry ordering rule pins ascending slotId then captureTic', () => {
    expect(format.entryOrderingRule).toBe('ascending-by-slotid-then-by-captureTic');
  });

  test('capture size rule references the vanilla bytes limit', () => {
    expect(format.captureSizeRule).toContain('vanillaSaveBytesLimit');
    expect(format.captureSizeRule).toContain('byteLength');
  });
});

describe('alignment with plan_vanilla_parity step 02-015', () => {
  test('step file write lock pins the format json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-save-byte-capture-format.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-save-byte-capture-format.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('save header size of 23 or 25 would not match vanilla', () => {
    expect(format.saveHeaderSizeBytes).not.toBe(23);
    expect(format.saveHeaderSizeBytes).not.toBe(25);
  });

  test('vanilla save limit of 180223 or 180225 would not match vanilla', () => {
    expect(format.vanillaSaveBytesLimit).not.toBe(180_223);
    expect(format.vanillaSaveBytesLimit).not.toBe(180_225);
  });
});
