import { describe, expect, test } from 'bun:test';

import type { DemoTicCommand } from '../../src/demo/demoFile.ts';
import {
  ANGLE_TURN,
  BT_ATTACK,
  BT_CHANGE,
  BT_USE,
  BT_WEAPONMASK,
  BT_WEAPONSHIFT,
  EMPTY_TICCMD,
  FORWARD_MOVE,
  MAXPLMOVE,
  MOUSE_STRAFE_MULTIPLIER,
  MOUSE_TURN_MULTIPLIER,
  SIDE_MOVE,
  SLOW_TURN_TICS,
  TICCMD_SIZE,
  TURBO_THRESHOLD,
  clampMovement,
  extractWeaponNumber,
  packTicCommand,
  packWeaponChange,
  truncateInt16,
  truncateInt8,
} from '../../src/input/ticcmd.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';

describe('TICCMD_SIZE', () => {
  test('equals 8 bytes (int8 + int8 + int16 + int16 + uint8 + uint8)', () => {
    expect(TICCMD_SIZE).toBe(8);
  });
});

describe('button flags', () => {
  test('BT_ATTACK is bit 0', () => {
    expect(BT_ATTACK).toBe(1);
  });

  test('BT_USE is bit 1', () => {
    expect(BT_USE).toBe(2);
  });

  test('BT_CHANGE is bit 2', () => {
    expect(BT_CHANGE).toBe(4);
  });

  test('BT_WEAPONMASK covers bits 3-5', () => {
    expect(BT_WEAPONMASK).toBe(0x38);
    expect(BT_WEAPONMASK).toBe(8 + 16 + 32);
  });

  test('BT_WEAPONSHIFT is 3', () => {
    expect(BT_WEAPONSHIFT).toBe(3);
  });

  test('action flags do not overlap weapon mask', () => {
    expect(BT_ATTACK & BT_WEAPONMASK).toBe(0);
    expect(BT_USE & BT_WEAPONMASK).toBe(0);
    expect(BT_CHANGE & BT_WEAPONMASK).toBe(0);
  });

  test('all button flags fit in a uint8', () => {
    const allFlags = BT_ATTACK | BT_USE | BT_CHANGE | BT_WEAPONMASK;
    expect(allFlags).toBeLessThanOrEqual(0xff);
  });

  test('action flags are mutually non-overlapping', () => {
    expect(BT_ATTACK & BT_USE).toBe(0);
    expect(BT_ATTACK & BT_CHANGE).toBe(0);
    expect(BT_USE & BT_CHANGE).toBe(0);
  });
});

describe('FORWARD_MOVE', () => {
  test('normal speed is 0x19 (25)', () => {
    expect(FORWARD_MOVE[0]).toBe(0x19);
    expect(FORWARD_MOVE[0]).toBe(25);
  });

  test('run speed is 0x32 (50)', () => {
    expect(FORWARD_MOVE[1]).toBe(0x32);
    expect(FORWARD_MOVE[1]).toBe(50);
  });

  test('run speed exceeds normal speed', () => {
    expect(FORWARD_MOVE[1]).toBeGreaterThan(FORWARD_MOVE[0]);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(FORWARD_MOVE)).toBe(true);
  });
});

describe('SIDE_MOVE', () => {
  test('normal speed is 0x18 (24)', () => {
    expect(SIDE_MOVE[0]).toBe(0x18);
    expect(SIDE_MOVE[0]).toBe(24);
  });

  test('run speed is 0x28 (40)', () => {
    expect(SIDE_MOVE[1]).toBe(0x28);
    expect(SIDE_MOVE[1]).toBe(40);
  });

  test('run speed exceeds normal speed', () => {
    expect(SIDE_MOVE[1]).toBeGreaterThan(SIDE_MOVE[0]);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(SIDE_MOVE)).toBe(true);
  });
});

describe('MAXPLMOVE', () => {
  test('equals FORWARD_MOVE[1]', () => {
    expect(MAXPLMOVE).toBe(FORWARD_MOVE[1]);
  });

  test('is 0x32 (50)', () => {
    expect(MAXPLMOVE).toBe(0x32);
  });

  test('fits in signed byte range', () => {
    expect(MAXPLMOVE).toBeLessThanOrEqual(127);
    expect(-MAXPLMOVE).toBeGreaterThanOrEqual(-128);
  });
});

describe('ANGLE_TURN', () => {
  test('normal turn speed is 640', () => {
    expect(ANGLE_TURN[0]).toBe(640);
  });

  test('fast turn speed is 1280', () => {
    expect(ANGLE_TURN[1]).toBe(1280);
  });

  test('slow turn speed is 320', () => {
    expect(ANGLE_TURN[2]).toBe(320);
  });

  test('fast > normal > slow', () => {
    expect(ANGLE_TURN[1]).toBeGreaterThan(ANGLE_TURN[0]);
    expect(ANGLE_TURN[0]).toBeGreaterThan(ANGLE_TURN[2]);
  });

  test('fast is exactly 2x normal', () => {
    expect(ANGLE_TURN[1]).toBe(ANGLE_TURN[0] * 2);
  });

  test('slow is exactly half normal', () => {
    expect(ANGLE_TURN[2]).toBe(ANGLE_TURN[0] / 2);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(ANGLE_TURN)).toBe(true);
  });
});

describe('SLOW_TURN_TICS', () => {
  test('is 6', () => {
    expect(SLOW_TURN_TICS).toBe(6);
  });

  test('is positive', () => {
    expect(SLOW_TURN_TICS).toBeGreaterThan(0);
  });
});

describe('TURBO_THRESHOLD', () => {
  test('equals 0x32', () => {
    expect(TURBO_THRESHOLD).toBe(0x32);
  });

  test('equals MAXPLMOVE', () => {
    expect(TURBO_THRESHOLD).toBe(MAXPLMOVE);
  });
});

describe('mouse multipliers', () => {
  test('MOUSE_TURN_MULTIPLIER is 0x8', () => {
    expect(MOUSE_TURN_MULTIPLIER).toBe(0x8);
    expect(MOUSE_TURN_MULTIPLIER).toBe(8);
  });

  test('MOUSE_STRAFE_MULTIPLIER is 2', () => {
    expect(MOUSE_STRAFE_MULTIPLIER).toBe(2);
  });

  test('turn multiplier exceeds strafe multiplier', () => {
    expect(MOUSE_TURN_MULTIPLIER).toBeGreaterThan(MOUSE_STRAFE_MULTIPLIER);
  });
});

describe('EMPTY_TICCMD', () => {
  test('all fields are zero', () => {
    expect(EMPTY_TICCMD.forwardmove).toBe(0);
    expect(EMPTY_TICCMD.sidemove).toBe(0);
    expect(EMPTY_TICCMD.angleturn).toBe(0);
    expect(EMPTY_TICCMD.consistancy).toBe(0);
    expect(EMPTY_TICCMD.chatchar).toBe(0);
    expect(EMPTY_TICCMD.buttons).toBe(0);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(EMPTY_TICCMD)).toBe(true);
  });

  test('has exactly 6 fields', () => {
    expect(Object.keys(EMPTY_TICCMD)).toHaveLength(6);
  });
});

describe('clampMovement', () => {
  test('zero passes through', () => {
    expect(clampMovement(0)).toBe(0);
  });

  test('values within range pass through', () => {
    expect(clampMovement(25)).toBe(25);
    expect(clampMovement(-25)).toBe(-25);
  });

  test('positive boundary passes through', () => {
    expect(clampMovement(MAXPLMOVE)).toBe(MAXPLMOVE);
  });

  test('negative boundary passes through', () => {
    expect(clampMovement(-MAXPLMOVE)).toBe(-MAXPLMOVE);
  });

  test('clamps above MAXPLMOVE', () => {
    expect(clampMovement(MAXPLMOVE + 1)).toBe(MAXPLMOVE);
    expect(clampMovement(200)).toBe(MAXPLMOVE);
  });

  test('clamps below -MAXPLMOVE', () => {
    expect(clampMovement(-MAXPLMOVE - 1)).toBe(-MAXPLMOVE);
    expect(clampMovement(-200)).toBe(-MAXPLMOVE);
  });
});

describe('truncateInt8', () => {
  test('zero passes through', () => {
    expect(truncateInt8(0)).toBe(0);
  });

  test('positive values within range pass through', () => {
    expect(truncateInt8(50)).toBe(50);
    expect(truncateInt8(127)).toBe(127);
  });

  test('negative values within range pass through', () => {
    expect(truncateInt8(-50)).toBe(-50);
    expect(truncateInt8(-128)).toBe(-128);
  });

  test('128 wraps to -128', () => {
    expect(truncateInt8(128)).toBe(-128);
  });

  test('-129 wraps to 127', () => {
    expect(truncateInt8(-129)).toBe(127);
  });

  test('256 wraps to 0', () => {
    expect(truncateInt8(256)).toBe(0);
  });

  test('200 wraps to -56 (matching C signed char cast)', () => {
    expect(truncateInt8(200)).toBe(-56);
  });

  test('-200 wraps to 56 (matching C signed char cast)', () => {
    expect(truncateInt8(-200)).toBe(56);
  });
});

describe('truncateInt16', () => {
  test('zero passes through', () => {
    expect(truncateInt16(0)).toBe(0);
  });

  test('positive values within range pass through', () => {
    expect(truncateInt16(1280)).toBe(1280);
    expect(truncateInt16(32767)).toBe(32767);
  });

  test('negative values within range pass through', () => {
    expect(truncateInt16(-1280)).toBe(-1280);
    expect(truncateInt16(-32768)).toBe(-32768);
  });

  test('32768 wraps to -32768', () => {
    expect(truncateInt16(32768)).toBe(-32768);
  });

  test('-32769 wraps to 32767', () => {
    expect(truncateInt16(-32769)).toBe(32767);
  });

  test('65536 wraps to 0', () => {
    expect(truncateInt16(65536)).toBe(0);
  });

  test('40000 wraps to -25536 (matching C short cast)', () => {
    expect(truncateInt16(40000)).toBe(-25536);
  });
});

describe('extractWeaponNumber', () => {
  test('returns 0 when no weapon bits are set', () => {
    expect(extractWeaponNumber(0)).toBe(0);
    expect(extractWeaponNumber(BT_ATTACK | BT_USE | BT_CHANGE)).toBe(0);
  });

  test('extracts weapon 1', () => {
    expect(extractWeaponNumber(BT_CHANGE | (1 << BT_WEAPONSHIFT))).toBe(1);
  });

  test('extracts weapon 7 (maximum)', () => {
    expect(extractWeaponNumber(BT_CHANGE | (7 << BT_WEAPONSHIFT))).toBe(7);
  });

  test('extracts weapon 5', () => {
    const buttons = BT_CHANGE | BT_ATTACK | (5 << BT_WEAPONSHIFT);
    expect(extractWeaponNumber(buttons)).toBe(5);
  });

  test('ignores non-weapon bits', () => {
    const buttons = BT_ATTACK | BT_USE | (3 << BT_WEAPONSHIFT);
    expect(extractWeaponNumber(buttons)).toBe(3);
  });
});

describe('packWeaponChange', () => {
  test('weapon 0 sets BT_CHANGE with no weapon bits', () => {
    const packed = packWeaponChange(0);
    expect(packed & BT_CHANGE).toBe(BT_CHANGE);
    expect(extractWeaponNumber(packed)).toBe(0);
  });

  test('weapon 7 sets BT_CHANGE with all weapon bits', () => {
    const packed = packWeaponChange(7);
    expect(packed & BT_CHANGE).toBe(BT_CHANGE);
    expect(extractWeaponNumber(packed)).toBe(7);
  });

  test('round-trips all 8 weapon numbers through extract', () => {
    for (let weapon = 0; weapon < 8; weapon++) {
      const packed = packWeaponChange(weapon);
      expect(extractWeaponNumber(packed)).toBe(weapon);
    }
  });

  test('does not set BT_ATTACK or BT_USE', () => {
    for (let weapon = 0; weapon < 8; weapon++) {
      const packed = packWeaponChange(weapon);
      expect(packed & BT_ATTACK).toBe(0);
      expect(packed & BT_USE).toBe(0);
    }
  });

  test('masks to 3 weapon bits', () => {
    const packed = packWeaponChange(8);
    expect(extractWeaponNumber(packed)).toBe(0);
  });
});

describe('packTicCommand', () => {
  test('zero input produces all-zero ticcmd', () => {
    const cmd = packTicCommand(0, 0, 0, 0, 0, 0);
    expect(cmd.forwardmove).toBe(0);
    expect(cmd.sidemove).toBe(0);
    expect(cmd.angleturn).toBe(0);
    expect(cmd.consistancy).toBe(0);
    expect(cmd.chatchar).toBe(0);
    expect(cmd.buttons).toBe(0);
  });

  test('normal movement values pass through', () => {
    const cmd = packTicCommand(25, -24, 640, BT_ATTACK, 42, 0);
    expect(cmd.forwardmove).toBe(25);
    expect(cmd.sidemove).toBe(-24);
    expect(cmd.angleturn).toBe(640);
    expect(cmd.buttons).toBe(BT_ATTACK);
    expect(cmd.consistancy).toBe(42);
  });

  test('clamps forward movement to MAXPLMOVE', () => {
    const cmd = packTicCommand(100, 0, 0, 0, 0, 0);
    expect(cmd.forwardmove).toBe(MAXPLMOVE);
  });

  test('clamps negative forward movement to -MAXPLMOVE', () => {
    const cmd = packTicCommand(-100, 0, 0, 0, 0, 0);
    expect(cmd.forwardmove).toBe(-MAXPLMOVE);
  });

  test('clamps side movement to MAXPLMOVE', () => {
    const cmdPositive = packTicCommand(0, 100, 0, 0, 0, 0);
    expect(cmdPositive.sidemove).toBe(MAXPLMOVE);

    const cmdNegative = packTicCommand(0, -100, 0, 0, 0, 0);
    expect(cmdNegative.sidemove).toBe(-MAXPLMOVE);
  });

  test('truncates angleturn to int16', () => {
    const cmd = packTicCommand(0, 0, 40000, 0, 0, 0);
    expect(cmd.angleturn).toBe(-25536);
  });

  test('truncates consistancy to int16', () => {
    const cmd = packTicCommand(0, 0, 0, 0, 32768, 0);
    expect(cmd.consistancy).toBe(-32768);
  });

  test('masks buttons to uint8', () => {
    const cmd = packTicCommand(0, 0, 0, 0x1ff, 0, 0);
    expect(cmd.buttons).toBe(0xff);
  });

  test('masks chatchar to uint8', () => {
    const cmd = packTicCommand(0, 0, 0, 0, 0, 300);
    expect(cmd.chatchar).toBe(300 & 0xff);
  });

  test('result is frozen', () => {
    const cmd = packTicCommand(25, 24, 640, BT_ATTACK, 0, 0);
    expect(Object.isFrozen(cmd)).toBe(true);
  });

  test('weapon change with attack', () => {
    const buttons = BT_ATTACK | packWeaponChange(3);
    const cmd = packTicCommand(0, 0, 0, buttons, 0, 0);
    expect(cmd.buttons & BT_ATTACK).toBe(BT_ATTACK);
    expect(cmd.buttons & BT_CHANGE).toBe(BT_CHANGE);
    expect(extractWeaponNumber(cmd.buttons)).toBe(3);
  });
});

describe('parity-sensitive edge cases', () => {
  test('DemoTicCommand fields are a subset of TicCommand fields', () => {
    const demoCmd: DemoTicCommand = {
      forwardmove: 25,
      sidemove: 24,
      angleturn: 128,
      buttons: BT_ATTACK,
    };
    const ticCmd: TicCommand = {
      forwardmove: demoCmd.forwardmove,
      sidemove: demoCmd.sidemove,
      angleturn: demoCmd.angleturn << 8,
      consistancy: 0,
      chatchar: 0,
      buttons: demoCmd.buttons,
    };
    expect(ticCmd.forwardmove).toBe(25);
    expect(ticCmd.angleturn).toBe(32768);
  });

  test('demo angleturn byte 128 << 8 wraps to -32768 in int16', () => {
    const demoAngleturn = 128;
    const fullAngleturn = truncateInt16(demoAngleturn << 8);
    expect(fullAngleturn).toBe(-32768);
  });

  test('leftward turn is positive angleturn (counterclockwise convention)', () => {
    const leftTurn = ANGLE_TURN[0];
    expect(leftTurn).toBeGreaterThan(0);
    const cmd = packTicCommand(0, 0, leftTurn, 0, 0, 0);
    expect(cmd.angleturn).toBeGreaterThan(0);
  });

  test('rightward turn is negative angleturn', () => {
    const rightTurn = -ANGLE_TURN[0];
    expect(rightTurn).toBeLessThan(0);
    const cmd = packTicCommand(0, 0, rightTurn, 0, 0, 0);
    expect(cmd.angleturn).toBeLessThan(0);
  });

  test('mouse rightward motion produces negative angleturn', () => {
    const mouseX = 10;
    const angleturn = -(mouseX * MOUSE_TURN_MULTIPLIER);
    expect(angleturn).toBe(-80);
    const cmd = packTicCommand(0, 0, angleturn, 0, 0, 0);
    expect(cmd.angleturn).toBe(-80);
  });

  test('mouse strafe scaling is less aggressive than turn scaling', () => {
    const mouseX = 10;
    const strafeDelta = mouseX * MOUSE_STRAFE_MULTIPLIER;
    const turnDelta = mouseX * MOUSE_TURN_MULTIPLIER;
    expect(strafeDelta).toBeLessThan(turnDelta);
  });

  test('FORWARD_MOVE values match Doom g_game.c forwardmove[] table', () => {
    expect(FORWARD_MOVE[0]).toBe(25);
    expect(FORWARD_MOVE[1]).toBe(50);
  });

  test('SIDE_MOVE values match Doom g_game.c sidemove[] table', () => {
    expect(SIDE_MOVE[0]).toBe(24);
    expect(SIDE_MOVE[1]).toBe(40);
  });

  test('simultaneous forward+strafe at run speed both fit in MAXPLMOVE', () => {
    const forward = FORWARD_MOVE[1];
    const side = SIDE_MOVE[1];
    expect(forward).toBeLessThanOrEqual(MAXPLMOVE);
    expect(side).toBeLessThanOrEqual(MAXPLMOVE);
  });

  test('all turn speeds fit in int16 range', () => {
    for (const speed of ANGLE_TURN) {
      expect(speed).toBeGreaterThan(0);
      expect(speed).toBeLessThanOrEqual(32767);
    }
  });

  test('truncateInt8 matches C signed char for all movement speeds', () => {
    for (const speed of FORWARD_MOVE) {
      expect(truncateInt8(speed)).toBe(speed);
      expect(truncateInt8(-speed)).toBe(-speed);
    }
    for (const speed of SIDE_MOVE) {
      expect(truncateInt8(speed)).toBe(speed);
      expect(truncateInt8(-speed)).toBe(-speed);
    }
  });
});
