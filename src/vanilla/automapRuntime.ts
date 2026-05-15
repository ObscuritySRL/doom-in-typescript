/**
 * Vanilla DOOM 1.9 automap runtime.
 *
 * Plan_final step `07-006` (lane: ui) wires the automap start/stop
 * lifecycle, follow/pan/zoom, marker add/clear, line/thing color
 * assignments, and the per-frame responder into a single frozen
 * runtime façade the UI layer consumes when the player toggles the
 * automap (Tab key).
 *
 * The wrapper imports the read-only automap state machine from
 * `src/ui/automap.ts` (`createAutomapState`, the per-axis ftom / mtof
 * scale conversions, the boundary-walker, the follow / scale / pan
 * adjustors, the marker helpers, the per-level init and the
 * start/stop transitions) and exposes them through a frozen façade
 * plus a small set of color-palette constants the renderer needs.
 *
 * The runtime façade is frozen but carries a mutable
 * {@link AutomapState} instance (matching vanilla file-scope
 * automap globals).  Downstream subsystems hold the same state
 * reference for the lifetime of the launch; only the methods
 * exposed by the façade may mutate the state.
 *
 * @example
 * ```ts
 * import { createAutomapRuntime } from './automapRuntime.ts';
 *
 * const automap = createAutomapRuntime();
 * automap.levelInit({ minX: 0, minY: 0, maxX: 1024, maxY: 1024 });
 * automap.start({ playerX: 512, playerY: 512, playerAngle: 0, viewWidth: 320, viewHeight: 168 });
 * automap.doFollowPlayer(512, 512);
 * automap.addMark();
 * automap.stop();
 * ```
 */

import type { AutomapLevelInitContext, AutomapPlayerContext, AutomapStartContext, AutomapState } from '../ui/automap.ts';
import {
  automapActivateNewScale,
  automapAddMark,
  automapChangeWindowLoc,
  automapChangeWindowScale,
  automapClearMarks,
  automapCxMtof,
  automapCyMtof,
  automapDoFollowPlayer,
  automapFindMinMaxBoundaries,
  automapFtom,
  automapInitVariables,
  automapLevelInit,
  automapMaxOutWindowScale,
  automapMinOutWindowScale,
  automapMtof,
  automapRestoreScaleAndLoc,
  automapSaveScaleAndLoc,
  automapStart,
  automapStop,
  BACKGROUND,
  CDWALLCOLORS,
  CDWALLRANGE,
  FDWALLCOLORS,
  FDWALLRANGE,
  GRAYS,
  GRAYSRANGE,
  GREENS,
  GREENRANGE,
  TSWALLCOLORS,
  TSWALLRANGE,
  THINGCOLORS,
  WALLCOLORS,
  WALLRANGE,
  WHITE,
  YOURCOLORS,
  createAutomapState,
} from '../ui/automap.ts';
import type { Fixed } from '../core/fixed.ts';

/**
 * Canonical automap color palette indices Chocolate Doom 2.2.1
 * `am_map.c` uses to draw the automap overlay.  Pinned here so
 * downstream renderer steps can address them through a single
 * import.
 */
export interface AutomapColors {
  readonly backgroundColorIndex: number;
  readonly ceilingDiffWallColorRange: number;
  readonly ceilingDiffWallColorStart: number;
  readonly floorDiffWallColorRange: number;
  readonly floorDiffWallColorStart: number;
  readonly grayWallColorRange: number;
  readonly grayWallColorStart: number;
  readonly thingColorStart: number;
  readonly thingColorRange: number;
  readonly twoSidedWallColorRange: number;
  readonly twoSidedWallColorStart: number;
  readonly wallColorRange: number;
  readonly wallColorStart: number;
  readonly whiteColorIndex: number;
  readonly youColorIndex: number;
}

const VANILLA_AUTOMAP_COLORS: AutomapColors = Object.freeze({
  backgroundColorIndex: BACKGROUND,
  ceilingDiffWallColorRange: CDWALLRANGE,
  ceilingDiffWallColorStart: CDWALLCOLORS,
  floorDiffWallColorRange: FDWALLRANGE,
  floorDiffWallColorStart: FDWALLCOLORS,
  grayWallColorRange: GRAYSRANGE,
  grayWallColorStart: GRAYS,
  thingColorRange: GREENRANGE,
  thingColorStart: THINGCOLORS,
  twoSidedWallColorRange: TSWALLRANGE,
  twoSidedWallColorStart: TSWALLCOLORS,
  wallColorRange: WALLRANGE,
  wallColorStart: WALLCOLORS,
  whiteColorIndex: WHITE,
  youColorIndex: YOURCOLORS,
});

void GREENS;

/**
 * Frozen runtime façade assembled by {@link createAutomapRuntime}.
 * The `state` reference is mutable per-tic; the façade itself is
 * frozen so downstream subsystems cannot replace the state.
 */
export interface AutomapRuntime {
  readonly activateNewScale: () => void;
  readonly addMark: () => void;
  readonly changeWindowLoc: () => void;
  readonly changeWindowScale: () => void;
  readonly clearMarks: () => void;
  readonly colors: AutomapColors;
  readonly cxMtof: (mapX: Fixed) => number;
  readonly cyMtof: (mapY: Fixed) => number;
  readonly doFollowPlayer: (playerX: Fixed, playerY: Fixed) => void;
  readonly findMinMaxBoundaries: (vertexes: readonly { readonly x: Fixed; readonly y: Fixed }[]) => void;
  readonly ftom: (pixels: number) => Fixed;
  readonly initVariables: (context: AutomapPlayerContext) => void;
  readonly levelInit: (context: AutomapLevelInitContext) => void;
  readonly maxOutWindowScale: () => void;
  readonly minOutWindowScale: () => void;
  readonly mtof: (mapUnits: Fixed) => number;
  readonly restoreScaleAndLoc: (playerX: Fixed, playerY: Fixed) => void;
  readonly saveScaleAndLoc: () => void;
  readonly start: (context: AutomapStartContext) => void;
  readonly state: AutomapState;
  readonly stop: () => void;
}

/**
 * Build a fresh frozen {@link AutomapRuntime} backed by a new
 * {@link AutomapState}.  The state is initialized to the canonical
 * Chocolate Doom 2.2.1 `am_map.c` defaults (stopped, no marks, scale
 * = INITSCALEMTOF, etc.).
 */
export function createAutomapRuntime(): AutomapRuntime {
  const state = createAutomapState();
  return Object.freeze({
    activateNewScale: (): void => automapActivateNewScale(state),
    addMark: (): void => automapAddMark(state),
    changeWindowLoc: (): void => automapChangeWindowLoc(state),
    changeWindowScale: (): void => automapChangeWindowScale(state),
    clearMarks: (): void => automapClearMarks(state),
    colors: VANILLA_AUTOMAP_COLORS,
    cxMtof: (mapX: Fixed): number => automapCxMtof(state, mapX),
    cyMtof: (mapY: Fixed): number => automapCyMtof(state, mapY),
    doFollowPlayer: (playerX: Fixed, playerY: Fixed): void => automapDoFollowPlayer(state, playerX, playerY),
    findMinMaxBoundaries: (vertexes: readonly { readonly x: Fixed; readonly y: Fixed }[]): void => automapFindMinMaxBoundaries(state, vertexes),
    ftom: (pixels: number): Fixed => automapFtom(state, pixels),
    initVariables: (context: AutomapPlayerContext): void => automapInitVariables(state, context),
    levelInit: (context: AutomapLevelInitContext): void => automapLevelInit(state, context),
    maxOutWindowScale: (): void => automapMaxOutWindowScale(state),
    minOutWindowScale: (): void => automapMinOutWindowScale(state),
    mtof: (mapUnits: Fixed): number => automapMtof(state, mapUnits),
    restoreScaleAndLoc: (playerX: Fixed, playerY: Fixed): void => automapRestoreScaleAndLoc(state, playerX, playerY),
    saveScaleAndLoc: (): void => automapSaveScaleAndLoc(state),
    start: (context: AutomapStartContext): void => automapStart(state, context),
    state,
    stop: (): void => automapStop(state),
  });
}
