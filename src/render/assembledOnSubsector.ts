/**
 * Assembled wall-render `makeOnSubsector` factory — the single
 * composition that wires every committed assembled-renderer module into
 * the `(frame, clipState) → SubsectorVisitor` factory
 * {@link renderPlayerViewWalls} invokes after `R_SetupFrame` /
 * `R_ClearClipSegs`.
 *
 * Chocolate Doom 2.2.1 keeps the texture catalog, COLORMAP-bound
 * `scalelight`, sub→sector / seg pointers, and screen / clip globals in
 * module state that `R_Subsector` → `R_StoreWallRange` read directly.
 * This pure builder is that wiring: the per-level / per-viewport pieces
 * (the {@link makeMapRenderAccessors} P_LoadSegs accessors, the
 * {@link makeTextureCatalog} composite catalog, the
 * {@link buildScalelightRows} light table, the {@link makeWallDrawers}
 * pixel-pass closures) are built once; the returned factory then derives
 * the per-frame view state from the {@link ViewFrame} `R_SetupFrame`
 * produced and binds the {@link makeSubsectorVisitor} visitor to *that*
 * frame's view + fresh clip list — mirroring vanilla's "R_Subsector
 * reads the globals R_SetupFrame just set".
 *
 * `fixedcolormap` (invuln / light-amp) overrides `walllights` with
 * `scalelightfixed` (the fixed colormap row replicated `MAXLIGHTSCALE`
 * times); that row is threaded as `targets.fixedColormapRow` only when
 * `R_SetupFrame` flagged a fixed colormap — on the E1M1-spawn route
 * (13-003's target) `player->fixedcolormap == 0`, so it stays `null`
 * and the distance-lit `scalelight[lightnum]` path is used, with no
 * fabricated value.
 *
 * Pure; no Win32 or runtime dependencies. Every composed piece is an
 * independently committed + tested module.
 */

import type { TextureDefinition } from '../assets/texture1.ts';

import type { ClipState } from './solidSegs.ts';
import { makeMapRenderAccessors } from './mapRenderAccessors.ts';
import type { MapRenderTables } from './mapRenderAccessors.ts';
import { MAXLIGHTSCALE } from './projection.ts';
import type { Viewport } from './projection.ts';
import type { ProjectionAngleTables } from './renderInitTables.ts';
import type { SubsectorVisitor } from './renderBspNode.ts';
import { makeResolveRenderSegDeps } from './resolveRenderSegDeps.ts';
import type { RenderSubsectorResult, RenderSubsectorView } from './renderSubsector.ts';
import { buildScalelightRows } from './scalelightRows.ts';
import { makeSegStoreFactory } from './segStoreFactory.ts';
import type { FlatNumberResolver, SegRenderScene, TextureNumberResolver } from './segRenderModel.ts';
import type { ViewFrame } from './setupFrame.ts';
import type { StoreWallRangeTextures, StoreWallRangeView } from './storeWallRange.ts';
import { makeSubsectorVisitor } from './subsectorVisitor.ts';
import { makeTextureCatalog } from './textureCatalog.ts';
import type { VisplanePool } from './visplanes.ts';
import { makeWallDrawers } from './wallDrawers.ts';
import type { WallDrawContext } from './wallDrawers.ts';
import type { PatchByName } from './wallPatchPlacements.ts';

/** The per-level / per-viewport inputs the assembled wall renderer binds. */
export interface AssembledOnSubsectorConfig {
  /** Parsed map lump tables (P_LoadSegs / P_GroupLines source). */
  readonly map: MapRenderTables;
  /** `R_FlatNumForName` (sector pic → flat number). */
  readonly flatNumber: FlatNumberResolver;
  /** `R_TextureNumForName` (sidedef name → texture number). */
  readonly textureNumber: TextureNumberResolver;
  /** Map seg / sidedef / sector / vertex tables {@link makeSegStoreFactory} reads. */
  readonly segScene: SegRenderScene;
  /** Combined `TEXTURE1`(+`TEXTURE2`) definitions (index = texture number). */
  readonly orderedDefinitions: readonly TextureDefinition[];
  /** `PNAMES` patch-name array. */
  readonly pnames: readonly string[];
  /** `W_CheckNumForName` + decoded-patch cache. */
  readonly patchByName: PatchByName;
  /** Loaded 32-ramp COLORMAP (`>= NUMCOLORMAPS` ramps). */
  readonly colormaps: readonly Uint8Array[];
  /** Active viewport (scale-light + projection state). */
  readonly viewport: Viewport;
  /** I1 projection angle tables (`clipangle` / `viewangletox` / `xtoviewangle`). */
  readonly projectionAngles: ProjectionAngleTables;
  /** Flat number meaning "sky" (`skyflatnum`). */
  readonly skyflatnum: number;
  /** Caller-owned visplane pool (vanilla `visplanes`). */
  readonly pool: VisplanePool;
  /** Per-frame screen + clip arrays the pixel passes mutate. */
  readonly drawContext: WallDrawContext;
  /** Optional `texturetranslation` / `textureheight` indirection (defaults identity/zero). */
  readonly textures?: StoreWallRangeTextures;
}

/**
 * Build the assembled `makeOnSubsector` factory for one level/viewport.
 * Pass the result as `renderPlayerViewWalls`'s `makeOnSubsector`.
 *
 * @example
 * ```ts
 * const makeOnSubsector = makeAssembledOnSubsector(config);
 * renderPlayerViewWalls(bspScene, player, projectionAngles, pool, viewWidth, skyflatnum, makeOnSubsector, onSkyPlane, onRegularPlane);
 * ```
 */
export function makeAssembledOnSubsector(config: AssembledOnSubsectorConfig): (frame: ViewFrame, clipState: ClipState) => SubsectorVisitor {
  // Per-level / per-viewport — built once (vanilla module state).
  const accessors = makeMapRenderAccessors(config.map, config.flatNumber, config.textureNumber);
  const textureOf = makeTextureCatalog(config.orderedDefinitions, config.pnames, config.patchByName);
  const scalelightRows = buildScalelightRows(config.viewport, config.colormaps);
  const { drawSolid, drawTwoSided } = makeWallDrawers(config.drawContext);
  const textures = config.textures ?? {};

  return (frame: ViewFrame, clipState: ClipState): SubsectorVisitor => {
    // R_SetupFrame just set these globals; R_Subsector reads them.
    const fixedColormap = frame.fixedColormapIndex !== null;
    let fixedColormapRow: readonly Uint8Array[] | null = null;
    if (frame.fixedColormapIndex !== null) {
      const fixedRamp = config.colormaps[frame.fixedColormapIndex];
      if (fixedRamp === undefined) {
        throw new RangeError(`makeAssembledOnSubsector: fixedColormapIndex ${frame.fixedColormapIndex} outside 0..${config.colormaps.length - 1}`);
      }
      // scalelightfixed: the fixed colormap row replicated MAXLIGHTSCALE times.
      fixedColormapRow = Object.freeze(new Array<Uint8Array>(MAXLIGHTSCALE).fill(fixedRamp));
    }

    const segView: StoreWallRangeView = {
      viewx: frame.viewx,
      viewy: frame.viewy,
      viewz: frame.viewz,
      viewangle: frame.viewangle,
      extralight: frame.extralight,
      skyflatnum: config.skyflatnum,
      fixedColormap,
      centeryfrac: config.viewport.centerYFrac,
      projection: config.viewport.projection,
      detailshift: config.viewport.detailShift,
      xtoviewangle: config.projectionAngles.xtoviewangle,
    };

    const subsectorView: RenderSubsectorView = {
      viewx: frame.viewx,
      viewy: frame.viewy,
      viewangle: frame.viewangle,
      clipangle: config.projectionAngles.clipangle,
      viewangletox: config.projectionAngles.viewangletox,
      viewz: frame.viewz,
      skyflatnum: config.skyflatnum,
    };

    const makeSegStore = (planes: RenderSubsectorResult): ReturnType<typeof makeSegStoreFactory> =>
      makeSegStoreFactory(
        config.segScene,
        config.flatNumber,
        config.textureNumber,
        segView,
        textures,
        makeResolveRenderSegDeps(scalelightRows, textureOf, { ceilingPlane: planes.ceilingplane, floorPlane: planes.floorplane, maskedTextureCol: null, fixedColormapRow, pool: config.pool }),
        drawSolid,
        drawTwoSided,
      );

    return makeSubsectorVisitor({
      subsectorAt: accessors.subsectorAt,
      frontsectorOf: accessors.frontsectorOf,
      addLineSegAt: accessors.addLineSegAt,
      view: subsectorView,
      pool: config.pool,
      state: clipState,
      makeSegStore,
    });
  };
}
