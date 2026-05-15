/**
 * Vanilla DOOM 1.9 pickup + powerup runtime facade.
 *
 * Plan_final step `09-007` (lane: player-weapons-items) aggregates
 * the pickup side-effect functions and the per-tic powerup
 * functions `P_TouchSpecialThing` and the powerup ticker call into
 * one cohesive re-export barrel.  The read-only
 * `src/player/pickups.ts` and `src/player/powerups.ts` modules
 * already implement vanilla `p_inter.c` `P_TouchSpecialThing` /
 * `P_GiveBody` / `P_GiveArmor` / `P_GiveCard` / `P_GivePower` and
 * the `p_user.c` powerup countdown + palette/colormap selection,
 * and are SHA-pinned by the `plan_vanilla_parity` player inventory;
 * this module does NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `giveBody` / `giveArmor` / `giveCard` / `givePower` —
 *     `p_inter.c` P_GiveBody / P_GiveArmor / P_GiveCard /
 *     P_GivePower pickup side effects.
 *   - `touchSpecialThing`   — `p_inter.c` `P_TouchSpecialThing`
 *     (the big sprite-pickup dispatch switch).
 *   - `set/get/clearPickupContext` — the per-frame pickup context
 *     the dispatch reads (gameskill, sound callbacks, etc.).
 *   - `tickPowerups`        — the per-tic powerup countdown.
 *   - `computeFixedColormap`/`computePalette` — the INVUL/IR/RAD
 *     and damage/bonus palette + colormap selection driven by the
 *     active powerups.
 *
 * @example
 * ```ts
 * import { touchSpecialThing, VANILLA_PICKUP_ENTRY_POINTS } from './wirePickups.ts';
 * VANILLA_PICKUP_ENTRY_POINTS.length; // 8
 * ```
 */

export { clearPickupContext, getPickupContext, giveArmor, giveBody, giveCard, givePower, setPickupContext, touchSpecialThing } from '../player/pickups.ts';
export { computeFixedColormap, computePalette, tickPowerups } from '../player/powerups.ts';

/**
 * Frozen manifest of the eight canonical pickup + powerup
 * entry-point names this facade wires, in the order the runtime
 * invokes them (the touch dispatch gives body/armor/card/power,
 * then the per-tic powerup countdown recomputes the active
 * colormap + palette).
 */
export const VANILLA_PICKUP_ENTRY_POINTS: readonly string[] = Object.freeze(['computeFixedColormap', 'computePalette', 'giveArmor', 'giveBody', 'giveCard', 'givePower', 'tickPowerups', 'touchSpecialThing']);
