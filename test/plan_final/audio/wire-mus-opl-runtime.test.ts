import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createMusOplRuntime } from '../../../src/vanilla/musOplRuntime.ts';
import type { MusOplRuntime } from '../../../src/vanilla/musOplRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RELATIVE_PATH = 'src/vanilla/musOplRuntime.ts';
const ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RELATIVE_PATH);

describe('plan_final audio: wire-mus-opl-runtime', () => {
  test('src/vanilla/musOplRuntime.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(ABSOLUTE_PATH)).toBe(true);
    expect(statSync(ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/musOplRuntime.ts cites plan_final step 11-006 in a top-of-file comment', () => {
    const fileText = readFileSync(ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('11-006');
    expect(fileText).toContain('createMusOplRuntime');
  });

  test('src/vanilla/musOplRuntime.ts imports the read-only MUS/OPL audio primitives without modifying them', () => {
    const fileText = readFileSync(ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../audio/musScheduler.ts'");
    expect(fileText).toContain("from '../audio/musicSystem.ts'");
    expect(fileText).toContain("from '../audio/musParser.ts'");
    expect(fileText).toContain("from '../audio/oplSynth.ts'");
    expect(fileText).toContain('parseMusScore');
    expect(fileText).toContain('createMusicSystem');
    expect(fileText).toContain('advanceMusScheduler');
    expect(fileText).toContain('combineOperators');
  });

  test('createMusOplRuntime returns a frozen façade carrying every wired MUS / scheduler / synth / musicSystem method', () => {
    const audio: MusOplRuntime = createMusOplRuntime();
    expect(Object.isFrozen(audio)).toBe(true);
    expect(typeof audio.parseMus).toBe('function');
    expect(typeof audio.createScheduler).toBe('function');
    expect(typeof audio.advanceScheduler).toBe('function');
    expect(typeof audio.createMusicSystem).toBe('function');
    expect(typeof audio.startMusic).toBe('function');
    expect(typeof audio.stopMusic).toBe('function');
    expect(typeof audio.pauseMusic).toBe('function');
    expect(typeof audio.resumeMusic).toBe('function');
    expect(typeof audio.changeMusic).toBe('function');
    expect(typeof audio.setMusicVolume).toBe('function');
    expect(typeof audio.advanceMusic).toBe('function');
    expect(typeof audio.isMusicPlaying).toBe('function');
    expect(typeof audio.resolveMusicNumber).toBe('function');
    expect(typeof audio.computePhaseIncrement).toBe('function');
    expect(typeof audio.computeWaveformSample).toBe('function');
    expect(typeof audio.computeTotalLevelGain).toBe('function');
    expect(typeof audio.combineOperators).toBe('function');
  });

  test('createMusicSystem returns a state object where isMusicPlaying is initially false', () => {
    const audio = createMusOplRuntime();
    const system = audio.createMusicSystem();
    expect(audio.isMusicPlaying(system)).toBe(false);
  });

  test('OPL synth primitives expose deterministic non-throwing computations for canonical inputs', () => {
    const audio = createMusOplRuntime();
    expect(typeof audio.computePhaseIncrement(0x100, 0, 0)).toBe('number');
    expect(typeof audio.computeWaveformSample(0, 0)).toBe('number');
    expect(typeof audio.computeTotalLevelGain(0)).toBe('number');
    expect(typeof audio.combineOperators(100, 200, 0)).toBe('number');
  });

  test('parseMus produces a Readonly<MusScore> for a minimal MUS lump fixture', () => {
    const lump = Buffer.alloc(64);
    lump.write('MUS\x1a', 0, 4);
    lump.writeUInt16LE(8, 4);
    lump.writeUInt16LE(56, 6);
    lump.writeUInt16LE(0, 8);
    lump.writeUInt16LE(0, 10);
    lump.writeUInt16LE(0, 12);
    lump.writeUInt8(0x60, 56);
    const audio = createMusOplRuntime();
    let caughtError: unknown;
    let score: ReturnType<typeof audio.parseMus> | undefined;
    try {
      score = audio.parseMus(lump);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeUndefined();
    expect(score).toBeDefined();
  });

  test('the façade does not allocate per-call state — repeated createMusicSystem calls return independent state objects', () => {
    const audio = createMusOplRuntime();
    const first = audio.createMusicSystem();
    const second = audio.createMusicSystem();
    expect(first).not.toBe(second);
  });
});
