/**
 * Vanilla DOOM 1.9 TEXTURE1/TEXTURE2 + PNAMES + patch/flat catalog runtime
 * resources.
 *
 * Plan_final step `05-003` (lane: wad-assets) wires the TEXTURE1 lump
 * (the canonical composite-texture table consumed by `R_InitTextures`),
 * the optional TEXTURE2 lump (registered/retail/commercial extras), the
 * PNAMES lump (the patch-name → patch-index lookup composite textures
 * dereference), the P_START..P_END patch catalog (the raw patch
 * graphics composite textures stitch), and the F_START..F_END flat
 * catalog (the raw 64×64 floor/ceiling pixel arrays) into a single
 * frozen runtime artifact downstream renderer steps consume.
 *
 * The artifact is built once per launch from the
 * {@link IwadResourceCache} produced by `05-001` plus a caller-supplied
 * {@link LumpReader} that resolves a lump's raw bytes from the cache's
 * directory.  No filesystem I/O happens inside this module; every byte
 * comes from the injected loader so the focused test stays
 * deterministic.
 *
 * Pipeline (matches Chocolate Doom 2.2.1 `R_InitTextures`,
 * `R_InitFlats`, and `R_InitSpriteLumps` minus the actual composite
 * column composition — the composition cache is wired by later renderer
 * steps that consume this artifact):
 *
 *   1. Locate the PNAMES lump entry; throw on missing.
 *   2. Read PNAMES bytes via the loader and parse with the read-only
 *      {@link parsePnames}.
 *   3. Locate the TEXTURE1 lump entry; throw on missing.
 *   4. Read TEXTURE1 bytes and parse with the read-only
 *      {@link parseTextureLump}.
 *   5. Locate the optional TEXTURE2 lump entry; parse if present.
 *      Shareware DOOM 1.9 has no TEXTURE2 — the wrapper reports
 *      `null` rather than throwing.
 *   6. Walk the directory's P_START..P_END range via the read-only
 *      {@link buildPatchCatalog}.
 *   7. Walk the directory's F_START..F_END range via the read-only
 *      {@link buildFlatCatalog}.
 *
 * Failure modes are surfaced as typed
 * {@link TexturesAndFlatsError} instances with a stable
 * {@link TexturesAndFlatsErrorReason} discriminator so callers can
 * branch on the failure cause without parsing message strings.
 *
 * @example
 * ```ts
 * import { buildTexturesAndFlats } from './texturesAndFlats.ts';
 *
 * const resources = buildTexturesAndFlats(resourceCache, {
 *   readLumpBytes: (entry) => buffer.subarray(entry.offset, entry.offset + entry.size),
 * });
 * resources.patchNames[0];                    // first PNAMES entry
 * resources.textures1[0]!.name;               // first TEXTURE1 entry name
 * resources.textures2;                        // null for shareware
 * resources.patchCatalog.dataCount;           // number of patch lumps
 * resources.flatCatalog.dataCount;            // number of flat lumps
 * ```
 */

import { buildFlatCatalog, type FlatCatalog } from '../assets/flats.ts';
import { buildPatchCatalog, type PatchCatalog } from '../assets/patchCatalog.ts';
import { parsePnames } from '../assets/pnames.ts';
import { parseTextureLump, type TextureDefinition } from '../assets/texture1.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';

/** Canonical name of the PNAMES lump consumed by R_InitTextures. */
export const VANILLA_PNAMES_LUMP_NAME = 'PNAMES';

/** Canonical name of the TEXTURE1 lump (always present in vanilla IWADs). */
export const VANILLA_TEXTURE1_LUMP_NAME = 'TEXTURE1';

/** Canonical name of the optional TEXTURE2 lump (registered/retail/commercial only; absent in shareware). */
export const VANILLA_TEXTURE2_LUMP_NAME = 'TEXTURE2';

/** Stable discriminator for {@link TexturesAndFlatsError} failure causes. */
export type TexturesAndFlatsErrorReason = 'flat-markers-missing' | 'patch-markers-missing' | 'pnames-lump-malformed' | 'pnames-lump-missing' | 'texture1-lump-malformed' | 'texture1-lump-missing' | 'texture2-lump-malformed';

/**
 * Thrown by {@link buildTexturesAndFlats} when a required TEXTURE/PNAMES/
 * patch/flat lump cannot be located or parsed.  Each instance carries a
 * stable {@link TexturesAndFlatsErrorReason} discriminator and a
 * descriptive identifier (the lump name or marker pair) so the launch-
 * error UI can surface a precise diagnostic.
 */
export class TexturesAndFlatsError extends Error {
  public readonly identifier: string;
  public readonly reason: TexturesAndFlatsErrorReason;

  public constructor(reason: TexturesAndFlatsErrorReason, identifier: string, message: string) {
    super(message);
    this.identifier = identifier;
    this.name = 'TexturesAndFlatsError';
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
 * Frozen runtime artifact assembled by {@link buildTexturesAndFlats}.
 *
 * `textures2` is `null` for shareware DOOM 1.9 (no TEXTURE2 lump).
 * Every other field is non-null and the nested arrays / catalogs are
 * frozen per their parser contracts.
 */
export interface TexturesAndFlatsResources {
  readonly flatCatalog: FlatCatalog;
  readonly patchCatalog: PatchCatalog;
  readonly patchNames: readonly string[];
  readonly textures1: readonly TextureDefinition[];
  readonly textures2: readonly TextureDefinition[] | null;
}

function locateRequiredLump(resourceCache: IwadResourceCache, lumpName: string, missingReason: 'pnames-lump-missing' | 'texture1-lump-missing'): DirectoryEntry {
  const entry = resourceCache.findLump(lumpName);
  if (entry === null) {
    throw new TexturesAndFlatsError(missingReason, lumpName, `IWAD does not contain a ${lumpName} lump`);
  }
  return entry;
}

function parsePnamesEntry(lumpReader: LumpReader, entry: DirectoryEntry): readonly string[] {
  const bytes = lumpReader.readLumpBytes(entry);
  try {
    return parsePnames(bytes);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new TexturesAndFlatsError('pnames-lump-malformed', VANILLA_PNAMES_LUMP_NAME, `PNAMES lump rejected: ${causeMessage}`);
  }
}

function parseTexture1Entry(lumpReader: LumpReader, entry: DirectoryEntry): readonly TextureDefinition[] {
  const bytes = lumpReader.readLumpBytes(entry);
  try {
    return parseTextureLump(bytes);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new TexturesAndFlatsError('texture1-lump-malformed', VANILLA_TEXTURE1_LUMP_NAME, `TEXTURE1 lump rejected: ${causeMessage}`);
  }
}

function parseOptionalTexture2(resourceCache: IwadResourceCache, lumpReader: LumpReader): readonly TextureDefinition[] | null {
  const entry = resourceCache.findLump(VANILLA_TEXTURE2_LUMP_NAME);
  if (entry === null) {
    return null;
  }
  const bytes = lumpReader.readLumpBytes(entry);
  try {
    return parseTextureLump(bytes);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new TexturesAndFlatsError('texture2-lump-malformed', VANILLA_TEXTURE2_LUMP_NAME, `TEXTURE2 lump rejected: ${causeMessage}`);
  }
}

function buildPatchCatalogOrThrow(resourceCache: IwadResourceCache): PatchCatalog {
  try {
    return buildPatchCatalog(resourceCache.directory);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new TexturesAndFlatsError('patch-markers-missing', 'P_START..P_END', `Patch marker range rejected: ${causeMessage}`);
  }
}

function buildFlatCatalogOrThrow(resourceCache: IwadResourceCache): FlatCatalog {
  try {
    return buildFlatCatalog(resourceCache.directory);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new TexturesAndFlatsError('flat-markers-missing', 'F_START..F_END', `Flat marker range rejected: ${causeMessage}`);
  }
}

/**
 * Build a frozen {@link TexturesAndFlatsResources} from the resolved
 * {@link IwadResourceCache} and a caller-supplied {@link LumpReader}.
 *
 * Pipeline:
 *
 *   1. Locate and parse the PNAMES lump; a missing lump throws
 *      {@link TexturesAndFlatsError} with reason `'pnames-lump-missing'`;
 *      a malformed lump throws with `'pnames-lump-malformed'`.
 *   2. Locate and parse the TEXTURE1 lump; missing → `'texture1-lump-missing'`,
 *      malformed → `'texture1-lump-malformed'`.
 *   3. Locate and parse the optional TEXTURE2 lump; absent → null,
 *      malformed → `'texture2-lump-malformed'`.
 *   4. Build the patch and flat catalogs; missing markers surface as
 *      `'patch-markers-missing'` or `'flat-markers-missing'`.
 *
 * The returned artifact is `Object.freeze`d at the top level; nested
 * arrays and catalogs are frozen by their respective parsers.
 */
export function buildTexturesAndFlats(resourceCache: IwadResourceCache, lumpReader: LumpReader): TexturesAndFlatsResources {
  const pnamesEntry = locateRequiredLump(resourceCache, VANILLA_PNAMES_LUMP_NAME, 'pnames-lump-missing');
  const patchNames = parsePnamesEntry(lumpReader, pnamesEntry);

  const texture1Entry = locateRequiredLump(resourceCache, VANILLA_TEXTURE1_LUMP_NAME, 'texture1-lump-missing');
  const textures1 = parseTexture1Entry(lumpReader, texture1Entry);

  const textures2 = parseOptionalTexture2(resourceCache, lumpReader);

  const patchCatalog = buildPatchCatalogOrThrow(resourceCache);
  const flatCatalog = buildFlatCatalogOrThrow(resourceCache);

  return Object.freeze({
    flatCatalog,
    patchCatalog,
    patchNames,
    textures1,
    textures2,
  });
}
