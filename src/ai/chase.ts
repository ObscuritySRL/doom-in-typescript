/**
 * Chase state machine (p_enemy.c A_Chase / P_Move / P_TryWalk / P_NewChaseDir).
 *
 * A_Chase is the per-tic thinker for every aware monster.  Each call
 * decrements `reactiontime`, ticks down `threshold`, snaps the actor's
 * angle toward its 8-direction `movedir`, re-acquires a target when the
 * current one is dead or unshootable, decides between melee / missile /
 * walk, and — if no attack fires — steps one cell of `info.speed` along
 * the movedir via P_Move.  P_NewChaseDir picks a new movedir when the
 * actor stalls, preferring the axis of largest delta from the target
 * but reserving a turnaround until all other options fail.
 *
 * Parity-critical details preserved from Chocolate Doom:
 *
 * - Angle turn is 45 degrees per tic (ANG45).  `actor.angle` is masked
 *   to its top three bits (eight-direction snap) BEFORE the signed
 *   subtraction against `movedir << 29`; the sign of the wrapped int32
 *   result picks the short-arc direction.  The adjustment itself does
 *   NOT wrap to the nearest snap point — it always steps ±45 degrees,
 *   so a 180-degree correction takes four tics and always rotates CCW.
 * - `xspeed[1,3,5,7] = ±47000` (not the exact cos(45°)·FRACUNIT = 46340)
 *   so diagonal movement is slightly faster than cardinal.  Vanilla
 *   retains the constant as a load-bearing quirk.
 * - `P_Random() > 200 || |deltay| > |deltax|` swap — when both "try
 *   other directions" fallbacks are considered, the horizontal and
 *   vertical candidates are swapped if the RNG rolls high OR the actor
 *   is further from the target vertically than horizontally.  The RNG
 *   is consumed even if the distance condition already forced the swap.
 * - P_Move consumes NO RNG.  The RNG is consumed by the `P_Random()&15`
 *   inside P_TryWalk when a move succeeds.
 * - Netgame-only re-look: after the attack checks, vanilla re-scans for
 *   players ONLY when `netgame && !threshold && !P_CheckSight`.  For
 *   single-player DOOM1.WAD shareware this branch is never entered.
 * - Active-sound probability: exactly one `P_Random()` call guarded by
 *   `< 3` (3/256).
 *
 * @example
 * ```ts
 * import { chase, DirType } from "../src/ai/chase.ts";
 * actor.movedir = DirType.EAST;
 * chase(actor, chaseContext);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';
import type { Angle } from '../core/angle.ts';
import type { DoomRandom } from '../core/rng.ts';

import type { MapData } from '../map/mapSetup.ts';

import type { Mobj } from '../world/mobj.ts';
import { MF_FLOAT, MF_INFLOAT, MF_JUSTATTACKED, MF_SHOOTABLE, setMobjState } from '../world/mobj.ts';
import type { BlockThingsGrid } from '../world/checkPosition.ts';
import type { TryMoveCallbacks } from '../world/tryMove.ts';
import { tryMove } from '../world/tryMove.ts';
import type { ThinkerList } from '../world/thinkers.ts';

import { checkMeleeRange, checkMissileRange, checkSight, lookForPlayers } from './targeting.ts';
import type { PlayerLike, TargetingContext } from './targeting.ts';

// ── Direction constants ──────────────────────────────────────────────

/**
 * `dirtype_t` from p_enemy.c.  Eight walk directions plus a sentinel.
 * The numeric values are load-bearing: movedir is shifted by 29 to
 * derive a snapped angle (e.g. EAST → 0, NORTH → ANG90).
 */
export const enum DirType {
  EAST = 0,
  NORTHEAST = 1,
  NORTH = 2,
  NORTHWEST = 3,
  WEST = 4,
  SOUTHWEST = 5,
  SOUTH = 6,
  SOUTHEAST = 7,
  NODIR = 8,
}

/** `NUMDIRS` from p_enemy.c (DirType.NODIR + 1). */
export const NUMDIRS = 9;

/** `opposite[]` from p_enemy.c — the 180-degree inverse of each movedir. */
export const OPPOSITE: readonly DirType[] = Object.freeze([DirType.WEST, DirType.SOUTHWEST, DirType.SOUTH, DirType.SOUTHEAST, DirType.EAST, DirType.NORTHEAST, DirType.NORTH, DirType.NORTHWEST, DirType.NODIR]);

/** `diags[]` from p_enemy.c — four diagonal movedirs indexed by (dy<0,dx>0). */
export const DIAGS: readonly DirType[] = Object.freeze([DirType.NORTHWEST, DirType.NORTHEAST, DirType.SOUTHWEST, DirType.SOUTHEAST]);

/**
 * `xspeed[8]` from p_enemy.c.  Index by movedir; the non-cardinal
 * entries are 47000, not the exact cos(45°)·FRACUNIT = 46340, so
 * diagonal moves cover slightly more ground per tic than cardinal.
 */
export const X_SPEED: readonly Fixed[] = Object.freeze([FRACUNIT, 47000, 0, -47000, -FRACUNIT, -47000, 0, 47000]);

/** `yspeed[8]` from p_enemy.c. */
export const Y_SPEED: readonly Fixed[] = Object.freeze([0, 47000, FRACUNIT, 47000, 0, -47000, -FRACUNIT, -47000]);

/** `FLOATSPEED` from p_mobj.h (4 · FRACUNIT). */
export const FLOATSPEED: Fixed = (4 * FRACUNIT) | 0;

/** Skill index for Nightmare, matching `sk_nightmare` in doomdef.h. */
const SK_NIGHTMARE = 4;

/** Angle quantum: ANG45 = ANG90 / 2 = one eight-direction step. */
const ANG45: Angle = 0x2000_0000;

/** Top-three-bit mask — snaps an angle to the nearest 45° multiple. */
const ANG45_MASK = 0xe000_0000 | 0;

/** `10 * FRACUNIT` — the dead-zone on each axis used by P_NewChaseDir. */
const CHASE_DEADZONE: Fixed = (10 * FRACUNIT) | 0;

/** P_NewChaseDir RNG gate for the try-other-directions swap. */
const NEWCHASEDIR_SWAP_THRESHOLD = 200;

/** Probability gate for the per-tic `info.activesound`. */
const ACTIVESOUND_THRESHOLD = 3;

/** `P_Random() & 15` limit for movecount reseed in P_TryWalk. */
const MOVECOUNT_MASK = 15;

// ── Context ──────────────────────────────────────────────────────────

/**
 * Optional hook for P_UseSpecialLine.  Returns true when the linedef
 * was a door that opened for the actor (vanilla: `P_UseSpecialLine(
 * actor, ld, 0)`).  Wired by the specials subsystem in phase 12 and
 * remains null-safe here: when absent, blocked moves that would have
 * tried to open a door simply fail.
 */
export type UseSpecialLineFunction = (actor: Mobj, linedefIndex: number, side: number) => boolean;

/**
 * Sound callback matching `S_StartSound(origin, sfxId)`.  Wired by the
 * audio subsystem in phase 15; chase decisions are parity-stable
 * without it but silent monsters emit no attack/active sounds.
 */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

/**
 * Shared dependencies for chase movement + decision-making.  All
 * fields match the C globals the reference A_Chase / P_Move / etc.
 * read from.
 */
export interface ChaseContext {
  readonly rng: DoomRandom;
  readonly mapData: MapData;
  readonly blocklinks: BlockThingsGrid;
  readonly thinkerList: ThinkerList;
  readonly targetingContext: TargetingContext;
  readonly players: readonly PlayerLike[];
  readonly playeringame: readonly boolean[];
  readonly gameskill: number;
  readonly fastparm: boolean;
  readonly netgame: boolean;
  readonly tryMoveCallbacks?: TryMoveCallbacks;
  readonly useSpecialLine?: UseSpecialLineFunction;
  readonly startSound?: StartSoundFunction;
}

// ── P_Move ───────────────────────────────────────────────────────────

/**
 * P_Move from p_enemy.c.  Attempt one `info.speed`-sized step along
 * `actor.movedir`.  Returns true when the step succeeded or the actor
 * is a floater adjusting height through a too-short opening.
 *
 * When P_TryMove fails:
 * 1. Floaters with a vertically-valid opening rise or fall by
 *    FLOATSPEED toward the adjusted floor, set MF_INFLOAT, and
 *    return true without running the spechit path.
 * 2. Otherwise, if any special linedefs were crossed during the
 *    CheckPosition, movedir is forced to NODIR, spechit is walked
 *    in reverse order calling {@link UseSpecialLineFunction}, and
 *    the return value is whether any line opened.
 *
 * When P_TryMove succeeds, MF_INFLOAT is cleared and a non-floating
 * actor is snapped to `floorz`.
 *
 * @returns `true` if the actor moved (or floated); `false` if blocked.
 */
export function move(actor: Mobj, ctx: ChaseContext): boolean {
  if (actor.movedir === DirType.NODIR) return false;
  if (actor.movedir >>> 0 >= 8) {
    throw new Error('Weird actor->movedir!');
  }
  if (actor.info === null) return false;

  const tryx = (actor.x + Math.imul(actor.info.speed, X_SPEED[actor.movedir]!)) | 0;
  const tryy = (actor.y + Math.imul(actor.info.speed, Y_SPEED[actor.movedir]!)) | 0;

  const result = tryMove(actor, tryx, tryy, ctx.mapData, ctx.blocklinks, ctx.tryMoveCallbacks);

  if (!result.moved) {
    if ((actor.flags & MF_FLOAT) !== 0 && result.floatok) {
      const tmfloorz = result.checkResult!.floorz;
      if (actor.z < tmfloorz) {
        actor.z = (actor.z + FLOATSPEED) | 0;
      } else {
        actor.z = (actor.z - FLOATSPEED) | 0;
      }
      actor.flags = actor.flags | MF_INFLOAT;
      return true;
    }

    const specials = result.checkResult!.specials;
    if (specials.length === 0) return false;

    actor.movedir = DirType.NODIR;
    let good = false;
    for (let i = specials.length - 1; i >= 0; i--) {
      const ld = specials[i]!;
      if (ctx.useSpecialLine?.(actor, ld, 0) === true) {
        good = true;
      }
    }
    return good;
  }

  actor.flags = actor.flags & ~MF_INFLOAT;

  if ((actor.flags & MF_FLOAT) === 0) {
    actor.z = actor.floorz;
  }

  return true;
}

// ── P_TryWalk ────────────────────────────────────────────────────────

/**
 * P_TryWalk from p_enemy.c.  Calls {@link move}; on success, reseeds
 * `movecount` with `P_Random() & 15` and returns true.  The RNG call
 * is the single side effect of a successful walk.
 */
export function tryWalk(actor: Mobj, ctx: ChaseContext): boolean {
  if (!move(actor, ctx)) return false;
  actor.movecount = ctx.rng.pRandom() & MOVECOUNT_MASK;
  return true;
}

// ── P_NewChaseDir ────────────────────────────────────────────────────

/**
 * P_NewChaseDir from p_enemy.c.  Picks a new `movedir` so the actor
 * approaches its current target, falling back through a fixed cascade
 * when the preferred direction is blocked.
 *
 * Order of attempts:
 * 1. Direct diagonal when both axes are outside the ±10-unit dead
 *    zone (skipped if the diagonal is the turnaround).
 * 2. Cardinal candidates from deltax / deltay, optionally swapped
 *    when `P_Random() > 200 || |deltay| > |deltax|`.  Either axis
 *    equal to the turnaround is dropped.
 * 3. Previous movedir, if any.
 * 4. A full 0..7 scan, CCW when `P_Random() & 1` is 1, else CW.
 * 5. Turnaround as last resort.
 * 6. If nothing walked, movedir = DI_NODIR.
 *
 * Throws if `actor.target` is null — vanilla calls I_Error here and
 * the game aborts, so it is a hard invariant violation not a soft
 * failure.
 */
export function newChaseDir(actor: Mobj, ctx: ChaseContext): void {
  if (actor.target === null) {
    throw new Error('P_NewChaseDir: called with no target');
  }

  const olddir: DirType = actor.movedir;
  const turnaround: DirType = OPPOSITE[olddir]!;

  const deltax = (actor.target.x - actor.x) | 0;
  const deltay = (actor.target.y - actor.y) | 0;

  let dx: DirType;
  if (deltax > CHASE_DEADZONE) dx = DirType.EAST;
  else if (deltax < -CHASE_DEADZONE) dx = DirType.WEST;
  else dx = DirType.NODIR;

  let dy: DirType;
  if (deltay < -CHASE_DEADZONE) dy = DirType.SOUTH;
  else if (deltay > CHASE_DEADZONE) dy = DirType.NORTH;
  else dy = DirType.NODIR;

  if (dx !== DirType.NODIR && dy !== DirType.NODIR) {
    const idx = (deltay < 0 ? 2 : 0) + (deltax > 0 ? 1 : 0);
    actor.movedir = DIAGS[idx]!;
    if (actor.movedir !== turnaround && tryWalk(actor, ctx)) return;
  }

  let first: DirType = dx;
  let second: DirType = dy;
  if (ctx.rng.pRandom() > NEWCHASEDIR_SWAP_THRESHOLD || Math.abs(deltay) > Math.abs(deltax)) {
    first = dy;
    second = dx;
  }

  if (first === turnaround) first = DirType.NODIR;
  if (second === turnaround) second = DirType.NODIR;

  if (first !== DirType.NODIR) {
    actor.movedir = first;
    if (tryWalk(actor, ctx)) return;
  }

  if (second !== DirType.NODIR) {
    actor.movedir = second;
    if (tryWalk(actor, ctx)) return;
  }

  if (olddir !== DirType.NODIR) {
    actor.movedir = olddir;
    if (tryWalk(actor, ctx)) return;
  }

  if ((ctx.rng.pRandom() & 1) !== 0) {
    for (let tdir = DirType.EAST; tdir <= DirType.SOUTHEAST; tdir++) {
      if (tdir !== turnaround) {
        actor.movedir = tdir;
        if (tryWalk(actor, ctx)) return;
      }
    }
  } else {
    for (let tdir = DirType.SOUTHEAST; tdir !== DirType.EAST - 1; tdir--) {
      if (tdir !== turnaround) {
        actor.movedir = tdir;
        if (tryWalk(actor, ctx)) return;
      }
    }
  }

  if (turnaround !== DirType.NODIR) {
    actor.movedir = turnaround;
    if (tryWalk(actor, ctx)) return;
  }

  actor.movedir = DirType.NODIR;
}

// ── A_Chase ──────────────────────────────────────────────────────────

/**
 * A_Chase from p_enemy.c.  The per-tic thinker action for an aware
 * monster.  Mutates the actor in place; relies on `ctx` for every
 * global the reference reads from.
 *
 * Behavior in call order:
 * 1. Decrement `reactiontime` toward zero.
 * 2. Decrement `threshold`; clear to 0 if target is dead/null (the
 *    `gameversion > exe_doom_1_2` gate is unconditionally true for the
 *    1.9 emulation target, so no version check is inlined here).
 * 3. Turn angle one 45° step toward `movedir` (top-3-bit mask + signed
 *    int32 delta picks the short-arc direction).
 * 4. If no shootable target, try P_LookForPlayers(allaround=true);
 *    on failure drop back to `spawnstate` and exit.
 * 5. MF_JUSTATTACKED: clear the flag and pick a new chase dir, unless
 *    nightmare/fastparm (which suppress the dir change, so the monster
 *    attacks again next tic without repositioning).
 * 6. Melee path: `meleestate && checkMeleeRange` → attacksound (if
 *    non-zero) → transition to meleestate.
 * 7. Missile path: `missilestate`, skipped when
 *    `gameskill<nightmare && !fastparm && movecount != 0`; otherwise
 *    gated by checkMissileRange.  On fire, set MF_JUSTATTACKED.
 * 8. Netgame re-look: `netgame && !threshold && !checkSight` re-runs
 *    lookForPlayers(allaround=true).  Single-player DOOM1.WAD never
 *    enters this branch.
 * 9. Walk: `--movecount`; if it underflows to <0 OR the move is
 *    blocked, pick a new chase dir.
 * 10. Active sound: `info.activesound && P_Random() < 3`.
 */
export function chase(actor: Mobj, ctx: ChaseContext): void {
  if (actor.info === null) return;

  if (actor.reactiontime !== 0) {
    actor.reactiontime = (actor.reactiontime - 1) | 0;
  }

  if (actor.threshold !== 0) {
    if (actor.target === null || actor.target.health <= 0) {
      actor.threshold = 0;
    } else {
      actor.threshold = (actor.threshold - 1) | 0;
    }
  }

  if (actor.movedir < 8) {
    const snapped = (actor.angle & ANG45_MASK) >>> 0;
    actor.angle = snapped;
    const delta = (snapped - ((actor.movedir << 29) | 0)) | 0;
    if (delta > 0) {
      actor.angle = (actor.angle - ANG45) >>> 0;
    } else if (delta < 0) {
      actor.angle = (actor.angle + ANG45) >>> 0;
    }
  }

  if (actor.target === null || (actor.target.flags & MF_SHOOTABLE) === 0) {
    if (lookForPlayers(actor, true, ctx.players, ctx.playeringame, ctx.targetingContext)) {
      return;
    }
    setMobjState(actor, actor.info.spawnstate, ctx.thinkerList);
    return;
  }

  if ((actor.flags & MF_JUSTATTACKED) !== 0) {
    actor.flags = actor.flags & ~MF_JUSTATTACKED;
    if (ctx.gameskill !== SK_NIGHTMARE && !ctx.fastparm) {
      newChaseDir(actor, ctx);
    }
    return;
  }

  if (actor.info.meleestate !== 0 && checkMeleeRange(actor, ctx.targetingContext)) {
    if (actor.info.attacksound !== 0) {
      ctx.startSound?.(actor, actor.info.attacksound);
    }
    setMobjState(actor, actor.info.meleestate, ctx.thinkerList);
    return;
  }

  let fireMissile = false;
  if (actor.info.missilestate !== 0) {
    const skipByMovecount = ctx.gameskill < SK_NIGHTMARE && !ctx.fastparm && actor.movecount !== 0;
    if (!skipByMovecount && checkMissileRange(actor, ctx.targetingContext, ctx.rng)) {
      fireMissile = true;
    }
  }
  if (fireMissile) {
    setMobjState(actor, actor.info.missilestate, ctx.thinkerList);
    actor.flags = actor.flags | MF_JUSTATTACKED;
    return;
  }

  if (ctx.netgame && actor.threshold === 0 && !checkSight(actor, actor.target, ctx.targetingContext)) {
    if (lookForPlayers(actor, true, ctx.players, ctx.playeringame, ctx.targetingContext)) {
      return;
    }
  }

  actor.movecount = (actor.movecount - 1) | 0;
  if (actor.movecount < 0 || !move(actor, ctx)) {
    newChaseDir(actor, ctx);
  }

  if (actor.info.activesound !== 0 && ctx.rng.pRandom() < ACTIVESOUND_THRESHOLD) {
    ctx.startSound?.(actor, actor.info.activesound);
  }
}
