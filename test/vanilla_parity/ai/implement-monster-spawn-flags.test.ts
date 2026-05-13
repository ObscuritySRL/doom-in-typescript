import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MF_AMBUSH_RUNTIME,
  VANILLA_MF_COUNTKILL,
  VANILLA_MF_DROPOFF,
  VANILLA_MF_FLOAT,
  VANILLA_MF_NOGRAVITY,
  VANILLA_MF_SHOOTABLE,
  VANILLA_MF_SOLID,
  VANILLA_MTF_AMBUSH,
  VANILLA_MTF_EASY,
  VANILLA_MTF_HARD,
  VANILLA_MTF_NETGAME,
  VANILLA_MTF_NORMAL,
  initMonsterSpawnState,
} from '../../../src/ai/implement-monster-spawn-flags.ts';

describe('vanilla mapthing flag bits (doomdata.h mapthing_t)', () => {
  test('MTF_EASY=1, NORMAL=2, HARD=4, AMBUSH=8, NETGAME=16', () => {
    expect(VANILLA_MTF_EASY).toBe(1);
    expect(VANILLA_MTF_NORMAL).toBe(2);
    expect(VANILLA_MTF_HARD).toBe(4);
    expect(VANILLA_MTF_AMBUSH).toBe(8);
    expect(VANILLA_MTF_NETGAME).toBe(16);
  });
});

describe('vanilla mobj flag bits (p_mobj.h mobjflag_t) relevant to monster spawn', () => {
  test('MF_SOLID=0x2, MF_SHOOTABLE=0x4, MF_FLOAT=0x4000, MF_NOGRAVITY=0x200', () => {
    expect(VANILLA_MF_SOLID).toBe(0x2);
    expect(VANILLA_MF_SHOOTABLE).toBe(0x4);
    expect(VANILLA_MF_FLOAT).toBe(0x4000);
    expect(VANILLA_MF_NOGRAVITY).toBe(0x200);
  });

  test('MF_DROPOFF=0x100000, MF_COUNTKILL=0x400000, MF_AMBUSH_RUNTIME=0x8000', () => {
    expect(VANILLA_MF_DROPOFF).toBe(0x10_0000);
    expect(VANILLA_MF_COUNTKILL).toBe(0x40_0000);
    expect(VANILLA_MF_AMBUSH_RUNTIME).toBe(0x8000);
  });
});

describe('initMonsterSpawnState', () => {
  test('all targets and movement counters reset to defaults', () => {
    const state = initMonsterSpawnState(0);
    expect(state.threshold).toBe(0);
    expect(state.movecount).toBe(0);
    expect(state.movedir).toBe(0);
    expect(state.target).toBeNull();
    expect(state.lastenemy).toBeNull();
    expect(state.tracer).toBeNull();
    expect(state.hasAmbushBit).toBe(false);
  });

  test('ambush bit detected from options', () => {
    const state = initMonsterSpawnState(VANILLA_MTF_AMBUSH);
    expect(state.hasAmbushBit).toBe(true);
  });

  test('non-ambush options do not set ambush bit', () => {
    const state = initMonsterSpawnState(VANILLA_MTF_EASY | VANILLA_MTF_NETGAME);
    expect(state.hasAmbushBit).toBe(false);
  });
});
