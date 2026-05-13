import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ANGLE_TURN,
  VANILLA_FORWARD_MOVE,
  VANILLA_MAX_PLAYER_MOVE,
  VANILLA_PLAYER_THRUST_SCALE,
  VANILLA_SIDE_MOVE,
  VANILLA_SLOW_TURN_TICS,
  clampMovementToMaxPlayerMove,
  pickAngleTurnForHoldDurationTics,
} from '../../../src/player/implement-forward-side-and-turn-movement.ts';

describe('vanilla movement speed tables (g_game.c)', () => {
  test('forwardmove walk=0x19 (25), run=0x32 (50)', () => {
    expect([...VANILLA_FORWARD_MOVE]).toEqual([0x19, 0x32]);
  });

  test('sidemove walk=0x18 (24), run=0x28 (40)', () => {
    expect([...VANILLA_SIDE_MOVE]).toEqual([0x18, 0x28]);
  });

  test('angleturn normal=640, fast=1280, slow=320', () => {
    expect([...VANILLA_ANGLE_TURN]).toEqual([640, 1280, 320]);
  });

  test('SLOWTURNTICS is 6', () => {
    expect(VANILLA_SLOW_TURN_TICS).toBe(6);
  });

  test('MAXPLMOVE equals forwardmove[1] (run speed) = 50', () => {
    expect(VANILLA_MAX_PLAYER_MOVE).toBe(0x32);
    expect(VANILLA_MAX_PLAYER_MOVE).toBe(VANILLA_FORWARD_MOVE[1]);
  });

  test('player thrust scale is 2048 (P_PlayerThink P_Thrust factor)', () => {
    expect(VANILLA_PLAYER_THRUST_SCALE).toBe(2048);
  });
});

describe('pickAngleTurnForHoldDurationTics', () => {
  test('returns slow-ramp turn before SLOWTURNTICS regardless of fast flag', () => {
    expect(pickAngleTurnForHoldDurationTics(0, false)).toBe(VANILLA_ANGLE_TURN[2]);
    expect(pickAngleTurnForHoldDurationTics(0, true)).toBe(VANILLA_ANGLE_TURN[2]);
    expect(pickAngleTurnForHoldDurationTics(5, true)).toBe(VANILLA_ANGLE_TURN[2]);
  });

  test('returns normal turn at SLOWTURNTICS when not fast', () => {
    expect(pickAngleTurnForHoldDurationTics(VANILLA_SLOW_TURN_TICS, false)).toBe(VANILLA_ANGLE_TURN[0]);
  });

  test('returns fast turn at SLOWTURNTICS when fast is set', () => {
    expect(pickAngleTurnForHoldDurationTics(VANILLA_SLOW_TURN_TICS, true)).toBe(VANILLA_ANGLE_TURN[1]);
  });
});

describe('clampMovementToMaxPlayerMove', () => {
  test('passes through values within range', () => {
    expect(clampMovementToMaxPlayerMove(0)).toBe(0);
    expect(clampMovementToMaxPlayerMove(25)).toBe(25);
    expect(clampMovementToMaxPlayerMove(-25)).toBe(-25);
  });

  test('clamps positive overflow to MAXPLMOVE', () => {
    expect(clampMovementToMaxPlayerMove(100)).toBe(VANILLA_MAX_PLAYER_MOVE);
  });

  test('clamps negative overflow to -MAXPLMOVE', () => {
    expect(clampMovementToMaxPlayerMove(-100)).toBe(-VANILLA_MAX_PLAYER_MOVE);
  });
});
