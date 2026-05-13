/**
 * Scripted pickup oracle for vanilla DOOM 1.9 P_TouchSpecialThing.
 *
 * Each scripted scenario is a synthetic sequence of pickups against a baseline
 * player state, with the expected post-pickup state pinned from Chocolate Doom
 * 2.2.1 p_inter.c contracts (already captured in steps 07-010 .. 07-014).
 *
 * The oracle is used by the focused test to cross-check the per-pickup
 * implementations against each other in concert (give body, give armor, give
 * card, give power, give weapon, give ammo, give backpack).
 */

export interface ScriptedPickupScenario {
  readonly id: string;
  readonly description: string;
  readonly preHealth: number;
  readonly preArmorPoints: number;
  readonly preArmorType: 0 | 1 | 2;
  readonly preBullets: number;
  readonly preShells: number;
  readonly preCells: number;
  readonly preMissiles: number;
  readonly preBackpack: boolean;
  readonly preMaxBullets: number;
  readonly preMaxShells: number;
  readonly pickupKind: 'stimpack' | 'medikit' | 'soulsphere' | 'green-armor' | 'blue-armor' | 'backpack' | 'box-of-bullets';
  readonly expectedHealth: number;
  readonly expectedArmorPoints: number;
  readonly expectedArmorType: 0 | 1 | 2;
  readonly expectedBullets: number;
  readonly expectedMaxBullets: number;
  readonly expectedBackpack: boolean;
}

export const VANILLA_SCRIPTED_PICKUP_ORACLES: readonly ScriptedPickupScenario[] = Object.freeze([
  Object.freeze({
    id: 'stimpack-from-100',
    description: 'stimpack at full health is consumed (vanilla quirk: gives no health, gave=false)',
    preHealth: 100,
    preArmorPoints: 0,
    preArmorType: 0,
    preBullets: 50,
    preShells: 0,
    preCells: 0,
    preMissiles: 0,
    preBackpack: false,
    preMaxBullets: 200,
    preMaxShells: 50,
    pickupKind: 'stimpack',
    expectedHealth: 100,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
    expectedBullets: 50,
    expectedMaxBullets: 200,
    expectedBackpack: false,
  }),
  Object.freeze({
    id: 'stimpack-from-50',
    description: 'stimpack at 50 health bumps to 60 (cap 100)',
    preHealth: 50,
    preArmorPoints: 0,
    preArmorType: 0,
    preBullets: 50,
    preShells: 0,
    preCells: 0,
    preMissiles: 0,
    preBackpack: false,
    preMaxBullets: 200,
    preMaxShells: 50,
    pickupKind: 'stimpack',
    expectedHealth: 60,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
    expectedBullets: 50,
    expectedMaxBullets: 200,
    expectedBackpack: false,
  }),
  Object.freeze({
    id: 'soulsphere-from-100',
    description: 'soulsphere at 100 health bumps to 200 (deh_max_soulsphere=200 cap)',
    preHealth: 100,
    preArmorPoints: 0,
    preArmorType: 0,
    preBullets: 50,
    preShells: 0,
    preCells: 0,
    preMissiles: 0,
    preBackpack: false,
    preMaxBullets: 200,
    preMaxShells: 50,
    pickupKind: 'soulsphere',
    expectedHealth: 200,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
    expectedBullets: 50,
    expectedMaxBullets: 200,
    expectedBackpack: false,
  }),
  Object.freeze({
    id: 'green-armor-from-zero',
    description: 'green armor from 0/none sets points=100 type=1',
    preHealth: 100,
    preArmorPoints: 0,
    preArmorType: 0,
    preBullets: 50,
    preShells: 0,
    preCells: 0,
    preMissiles: 0,
    preBackpack: false,
    preMaxBullets: 200,
    preMaxShells: 50,
    pickupKind: 'green-armor',
    expectedHealth: 100,
    expectedArmorPoints: 100,
    expectedArmorType: 1,
    expectedBullets: 50,
    expectedMaxBullets: 200,
    expectedBackpack: false,
  }),
  Object.freeze({
    id: 'backpack-fresh',
    description: 'first backpack doubles maxammo and gives 10 bullets',
    preHealth: 100,
    preArmorPoints: 0,
    preArmorType: 0,
    preBullets: 50,
    preShells: 0,
    preCells: 0,
    preMissiles: 0,
    preBackpack: false,
    preMaxBullets: 200,
    preMaxShells: 50,
    pickupKind: 'backpack',
    expectedHealth: 100,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
    expectedBullets: 60,
    expectedMaxBullets: 400,
    expectedBackpack: true,
  }),
]);
