/**
 * Vanilla DOOM 1.9 PLAYPAL + COLORMAP runtime resources.
 *
 * Plan_final step `05-002` (lane: wad-assets) wires the PLAYPAL lump,
 * the COLORMAP lump, and the canonical palette-effect selector from
 * Chocolate Doom 2.2.1 `ST_doPaletteStuff` into a frozen runtime
 * artifact downstream subsystems (the software renderer, the status
 * bar, the HUD message overlay, the wipe effect) consume.  The
 * artifact is built once per launch from the {@link IwadResourceCache}
 * produced by `05-001` and a caller-supplied {@link LumpReader} that
 * resolves a lump's raw bytes from the cache's directory.
 *
 * Pipeline (matches Chocolate Doom 2.2.1 `R_InitColormaps` plus
 * vanilla DOOM 1.9 `V_Init` plus `ST_doPaletteStuff`):
 *
 *   1. Read the PLAYPAL lump bytes via the supplied reader.
 *   2. Parse PLAYPAL into 14 frozen 768-byte palettes via the
 *      read-only {@link parsePlaypal}.
 *   3. Read the COLORMAP lump bytes via the supplied reader.
 *   4. Parse COLORMAP into 34 frozen 256-byte light/effect colormaps
 *      via the read-only {@link parseColormap}.
 *   5. Provide a {@link selectEffectPalette} helper that maps a
 *      caller-supplied {@link VanillaPaletteEffect} descriptor to a
 *      canonical palette index ∈ [0, 13], matching `ST_doPaletteStuff`
 *      (normal/damage/bonus/radiation buckets pinned by `playpal.ts`).
 *
 * Gamma correction is intentionally NOT inlined here.  Plan_final step
 * `06-007` (lane: render) wires `gammatable[5][256]` and the
 * `usegamma ∈ {0,1,2,3,4}` selector into the framebuffer-blit path.
 * This step exposes the *gamma index range* via
 * {@link VANILLA_GAMMA_INDEX_RANGE} so callers can validate
 * `usegamma` values upstream of the table itself; the actual gamma
 * curve lookup belongs to the renderer's blit step.
 *
 * Failure modes are surfaced as typed
 * {@link PaletteAndColormapError} instances with a stable
 * {@link PaletteAndColormapErrorReason} discriminator so callers can
 * branch on the failure cause without parsing message strings.
 *
 * @example
 * ```ts
 * import { buildPaletteAndColormap } from './paletteAndColormap.ts';
 * import { buildIwadResourceCache } from './iwadResourceCache.ts';
 *
 * const cache = buildIwadResourceCache(launchContext, loader);
 * const resources = buildPaletteAndColormap(cache, {
 *   readLumpBytes: (entry) => buffer.slice(entry.offset, entry.offset + entry.size),
 * });
 * resources.palettes.length;                            // 14
 * resources.colormaps.length;                           // 34
 * resources.selectEffectPalette({ kind: 'normal' });    // 0
 * resources.selectEffectPalette({ kind: 'radiation' }); // 13
 * ```
 */

import { parseColormap } from '../assets/colormap.ts';
import { NUMBONUSPALS, NUMREDPALS, RADIATIONPAL, STARTBONUSPALS, STARTREDPALS, parsePlaypal } from '../assets/playpal.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';

/** Canonical name of the PLAYPAL lump consumed by V_Init. */
export const VANILLA_PLAYPAL_LUMP_NAME = 'PLAYPAL';

/** Canonical name of the COLORMAP lump consumed by R_InitColormaps. */
export const VANILLA_COLORMAP_LUMP_NAME = 'COLORMAP';

/**
 * Inclusive range of valid `usegamma` values in vanilla DOOM 1.9.  The
 * runtime gamma table is a 2D array indexed
 * `gammatable[usegamma][byte]` with `usegamma ∈ {0,1,2,3,4}` selecting
 * one of five fixed curves.  Pinned here so callers can validate
 * `usegamma` upstream of the actual table lookup, which is wired in
 * plan_final step `06-007`.
 */
export const VANILLA_GAMMA_INDEX_RANGE: { readonly count: 5; readonly maximum: 4; readonly minimum: 0 } = Object.freeze({ count: 5, maximum: 4, minimum: 0 });

/** Stable discriminator for {@link PaletteAndColormapError} failure causes. */
export type PaletteAndColormapErrorReason = 'colormap-lump-missing' | 'colormap-lump-wrong-size' | 'playpal-lump-missing' | 'playpal-lump-wrong-size';

/**
 * Thrown by {@link buildPaletteAndColormap} when either the PLAYPAL or
 * COLORMAP lump cannot be located in the resource cache or is malformed.
 * Each instance carries a stable {@link PaletteAndColormapErrorReason}
 * discriminator and the lump name the build attempted to resolve.
 */
export class PaletteAndColormapError extends Error {
  public readonly lumpName: string;
  public readonly reason: PaletteAndColormapErrorReason;

  public constructor(reason: PaletteAndColormapErrorReason, lumpName: string, message: string) {
    super(message);
    this.lumpName = lumpName;
    this.name = 'PaletteAndColormapError';
    this.reason = reason;
  }
}

/**
 * Caller-supplied probe that returns the raw bytes for a directory
 * entry.  Production callers wrap the IWAD buffer returned by
 * {@link IwadFileLoader}; tests supply a synthetic buffer slice.  The
 * returned `Uint8Array` MUST be exactly `entry.size` bytes long and
 * MUST start at the first byte of the lump body.
 */
export interface LumpReader {
  readonly readLumpBytes: (entry: DirectoryEntry) => Uint8Array;
}

/**
 * Canonical Chocolate Doom 2.2.1 palette effect categories from
 * `ST_doPaletteStuff` in `st_stuff.c`.  Each kind maps to a contiguous
 * palette-index sub-range inside PLAYPAL:
 *
 *   - `'normal'` → index 0
 *   - `'damage'` → indices 1..8 (red tints, intensity scales with
 *     `playerHealthDamage`)
 *   - `'bonus'`  → indices 9..12 (gold tints, intensity scales with
 *     `playerBonusCount`)
 *   - `'radiation'` → index 13 (green tint, fixed)
 */
export type VanillaPaletteEffect = { readonly intensity: number; readonly kind: 'bonus' } | { readonly intensity: number; readonly kind: 'damage' } | { readonly kind: 'normal' } | { readonly kind: 'radiation' };

/**
 * Frozen runtime artifact assembled by {@link buildPaletteAndColormap}.
 *
 * Carries the 14 PLAYPAL palettes, the 34 COLORMAP colormaps, and the
 * pure-function effect selector.  All nested arrays are frozen and
 * the entries inside them are live `Uint8Array` views over the WAD
 * buffer per the read-only parser contracts; callers MUST treat the
 * views as immutable.
 */
export interface PaletteAndColormapResources {
  readonly colormaps: readonly Uint8Array[];
  readonly palettes: readonly Uint8Array[];
  readonly selectEffectPalette: (effect: VanillaPaletteEffect) => number;
}

function clampIntensityToSubrange(intensity: number, subrangeMaximum: number): number {
  if (!Number.isFinite(intensity) || intensity <= 0) {
    return 0;
  }
  const truncated = Math.trunc(intensity);
  if (truncated > subrangeMaximum) {
    return subrangeMaximum;
  }
  return truncated;
}

function resolveEffectPaletteIndex(effect: VanillaPaletteEffect): number {
  if (effect.kind === 'normal') {
    return 0;
  }
  if (effect.kind === 'radiation') {
    return RADIATIONPAL;
  }
  if (effect.kind === 'damage') {
    const clamped = clampIntensityToSubrange(effect.intensity, NUMREDPALS);
    if (clamped === 0) {
      return 0;
    }
    return STARTREDPALS + (clamped - 1);
  }
  const clamped = clampIntensityToSubrange(effect.intensity, NUMBONUSPALS);
  if (clamped === 0) {
    return 0;
  }
  return STARTBONUSPALS + (clamped - 1);
}

/**
 * Build a frozen {@link PaletteAndColormapResources} from the resolved
 * {@link IwadResourceCache} and a caller-supplied {@link LumpReader}.
 *
 * Pipeline:
 *
 *   1. Locate the PLAYPAL directory entry via {@link IwadResourceCache.findLump}.
 *      A missing lump throws {@link PaletteAndColormapError} with
 *      reason `'playpal-lump-missing'`.
 *   2. Read PLAYPAL bytes via the supplied reader and parse via
 *      {@link parsePlaypal}.  An incorrectly-sized lump throws with
 *      reason `'playpal-lump-wrong-size'`.
 *   3. Locate the COLORMAP entry and read+parse identically.  Failures
 *      surface as `'colormap-lump-missing'` or
 *      `'colormap-lump-wrong-size'`.
 *
 * The returned artifact is `Object.freeze`d at the top level; nested
 * arrays are frozen by their respective parsers.
 */
export function buildPaletteAndColormap(resourceCache: IwadResourceCache, lumpReader: LumpReader): PaletteAndColormapResources {
  const playpalEntry = resourceCache.findLump(VANILLA_PLAYPAL_LUMP_NAME);
  if (playpalEntry === null) {
    throw new PaletteAndColormapError('playpal-lump-missing', VANILLA_PLAYPAL_LUMP_NAME, `IWAD does not contain a PLAYPAL lump`);
  }

  const playpalBytes = lumpReader.readLumpBytes(playpalEntry);
  let palettes: readonly Uint8Array[];
  try {
    palettes = parsePlaypal(playpalBytes);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new PaletteAndColormapError('playpal-lump-wrong-size', VANILLA_PLAYPAL_LUMP_NAME, `PLAYPAL lump rejected: ${causeMessage}`);
  }

  const colormapEntry = resourceCache.findLump(VANILLA_COLORMAP_LUMP_NAME);
  if (colormapEntry === null) {
    throw new PaletteAndColormapError('colormap-lump-missing', VANILLA_COLORMAP_LUMP_NAME, `IWAD does not contain a COLORMAP lump`);
  }

  const colormapBytes = lumpReader.readLumpBytes(colormapEntry);
  let colormaps: readonly Uint8Array[];
  try {
    colormaps = parseColormap(colormapBytes);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new PaletteAndColormapError('colormap-lump-wrong-size', VANILLA_COLORMAP_LUMP_NAME, `COLORMAP lump rejected: ${causeMessage}`);
  }

  return Object.freeze({
    colormaps,
    palettes,
    selectEffectPalette: (effect: VanillaPaletteEffect): number => resolveEffectPaletteIndex(effect),
  });
}
