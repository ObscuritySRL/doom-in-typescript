/**
 * Vanilla DOOM 1.9 visplane renderer runtime resources.
 *
 * Plan_final step `06-003` (lane: render) wires the floor and ceiling
 * visplane pool, the per-frame clear operation, the find/check
 * allocator surface, the span cache, and the span-flush walker into a
 * single frozen runtime artifact downstream BSP / wall renderer steps
 * consume.  The wrapper imports the read-only
 * {@link createVisplanePool} / {@link clearPlanes} / {@link findPlane}
 * / {@link checkPlane} surface from `src/render/visplanes.ts` plus the
 * {@link createPlaneSpanCache} / {@link renderVisplaneSpans} surface
 * from `src/render/visplaneSpans.ts` without modifying either.
 *
 * Pipeline (matches Chocolate Doom 2.2.1 `R_ClearPlanes` then
 * `R_DrawPlanes` plus the per-segment `R_FindPlane`/`R_CheckPlane`
 * calls):
 *
 *   1. The wrapper owns a single {@link VisplanePool} sized to the
 *      framebuffer width inherited from the launch's view setup.
 *   2. The wrapper owns a single {@link PlaneSpanCache} sized to the
 *      framebuffer height; the cache is reused across frames so the
 *      same `Int32Array` backing store survives the per-frame clear
 *      cycle (vanilla `r_plane.c` allocates these arrays at
 *      `R_InitPlanes` time, not per frame).
 *   3. `clear()` invokes {@link clearPlanes} — the per-frame
 *      `R_ClearPlanes` reset that empties the pool's active count and
 *      restores every plane's `minx = screenWidth, maxx = -1, top =
 *      0xff` sentinel state.
 *   4. `find(...)` and `check(...)` route through the read-only
 *      {@link findPlane} and {@link checkPlane} allocator helpers.
 *   5. `renderSpans(plane, ctx)` walks the plane's column writes via
 *      {@link renderVisplaneSpans}.
 *
 * Overflow on `MAXVISPLANES = 128` surfaces as `RangeError` from the
 * read-only allocator helpers; the wrapper does not catch the error
 * (vanilla's `I_Error` fatal path is the canonical behavior).
 *
 * The artifact performs no filesystem I/O and never touches the FFI
 * surface.  The pool / cache state is mutable per-frame; the wrapper
 * exposes a {@link Object.freeze}d top-level interface but the pool
 * and cache references inside it are the same vanilla-style mutable
 * objects every renderer step consumes.
 *
 * @example
 * ```ts
 * import { createVisplaneRenderer } from './visplaneRenderer.ts';
 *
 * const renderer = createVisplaneRenderer({ screenWidth: 320, viewHeight: 200 });
 * renderer.clear();
 * const ceiling = renderer.find(128 << 16, 0, 200, 2);
 * renderer.check(ceiling, 16, 287);
 * ```
 */

import type { PlaneSpanCache, VisplaneSpanContext } from '../render/visplaneSpans.ts';
import { createPlaneSpanCache, renderVisplaneSpans } from '../render/visplaneSpans.ts';
import type { VisplanePool } from '../render/visplanes.ts';
import { MAXVISPLANES, checkPlane, clearPlanes, createVisplanePool, findPlane } from '../render/visplanes.ts';
import type { Visplane } from '../render/renderLimits.ts';

/** Canonical visplane pool depth (`MAXVISPLANES` from r_plane.c). */
export const VANILLA_MAXVISPLANES = MAXVISPLANES;

/**
 * Options for {@link createVisplaneRenderer}.  `screenWidth` and
 * `viewHeight` size the per-frame top / bottom arrays inside the
 * visplane pool and the span-cache `spanstart` buffer; in practice
 * both are inherited from the launch's view setup
 * ({@link resolveVanillaViewSetup}).
 */
export interface VisplaneRendererOptions {
  readonly screenWidth: number;
  readonly viewHeight: number;
}

/**
 * Frozen runtime artifact assembled by {@link createVisplaneRenderer}.
 *
 * The `pool` and `spanCache` references are mutable per-frame state
 * (vanilla's `visplanes[]` and `spanstart[]` arrays are file-scope
 * globals zeroed by `R_ClearPlanes` once per frame); the wrapper
 * itself is frozen so downstream subsystems cannot replace the
 * references.
 */
export interface VisplaneRenderer {
  readonly check: (plane: Visplane, start: number, stop: number) => Visplane;
  readonly clear: () => void;
  readonly find: (height: number, picnum: number, lightlevel: number, skyFlatNum: number) => Visplane;
  readonly pool: VisplanePool;
  readonly renderSpans: (plane: Visplane, context: VisplaneSpanContext) => void;
  readonly spanCache: PlaneSpanCache;
}

/**
 * Build a fresh {@link VisplaneRenderer} sized to the supplied
 * `screenWidth` and `viewHeight`.  The visplane pool is sized to the
 * canonical {@link VANILLA_MAXVISPLANES} = 128 slots, matching
 * `r_plane.c MAXVISPLANES`.  Every per-plane `top`/`bottom` array is
 * sized to `screenWidth` and seeded with the empty-plane sentinel
 * (`top[x] = 0xff`, `minx = screenWidth`, `maxx = -1`).
 *
 * @param options Viewport dimensions inherited from the launch's
 *   view-setup artifact.
 * @returns A frozen renderer surface ready to be wired into the BSP
 *   walk and the per-frame `R_DrawPlanes` pass.
 *
 * @example
 * ```ts
 * import { resolveVanillaViewSetup } from './viewSetup.ts';
 * import { createVisplaneRenderer } from './visplaneRenderer.ts';
 *
 * const setup = resolveVanillaViewSetup(11, 0);
 * const renderer = createVisplaneRenderer({
 *   screenWidth: setup.viewport.viewWidth,
 *   viewHeight: setup.viewport.viewHeight,
 * });
 * ```
 */
export function createVisplaneRenderer(options: VisplaneRendererOptions): VisplaneRenderer {
  const pool = createVisplanePool({ screenWidth: options.screenWidth });
  const spanCache = createPlaneSpanCache(options.viewHeight);
  return Object.freeze({
    check: (plane: Visplane, start: number, stop: number): Visplane => checkPlane(pool, plane, start, stop),
    clear: (): void => clearPlanes(pool),
    find: (height: number, picnum: number, lightlevel: number, skyFlatNum: number): Visplane => findPlane(pool, height, picnum, lightlevel, skyFlatNum),
    pool,
    renderSpans: (plane: Visplane, context: VisplaneSpanContext): void => renderVisplaneSpans(plane, context),
    spanCache,
  });
}
