/**
 * Assembled `R_RenderPlayerView` — the final composition wiring every
 * committed assembled-renderer module into a single per-frame
 * `(player) → RenderPlayerViewResult` call (Chocolate Doom 2.2.1
 * r_main.c `R_RenderPlayerView`, wall + visplane path).
 *
 * Vanilla builds level-static module state at `P_SetupLevel`
 * (`R_InitTextures`, the BSP / seg / subsector arrays, the COLORMAP),
 * then `R_RenderPlayerView` runs per frame. This mirrors that split:
 * the {@link makeAssembledOnSubsector} wall factory and the
 * {@link makeAssembledPlaneRenderers} plane factory are built once from
 * the level/viewport config; the returned function performs only the
 * per-frame {@link renderPlayerViewWalls} call (which itself does
 * `R_SetupFrame` → `R_ClearClipSegs` → `R_ClearPlanes` →
 * `R_RenderBSPNode` → `R_DrawPlanes` and invokes the frame-bound
 * factories in vanilla order).
 *
 * `renderPlayerViewWalls` calls `makeOnSkyPlane(frame)` and
 * `makeOnRegularPlane(frame)` back-to-back with the same per-frame
 * {@link ViewFrame}; the assembled plane factory derives both drawers
 * together, so a single-entry frame memo builds them once per frame
 * (deterministic — keyed by the frame object identity
 * `renderPlayerViewWalls` produces).
 *
 * Pure; no Win32 or runtime dependencies. Asset / map loading (the WAD
 * I/O that produces the config) is the caller's concern, keeping this
 * the final pure composition over independently committed + tested
 * modules.
 */

import { makeAssembledOnSubsector } from './assembledOnSubsector.ts';
import type { AssembledOnSubsectorConfig } from './assembledOnSubsector.ts';
import { makeAssembledPlaneRenderers } from './assembledPlaneRenderers.ts';
import type { AssembledPlaneRenderers, AssembledPlaneRenderersConfig, AssembledPlaneRenderersHooks } from './assembledPlaneRenderers.ts';
import type { RenderBspScene } from './renderBspNode.ts';
import { renderPlayerViewWalls } from './renderPlayerView.ts';
import type { RenderPlayerViewHooks, RenderPlayerViewResult } from './renderPlayerView.ts';
import type { ProjectionAngleTables } from './renderInitTables.ts';
import type { SetupFramePlayer, ViewFrame } from './setupFrame.ts';
import type { VisplanePool } from './visplanes.ts';

/** The level/viewport inputs the assembled frame renderer binds once. */
export interface AssembledPlayerFrameConfig {
  /** BSP slice (`nodes` + `subsectorCount`) `R_RenderBSPNode` walks. */
  readonly scene: RenderBspScene;
  /** I1 projection angle tables (`clipangle` / `viewangletox` / `xtoviewangle`). */
  readonly projectionAngles: ProjectionAngleTables;
  /** Caller-owned visplane pool (vanilla `visplanes`). */
  readonly visplanePool: VisplanePool;
  /** Active viewport pixel width (`viewwidth`). */
  readonly viewWidth: number;
  /** Flat number meaning "sky" (`skyflatnum`). */
  readonly skyflatnum: number;
  /** The assembled wall-path config (`makeAssembledOnSubsector`). */
  readonly onSubsector: AssembledOnSubsectorConfig;
  /** The assembled plane-path config (`makeAssembledPlaneRenderers`). */
  readonly planes: AssembledPlaneRenderersConfig;
  /** Optional R_RenderPlayerView control-flow hooks. */
  readonly renderHooks?: RenderPlayerViewHooks;
  /** Optional plane DI hooks (pass through to the committed passes). */
  readonly planeHooks?: AssembledPlaneRenderersHooks;
}

/**
 * Build the per-frame assembled `R_RenderPlayerView`. Call the result
 * once per frame with the player; the level-static factories are built
 * here, once.
 *
 * @example
 * ```ts
 * const renderFrame = makeAssembledPlayerFrameRenderer(config);
 * const { frame, clipState } = renderFrame(player); // each tic
 * ```
 */
export function makeAssembledPlayerFrameRenderer(config: AssembledPlayerFrameConfig): (player: SetupFramePlayer) => RenderPlayerViewResult {
  const makeOnSubsector = makeAssembledOnSubsector(config.onSubsector);
  const makePlanes = makeAssembledPlaneRenderers(config.planes, config.planeHooks);

  // renderPlayerViewWalls asks for sky then regular with the same frame;
  // derive both once per frame (single-entry identity memo).
  let cachedFrame: ViewFrame | null = null;
  let cachedPlanes: AssembledPlaneRenderers | null = null;
  const planesFor = (frame: ViewFrame): AssembledPlaneRenderers => {
    if (frame !== cachedFrame || cachedPlanes === null) {
      cachedFrame = frame;
      cachedPlanes = makePlanes(frame);
    }
    return cachedPlanes;
  };

  return (player: SetupFramePlayer): RenderPlayerViewResult =>
    renderPlayerViewWalls(
      config.scene,
      player,
      config.projectionAngles,
      config.visplanePool,
      config.viewWidth,
      config.skyflatnum,
      makeOnSubsector,
      (frame: ViewFrame) => planesFor(frame).onSkyPlane,
      (frame: ViewFrame) => planesFor(frame).onRegularPlane,
      config.renderHooks ?? {},
    );
}
