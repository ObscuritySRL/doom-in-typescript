/**
 * Sprite projection — r_things.c `R_ProjectSprite` / `R_NewVisSprite` /
 * `R_ClearSprites` plus the `MINZ` + `MAXVISSPRITES` + `FF_FRAMEMASK` +
 * `FF_FULLBRIGHT` constants the rest of the sprite pipeline consumes.
 *
 * Each {@link ProjectableThing} (vanilla `mobj_t`) in a sector's thing
 * list becomes at most one {@link VisSprite} record per frame.  Vanilla
 * walks the BSP, calls `R_AddSprites(sec)` for every subsector's
 * `frontsector`, and that wrapper iterates the sector's `thinglist`
 * calling `R_ProjectSprite` for each entry.  `R_ProjectSprite` performs
 * six sequential rejection tests followed by one allocation + fill-in
 * step; if any rejection fires the mobj contributes zero pixels to the
 * frame.
 *
 * Parity invariants locked here:
 *
 * - {@link MINZ} = `FRACUNIT * 4` = `0x40000`.  r_things.c.  Any sprite
 *   whose view-space `tz` is below this cut-off is behind or flush with
 *   the near clip plane and silently rejected.  `tz` is computed as
 *   `gxt - gyt` where `gxt = FixedMul(tr_x, viewcos)` and `gyt =
 *   -FixedMul(tr_y, viewsin)`; a positive `tz` means the mobj is in
 *   front of the viewer.
 * - {@link MAXVISSPRITES} = `128`.  r_things.c (vanilla literal, not a
 *   named `#define` in this source tree — it is inlined wherever the
 *   pool is declared: `vissprite_t vissprites[MAXVISSPRITES]`, and
 *   `R_NewVisSprite` returns a shared `&overflowsprite` slot once the
 *   pool is full).  Hitting overflow is NOT a fatal error — vanilla
 *   silently drops sprite writes into the single overflow slot, so the
 *   last projected sprite each frame may stomp earlier overflow
 *   sprites' scratch data before they are consumed.
 * - {@link FF_FRAMEMASK} = `0x7FFF` (p_pspr.h).  `frame & FF_FRAMEMASK`
 *   isolates the low-15-bit frame index inside `spriteframes[]`.
 * - {@link FF_FULLBRIGHT} = `0x8000` (p_pspr.h).  Bit 15 of `frame`;
 *   when set the sprite uses the full-bright colormap row regardless
 *   of sector lightlevel, matching weapon muzzle flashes and
 *   `A_BFGSpray` frames.
 * - View-space transform is {@link projectSprite}'s opening lines:
 *   `tr_x = thing.x - viewX`, `tr_y = thing.y - viewY`, and the two
 *   matrix products `gxt/gyt` that produce the view-space `(tz, tx)`
 *   pair.  The `gyt = -FixedMul(tr_y, viewsin)` negation matters — the
 *   camera's `sin(viewAngle)` is negated so the subsequent `tz = gxt -
 *   gyt` reads as a forward-axis projection.  The second pair flips
 *   signs again: `gxt = -FixedMul(tr_x, viewsin)` and `gyt =
 *   FixedMul(tr_y, viewcos)`, then `tx = -(gyt + gxt)`.  The net effect
 *   is a 2×2 rotation that rotates the world by `-viewAngle`.
 * - The `abs(tx) > tz << 2` early-reject is vanilla's fast FOV cull: a
 *   sprite whose horizontal view-space coordinate exceeds 4× its
 *   depth is beyond the projected 90-degree view cone (`tan(45°) = 1`
 *   with a 4× fudge factor baked into the vanilla constant).  The cut
 *   happens BEFORE sprite-patch lookup so rejected sprites never cost
 *   a dictionary access.
 * - Sprite rotation selection: when `sprframe.rotate === true` the
 *   function computes `ang = R_PointToAngle(thing.x, thing.y)` (the
 *   world-to-mobj angle from the view origin) and then
 *   `rot = ((ang - thing.angle + (ANG45/2)*9) >>> 29) & 7`.  The
 *   `>>> 29` is UNSIGNED (`>>>` in JS, logical shift in C); the full
 *   32-bit `angle_t` wraparound produces a 3-bit index `0..7`.  The
 *   `(ANG45/2)*9` = `0x90000000` offset biases the reduction so the
 *   eight 45-degree sectors center on the canonical sprite poses.
 *   When `sprframe.rotate === false`, vanilla uses slot 0 regardless
 *   of angle.
 * - `x1` / `x2` screen-space edges: `x1 = (centerXFrac + FixedMul(tx,
 *   xscale)) >> FRACBITS` after subtracting `spriteOffset[lump]` from
 *   `tx`; `x2 = ((centerXFrac + FixedMul(tx, xscale)) >> FRACBITS) -
 *   1` after adding `spriteWidth[lump]`.  Rejects fire when `x1 >
 *   viewWidth` (off right) or `x2 < 0` (off left).  The `-1` on `x2`
 *   and the strict `x1 > viewWidth` (not `>=`) match vanilla.
 * - `vis.scale = xscale << detailShift` — low-detail mode doubles the
 *   per-column scale so the same world distance paints twice as many
 *   screen columns.  The shift is signed (`<<`), matching vanilla's
 *   `<<detailshift` on a signed int32.
 * - `vis.xIscale = FixedDiv(FRACUNIT, xscale)` negated when
 *   `sprframe.flip[rot]`.  Flipped sprites paint right-to-left from
 *   `startFrac = spriteWidth[lump] - 1`; non-flipped sprites paint
 *   left-to-right from `startFrac = 0`.
 * - Clip adjustment: `vis.x1 = max(0, x1)` and `vis.x2 = min(viewWidth
 *   - 1, x2)`.  When `vis.x1 > x1` (i.e. the sprite was clipped on the
 *   left), `vis.startFrac += vis.xIscale * (vis.x1 - x1)` so the
 *   first painted column samples the correct texture U.  The multiply
 *   is signed because `xIscale` may be negative (flipped sprite).
 * - Colormap selection priority: (1) `MF_SHADOW` → `null` (the
 *   fuzz/shadow draw path ignores the colormap), (2) `fixedColormap`
 *   override (invulnerability or light-amp goggles) → that row,
 *   (3) `FF_FULLBRIGHT` frame → `colormaps` (full-bright row 0 of the
 *   COLORMAP lump), (4) otherwise `spriteLights[index]` where
 *   `index = xscale >> (LIGHTSCALESHIFT - detailShift)` clamped to
 *   `MAXLIGHTSCALE - 1`.  The shift `(12 - detailShift)` means low
 *   detail effectively halves the scale-to-light mapping so
 *   light-diminishing ramps the same way in both detail modes.
 *
 * This module is pure arithmetic with no Win32, renderer-draw, or
 * runtime dependencies.  The caller owns the sprite tables
 * ({@link SpriteDef}[] + {@link SpriteMetrics}) and the view-frame
 * state ({@link SpriteProjectionContext}); {@link projectSprite}
 * populates the next pool slot via {@link newVisSprite} and returns
 * the same reference (or `null` for a rejected sprite).
 *
 * @example
 * ```ts
 * import { createVisSpritePool, projectSprite } from "../src/render/spriteProjection.ts";
 *
 * const pool = createVisSpritePool();
 * const vis = projectSprite(player, ctx, pool);
 * if (vis !== null) {
 *   // Pass vis to the sort/clip/draw stage (step 13-012).
 * }
 * ```
 */

import type { Angle } from '../core/angle.ts';
import { ANG90, ANG180, ANG270, angleWrap } from '../core/angle.ts';
import { FRACBITS, FRACUNIT, fixedDiv, fixedMul } from '../core/fixed.ts';
import { slopeDiv, tantoangle } from '../core/trig.ts';

import { LIGHTSCALESHIFT, MAXLIGHTSCALE } from './projection.ts';

/**
 * r_things.c `MINZ` — minimum view-space depth (`tz`) before a sprite
 * is considered in front of the near clip plane.  Any sprite with
 * `tz < MINZ` is silently rejected.
 */
export const MINZ = FRACUNIT * 4;

/**
 * r_things.c `MAXVISSPRITES` — capacity of the `vissprites[]` pool.
 * Vanilla declares `vissprite_t vissprites[MAXVISSPRITES]` and
 * returns a single shared `overflowsprite` once the pool is full.
 */
export const MAXVISSPRITES = 128;

/**
 * p_pspr.h `FF_FRAMEMASK` — mask that isolates the low-15-bit frame
 * index inside `spriteframes[]` before any `FF_FULLBRIGHT` bit.
 */
export const FF_FRAMEMASK = 0x7fff;

/**
 * p_pspr.h `FF_FULLBRIGHT` — bit 15 of `frame`.  When set the sprite
 * uses the full-bright colormap row regardless of sector lightlevel.
 */
export const FF_FULLBRIGHT = 0x8000;

/**
 * Per-lump sprite metric arrays mirroring r_data.c `spriteoffset` /
 * `spritewidth` / `spritetopoffset` globals.  Every entry is a fixed-
 * point value in 16.16 format; the arrays share the same index space
 * (one entry per patch lump loaded as a sprite).
 */
export interface SpriteMetrics {
  /** `spriteoffset[lump]` — fixed-point horizontal origin offset. */
  readonly offset: Int32Array;
  /** `spritetopoffset[lump]` — fixed-point vertical origin offset. */
  readonly topOffset: Int32Array;
  /** `spritewidth[lump]` — fixed-point patch width (pixels × FRACUNIT). */
  readonly width: Int32Array;
}

/**
 * Single frame entry in a sprite's `spriteframes[]` array.  Mirrors
 * r_defs.h `spriteframe_t`: eight rotation slots (0 = facing viewer,
 * 1 = CW 45°, ..., 7 = CCW 45°) plus a single-slot fallback when
 * `rotate === false`.
 */
export interface SpriteFrame {
  /**
   * When `true`, the eight rotation slots hold distinct patches and
   * {@link projectSprite} picks one based on the mobj's facing angle.
   * When `false`, slot 0 is the only valid slot and every view angle
   * renders the same patch.
   */
  readonly rotate: boolean;
  /**
   * Eight patch-lump indices (one per 45-degree rotation sector).
   * Indexed by the `rot` value {@link projectSprite} computes from the
   * view-to-mobj angle when `rotate === true`; otherwise only `lump[0]`
   * is read.
   */
  readonly lump: readonly number[];
  /**
   * Eight flip flags paired with {@link lump}.  `true` means the
   * corresponding patch is drawn right-to-left (horizontal mirror);
   * vanilla stores this as a `byte` where `1 === true`.
   */
  readonly flip: readonly boolean[];
}

/**
 * Sprite definition — `sprites[thing.sprite]` in vanilla r_state.c.
 * Holds the full set of animation frames for a single sprite type
 * (e.g. `SpriteNum.TROO` has frames for stand / walk / attack /
 * pain / death / raise).
 */
export interface SpriteDef {
  /** Number of valid entries in {@link frames} (vanilla `numframes`). */
  readonly numFrames: number;
  /** Frame table indexed `0..numFrames - 1` by `thing.frame & FF_FRAMEMASK`. */
  readonly frames: readonly SpriteFrame[];
}

/**
 * Vissprite record — the per-sprite scratch slot vanilla fills during
 * projection and the sort/clip stage consumes.  Mirrors r_defs.h
 * `vissprite_t`.  The doubly-linked `prev` / `next` pointers vanilla
 * uses for the distance-sorted list live in the pool layer (step
 * 13-012); this record holds only the projection outputs.
 */
export interface VisSprite {
  /** Leftmost framebuffer column (inclusive, clamped to `0`). */
  x1: number;
  /** Rightmost framebuffer column (inclusive, clamped to `viewWidth - 1`). */
  x2: number;
  /** World-space x (for sort / silhouette tests downstream). */
  gx: number;
  /** World-space y (for sort / silhouette tests downstream). */
  gy: number;
  /** World-space z (bottom / feet height). */
  gz: number;
  /** World-space z of the sprite top (= `thing.z + spriteTopOffset[lump]`). */
  gzt: number;
  /** Texture U coordinate at the first painted column. */
  startFrac: number;
  /** Per-column inverse depth (`xscale << detailShift`). */
  scale: number;
  /** Texture U step per screen column; negative when the sprite is flipped. */
  xIscale: number;
  /** `dc_texturemid` for the masked column draw (= `gzt - viewZ`). */
  textureMid: number;
  /** Patch-lump index selected from `sprframe.lump[rot]`. */
  patch: number;
  /**
   * 256-byte colormap row for the masked column draw, OR `null` when
   * the sprite uses the fuzz/shadow draw path (`MF_SHADOW`).  Vanilla
   * stores a `lighttable_t *` which is `NULL` for shadows and a
   * colormap-row pointer otherwise.
   */
  colormap: Uint8Array | null;
  /** Echo of `thing.flags` — the sort/clip step reads `MF_SHADOW` etc. */
  mobjFlags: number;
}

/**
 * Vissprite pool mirroring r_things.c `vissprites[]` + `vissprite_p` +
 * `overflowsprite`.  {@link count} tracks `vissprite_p - vissprites`
 * (the number of allocated slots); {@link overflow} is the shared
 * single-entry fallback vanilla returns once the pool is full.
 */
export interface VisSpritePool {
  /** Fixed-capacity vissprite ring sized to {@link MAXVISSPRITES}. */
  readonly sprites: readonly VisSprite[];
  /** Shared overflow slot returned by {@link newVisSprite} when full. */
  readonly overflow: VisSprite;
  /** Number of allocated sprites (vanilla `vissprite_p - vissprites`). */
  count: number;
}

/**
 * Per-thing inputs {@link projectSprite} reads.  Decoupled from
 * `Mobj` so unit tests can pass plain objects without instantiating
 * the full thinker class.  Every field is the same type as the
 * corresponding `mobj_t` member in p_mobj.h.
 */
export interface ProjectableThing {
  /** Fixed-point world x. */
  readonly x: number;
  /** Fixed-point world y. */
  readonly y: number;
  /** Fixed-point world z (feet). */
  readonly z: number;
  /** BAM facing angle — only read when `sprframe.rotate === true`. */
  readonly angle: Angle;
  /** Sprite index (`mobj_t::sprite`, index into `sprites[]`). */
  readonly sprite: number;
  /** Frame index with {@link FF_FULLBRIGHT} bit merged in. */
  readonly frame: number;
  /** Mobj flags (only {@link MF_SHADOW_BIT} is read here). */
  readonly flags: number;
}

/**
 * Per-frame view + sprite-table state {@link projectSprite} consumes.
 * Mirrors the r_main.c + r_data.c + r_things.c globals the vanilla
 * function reads during a single projection call.
 */
export interface SpriteProjectionContext {
  /** `viewx` global — fixed-point view origin x. */
  readonly viewX: number;
  /** `viewy` global — fixed-point view origin y. */
  readonly viewY: number;
  /** `viewz` global — fixed-point view origin z. */
  readonly viewZ: number;
  /** `viewcos` global — fixed-point cosine of view angle. */
  readonly viewCos: number;
  /** `viewsin` global — fixed-point sine of view angle. */
  readonly viewSin: number;
  /** `projection` global (= `centerxfrac`). */
  readonly projection: number;
  /** `centerxfrac` global — viewport horizontal center in 16.16. */
  readonly centerXFrac: number;
  /** `viewwidth` global — current viewport pixel width. */
  readonly viewWidth: number;
  /** `detailshift` global — `0` for high detail, `1` for low detail. */
  readonly detailShift: number;
  /** `sprites[]` global indexed by {@link ProjectableThing.sprite}. */
  readonly sprites: readonly SpriteDef[];
  /** Per-lump sprite metric arrays (`spriteoffset`/`spritewidth`/`spritetopoffset`). */
  readonly spriteMetrics: SpriteMetrics;
  /**
   * `fixedcolormap` global — `null` in the default case, a 256-byte
   * row when invulnerability or light-amp goggles are active.
   * Overrides per-sprite diminishing.
   */
  readonly fixedColormap: Uint8Array | null;
  /**
   * `spritelights` global — the 48-row diminishing LUT slice for the
   * current sector (`scalelight[lightnum]`).  {@link projectSprite}
   * indexes `[0..MAXLIGHTSCALE - 1]`.
   */
  readonly spriteLights: readonly Uint8Array[];
  /**
   * `colormaps` global — row 0 of the COLORMAP lump (full-bright).
   * Used when `FF_FULLBRIGHT` is set on the frame.
   */
  readonly colormaps: Uint8Array;
}

const MF_SHADOW_BIT = 0x40000;

const ROTATION_BIAS = 0x90000000 | 0;

function emptyVisSprite(): VisSprite {
  return {
    x1: 0,
    x2: 0,
    gx: 0,
    gy: 0,
    gz: 0,
    gzt: 0,
    startFrac: 0,
    scale: 0,
    xIscale: 0,
    textureMid: 0,
    patch: 0,
    colormap: null,
    mobjFlags: 0,
  };
}

/**
 * Allocate a {@link VisSpritePool} with {@link MAXVISSPRITES} slots
 * plus a single {@link VisSpritePool.overflow} sentinel slot.  Every
 * slot starts zero-initialized; the pool's `count` is `0`.  The
 * pool's `sprites` array is frozen — callers never replace or
 * resize it.
 *
 * @example
 * ```ts
 * import { createVisSpritePool } from "../src/render/spriteProjection.ts";
 * const pool = createVisSpritePool();
 * pool.sprites.length; // 128
 * pool.count;          // 0
 * ```
 */
export function createVisSpritePool(): VisSpritePool {
  const sprites: VisSprite[] = [];
  for (let i = 0; i < MAXVISSPRITES; i += 1) {
    sprites.push(emptyVisSprite());
  }
  return { sprites: Object.freeze(sprites), overflow: emptyVisSprite(), count: 0 };
}

/**
 * `R_ClearSprites` — reset the pool's `count` to `0` at the start of
 * each frame so the next {@link newVisSprite} allocation reuses slot
 * `0`.  Stale fields in the previously-used slots are NOT zeroed; a
 * new allocation overwrites every field {@link projectSprite} reads
 * so the stale data is never observed.
 */
export function clearSprites(pool: VisSpritePool): void {
  pool.count = 0;
}

/**
 * `R_NewVisSprite` — return the next empty vissprite slot and
 * advance the pool's `count`.  When the pool is full, returns the
 * shared {@link VisSpritePool.overflow} slot instead — vanilla does
 * the same and relies on the caller to not cache pointers across
 * frames.
 */
export function newVisSprite(pool: VisSpritePool): VisSprite {
  if (pool.count === MAXVISSPRITES) {
    return pool.overflow;
  }
  const vis = pool.sprites[pool.count]!;
  pool.count += 1;
  return vis;
}

/**
 * R_PointToAngle equivalent on a pre-subtracted `(dx, dy)` vector.
 * Matches r_main.c `R_PointToAngle` modulo the built-in
 * `x -= viewx; y -= viewy;` preamble — callers pass the
 * already-relative coordinates.
 */
function pointToAngleFromView(dx: number, dy: number): Angle {
  if (dx === 0 && dy === 0) {
    return 0;
  }
  if (dx >= 0) {
    if (dy >= 0) {
      if (dx > dy) {
        return tantoangle[slopeDiv(dy, dx)]!;
      }
      return angleWrap(ANG90 - 1 - tantoangle[slopeDiv(dx, dy)]!);
    }
    const absY = -dy;
    if (dx > absY) {
      return angleWrap(-tantoangle[slopeDiv(absY, dx)]!);
    }
    return angleWrap(ANG270 + tantoangle[slopeDiv(dx, absY)]!);
  }
  const absX = -dx;
  if (dy >= 0) {
    if (absX > dy) {
      return angleWrap(ANG180 - 1 - tantoangle[slopeDiv(dy, absX)]!);
    }
    return angleWrap(ANG90 + tantoangle[slopeDiv(absX, dy)]!);
  }
  const absY = -dy;
  if (absX > absY) {
    return angleWrap(ANG180 + tantoangle[slopeDiv(absY, absX)]!);
  }
  return angleWrap(ANG270 - 1 - tantoangle[slopeDiv(absX, absY)]!);
}

/**
 * `R_ProjectSprite` — project a single mobj into a {@link VisSprite}
 * or return `null` if the mobj is culled.  The six rejection gates
 * fire in the vanilla order:
 *
 * 1. `tz < MINZ` — behind the near clip plane.
 * 2. `abs(tx) > tz << 2` — outside the ~90-degree FOV cone.
 * 3. `x1 > viewWidth` — off the right edge.
 * 4. `x2 < 0` — off the left edge.
 *
 * (The vanilla `RANGECHECK` sprite-index / frame-index guards
 * compile out in release builds and are not mirrored here — out-of-
 * range indices are caller bugs.)
 *
 * On a hit, {@link newVisSprite} allocates the next pool slot
 * (overflow slot once the pool is full), every field is written, and
 * the same reference is returned.  Callers consume the vissprite on
 * the same frame before {@link clearSprites} runs.
 *
 * @example
 * ```ts
 * import { projectSprite } from "../src/render/spriteProjection.ts";
 * const vis = projectSprite(troop, ctx, pool);
 * if (vis !== null) drawMaskedColumns(vis, ...);
 * ```
 */
export function projectSprite(thing: ProjectableThing, ctx: SpriteProjectionContext, pool: VisSpritePool): VisSprite | null {
  const trX = (thing.x - ctx.viewX) | 0;
  const trY = (thing.y - ctx.viewY) | 0;

  let gxt = fixedMul(trX, ctx.viewCos);
  let gyt = -fixedMul(trY, ctx.viewSin) | 0;
  const tz = (gxt - gyt) | 0;

  if (tz < MINZ) {
    return null;
  }

  const xscale = fixedDiv(ctx.projection, tz);

  gxt = -fixedMul(trX, ctx.viewSin) | 0;
  gyt = fixedMul(trY, ctx.viewCos);
  let tx = -(gyt + gxt) | 0;

  const txLimit = (tz << 2) | 0;
  if ((tx < 0 ? -tx | 0 : tx) > txLimit) {
    return null;
  }

  const spriteDef = ctx.sprites[thing.sprite]!;
  const frameIndex = thing.frame & FF_FRAMEMASK;
  const sprframe = spriteDef.frames[frameIndex]!;

  let lump: number;
  let flip: boolean;
  if (sprframe.rotate) {
    const ang = pointToAngleFromView(trX, trY);
    const rot = (((ang - thing.angle + ROTATION_BIAS) >>> 0) >>> 29) & 7;
    lump = sprframe.lump[rot]!;
    flip = sprframe.flip[rot]!;
  } else {
    lump = sprframe.lump[0]!;
    flip = sprframe.flip[0]!;
  }

  tx = (tx - ctx.spriteMetrics.offset[lump]!) | 0;
  const x1 = (ctx.centerXFrac + fixedMul(tx, xscale)) >> FRACBITS;
  if (x1 > ctx.viewWidth) {
    return null;
  }

  tx = (tx + ctx.spriteMetrics.width[lump]!) | 0;
  const x2 = ((ctx.centerXFrac + fixedMul(tx, xscale)) >> FRACBITS) - 1;
  if (x2 < 0) {
    return null;
  }

  const vis = newVisSprite(pool);
  vis.mobjFlags = thing.flags | 0;
  vis.scale = (xscale << ctx.detailShift) | 0;
  vis.gx = thing.x | 0;
  vis.gy = thing.y | 0;
  vis.gz = thing.z | 0;
  vis.gzt = (thing.z + ctx.spriteMetrics.topOffset[lump]!) | 0;
  vis.textureMid = (vis.gzt - ctx.viewZ) | 0;
  vis.x1 = x1 < 0 ? 0 : x1;
  vis.x2 = x2 >= ctx.viewWidth ? ctx.viewWidth - 1 : x2;
  vis.patch = lump | 0;

  const iscale = fixedDiv(FRACUNIT, xscale);
  if (flip) {
    vis.startFrac = (ctx.spriteMetrics.width[lump]! - 1) | 0;
    vis.xIscale = -iscale | 0;
  } else {
    vis.startFrac = 0;
    vis.xIscale = iscale | 0;
  }

  if (vis.x1 > x1) {
    vis.startFrac = (vis.startFrac + vis.xIscale * (vis.x1 - x1)) | 0;
  }

  if ((thing.flags & MF_SHADOW_BIT) !== 0) {
    vis.colormap = null;
  } else if (ctx.fixedColormap !== null) {
    vis.colormap = ctx.fixedColormap;
  } else if ((thing.frame & FF_FULLBRIGHT) !== 0) {
    vis.colormap = ctx.colormaps;
  } else {
    let index = xscale >> (LIGHTSCALESHIFT - ctx.detailShift);
    if (index >= MAXLIGHTSCALE) {
      index = MAXLIGHTSCALE - 1;
    }
    vis.colormap = ctx.spriteLights[index]!;
  }

  return vis;
}
