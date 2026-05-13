/**
 * Vanilla DOOM 1.9 health and armor pickup contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_GiveBody / P_GiveArmor / P_TouchSpecialThing:
 *   health bonus  (SPR_BON1): +1, cap at deh_max_health (200)
 *   stimpack      (SPR_STIM): +10, cap at MAXHEALTH=100
 *   medikit       (SPR_MEDI): +25, cap at MAXHEALTH=100
 *   soulsphere    (SPR_SOUL): +100, cap at deh_max_health (200)
 *   megasphere    (DOOM 2 only): +200 health, +200 blue armor
 *
 *   armor bonus   (SPR_BON2): +1, cap at deh_max_armor (200), greenarmor type if none
 *   greenarmor    (SPR_ARM1): set to 100 if armorpoints < 100; armortype = 1
 *   bluearmor     (SPR_ARM2): set to 200 if armorpoints < 200; armortype = 2
 *
 * MAXHEALTH = 100, deh_max_health = 200 in vanilla.
 */

export const VANILLA_MAXHEALTH = 100;
export const VANILLA_MAXARMOR = 200;
export const VANILLA_DEH_MAX_HEALTH = 200;

export const VANILLA_GREEN_ARMOR_POINTS = 100;
export const VANILLA_BLUE_ARMOR_POINTS = 200;

export interface HealthPickupInput {
  readonly currentHealth: number;
  readonly amount: number;
  readonly cap: number;
}

export interface ArmorPickupInput {
  readonly currentArmorPoints: number;
  readonly currentArmorType: number;
  readonly newArmorType: 1 | 2;
}

/** P_GiveBody: returns (newHealth, gave). gave=false if already at cap. */
export function applyHealthPickup(input: HealthPickupInput): { readonly newHealth: number; readonly gave: boolean } {
  if (input.currentHealth >= input.cap) {
    return { newHealth: input.currentHealth, gave: false };
  }
  let newHealth = input.currentHealth + input.amount;
  if (newHealth > input.cap) {
    newHealth = input.cap;
  }
  return { newHealth, gave: true };
}

/** P_GiveArmor: returns (newArmorPoints, newArmorType, gave). Vanilla skips if new armor would be worse. */
export function applyArmorPickup(input: ArmorPickupInput): { readonly newArmorPoints: number; readonly newArmorType: number; readonly gave: boolean } {
  const targetPoints = input.newArmorType === 1 ? VANILLA_GREEN_ARMOR_POINTS : VANILLA_BLUE_ARMOR_POINTS;
  if (input.currentArmorPoints >= targetPoints) {
    return { newArmorPoints: input.currentArmorPoints, newArmorType: input.currentArmorType, gave: false };
  }
  return { newArmorPoints: targetPoints, newArmorType: input.newArmorType, gave: true };
}

/** Health bonus and armor bonus: +1 with deh_max cap of 200. */
export function applyBonusPickup(currentValue: number): { readonly newValue: number; readonly gave: boolean } {
  if (currentValue >= VANILLA_DEH_MAX_HEALTH) {
    return { newValue: currentValue, gave: false };
  }
  return { newValue: currentValue + 1, gave: true };
}
