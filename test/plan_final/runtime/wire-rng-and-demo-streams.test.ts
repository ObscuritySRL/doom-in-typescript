import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEMO_END_MARKER,
  DEMO_HEADER_SIZE,
  DEMO_MAX_PLAYERS,
  DEMO_TIC_RATE,
  DEMO_TIC_SIZE,
  DEMO_VERSION_19,
  DemoPlayback,
  DemoRecorder,
  DoomRandom,
  RNG_TABLE,
  VANILLA_RNG_DEMO_INVARIANTS,
} from '../../../src/vanilla/wireRngAndDemoStreams.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireRngAndDemoStreams.ts');

describe('plan_final runtime: wire-rng-and-demo-streams', () => {
  test('src/vanilla/wireRngAndDemoStreams.ts exists, is a regular file, and cites plan_final step 04-006', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('04-006');
    expect(fileText).toContain('VANILLA_RNG_DEMO_INVARIANTS');
  });

  test('the facade re-exports only from the read-only rng + demo modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../core/rng.ts', '../demo/demoFile.ts', '../demo/demoPlayback.ts', '../demo/demoRecord.ts']);
  });

  test('VANILLA_RNG_DEMO_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_RNG_DEMO_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_RNG_DEMO_INVARIANTS)).toBe(true);
    const ids = VANILLA_RNG_DEMO_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'DEMO_RECORD_AND_PLAYBACK_SHARE_4_BYTE_TIC_STREAM',
      'DEMO_TICCMD_HEADER_AND_VERSION_ARE_VANILLA',
      'DOOMRANDOM_IS_DETERMINISTIC_WITHOUT_SEED',
      'P_AND_M_RANDOM_ARE_INDEPENDENT_STREAMS',
      'RNG_TABLE_IS_256_FROZEN_ENTRIES',
    ]);
    for (const invariant of VANILLA_RNG_DEMO_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('RNG_TABLE is the frozen 256-entry vanilla rndtable of 0..255 bytes', () => {
    expect(RNG_TABLE.length).toBe(256);
    expect(Object.isFrozen(RNG_TABLE)).toBe(true);
    for (const entry of RNG_TABLE) {
      expect(Number.isInteger(entry)).toBe(true);
      expect(entry).toBeGreaterThanOrEqual(0);
      expect(entry).toBeLessThanOrEqual(255);
    }
  });

  test('DoomRandom is deterministic and P_Random / M_Random are independent streams', () => {
    const a = new DoomRandom();
    const b = new DoomRandom();
    const aSeq = [a.pRandom(), a.pRandom(), a.pRandom()];
    expect([b.pRandom(), b.pRandom(), b.pRandom()]).toEqual(aSeq);
    for (const value of aSeq) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    }

    const c = new DoomRandom();
    c.mRandom();
    c.mRandom();
    expect([c.pRandom(), c.pRandom(), c.pRandom()]).toEqual(aSeq);
  });

  test('the vanilla demo constants match g_game.c', () => {
    expect(DEMO_VERSION_19).toBe(109);
    expect(DEMO_HEADER_SIZE).toBe(13);
    expect(DEMO_TIC_SIZE).toBe(4);
    expect(DEMO_END_MARKER).toBe(0x80);
    expect(DEMO_MAX_PLAYERS).toBe(4);
    expect(DEMO_TIC_RATE).toBe(35);
    expect(typeof DemoRecorder).toBe('function');
    expect(typeof DemoPlayback).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const rngSource = await import('../../../src/core/rng.ts');
    const demoFileSource = await import('../../../src/demo/demoFile.ts');
    const demoRecordSource = await import('../../../src/demo/demoRecord.ts');
    expect(DoomRandom).toBe(rngSource.DoomRandom);
    expect(RNG_TABLE).toBe(rngSource.RNG_TABLE);
    expect(DEMO_TIC_SIZE).toBe(demoFileSource.DEMO_TIC_SIZE);
    expect(DemoRecorder).toBe(demoRecordSource.DemoRecorder);
  });
});
