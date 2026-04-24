/**
 * Powerup timers and palette effects (p_user.c, st_stuff.c).
 *
 * Implements the per-tic counter block from P_PlayerThink — strength
 * counts up, invulnerability/invisibility/infrared/ironfeet count down,
 * damagecount/bonuscount decrement — together with the fixedcolormap
 * handling that blinks invulnerability and infrared in their last 128
 * tics. Exposes ST_doPaletteStuff as a pure function that selects a
 * PLAYPAL palette index from damagecount, berserk fade, bonuscount,
 * and radiation-suit status.
 *
 * All behavior matches Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { tickPowerups, computePalette } from "../src/player/powerups.ts";
 * tickPowerups(player);
 * const palette = computePalette(player);
 * ```
 */

import type { Player } from './playerSpawn.ts';

import { MF_SHADOW } from '../world/mobj.ts';
import { PowerType } from './playerSpawn.ts';

// ── Palette constants (doomdef.h) ────────────────────────────────────

/** STARTREDPALS: first damage/berserk palette index in PLAYPAL. */
export const STARTREDPALS = 1;

/** NUMREDPALS: number of damage/berserk palettes (1..8). */
export const NUMREDPALS = 8;

/** STARTBONUSPALS: first bonus pickup palette index in PLAYPAL. */
export const STARTBONUSPALS = 9;

/** NUMBONUSPALS: number of bonus pickup palettes (9..12). */
export const NUMBONUSPALS = 4;

/** RADIATIONPAL: PLAYPAL index selected while the radiation suit is active. */
export const RADIATIONPAL = 13;

// ── Colormap constants (r_data.c) ────────────────────────────────────

/**
 * INVERSECOLORMAP: COLORMAP index for invulnerability's inverse grayscale.
 *
 * Colormap 32 from a 34-entry COLORMAP lump; see F-053.
 */
export const INVERSECOLORMAP = 32;

/**
 * INFRARED_COLORMAP: fixedcolormap value while the light-amp visor is
 * active and not blinking. "Almost full bright" per the p_user.c comment.
 */
export const INFRARED_COLORMAP = 1;

/**
 * Blink threshold for INVULNERABILITY and INFRARED fixedcolormap handling.
 *
 * When the timer is above this value the effect is solid; below it the
 * effect alternates on every 8-tic boundary via the `timer & 8` check.
 * 4*32 = 128 tics ≈ 3.66 seconds at 35 Hz.
 */
export const COLORMAP_BLINK_THRESHOLD = 4 * 32;

/**
 * Blink mask for INVULNERABILITY and INFRARED fixedcolormap handling.
 *
 * While `timer <= COLORMAP_BLINK_THRESHOLD`, the effect is active only
 * when `timer & 8` is non-zero, producing a flicker as the power expires.
 */
export const COLORMAP_BLINK_MASK = 8;

// ── tickPowerups ─────────────────────────────────────────────────────

/**
 * Per-tic power-up, damage, and bonus counter advance from P_PlayerThink.
 *
 * - STRENGTH counts UP, driving the berserk screen fade in
 *   {@link computePalette}.
 * - INVULNERABILITY, INFRARED, and IRONFEET decrement toward zero.
 * - INVISIBILITY decrements and clears `MF_SHADOW` from the player's
 *   mobj on the tic the timer reaches zero.
 * - damagecount and bonuscount decrement toward zero.
 * - fixedcolormap is reassigned based on INVULNERABILITY or INFRARED,
 *   with the last 128 tics blinking on the 8-tic boundary.
 *
 * @param player - The player whose power counters to advance.
 */
export function tickPowerups(player: Player): void {
  if (player.powers[PowerType.STRENGTH]) {
    player.powers[PowerType.STRENGTH] = (player.powers[PowerType.STRENGTH] + 1) | 0;
  }

  if (player.powers[PowerType.INVULNERABILITY]) {
    player.powers[PowerType.INVULNERABILITY] = (player.powers[PowerType.INVULNERABILITY] - 1) | 0;
  }

  if (player.powers[PowerType.INVISIBILITY]) {
    player.powers[PowerType.INVISIBILITY] = (player.powers[PowerType.INVISIBILITY] - 1) | 0;
    if (!player.powers[PowerType.INVISIBILITY] && player.mo) {
      player.mo.flags = (player.mo.flags & ~MF_SHADOW) | 0;
    }
  }

  if (player.powers[PowerType.INFRARED]) {
    player.powers[PowerType.INFRARED] = (player.powers[PowerType.INFRARED] - 1) | 0;
  }

  if (player.powers[PowerType.IRONFEET]) {
    player.powers[PowerType.IRONFEET] = (player.powers[PowerType.IRONFEET] - 1) | 0;
  }

  if (player.damagecount) {
    player.damagecount = (player.damagecount - 1) | 0;
  }

  if (player.bonuscount) {
    player.bonuscount = (player.bonuscount - 1) | 0;
  }

  player.fixedcolormap = computeFixedColormap(player);
}

// ── computeFixedColormap ─────────────────────────────────────────────

/**
 * Compute the fixedcolormap value selected by active power-ups.
 *
 * Invulnerability wins over infrared; both blink in their final 128 tics.
 *
 * - INVULNERABILITY active: returns INVERSECOLORMAP (32) while solid, else 0.
 * - INFRARED active (and no invulnerability): returns INFRARED_COLORMAP (1)
 *   while solid, else 0.
 * - Otherwise: 0.
 *
 * @param player - The player whose colormap to resolve.
 * @returns The fixedcolormap index (0, 1, or 32).
 */
export function computeFixedColormap(player: Player): number {
  const invulnerability = player.powers[PowerType.INVULNERABILITY];
  if (invulnerability) {
    if (invulnerability > COLORMAP_BLINK_THRESHOLD || invulnerability & COLORMAP_BLINK_MASK) {
      return INVERSECOLORMAP;
    }
    return 0;
  }

  const infrared = player.powers[PowerType.INFRARED];
  if (infrared) {
    if (infrared > COLORMAP_BLINK_THRESHOLD || infrared & COLORMAP_BLINK_MASK) {
      return INFRARED_COLORMAP;
    }
    return 0;
  }

  return 0;
}

// ── computePalette (ST_doPaletteStuff) ───────────────────────────────

/**
 * Compute the PLAYPAL palette index for the current player state.
 *
 * Exact port of st_stuff.c ST_doPaletteStuff with the strict precedence
 * damage/berserk > bonus > radiation > normal:
 *
 * 1. Start with `cnt = damagecount`.
 * 2. While STRENGTH is active, `bzc = 12 - (strength >> 6)`; take the
 *    larger of cnt and bzc so berserk bleeds into the red flash.
 * 3. If cnt > 0, palette = min((cnt+7)>>3, NUMREDPALS-1) + STARTREDPALS
 *    (indices 1..8).
 * 4. Else if bonuscount, palette = min((bonuscount+7)>>3, NUMBONUSPALS-1)
 *    + STARTBONUSPALS (indices 9..12).
 * 5. Else if IRONFEET is solid or in a blink-on tic, return RADIATIONPAL (13).
 * 6. Else return 0.
 *
 * @param player - The player whose palette to resolve.
 * @returns PLAYPAL index (0..13).
 */
export function computePalette(player: Player): number {
  let cnt = player.damagecount;

  const strength = player.powers[PowerType.STRENGTH];
  if (strength) {
    const bzc = 12 - (strength >> 6);
    if (bzc > cnt) cnt = bzc;
  }

  if (cnt > 0) {
    let palette = (cnt + 7) >> 3;
    if (palette >= NUMREDPALS) palette = NUMREDPALS - 1;
    return (palette + STARTREDPALS) | 0;
  }

  if (player.bonuscount) {
    let palette = (player.bonuscount + 7) >> 3;
    if (palette >= NUMBONUSPALS) palette = NUMBONUSPALS - 1;
    return (palette + STARTBONUSPALS) | 0;
  }

  const ironfeet = player.powers[PowerType.IRONFEET];
  if (ironfeet > COLORMAP_BLINK_THRESHOLD || ironfeet & COLORMAP_BLINK_MASK) {
    return RADIATIONPAL;
  }

  return 0;
}
