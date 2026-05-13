/**
 * Vanilla DOOM 1.9 P_ArchivePlayers contract.
 *
 * From Chocolate Doom 2.2.1 p_saveg.c P_ArchivePlayers / P_UnArchivePlayers:
 *   - 4 fixed player slots (MAXPLAYERS=4 in doomdef.h).
 *   - Each slot is SAVEGAME_PLAYER_SIZE=280 bytes when populated.
 *   - The serialization order matches the canonical player_t struct:
 *     mo pointer, playerstate, cmd (TICCMD_SIZE=8), viewz, viewheight,
 *     deltaviewheight, bob, health, armorpoints, armortype, powers[6],
 *     cards[6], backpack, frags[4], readyweapon, pendingweapon,
 *     weaponowned[9], ammo[4], maxammo[4], attackdown, usedown,
 *     cheats, refire, killcount, itemcount, secretcount, message,
 *     damagecount, bonuscount, attacker pointer, extralight,
 *     fixedcolormap, colormap, psprites[2] (PSPRITE_SIZE=16 each),
 *     didsecret.
 *   - Pointers are converted to indices on archive and back to
 *     pointers on unarchive (P_RestoreTargets).
 */

export const VANILLA_MAXPLAYERS = 4;

export const VANILLA_SAVEGAME_PLAYER_SIZE = 280;

export const VANILLA_SAVEGAME_TICCMD_SIZE = 8;

export const VANILLA_SAVEGAME_PSPRITE_SIZE = 16;

export const VANILLA_SAVEGAME_PSPRITE_COUNT = 2;

export const VANILLA_SAVEGAME_AMMO_COUNT = 4;

export const VANILLA_SAVEGAME_WEAPON_COUNT = 9;

export const VANILLA_SAVEGAME_CARD_COUNT = 6;

export const VANILLA_SAVEGAME_POWER_COUNT = 6;

export const VANILLA_SAVEGAME_FRAG_COUNT = 4;

export interface VanillaSerializedPlayerSlot {
  readonly slotIndex: number;
  readonly presentBytes: 0 | 1;
  readonly bytes: Uint8Array;
}

export function vanillaSerializedPlayerSlotByteLength(slotPresent: boolean): number {
  return slotPresent ? VANILLA_SAVEGAME_PLAYER_SIZE : 0;
}

export function vanillaSerializedPlayersByteLength(presentSlots: readonly boolean[]): number {
  if (presentSlots.length !== VANILLA_MAXPLAYERS) {
    throw new RangeError(`vanilla P_ArchivePlayers requires exactly ${VANILLA_MAXPLAYERS} presence flags (got ${presentSlots.length})`);
  }
  let total = 0;
  for (const present of presentSlots) {
    total += vanillaSerializedPlayerSlotByteLength(present);
  }
  return total;
}
