import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { PLAYER_MOVEMENT_AND_DAMAGE_GATE } from '../../../src/player/gate-player-movement-and-damage.ts';

describe('gate: player movement and damage primitives are pinned', () => {
  test('vanilla forwardmove walk/run = [0x19, 0x32]', () => {
    expect([...PLAYER_MOVEMENT_AND_DAMAGE_GATE.forwardMove]).toEqual([0x19, 0x32]);
  });

  test('vanilla sidemove walk/run = [0x18, 0x28]', () => {
    expect([...PLAYER_MOVEMENT_AND_DAMAGE_GATE.sideMove]).toEqual([0x18, 0x28]);
  });

  test('vanilla angleturn normal/fast/slow = [640, 1280, 320]', () => {
    expect([...PLAYER_MOVEMENT_AND_DAMAGE_GATE.angleTurn]).toEqual([640, 1280, 320]);
  });

  test('SLOWTURNTICS = 6, MAXPLMOVE = 0x32', () => {
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.slowTurnTics).toBe(6);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.maxPlayerMove).toBe(0x32);
  });

  test('P_Thrust scale is 2048, MAXBOB is 0x100000, bob shift is 2', () => {
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.playerThrustScale).toBe(2048);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.maxBobFixed).toBe(16 * FRACUNIT);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.bobRightShift).toBe(2);
  });

  test('player friction 0xE800, stopspeed 0x1000, angletofineshift 19', () => {
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.playerFrictionFixed).toBe(0xe800);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.playerStopSpeedFixed).toBe(0x1000);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.angleToFineShift).toBe(19);
  });

  test('armor types: none=0, green=1, blue=2; baby skill = 1', () => {
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.armorTypeNone).toBe(0);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.armorTypeGreen).toBe(1);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.armorTypeBlue).toBe(2);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.babySkill).toBe(1);
  });

  test('cheat flags: noclip=1, godmode=2, nomomentum=4', () => {
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.cheatNoclip).toBe(1);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.cheatGodMode).toBe(2);
    expect(PLAYER_MOVEMENT_AND_DAMAGE_GATE.cheatNoMomentum).toBe(4);
  });

  test('gate object is frozen', () => {
    expect(Object.isFrozen(PLAYER_MOVEMENT_AND_DAMAGE_GATE)).toBe(true);
  });
});
