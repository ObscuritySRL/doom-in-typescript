/**
 * Wall draw-context binding — the Chocolate Doom 2.2.1 r_segs.c
 * `R_RenderSegLoop` screen / `ceilingclip` / `floorclip` globals bound
 * into the {@link SolidWallDrawer} / {@link TwoSidedWallDrawer}
 * closures the I4d {@link makeSegStoreFactory} consumes.
 *
 * The committed {@link renderSolidWall} / {@link renderTwoSidedWall}
 * are the bit-exact `R_RenderSegLoop` one-sided / two-sided pixel
 * passes; each takes the per-frame draw context (framebuffer +
 * `viewheight` / `centery` + the `ceilingclip` / `floorclip` arrays it
 * mutates in place). `renderSeg` dispatches through the
 * `(seg) => void` drawer closures, so the per-frame context must be
 * captured once and threaded in. This is that capture — a single
 * {@link WallDrawContext} (both render contexts have the identical
 * shape) bound into both closures.
 *
 * Pure composition glue: the framebuffer and clip arrays are
 * caller-owned (vanilla globals) and mutated in place by the committed
 * renderers; this only fixes the closure form. No Win32 or runtime
 * dependencies.
 */

import type { SolidWallDrawer, TwoSidedWallDrawer } from './renderSeg.ts';
import { renderSolidWall } from './solidWalls.ts';
import type { SolidWallSegment } from './solidWalls.ts';
import { renderTwoSidedWall } from './twoSidedWalls.ts';
import type { TwoSidedWallSegment } from './twoSidedWalls.ts';

/**
 * The per-frame screen + clip state both wall passes write
 * (structurally the shared `SolidWallRenderContext` /
 * `TwoSidedWallRenderContext`).
 */
export interface WallDrawContext {
  /** Palette-indexed framebuffer (mutated in place by the column draws). */
  readonly framebuffer: Uint8Array;
  /** Framebuffer row stride; omit for the vanilla 320-wide framebuffer. */
  readonly screenWidth?: number;
  /** Active viewport `viewheight`. */
  readonly viewHeight: number;
  /** Active viewport `centery`. */
  readonly centerY: number;
  /** `short ceilingclip[SCREENWIDTH]` — mutated in place. */
  readonly ceilingClip: Int16Array;
  /** `short floorclip[SCREENWIDTH]` — mutated in place. */
  readonly floorClip: Int16Array;
}

/** The bound one-sided / two-sided wall drawer closures. */
export interface WallDrawers {
  readonly drawSolid: SolidWallDrawer;
  readonly drawTwoSided: TwoSidedWallDrawer;
}

/** Optional DI hooks (default to the committed bit-exact pixel passes). */
export interface WallDrawersHooks {
  readonly renderSolidWallFn?: typeof renderSolidWall;
  readonly renderTwoSidedWallFn?: typeof renderTwoSidedWall;
}

/**
 * Bind one per-frame {@link WallDrawContext} into the
 * `drawSolid` / `drawTwoSided` closures `makeSegStoreFactory` /
 * `renderSeg` dispatch through.
 *
 * @example
 * ```ts
 * const { drawSolid, drawTwoSided } = makeWallDrawers({ framebuffer, viewHeight, centerY, ceilingClip, floorClip });
 * const segStore = makeSegStoreFactory(scene, flatNum, texNum, view, textures, resolve, drawSolid, drawTwoSided);
 * ```
 */
export function makeWallDrawers(ctx: WallDrawContext, hooks: WallDrawersHooks = {}): WallDrawers {
  const solid = hooks.renderSolidWallFn ?? renderSolidWall;
  const twoSided = hooks.renderTwoSidedWallFn ?? renderTwoSidedWall;

  return {
    drawSolid: (seg: SolidWallSegment): void => {
      solid(seg, ctx);
    },
    drawTwoSided: (seg: TwoSidedWallSegment): void => {
      twoSided(seg, ctx);
    },
  };
}
