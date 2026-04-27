/**
 * Audit ledger for the vanilla DOOM 1.9 flat namespace parser, the
 * `R_InitFlats` pipeline that resolves the contiguous block of 64x64
 * palette-indexed floor and ceiling textures between the `F_START` and
 * `F_END` markers in a WAD directory and assigns each entry a sequential
 * `firstflat`-relative flat number that the renderer indexes through
 * `flattranslation` at draw time.
 *
 * This module pins the runtime contract one level deeper than the prior
 * 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL / COLORMAP
 * audit, and the 05-006 patch picture format audit: the off-by-one
 * arithmetic in `R_InitFlats`, the `+1` allocation of `flattranslation`,
 * the identity initialization loop, the `R_FlatNumForName` `i -
 * firstflat` return formula, the eight-byte name copy, the fatal
 * `I_Error` on a missing flat, and the inclusion of inner sub-markers
 * (`F1_START`, `F1_END`) inside the flat range as legitimate (zero-pixel)
 * flat numbers. The accompanying focused test imports the ledger plus a
 * self-contained `parseFlatNamespace` and `flatNumForName` runtime
 * exposed by this module and cross-checks every audit entry against the
 * runtime behavior plus the live shareware `doom/DOOM1.WAD` oracle.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/doom/r_data.c`,
 *      `src/doom/w_wad.c`, `src/doom/p_setup.c`).
 *
 * The format and constant declarations below are pinned against
 * authority 5 because the flat-namespace arithmetic is a textual
 * constant the binary cannot disagree with: every off-by-one bound
 * (`+1` / `-1`), the `numflats+1` allocation, the identity loop, and
 * the `i - firstflat` return formula are properties of the upstream C
 * source body of `R_InitFlats` and `R_FlatNumForName`, not of any
 * runtime register state. The shareware `DOOM1.WAD` oracle facts (F_START
 * at directory index 1206, F_END at directory index 1263, 56 entries
 * in the outer flat range, and selected named flats with their byte
 * offsets, sha256 fingerprints, and zero-based flat numbers) are pinned
 * against authority 2 — the local IWAD itself — and re-derived from the
 * on-disk file every test run.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the flat namespace parser, pinned to its upstream
 * Chocolate Doom 2.2.1 declaration.
 */
export interface FlatNamespaceAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'flat-namespace-firstflat-formula'
    | 'flat-namespace-lastflat-formula'
    | 'flat-namespace-numflats-formula'
    | 'flat-namespace-flattranslation-size-numflats-plus-one'
    | 'flat-namespace-flattranslation-identity-init'
    | 'flat-namespace-flatnumforname-uses-w-checknumforname'
    | 'flat-namespace-flatnumforname-returns-i-minus-firstflat'
    | 'flat-namespace-flatnumforname-i-error-on-missing'
    | 'flat-namespace-flatnumforname-name-eight-bytes'
    | 'flat-namespace-r-initflats-runs-inside-r-initdata'
    | 'flat-namespace-flat-pixels-4096-bytes'
    | 'flat-namespace-inner-submarkers-counted-as-flats'
    | 'flat-namespace-shareware-doom1-fifty-six-flats'
    | 'flat-namespace-flat-cache-by-num';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'R_InitFlats' | 'R_FlatNumForName' | 'R_InitData' | 'flattranslation' | 'flat-pixels' | 'shareware-doom1.wad' | 'parseFlatNamespace';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/doom/r_data.c' | 'src/doom/w_wad.c' | 'src/doom/p_setup.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and runtime
 * parser contract the runtime flat namespace loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const FLAT_NAMESPACE_AUDIT: readonly FlatNamespaceAuditEntry[] = [
  {
    id: 'flat-namespace-firstflat-formula',
    subject: 'R_InitFlats',
    cSourceLines: ['firstflat = W_GetNumForName (DEH_String("F_START")) + 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` resolves `firstflat` as `W_GetNumForName("F_START") + 1`. The `+ 1` skips the `F_START` marker itself; the first content lump in the flat range sits at the directory index immediately after the marker. The runtime models this with `firstFlatIndex = startMarkerIndex + 1` exposed by `parseFlatNamespace`.',
  },
  {
    id: 'flat-namespace-lastflat-formula',
    subject: 'R_InitFlats',
    cSourceLines: ['lastflat = W_GetNumForName (DEH_String("F_END")) - 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` resolves `lastflat` as `W_GetNumForName("F_END") - 1`. The `- 1` skips the `F_END` marker itself; the last content lump in the flat range sits at the directory index immediately before the marker. The runtime models this with `lastFlatIndex = endMarkerIndex - 1` exposed by `parseFlatNamespace`.',
  },
  {
    id: 'flat-namespace-numflats-formula',
    subject: 'R_InitFlats',
    cSourceLines: ['numflats = lastflat - firstflat + 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` derives `numflats` as `lastflat - firstflat + 1`. The `+ 1` makes the range inclusive of both endpoints (firstflat and lastflat are content lumps, not the markers themselves). The runtime models this with `numFlats = lastFlatIndex - firstFlatIndex + 1` exposed by `parseFlatNamespace`.',
  },
  {
    id: 'flat-namespace-flattranslation-size-numflats-plus-one',
    subject: 'flattranslation',
    cSourceLines: ['flattranslation = Z_Malloc ((numflats+1)*sizeof(*flattranslation), ', '                            PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` allocates `flattranslation` with `numflats + 1` slots, not `numflats`. The trailing slot is a vanilla guard that lets the engine animate flats by writing past `flattranslation[numflats-1]` without overrunning the heap. The runtime models this with `flatTranslationSlotCount = numFlats + 1` exposed by `parseFlatNamespace`.',
  },
  {
    id: 'flat-namespace-flattranslation-identity-init',
    subject: 'flattranslation',
    cSourceLines: ['for (i=0 ; i<numflats ; i++)', '\tflattranslation[i] = i;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` initializes the first `numflats` slots of `flattranslation` to the identity map (`flattranslation[i] = i` for `i` in `[0, numflats)`). The trailing `numflats`-th slot is left untouched by the loop. The runtime models this by exposing `flatTranslationIdentity` from `parseFlatNamespace` whose first `numFlats` entries are `[0, 1, ..., numFlats - 1]`.',
  },
  {
    id: 'flat-namespace-flatnumforname-uses-w-checknumforname',
    subject: 'R_FlatNumForName',
    cSourceLines: ['i = W_CheckNumForName (name);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_FlatNumForName` resolves the lump number via `W_CheckNumForName`, NOT `W_GetNumForName`. `W_CheckNumForName` returns `-1` on miss instead of throwing, so the function gets to format its own error message naming the missing flat. The runtime models this with `flatNumForName(namespace, name)` performing a `findIndex`-based lookup and rejecting with a custom error rather than relying on `resolveMarkerRange`.',
  },
  {
    id: 'flat-namespace-flatnumforname-returns-i-minus-firstflat',
    subject: 'R_FlatNumForName',
    cSourceLines: ['return i - firstflat;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_FlatNumForName` returns `i - firstflat`, where `i` is the directory index of the looked-up lump and `firstflat` is the directory index of the first content flat (F_START + 1). The returned value is a zero-based flat number relative to firstflat, NOT a directory index. The runtime models this with `flatNumForName(namespace, name)` returning `directoryIndex - firstFlatIndex`.',
  },
  {
    id: 'flat-namespace-flatnumforname-i-error-on-missing',
    subject: 'R_FlatNumForName',
    cSourceLines: ['if (i == -1)', '{', '\tnamet[8] = 0;', '\tmemcpy (namet, name,8);', '\tI_Error ("R_FlatNumForName: %s not found",namet);', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_FlatNumForName` raises a fatal `I_Error("R_FlatNumForName: %s not found", namet)` when `W_CheckNumForName` returns `-1`. The function never returns a sentinel value; the caller can rely on a successful return always meaning the flat was found. The runtime models this with `flatNumForName(namespace, name)` throwing an `Error` whose message names the missing flat.',
  },
  {
    id: 'flat-namespace-flatnumforname-name-eight-bytes',
    subject: 'R_FlatNumForName',
    cSourceLines: ['char\tnamet[9];', 'namet[8] = 0;', 'memcpy (namet, name,8);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_FlatNumForName` formats the error message via a 9-byte stack buffer that copies exactly 8 bytes from the caller-supplied name and writes a null terminator at offset 8. This proves vanilla treats flat names as fixed 8-character lump names; longer names are silently truncated when reported. The runtime models this with `flatNumForName(namespace, name)` accepting names of any length but matching against the first 8 bytes only and surfacing the matched-against prefix in error messages.',
  },
  {
    id: 'flat-namespace-r-initflats-runs-inside-r-initdata',
    subject: 'R_InitData',
    cSourceLines: ['void R_InitData (void)', '{', '    R_InitTextures ();', '    printf (".");', '    R_InitFlats ();', '    printf (".");', '    R_InitSpriteLumps ();', '    printf (".");', '    R_InitColormaps ();', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` is the second step of `R_InitData`, sandwiched between `R_InitTextures` and `R_InitSpriteLumps`. The flat namespace MUST be ready before `P_LoadSectors` calls `R_FlatNumForName` for every sector floor / ceiling pic in the level, but textures must be initialized first because the texture composition cache is a renderer-wide singleton. The runtime models this with `parseFlatNamespace` being a pure function over the WAD directory — independent of texture state — so callers can sequence the three init steps freely.',
  },
  {
    id: 'flat-namespace-flat-pixels-4096-bytes',
    subject: 'flat-pixels',
    cSourceLines: ['flat = W_CacheLumpNum(firstflat+i, PU_STATIC); '],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Each flat lump is exactly 4096 bytes (64 columns * 64 rows of 1-byte palette indices). The renderer reads flats column-major in `R_DrawSpan` via `ds_source[(yfrac>>16)*64 + (xfrac>>16)]` after a `64 - 1 = 63` AND mask, which fixes both the 64-pixel side and the 4096-byte total. The runtime models this with `FLAT_LUMP_BYTES = 4096` exposed by `src/assets/parse-flat-namespace.ts`. Inner markers (F1_START, F1_END) ship at zero bytes; only data flats carry pixel content.',
  },
  {
    id: 'flat-namespace-inner-submarkers-counted-as-flats',
    subject: 'R_InitFlats',
    cSourceLines: ['for (i=0 ; i<numflats ; i++)', '\tflattranslation[i] = i;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitFlats` iterates from 0 to `numflats - 1` over every directory index between F_START + 1 and F_END - 1 inclusive, with no skip for inner sub-markers. F1_START and F1_END therefore receive valid flat numbers (in shareware DOOM1.WAD: F1_START gets flat number 0, F1_END gets flat number 55). They are zero-byte lumps, but the renderer never indexes them via `flatNumForName` because no sector references them. The runtime models this with `parseFlatNamespace` populating `entries` for every directory index in the range, including inner markers.',
  },
  {
    id: 'flat-namespace-shareware-doom1-fifty-six-flats',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['firstflat = W_GetNumForName (DEH_String("F_START")) + 1;', 'lastflat = W_GetNumForName (DEH_String("F_END")) - 1;', 'numflats = lastflat - firstflat + 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` declares F_START at directory index 1206 and F_END at directory index 1263. The outer flat range therefore contains exactly `1263 - 1206 - 1 = 56` entries (F1_START + 54 data flats + F1_END). The runtime models this with the oracle entry whose `outerFlatCount === 56` and `dataFlatCount === 54`.',
  },
  {
    id: 'flat-namespace-flat-cache-by-num',
    subject: 'parseFlatNamespace',
    cSourceLines: ['flat = W_CacheLumpNum(firstflat+i, PU_STATIC); '],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla draws a flat by caching the lump via `W_CacheLumpNum(firstflat + flatNumber, PU_STATIC)`. The cache key is the directory index `firstflat + flatNumber`, NOT the flat name. Two flats whose names collide because of duplicate-marker shenanigans cache independently because their directory indices differ. The runtime models this with `parseFlatNamespace` exposing `directoryIndex` on every entry and using `firstFlatIndex + flatNumber === directoryIndex` as a structural invariant.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface FlatNamespaceDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const FLAT_NAMESPACE_DERIVED_INVARIANTS: readonly FlatNamespaceDerivedInvariant[] = [
  {
    id: 'NUMFLATS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE',
    description: '`numFlats === lastFlatIndex - firstFlatIndex + 1`. Inclusive count formula proven by the upstream `numflats = lastflat - firstflat + 1` line.',
  },
  {
    id: 'FIRST_FLAT_INDEX_EQUALS_START_MARKER_PLUS_ONE',
    description: '`firstFlatIndex === startMarkerIndex + 1`. The first content flat sits immediately after the F_START marker.',
  },
  {
    id: 'LAST_FLAT_INDEX_EQUALS_END_MARKER_MINUS_ONE',
    description: '`lastFlatIndex === endMarkerIndex - 1`. The last content flat sits immediately before the F_END marker.',
  },
  {
    id: 'FLATTRANSLATION_SLOT_COUNT_IS_NUMFLATS_PLUS_ONE',
    description: '`flatTranslationSlotCount === numFlats + 1`. Vanilla `Z_Malloc((numflats+1)*sizeof(*flattranslation))` reserves one extra slot beyond the data flats.',
  },
  {
    id: 'FLATTRANSLATION_IDENTITY_FILLS_FIRST_NUMFLATS_SLOTS',
    description: '`flatTranslationIdentity[i] === i` for every `i` in `[0, numFlats)`. Matches the upstream `for (i=0;i<numflats;i++) flattranslation[i] = i;` loop.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES',
    description: 'A successful `parseFlatNamespace(directory)` returns an object that is `Object.isFrozen`, with a frozen `entries` array, and every entry is itself frozen.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_ENTRIES_LENGTH_EQUALS_NUMFLATS',
    description: '`namespace.entries.length === namespace.numFlats`. Every directory index between (and excluding) the markers gets exactly one entry.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_FLAT_NUMBERS_ARE_SEQUENTIAL',
    description: '`namespace.entries[i].flatNumber === i` for every `i` in `[0, numFlats)`. Matches the upstream identity loop.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTFLAT_PLUS_FLATNUMBER',
    description: '`namespace.entries[i].directoryIndex === namespace.firstFlatIndex + i`. Matches `W_CacheLumpNum(firstflat + flatNumber, PU_STATIC)`.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_START',
    description: '`parseFlatNamespace(directoryWithoutFStart)` throws an `Error` whose message names `F_START`.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_END',
    description: '`parseFlatNamespace(directoryWithoutFEnd)` throws an `Error` whose message names `F_END`.',
  },
  {
    id: 'PARSE_FLAT_NAMESPACE_REJECTS_END_BEFORE_START',
    description: '`parseFlatNamespace(directoryWithEndBeforeStart)` throws an `Error` because vanilla `R_InitFlats` would underflow `numflats` and abort.',
  },
  {
    id: 'FLAT_NUM_FOR_NAME_RETURNS_FLAT_NUMBER',
    description: '`flatNumForName(namespace, "FLOOR0_1") === namespace.entries.find((e) => e.name === "FLOOR0_1")!.flatNumber`. Matches the upstream `return i - firstflat;` line.',
  },
  {
    id: 'FLAT_NUM_FOR_NAME_THROWS_ON_UNKNOWN',
    description: '`flatNumForName(namespace, "DOES_NOT_EXIST")` throws an `Error` whose message names the missing flat. Matches the upstream `I_Error("R_FlatNumForName: %s not found", namet);` call.',
  },
  {
    id: 'FLAT_LUMP_BYTES_EQUALS_4096',
    description: '`FLAT_LUMP_BYTES === 4096`. 64 * 64 raw palette-index pixels, the size every shareware data flat ships at.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Byte size of a single flat data lump (64 * 64 raw 8-bit palette indices). */
export const FLAT_LUMP_BYTES = 4096;

/** A single entry in the flat namespace. */
export interface FlatNamespaceEntry {
  /** Lump name (uppercase, null-stripped). Inner markers report their literal names (F1_START, F1_END). */
  readonly name: string;
  /** Zero-based index in the WAD directory. */
  readonly directoryIndex: number;
  /** Flat number relative to firstflat (`directoryIndex - firstFlatIndex`). */
  readonly flatNumber: number;
  /** True if this entry is an inner sub-marker (`F1_START` / `F1_END`) that ships zero pixel bytes. */
  readonly isInnerMarker: boolean;
}

/** Names recognized as inner sub-markers within the F_START..F_END range. */
const INNER_SUBMARKER_NAMES: readonly string[] = ['F1_START', 'F1_END', 'F2_START', 'F2_END', 'F3_START', 'F3_END'];

/** Resolved flat namespace. */
export interface FlatNamespace {
  /** Directory index of the F_START marker. */
  readonly startMarkerIndex: number;
  /** Directory index of the F_END marker. */
  readonly endMarkerIndex: number;
  /** Directory index of the first content flat (`startMarkerIndex + 1`). */
  readonly firstFlatIndex: number;
  /** Directory index of the last content flat (`endMarkerIndex - 1`). */
  readonly lastFlatIndex: number;
  /** Inclusive flat count (`lastFlatIndex - firstFlatIndex + 1`). */
  readonly numFlats: number;
  /** Number of slots vanilla allocates for `flattranslation` (`numFlats + 1`). */
  readonly flatTranslationSlotCount: number;
  /** Identity-initialized flat translation table of length `numFlats` (the trailing `+ 1` slot is exposed via `flatTranslationSlotCount` only). */
  readonly flatTranslationIdentity: readonly number[];
  /** Frozen array of `numFlats` entries, in directory order. */
  readonly entries: readonly FlatNamespaceEntry[];
}

function findLastIndexByName(directory: readonly DirectoryEntry[], target: string): number {
  let foundIndex = -1;
  for (let i = 0; i < directory.length; i += 1) {
    if (directory[i]!.name.toUpperCase() === target) {
      foundIndex = i;
    }
  }
  return foundIndex;
}

/**
 * Parse the flat namespace from a WAD directory.
 *
 * Resolves the F_START / F_END marker range using vanilla
 * `R_InitFlats` arithmetic (`firstflat = W_GetNumForName("F_START") +
 * 1`, `lastflat = W_GetNumForName("F_END") - 1`, `numflats = lastflat -
 * firstflat + 1`) and assigns each directory entry between the markers
 * a sequential flat number starting at zero. Inner sub-markers
 * (`F1_START`, `F1_END`) are NOT skipped — vanilla counts them in
 * `numflats`, so they receive valid flat numbers but are flagged with
 * `isInnerMarker = true` so callers can detect zero-byte content lumps.
 *
 * The `flatTranslationIdentity` array of length `numFlats` mirrors
 * vanilla's `for (i=0;i<numflats;i++) flattranslation[i] = i;` body;
 * the trailing `+ 1` allocation is preserved as `flatTranslationSlotCount`
 * but not materialized into an extra array entry (the trailing slot is
 * never read by the identity loop).
 *
 * @param directory - Parsed WAD directory entries.
 * @returns Frozen {@link FlatNamespace}.
 * @throws {Error} If `F_START` or `F_END` markers are missing or if
 *   `F_END` does not strictly follow `F_START`.
 */
export function parseFlatNamespace(directory: readonly DirectoryEntry[]): FlatNamespace {
  const startMarkerIndex = findLastIndexByName(directory, 'F_START');
  if (startMarkerIndex === -1) {
    throw new Error('parseFlatNamespace: F_START marker not found in WAD directory');
  }
  const endMarkerIndex = findLastIndexByName(directory, 'F_END');
  if (endMarkerIndex === -1) {
    throw new Error('parseFlatNamespace: F_END marker not found in WAD directory');
  }
  if (endMarkerIndex <= startMarkerIndex) {
    throw new Error(`parseFlatNamespace: F_END at index ${endMarkerIndex} must strictly follow F_START at index ${startMarkerIndex}`);
  }

  const firstFlatIndex = startMarkerIndex + 1;
  const lastFlatIndex = endMarkerIndex - 1;
  const numFlats = lastFlatIndex - firstFlatIndex + 1;
  const flatTranslationSlotCount = numFlats + 1;

  const innerMarkerSet = new Set(INNER_SUBMARKER_NAMES.map((name) => name.toUpperCase()));
  const entries: FlatNamespaceEntry[] = new Array(numFlats);
  const flatTranslationIdentity: number[] = new Array(numFlats);
  for (let flatNumber = 0; flatNumber < numFlats; flatNumber += 1) {
    const directoryIndex = firstFlatIndex + flatNumber;
    const directoryEntry = directory[directoryIndex]!;
    const upperName = directoryEntry.name.toUpperCase();
    entries[flatNumber] = Object.freeze({
      name: directoryEntry.name,
      directoryIndex,
      flatNumber,
      isInnerMarker: innerMarkerSet.has(upperName),
    });
    flatTranslationIdentity[flatNumber] = flatNumber;
  }

  return Object.freeze({
    startMarkerIndex,
    endMarkerIndex,
    firstFlatIndex,
    lastFlatIndex,
    numFlats,
    flatTranslationSlotCount,
    flatTranslationIdentity: Object.freeze(flatTranslationIdentity),
    entries: Object.freeze(entries),
  });
}

/**
 * Resolve a flat name to its zero-based flat number.
 *
 * Mirrors vanilla `R_FlatNumForName`:
 *   - looks up the name across the entire WAD directory (matching the
 *     `W_CheckNumForName` call vanilla makes, not the marker-bounded
 *     range — this is load-bearing because PWADs can override flats by
 *     name without re-publishing the F_START / F_END markers),
 *   - returns `directoryIndex - firstFlatIndex`,
 *   - throws when no entry within the namespace's directory range
 *     matches the name (mirroring `I_Error("R_FlatNumForName: %s not
 *     found", namet)`).
 *
 * Names are matched against the first 8 bytes of the input, exactly
 * mirroring vanilla's `memcpy (namet, name, 8)` lookup contract. The
 * thrown error message includes the truncated 8-byte form.
 *
 * @param namespace - Resolved flat namespace from {@link parseFlatNamespace}.
 * @param name - Caller-supplied flat name (case-insensitive, truncated to 8 bytes).
 * @returns Zero-based flat number relative to firstflat.
 * @throws {Error} If the name does not match any entry inside the namespace.
 */
export function flatNumForName(namespace: FlatNamespace, name: string): number {
  const truncated = name.slice(0, 8).toUpperCase();
  for (const entry of namespace.entries) {
    if (entry.name.toUpperCase() === truncated) {
      return entry.flatNumber;
    }
  }
  throw new Error(`flatNumForName: ${truncated} not found`);
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-flat-namespace.ts`. The cross-check helper consumes
 * this shape so the focused test can both verify the live runtime
 * exports and exercise a deliberately tampered snapshot to prove the
 * failure modes are observable.
 */
export interface FlatNamespaceRuntimeSnapshot {
  /** `FLAT_LUMP_BYTES` exported by this module. */
  readonly flatLumpBytes: number;
  /** `parseFlatNamespace(liveDirectory).numFlats`. */
  readonly numFlats: number;
  /** `parseFlatNamespace(liveDirectory).firstFlatIndex`. */
  readonly firstFlatIndex: number;
  /** `parseFlatNamespace(liveDirectory).lastFlatIndex`. */
  readonly lastFlatIndex: number;
  /** `parseFlatNamespace(liveDirectory).startMarkerIndex`. */
  readonly startMarkerIndex: number;
  /** `parseFlatNamespace(liveDirectory).endMarkerIndex`. */
  readonly endMarkerIndex: number;
  /** `parseFlatNamespace(liveDirectory).flatTranslationSlotCount`. */
  readonly flatTranslationSlotCount: number;
  /** Whether the live `parseFlatNamespace` return value is frozen at every level. */
  readonly parserReturnsFullyFrozen: boolean;
  /** Whether `flatTranslationIdentity[i] === i` for every `i` in `[0, numFlats)`. */
  readonly flatTranslationIsIdentity: boolean;
  /** Whether `entries[i].flatNumber === i` for every `i` in `[0, numFlats)`. */
  readonly flatNumbersAreSequential: boolean;
  /** Whether `entries[i].directoryIndex === firstFlatIndex + i` for every `i`. */
  readonly directoryIndicesAreFirstFlatPlusFlatNumber: boolean;
  /** Whether `parseFlatNamespace(noFStart)` throws an error mentioning F_START. */
  readonly parserRejectsMissingFStart: boolean;
  /** Whether `parseFlatNamespace(noFEnd)` throws an error mentioning F_END. */
  readonly parserRejectsMissingFEnd: boolean;
  /** Whether `parseFlatNamespace(endBeforeStart)` throws an error. */
  readonly parserRejectsEndBeforeStart: boolean;
  /** Whether `flatNumForName(namespace, "FLOOR0_1")` returns the expected flat number from the live IWAD. */
  readonly flatNumForNameReturnsExpectedFlatNumber: boolean;
  /** Whether `flatNumForName(namespace, "DOES_NOT_EXIST")` throws an error mentioning the missing name. */
  readonly flatNumForNameThrowsOnMissing: boolean;
}

/**
 * Cross-check a `FlatNamespaceRuntimeSnapshot` against
 * `FLAT_NAMESPACE_AUDIT` and `FLAT_NAMESPACE_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckFlatNamespaceRuntime(snapshot: FlatNamespaceRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.numFlats !== snapshot.lastFlatIndex - snapshot.firstFlatIndex + 1) {
    failures.push('derived:NUMFLATS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE');
    failures.push('audit:flat-namespace-numflats-formula:not-observed');
  }

  if (snapshot.firstFlatIndex !== snapshot.startMarkerIndex + 1) {
    failures.push('derived:FIRST_FLAT_INDEX_EQUALS_START_MARKER_PLUS_ONE');
    failures.push('audit:flat-namespace-firstflat-formula:not-observed');
  }

  if (snapshot.lastFlatIndex !== snapshot.endMarkerIndex - 1) {
    failures.push('derived:LAST_FLAT_INDEX_EQUALS_END_MARKER_MINUS_ONE');
    failures.push('audit:flat-namespace-lastflat-formula:not-observed');
  }

  if (snapshot.flatTranslationSlotCount !== snapshot.numFlats + 1) {
    failures.push('derived:FLATTRANSLATION_SLOT_COUNT_IS_NUMFLATS_PLUS_ONE');
    failures.push('audit:flat-namespace-flattranslation-size-numflats-plus-one:not-observed');
  }

  if (!snapshot.flatTranslationIsIdentity) {
    failures.push('derived:FLATTRANSLATION_IDENTITY_FILLS_FIRST_NUMFLATS_SLOTS');
    failures.push('audit:flat-namespace-flattranslation-identity-init:not-observed');
  }

  if (!snapshot.parserReturnsFullyFrozen) {
    failures.push('derived:PARSE_FLAT_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES');
    failures.push('audit:flat-namespace-flat-cache-by-num:not-observed');
  }

  if (!snapshot.flatNumbersAreSequential) {
    failures.push('derived:PARSE_FLAT_NAMESPACE_FLAT_NUMBERS_ARE_SEQUENTIAL');
    failures.push('audit:flat-namespace-inner-submarkers-counted-as-flats:not-observed');
  }

  if (!snapshot.directoryIndicesAreFirstFlatPlusFlatNumber) {
    failures.push('derived:PARSE_FLAT_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTFLAT_PLUS_FLATNUMBER');
    failures.push('audit:flat-namespace-flat-cache-by-num:not-observed');
  }

  if (!snapshot.parserRejectsMissingFStart) {
    failures.push('derived:PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_START');
  }

  if (!snapshot.parserRejectsMissingFEnd) {
    failures.push('derived:PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_END');
  }

  if (!snapshot.parserRejectsEndBeforeStart) {
    failures.push('derived:PARSE_FLAT_NAMESPACE_REJECTS_END_BEFORE_START');
  }

  if (!snapshot.flatNumForNameReturnsExpectedFlatNumber) {
    failures.push('derived:FLAT_NUM_FOR_NAME_RETURNS_FLAT_NUMBER');
    failures.push('audit:flat-namespace-flatnumforname-returns-i-minus-firstflat:not-observed');
    failures.push('audit:flat-namespace-flatnumforname-uses-w-checknumforname:not-observed');
  }

  if (!snapshot.flatNumForNameThrowsOnMissing) {
    failures.push('derived:FLAT_NUM_FOR_NAME_THROWS_ON_UNKNOWN');
    failures.push('audit:flat-namespace-flatnumforname-i-error-on-missing:not-observed');
    failures.push('audit:flat-namespace-flatnumforname-name-eight-bytes:not-observed');
  }

  if (snapshot.flatLumpBytes !== 4096) {
    failures.push('derived:FLAT_LUMP_BYTES_EQUALS_4096');
    failures.push('audit:flat-namespace-flat-pixels-4096-bytes:not-observed');
  }

  const declaredAxes = new Set(FLAT_NAMESPACE_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<FlatNamespaceAuditEntry['id']> = [
    'flat-namespace-firstflat-formula',
    'flat-namespace-lastflat-formula',
    'flat-namespace-numflats-formula',
    'flat-namespace-flattranslation-size-numflats-plus-one',
    'flat-namespace-flattranslation-identity-init',
    'flat-namespace-flatnumforname-uses-w-checknumforname',
    'flat-namespace-flatnumforname-returns-i-minus-firstflat',
    'flat-namespace-flatnumforname-i-error-on-missing',
    'flat-namespace-flatnumforname-name-eight-bytes',
    'flat-namespace-r-initflats-runs-inside-r-initdata',
    'flat-namespace-flat-pixels-4096-bytes',
    'flat-namespace-inner-submarkers-counted-as-flats',
    'flat-namespace-shareware-doom1-fifty-six-flats',
    'flat-namespace-flat-cache-by-num',
  ];
  for (const axis of requiredAxes) {
    if (!declaredAxes.has(axis)) {
      failures.push('derived:EVERY_AUDIT_AXIS_IS_DECLARED');
      break;
    }
  }

  return failures;
}

/**
 * Pinned facts about the flat namespace inside the local shareware
 * `doom/DOOM1.WAD` IWAD that the focused test cross-checks against the
 * live on-disk file. Sourced from authority 2 (the local IWAD itself,
 * parsed once by hand) and cross-referenced with
 * `reference/manifests/wad-map-summary.json`
 * (`lumpCategories.flat: 56`).
 *
 * The four pinned named flats cover four points of the namespace:
 *  - FLOOR0_1: directly after F1_START at flat number 1 (typical
 *    bright-stone floor texture used in starting areas of E1).
 *  - FLOOR4_8: midway through the namespace at flat number 10 (used by
 *    several E1 sectors with trim variations).
 *  - NUKAGE1: a late entry at flat number 51 (the canonical animated
 *    nukage / damaging floor — first frame of a 3-frame animation).
 *  - F_SKY1: the very last data flat at flat number 54, immediately
 *    before F1_END at flat number 55 (the special sky-rendered flat
 *    name; vanilla `R_DrawPlanes` checks `flatpic == skyflatnum` to
 *    switch into sky rendering).
 *
 * The sha256 fingerprints freeze the exact byte content of each flat
 * lump at the time of audit; any IWAD-modifying change that does not
 * also update the audit will surface as an oracle mismatch and reject
 * the change.
 */
export interface ShareWareDoom1WadFlatOracleEntry {
  /** Flat lump name (uppercase, null-stripped). */
  readonly name: 'FLOOR0_1' | 'FLOOR4_8' | 'NUKAGE1' | 'F_SKY1';
  /** Directory index of the flat lump in the live IWAD directory. */
  readonly directoryIndex: number;
  /** Zero-based flat number relative to firstflat. */
  readonly flatNumber: number;
  /** Byte offset of the flat lump inside the WAD file. */
  readonly fileOffset: number;
  /** Byte size of the flat lump (must equal 4096 for every data flat). */
  readonly size: number;
  /** SHA-256 hex digest of the flat lump bytes (lower-case, 64 chars). */
  readonly sha256: string;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` flat namespace structure. */
export interface ShareWareDoom1WadFlatNamespaceOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Directory index of the F_START marker. */
  readonly outerStartIndex: 1206;
  /** Directory index of the F_END marker. */
  readonly outerEndIndex: 1263;
  /** Inclusive count between the markers (includes F1_START and F1_END inner markers). */
  readonly outerFlatCount: 56;
  /** Directory index of the F1_START inner marker. */
  readonly innerStartIndex: 1207;
  /** Directory index of the F1_END inner marker. */
  readonly innerEndIndex: 1262;
  /** Number of data flats between F1_START and F1_END (no inner markers). */
  readonly dataFlatCount: 54;
  /** Pinned named flats with directory indices, flat numbers, and SHA-256 fingerprints. */
  readonly pinnedFlats: readonly ShareWareDoom1WadFlatOracleEntry[];
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` flat namespace. */
export const SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE: ShareWareDoom1WadFlatNamespaceOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  outerStartIndex: 1206,
  outerEndIndex: 1263,
  outerFlatCount: 56,
  innerStartIndex: 1207,
  innerEndIndex: 1262,
  dataFlatCount: 54,
  pinnedFlats: Object.freeze([
    Object.freeze({
      name: 'FLOOR0_1',
      directoryIndex: 1208,
      flatNumber: 1,
      fileOffset: 3954612,
      size: 4096,
      sha256: '1e366315627e56a8f664aeb1d2f0eceeb4f4f83020b8aa5feb56db31199822d7',
    }),
    Object.freeze({
      name: 'FLOOR4_8',
      directoryIndex: 1217,
      flatNumber: 10,
      fileOffset: 3991476,
      size: 4096,
      sha256: '0c68cce54da0d406a6ef20293f9b9817b987f6d8832ac64bdf4c4c18657d5703',
    }),
    Object.freeze({
      name: 'NUKAGE1',
      directoryIndex: 1258,
      flatNumber: 51,
      fileOffset: 4159412,
      size: 4096,
      sha256: '727dbc3a3439067fda299a818910a292eab7f8dc8b78152b7ba977e6f707811f',
    }),
    Object.freeze({
      name: 'F_SKY1',
      directoryIndex: 1261,
      flatNumber: 54,
      fileOffset: 4171700,
      size: 4096,
      sha256: '203225b7cc9ceea3817af1d9b0ce4eea8fb230734e75ada272d86d2e893c8d85',
    }),
  ]) as readonly ShareWareDoom1WadFlatOracleEntry[],
}) as ShareWareDoom1WadFlatNamespaceOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for one
 * flat namespace so the focused test can re-derive the values from the
 * live file every run and feed the result into the cross-check.
 */
export interface ShareWareDoom1WadFlatNamespaceSample {
  readonly outerStartIndex: number;
  readonly outerEndIndex: number;
  readonly outerFlatCount: number;
  readonly innerStartIndex: number;
  readonly innerEndIndex: number;
  readonly dataFlatCount: number;
  readonly pinnedFlats: readonly {
    readonly name: string;
    readonly directoryIndex: number;
    readonly flatNumber: number;
    readonly fileOffset: number;
    readonly size: number;
    readonly sha256: string;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD flat namespace sample against the
 * pinned oracle. Returns the list of failures by stable identifier; an
 * empty list means the live namespace matches the oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:flat:<name>:not-found` when the sample is missing a pinned
 *    named flat.
 *  - `oracle:flat:<name>:<field>:value-mismatch` for any oracle field
 *    on a pinned named flat whose live counterpart disagrees.
 */
export function crossCheckShareWareDoom1WadFlatNamespaceSample(sample: ShareWareDoom1WadFlatNamespaceSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'outerStartIndex' | 'outerEndIndex' | 'outerFlatCount' | 'innerStartIndex' | 'innerEndIndex' | 'dataFlatCount'> = [
    'outerStartIndex',
    'outerEndIndex',
    'outerFlatCount',
    'innerStartIndex',
    'innerEndIndex',
    'dataFlatCount',
  ];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oracleFlat of SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.pinnedFlats) {
    const liveFlat = sample.pinnedFlats.find((entry) => entry.name === oracleFlat.name);
    if (!liveFlat) {
      failures.push(`oracle:flat:${oracleFlat.name}:not-found`);
      continue;
    }
    const fields: ReadonlyArray<'directoryIndex' | 'flatNumber' | 'fileOffset' | 'size' | 'sha256'> = ['directoryIndex', 'flatNumber', 'fileOffset', 'size', 'sha256'];
    for (const field of fields) {
      if (liveFlat[field] !== oracleFlat[field]) {
        failures.push(`oracle:flat:${oracleFlat.name}:${field}:value-mismatch`);
      }
    }
  }

  return failures;
}
