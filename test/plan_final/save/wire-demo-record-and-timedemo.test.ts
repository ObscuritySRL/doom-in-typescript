import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEMO_END_MARKER,
  DEMO_HEADER_SIZE,
  DEMO_MAX_PLAYERS,
  DEMO_RECORD_DEFAULT_MAXIMUM_SIZE,
  DEMO_RECORD_WRITE_HEADROOM,
  DEMO_TIC_RATE,
  DEMO_TIC_SIZE,
  DEMO_VERSION_19,
  DemoRecorder,
  VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS,
  parseDemoLump,
} from '../../../src/vanilla/wireDemoRecordAndTimedemo.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireDemoRecordAndTimedemo.ts');

describe('plan_final save-config-demo: wire-demo-record-and-timedemo', () => {
  test('src/vanilla/wireDemoRecordAndTimedemo.ts exists, is a regular file, and cites plan_final step 12-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-007');
    expect(fileText).toContain('VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS');
  });

  test('the facade re-exports only from the two read-only demo modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../demo/demoFile.ts', '../demo/demoRecord.ts']);
  });

  test('VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS)).toBe(true);
    const ids = VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'DEMO_HEADER_IS_THIRTEEN_BYTES_FOR_VERSION_19',
      'DETERMINISTIC_OUTPUT_REQUIRES_FROZEN_PLAYERSINGAME_AND_VANILLA_LIMIT',
      'PLAYDEMO_PARSES_HEADER_THEN_TIC_STREAM_AT_35HZ',
      'RECORDER_STOPS_BEFORE_A_TIC_WITH_LESS_THAN_16_BYTES',
      'RECORD_COMMAND_QUANTIZES_AND_RETURNS_NULL_ON_TERMINATION',
    ]);
    for (const invariant of VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the demo record/file constants match vanilla g_game.c', () => {
    expect(DEMO_VERSION_19).toBe(109);
    expect(DEMO_HEADER_SIZE).toBe(13);
    expect(DEMO_TIC_SIZE).toBe(4);
    expect(DEMO_END_MARKER).toBe(0x80);
    expect(DEMO_MAX_PLAYERS).toBe(4);
    expect(DEMO_TIC_RATE).toBe(35);
    expect(DEMO_RECORD_DEFAULT_MAXIMUM_SIZE).toBe(0x20_000);
    expect(DEMO_RECORD_WRITE_HEADROOM).toBe(16);
  });

  test('the demo entry points are re-exported as the parser function and the recorder class', () => {
    expect(typeof parseDemoLump).toBe('function');
    expect(typeof DemoRecorder).toBe('function');
    const recorder = new DemoRecorder({ episode: 1, map: 1, playersInGame: [true, false, false, false], skill: 2 });
    expect(recorder.ticCount).toBe(0);
    expect(recorder.headerByteLength).toBe(DEMO_HEADER_SIZE);
    expect(recorder.playersInGame.length).toBe(DEMO_MAX_PLAYERS);
    expect(() => new DemoRecorder({ episode: 1, map: 1, playersInGame: [false, false, false, false], skill: 2 })).toThrow(RangeError);
  });

  test('the re-exported symbols are the SAME references as the read-only demo modules', async () => {
    const recordSource = await import('../../../src/demo/demoRecord.ts');
    const fileSource = await import('../../../src/demo/demoFile.ts');
    expect(DemoRecorder).toBe(recordSource.DemoRecorder);
    expect(DEMO_RECORD_WRITE_HEADROOM).toBe(recordSource.DEMO_RECORD_WRITE_HEADROOM);
    expect(parseDemoLump).toBe(fileSource.parseDemoLump);
    expect(DEMO_VERSION_19).toBe(fileSource.DEMO_VERSION_19);
  });
});
