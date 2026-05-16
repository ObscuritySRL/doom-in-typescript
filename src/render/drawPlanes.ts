/**
 * End-of-frame visplane flush — Chocolate Doom 2.2.1 r_plane.c
 * `R_DrawPlanes`.
 *
 * `R_RenderPlayerView` calls `R_DrawPlanes` once per frame after the
 * BSP/seg pass has allocated every floor / ceiling visplane. This is
 * the pure orchestrator: walk the active visplane pool
 * (`for (pl = visplanes ; pl < lastvisplane ; pl++)`), skip empty
 * planes (`if (pl->minx > pl->maxx) continue;`), and dispatch each
 * remaining plane to the sky branch (`pl->picnum == skyflatnum`) or
 * the regular-flat branch — in pool order.
 *
 * The two branches are the already-committed bit-exact pieces
 * {@link renderSkyVisplane} (sky.ts) and {@link renderVisplaneSpans}
 * (visplaneSpans.ts). Their context records (`SkyRenderContext` /
 * `VisplaneSpanContext`) are bound by the caller via the
 * `onSkyPlane` / `onRegularPlane` closures — the same closure-injection
 * pattern the other renderer modules use — so this module's sole
 * responsibility (the per-frame walk + dispatch) stays pure and
 * unit-testable without the heavy render contexts. Production wiring
 * is `onSkyPlane = (pl) => renderSkyVisplane(pl, skyContext)` and
 * `onRegularPlane = (pl) => renderVisplaneSpans(pl, spanContext)`.
 *
 * The `#ifdef RANGECHECK` drawsegs/visplanes/openings overflow
 * `I_Error` guards are debug-build only; the release reference
 * (Chocolate Doom 2.2.1, the parity target) builds with RANGECHECK
 * undefined, so they are intentionally omitted to match the reference.
 *
 * Pure; no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * // renderSkyVisplane / renderVisplaneSpans are the committed bit-exact
 * // pieces; the caller binds their contexts via the dispatch closures.
 * drawPlanes(
 *   pool,
 *   skyFlatNum,
 *   (plane) => renderSkyVisplane(plane, skyContext),
 *   (plane) => renderVisplaneSpans(plane, spanContext),
 * );
 * ```
 */

import type { Visplane } from './renderLimits.ts';
import type { VisplanePool } from './visplanes.ts';

/** Per-plane dispatch callback (caller binds the render context). */
export type VisplaneRenderer = (plane: Visplane) => void;

/**
 * r_plane.c `R_DrawPlanes`: iterate the active visplanes
 * (`pool.planes[0 .. pool.count)` == `visplanes .. lastvisplane`),
 * `continue` past any with `minx > maxx`, and invoke `onSkyPlane` when
 * `plane.picnum === skyFlatNum`, else `onRegularPlane` — in pool
 * order.
 */
export function drawPlanes(pool: VisplanePool, skyFlatNum: number, onSkyPlane: VisplaneRenderer, onRegularPlane: VisplaneRenderer): void {
  for (let planeIndex = 0; planeIndex < pool.count; planeIndex += 1) {
    const plane = pool.planes[planeIndex]!;

    if (plane.minx > plane.maxx) {
      continue;
    }

    if (plane.picnum === skyFlatNum) {
      onSkyPlane(plane);
    } else {
      onRegularPlane(plane);
    }
  }
}
