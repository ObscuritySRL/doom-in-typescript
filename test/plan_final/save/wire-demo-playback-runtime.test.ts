import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEMO_END_MARKER,
  DEMO_PLAYBACK_DEFAULT_VERSION,
  DEMO_VANILLA_COMMAND_SIZE,
  DEMO_VANILLA_HEADER_SIZE,
  DEMO_VANILLA_VERSION_19,
  DemoPlayback,
  VANILLA_DEMO_PLAYBACK_INVARIANTS,
  parseDemo,
} from '../../../src/vanilla/wireDemoPlaybackRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireDemoPlaybackRuntime.ts');
const EXPECTED_INVARIANT_IDS = [
  'COMPLETION_ACTION_IS_QUIT_FOR_SINGLEDEMO_ELSE_ADVANCE',
  'DEMO_HEADER_FORMAT_DISPATCHES_ON_FIRST_BYTE',
  'MARKER_TIMING_RETURNS_FINAL_TIC_BEFORE_COMPLETION',
  'READNEXTTIC_YIELDS_ONE_TIC_PER_CALL_IN_PLAYER_ORDER',
  'SHAREWARE_ATTRACT_DEMOS_ARE_VANILLA_VERSION_19',
];

// One active player (playeringame[0]=1), two vanilla ticcmds, then the 0x80 marker.
// Header (13 bytes): version, skill, episode, map, deathmatch, respawn, fast, nomonsters, consoleplayer, playeringame[0..3].
const SYNTHETIC_VANILLA_DEMO = Buffer.from([
  DEMO_VANILLA_VERSION_19,
  2,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  25,
  0,
  0,
  0, // tic 0 player 0: forwardMove=25, sideMove=0, angleByte=0 (->0), buttons=0
  0,
  246,
  1,
  1, // tic 1 player 0: forwardMove=0, sideMove=-10 (246 int8), angleByte=1 (->256), buttons=1
  DEMO_END_MARKER,
]);

// A versioned demo whose version byte (50) is neither old (<=4) nor longtics (111) nor 109.
const WRONG_VERSION_DEMO = Buffer.from([50, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, DEMO_END_MARKER]);

describe('plan_final save: wire-demo-playback-runtime', () => {
  test('src/vanilla/wireDemoPlaybackRuntime.ts exists, is a regular file, and cites plan_final step 12-006', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-006');
    expect(fileText).toContain('VANILLA_DEMO_PLAYBACK_INVARIANTS');
  });

  test('the facade re-exports only from the two read-only demo modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../demo/demoParse.ts', '../demo/demoPlayback.ts']);
  });

  test('VANILLA_DEMO_PLAYBACK_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_DEMO_PLAYBACK_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_DEMO_PLAYBACK_INVARIANTS)).toBe(true);
    const ids = VANILLA_DEMO_PLAYBACK_INVARIANTS.map((invariant) => String(invariant.id)).sort();
    expect(ids).toEqual(EXPECTED_INVARIANT_IDS);
    for (const invariant of VANILLA_DEMO_PLAYBACK_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the re-exported vanilla demo constants are the pinned 1.9 values', () => {
    expect(DEMO_VANILLA_VERSION_19).toBe(109);
    expect(DEMO_PLAYBACK_DEFAULT_VERSION).toBe(109);
    expect(DEMO_END_MARKER).toBe(0x80);
    expect(DEMO_VANILLA_HEADER_SIZE).toBe(13);
    expect(DEMO_VANILLA_COMMAND_SIZE).toBe(4);
    expect(typeof parseDemo).toBe('function');
    expect(typeof DemoPlayback).toBe('function');
  });

  test('parseDemo decodes a versioned vanilla demo header and ticcmd stream', () => {
    const parsed = parseDemo(SYNTHETIC_VANILLA_DEMO);
    expect(parsed.format).toBe('vanilla');
    expect(parsed.versionByte).toBe(DEMO_VANILLA_VERSION_19);
    expect(parsed.headerByteLength).toBe(DEMO_VANILLA_HEADER_SIZE);
    expect(parsed.commandByteLength).toBe(DEMO_VANILLA_COMMAND_SIZE);
    expect(parsed.activePlayerCount).toBe(1);
    expect(parsed.ticCount).toBe(2);
  });

  test('DemoPlayback yields one tic per call and returns null only when it crosses the marker (attract loop)', () => {
    const playback = new DemoPlayback(SYNTHETIC_VANILLA_DEMO);
    expect(playback.readNextTic()).toEqual([{ angleTurn: 0, buttons: 0, forwardMove: 25, sideMove: 0 }]);
    expect(playback.readNextTic()).toEqual([{ angleTurn: 256, buttons: 1, forwardMove: 0, sideMove: -10 }]);
    expect(playback.readNextTic()).toBeNull();
    expect(playback.snapshot().completionAction).toBe('advance-demo');
  });

  test('singleDemo playback quits instead of advancing the attract loop on completion (-playdemo path)', () => {
    const playback = new DemoPlayback(SYNTHETIC_VANILLA_DEMO, { singleDemo: true });
    expect(playback.readNextTic()).not.toBeNull();
    expect(playback.readNextTic()).not.toBeNull();
    expect(playback.readNextTic()).toBeNull();
    expect(playback.snapshot().completionAction).toBe('quit');
  });

  test('DemoPlayback rejects a demo whose version byte does not match the expected vanilla version', () => {
    expect(() => new DemoPlayback(WRONG_VERSION_DEMO)).toThrow(RangeError);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const demoParseSource = await import('../../../src/demo/demoParse.ts');
    const demoPlaybackSource = await import('../../../src/demo/demoPlayback.ts');
    expect(parseDemo).toBe(demoParseSource.parseDemo);
    expect(DEMO_END_MARKER).toBe(demoParseSource.DEMO_END_MARKER);
    expect(DEMO_VANILLA_VERSION_19).toBe(demoParseSource.DEMO_VANILLA_VERSION_19);
    expect(DemoPlayback).toBe(demoPlaybackSource.DemoPlayback);
    expect(DEMO_PLAYBACK_DEFAULT_VERSION).toBe(demoPlaybackSource.DEMO_PLAYBACK_DEFAULT_VERSION);
  });
});
