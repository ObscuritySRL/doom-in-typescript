/**
 * P_XYMovement and P_ExplodeMissile from p_mobj.c.
 *
 * Handles horizontal momentum-based movement for all mobjs. Moves in
 * sub-steps when momentum exceeds MAXMOVE/2, calls P_TryMove per step,
 * handles blocked-move responses (player slide, missile explode, stop),
 * and applies friction at the end.
 *
 * @example
 * ```ts
 * import { xyMovement } from "../src/world/xyMovement.ts";
 * xyMovement(mobj, mapData, blocklinks, thinkerList, rng, "F_SKY1");
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT, fixedMul } from '../core/fixed.ts';

import type { DoomRandom } from '../core/rng.ts';

import type { MapData } from '../map/mapSetup.ts';

import type { BlockThingsGrid } from './checkPosition.ts';
import type { Mobj } from './mobj.ts';
import { MF_CORPSE, MF_MISSILE, MF_SKULLFLY, MOBJINFO, STATES, StateNum, setMobjState } from './mobj.ts';
import type { ThinkerList } from './thinkers.ts';
import type { TryMoveCallbacks } from './tryMove.ts';
import { tryMove } from './tryMove.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Maximum momentum per axis per tic: 30 map units in fixed-point. */
export const MAXMOVE: Fixed = (30 * FRACUNIT) | 0;

/** Momentum below this threshold stops the mobj (FRACUNIT/16 = 0x1000). */
export const STOPSPEED: Fixed = 0x1000;

/** Ground friction multiplier: 0xE800 in fixed-point (≈ 0.90625). */
export const FRICTION: Fixed = 0xe800;

// ── Callback types ───────────────────────────────────────────────────

/**
 * Callback matching P_SlideMove. Invoked when a player's move is
 * blocked. Implemented in step 09-007; until then, the player simply
 * stops (momx = momy = 0) if no slideMove callback is provided.
 */
export type SlideMoveFunction = (thing: Mobj) => void;

/**
 * Callbacks for P_XYMovement side effects that are wired by later steps.
 *
 * Extends TryMoveCallbacks so the same object flows through to
 * P_TryMove and P_CheckPosition.
 */
export interface XYMovementCallbacks extends TryMoveCallbacks {
  slideMove?: SlideMoveFunction;
}

// ── P_ExplodeMissile ─────────────────────────────────────────────────

/**
 * P_ExplodeMissile from p_mobj.c.
 *
 * Stops the missile, transitions it to its death state, randomizes the
 * tic count, and clears MF_MISSILE so it becomes inert debris.
 *
 * Parity-critical:
 * - tics -= P_Random() & 3: the RNG is consumed even if the result is 0.
 * - tics is clamped to a minimum of 1 after subtraction.
 * - MF_MISSILE is cleared *after* the state transition.
 *
 * @param mobj - The missile to explode.
 * @param rng - The game's RNG instance.
 * @param thinkerList - The active thinker list (for state transitions).
 */
export function explodeMissile(mobj: Mobj, rng: DoomRandom, thinkerList: ThinkerList): void {
  mobj.momx = 0;
  mobj.momy = 0;
  mobj.momz = 0;

  setMobjState(mobj, MOBJINFO[mobj.type]!.deathstate, thinkerList);

  mobj.tics -= rng.pRandom() & 3;
  if (mobj.tics < 1) {
    mobj.tics = 1;
  }

  mobj.flags &= ~MF_MISSILE;
}

// ── P_XYMovement ─────────────────────────────────────────────────────

/**
 * P_XYMovement from p_mobj.c.
 *
 * Moves a mobj horizontally according to its momx/momy, handling
 * sub-stepping for large momentum, blocked-move responses, and
 * ground friction.
 *
 * Parity-critical details:
 * - Early return on zero momentum checks for skull-fly slam.
 * - Momentum is clamped to [-MAXMOVE, MAXMOVE] before the move loop.
 * - Sub-step trigger checks ONLY `xmove > MAXMOVE/2 || ymove > MAXMOVE/2`
 *   (positive overflow). Vanilla does not sub-step negative-dominant
 *   momentum, so heavy-negative-momentum mobjs call P_TryMove once per
 *   tic where heavy-positive ones call it twice. Preserved for demo /
 *   blockmap-iteration parity.
 * - Within the sub-step branch, ptryx uses `xmove/2` (C truncate toward
 *   zero) while xmove is updated via `xmove >>= 1` (arithmetic shift
 *   toward -inf). For the triggering axis the values match (positive);
 *   for the paired axis, which may be negative, the asymmetry preserves
 *   total displacement across the two sub-moves.
 * - Blocked player → P_SlideMove (callback); blocked missile → sky
 *   check then explode; blocked other → stop.
 * - Friction is NOT applied to missiles, skull-fliers, or airborne mobjs.
 * - Corpse sliding exemption: no friction if floorz !== subsector floor
 *   and still has meaningful momentum (> FRACUNIT/4).
 * - STOPSPEED check halts movement and resets player walking frame.
 * - Player stop-check includes forwardmove/sidemove == 0 condition;
 *   since player command integration is deferred, the player field
 *   presence alone triggers the check when no command data exists.
 *
 * @param mobj - The mobj to move.
 * @param mapData - Parsed map data.
 * @param blocklinks - Block things grid.
 * @param thinkerList - Active thinker list (for missile explode / state set).
 * @param rng - The game's RNG (for missile explode tic randomization).
 * @param skyFlatName - Ceiling flat name that represents sky ("F_SKY1"), or
 *   empty string if sky has not been resolved yet. Used for the missile
 *   sky-removal hack in P_XYMovement.
 * @param callbacks - Optional movement/position/special callbacks.
 */
export function xyMovement(mobj: Mobj, mapData: MapData, blocklinks: BlockThingsGrid, thinkerList: ThinkerList, rng: DoomRandom, skyFlatName = '', callbacks: XYMovementCallbacks = {}): void {
  // Early return on zero momentum.
  if (mobj.momx === 0 && mobj.momy === 0) {
    if ((mobj.flags & MF_SKULLFLY) !== 0) {
      // The skull slammed into something.
      mobj.flags &= ~MF_SKULLFLY;
      mobj.momx = 0;
      mobj.momy = 0;
      mobj.momz = 0;
      // Vanilla uses `mo->info->spawnstate` (pointer-follow) rather than
      // a mobjinfo[type] lookup; honour the mobj's own info binding so
      // DEHACKED patches that rebind info can't drift.
      setMobjState(mobj, (mobj.info ?? MOBJINFO[mobj.type]!).spawnstate, thinkerList);
    }
    return;
  }

  // Clamp momentum to MAXMOVE.
  if (mobj.momx > MAXMOVE) {
    mobj.momx = MAXMOVE;
  } else if (mobj.momx < -MAXMOVE) {
    mobj.momx = -MAXMOVE;
  }

  if (mobj.momy > MAXMOVE) {
    mobj.momy = MAXMOVE;
  } else if (mobj.momy < -MAXMOVE) {
    mobj.momy = -MAXMOVE;
  }

  let xmove = mobj.momx;
  let ymove = mobj.momy;

  // Sub-step movement loop.
  do {
    let ptryx: Fixed;
    let ptryy: Fixed;

    if (xmove > MAXMOVE >> 1 || ymove > MAXMOVE >> 1) {
      ptryx = (mobj.x + ((xmove / 2) | 0)) | 0;
      ptryy = (mobj.y + ((ymove / 2) | 0)) | 0;
      xmove >>= 1;
      ymove >>= 1;
    } else {
      ptryx = (mobj.x + xmove) | 0;
      ptryy = (mobj.y + ymove) | 0;
      xmove = 0;
      ymove = 0;
    }

    const moveResult = tryMove(mobj, ptryx, ptryy, mapData, blocklinks, callbacks);

    if (!moveResult.moved) {
      // Blocked move.
      if (mobj.player !== null) {
        // Try to slide along the wall.
        if (callbacks.slideMove !== undefined) {
          callbacks.slideMove(mobj);
        } else {
          mobj.momx = 0;
          mobj.momy = 0;
        }
      } else if ((mobj.flags & MF_MISSILE) !== 0) {
        // Missile hit something — vanilla `ceilingline->backsector->ceilingpic == skyflatnum` hack.
        const checkResult = moveResult.checkResult;
        if (checkResult !== null && checkResult.ceilingline >= 0 && skyFlatName !== '') {
          const backsectorIndex = mapData.lineSectors[checkResult.ceilingline]!.backsector;
          if (backsectorIndex >= 0 && mapData.sectors[backsectorIndex]!.ceilingpic === skyFlatName) {
            thinkerList.remove(mobj);
            return;
          }
        }
        explodeMissile(mobj, rng, thinkerList);
        return;
      } else {
        mobj.momx = 0;
        mobj.momy = 0;
      }
    }
  } while (xmove !== 0 || ymove !== 0);

  // CF_NOMOMENTUM cheat (p_mobj.c): when set, zero momentum AFTER the
  // move completes and skip friction entirely. Vanilla reads
  // `player->cheats & CF_NOMOMENTUM`; we mirror via an optional field so
  // the check is a no-op when the cheat subsystem has not been wired.
  if (mobj.player !== null && hasNoMomentumCheat(mobj)) {
    mobj.momx = 0;
    mobj.momy = 0;
    return;
  }

  // Friction.

  // No friction for missiles or skull-fliers.
  if ((mobj.flags & (MF_MISSILE | MF_SKULLFLY)) !== 0) {
    return;
  }

  // No friction when airborne.
  if (mobj.z > mobj.floorz) {
    return;
  }

  // Corpse sliding exemption: if on a step with meaningful momentum,
  // skip friction so the corpse slides off.
  if ((mobj.flags & MF_CORPSE) !== 0) {
    if (mobj.momx > FRACUNIT >> 2 || mobj.momx < -(FRACUNIT >> 2) || mobj.momy > FRACUNIT >> 2 || mobj.momy < -(FRACUNIT >> 2)) {
      if (mobj.subsector !== null && mobj.floorz !== mobj.subsector.sector.floorheight) {
        return;
      }
    }
  }

  // Stop or apply friction.
  if (mobj.momx > -STOPSPEED && mobj.momx < STOPSPEED && mobj.momy > -STOPSPEED && mobj.momy < STOPSPEED && (mobj.player === null || isPlayerIdle(mobj))) {
    // Stop moving. If a player is in a running frame, go to standing.
    if (mobj.player !== null && isPlayerRunState(mobj.state)) {
      setMobjState(mobj, StateNum.PLAY, thinkerList);
    }
    mobj.momx = 0;
    mobj.momy = 0;
  } else {
    mobj.momx = fixedMul(mobj.momx, FRICTION);
    mobj.momy = fixedMul(mobj.momy, FRICTION);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

const PLAY_RUN_STATES: ReadonlySet<unknown> = new Set([STATES[StateNum.PLAY_RUN1], STATES[StateNum.PLAY_RUN1 + 1], STATES[StateNum.PLAY_RUN1 + 2], STATES[StateNum.PLAY_RUN1 + 3]]);

/**
 * Returns true when the mobj is in one of the four S_PLAY_RUN1..+3 frames.
 * Matches the C idiom `(unsigned)((state - states) - S_PLAY_RUN1) < 4`
 * without the O(numstates) scan.
 */
function isPlayerRunState(state: Mobj['state']): boolean {
  return state !== null && PLAY_RUN_STATES.has(state);
}

/**
 * Check if a player mobj has no movement input.
 *
 * In vanilla Doom this checks player->cmd.forwardmove == 0 &&
 * player->cmd.sidemove == 0. Since player_t integration is deferred,
 * we check if the player object exposes a cmd with those fields.
 * If not available, returns true (no input = should stop).
 */
function isPlayerIdle(mobj: Mobj): boolean {
  const player = mobj.player as {
    cmd?: { forwardmove?: number; sidemove?: number };
  } | null;
  if (player === null) return true;
  if (player.cmd === undefined) return true;
  return (player.cmd.forwardmove ?? 0) === 0 && (player.cmd.sidemove ?? 0) === 0;
}

/** d_player.h `CF_NOMOMENTUM` — debug flag that forces momx/momy to 0 post-move. */
const CF_NOMOMENTUM = 0x4;

/**
 * Detect the `CF_NOMOMENTUM` debug cheat.
 *
 * Vanilla tests `player->cheats & CF_NOMOMENTUM`. Until the cheat
 * subsystem exposes a typed `cheats` field, read it defensively from
 * the opaque player object.
 */
function hasNoMomentumCheat(mobj: Mobj): boolean {
  const player = mobj.player as { cheats?: number } | null;
  if (player === null) return false;
  const cheats = player.cheats;
  if (typeof cheats !== 'number') return false;
  return (cheats & CF_NOMOMENTUM) !== 0;
}
