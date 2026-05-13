import { describe, expect, test } from 'bun:test';

import { VANILLA_ANG270, VANILLA_ANG90, VANILLA_LASTLOOK_MASK, VANILLA_LOOK_MAX_PLAYERS_PER_CALL, computeLookForPlayersStopIndex, isAngleInFrontHalfArc, nextLastLookIndex } from '../../../src/ai/implement-look-for-players.ts';

describe('vanilla P_LookForPlayers constants', () => {
  test('max 2 players inspected per call', () => {
    expect(VANILLA_LOOK_MAX_PLAYERS_PER_CALL).toBe(2);
  });

  test('lastlook mask is 3 (round-robin over 4 slots)', () => {
    expect(VANILLA_LASTLOOK_MASK).toBe(3);
  });

  test('ANG90 and ANG270 BAM bounds', () => {
    expect(VANILLA_ANG90).toBe(0x40000000);
    expect(VANILLA_ANG270).toBe(0xc0000000);
  });
});

describe('isAngleInFrontHalfArc', () => {
  test('0 (directly ahead) is in front', () => {
    expect(isAngleInFrontHalfArc(0)).toBe(true);
  });

  test('ANG90 boundary (90° left) is in front (>= ANG90 is rear)', () => {
    expect(isAngleInFrontHalfArc(VANILLA_ANG90)).toBe(true);
  });

  test('ANG180 (directly behind) is in rear', () => {
    expect(isAngleInFrontHalfArc(0x80000000)).toBe(false);
  });

  test('ANG270 boundary is in front (right of 90°)', () => {
    expect(isAngleInFrontHalfArc(VANILLA_ANG270)).toBe(true);
  });
});

describe('lastlook index iteration', () => {
  test('next wraps via & 3', () => {
    expect(nextLastLookIndex(0)).toBe(1);
    expect(nextLastLookIndex(3)).toBe(0);
  });

  test('stop index is (current - 1) & 3', () => {
    expect(computeLookForPlayersStopIndex(0)).toBe(3);
    expect(computeLookForPlayersStopIndex(1)).toBe(0);
    expect(computeLookForPlayersStopIndex(2)).toBe(1);
    expect(computeLookForPlayersStopIndex(3)).toBe(2);
  });
});
