/**
 * Top-level frame render — Chocolate Doom 2.2.1 r_main.c
 * `R_RenderPlayerView` (wall + visplane path).
 *
 * Verbatim r_main.c control flow:
 *
 *   R_SetupFrame (player);
 *   R_ClearClipSegs ();
 *   R_ClearDrawSegs ();
 *   R_ClearPlanes ();
 *   R_ClearSprites ();
 *   NetUpdate ();
 *   R_RenderBSPNode (numnodes-1);
 *   NetUpdate ();
 *   R_DrawPlanes ();
 *   NetUpdate ();
 *   R_DrawMasked ();
 *   NetUpdate ();
 *
 * This module composes the committed bit-exact pieces in that exact
 * order (the ordering is parity-relevant — clears precede the BSP
 * walk, the walk precedes the plane flush): {@link setupFrame}
 * (R_SetupFrame) → {@link clearClipSegs} (R_ClearClipSegs) →
 * {@link clearPlanes} (R_ClearPlanes) → {@link renderBspNode}
 * (R_RenderBSPNode) → {@link drawPlanes} (R_DrawPlanes).
 *
 * `NetUpdate` is single-player networking with no render effect and is
 * omitted. `R_ClearDrawSegs` / `R_ClearSprites` / `R_DrawMasked`
 * require the drawseg pool + sprite pipeline (a later increment, I6)
 * and are intentionally deferred — this is the wall + floor/ceiling
 * frame; masked midtextures and sprites are layered on next.
 *
 * The per-subsector seg→wall pipeline (`R_Subsector` → `R_AddLine` →
 * clip → `R_StoreWallRange` → wall draw) and the per-plane sky/regular
 * renderers are bound by the caller via the `makeOnSubsector` /
 * `makeOnSkyPlane` / `makeOnRegularPlane` factories — the established
 * closure-injection pattern — so this module's sole responsibility
 * (the R_RenderPlayerView control flow + buffer-clear ordering) stays
 * pure and unit-testable. `bspWalk` / `planeFlush` are injected
 * (defaulting to the real committed implementations) for the same
 * reason.
 *
 * `makeOnSubsector` / `makeOnSkyPlane` / `makeOnRegularPlane` are
 * factories, not pre-built closures: vanilla `R_Subsector` reads the
 * globals `R_SetupFrame` / `R_ClearClipSegs` just assigned (`viewx` /
 * `viewy` / `viewangle` / `viewz`, the fresh `solidsegs` clip list),
 * and `R_DrawPlanes` reads the same `R_SetupFrame` view plus the
 * `R_ClearPlanes` `basexscale` / `baseyscale` (derived from
 * `viewangle`). The closure-injected visitor / plane renderers bind
 * those per-frame, so their factories are invoked *after* `setupFrame`
 * / `clearClipSegs` / `clearPlanes` and handed the resulting
 * {@link ViewFrame} (+ {@link ClipState} for the subsector visitor) —
 * the same precedent as the per-subsector store built after plane
 * selection.
 *
 * Pure with respect to its own state; the only effects are the
 * supplied closures and the `clearPlanes` reset of the caller-owned
 * visplane pool, exactly as vanilla mutates its globals.
 */

import type { Angle } from '../core/angle.ts';
import type { CheckBBoxView } from './checkBBox.ts';
import { drawPlanes } from './drawPlanes.ts';
import type { VisplaneRenderer } from './drawPlanes.ts';
import type { ProjectionAngleTables } from './renderInitTables.ts';
import { renderBspNode } from './renderBspNode.ts';
import type { RenderBspScene, SubsectorVisitor } from './renderBspNode.ts';
import { setupFrame } from './setupFrame.ts';
import type { SetupFramePlayer, ViewFrame } from './setupFrame.ts';
import { clearClipSegs } from './solidSegs.ts';
import type { ClipState } from './solidSegs.ts';
import { clearPlanes } from './visplanes.ts';
import type { VisplanePool } from './visplanes.ts';

/** Injectable BSP-walk / plane-flush (default to the committed pieces). */
export interface RenderPlayerViewHooks {
  readonly bspWalk?: (scene: RenderBspScene, view: CheckBBoxView, state: ClipState, onSubsector: SubsectorVisitor) => void;
  readonly planeFlush?: (pool: VisplanePool, skyFlatNum: number, onSkyPlane: VisplaneRenderer, onRegularPlane: VisplaneRenderer) => void;
  readonly viewangleoffset?: Angle;
}

/** The view transform + fresh clip state produced for this frame. */
export interface RenderPlayerViewResult {
  readonly frame: ViewFrame;
  readonly clipState: ClipState;
}

/**
 * r_main.c `R_RenderPlayerView` (wall + visplane path): set up the
 * frame, clear the clip-seg + visplane buffers, walk the BSP
 * front-to-back invoking `onSubsector` per subsector, then flush the
 * visplanes — in that exact vanilla order. `R_ClearDrawSegs` /
 * `R_ClearSprites` / `R_DrawMasked` (drawseg + sprite pipeline) are
 * deferred to I6.
 */
export function renderPlayerViewWalls(
  scene: RenderBspScene,
  player: SetupFramePlayer,
  projectionAngles: ProjectionAngleTables,
  visplanePool: VisplanePool,
  viewWidth: number,
  skyFlatNum: number,
  makeOnSubsector: (frame: ViewFrame, clipState: ClipState) => SubsectorVisitor,
  makeOnSkyPlane: (frame: ViewFrame) => VisplaneRenderer,
  makeOnRegularPlane: (frame: ViewFrame) => VisplaneRenderer,
  hooks: RenderPlayerViewHooks = {},
): RenderPlayerViewResult {
  const bspWalk = hooks.bspWalk ?? renderBspNode;
  const planeFlush = hooks.planeFlush ?? drawPlanes;

  const frame = setupFrame(player, hooks.viewangleoffset ?? 0); // R_SetupFrame
  const clipState = clearClipSegs(viewWidth); // R_ClearClipSegs
  clearPlanes(visplanePool); // R_ClearPlanes
  // R_ClearDrawSegs / R_ClearSprites: deferred (drawseg pool + sprites = I6).

  const view: CheckBBoxView = {
    viewx: frame.viewx,
    viewy: frame.viewy,
    viewangle: frame.viewangle,
    clipangle: projectionAngles.clipangle,
    viewangletox: projectionAngles.viewangletox,
  };

  // R_Subsector / R_DrawPlanes read the globals just set by
  // R_SetupFrame / R_ClearClipSegs / R_ClearPlanes (the plane drawers
  // need viewangle / viewz / basexscale exactly as R_ClearPlanes
  // derived them) — bind the per-frame visitor + plane renderers here.
  const onSubsector = makeOnSubsector(frame, clipState);
  const onSkyPlane = makeOnSkyPlane(frame);
  const onRegularPlane = makeOnRegularPlane(frame);

  bspWalk(scene, view, clipState, onSubsector); // R_RenderBSPNode(numnodes-1)
  planeFlush(visplanePool, skyFlatNum, onSkyPlane, onRegularPlane); // R_DrawPlanes
  // R_DrawMasked: deferred (masked midtextures + drawsegs/sprites = I6).

  return Object.freeze({ frame, clipState });
}
