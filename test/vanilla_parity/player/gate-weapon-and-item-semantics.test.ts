import { describe, expect, test } from 'bun:test';

import { WEAPON_AND_ITEM_GATE } from '../../../src/player/gate-weapon-and-item-semantics.ts';

describe('gate: weapon and item semantics aggregate', () => {
  test('NUMAMMO=4, NUMCARDS=6, NUMPOWERS=6', () => {
    expect(WEAPON_AND_ITEM_GATE.ammoCount).toBe(4);
    expect(WEAPON_AND_ITEM_GATE.cardCount).toBe(6);
    expect(WEAPON_AND_ITEM_GATE.powerCount).toBe(6);
  });

  test('ammo tables: clipammo [10,4,20,1], maxammo [200,50,300,50]', () => {
    expect([...WEAPON_AND_ITEM_GATE.ammoClipTable]).toEqual([10, 4, 20, 1]);
    expect([...WEAPON_AND_ITEM_GATE.ammoMaxTable]).toEqual([200, 50, 300, 50]);
  });

  test('powerup tics: invuln 1050, infra 4200, invis 2100, iron 2100', () => {
    expect(WEAPON_AND_ITEM_GATE.invulnTics).toBe(1050);
    expect(WEAPON_AND_ITEM_GATE.infraredTics).toBe(4200);
    expect(WEAPON_AND_ITEM_GATE.invisibilityTics).toBe(2100);
    expect(WEAPON_AND_ITEM_GATE.ironfeetTics).toBe(2100);
  });

  test('BFG consumes 40 cells per shot', () => {
    expect(WEAPON_AND_ITEM_GATE.bfgCellsPerShot).toBe(40);
  });

  test('weapon ammo table has 9 entries (fist..supershotgun)', () => {
    expect(WEAPON_AND_ITEM_GATE.weaponAmmoTable.length).toBe(9);
  });

  test('gate is frozen', () => {
    expect(Object.isFrozen(WEAPON_AND_ITEM_GATE)).toBe(true);
  });
});
