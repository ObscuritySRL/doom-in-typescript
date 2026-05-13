import { describe, expect, test } from 'bun:test';

import { MONSTER_AI_GATE } from '../../../src/ai/gate-monster-ai-semantics.ts';

describe('gate: monster AI semantics', () => {
  test('8 chase directions', () => {
    expect(MONSTER_AI_GATE.chaseDirections).toBe(8);
  });

  test('cacodemon bite damage 10..60', () => {
    expect(MONSTER_AI_GATE.cacoMeleeRange.dmg0).toBe(10);
    expect(MONSTER_AI_GATE.cacoMeleeRange.dmgMax).toBe(60);
  });

  test('baron claw damage 10..80', () => {
    expect(MONSTER_AI_GATE.baronMeleeRange.dmg0).toBe(10);
    expect(MONSTER_AI_GATE.baronMeleeRange.dmgMax).toBe(80);
  });

  test('lost soul collision damage 3..24', () => {
    expect(MONSTER_AI_GATE.lostSoulCollisionMin).toBe(3);
    expect(MONSTER_AI_GATE.lostSoulCollisionMax).toBe(24);
  });

  test('direction angles: east=0, west=(4<<29)', () => {
    expect(MONSTER_AI_GATE.directionAngleEast).toBe(0);
    expect(MONSTER_AI_GATE.directionAngleWest).toBe((4 << 29) | 0);
  });

  test('opposite of east is west (4)', () => {
    expect(MONSTER_AI_GATE.oppositeEast).toBe(4);
  });
});
