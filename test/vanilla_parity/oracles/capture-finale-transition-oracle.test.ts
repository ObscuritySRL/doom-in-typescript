import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-finale-transition-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-027-capture-finale-transition-oracle.md';

describe('finale transition capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-FINALE-027');
    expect(capture.stepId).toBe('02-027');
    expect(capture.stepTitle).toBe('Capture Finale Transition Oracle');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets present at 35 Hz', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('text write rate is 3 tics per character (vanilla F_TextWrite)', () => {
    expect(capture.expectedTextWriteTicsPerCharacter).toBe(3);
  });

  test('state and framebuffer entries empty while pending; step file pins write lock', async () => {
    expect(capture.stateEntries).toHaveLength(0);
    expect(capture.framebufferEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-finale-transition-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-finale-transition-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: a text rate of 2 or 4 would not match vanilla', () => {
    expect(capture.expectedTextWriteTicsPerCharacter).not.toBe(2);
    expect(capture.expectedTextWriteTicsPerCharacter).not.toBe(4);
  });
});
