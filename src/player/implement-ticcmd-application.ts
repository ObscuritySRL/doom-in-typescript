/**
 * Vanilla DOOM 1.9 ticcmd button bit contract and usedown/attackdown latch
 * semantics from Chocolate Doom 2.2.1 doomdef.h and p_user.c P_PlayerThink.
 *
 * The four button bits encoded in ticcmd_t::buttons:
 *   BT_ATTACK      = 1
 *   BT_USE         = 2
 *   BT_CHANGE      = 4   (weapon-change request flag)
 *   BT_SPECIAL     = 128 (pause/save/load special)
 * The weapon index when BT_CHANGE is set lives in the BT_WEAPONMASK = 56
 * (bits 3..5) field, retrieved by `(buttons & BT_WEAPONMASK) >> BT_WEAPONSHIFT`.
 *
 * The usedown / attackdown latches gate one-shot edge events: BT_USE fires
 * P_UseLines exactly once until the button is released. P_PlayerThink reads
 * cmd->buttons each tic and updates player->usedown / attackdown accordingly.
 */

export const VANILLA_BT_ATTACK = 1;
export const VANILLA_BT_USE = 2;
export const VANILLA_BT_CHANGE = 4;
export const VANILLA_BT_WEAPONMASK = 8 | 16 | 32;
export const VANILLA_BT_WEAPONSHIFT = 3;
export const VANILLA_BT_SPECIAL = 128;
export const VANILLA_BTS_PAUSE = 1;
export const VANILLA_BTS_SAVEGAME = 2;
export const VANILLA_BTS_SAVESHIFT = 2;

export interface UseLatchInput {
  readonly buttons: number;
  readonly previousUsedown: boolean;
}

export interface UseLatchOutput {
  readonly fireUseEvent: boolean;
  readonly nextUsedown: boolean;
}

export function applyUseButtonLatch(input: UseLatchInput): UseLatchOutput {
  const usePressed = (input.buttons & VANILLA_BT_USE) !== 0;
  if (!usePressed) {
    return { fireUseEvent: false, nextUsedown: false };
  }
  if (input.previousUsedown) {
    return { fireUseEvent: false, nextUsedown: true };
  }
  return { fireUseEvent: true, nextUsedown: true };
}

export function decodeWeaponChangeRequest(buttons: number): number | null {
  if ((buttons & VANILLA_BT_CHANGE) === 0) {
    return null;
  }
  return (buttons & VANILLA_BT_WEAPONMASK) >> VANILLA_BT_WEAPONSHIFT;
}
