import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { SECTOR_LINE_SPECIALS_GATE } from '../../../src/ai/gate-sector-and-line-specials.ts';

describe('gate: sector and line specials', () => {
  test('door: speed 2 fixed, wait 150 tics, raise-in-5min 10500 tics, vld_open=3', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.doorSpeed).toBe(2 << FRACBITS);
    expect(SECTOR_LINE_SPECIALS_GATE.doorWait).toBe(150);
    expect(SECTOR_LINE_SPECIALS_GATE.doorRaiseIn5MinsTics).toBe(10500);
    expect(SECTOR_LINE_SPECIALS_GATE.vldOpen).toBe(3);
  });

  test('floor: speed 1 fixed, turbo 4 fixed, lowerToLowest=1', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.floorSpeed).toBe(1 << FRACBITS);
    expect(SECTOR_LINE_SPECIALS_GATE.floorSpeedTurbo).toBe(4 << FRACBITS);
    expect(SECTOR_LINE_SPECIALS_GATE.floorLowerToLowest).toBe(1);
  });

  test('ceiling: 1 / 2 fixed speed, crush damage 10, crushAndRaise=3', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.ceilSpeed).toBe(1 << FRACBITS);
    expect(SECTOR_LINE_SPECIALS_GATE.ceilSpeedFast).toBe(2 << FRACBITS);
    expect(SECTOR_LINE_SPECIALS_GATE.ceilingCrushDamage).toBe(10);
    expect(SECTOR_LINE_SPECIALS_GATE.ceilingCrushAndRaise).toBe(3);
  });

  test('platform: wait 105 tics, max 30, downWaitUpStay=1', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.platWait).toBe(105);
    expect(SECTOR_LINE_SPECIALS_GATE.maxPlats).toBe(30);
    expect(SECTOR_LINE_SPECIALS_GATE.platDownWaitUpStay).toBe(1);
  });

  test('switch: BUTTONTIME 35 tics, sfx_swtchn=60', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.buttonTime).toBe(35);
    expect(SECTOR_LINE_SPECIALS_GATE.sfxSwitchOn).toBe(60);
  });

  test('sector: damage interval 32 tics, nukage=5, secret=9', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.sectorDamageInterval).toBe(32);
    expect(SECTOR_LINE_SPECIALS_GATE.sectorSpecialNukage).toBe(5);
    expect(SECTOR_LINE_SPECIALS_GATE.sectorSpecialSecret).toBe(9);
  });

  test('keys: blue card=26, red skull=33', () => {
    expect(SECTOR_LINE_SPECIALS_GATE.lineKeyBlueCard).toBe(26);
    expect(SECTOR_LINE_SPECIALS_GATE.lineKeyRedSkull).toBe(33);
  });
});
