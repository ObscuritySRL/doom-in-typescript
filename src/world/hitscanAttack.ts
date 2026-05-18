/**
 * P_AimLineAttack, P_LineAttack, P_SpawnPuff, P_SpawnBlood (p_map.c / p_mobj.c).
 *
 * The hitscan core: autoaim slope search and the actual bullet trace
 * that spawns puffs / blood and deals damage. Faithful port of
 * Chocolate Doom 2.2.1 p_map.c PTR_AimTraverse / PTR_ShootTraverse /
 * P_AimLineAttack / P_LineAttack and p_mobj.c P_SpawnPuff / P_SpawnBlood.
 *
 * P_PathTraverse with `PT_ADDLINES|PT_ADDTHINGS` is reproduced inline
 * here: the project's shared `intercepts.ts` collects line intercepts
 * only (PT_ADDTHINGS is a documented no-op there), but a bullet trace
 * must interleave line *and* thing intercepts by ascending `frac` for
 * vanilla parity. This module rebuilds the p_maputl.c DDA walk —
 * reusing the parity-critical `interceptVector` / `pointOnDivlineSide`
 * primitives and the audited blockmap iterators — and adds the
 * PIT_AddThingIntercepts pass that `intercepts.ts` omits.
 *
 * Damage numbers come from the caller (the SHA-pinned hitscan.ts /
 * attacks.ts compute their own `damage` and pass it through the
 * injected `lineAttack`); this module never invents a damage formula.
 *
 * Parity-critical details preserved byte-for-byte:
 *
 * - `shootz = t1.z + (t1.height>>1) + 8*FRACUNIT`; the trace endpoint
 *   is `t1.(x|y) + (distance>>FRACBITS) * finecosine|finesine[angle]`.
 * - Aim slope clamp is `±(SCREENHEIGHT/2)*FRACUNIT/(SCREENWIDTH/2)`
 *   (= ±100*FRACUNIT/160).
 * - PTR_AimTraverse narrows topslope/bottomslope through two-sided
 *   openings, picks `(thingtop+thingbottom)/2` as the locked aimslope,
 *   and stops on the first hittable thing.
 * - PTR_ShootTraverse positions the puff `4*FRACUNIT/attackrange`
 *   before a wall and `10*FRACUNIT/attackrange` before a thing, refuses
 *   to mark the sky, spawns blood vs. puff on MF_NOBLOOD, and only then
 *   calls P_DamageMobj(th, shootthing, shootthing, la_damage).
 * - P_SpawnPuff: MT_PUFF, `z += (P_SubRandom()) << 10`, advance to
 *   `S_PUFF1 + (P_Random()&3)`... actually `state += P_Random()&3` from
 *   S_PUFF1, and `tics -= P_Random()&3` clamp; first-blood puffs at
 *   attackrange == MELEERANGE step to S_PUFF3.
 * - P_SpawnBlood: MT_BLOOD, `z += (P_SubRandom()) << 10`,
 *   `tics -= P_Random()&3` clamp, then damage-banded state pick
 *   (9..12 → BLOOD2, 1..8 → BLOOD3).
 *
 * @example
 * ```ts
 * import { makeHitscanPrimitives } from "../src/world/hitscanAttack.ts";
 * const { aimLineAttack, lineAttack } = makeHitscanPrimitives({
 *   mapData, blocklinks, rng, thinkerList, spawnMobj, damageMobj });
 * const aim = aimLineAttack(playerMobj, playerMobj.angle, 16*64*FRACUNIT);
 * lineAttack(playerMobj, playerMobj.angle, 32*64*FRACUNIT, aim.slope, 10);
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, FIXED_MAX, fixedDiv, fixedMul } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';
import { ANGLETOFINESHIFT, FINEMASK, finecosine, finesine } from '../core/trig.ts';

import { MAPBLOCKSHIFT, MAPBTOFRAC } from '../map/blockmap.ts';
import { blockLinesIterator, incrementValidCount } from '../map/blockmapIter.ts';
import type { Divline } from '../map/intercepts.ts';
import { interceptVector, pointOnDivlineSide } from '../map/intercepts.ts';
import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';
import type { MapData } from '../map/mapSetup.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';

import type { BlockThingsGrid } from './checkPosition.ts';
import { blockThingsIterator } from './checkPosition.ts';
import { MF_NOBLOOD, MF_SHOOTABLE, Mobj, MobjType, StateNum, setMobjState } from './mobj.ts';
import type { ThinkerList } from './thinkers.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Sky flat name (r_data.c SKYFLATNAME) — used to refuse "shoot the sky". */
const SKY_FLAT_NAME = 'F_SKY1';

/** MELEERANGE from p_local.h: `64 * FRACUNIT`. First-blood puffs key off it. */
export const MELEERANGE: Fixed = (64 * FRACUNIT) | 0;

/** Aim slope clamp numerator/denominator: ±(SCREENHEIGHT/2)*FRACUNIT/(SCREENWIDTH/2). */
const AIM_SLOPE_LIMIT: Fixed = (((((SCREENHEIGHT / 2) | 0) * FRACUNIT) | 0) / ((SCREENWIDTH / 2) | 0)) | 0;

/** Block-boundary mask in 16.16 fixed-point (one blockmap cell span). */
const BLOCK_BOUNDARY_MASK = (1 << MAPBLOCKSHIFT) - 1;

/** Maximum blockmap cells walked per path traversal (vanilla safety limit). */
const MAX_TRAVERSE_CELLS = 64;

// ── Types ────────────────────────────────────────────────────────────

/** Result of P_AimLineAttack — slope toward the locked target (or 0). */
export interface AimLineAttackResult {
  slope: Fixed;
  target: Mobj | null;
}

/** Callback matching P_DamageMobj(target, inflictor, source, damage). */
export type DamageMobjFunction = (target: Mobj, inflictor: Mobj | null, source: Mobj | null, damage: number) => void;

/** Callback matching P_SpawnMobj(x, y, z, type). */
export type SpawnMobjFunction = (x: Fixed, y: Fixed, z: Fixed, type: MobjType) => Mobj;

/** Dependencies the hitscan primitives bind to for one level. */
export interface HitscanPrimitivesDeps {
  mapData: MapData;
  blocklinks: BlockThingsGrid;
  rng: DoomRandom;
  thinkerList: ThinkerList;
  spawnMobj: SpawnMobjFunction;
  damageMobj: DamageMobjFunction;
}

/** The two primitives the injected combat contexts consume. */
export interface HitscanPrimitives {
  aimLineAttack: (shooter: Mobj, angle: Angle, distance: Fixed) => AimLineAttackResult;
  lineAttack: (shooter: Mobj, angle: Angle, distance: Fixed, slope: Fixed, damage: number) => void;
}

/** A line or thing intercept, mirroring intercept_t from p_local.h. */
interface ShootIntercept {
  frac: Fixed;
  isLine: boolean;
  lineIndex: number;
  thing: Mobj | null;
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Build P_AimLineAttack / P_LineAttack bound to one level's map data,
 * blockmap thing links, RNG, thinker list, and P_SpawnMobj /
 * P_DamageMobj primitives. The C reference communicates through file
 * static globals (`shootthing`, `shootz`, `aimslope`, `linetarget`,
 * `topslope`, `bottomslope`, `attackrange`, `la_damage`, `trace`);
 * those are closure locals here, reset per call exactly as p_map.c
 * resets them at the top of P_AimLineAttack / P_LineAttack.
 *
 * @param deps - Per-level dependencies.
 * @returns The aim/shoot primitive pair.
 */
export function makeHitscanPrimitives(deps: HitscanPrimitivesDeps): HitscanPrimitives {
  const { mapData, blocklinks, rng, thinkerList, spawnMobj, damageMobj } = deps;
  const { blockmap, linedefs, vertexes, lineSectors, sectors, validCount } = mapData;

  // p_map.c file statics (per-trace; reset before each P_PathTraverse).
  let shootthing: Mobj;
  let shootz: Fixed = 0;
  let attackrange: Fixed = 0;
  let aimslope: Fixed = 0;
  let topslope: Fixed = 0;
  let bottomslope: Fixed = 0;
  let laDamage = 0;
  let linetarget: Mobj | null = null;
  let trace: Divline = { x: 0, y: 0, dx: 0, dy: 0 };

  // ── P_LineOpening (p_maputl.c) ─────────────────────────────────────
  // Local copy of the opening globals; the project's checkPosition.ts
  // lineOpening returns a struct, but PTR_*Traverse also needs the raw
  // back-sector-null distinction (front/back floor & ceiling equality),
  // so resolve sectors directly here.
  let openTop: Fixed = 0;
  let openBottom: Fixed = 0;
  let frontFloor: Fixed = 0;
  let backFloor: Fixed = 0;
  let frontCeiling: Fixed = 0;
  let backCeiling: Fixed = 0;
  let hasBackSector = false;
  let frontCeilingIsSky = false;
  let backCeilingIsSky = false;
  let frontCeilingHeight: Fixed = 0;

  function lineOpening(linedefIndex: number): void {
    const ls = lineSectors[linedefIndex]!;
    const front = sectors[ls.frontsector]!;
    frontFloor = front.floorheight;
    frontCeiling = front.ceilingheight;
    frontCeilingHeight = front.ceilingheight;
    frontCeilingIsSky = front.ceilingpic === SKY_FLAT_NAME;

    if (ls.backsector === -1) {
      hasBackSector = false;
      backFloor = 0;
      backCeiling = 0;
      backCeilingIsSky = false;
      openTop = 0;
      openBottom = 0;
      return;
    }

    hasBackSector = true;
    const back = sectors[ls.backsector]!;
    backFloor = back.floorheight;
    backCeiling = back.ceilingheight;
    backCeilingIsSky = back.ceilingpic === SKY_FLAT_NAME;

    openTop = frontCeiling < backCeiling ? frontCeiling : backCeiling;
    openBottom = frontFloor > backFloor ? frontFloor : backFloor;
  }

  // ── PTR_AimTraverse (p_map.c) ──────────────────────────────────────
  function aimTraverse(intercept: ShootIntercept): boolean {
    if (intercept.isLine) {
      const linedefIndex = intercept.lineIndex;
      const linedef = linedefs[linedefIndex]!;

      if ((linedef.flags & ML_TWOSIDED) === 0) {
        return false; // stop
      }

      lineOpening(linedefIndex);

      if (openBottom >= openTop) {
        return false; // stop
      }

      const dist: Fixed = fixedMul(attackrange, intercept.frac);

      if (!hasBackSector || frontFloor !== backFloor) {
        const slope: Fixed = fixedDiv((openBottom - shootz) | 0, dist);
        if (slope > bottomslope) bottomslope = slope;
      }

      if (!hasBackSector || frontCeiling !== backCeiling) {
        const slope: Fixed = fixedDiv((openTop - shootz) | 0, dist);
        if (slope < topslope) topslope = slope;
      }

      if (topslope <= bottomslope) {
        return false; // stop
      }

      return true; // shot continues
    }

    // shoot a thing
    const th = intercept.thing!;
    if (th === shootthing) return true; // can't shoot self
    if ((th.flags & MF_SHOOTABLE) === 0) return true; // corpse or something

    const dist: Fixed = fixedMul(attackrange, intercept.frac);
    let thingtopslope: Fixed = fixedDiv((th.z + th.height - shootz) | 0, dist);
    if (thingtopslope < bottomslope) return true; // shot over the thing

    let thingbottomslope: Fixed = fixedDiv((th.z - shootz) | 0, dist);
    if (thingbottomslope > topslope) return true; // shot under the thing

    if (thingtopslope > topslope) thingtopslope = topslope;
    if (thingbottomslope < bottomslope) thingbottomslope = bottomslope;

    aimslope = ((thingtopslope + thingbottomslope) / 2) | 0;
    linetarget = th;

    return false; // don't go any farther
  }

  // ── PTR_ShootTraverse (p_map.c) ────────────────────────────────────
  function shootTraverse(intercept: ShootIntercept): boolean {
    if (intercept.isLine) {
      const linedefIndex = intercept.lineIndex;
      const linedef = linedefs[linedefIndex]!;

      // P_ShootSpecialLine for `linedef.special` is wired by the
      // line-special milestone; not invoked here.

      let hitLine = false;
      if ((linedef.flags & ML_TWOSIDED) === 0) {
        hitLine = true;
      } else {
        lineOpening(linedefIndex);
        const dist: Fixed = fixedMul(attackrange, intercept.frac);

        if (!hasBackSector) {
          let slope: Fixed = fixedDiv((openBottom - shootz) | 0, dist);
          if (slope > aimslope) hitLine = true;
          if (!hitLine) {
            slope = fixedDiv((openTop - shootz) | 0, dist);
            if (slope < aimslope) hitLine = true;
          }
        } else {
          if (frontFloor !== backFloor) {
            const slope: Fixed = fixedDiv((openBottom - shootz) | 0, dist);
            if (slope > aimslope) hitLine = true;
          }
          if (!hitLine && frontCeiling !== backCeiling) {
            const slope: Fixed = fixedDiv((openTop - shootz) | 0, dist);
            if (slope < aimslope) hitLine = true;
          }
        }
      }

      if (!hitLine) {
        return true; // shot continues
      }

      // hit line — position a bit closer.
      const frac: Fixed = (intercept.frac - fixedDiv((4 * FRACUNIT) | 0, attackrange)) | 0;
      const x: Fixed = (trace.x + fixedMul(trace.dx, frac)) | 0;
      const y: Fixed = (trace.y + fixedMul(trace.dy, frac)) | 0;
      const z: Fixed = (shootz + fixedMul(aimslope, fixedMul(frac, attackrange))) | 0;

      if (frontCeilingIsSky) {
        // don't shoot the sky!
        if (z > frontCeilingHeight) return false;
        // it's a sky hack wall
        if (hasBackSector && backCeilingIsSky) return false;
      }

      spawnPuff(x, y, z);
      return false; // don't go any farther
    }

    // shoot a thing
    const th = intercept.thing!;
    if (th === shootthing) return true; // can't shoot self
    if ((th.flags & MF_SHOOTABLE) === 0) return true; // corpse or something

    const dist: Fixed = fixedMul(attackrange, intercept.frac);
    const thingtopslope: Fixed = fixedDiv((th.z + th.height - shootz) | 0, dist);
    if (thingtopslope < aimslope) return true; // shot over the thing

    const thingbottomslope: Fixed = fixedDiv((th.z - shootz) | 0, dist);
    if (thingbottomslope > aimslope) return true; // shot under the thing

    // hit thing — position a bit closer.
    const frac: Fixed = (intercept.frac - fixedDiv((10 * FRACUNIT) | 0, attackrange)) | 0;
    const x: Fixed = (trace.x + fixedMul(trace.dx, frac)) | 0;
    const y: Fixed = (trace.y + fixedMul(trace.dy, frac)) | 0;
    const z: Fixed = (shootz + fixedMul(aimslope, fixedMul(frac, attackrange))) | 0;

    if ((th.flags & MF_NOBLOOD) !== 0) {
      spawnPuff(x, y, z);
    } else {
      spawnBlood(x, y, z, laDamage);
    }

    if (laDamage) {
      damageMobj(th, shootthing, shootthing, laDamage);
    }

    return false; // don't go any farther
  }

  // ── P_SpawnPuff (p_mobj.c) ─────────────────────────────────────────
  function spawnPuff(x: Fixed, y: Fixed, z: Fixed): void {
    z = (z + (rng.pSubRandom() << 10)) | 0;

    const puff = spawnMobj(x, y, z, MobjType.PUFF);
    puff.momz = FRACUNIT;
    puff.tics = (puff.tics - (rng.pRandom() & 3)) | 0;
    if (puff.tics < 1) puff.tics = 1;

    // Don't make punches spark on the wall.
    if (attackrange === MELEERANGE) {
      setMobjState(puff, StateNum.PUFF3, thinkerList);
    }
  }

  // ── P_SpawnBlood (p_mobj.c) ────────────────────────────────────────
  function spawnBlood(x: Fixed, y: Fixed, z: Fixed, damage: number): void {
    z = (z + (rng.pSubRandom() << 10)) | 0;

    const blood = spawnMobj(x, y, z, MobjType.BLOOD);
    blood.momz = (FRACUNIT * 2) | 0;
    blood.tics = (blood.tics - (rng.pRandom() & 3)) | 0;
    if (blood.tics < 1) blood.tics = 1;

    if (damage <= 12 && damage >= 9) {
      setMobjState(blood, StateNum.BLOOD2, thinkerList);
    } else if (damage < 9) {
      setMobjState(blood, StateNum.BLOOD3, thinkerList);
    }
  }

  // ── P_PathTraverse with PT_ADDLINES|PT_ADDTHINGS (p_maputl.c) ───────
  function pathTraverse(x1In: Fixed, y1In: Fixed, x2: Fixed, y2: Fixed, visit: (intercept: ShootIntercept) => boolean): void {
    incrementValidCount(validCount);
    const intercepts: ShootIntercept[] = [];

    let x1 = x1In;
    let y1 = y1In;

    if (((x1 - blockmap.originX) & BLOCK_BOUNDARY_MASK) === 0) {
      x1 = (x1 + FRACUNIT) | 0;
    }
    if (((y1 - blockmap.originY) & BLOCK_BOUNDARY_MASK) === 0) {
      y1 = (y1 + FRACUNIT) | 0;
    }

    trace = { x: x1, y: y1, dx: (x2 - x1) | 0, dy: (y2 - y1) | 0 };

    const relX1 = (x1 - blockmap.originX) | 0;
    const relY1 = (y1 - blockmap.originY) | 0;
    const relX2 = (x2 - blockmap.originX) | 0;
    const relY2 = (y2 - blockmap.originY) | 0;

    const xt1 = relX1 >> MAPBLOCKSHIFT;
    const yt1 = relY1 >> MAPBLOCKSHIFT;
    const xt2 = relX2 >> MAPBLOCKSHIFT;
    const yt2 = relY2 >> MAPBLOCKSHIFT;

    const relDeltaX = (relX2 - relX1) | 0;
    const relDeltaY = (relY2 - relY1) | 0;
    const absDeltaX = (relDeltaX < 0 ? -relDeltaX : relDeltaX) | 0;
    const absDeltaY = (relDeltaY < 0 ? -relDeltaY : relDeltaY) | 0;

    let mapxstep: number;
    let ystep: Fixed;
    let partial: Fixed;

    if (xt2 > xt1) {
      mapxstep = 1;
      partial = (FRACUNIT - ((relX1 >> MAPBTOFRAC) & (FRACUNIT - 1))) | 0;
      ystep = fixedDiv(relDeltaY, absDeltaX);
    } else if (xt2 < xt1) {
      mapxstep = -1;
      partial = (relX1 >> MAPBTOFRAC) & (FRACUNIT - 1);
      ystep = fixedDiv(relDeltaY, absDeltaX);
    } else {
      mapxstep = 0;
      partial = FRACUNIT;
      ystep = (256 * FRACUNIT) | 0;
    }

    let yintercept: Fixed = ((relY1 >> MAPBTOFRAC) + fixedMul(partial, ystep)) | 0;

    let mapystep: number;
    let xstep: Fixed;

    if (yt2 > yt1) {
      mapystep = 1;
      partial = (FRACUNIT - ((relY1 >> MAPBTOFRAC) & (FRACUNIT - 1))) | 0;
      xstep = fixedDiv(relDeltaX, absDeltaY);
    } else if (yt2 < yt1) {
      mapystep = -1;
      partial = (relY1 >> MAPBTOFRAC) & (FRACUNIT - 1);
      xstep = fixedDiv(relDeltaX, absDeltaY);
    } else {
      mapystep = 0;
      partial = FRACUNIT;
      xstep = (256 * FRACUNIT) | 0;
    }

    let xintercept: Fixed = ((relX1 >> MAPBTOFRAC) + fixedMul(partial, xstep)) | 0;

    let mapx = xt1;
    let mapy = yt1;

    const addLine = (linedefIndex: number): boolean => {
      const linedef = linedefs[linedefIndex]!;
      const v1 = vertexes[linedef.v1]!;
      const v2 = vertexes[linedef.v2]!;

      // P_PathTraverse always uses the long-trace divline test for
      // PTR_AimTraverse / PTR_ShootTraverse callers (the dual-precision
      // P_PointOnLineSide path is only taken by the slide-move trace,
      // whose dx/dy stay below 16 units; aim/shoot traces are 2048+
      // units). pointOnDivlineSide matches p_maputl.c PIT_AddLineIntercepts.
      const side1 = pointOnDivlineSide(v1.x, v1.y, trace);
      const side2 = pointOnDivlineSide(v2.x, v2.y, trace);
      if (side1 === side2) return true; // line isn't crossed

      const lineDiv: Divline = { x: v1.x, y: v1.y, dx: linedef.dx, dy: linedef.dy };
      const frac = interceptVector(trace, lineDiv);
      if (frac < 0) return true; // behind the trace

      intercepts.push({ frac, isLine: true, lineIndex: linedefIndex, thing: null });
      return true;
    };

    const tracepositive = ((trace.dx ^ trace.dy) | 0) > 0;
    const addThing = (thing: Mobj): boolean => {
      let tx1: Fixed;
      let ty1: Fixed;
      let tx2: Fixed;
      let ty2: Fixed;

      if (tracepositive) {
        tx1 = (thing.x - thing.radius) | 0;
        ty1 = (thing.y + thing.radius) | 0;
        tx2 = (thing.x + thing.radius) | 0;
        ty2 = (thing.y - thing.radius) | 0;
      } else {
        tx1 = (thing.x - thing.radius) | 0;
        ty1 = (thing.y - thing.radius) | 0;
        tx2 = (thing.x + thing.radius) | 0;
        ty2 = (thing.y + thing.radius) | 0;
      }

      const s1 = pointOnDivlineSide(tx1, ty1, trace);
      const s2 = pointOnDivlineSide(tx2, ty2, trace);
      if (s1 === s2) return true; // line isn't crossed

      const dl: Divline = { x: tx1, y: ty1, dx: (tx2 - tx1) | 0, dy: (ty2 - ty1) | 0 };
      const frac = interceptVector(trace, dl);
      if (frac < 0) return true; // behind source

      intercepts.push({ frac, isLine: false, lineIndex: -1, thing });
      return true;
    };

    for (let count = 0; count < MAX_TRAVERSE_CELLS; count++) {
      if (!blockLinesIterator(mapx, mapy, blockmap, validCount, addLine)) {
        break;
      }
      if (!blockThingsIterator(mapx, mapy, blockmap, blocklinks, addThing)) {
        break;
      }

      if (mapx === xt2 && mapy === yt2) {
        break;
      }

      if (yintercept >> FRACBITS === mapy) {
        yintercept = (yintercept + ystep) | 0;
        mapx += mapxstep;
      } else if (xintercept >> FRACBITS === mapx) {
        xintercept = (xintercept + xstep) | 0;
        mapy += mapystep;
      }
    }

    // P_TraverseIntercepts: O(n²) ascending-frac selection sort,
    // maxfrac = FRACUNIT (the bullet stops at the trace endpoint).
    const total = intercepts.length;
    for (let pass = 0; pass < total; pass++) {
      let dist: Fixed = FIXED_MAX;
      let selected: ShootIntercept | undefined;
      for (let index = 0; index < total; index++) {
        const scan = intercepts[index]!;
        if (scan.frac < dist) {
          dist = scan.frac;
          selected = scan;
        }
      }

      if (dist > FRACUNIT) return;
      if (selected === undefined) return;
      if (!visit(selected)) return;
      selected.frac = FIXED_MAX;
    }
  }

  // ── P_AimLineAttack (p_map.c) ──────────────────────────────────────
  function aimLineAttack(t1: Mobj, angle: Angle, distance: Fixed): AimLineAttackResult {
    const fineIndex = (angle >>> ANGLETOFINESHIFT) & FINEMASK;
    shootthing = t1;

    const x2: Fixed = (t1.x + (distance >> FRACBITS) * finecosine[fineIndex]!) | 0;
    const y2: Fixed = (t1.y + (distance >> FRACBITS) * finesine[fineIndex]!) | 0;
    shootz = (t1.z + (t1.height >> 1) + ((8 * FRACUNIT) | 0)) | 0;

    topslope = AIM_SLOPE_LIMIT;
    bottomslope = (-AIM_SLOPE_LIMIT) | 0;

    attackrange = distance;
    linetarget = null;

    pathTraverse(t1.x, t1.y, x2, y2, aimTraverse);

    if (linetarget) {
      return { slope: aimslope, target: linetarget };
    }
    return { slope: 0, target: null };
  }

  // ── P_LineAttack (p_map.c) ─────────────────────────────────────────
  function lineAttack(t1: Mobj, angle: Angle, distance: Fixed, slope: Fixed, damage: number): void {
    const fineIndex = (angle >>> ANGLETOFINESHIFT) & FINEMASK;
    shootthing = t1;
    laDamage = damage;

    const x2: Fixed = (t1.x + (distance >> FRACBITS) * finecosine[fineIndex]!) | 0;
    const y2: Fixed = (t1.y + (distance >> FRACBITS) * finesine[fineIndex]!) | 0;
    shootz = (t1.z + (t1.height >> 1) + ((8 * FRACUNIT) | 0)) | 0;
    attackrange = distance;
    aimslope = slope;

    pathTraverse(t1.x, t1.y, x2, y2, shootTraverse);
  }

  return { aimLineAttack, lineAttack };
}
