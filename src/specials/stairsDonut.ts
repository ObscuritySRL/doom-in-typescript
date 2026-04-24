/**
 * Stair builders and donut pairs (p_floor.c EV_BuildStairs, p_spec.c
 * EV_DoDonut).
 *
 * Both helpers construct bare {@link FloorMove} thinkers directly and
 * install them into a {@link ThinkerList}, reusing the cross-cutting
 * {@link tMoveFloor} action and the {@link FloorType.donutRaise} slot
 * that step 12-004 left open.  No new thinker action is introduced.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - {@link StairType} values are `build8 = 0, turbo16 = 1` — matching
 *   canonical `stair_e` order.
 * - `build8` uses `speed = FLOORSPEED / 4` and `stairsize = 8*FRACUNIT`.
 *   `turbo16` uses `speed = FLOORSPEED * 4` and `stairsize = 16*FRACUNIT`.
 * - {@link evBuildStairs} marks new movers with `type = FloorType.lowerFloor`,
 *   `direction = up`, `crush = true` (vanilla-parity emulation of
 *   Chocolate Doom's `STAIRS_UNINITIALIZED_CRUSH_FIELD_VALUE = 10`).
 *   Vanilla Doom never initializes the stair `crush` field; the e6y fix
 *   in Chocolate Doom writes a sentinel (10) that is truthy in C and
 *   therefore keeps stair plates crushing things rather than reverting
 *   when a mobj would be squashed.  Our `crush: boolean` collapses that
 *   "truthy but not `1`" value to plain `true` — `P_ChangeSector` treats
 *   both identically.  The type is lowerFloor *literally* — stairs
 *   borrow the same per-tic think function but do not share
 *   lowerFloor's neighbor-lookup setup.
 * - The inner traversal walks `sec.lines[]` in declaration order and
 *   selects a line only if:
 *   1. `ML_TWOSIDED` is set,
 *   2. the line's *front* side IS the current sector (directed traversal),
 *   3. the line's back-sector `floorpic` matches the starting sector's
 *      `floorpic` at the moment the stair began (the `texture`
 *      variable is frozen from the original sector and reused across
 *      every hop — hops never re-sample texture from the new sector).
 * - `height` is bumped by `stairsize` BEFORE the `specialdata` skip
 *   check.  If the matched back-sector already has `specialdata`, the
 *   inner `continue` advances to the next line WITHOUT rolling back
 *   `height`.  The next accepted hop therefore starts one (or more)
 *   stairsize multiples too high — an observable vanilla parity quirk
 *   triggered when a later hop's back-sector is already in use by
 *   another thinker.
 * - Stair building terminates on the first outer iteration where no
 *   line completes a hop (`ok` stays 0 after the inner `for`).  The
 *   outer `while ((secnum = P_FindSectorFromLineTag(line, secnum)) >= 0)`
 *   moves on to the next tag-matching sector and restarts the stair
 *   chain from its floorheight.
 * - The `rtn` counter becomes 1 on the first tag-matching sector that
 *   creates at least its own starting-step thinker.  Sectors whose
 *   `specialdata !== null` are skipped BEFORE `rtn` flips, matching the
 *   vanilla `continue` placement.
 * - {@link evDoDonut} walks tag-matching sectors with
 *   `P_FindSectorFromLineTag`.  Vanilla `rtn` flips to 1 the moment a
 *   matching sector with clean specialdata is found — this happens
 *   BEFORE the s2/s3 validation, so a malformed donut whose s2 ends up
 *   null still reports `rtn = 1`.
 * - Donut outer rim (`s2`): type `donutRaise`, direction up, speed
 *   `FLOORSPEED / 2`, destheight `s3.floorheight`, texture
 *   `s3.floorpic`, newspecial `0`.  The pastdest swap in
 *   {@link tMoveFloor} writes `texture → s2.floorpic` and
 *   `newspecial → s2.special` — so s2 visually inherits s3's floor
 *   with a cleared special slot.
 * - Donut hole (`s1`): type `lowerFloor`, direction down, speed
 *   `FLOORSPEED / 2`, destheight `s3.floorheight`.  `crush = false`.
 * - `s2 = getNextSector(s1.lines[0], s1)` — the back sector across
 *   s1's FIRST linedef in declaration order, returning null if the
 *   line is not two-sided or if the line has no back side.  A null
 *   `s2` aborts the outer loop with `break` (the `continue` is for
 *   inner loops), not `continue` — so subsequent tag-matching sectors
 *   are NOT processed.  This is vanilla parity.
 * - The inner `for` over `s2.lines` selects the FIRST line whose raw
 *   `backSector` is neither `s1` nor null.  If every line's backSector
 *   is either `s1` or null, no donut is spawned for that sector — the
 *   inner `for` falls through without `break`, and the outer `while`
 *   moves to the next tag-matching sector.
 * - Chocolate Doom additionally emulates a vanilla buffer-overrun when
 *   `s3` is null (reading bytes past the sector struct) via
 *   `DonutOverrun`.  Our implementation exposes this via the optional
 *   {@link DonutCallbacks.onDonutOverrun} hook; when unset, null `s3`
 *   lines are skipped (the inner `for` advances to the next line).
 *   Save-compat tests that need the exact overrun bytes must supply
 *   the hook.
 * - Both helpers skip sectors whose `specialdata !== null` without
 *   incrementing `rtn`, matching vanilla.  Thinkers are added to
 *   `thinkerList`, back-fill `sector.specialdata`, and use the same
 *   `action = tMoveFloor` binding as {@link evDoFloor}.
 *
 * @example
 * ```ts
 * import { evBuildStairs, StairType } from "../src/specials/stairsDonut.ts";
 * const created = evBuildStairs(
 *   line, StairType.build8, sectors, thinkerList, floorCallbacks,
 * );
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';
import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';
import type { FloorCallbacks, FloorSector } from './floors.ts';
import { FLOORSPEED, FloorDirection, FloorMove, FloorType } from './floors.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import { tMoveFloor } from './floors.ts';

// ── Constants ──────────────────────────────────────────────────────

/** Stair riser height in Fixed units for {@link StairType.build8}. */
export const STAIR_8_UNIT_SIZE: Fixed = (8 * FRACUNIT) | 0;

/** Stair riser height in Fixed units for {@link StairType.turbo16}. */
export const STAIR_16_UNIT_SIZE: Fixed = (16 * FRACUNIT) | 0;

/** Per-tic speed for {@link StairType.build8} — one quarter of {@link FLOORSPEED}. */
export const STAIR_BUILD8_SPEED: Fixed = (FLOORSPEED / 4) | 0;

/** Per-tic speed for {@link StairType.turbo16} — four times {@link FLOORSPEED}. */
export const STAIR_TURBO16_SPEED: Fixed = (FLOORSPEED * 4) | 0;

/** Per-tic speed for both donut movers (outer rim and inner hole). */
export const DONUT_SPEED: Fixed = (FLOORSPEED / 2) | 0;

// ── Enums ──────────────────────────────────────────────────────────

/** stair_e from p_spec.h, in canonical source order. */
export const enum StairType {
  /** Slow stairs, 8-unit risers (vanilla `build8`). */
  build8 = 0,
  /** Fast stairs, 16-unit risers (vanilla `turbo16`). */
  turbo16 = 1,
}

// ── Sector / line contracts ────────────────────────────────────────

/**
 * A linedef view visible to stair/donut traversal.  Only the
 * `ML_TWOSIDED` flag bit is consulted, plus the resolved front / back
 * sector pointers (null when the line has no back side).
 */
export interface StairsDonutLinedef {
  readonly flags: number;
  readonly frontSector: StairsDonutSector;
  readonly backSector: StairsDonutSector | null;
}

/**
 * A sector view visible to stair/donut traversal.  Extends
 * {@link FloorSector} with the ordered linedef list vanilla reads via
 * `sec->lines[i]`.
 */
export interface StairsDonutSector extends FloorSector {
  readonly lines: readonly StairsDonutLinedef[];
}

/** Line view used by {@link evBuildStairs} and {@link evDoDonut}. */
export interface StairsDonutLine {
  readonly tag: number;
}

/**
 * Optional hook bundled with {@link FloorCallbacks} when the caller
 * wants to emulate the vanilla buffer-overrun that fires when a
 * donut's candidate outer-ring line has a null back sector.
 *
 * Implementations receive the triggering line and the pillar sector
 * (`s1`) and return the `{ floorheight, floorpic }` pair that vanilla
 * would have read from the out-of-bounds memory.  When the hook is
 * not provided, null-back-sector lines are skipped silently — safe
 * for well-formed maps, wrong for save-compat with the specific few
 * vanilla demos that depend on the overrun bytes.
 */
export interface DonutCallbacks extends FloorCallbacks {
  onDonutOverrun?(line: StairsDonutLine, pillar: StairsDonutSector): { floorheight: Fixed; floorpic: number };
}

// ── EV_BuildStairs ─────────────────────────────────────────────────

/**
 * EV_BuildStairs: walk every tag-matching sector and build a stair
 * chain of {@link FloorMove} thinkers from it.  Returns 1 if at least
 * one chain starter was created, 0 otherwise — matching vanilla `rtn`.
 *
 * Each stair starter uses `type = FloorType.lowerFloor`, `direction =
 * up`, `speed` per-type, and `floordestheight = starter.floorheight +
 * stairsize`.  Each successive hop reuses the frozen starter
 * `texture` to match back-sector `floorpic`, bumps `height` by
 * `stairsize` *before* the specialdata skip, and creates a new
 * {@link FloorMove} on the back sector if it is clean.
 */
export function evBuildStairs(line: StairsDonutLine, type: StairType, sectors: readonly StairsDonutSector[], thinkerList: ThinkerList, callbacks: FloorCallbacks): number {
  const stairsize = type === StairType.turbo16 ? STAIR_16_UNIT_SIZE : STAIR_8_UNIT_SIZE;
  const speed = type === StairType.turbo16 ? STAIR_TURBO16_SPEED : STAIR_BUILD8_SPEED;

  let rtn = 0;
  for (const starter of sectors) {
    if (starter.tag !== line.tag) continue;
    if (starter.specialdata !== null) continue;

    rtn = 1;

    let sec: StairsDonutSector = starter;
    let height: Fixed = (sec.floorheight + stairsize) | 0;
    createStairFloor(sec, height, speed, thinkerList, callbacks);

    const texture = starter.floorpic;

    let ok = true;
    while (ok) {
      ok = false;
      for (const stairLine of sec.lines) {
        if ((stairLine.flags & ML_TWOSIDED) === 0) continue;
        if (stairLine.frontSector !== sec) continue;

        const back = stairLine.backSector;
        if (back === null) continue;
        if (back.floorpic !== texture) continue;

        height = (height + stairsize) | 0;

        if (back.specialdata !== null) continue;

        sec = back;
        createStairFloor(sec, height, speed, thinkerList, callbacks);
        ok = true;
        break;
      }
    }
  }
  return rtn;
}

function createStairFloor(sector: StairsDonutSector, destheight: Fixed, speed: Fixed, thinkerList: ThinkerList, callbacks: FloorCallbacks): void {
  const floor = new FloorMove(sector, FloorType.lowerFloor, callbacks);
  floor.action = tMoveFloor;
  // Vanilla-parity: STAIRS_UNINITIALIZED_CRUSH_FIELD_VALUE = 10 (truthy).
  floor.crush = true;
  floor.direction = FloorDirection.up;
  floor.speed = speed;
  floor.floordestheight = destheight;
  sector.specialdata = floor;
  thinkerList.add(floor);
}

// ── EV_DoDonut ─────────────────────────────────────────────────────

/**
 * EV_DoDonut: create a donut-pair pulse for every tag-matching
 * sector.  Returns 1 if at least one pillar-sector match was found
 * (vanilla `rtn` flips before the s2/s3 validation), 0 otherwise.
 *
 * For each pillar `s1`:
 * - `s2 = getNextSector(s1.lines[0], s1)`; null `s2` breaks the outer
 *   loop entirely (vanilla `break`, not `continue`).
 * - Walk `s2.lines[i].backSector` for the first entry that is neither
 *   `s1` nor null; that sector is `s3`.  When the null-back variant
 *   fires, {@link DonutCallbacks.onDonutOverrun} supplies `s3`'s
 *   `{ floorheight, floorpic }` pair if provided; otherwise the line
 *   is skipped.
 * - Construct the outer-rim raise mover on `s2` (donutRaise / up /
 *   speed FLOORSPEED/2 / destheight s3.floorheight / texture
 *   s3.floorpic / newspecial 0).
 * - Construct the inner-hole lower mover on `s1` (lowerFloor / down /
 *   speed FLOORSPEED/2 / destheight s3.floorheight).
 * - `break` out of the `s2.lines` loop — exactly one donut pair per
 *   pillar.
 */
export function evDoDonut(line: StairsDonutLine, sectors: readonly StairsDonutSector[], thinkerList: ThinkerList, callbacks: DonutCallbacks): number {
  let rtn = 0;
  for (const s1 of sectors) {
    if (s1.tag !== line.tag) continue;
    if (s1.specialdata !== null) continue;

    rtn = 1;

    if (s1.lines.length === 0) break;
    const s2 = getNextSector(s1.lines[0]!, s1);
    if (s2 === null) break;

    for (const donutLine of s2.lines) {
      const rawBack = donutLine.backSector;
      if (rawBack === s1) continue;

      let s3FloorHeight: Fixed;
      let s3FloorPic: number;
      if (rawBack === null) {
        if (callbacks.onDonutOverrun === undefined) continue;
        const overrun = callbacks.onDonutOverrun(line, s1);
        s3FloorHeight = overrun.floorheight;
        s3FloorPic = overrun.floorpic;
      } else {
        s3FloorHeight = rawBack.floorheight;
        s3FloorPic = rawBack.floorpic;
      }

      const rim = new FloorMove(s2, FloorType.donutRaise, callbacks);
      rim.action = tMoveFloor;
      rim.crush = false;
      rim.direction = FloorDirection.up;
      rim.speed = DONUT_SPEED;
      rim.texture = s3FloorPic;
      rim.newspecial = 0;
      rim.floordestheight = s3FloorHeight;
      s2.specialdata = rim;
      thinkerList.add(rim);

      const hole = new FloorMove(s1, FloorType.lowerFloor, callbacks);
      hole.action = tMoveFloor;
      hole.crush = false;
      hole.direction = FloorDirection.down;
      hole.speed = DONUT_SPEED;
      hole.floordestheight = s3FloorHeight;
      s1.specialdata = hole;
      thinkerList.add(hole);

      break;
    }
  }
  return rtn;
}

/**
 * getNextSector (p_spec.c): return the sector on the OTHER side of
 * `line` from `sec`.  Null when `line` is not two-sided — vanilla
 * parity means the `ML_TWOSIDED` flag is the only gate, even when the
 * back sidedef physically exists.
 */
function getNextSector(line: StairsDonutLinedef, sec: StairsDonutSector): StairsDonutSector | null {
  if ((line.flags & ML_TWOSIDED) === 0) return null;
  if (line.frontSector === sec) return line.backSector;
  return line.frontSector;
}
