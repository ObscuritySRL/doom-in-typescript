/**
 * Per-seg wall-range parameter coordinator — Chocolate Doom 2.2.1
 * r_main.c `R_PointToAngle` / `R_PointToAngle2` / `R_PointToDist` /
 * `R_ScaleFromGlobalAngle` and r_segs.c `R_StoreWallRange` (the
 * parameter-derivation portion, up to but excluding the drawseg-pool
 * I/O, `R_CheckPlane`, `R_RenderSegLoop`, the openings `memcpy`, and
 * `ds_p++`, which the top-level sequencer owns).
 *
 * This is the renderer's single most parity-sensitive arithmetic: the
 * `R_ScaleFromGlobalAngle` 32-bit `FixedDiv` overflow guard, the
 * `R_PointToDist` `tantoangle` path, the `abs(rw_normalangle-rw_angle1)`
 * signed/unsigned reinterpretation, and the `rw_offset` /
 * `rw_centerangle` signedness all live here.  Every value is derived
 * verbatim from the pinned Chocolate Doom 2.2.1 source (authority tier:
 * upstream Chocolate Doom source, per plan_fps/REFERENCE_ORACLES.md) so
 * the produced `rw_*` / stepping accumulators / `textureColumnFor`
 * closure feed the existing bit-exact {@link renderSolidWall} /
 * {@link renderTwoSidedWall} with exactly the values vanilla DOOM 1.9
 * computed for the same seg.
 *
 * Verbatim contract (Chocolate Doom 2.2.1 r_main.c):
 *
 *   angle_t R_PointToAngle ( fixed_t x, fixed_t y )
 *   {
 *       x -= viewx;  y -= viewy;
 *       if ( (!x) && (!y) ) return 0;
 *       if (x>= 0) {
 *           if (y>= 0) { if (x>y) return tantoangle[SlopeDiv(y,x)];
 *                        else     return ANG90-1-tantoangle[SlopeDiv(x,y)]; }
 *           else { y = -y;
 *                  if (x>y) return -tantoangle[SlopeDiv(y,x)];
 *                  else     return ANG270+tantoangle[SlopeDiv(x,y)]; } }
 *       else { x = -x;
 *           if (y>= 0) { if (x>y) return ANG180-1-tantoangle[SlopeDiv(y,x)];
 *                        else     return ANG90+ tantoangle[SlopeDiv(x,y)]; }
 *           else { y = -y;
 *                  if (x>y) return ANG180+tantoangle[SlopeDiv(y,x)];
 *                  else     return ANG270-1-tantoangle[SlopeDiv(x,y)]; } }
 *       return 0;
 *   }
 *   angle_t R_PointToAngle2 ( fixed_t x1, fixed_t y1, fixed_t x2, fixed_t y2 )
 *   { viewx = x1; viewy = y1; return R_PointToAngle (x2, y2); }
 *   fixed_t R_PointToDist ( fixed_t x, fixed_t y )
 *   {
 *       int angle; fixed_t dx, dy, temp, dist, frac;
 *       dx = abs(x - viewx);  dy = abs(y - viewy);
 *       if (dy>dx) { temp = dx; dx = dy; dy = temp; }
 *       if (dx != 0) frac = FixedDiv(dy, dx); else frac = 0;
 *       angle = (tantoangle[frac>>DBITS]+ANG90) >> ANGLETOFINESHIFT;
 *       dist = FixedDiv (dx, finesine[angle] );
 *       return dist;
 *   }
 *
 * `R_ScaleFromGlobalAngle` (r_main.c) and the `[256, 64*FRACUNIT]`
 * scale clamp / `den > num>>16` guard are transcribed once in
 * {@link ./implement-wall-column-scale-math.ts} and reused here so the
 * clamp lives in exactly one place.
 *
 * `R_StoreWallRange` (r_segs.c) is transcribed field-for-field below.
 * The drawseg-pool overflow guard (`ds_p == &drawsegs[MAXDRAWSEGS]`),
 * the `linedef->flags |= ML_MAPPED` automap mutation, `R_CheckPlane`,
 * `R_RenderSegLoop`, the sprite-clip `memcpy` into `lastopening`, and
 * `ds_p++` are intentionally NOT performed here — they are the
 * top-level sequencer's responsibility (a later increment).  This
 * module is pure: it reads the supplied seg / sector / sidedef /
 * linedef geometry plus view state and returns the derived parameters.
 *
 * Pure arithmetic; no Win32 or runtime dependencies.
 */

import { FRACBITS, type Fixed, fixedDiv, fixedMul } from '../core/fixed.ts';
import { ANG90, ANG180, ANG270, type Angle } from '../core/angle.ts';
import { ANGLETOFINESHIFT, DBITS, finesine, finetangent, slopeDiv, tantoangle } from '../core/trig.ts';

import { ML_DONTPEGBOTTOM, ML_DONTPEGTOP } from '../map/lineSectorGeometry.ts';
import { LIGHTLEVELS, LIGHTSEGSHIFT } from './projection.ts';
import { SIL_BOTH, SIL_BOTTOM, SIL_NONE, SIL_TOP } from './spriteClip.ts';
import { VANILLA_WALL_SCALE_MAX, clampVanillaWallScale, vanillaWallScaleDenominatorPasses } from './implement-wall-column-scale-math.ts';

/** `INT_MAX` — vanilla `ds_p->bsilheight` "no bottom silhouette" sentinel. */
const INT_MAX = 0x7fff_ffff;
/** `INT_MIN` — vanilla `ds_p->tsilheight` "no top silhouette" sentinel. */
const INT_MIN = -0x8000_0000;

/** Coerce to a signed 32-bit int (C `(int)` cast / `fixed_t` truncation). */
function toInt32(value: number): number {
  return value | 0;
}

/** Coerce to an unsigned 32-bit int (C `angle_t` wraparound). */
function toAngle(value: number): Angle {
  return value >>> 0;
}

/**
 * r_main.c `R_PointToAngle` with the `x -= viewx; y -= viewy;`
 * preamble made explicit (the C globals are passed in).  Returns a
 * 32-bit BAM `angle_t`.
 */
export function pointToAngle(x: Fixed, y: Fixed, viewx: Fixed, viewy: Fixed): Angle {
  const dx = toInt32(x - viewx);
  const dy = toInt32(y - viewy);

  if (dx === 0 && dy === 0) {
    return 0;
  }

  if (dx >= 0) {
    if (dy >= 0) {
      if (dx > dy) {
        return toAngle(tantoangle[slopeDiv(dy, dx)]!); // octant 0
      }
      return toAngle(ANG90 - 1 - tantoangle[slopeDiv(dx, dy)]!); // octant 1
    }
    const absY = toInt32(-dy);
    if (dx > absY) {
      return toAngle(-tantoangle[slopeDiv(absY, dx)]!); // octant 8
    }
    return toAngle(ANG270 + tantoangle[slopeDiv(dx, absY)]!); // octant 7
  }

  const absX = toInt32(-dx);
  if (dy >= 0) {
    if (absX > dy) {
      return toAngle(ANG180 - 1 - tantoangle[slopeDiv(dy, absX)]!); // octant 3
    }
    return toAngle(ANG90 + tantoangle[slopeDiv(absX, dy)]!); // octant 2
  }
  const absY = toInt32(-dy);
  if (absX > absY) {
    return toAngle(ANG180 + tantoangle[slopeDiv(absY, absX)]!); // octant 4
  }
  return toAngle(ANG270 - 1 - tantoangle[slopeDiv(absX, absY)]!); // octant 5
}

/**
 * r_main.c `R_PointToAngle2` — `viewx = x1; viewy = y1; return
 * R_PointToAngle(x2, y2);`.  The view-origin side effect is folded
 * into the explicit arguments.
 */
export function pointToAngle2(x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed): Angle {
  return pointToAngle(x2, y2, x1, y1);
}

/**
 * r_main.c `R_PointToDist`.  `abs(x - viewx)` / `abs(y - viewy)` use
 * the C `int` reinterpretation; the `tantoangle[frac>>DBITS]` /
 * `finesine` path and the `FixedDiv` guards are bit-exact.
 */
export function pointToDist(x: Fixed, y: Fixed, viewx: Fixed, viewy: Fixed): Fixed {
  const rawDx = toInt32(x - viewx);
  const rawDy = toInt32(y - viewy);
  let dx = rawDx < 0 ? toInt32(-rawDx) : rawDx;
  let dy = rawDy < 0 ? toInt32(-rawDy) : rawDy;

  if (dy > dx) {
    const temp = dx;
    dx = dy;
    dy = temp;
  }

  // "Fix crashes in udm1.wad" — vanilla guards dx == 0.
  const frac = dx !== 0 ? fixedDiv(dy, dx) : 0;

  const angle = toAngle(tantoangle[frac >> DBITS]! + ANG90) >>> ANGLETOFINESHIFT;

  // use as cosine
  return fixedDiv(dx, finesine[angle]!);
}

/**
 * r_main.c `R_ScaleFromGlobalAngle`.  The two angle subtractions use
 * 32-bit BAM wraparound; the numerator is shifted by `detailshift`;
 * the `den > num>>16` guard and the `[256, 64*FRACUNIT]` clamp are the
 * single transcription in {@link ./implement-wall-column-scale-math.ts}.
 */
export function scaleFromGlobalAngle(visangle: Angle, viewangle: Angle, rwNormalangle: Angle, rwDistance: Fixed, projection: Fixed, detailshift: number): Fixed {
  const anglea = toAngle(ANG90 + toAngle(visangle - viewangle));
  const angleb = toAngle(ANG90 + toAngle(visangle - rwNormalangle));
  const sinea = finesine[anglea >>> ANGLETOFINESHIFT]!;
  const sineb = finesine[angleb >>> ANGLETOFINESHIFT]!;

  const num = toInt32(fixedMul(projection, sineb) << detailshift);
  const den = fixedMul(rwDistance, sinea);

  if (vanillaWallScaleDenominatorPasses({ den, num })) {
    return clampVanillaWallScale({ rawScale: fixedDiv(num, den) });
  }
  return VANILLA_WALL_SCALE_MAX;
}

/** A linedef vertex (`v1` / `v2`): map-unit fixed-point coordinates. */
export interface SegVertex {
  readonly x: Fixed;
  readonly y: Fixed;
}

/** Sector geometry `R_StoreWallRange` reads (front / back). */
export interface SegSector {
  readonly ceilingheight: Fixed;
  readonly floorheight: Fixed;
  /** Flat number; compared against `skyflatnum` for the sky hack. */
  readonly ceilingpic: number;
  readonly floorpic: number;
  readonly lightlevel: number;
}

/** Sidedef texture numbers and offsets. */
export interface SegSidedef {
  readonly midtexture: number;
  readonly toptexture: number;
  readonly bottomtexture: number;
  readonly textureoffset: Fixed;
  readonly rowoffset: Fixed;
}

/** The seg under consideration plus its line / sectors. */
export interface StoreWallRangeSeg {
  /** Screen column range `[start, stop]` inclusive (`rw_x` / `rw_x2`). */
  readonly start: number;
  readonly stop: number;
  /** `seg_t.angle` (precomputed BAM angle of the seg). */
  readonly curlineAngle: Angle;
  /** `seg_t.offset` — distance of `v1` along the linedef. */
  readonly curlineOffset: Fixed;
  readonly v1: SegVertex;
  readonly v2: SegVertex;
  readonly linedefFlags: number;
  readonly sidedef: SegSidedef;
  readonly frontsector: SegSector;
  readonly backsector: SegSector | null;
  /**
   * `rw_angle1` — the BAM angle to `v1` from the view origin, computed
   * by the BSP walker (`R_AddLine`) before `R_StoreWallRange` runs.
   */
  readonly rwAngle1: Angle;
}

/** Live view + render state `R_StoreWallRange` reads. */
export interface StoreWallRangeView {
  readonly viewx: Fixed;
  readonly viewy: Fixed;
  readonly viewz: Fixed;
  readonly viewangle: Angle;
  readonly extralight: number;
  /** Flat number that means "sky" (`skyflatnum`). */
  readonly skyflatnum: number;
  /** `true` when a fixed colormap is active (powerups / invuln). */
  readonly fixedColormap: boolean;
  /** r_main.c `centeryfrac` (16.16). */
  readonly centeryfrac: Fixed;
  /** r_main.c `projection` (== `centerxfrac`). */
  readonly projection: Fixed;
  /** r_main.c `detailshift` (0 high detail, 1 low). */
  readonly detailshift: number;
  /** I1 `xtoviewangle` table for the active viewport. */
  readonly xtoviewangle: Uint32Array;
}

/**
 * Optional texture-number → translated-texture / texture-height
 * lookups.  Vanilla uses the `texturetranslation[]` / `textureheight[]`
 * arrays (animated-texture indirection lives in a later increment);
 * injecting them keeps this coordinator decoupled from the texture
 * catalog while staying bit-exact.  Defaults are identity / zero.
 */
export interface StoreWallRangeTextures {
  readonly texturetranslation?: (texnum: number) => number;
  readonly textureheight?: (texnum: number) => Fixed;
}

/**
 * The full set of `R_StoreWallRange`-derived parameters consumed by
 * the wall / plane / sprite-clip paths.  Field names mirror the
 * vanilla `rw_*` / `ds_p->*` locals.
 */
export interface StoredWallRange {
  readonly rwX: number;
  readonly rwStopX: number;
  readonly rwNormalangle: Angle;
  readonly rwDistance: Fixed;
  readonly rwOffset: Fixed;
  readonly rwCenterangle: Angle;
  readonly rwScale: Fixed;
  readonly rwScalestep: Fixed;
  /** `ds_p->scale1` / `ds_p->scale2`. */
  readonly scale1: Fixed;
  readonly scale2: Fixed;
  /**
   * Vanilla `worldtop` local (pre-`>>4`): `frontsector->ceilingheight
   * - viewz`, or `worldhigh` after the outdoor matching-sky hack
   * rewrites it.  This tracked value feeds `topFrac` / `topStep`.
   */
  readonly worldtop: Fixed;
  /** `frontsector->floorheight - viewz` (pre-`>>4`). */
  readonly worldbottom: Fixed;
  /** `backsector->ceilingheight - viewz`, or `null` (one-sided). */
  readonly worldhigh: Fixed | null;
  /** `backsector->floorheight - viewz`, or `null` (one-sided). */
  readonly worldlow: Fixed | null;
  readonly midTexture: number;
  readonly topTexture: number;
  readonly bottomTexture: number;
  readonly maskedTexture: boolean;
  readonly segtextured: boolean;
  readonly rwMidtexturemid: Fixed;
  readonly rwToptexturemid: Fixed;
  readonly rwBottomtexturemid: Fixed;
  readonly markFloor: boolean;
  readonly markCeiling: boolean;
  readonly silhouette: number;
  readonly bsilheight: Fixed;
  readonly tsilheight: Fixed;
  /** `ds_p->sprtopclip = screenheightarray` when `'screenheight'`. */
  readonly sprTopClip: 'screenheight' | null;
  /** `ds_p->sprbottomclip = negonearray` when `'negone'`. */
  readonly sprBottomClip: 'negone' | null;
  readonly topFrac: Fixed;
  readonly topStep: Fixed;
  readonly bottomFrac: Fixed;
  readonly bottomStep: Fixed;
  /** `pixhigh` / `pixhighstep` (two-sided, `worldhigh < worldtop`). */
  readonly pixhigh: Fixed | null;
  readonly pixhighstep: Fixed | null;
  /** `pixlow` / `pixlowstep` (two-sided, `worldlow > worldbottom`). */
  readonly pixlow: Fixed | null;
  readonly pixlowstep: Fixed | null;
  /** Raw `lightnum` (post horizontal/vertical adjust); `null` if a fixed colormap is active. */
  readonly lightnum: number | null;
  /** `walllights = scalelight[wallLightsIndex]`; `null` if a fixed colormap is active. */
  readonly wallLightsIndex: number | null;
  /**
   * Resolve the integer wall-texture column for screen column `x`,
   * exactly as r_segs.c `R_RenderSegLoop`:
   *   `angle = (rw_centerangle + xtoviewangle[x]) >> ANGLETOFINESHIFT;`
   *   `texturecolumn = (rw_offset - FixedMul(finetangent[angle], rw_distance)) >> FRACBITS;`
   */
  readonly textureColumnFor: (x: number) => number;
}

const IDENTITY_TEXTURE = (texnum: number): number => texnum;
const ZERO_HEIGHT = (): Fixed => 0;

/**
 * r_segs.c `R_StoreWallRange` — derive every `rw_*` parameter, the
 * texture-mid values, the floor/ceiling-mark and silhouette decisions,
 * the incremental top/bottom/pixhigh/pixlow stepping accumulators, the
 * light-level selection, and the per-column `textureColumnFor` closure
 * for the seg covering screen columns `[seg.start, seg.stop]`.
 *
 * Pure: performs no drawseg-pool, visplane, openings, automap, or
 * framebuffer side effects (those belong to the sequencer / the
 * already-bit-exact wall and plane modules).
 */
export function storeWallRange(seg: StoreWallRangeSeg, view: StoreWallRangeView, textures: StoreWallRangeTextures = {}): StoredWallRange {
  const texturetranslation = textures.texturetranslation ?? IDENTITY_TEXTURE;
  const textureheight = textures.textureheight ?? ZERO_HEIGHT;

  const { start, stop, sidedef, frontsector, backsector } = seg;
  const { viewz, viewangle, xtoviewangle } = view;

  // calculate rw_distance for scale calculation
  const rwNormalangle = toAngle(seg.curlineAngle + ANG90);
  let offsetangle = Math.abs(toInt32(rwNormalangle - seg.rwAngle1));
  if (offsetangle > ANG90) {
    offsetangle = ANG90;
  }
  const distangle = toAngle(ANG90 - offsetangle);
  const hyp = pointToDist(seg.v1.x, seg.v1.y, view.viewx, view.viewy);
  const distSineval = finesine[distangle >>> ANGLETOFINESHIFT]!;
  const rwDistance = fixedMul(hyp, distSineval);

  const rwX = start;
  const rwStopX = stop + 1;

  // calculate scale at both ends and step
  const scale1 = scaleFromGlobalAngle(toAngle(viewangle + xtoviewangle[start]!), viewangle, rwNormalangle, rwDistance, view.projection, view.detailshift);
  const rwScale = scale1;
  let scale2: Fixed;
  let rwScalestep: Fixed;
  if (stop > start) {
    scale2 = scaleFromGlobalAngle(toAngle(viewangle + xtoviewangle[stop]!), viewangle, rwNormalangle, rwDistance, view.projection, view.detailshift);
    rwScalestep = toInt32((scale2 - rwScale) / (stop - start));
  } else {
    scale2 = scale1;
    // Single-column seg: rw_stopx = start+1, so R_RenderSegLoop draws
    // exactly one column and the step is added only after the final
    // (discarded) iteration — its value never affects a drawn pixel.
    rwScalestep = 0;
  }

  // calculate texture boundaries and decide if floor / ceiling marks are needed
  let worldtop = toInt32(frontsector.ceilingheight - viewz);
  let worldbottom = toInt32(frontsector.floorheight - viewz);

  let midTexture = 0;
  let topTexture = 0;
  let bottomTexture = 0;
  let maskedTexture = false;
  let markFloor = false;
  let markCeiling = false;
  let rwMidtexturemid = 0;
  let rwToptexturemid = 0;
  let rwBottomtexturemid = 0;
  let worldhigh: Fixed | null = null;
  let worldlow: Fixed | null = null;
  let silhouette = SIL_NONE as number;
  let bsilheight = 0;
  let tsilheight = 0;
  let sprTopClip: 'screenheight' | null = null;
  let sprBottomClip: 'negone' | null = null;

  if (!backsector) {
    // single sided line
    midTexture = texturetranslation(sidedef.midtexture);
    // a single sided line is terminal, so it must mark ends
    markFloor = true;
    markCeiling = true;
    if (seg.linedefFlags & ML_DONTPEGBOTTOM) {
      const vtop = toInt32(frontsector.floorheight + textureheight(sidedef.midtexture));
      // bottom of texture at bottom
      rwMidtexturemid = toInt32(vtop - viewz);
    } else {
      // top of texture at top
      rwMidtexturemid = worldtop;
    }
    rwMidtexturemid = toInt32(rwMidtexturemid + sidedef.rowoffset);

    silhouette = SIL_BOTH;
    sprTopClip = 'screenheight';
    sprBottomClip = 'negone';
    bsilheight = INT_MAX;
    tsilheight = INT_MIN;
  } else {
    // two sided line
    silhouette = SIL_NONE;

    if (frontsector.floorheight > backsector.floorheight) {
      silhouette = SIL_BOTTOM;
      bsilheight = frontsector.floorheight;
    } else if (backsector.floorheight > viewz) {
      silhouette = SIL_BOTTOM;
      bsilheight = INT_MAX;
    }

    if (frontsector.ceilingheight < backsector.ceilingheight) {
      silhouette |= SIL_TOP;
      tsilheight = frontsector.ceilingheight;
    } else if (backsector.ceilingheight < viewz) {
      silhouette |= SIL_TOP;
      tsilheight = INT_MIN;
    }

    if (backsector.ceilingheight <= frontsector.floorheight) {
      sprBottomClip = 'negone';
      bsilheight = INT_MAX;
      silhouette |= SIL_BOTTOM;
    }

    if (backsector.floorheight >= frontsector.ceilingheight) {
      sprTopClip = 'screenheight';
      tsilheight = INT_MIN;
      silhouette |= SIL_TOP;
    }

    worldhigh = toInt32(backsector.ceilingheight - viewz);
    worldlow = toInt32(backsector.floorheight - viewz);

    // hack to allow height changes in outdoor areas
    if (frontsector.ceilingpic === view.skyflatnum && backsector.ceilingpic === view.skyflatnum) {
      worldtop = worldhigh;
    }

    if (worldlow !== worldbottom || backsector.floorpic !== frontsector.floorpic || backsector.lightlevel !== frontsector.lightlevel) {
      markFloor = true;
    } else {
      // same plane on both sides
      markFloor = false;
    }

    if (worldhigh !== worldtop || backsector.ceilingpic !== frontsector.ceilingpic || backsector.lightlevel !== frontsector.lightlevel) {
      markCeiling = true;
    } else {
      // same plane on both sides
      markCeiling = false;
    }

    if (backsector.ceilingheight <= frontsector.floorheight || backsector.floorheight >= frontsector.ceilingheight) {
      // closed door
      markCeiling = true;
      markFloor = true;
    }

    if (worldhigh < worldtop) {
      // top texture
      topTexture = texturetranslation(sidedef.toptexture);
      if (seg.linedefFlags & ML_DONTPEGTOP) {
        // top of texture at top
        rwToptexturemid = worldtop;
      } else {
        const vtop = toInt32(backsector.ceilingheight + textureheight(sidedef.toptexture));
        // bottom of texture
        rwToptexturemid = toInt32(vtop - viewz);
      }
    }
    if (worldlow > worldbottom) {
      // bottom texture
      bottomTexture = texturetranslation(sidedef.bottomtexture);
      if (seg.linedefFlags & ML_DONTPEGBOTTOM) {
        // bottom of texture at bottom / top of texture at top
        rwBottomtexturemid = worldtop;
      } else {
        // top of texture at top
        rwBottomtexturemid = worldlow;
      }
    }
    rwToptexturemid = toInt32(rwToptexturemid + sidedef.rowoffset);
    rwBottomtexturemid = toInt32(rwBottomtexturemid + sidedef.rowoffset);

    // allocate space for masked texture tables
    if (sidedef.midtexture) {
      // masked midtexture
      maskedTexture = true;
    }
  }

  // calculate rw_offset (only needed for textured lines)
  const segtexturedMask = midTexture | topTexture | bottomTexture | (maskedTexture ? 1 : 0);
  const segtextured = segtexturedMask !== 0;

  let rwOffset = 0;
  let rwCenterangle = 0;
  let lightnum: number | null = null;
  let wallLightsIndex: number | null = null;

  if (segtextured) {
    let off = toAngle(rwNormalangle - seg.rwAngle1);

    if (off > ANG180) {
      off = toAngle(-off);
    }
    if (off > ANG90) {
      off = ANG90;
    }

    const offSineval = finesine[off >>> ANGLETOFINESHIFT]!;
    rwOffset = fixedMul(hyp, offSineval);

    if (toAngle(rwNormalangle - seg.rwAngle1) < ANG180) {
      rwOffset = toInt32(-rwOffset);
    }

    rwOffset = toInt32(rwOffset + toInt32(sidedef.textureoffset + seg.curlineOffset));
    rwCenterangle = toAngle(ANG90 + viewangle - rwNormalangle);

    // calculate light table — different tables for horizontal /
    // vertical / diagonal.  Only when no fixed colormap is active.
    if (!view.fixedColormap) {
      lightnum = toInt32((frontsector.lightlevel >> LIGHTSEGSHIFT) + view.extralight);

      if (seg.v1.y === seg.v2.y) {
        lightnum -= 1;
      } else if (seg.v1.x === seg.v2.x) {
        lightnum += 1;
      }

      if (lightnum < 0) {
        wallLightsIndex = 0;
      } else if (lightnum >= LIGHTLEVELS) {
        wallLightsIndex = LIGHTLEVELS - 1;
      } else {
        wallLightsIndex = lightnum;
      }
    }
  }

  // if a floor / ceiling plane is on the wrong side of the view plane,
  // it is definitely invisible and doesn't need to be marked.
  if (frontsector.floorheight >= viewz) {
    // above view plane
    markFloor = false;
  }
  if (frontsector.ceilingheight <= viewz && frontsector.ceilingpic !== view.skyflatnum) {
    // below view plane
    markCeiling = false;
  }

  // calculate incremental stepping values for texture edges
  const worldtopRaw = worldtop;
  const worldbottomRaw = worldbottom;
  const worldtop4 = worldtop >> 4;
  const worldbottom4 = worldbottom >> 4;
  const centeryfracShifted = view.centeryfrac >> 4;

  const topStep = toInt32(-fixedMul(rwScalestep, worldtop4));
  const topFrac = toInt32(centeryfracShifted - fixedMul(worldtop4, rwScale));
  const bottomStep = toInt32(-fixedMul(rwScalestep, worldbottom4));
  const bottomFrac = toInt32(centeryfracShifted - fixedMul(worldbottom4, rwScale));

  let pixhigh: Fixed | null = null;
  let pixhighstep: Fixed | null = null;
  let pixlow: Fixed | null = null;
  let pixlowstep: Fixed | null = null;
  if (backsector) {
    const worldhigh4 = (worldhigh as number) >> 4;
    const worldlow4 = (worldlow as number) >> 4;

    if (worldhigh4 < worldtop4) {
      pixhigh = toInt32(centeryfracShifted - fixedMul(worldhigh4, rwScale));
      pixhighstep = toInt32(-fixedMul(rwScalestep, worldhigh4));
    }
    if (worldlow4 > worldbottom4) {
      pixlow = toInt32(centeryfracShifted - fixedMul(worldlow4, rwScale));
      pixlowstep = toInt32(-fixedMul(rwScalestep, worldlow4));
    }
  }

  const textureColumnFor = (x: number): number => {
    const angle = toAngle(rwCenterangle + xtoviewangle[x]!) >>> ANGLETOFINESHIFT;
    const texturecolumn = toInt32(rwOffset - fixedMul(finetangent[angle]!, rwDistance));
    return texturecolumn >> FRACBITS;
  };

  return {
    rwX,
    rwStopX,
    rwNormalangle,
    rwDistance,
    rwOffset,
    rwCenterangle,
    rwScale,
    rwScalestep,
    scale1,
    scale2,
    worldtop: worldtopRaw,
    worldbottom: worldbottomRaw,
    worldhigh,
    worldlow,
    midTexture,
    topTexture,
    bottomTexture,
    maskedTexture,
    segtextured,
    rwMidtexturemid,
    rwToptexturemid,
    rwBottomtexturemid,
    markFloor,
    markCeiling,
    silhouette,
    bsilheight,
    tsilheight,
    sprTopClip,
    sprBottomClip,
    topFrac,
    topStep,
    bottomFrac,
    bottomStep,
    pixhigh,
    pixhighstep,
    pixlow,
    pixlowstep,
    lightnum,
    wallLightsIndex,
    textureColumnFor,
  };
}
