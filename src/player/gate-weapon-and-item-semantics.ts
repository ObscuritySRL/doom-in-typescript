/**
 * Gate step 07-033: aggregate vanilla DOOM 1.9 weapon and item contracts.
 *
 * Re-exports the pinned constants from 07-011..07-016 (ammo/weapons/keys/powerups)
 * + 07-018..07-027 (psprite actions / autoaim) so a single import in the gate
 * test can verify the weapon/item surface is wired and consistent.
 */

import { VANILLA_CLIP_AMMO, VANILLA_MAX_AMMO, NUMAMMO } from './implement-ammo-pickups.ts';
import { VANILLA_BFG_CELLS_PER_SHOT } from './implement-bfg-actions.ts';
import { VANILLA_NUMCARDS } from './implement-keycard-and-skull-key-pickups.ts';
import { VANILLA_INVULN_TICS, VANILLA_INFRARED_TICS } from './implement-invulnerability-and-infrared.ts';
import { VANILLA_INVISTICS, VANILLA_IRONTICS } from './implement-berserk-partial-invisibility-radiation-suit.ts';
import { VANILLA_NUMPOWERS } from './implement-god-mode-and-powerup-flags.ts';
import { VANILLA_WEAPON_AMMO_TABLE } from './implement-weapon-pickups.ts';

export const WEAPON_AND_ITEM_GATE = Object.freeze({
  ammoCount: NUMAMMO,
  ammoClipTable: VANILLA_CLIP_AMMO,
  ammoMaxTable: VANILLA_MAX_AMMO,
  cardCount: VANILLA_NUMCARDS,
  powerCount: VANILLA_NUMPOWERS,
  invulnTics: VANILLA_INVULN_TICS,
  infraredTics: VANILLA_INFRARED_TICS,
  invisibilityTics: VANILLA_INVISTICS,
  ironfeetTics: VANILLA_IRONTICS,
  weaponAmmoTable: VANILLA_WEAPON_AMMO_TABLE,
  bfgCellsPerShot: VANILLA_BFG_CELLS_PER_SHOT,
} as const);
