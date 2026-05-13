/**
 * Vanilla DOOM 1.9 P_TouchSpecialThing contract.
 *
 * When a player or monster collides with a special thing (powerup, weapon,
 * key, etc.), P_TouchSpecialThing resolves the pickup by mobj type. The
 * decision tree (info.h::mobjtype_t and P_SpecialThing) routes by sprite type:
 * armor, weapon, ammo, health, key, powerup, etc. We pin the canonical
 * resolution categories as data.
 */

export const VANILLA_PICKUP_CATEGORIES = Object.freeze(['ammo', 'armor', 'health', 'key', 'powerup', 'weapon'] as const);

export type PickupCategory = (typeof VANILLA_PICKUP_CATEGORIES)[number];

export const VANILLA_PICKUP_TYPE_TO_CATEGORY: ReadonlyMap<number, PickupCategory> = new Map([
  // ammo
  [2007, 'ammo' as const], // CLIP
  [2048, 'ammo' as const], // BOX of bullets
  [2010, 'ammo' as const], // ROCKET
  [2046, 'ammo' as const], // BOX of rockets
  // armor
  [2018, 'armor' as const], // GREENARMOR
  [2019, 'armor' as const], // BLUEARMOR
  // health
  [2011, 'health' as const], // STIMPACK
  [2012, 'health' as const], // MEDKIT
  [2014, 'health' as const], // HEALTH BONUS
  [2013, 'health' as const], // SOULSPHERE
  // keys
  [5, 'key' as const], // BLUE keycard
  [6, 'key' as const], // YELLOW keycard
  [13, 'key' as const], // RED keycard
  [38, 'key' as const], // RED skull
  [39, 'key' as const], // YELLOW skull
  [40, 'key' as const], // BLUE skull
  // powerups
  [2022, 'powerup' as const], // INVULN sphere
  [2023, 'powerup' as const], // BERSERK
  [2024, 'powerup' as const], // PARTIAL invisibility
  [2025, 'powerup' as const], // RAD suit
  [2026, 'powerup' as const], // COMPUTER MAP
  [2045, 'powerup' as const], // LIGHT goggles
  // weapons
  [2001, 'weapon' as const], // SHOTGUN
  [2002, 'weapon' as const], // CHAINGUN
  [2003, 'weapon' as const], // ROCKET launcher
  [2004, 'weapon' as const], // PLASMA gun
  [2005, 'weapon' as const], // CHAINSAW
  [2006, 'weapon' as const], // BFG
]);

export function resolvePickupCategory(mobjType: number): PickupCategory | null {
  return VANILLA_PICKUP_TYPE_TO_CATEGORY.get(mobjType) ?? null;
}
