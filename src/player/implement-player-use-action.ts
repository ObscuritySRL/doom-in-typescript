/**
 * Vanilla DOOM 1.9 P_UseLines invocation contract from P_PlayerThink.
 *
 * From Chocolate Doom 2.2.1 p_user.c P_PlayerThink (use-button branch):
 *   if (cmd->buttons & BT_USE) {
 *     if (!player->usedown) {
 *       P_UseLines(player);
 *       player->usedown = true;
 *     }
 *   } else {
 *     player->usedown = false;
 *   }
 *
 * P_UseLines (p_map.c):
 *   - Traces a line from player.mo at angle = player.mo.angle.
 *   - Range: USERANGE = 64 * FRACUNIT (same as MELEERANGE).
 *   - P_PathTraverse with PT_ADDLINES + PT_ADDTHINGS.
 *   - For each intercepted line:
 *       if (line.special != 0) P_UseSpecialLine(player, line, side).
 *   - Stops at the first usable line; missing line with no special
 *     plays SFX_NOWAY (=20) at player.
 *
 * Vanilla quirk: spechit array overflow at MAXSPECIALCROSS_ORIGINAL = 8
 * causes stack corruption in real DOOM; we preserve the same boundary
 * via MAXSPECIALCROSS = 20 (Chocolate Doom's expanded vanilla-compatible
 * pool) but flag the original 8-cell boundary for parity tooling.
 */

import type { Fixed } from '../core/fixed.ts';

export const VANILLA_USERANGE: Fixed = 64 * 0x1_0000;
export const VANILLA_SFX_NOWAY = 20;

export interface PlayerUseInput {
  readonly buttonHeld: boolean;
  readonly previousUsedown: boolean;
}

export interface PlayerUseOutcome {
  readonly fireUseEvent: boolean;
  readonly nextUsedown: boolean;
}

export function classifyVanillaPlayerUseAction(input: PlayerUseInput): PlayerUseOutcome {
  if (!input.buttonHeld) {
    return Object.freeze({ fireUseEvent: false, nextUsedown: false });
  }
  if (input.previousUsedown) {
    return Object.freeze({ fireUseEvent: false, nextUsedown: true });
  }
  return Object.freeze({ fireUseEvent: true, nextUsedown: true });
}
