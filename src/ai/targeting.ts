/**
 * Target acquisition and sight (p_enemy.c P_LookForPlayers,
 * P_CheckMeleeRange, P_CheckMissileRange; p_sight.c P_CheckSight,
 * P_CrossBSPNode, P_CrossSubsector, P_DivlineSide, P_InterceptVector2).
 *
 * All four entry points share a {@link TargetingContext} that resolves
 * a mobj's current sector index (the analog of `mobj->subsector->sector - sectors`
 * pointer arithmetic in the reference) and carries the active `MapData`.
 *
 * Sight stamping reuses the shared linedef validcount tracker on
 * `MapData.validCount`.  Vanilla uses a single global `validcount`
 * for both blockmap iteration and sight traversal — our generation
 * counter is the same object, preserving that load-bearing sharing.
 *
 * @example
 * ```ts
 * import { checkSight, lookForPlayers } from "../src/ai/targeting.ts";
 * const ctx: TargetingContext = { mapData, getSectorIndex };
 * if (lookForPlayers(actor, false, players, playeringame, ctx)) {
 *   // actor.target was set; chase state machine can start
 * }
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedDiv, fixedMul } from '../core/fixed.ts';
import type { Angle } from '../core/angle.ts';
import { ANG90, ANG180, ANG270, angleWrap } from '../core/angle.ts';
import { slopeDiv, tantoangle } from '../core/trig.ts';
import type { DoomRandom } from '../core/rng.ts';

import type { MapData } from '../map/mapSetup.ts';
import { NF_SUBSECTOR } from '../map/bspStructs.ts';
import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';
import { isRejected } from '../map/reject.ts';

import type { Mobj } from '../world/mobj.ts';
import { MF_JUSTHIT, MobjType } from '../world/mobj.ts';
import { approxDistance } from '../world/zMovement.ts';

// ── Constants ─────────────────────────────────────────────────────────

/** MELEERANGE from p_local.h: `64 * FRACUNIT`. */
const MELEERANGE: Fixed = (64 * FRACUNIT) | 0;

/** `20 * FRACUNIT` — the melee-range radius adjustment added in 1.5+. */
const MELEE_RADIUS_ADJUST: Fixed = (20 * FRACUNIT) | 0;

/** `64 * FRACUNIT` — base cutoff subtracted in P_CheckMissileRange. */
export const MISSILE_BASE_CUTOFF: Fixed = (64 * FRACUNIT) | 0;

/** `128 * FRACUNIT` — extra cutoff for monsters with no melee attack. */
export const MISSILE_NO_MELEE_CUTOFF: Fixed = (128 * FRACUNIT) | 0;

/** `200` — universal ceiling applied to `dist` after per-type halving. */
export const MISSILE_DIST_CLAMP = 200;

/** `160` — CYBORG-specific ceiling applied AFTER the 200 clamp. */
export const MISSILE_CYBORG_DIST_CLAMP = 160;

/** `14 * 64 = 896` — VILE hard maximum; rejects without rolling RNG. */
export const MISSILE_VILE_DIST_MAX = 14 * 64;

/** `196` — UNDEAD (revenant) minimum; rejects without rolling RNG. */
export const MISSILE_UNDEAD_DIST_MIN = 196;

// ── Divline ───────────────────────────────────────────────────────────

/**
 * Read-only directed line segment — the native `divline_t` from
 * p_maputl.h / p_sight.c.  Compatible by shape with {@link MapNode},
 * so BSP partition planes can be passed directly without allocating
 * a wrapper per recursion.
 */
interface Divline {
  readonly x: Fixed;
  readonly y: Fixed;
  readonly dx: Fixed;
  readonly dy: Fixed;
}

// ── Context ───────────────────────────────────────────────────────────

/**
 * Shared dependencies for targeting and sight.
 *
 * `getSectorIndex` is the analog of the pointer subtraction
 * `(mobj->subsector->sector - sectors)` the reference uses to derive
 * a sector index for the REJECT lookup.
 */
export interface TargetingContext {
  readonly mapData: MapData;
  readonly getSectorIndex: (mobj: Mobj) => number;
}

/**
 * Minimal shape of a player entry consumed by {@link lookForPlayers}.
 * Matches the `mo` / `health` fields on `player_t` used by
 * P_LookForPlayers.
 */
export interface PlayerLike {
  readonly mo: Mobj | null;
  readonly health: number;
}

// ── Sight traversal state (p_sight.c globals) ────────────────────────

interface SightState {
  sightzstart: Fixed;
  topslope: Fixed;
  bottomslope: Fixed;
  readonly strace: Divline;
  t2x: Fixed;
  t2y: Fixed;
  validcount: number;
}

// ── R_PointToAngle2 (local) ──────────────────────────────────────────

/**
 * R_PointToAngle2 from r_main.c.  Reproduces the octant-based
 * tangent-LUT path.  Identical structure to the local helper in
 * slideMove.ts; duplicated here to keep this module self-contained.
 */
function pointToAngle2(x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed): Angle {
  let x = (x2 - x1) | 0;
  let y = (y2 - y1) | 0;

  if (x === 0 && y === 0) return 0;

  if (x >= 0) {
    if (y >= 0) {
      if (x > y) return tantoangle[slopeDiv(y, x)]!;
      return angleWrap(ANG90 - 1 - tantoangle[slopeDiv(x, y)]!);
    }
    y = -y;
    if (x > y) return angleWrap(-tantoangle[slopeDiv(y, x)]!);
    return angleWrap(ANG270 + tantoangle[slopeDiv(x, y)]!);
  }

  x = -x;
  if (y >= 0) {
    if (x > y) return angleWrap(ANG180 - 1 - tantoangle[slopeDiv(y, x)]!);
    return angleWrap(ANG90 + tantoangle[slopeDiv(x, y)]!);
  }
  y = -y;
  if (x > y) return angleWrap(ANG180 + tantoangle[slopeDiv(y, x)]!);
  return angleWrap(ANG270 - 1 - tantoangle[slopeDiv(x, y)]!);
}

// ── P_DivlineSide ────────────────────────────────────────────────────

/**
 * P_DivlineSide from p_sight.c.  Returns 0 (front), 1 (back), or 2 (on).
 *
 * Vanilla quirk: the horizontal-partition branch (`!node.dy`) compares
 * `x == node.y` — not `y == node.y` — matching the reference source
 * byte-for-byte.  Only exercised when the partition is exactly
 * horizontal; harmless in practice because both x and y would need to
 * equal node.y for the "on" return to differ, but the comparison is
 * preserved for strict parity.
 */
function divlineSide(x: Fixed, y: Fixed, node: Divline): 0 | 1 | 2 {
  if (node.dx === 0) {
    if (x === node.x) return 2;
    if (x <= node.x) return node.dy > 0 ? 1 : 0;
    return node.dy < 0 ? 1 : 0;
  }

  if (node.dy === 0) {
    if (x === node.y) return 2;
    if (y <= node.y) return node.dx < 0 ? 1 : 0;
    return node.dx > 0 ? 1 : 0;
  }

  const dx = (x - node.x) | 0;
  const dy = (y - node.y) | 0;

  const left = (((node.dy >> FRACBITS) | 0) * ((dx >> FRACBITS) | 0)) | 0;
  const right = (((dy >> FRACBITS) | 0) * ((node.dx >> FRACBITS) | 0)) | 0;

  if (right < left) return 0;
  if (left === right) return 2;
  return 1;
}

// ── P_InterceptVector2 ───────────────────────────────────────────────

/**
 * P_InterceptVector2 from p_sight.c.
 *
 * Computes the fractional intercept of `v1` against the first divline
 * using >> 8 shifts (coarser than P_InterceptVector's >> FRACBITS but
 * overflow-safer for sight traversal).  Returns 0 on parallel lines —
 * the reference `I_Error` is commented out and never fires in vanilla.
 */
function interceptVector2(v2: Divline, v1: Divline): Fixed {
  const den = (fixedMul((v1.dy >> 8) | 0, v2.dx) - fixedMul((v1.dx >> 8) | 0, v2.dy)) | 0;
  if (den === 0) return 0;

  const num = (fixedMul(((v1.x - v2.x) >> 8) | 0, v1.dy) + fixedMul(((v2.y - v1.y) >> 8) | 0, v1.dx)) | 0;
  return fixedDiv(num, den);
}

// ── P_CrossSubsector ─────────────────────────────────────────────────

/**
 * Reusable seg-divline scratch for {@link crossSubsector}.  Sight checks
 * are single-threaded and never re-entrant, so a single module-scope
 * mutable buffer avoids allocating one `Divline` per seg per call —
 * checkSight runs hundreds of times per tic in busy maps.
 */
const segDivlineScratch = { x: 0, y: 0, dx: 0, dy: 0 };

/** P_CrossSubsector from p_sight.c. */
function crossSubsector(num: number, state: SightState, mapData: MapData): boolean {
  const sub = mapData.subsectors[num]!;
  const stamps = mapData.validCount.stamps;
  const segs = mapData.segs;
  const lines = mapData.linedefs;
  const vertexes = mapData.vertexes;
  const sectors = mapData.sectors;
  const lineSectors = mapData.lineSectors;
  const validcount = state.validcount;
  const strace = state.strace;
  const straceX = strace.x;
  const straceY = strace.y;
  const t2x = state.t2x;
  const t2y = state.t2y;
  const sightzstart = state.sightzstart;
  const firstseg = sub.firstseg;
  const numsegs = sub.numsegs;

  for (let i = 0; i < numsegs; i++) {
    const seg = segs[firstseg + i]!;
    const linedefIdx = seg.linedef;

    if (stamps[linedefIdx] === validcount) continue;
    stamps[linedefIdx] = validcount;

    const line = lines[linedefIdx]!;
    const v1 = vertexes[line.v1]!;
    const v2 = vertexes[line.v2]!;

    let s1 = divlineSide(v1.x, v1.y, strace);
    let s2 = divlineSide(v2.x, v2.y, strace);
    if (s1 === s2) continue;

    segDivlineScratch.x = v1.x;
    segDivlineScratch.y = v1.y;
    segDivlineScratch.dx = (v2.x - v1.x) | 0;
    segDivlineScratch.dy = (v2.y - v1.y) | 0;
    s1 = divlineSide(straceX, straceY, segDivlineScratch);
    s2 = divlineSide(t2x, t2y, segDivlineScratch);
    if (s1 === s2) continue;

    const ls = lineSectors[linedefIdx]!;
    const frontsectorIdx = seg.side === 0 ? ls.frontsector : ls.backsector;
    const backsectorIdx = seg.side === 0 ? ls.backsector : ls.frontsector;

    if (backsectorIdx === -1) return false;
    if ((line.flags & ML_TWOSIDED) === 0) return false;

    const front = sectors[frontsectorIdx]!;
    const back = sectors[backsectorIdx]!;

    const frontFloor = front.floorheight;
    const backFloor = back.floorheight;
    const frontCeil = front.ceilingheight;
    const backCeil = back.ceilingheight;

    if (frontFloor === backFloor && frontCeil === backCeil) continue;

    const opentop = frontCeil < backCeil ? frontCeil : backCeil;
    const openbottom = frontFloor > backFloor ? frontFloor : backFloor;

    if (openbottom >= opentop) return false;

    const frac = interceptVector2(strace, segDivlineScratch);

    if (frontFloor !== backFloor) {
      const slope = fixedDiv((openbottom - sightzstart) | 0, frac);
      if (slope > state.bottomslope) state.bottomslope = slope;
    }

    if (frontCeil !== backCeil) {
      const slope = fixedDiv((opentop - sightzstart) | 0, frac);
      if (slope < state.topslope) state.topslope = slope;
    }

    if (state.topslope <= state.bottomslope) return false;
  }

  return true;
}

// ── P_CrossBSPNode ───────────────────────────────────────────────────

/** P_CrossBSPNode from p_sight.c. */
function crossBSPNode(bspnum: number, state: SightState, mapData: MapData): boolean {
  if ((bspnum & NF_SUBSECTOR) !== 0) {
    if (bspnum === -1) return crossSubsector(0, state, mapData);
    return crossSubsector(bspnum & ~NF_SUBSECTOR, state, mapData);
  }

  const bsp = mapData.nodes[bspnum]!;

  // "an 'on' should cross both sides" — fold 2 to 0 for the descent
  // decision, but compare raw against the end-point side so an exact
  // on-partition target correctly falls through to the other subtree.
  const startSide = divlineSide(state.strace.x, state.strace.y, bsp);
  const side: 0 | 1 = startSide === 1 ? 1 : 0;

  if (!crossBSPNode(bsp.children[side]!, state, mapData)) return false;

  const endSide = divlineSide(state.t2x, state.t2y, bsp);
  if (side === endSide) return true;

  return crossBSPNode(bsp.children[side ^ 1]!, state, mapData);
}

// ── P_CheckSight ─────────────────────────────────────────────────────

/**
 * P_CheckSight from p_sight.c.
 *
 * Returns true if the straight line from `t1` to `t2` is unobstructed
 * by map geometry at the "three-quarters eye" z-slice of `t1`.
 *
 * Steps exactly mirror the reference:
 * 1. REJECT trivial rejection via `s1 * numsectors + s2` bit lookup.
 * 2. Advance the shared `validcount` generation.
 * 3. `sightzstart = t1.z + t1.height - t1.height/4`
 *    (arithmetic right shift — preserved for negative heights).
 * 4. `topslope`/`bottomslope` bracket `t2` above/below `sightzstart`.
 * 5. Cache `strace` (t1→t2 divline) and `t2x/t2y` for the traversal.
 * 6. Descend from `nodes[numnodes-1]` with `P_CrossBSPNode`.
 *
 * @param t1 - Looker (typically the actor whose perspective is tested).
 * @param t2 - Target mobj being checked.
 * @param ctx - Shared targeting context (map + sector-index resolver).
 * @returns `true` if a clear line of sight exists; `false` otherwise.
 */
export function checkSight(t1: Mobj, t2: Mobj, ctx: TargetingContext): boolean {
  const { mapData, getSectorIndex } = ctx;

  const s1 = getSectorIndex(t1);
  const s2 = getSectorIndex(t2);
  if (isRejected(mapData.reject, s1, s2)) return false;

  mapData.validCount.current = (mapData.validCount.current + 1) | 0;

  const sightzstart = (t1.z + t1.height - (t1.height >> 2)) | 0;
  const state: SightState = {
    sightzstart,
    topslope: (t2.z + t2.height - sightzstart) | 0,
    bottomslope: (t2.z - sightzstart) | 0,
    strace: {
      x: t1.x,
      y: t1.y,
      dx: (t2.x - t1.x) | 0,
      dy: (t2.y - t1.y) | 0,
    },
    t2x: t2.x,
    t2y: t2.y,
    validcount: mapData.validCount.current,
  };

  if (mapData.nodes.length === 0) {
    return crossSubsector(0, state, mapData);
  }

  return crossBSPNode(mapData.nodes.length - 1, state, mapData);
}

// ── P_LookForPlayers ─────────────────────────────────────────────────

/**
 * P_LookForPlayers from p_enemy.c.
 *
 * Scans the 4-slot player table starting from `actor.lastlook`,
 * advancing one slot per iteration with wrap-around `(lastlook+1)&3`.
 * Returns `true` and sets `actor.target` on the first live, visible
 * player; returns `false` after either two successful sight tests
 * that rejected all candidates (c >= 2) or when `lastlook` wraps back
 * to `(origLastlook-1)&3`.
 *
 * Parity-critical details:
 * - `lastlook` advances on every loop iteration, including the first,
 *   via the `for` statement's post-expression — so the stop check
 *   compares against `(origLastlook-1)&3`, not `origLastlook`.
 * - `c++ == 2` is a post-increment: we succeed when c reaches 2
 *   (two usable players checked), returning false on the third.
 * - The `allaround` gate rejects targets behind the actor
 *   (`an > ANG90 && an < ANG270` in unsigned arithmetic) when their
 *   planar distance is greater than `MELEERANGE`.  Melee-range targets
 *   behind the actor are still acquired — the "ambush from behind"
 *   wake-up quirk.
 *
 * @param actor - Monster performing the scan; `actor.target` is set
 *   on success, `actor.lastlook` is advanced regardless.
 * @param allaround - `true` skips the angle/distance gate.  Used by
 *   monsters in their Chase state (their already-acquired target can
 *   circle around them) and nightmare-skill resurrections.
 * @param players - 4-slot player table; `players[i].mo` and
 *   `players[i].health` match `players[i]` in the reference.
 * @param playeringame - 4-slot membership flags (`playeringame[i]`).
 * @param ctx - Shared targeting context.
 * @returns `true` when a visible, live player was accepted.
 */
export function lookForPlayers(actor: Mobj, allaround: boolean, players: readonly PlayerLike[], playeringame: readonly boolean[], ctx: TargetingContext): boolean {
  let c = 0;
  const stop = (actor.lastlook - 1) & 3;

  for (;;) {
    if (!playeringame[actor.lastlook]) {
      actor.lastlook = (actor.lastlook + 1) & 3;
      continue;
    }

    if (c++ === 2 || actor.lastlook === stop) {
      return false;
    }

    const player = players[actor.lastlook]!;
    if (player.health <= 0 || player.mo === null) {
      actor.lastlook = (actor.lastlook + 1) & 3;
      continue;
    }

    if (!checkSight(actor, player.mo, ctx)) {
      actor.lastlook = (actor.lastlook + 1) & 3;
      continue;
    }

    if (!allaround) {
      const an = angleWrap(pointToAngle2(actor.x, actor.y, player.mo.x, player.mo.y) - actor.angle);
      if (an > ANG90 && an < ANG270) {
        const dist = approxDistance((player.mo.x - actor.x) | 0, (player.mo.y - actor.y) | 0);
        if (dist > MELEERANGE) {
          actor.lastlook = (actor.lastlook + 1) & 3;
          continue;
        }
      }
    }

    actor.target = player.mo;
    return true;
  }
}

// ── P_CheckMeleeRange ────────────────────────────────────────────────

/**
 * P_CheckMeleeRange from p_enemy.c (exe_doom_1_5+ formula).
 *
 * Returns `true` iff the actor has a current target, the target's
 * centre is closer than `MELEERANGE - 20*FRACUNIT + target.info.radius`
 * (for gameversion >= 1.5; all C1 targets emulate 1.9, so this is the
 * only path), and sight is clear.  Returns `false` if `actor.target`
 * is null.
 *
 * The radius adjustment lets wider monsters punch from slightly
 * further away (their bounding cylinder already closes most of the
 * gap), matching the vanilla formula exactly.
 */
export function checkMeleeRange(actor: Mobj, ctx: TargetingContext): boolean {
  const pl = actor.target;
  if (pl === null) return false;

  const dist = approxDistance((pl.x - actor.x) | 0, (pl.y - actor.y) | 0);

  const targetRadius = pl.info !== null ? pl.info.radius : 0;
  const range = (MELEERANGE - MELEE_RADIUS_ADJUST + targetRadius) | 0;

  if (dist >= range) return false;
  if (!checkSight(actor, pl, ctx)) return false;

  return true;
}

// ── P_CheckMissileRange ──────────────────────────────────────────────

/**
 * P_CheckMissileRange from p_enemy.c.
 *
 * Gates monster ranged attacks by sight, MF_JUSTHIT retaliation,
 * `reactiontime`, distance rolled against `P_Random()`, and per-type
 * distance overrides.  Returns true if the actor should swing/fire
 * this tic.
 *
 * Parity-sensitive:
 * - MF_JUSTHIT always triggers an immediate attack AND clears the flag
 *   — the retaliation path consumes no RNG.
 * - `reactiontime` blocks all ranged decisions until it ticks to 0.
 * - `dist` starts as the octagonal distance minus `64*FRACUNIT`.
 *   Monsters with no melee state subtract another `128*FRACUNIT` so
 *   they fire from further away (mancubus, arachnotron would trigger;
 *   only exercised by cyberdemon / spider in the base roster because
 *   every other missile-capable monster also has a melee state).
 * - Per-type overrides: VILE caps dist at 14*64 (hard fail above),
 *   UNDEAD (revenant) requires dist >= 196 and halves the distance
 *   roll, CYBORG / SPIDER / SKULL halve the distance roll, CYBORG
 *   additionally caps the roll at 160.
 * - The final RNG consumption is exactly one `P_Random()` call.
 */
export function checkMissileRange(actor: Mobj, ctx: TargetingContext, rng: DoomRandom): boolean {
  if (actor.target === null) return false;
  if (!checkSight(actor, actor.target, ctx)) return false;

  if ((actor.flags & MF_JUSTHIT) !== 0) {
    actor.flags = (actor.flags & ~MF_JUSTHIT) | 0;
    return true;
  }

  if (actor.reactiontime !== 0) return false;

  let dist = (approxDistance((actor.x - actor.target.x) | 0, (actor.y - actor.target.y) | 0) - MISSILE_BASE_CUTOFF) | 0;

  if (actor.info !== null && actor.info.meleestate === 0) {
    dist = (dist - MISSILE_NO_MELEE_CUTOFF) | 0;
  }

  dist = dist >> FRACBITS;

  if (actor.type === MobjType.VILE) {
    if (dist > MISSILE_VILE_DIST_MAX) return false;
  }

  if (actor.type === MobjType.UNDEAD) {
    if (dist < MISSILE_UNDEAD_DIST_MIN) return false;
    dist = dist >> 1;
  }

  if (actor.type === MobjType.CYBORG || actor.type === MobjType.SPIDER || actor.type === MobjType.SKULL) {
    dist = dist >> 1;
  }

  if (dist > MISSILE_DIST_CLAMP) dist = MISSILE_DIST_CLAMP;
  if (actor.type === MobjType.CYBORG && dist > MISSILE_CYBORG_DIST_CLAMP) {
    dist = MISSILE_CYBORG_DIST_CLAMP;
  }

  if (rng.pRandom() < dist) return false;

  return true;
}
