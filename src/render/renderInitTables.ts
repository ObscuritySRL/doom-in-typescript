/**
 * One-time fixed-point renderer lookup tables (Chocolate Doom 2.2.1
 * r_main.c `R_InitTextureMapping` / `R_InitLightTables` /
 * `R_ExecuteSetViewSize`, r_plane.c plane projection).
 *
 * These are the deterministic init products an assembled
 * `R_RenderPlayerView` needs but that no module built yet: the
 * angle/column projection tables (`viewangletox` / `xtoviewangle` /
 * `clipangle`), the light-diminishing index tables (`scalelight` /
 * `zlight`), and the plane projection tables (`yslope` / `distscale`).
 * The arithmetic mirrors the vanilla C byte-for-byte using the shared
 * fixed-point primitives ({@link fixedMul} / {@link fixedDiv}) and the
 * hardcoded `finetangent` / `finecosine` tables, so every value matches
 * what vanilla DOOM 1.9 computed for the same viewport.
 *
 * Light tables are produced as integer colormap-ramp indices
 * (`0..NUMCOLORMAPS-1`); {@link materializeColormapRows} binds them to a
 * concrete 32-ramp COLORMAP once the IWAD is loaded, matching vanilla's
 * `colormaps + level*256` pointer form consumed by the wall/span drawers.
 *
 * Pure arithmetic; no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * import { computeViewport, DetailMode } from './projection.ts';
 * import { buildProjectionAngleTables } from './renderInitTables.ts';
 * const view = computeViewport(11, DetailMode.high);
 * const angles = buildProjectionAngleTables(view);
 * // angles.clipangle === angles.xtoviewangle[0]
 * ```
 */

import { FRACBITS, FRACUNIT, fixedDiv, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, FINEANGLES, finecosine, finetangent } from '../core/trig.ts';

import type { Viewport } from './projection.ts';
import { FIELDOFVIEW, LIGHTLEVELS, LIGHTSCALESHIFT, LIGHTZSHIFT, MAXLIGHTSCALE, MAXLIGHTZ, NUMCOLORMAPS, SCREENWIDTH } from './projection.ts';

/** 90 degrees as a 32-bit BAM angle (r_main.h `ANG90`). */
const ANG90 = 0x4000_0000;

/** Distance-to-light map divisor (r_main.c `DISTMAP`). */
const DISTMAP = 2;

const FINEANGLES_HALF = FINEANGLES / 2;
const FINEANGLES_QUARTER = FINEANGLES / 4;
const FRACUNIT_TIMES_TWO = FRACUNIT * 2;

function absInt(value: number): number {
  return (value < 0 ? -value : value) | 0;
}

export interface ProjectionAngleTables {
  /** r_main.c `clipangle` (`xtoviewangle[0]`), a 32-bit BAM angle. */
  readonly clipangle: number;
  /** r_main.c `viewangletox[FINEANGLES/2]`: fineangle → screen column. */
  readonly viewangletox: Int32Array;
  /** r_main.c `xtoviewangle[viewwidth+1]`: screen column → BAM angle (`angle_t`). */
  readonly xtoviewangle: Uint32Array;
}

/**
 * Build `viewangletox` / `xtoviewangle` / `clipangle` exactly as
 * r_main.c `R_InitTextureMapping`. The `xtoviewangle` scan runs against
 * the pre-compensation (`-1` / `viewwidth+1`) sentinels; the sentinels
 * are folded to `0` / `viewwidth` afterward, matching vanilla ordering.
 */
export function buildProjectionAngleTables(viewport: Viewport): ProjectionAngleTables {
  const viewwidth = viewport.viewWidth;
  const centerxfrac = viewport.centerXFrac;
  const focallength = fixedDiv(centerxfrac, finetangent[FINEANGLES_QUARTER + FIELDOFVIEW / 2]!);

  const viewangletox = new Int32Array(FINEANGLES_HALF);
  for (let i = 0; i < FINEANGLES_HALF; i += 1) {
    const tangent = finetangent[i]!;
    let t: number;
    if (tangent > FRACUNIT_TIMES_TWO) {
      t = -1;
    } else if (tangent < -FRACUNIT_TIMES_TWO) {
      t = viewwidth + 1;
    } else {
      t = fixedMul(tangent, focallength);
      t = ((centerxfrac - t + FRACUNIT - 1) | 0) >> FRACBITS;
      if (t < -1) {
        t = -1;
      } else if (t > viewwidth + 1) {
        t = viewwidth + 1;
      }
    }
    viewangletox[i] = t;
  }

  const xtoviewangle = new Uint32Array(viewwidth + 1);
  for (let x = 0; x <= viewwidth; x += 1) {
    let i = 0;
    while (viewangletox[i]! > x) {
      i += 1;
    }
    xtoviewangle[x] = ((i << ANGLETOFINESHIFT) - ANG90) >>> 0;
  }

  for (let i = 0; i < FINEANGLES_HALF; i += 1) {
    if (viewangletox[i] === -1) {
      viewangletox[i] = 0;
    } else if (viewangletox[i] === viewwidth + 1) {
      viewangletox[i] = viewwidth;
    }
  }

  return Object.freeze({
    clipangle: xtoviewangle[0]!,
    viewangletox,
    xtoviewangle,
  });
}

export interface DiminishingLightLevelTables {
  /**
   * `scalelight[LIGHTLEVELS][MAXLIGHTSCALE]` colormap-ramp indices
   * (row-major), built per r_main.c `R_ExecuteSetViewSize`. Depends on
   * the viewport (`viewwidth << detailshift`).
   */
  readonly scalelightLevels: Int32Array;
  /**
   * `zlight[LIGHTLEVELS][MAXLIGHTZ]` colormap-ramp indices (row-major),
   * built per r_main.c `R_InitLightTables`. Viewport-independent.
   */
  readonly zlightLevels: Int32Array;
}

function startMapForLightLevel(lightLevelIndex: number): number {
  return (((LIGHTLEVELS - 1 - lightLevelIndex) * 2 * NUMCOLORMAPS) / LIGHTLEVELS) | 0;
}

function clampColormapLevel(level: number): number {
  if (level < 0) {
    return 0;
  }
  if (level >= NUMCOLORMAPS) {
    return NUMCOLORMAPS - 1;
  }
  return level;
}

/**
 * Build the `scalelight` and `zlight` colormap-index tables exactly as
 * r_main.c `R_ExecuteSetViewSize` (scalelight) and `R_InitLightTables`
 * (zlight). Integer ramp indices; bind via {@link materializeColormapRows}.
 */
export function buildDiminishingLightLevelTables(viewport: Viewport): DiminishingLightLevelTables {
  const scaledViewWidth = viewport.viewWidth << viewport.detailShift;

  const scalelightLevels = new Int32Array(LIGHTLEVELS * MAXLIGHTSCALE);
  const zlightLevels = new Int32Array(LIGHTLEVELS * MAXLIGHTZ);

  for (let i = 0; i < LIGHTLEVELS; i += 1) {
    const startmap = startMapForLightLevel(i);

    for (let j = 0; j < MAXLIGHTSCALE; j += 1) {
      const level = startmap - (((((j * SCREENWIDTH) / scaledViewWidth) | 0) / DISTMAP) | 0);
      scalelightLevels[i * MAXLIGHTSCALE + j] = clampColormapLevel(level);
    }

    for (let j = 0; j < MAXLIGHTZ; j += 1) {
      let scale = fixedDiv(((SCREENWIDTH / 2) * FRACUNIT) | 0, ((j + 1) << LIGHTZSHIFT) | 0);
      scale >>= LIGHTSCALESHIFT;
      const level = startmap - ((scale / DISTMAP) | 0);
      zlightLevels[i * MAXLIGHTZ + j] = clampColormapLevel(level);
    }
  }

  return Object.freeze({ scalelightLevels, zlightLevels });
}

export interface PlaneProjectionTables {
  /** r_main.c `distscale[viewwidth]` (16.16 fixed-point). */
  readonly distscale: Int32Array;
  /** r_main.c `yslope[viewheight]` (16.16 fixed-point). */
  readonly yslope: Int32Array;
}

/**
 * Build `yslope` / `distscale` exactly as r_main.c
 * `R_ExecuteSetViewSize`. `xtoviewangle` must be the table from
 * {@link buildProjectionAngleTables} for the same viewport.
 */
export function buildPlaneProjectionTables(viewport: Viewport, xtoviewangle: Uint32Array): PlaneProjectionTables {
  const viewheight = viewport.viewHeight;
  const viewwidth = viewport.viewWidth;
  const scaledHalfWidthFrac = ((((viewwidth << viewport.detailShift) / 2) | 0) * FRACUNIT) | 0;

  const yslope = new Int32Array(viewheight);
  for (let i = 0; i < viewheight; i += 1) {
    const dy = absInt((((i - viewheight / 2) << FRACBITS) | 0) + FRACUNIT / 2);
    yslope[i] = fixedDiv(scaledHalfWidthFrac, dy);
  }

  const distscale = new Int32Array(viewwidth);
  for (let i = 0; i < viewwidth; i += 1) {
    const cosadj = absInt(finecosine[xtoviewangle[i]! >>> ANGLETOFINESHIFT]!);
    distscale[i] = fixedDiv(FRACUNIT, cosadj);
  }

  return Object.freeze({ yslope, distscale });
}

/**
 * Bind a row-major integer light-level table to a concrete 32-ramp
 * COLORMAP, yielding the per-row `Uint8Array[]` form
 * (`colormaps + level*256`) the wall/span drawers consume.
 *
 * @example
 * ```ts
 * const rows = materializeColormapRows(tables.scalelightLevels, LIGHTLEVELS, MAXLIGHTSCALE, colormaps);
 * const dcColormap = rows[lightnum]![rwScale >> LIGHTSCALESHIFT]!;
 * ```
 */
export function materializeColormapRows(levelTable: Int32Array, rowCount: number, rowLength: number, colormaps: readonly Uint8Array[]): readonly (readonly Uint8Array[])[] {
  if (levelTable.length !== rowCount * rowLength) {
    throw new RangeError(`levelTable.length ${levelTable.length} !== rowCount*rowLength ${rowCount * rowLength}`);
  }
  if (colormaps.length < NUMCOLORMAPS) {
    throw new RangeError(`colormaps.length ${colormaps.length} < NUMCOLORMAPS ${NUMCOLORMAPS}`);
  }

  const rows: (readonly Uint8Array[])[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row: Uint8Array[] = [];
    for (let columnIndex = 0; columnIndex < rowLength; columnIndex += 1) {
      row.push(colormaps[levelTable[rowIndex * rowLength + columnIndex]!]!);
    }
    rows.push(Object.freeze(row));
  }
  return Object.freeze(rows);
}
