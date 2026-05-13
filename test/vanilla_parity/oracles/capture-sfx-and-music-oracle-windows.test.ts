import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import capture from './capture-sfx-and-music-oracle-windows.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-032-capture-sfx-and-music-oracle-windows.md';

describe('sfx and music capture', () => {
  test('identity, lane, pending status', () => {
    expect(capture.id).toBe('OR-VP-SFX-MUSIC-032');
    expect(capture.stepId).toBe('02-032');
    expect(capture.stepTitle).toBe('Capture Sfx And Music Oracle Windows');
    expect(capture.lane).toBe('oracle');
    expect(capture.captureStatus).toBe('pending-external-reference-run');
  });

  test('reference targets and audio constants match vanilla 44100 Hz / 1260 samples per tic', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHz).toBe(35);
    expect(capture.outputSampleRateHz).toBe(44_100);
    expect(capture.samplesPerTic).toBe(1260);
    expect(capture.samplesPerTic).toBe(capture.outputSampleRateHz / capture.ticRateHz);
    expect(existsSync(`doom/${capture.executableFilename}`)).toBe(true);
  });

  test('expected music track for E1M1 is D_E1M1 (Romero MUS lump name)', () => {
    expect(capture.expectedMusicTrack).toBe('D_E1M1');
  });

  test('audio and music entries empty while pending; step file pins write lock', async () => {
    expect(capture.audioEntries).toHaveLength(0);
    expect(capture.musicEventEntries).toHaveLength(0);
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-sfx-and-music-oracle-windows.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-sfx-and-music-oracle-windows.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('failure mode: a 22050 Hz sample rate would not match Chocolate Doom output', () => {
    expect(capture.outputSampleRateHz).not.toBe(22_050);
    expect(capture.outputSampleRateHz).not.toBe(48_000);
  });
});
