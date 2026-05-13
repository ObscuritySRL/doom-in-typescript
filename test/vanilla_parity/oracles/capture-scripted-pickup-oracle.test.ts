import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-scripted-pickup-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-023-capture-scripted-pickup-oracle.md';

describe('capture identity and metadata', () => {
  test('declares OR-VP-PICKUP-023 oracle id, step 02-023, oracle lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-PICKUP-023');
    expect(capture.stepId).toBe('02-023');
    expect(capture.stepTitle).toBe('Capture Scripted Pickup Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('pins DOOM.EXE / DOOM1.WAD / 35 Hz with disk presence', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('expected vanilla armor pickup deltas: +100 armorpoints, armortype 2, +1 item count', () => {
    expect(capture.expectedArmorPointsDelta).toBe(100);
    expect(capture.expectedArmorTypeAfterPickup).toBe(2);
    expect(capture.expectedItemCountDelta).toBe(1);
  });

  test('state entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-pickup-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-scripted-pickup-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('armor delta of 99 or 101 would not match vanilla mega-armor', () => {
    expect(capture.expectedArmorPointsDelta).not.toBe(99);
    expect(capture.expectedArmorPointsDelta).not.toBe(101);
  });

  test('armor type 1 (green) or 3 would not match vanilla mega-armor (type 2)', () => {
    expect(capture.expectedArmorTypeAfterPickup).not.toBe(1);
    expect(capture.expectedArmorTypeAfterPickup).not.toBe(3);
  });
});
