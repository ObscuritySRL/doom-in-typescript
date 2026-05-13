/**
 * Vanilla DOOM 1.9 weapon psprite state machine pins.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c:
 *   - Two psprites per player (PsprNum): ps_weapon (0) and ps_flash (1),
 *     NUMPSPRITES = 2.
 *   - WEAPONTOP and WEAPONBOTTOM frame the weapon raise/lower travel:
 *       WEAPONTOP    = 32 * FRACUNIT  (rest position)
 *       WEAPONBOTTOM = 128 * FRACUNIT (fully lowered)
 *   - LOWERSPEED = 6 * FRACUNIT/tic (weapon-down animation rate).
 *   - RAISESPEED = 6 * FRACUNIT/tic (weapon-up animation rate).
 *   - P_SetPsprite handles state chain: each state's tics is the on-screen
 *     duration; tics=-1 sticks (used for ready states). Each state advances
 *     to state.nextstate when tics reach 0.
 */

import type { Fixed } from '../core/fixed.ts';

export const VANILLA_NUMPSPRITES = 2;
export const VANILLA_PS_WEAPON = 0;
export const VANILLA_PS_FLASH = 1;

export const VANILLA_WEAPONTOP: Fixed = 32 * 0x1_0000;
export const VANILLA_WEAPONBOTTOM: Fixed = 128 * 0x1_0000;

export const VANILLA_RAISESPEED: Fixed = 6 * 0x1_0000;
export const VANILLA_LOWERSPEED: Fixed = 6 * 0x1_0000;

export interface PspriteState {
  readonly tics: number;
  readonly nextstate: number | null;
}

export interface PspriteAdvanceInput {
  readonly currentTics: number;
  readonly currentState: PspriteState;
}

export interface PspriteAdvanceResult {
  readonly nextStateId: number | null;
  readonly transition: 'no-op' | 'tic-down' | 'advance';
}

export function stepVanillaPsprite(input: PspriteAdvanceInput): PspriteAdvanceResult {
  if (input.currentState.tics === -1) {
    return Object.freeze({ nextStateId: null, transition: 'no-op' });
  }
  if (input.currentTics > 1) {
    return Object.freeze({ nextStateId: null, transition: 'tic-down' });
  }
  return Object.freeze({ nextStateId: input.currentState.nextstate, transition: 'advance' });
}
