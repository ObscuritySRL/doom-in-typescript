/**
 * Vanilla DOOM 1.9 status bar key and small-ammo widgets.
 *
 * From Chocolate Doom 2.2.1 st_stuff.c:
 *   Three key slots stacked vertically at x=239:
 *     ST_KEY0X = 239, ST_KEY0Y = 171 (blue)
 *     ST_KEY1X = 239, ST_KEY1Y = 181 (yellow)
 *     ST_KEY2X = 239, ST_KEY2Y = 191 (red)
 *   Each slot draws either the card or skull variant; STKEYS<n> patches
 *   index 0..5 are: blue card, yellow card, red card, blue skull,
 *   yellow skull, red skull.
 *
 *   Small-ammo column (current ammo per type, 4 rows):
 *     ST_AMMO0X = 288, ST_AMMO0Y = 173 (bullets)
 *     ST_AMMO1X = 288, ST_AMMO1Y = 179 (shells)
 *     ST_AMMO2X = 288, ST_AMMO2Y = 185 (rockets)
 *     ST_AMMO3X = 288, ST_AMMO3Y = 191 (cells)
 *
 *   Max-ammo column (max ammo per type, 4 rows, x=314):
 *     ST_MAXAMMO0Y = 173, ST_MAXAMMO1Y = 179,
 *     ST_MAXAMMO2Y = 185, ST_MAXAMMO3Y = 191
 */

export const VANILLA_ST_KEY_X = 239;
export const VANILLA_ST_KEY_Y_OFFSETS = Object.freeze([171, 181, 191] as const);

export const VANILLA_ST_AMMO_X = 288;
export const VANILLA_ST_MAXAMMO_X = 314;
export const VANILLA_ST_AMMO_Y_OFFSETS = Object.freeze([173, 179, 185, 191] as const);

export const VANILLA_ST_KEY_PATCH_PREFIX = 'STKEYS';

/** Patch index 0..5 in STKEYS<n>: 0,1,2 = blue/yellow/red card; 3,4,5 = blue/yellow/red skull. */
export type VanillaKeyPatchIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type VanillaKeySlotColor = 'blue' | 'yellow' | 'red';
export type VanillaKeySlotKind = 'card' | 'skull' | 'none';

/** Return STKEYS patch index for a (color, kind) pair, or null when the slot is empty. */
export function keyPatchIndex(color: VanillaKeySlotColor, kind: VanillaKeySlotKind): VanillaKeyPatchIndex | null {
  if (kind === 'none') {
    return null;
  }
  const colorOffset = color === 'blue' ? 0 : color === 'yellow' ? 1 : 2;
  const kindOffset = kind === 'card' ? 0 : 3;
  const result = (colorOffset + kindOffset) as VanillaKeyPatchIndex;
  return result;
}

/** Return ('STKEYS' + n) or null when the slot is empty. */
export function keyPatchName(color: VanillaKeySlotColor, kind: VanillaKeySlotKind): string | null {
  const index = keyPatchIndex(color, kind);
  if (index === null) {
    return null;
  }
  return `${VANILLA_ST_KEY_PATCH_PREFIX}${index}`;
}
