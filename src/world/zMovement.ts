/**
 * P_ZMovement and P_AproxDistance from p_mobj.c / p_maputl.c.
 *
 * Handles vertical movement for all mobjs: gravity, floor/ceiling
 * clipping, MF_FLOAT chase, lost soul bounce (version-dependent),
 * player landing/step-up callbacks, and missile floor/ceiling explosion.
 *
 * @example
 * ```ts
 * import { zMovement } from "../src/world/zMovement.ts";
 * zMovement(mobj, rng, thinkerList, "exe_doom_1_9");
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';

import type { DoomRandom } from '../core/rng.ts';

import type { GameVersion } from '../bootstrap/gameMode.ts';

import type { Mobj } from './mobj.ts';
import { MF_FLOAT, MF_INFLOAT, MF_MISSILE, MF_NOCLIP, MF_NOGRAVITY, MF_SKULLFLY } from './mobj.ts';
import type { ThinkerList } from './thinkers.ts';
import { explodeMissile } from './xyMovement.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Gravity acceleration per tic: 1.0 in fixed-point (FRACUNIT). */
export const GRAVITY: Fixed = FRACUNIT;

/** Vertical float chase speed: 4 map units per tic in fixed-point. */
export const FLOATSPEED: Fixed = (FRACUNIT * 4) | 0;

/** Player standing eye height: 41 map units in fixed-point. */
export const VIEWHEIGHT: Fixed = (41 * FRACUNIT) | 0;

/**
 * Player landing squat threshold.
 *
 * Hoisted out of the hot loop: vanilla evaluates `-GRAVITY*8` per call
 * but the product is a compile-time constant.
 */
const LANDING_MOMZ_THRESHOLD: Fixed = (-GRAVITY * 8) | 0;

/**
 * Game versions with the corrected lost soul floor bounce.
 *
 * In exe_doom_1_9 and earlier, the skull bounce check was placed
 * AFTER `momz = 0`, making it dead code (bounces momz of 0 to -0).
 * exe_ultimate and later moved the check BEFORE the zero, so lost
 * souls actually bounce off floors. Ceiling bounce is unaffected
 * by this bug (always works in all versions).
 */
const CORRECTED_BOUNCE_VERSIONS: ReadonlySet<string> = new Set(['exe_chex', 'exe_final', 'exe_final2', 'exe_ultimate']);

// ── P_AproxDistance ──────────────────────────────────────────────────

/**
 * P_AproxDistance from p_maputl.c.
 *
 * Fast distance approximation using the octagonal estimate:
 * `max(|dx|,|dy|) + min(|dx|,|dy|)/2`. Overestimates true Euclidean
 * distance by up to ~8%.
 *
 * @example
 * ```ts
 * import { approxDistance } from "../src/world/zMovement.ts";
 * approxDistance(3 * FRACUNIT, 4 * FRACUNIT); // ~5.5 * FRACUNIT
 * ```
 *
 * @param dx - Delta x in fixed-point.
 * @param dy - Delta y in fixed-point.
 * @returns Approximate distance in fixed-point.
 */
export function approxDistance(dx: Fixed, dy: Fixed): Fixed {
  const adx = dx < 0 ? -dx | 0 : dx;
  const ady = dy < 0 ? -dy | 0 : dy;
  if (adx < ady) {
    return (adx + ady - (adx >> 1)) | 0;
  }
  return (adx + ady - (ady >> 1)) | 0;
}

// ── Callback types ───────────────────────────────────────────────────

/**
 * Callback for player smooth step-up viewheight adjustment.
 *
 * In vanilla Doom (when player z < floorz after xy movement):
 * ```c
 * player->viewheight -= floorz - z;
 * player->deltaviewheight = (VIEWHEIGHT - player->viewheight) >> 3;
 * ```
 *
 * @param mobj - The player mobj.
 * @param floorDelta - The distance `(floorz - z)` before z correction.
 */
export type PlayerSmoothStepFunction = (mobj: Mobj, floorDelta: Fixed) => void;

/**
 * Callback for player hard-landing squat and oof sound.
 *
 * In vanilla Doom (when player momz < -GRAVITY * 8):
 * ```c
 * player->deltaviewheight = momz >> 3;
 * S_StartSound(mo, sfx_oof);
 * ```
 *
 * @param mobj - The player mobj.
 * @param momz - The downward momentum at impact (negative value).
 */
export type PlayerLandingFunction = (mobj: Mobj, momz: Fixed) => void;

/** Callbacks for P_ZMovement side effects wired by later steps. */
export interface ZMovementCallbacks {
  playerSmoothStep?: PlayerSmoothStepFunction;
  playerLanding?: PlayerLandingFunction;
}

// ── P_ZMovement ──────────────────────────────────────────────────────

/**
 * P_ZMovement from p_mobj.c.
 *
 * Handles vertical movement, gravity, floor/ceiling clipping,
 * MF_FLOAT target chasing, lost soul bounce (version-dependent),
 * player step-up/landing, and missile floor/ceiling explosion.
 *
 * Parity-critical details:
 * - Lost soul floor bounce: `momz = -momz` BEFORE `momz = 0` in
 *   exe_ultimate+, AFTER in exe_doom_1_9 and earlier (dead code).
 * - Gravity: first airborne tic gets `-GRAVITY * 2`, subsequent `-GRAVITY`.
 * - MF_FLOAT chase: FLOATSPEED toward `target.z + height/2`, skipped
 *   for MF_SKULLFLY and MF_INFLOAT, requires non-null target.
 * - Player smooth step-up: before z is corrected to floorz.
 * - Player landing squat: triggered when `momz < -GRAVITY * 8`.
 * - Missile explosion bypassed by MF_NOCLIP.
 * - Ceiling bounce always works (not version-dependent).
 *
 * @param mobj - The mobj to move vertically.
 * @param rng - The game's RNG (for P_ExplodeMissile tic randomization).
 * @param thinkerList - Active thinker list (for missile state transitions).
 * @param gameVersion - Engine version for lost soul bounce behavior.
 * @param callbacks - Optional player effect callbacks.
 */
export function zMovement(mobj: Mobj, rng: DoomRandom, thinkerList: ThinkerList, gameVersion: GameVersion = 'exe_doom_1_9', callbacks: ZMovementCallbacks = {}): void {
  // Check for smooth step up (player below floor after xy movement).
  if (mobj.player !== null && mobj.z < mobj.floorz) {
    const floorDelta = (mobj.floorz - mobj.z) | 0;
    if (callbacks.playerSmoothStep !== undefined) {
      callbacks.playerSmoothStep(mobj, floorDelta);
    }
  }

  // Adjust height.
  mobj.z = (mobj.z + mobj.momz) | 0;

  // Float toward target if MF_FLOAT and has a target.
  if ((mobj.flags & MF_FLOAT) !== 0 && mobj.target !== null) {
    if ((mobj.flags & MF_SKULLFLY) === 0 && (mobj.flags & MF_INFLOAT) === 0) {
      const dist = approxDistance((mobj.x - mobj.target.x) | 0, (mobj.y - mobj.target.y) | 0);
      const delta = (mobj.target.z + (mobj.height >> 1) - mobj.z) | 0;
      const delta3 = (delta * 3) | 0;

      if (delta < 0 && dist < (-delta3 | 0)) {
        mobj.z = (mobj.z - FLOATSPEED) | 0;
      } else if (delta > 0 && dist < delta3) {
        mobj.z = (mobj.z + FLOATSPEED) | 0;
      }
    }
  }

  // Clip movement — floor.
  if (mobj.z <= mobj.floorz) {
    const correctBounce = CORRECTED_BOUNCE_VERSIONS.has(gameVersion);

    // Corrected version: bounce BEFORE zeroing momz.
    if (correctBounce && (mobj.flags & MF_SKULLFLY) !== 0) {
      mobj.momz = -mobj.momz | 0;
    }

    if (mobj.momz < 0) {
      if (mobj.player !== null && mobj.momz < LANDING_MOMZ_THRESHOLD) {
        // Player landing squat and oof sound.
        if (callbacks.playerLanding !== undefined) {
          callbacks.playerLanding(mobj, mobj.momz);
        }
      }
      mobj.momz = 0;
    }

    mobj.z = mobj.floorz;

    // Buggy version: bounce AFTER zeroing momz (dead code in practice).
    if (!correctBounce && (mobj.flags & MF_SKULLFLY) !== 0) {
      mobj.momz = -mobj.momz | 0;
    }

    // Missile hit floor → explode (unless noclip).
    if ((mobj.flags & MF_MISSILE) !== 0 && (mobj.flags & MF_NOCLIP) === 0) {
      explodeMissile(mobj, rng, thinkerList);
      return;
    }
  } else if ((mobj.flags & MF_NOGRAVITY) === 0) {
    // Apply gravity when not on floor.
    if (mobj.momz === 0) {
      mobj.momz = (-GRAVITY * 2) | 0;
    } else {
      mobj.momz = (mobj.momz - GRAVITY) | 0;
    }
  }

  // Clip movement — ceiling.
  if (((mobj.z + mobj.height) | 0) > mobj.ceilingz) {
    // Hit the ceiling.
    if (mobj.momz > 0) {
      mobj.momz = 0;
    }

    mobj.z = (mobj.ceilingz - mobj.height) | 0;

    // Lost soul ceiling bounce (not version-dependent).
    if ((mobj.flags & MF_SKULLFLY) !== 0) {
      mobj.momz = -mobj.momz | 0;
    }

    // Missile hit ceiling → explode (unless noclip).
    if ((mobj.flags & MF_MISSILE) !== 0 && (mobj.flags & MF_NOCLIP) === 0) {
      explodeMissile(mobj, rng, thinkerList);
      return;
    }
  }
}
