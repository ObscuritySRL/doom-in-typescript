/**
 * Level-static assembled gameplay renderer — the
 * `GameplayRenderContext` → assembled `R_RenderPlayerView` bridge that
 * lets the launcher (`renderGameplayFrame` / `bun run doom.ts`) render
 * E1M1 through the bit-exact fixed-point pipeline instead of the
 * float `worldToView` path.
 *
 * Mirrors vanilla's `P_SetupLevel` (level-static) vs per-tic
 * `R_RenderPlayerView` split: the texture / flat catalogs, viewport,
 * projection / plane / `zlight` tables, BSP scene, visplane pool, clip
 * + span scratch are built once here; the returned function maps the
 * `player_t` to a {@link SetupFramePlayer} and runs the per-frame
 * {@link makeAssembledPlayerFrameRenderer} call.
 *
 * Parity bindings (all transcribed, not invented):
 *   - viewport = `computeViewport(9, high)` — the reference
 *     `doom/default.cfg` `screenblocks 9` (the gate's authority).
 *   - `skyflatnum = R_FlatNumForName("F_SKY1")` (r_data.c).
 *   - `MapData` already uses the same `MapSeg`/`MapSubsector`/… types
 *     as {@link MapRenderTables} / `SegRenderScene`, so it satisfies
 *     them directly; `RenderBspScene = {nodes, numsubsectors}`.
 *   - sky `dc_iscale = computeSkyIscale(computePspriteIscale(viewwidth),
 *     detailshift)`, `dc_texturemid = SKY_TEXTURE_MID`, full-bright
 *     `colormaps + 0` (r_plane.c sky branch).
 *   - `zlight` rows = `materializeColormapRows(zlightLevels,
 *     LIGHTLEVELS, MAXLIGHTZ, colormaps)` (r_main.c R_InitLightTables).
 *
 * A `null` `player->mo` is a wiring error (the caller renders black
 * before reaching here) and throws — never a silent empty frame.
 *
 * Pure (given the parsed map + WAD); no Win32 or runtime dependencies.
 * Every composed piece is an independently committed + tested module.
 */

import { LIGHTLEVELS, MAXLIGHTZ } from './projection.ts';
import { DetailMode, computeViewport } from './projection.ts';
import type { MapData } from '../map/mapSetup.ts';
import type { Player } from '../player/playerSpawn.ts';
import { SCREENWIDTH } from '../host/windowPolicy.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';

import { buildAssembledFlatCatalog } from './assembledFlatCatalog.ts';
import { buildAssembledTextureCatalog } from './assembledTextureCatalog.ts';
import { makeAssembledPlayerFrameRenderer } from './assembledPlayerFrame.ts';
import { paintAssembledViewBorder } from './assembledViewBorder.ts';
import { decodePatch } from './patchDraw.ts';
import type { AssembledPlayerFrameConfig } from './assembledPlayerFrame.ts';
import { buildDiminishingLightLevelTables, buildPlaneProjectionTables, buildProjectionAngleTables, materializeColormapRows } from './renderInitTables.ts';
import type { RenderPlayerViewResult } from './renderPlayerView.ts';
import { SKY_TEXTURE_MID, computePspriteIscale, computeSkyIscale } from './sky.ts';
import type { SetupFramePlayer } from './setupFrame.ts';
import { createVisplanePool } from './visplanes.ts';

/** Episode-1 sky flat marker (r_data.c `SKYFLATNAME`). */
const SKY_FLAT_NAME = 'F_SKY1';

/** r_draw.c non-commercial view-border background flat. */
const VIEW_BORDER_BACKGROUND = 'FLOOR7_2';

/** The parsed map + WAD inputs the level-static renderer binds. */
export interface AssembledGameplayDeps {
  /** Parsed WAD directory. */
  readonly directory: readonly DirectoryEntry[];
  /** Complete WAD byte buffer. */
  readonly wadBuffer: Buffer;
  /** The `P_SetupLevel` map (satisfies `MapRenderTables` / `SegRenderScene` / scene). */
  readonly mapData: MapData;
  /** The launcher's reused palette-indexed framebuffer (`SCREENWIDTH * SCREENHEIGHT`). */
  readonly framebuffer: Uint8Array;
}

/**
 * Build the per-frame assembled gameplay renderer for one level. The
 * level-static catalogs / tables are built here, once; call the result
 * each tic with the player.
 *
 * @example
 * ```ts
 * const renderFrame = makeAssembledGameplayRenderer({ directory, wadBuffer, mapData, framebuffer });
 * renderFrame(player); // each gameplay tic — writes into framebuffer
 * ```
 */
export function makeAssembledGameplayRenderer(deps: AssembledGameplayDeps): (player: Player) => RenderPlayerViewResult {
  const textures = buildAssembledTextureCatalog(deps.directory, deps.wadBuffer);
  const flats = buildAssembledFlatCatalog(deps.directory, deps.wadBuffer);

  // Reference doom/default.cfg: screenblocks 9, high detail.
  const viewport = computeViewport(9, DetailMode.high);
  const projectionAngles = buildProjectionAngleTables(viewport);
  const planeTables = buildPlaneProjectionTables(viewport, projectionAngles.xtoviewangle);
  const { zlightLevels } = buildDiminishingLightLevelTables(viewport);
  const zlightRows = materializeColormapRows(zlightLevels, LIGHTLEVELS, MAXLIGHTZ, textures.colormaps);

  // xtoviewangle is angle_t (BAM, unsigned); the committed sky/span
  // contexts type it Int32Array — a zero-copy view over identical bytes.
  const xToViewAngle = new Int32Array(projectionAngles.xtoviewangle.buffer, projectionAngles.xtoviewangle.byteOffset, projectionAngles.xtoviewangle.length);

  const skyflatnum = flats.flatNumber(SKY_FLAT_NAME);
  const pool = createVisplanePool({ screenWidth: SCREENWIDTH });

  // r_draw.c R_FillBackScreen + R_DrawViewBorder — paint the tiled
  // background + BRDR_* edges once (the per-frame 3D view overwrites
  // only the window; nothing else dirties the margins). FLOOR7_2 is
  // the DOOM1 (non-commercial) border background.
  const lookup = new LumpLookup(deps.directory);
  paintAssembledViewBorder(deps.framebuffer, viewport, flats.flatSource(flats.flatNumber(VIEW_BORDER_BACKGROUND)), (name) => decodePatch(lookup.getLumpData(name, deps.wadBuffer)));

  // The committed 3D pixel passes write at framebuffer-relative (x, y);
  // offset into the screenblocks view window (viewwindowx/y) via a
  // zero-copy subview sharing the buffer (stride stays SCREENWIDTH).
  const windowedFramebuffer = deps.framebuffer.subarray(viewport.viewWindowY * SCREENWIDTH + viewport.viewWindowX);

  const ceilingClip = new Int16Array(viewport.viewWidth);
  const floorClip = new Int16Array(viewport.viewWidth);
  const spanScratch = {
    cachedHeight: new Int32Array(viewport.viewHeight),
    cachedDistance: new Int32Array(viewport.viewHeight),
    cachedXStep: new Int32Array(viewport.viewHeight),
    cachedYStep: new Int32Array(viewport.viewHeight),
    spanStart: new Int32Array(viewport.viewHeight),
  };

  const config: AssembledPlayerFrameConfig = {
    scene: { nodes: deps.mapData.nodes, subsectorCount: deps.mapData.subsectors.length },
    projectionAngles,
    visplanePool: pool,
    viewWidth: viewport.viewWidth,
    skyflatnum,
    onSubsector: {
      map: deps.mapData,
      flatNumber: flats.flatNumber,
      textureNumber: textures.textureNumber,
      segScene: deps.mapData,
      orderedDefinitions: textures.orderedDefinitions,
      pnames: textures.pnames,
      patchByName: textures.patchByName,
      colormaps: textures.colormaps,
      viewport,
      projectionAngles,
      skyflatnum,
      pool,
      drawContext: { framebuffer: windowedFramebuffer, screenWidth: SCREENWIDTH, viewHeight: viewport.viewHeight, centerY: viewport.centerY, ceilingClip, floorClip },
    },
    planes: {
      skyTexture: textures.skyTexture,
      baseColormap: textures.colormaps[0]!,
      skyIscale: computeSkyIscale(computePspriteIscale(viewport.viewWidth), viewport.detailShift),
      skyTextureMid: SKY_TEXTURE_MID,
      colormaps: textures.colormaps,
      zlightRows,
      flatSource: flats.flatSource,
      viewport,
      xToViewAngle,
      planeTables,
      spanScratch,
      framebuffer: windowedFramebuffer,
      screenWidth: SCREENWIDTH,
    },
  };

  const renderFrame = makeAssembledPlayerFrameRenderer(config);

  return (player: Player): RenderPlayerViewResult => {
    const mobj = player.mo;
    if (mobj === null) {
      throw new Error('makeAssembledGameplayRenderer: player.mo is null (caller must render black before reaching the assembled renderer)');
    }
    // r_plane.c R_ClearPlanes also re-initialises the per-column clip
    // bounds every frame (`for i<viewwidth: floorclip[i]=viewheight;
    // ceilingclip[i]=-1`); the committed clearPlanes only resets the
    // visplane pool, so do the clip-array half here.
    ceilingClip.fill(-1);
    floorClip.fill(viewport.viewHeight);
    const setupFramePlayer: SetupFramePlayer = {
      mobjX: mobj.x,
      mobjY: mobj.y,
      mobjAngle: mobj.angle,
      viewz: player.viewz,
      extralight: player.extralight,
      fixedColormap: player.fixedcolormap,
    };
    return renderFrame(setupFramePlayer);
  };
}
