/**
 * Audit ledger for the vanilla DOOM 1.9 marker range semantics implemented
 * by `src/wad/markerRange.ts` on top of the lump-name lookup contract that
 * `src/wad/lumpLookup.ts` and the load-order produced by `W_AddFile` in
 * Chocolate Doom 2.2.1's `src/w_wad.c` together establish.
 *
 * Each entry pins one axis of the `_START`/`_END` marker pair contract that
 * `R_InitFlats`, `R_InitSpriteLumps`, and the patch lookup paths in
 * `src/r_data.c` use to resolve the contiguous span of lumps between two
 * named markers. The accompanying focused test imports the runtime
 * `resolveMarkerRange` helper plus the local `doom/DOOM1.WAD` oracle and
 * cross-checks every audit entry against the live runtime behavior. If a
 * future change silently flips the off-by-one bounds (`+1` / `-1`),
 * de-duplicates inner sub-markers, breaks last-marker-wins on duplicate
 * marker names, or relaxes the strict `endIndex > startIndex` ordering
 * constraint, the audit ledger and the focused test together reject the
 * change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/w_wad.c`, `src/w_wad.h`,
 *      `src/r_data.c`, `src/p_setup.c`).
 *
 * The semantic audit declarations below are pinned against authority 5
 * because the C function bodies of `R_InitFlats`, `R_InitSpriteLumps`,
 * `R_InitPatches`, and `W_CheckNumForName` are textual constants the binary
 * cannot disagree with: the off-by-one bounds, the inclusive-count formula,
 * and the marker-pair convention are properties of the source functions,
 * not of any runtime register state. The shareware `DOOM1.WAD` marker
 * oracle facts (S_START at index 552, F_START at index 1206, etc.) are
 * pinned against authority 2 — the local IWAD itself — and re-derived from
 * the on-disk file every test run.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited behavioral axis of the `_START`/`_END` marker pair contract,
 * pinned to its upstream Chocolate Doom 2.2.1 declaration.
 */
export interface MarkerRangeSemanticAuditEntry {
  /** Stable identifier of the semantic axis. */
  readonly id:
    | 'inclusive-count-formula'
    | 'first-content-index-is-start-plus-one'
    | 'last-content-index-is-end-minus-one'
    | 'inner-markers-are-counted-as-content'
    | 'last-marker-wins-on-duplicate-names'
    | 'case-insensitive-marker-name-lookup'
    | 'end-must-strictly-follow-start'
    | 'missing-marker-throws-w-get-num-for-name';
  /** Which upstream C source function or runtime API this axis is pinned to. */
  readonly source: 'R_InitFlats' | 'R_InitSpriteLumps' | 'W_CheckNumForName' | 'W_GetNumForName' | 'resolveMarkerRange';
  /** Verbatim C source line(s) or runtime declaration line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree, or the runtime module path for runtime-only axes. */
  readonly referenceSourceFile: 'src/r_data.c' | 'src/w_wad.c' | 'src/wad/markerRange.ts';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every behavioral axis of the `_START`/`_END` marker pair
 * contract that the runtime `resolveMarkerRange` helper plus its caller-
 * provided directory must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every entry is reflected by an observable runtime behavior.
 */
export const MARKER_RANGE_SEMANTIC_AUDIT: readonly MarkerRangeSemanticAuditEntry[] = [
  {
    id: 'inclusive-count-formula',
    source: 'R_InitFlats',
    cSourceLines: ['firstflat = W_GetNumForName ("F_START") + 1;', 'lastflat = W_GetNumForName ("F_END") - 1;', 'numflats = lastflat - firstflat + 1;'],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      '`R_InitFlats` derives the number of flats between the F_START and F_END markers as `lastflat - firstflat + 1`. The `+1` makes the range inclusive of both endpoints (`firstflat` and `lastflat` are content lumps, not the markers themselves). The runtime models this with `count = endMarkerIndex - startMarkerIndex - 1`, which is the same value: `(end - 1) - (start + 1) + 1 == end - start - 1`.',
  },
  {
    id: 'first-content-index-is-start-plus-one',
    source: 'R_InitFlats',
    cSourceLines: ['firstflat = W_GetNumForName ("F_START") + 1;'],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      'The first content lump in a marker range sits at `startMarkerIndex + 1`. The marker itself is excluded; only the lumps strictly after the start marker contribute to the range. The runtime models this with `firstContentIndex = startMarkerIndex + 1`.',
  },
  {
    id: 'last-content-index-is-end-minus-one',
    source: 'R_InitFlats',
    cSourceLines: ['lastflat = W_GetNumForName ("F_END") - 1;'],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      'The last content lump in a marker range sits at `endMarkerIndex - 1`. The end marker itself is excluded; only the lumps strictly before the end marker contribute to the range. The runtime models this with `lastContentIndex = endMarkerIndex - 1`.',
  },
  {
    id: 'inner-markers-are-counted-as-content',
    source: 'R_InitSpriteLumps',
    cSourceLines: ['firstspritelump = W_GetNumForName ("S_START") + 1;', 'lastspritelump = W_GetNumForName ("S_END") - 1;', 'numspritelumps = lastspritelump - firstspritelump + 1;'],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      'Within an outer marker range (e.g. F_START..F_END), inner sub-markers (e.g. F1_START, F1_END) occupy directory slots and are counted by the inclusive-count formula. Vanilla does not skip them when computing `numflats`; downstream code (`R_FlatNumForName`, animated-flat lookups) consults the flat translation table by index, so every slot in the range — marker or not — receives a consecutive number. The runtime mirrors this: `MarkerRange.count` includes inner markers, and per-namespace catalog builders (`buildFlatCatalog`, `buildPatchCatalog`) flag them via an `isMarker` bit so callers that need a data-only count can derive `dataCount = count - innerMarkerCount`.',
  },
  {
    id: 'last-marker-wins-on-duplicate-names',
    source: 'W_CheckNumForName',
    cSourceLines: ['// scan backwards so patch lump files take precedence', 'for (i = numlumps_total - 1; i >= 0; --i)', '{', 'if (!strncasecmp(lumpinfo[i]->name, name, 8))', 'return i;', '}'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'When a marker name appears multiple times across the assembled lumpinfo array (e.g. an IWAD ships `S_START`/`S_END` and a PWAD appends another `S_START`/`S_END` pair to add custom sprites), `W_GetNumForName` resolves to the LAST occurrence because `W_CheckNumForName` scans backwards from `numlumps_total - 1`. `resolveMarkerRange` walks the directory once and remembers the last hit for each marker name, producing the same result.',
  },
  {
    id: 'case-insensitive-marker-name-lookup',
    source: 'W_GetNumForName',
    cSourceLines: ['strncpy (name8,name,8);', 'name8[8] = 0;', '// case insensitive', 'strupr (name8);'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      '`W_GetNumForName` uppercases its input before scanning, and `strncasecmp` in the backwards scan ignores case. Marker name resolution is therefore case-insensitive: `s_start`, `S_start`, and `S_START` all resolve to the same marker entry. The runtime models this by uppercasing both the search names and the directory entry names with `String.prototype.toUpperCase()` before comparing.',
  },
  {
    id: 'end-must-strictly-follow-start',
    source: 'resolveMarkerRange',
    cSourceLines: ['if (endIndex <= startIndex) {', 'throw new Error(`Marker ${endUpper} at index ${endIndex} must come after ${startUpper} at index ${startIndex}`);', '}'],
    referenceSourceFile: 'src/wad/markerRange.ts',
    invariant:
      'A valid marker range requires `endMarkerIndex > startMarkerIndex` strictly. When the end marker resolves to the same index as the start marker, or to a lower index, the range is rejected because the inclusive-count formula would otherwise produce zero or negative content slots while still claiming a non-empty span. The runtime throws an `Error` whose message names both markers and both indices, so callers (and tests) can identify the failure deterministically.',
  },
  {
    id: 'missing-marker-throws-w-get-num-for-name',
    source: 'W_GetNumForName',
    cSourceLines: ['i = W_CheckNumForName (name);', 'if (i == -1)', 'I_Error ("W_GetNumForName: %s not found!", name);'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'When either marker is absent from the directory, `W_GetNumForName` calls `I_Error` with the prefix `W_GetNumForName: ` followed by the missing name and the suffix ` not found!`. The runtime models this by throwing an `Error` whose message starts with `W_GetNumForName: ` and ends with ` not found!`, preserving the prefix and suffix so `expect(...).toThrow(/W_GetNumForName: .* not found/)` keeps matching for either the start or the end marker.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top of
 * the raw audit entries. Failures point at concrete identities that any
 * vanilla parity rebuild must preserve.
 */
export interface MarkerRangeDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const MARKER_RANGE_DERIVED_INVARIANTS: readonly MarkerRangeDerivedInvariant[] = [
  {
    id: 'COUNT_EQUALS_END_MINUS_START_MINUS_ONE',
    description:
      'For every resolved range, `count === endMarkerIndex - startMarkerIndex - 1`. This is the runtime restatement of the vanilla `numflats = lastflat - firstflat + 1` formula after substituting `firstflat = startMarkerIndex + 1` and `lastflat = endMarkerIndex - 1`.',
  },
  {
    id: 'FIRST_CONTENT_INDEX_EQUALS_START_PLUS_ONE',
    description: 'For every resolved range, `firstContentIndex === startMarkerIndex + 1`. The marker itself is never a content lump.',
  },
  {
    id: 'LAST_CONTENT_INDEX_EQUALS_END_MINUS_ONE',
    description: 'For every resolved range, `lastContentIndex === endMarkerIndex - 1`. The end marker itself is never a content lump.',
  },
  {
    id: 'CONTENT_INDICES_FORM_A_CONTIGUOUS_SPAN',
    description: 'The content indices `firstContentIndex..lastContentIndex` form a contiguous span: every directory index in the closed interval is a content slot, and the span length equals `count`.',
  },
  {
    id: 'EMPTY_RANGE_PRODUCES_ZERO_COUNT',
    description:
      'When the start and end markers are adjacent (`endMarkerIndex === startMarkerIndex + 1`), `count === 0` and the range carries no content lumps. `firstContentIndex === lastContentIndex + 1`, signaling an empty closed interval.',
  },
  {
    id: 'INNER_MARKERS_INSIDE_OUTER_RANGE_ARE_COUNTED',
    description:
      'Inner sub-markers like `F1_START` and `F1_END` that sit between an outer pair like `F_START`/`F_END` are counted in the outer range. `outerCount === innerCount + 2 + (otherInnerMarkerLumps)`. For shareware DOOM1.WAD the outer F range has count 56 and the inner F1 range has count 54; the difference is exactly the two inner markers.',
  },
  {
    id: 'LAST_MARKER_WINS_ON_DUPLICATE_NAMES',
    description:
      'Resolving a range against a directory containing two `X_START` entries (at indices 0 and 3) and two `X_END` entries (at indices 2 and 6) yields `startMarkerIndex === 3` and `endMarkerIndex === 6`. `resolveMarkerRange` always picks the last occurrence of each marker name.',
  },
  {
    id: 'CASE_INSENSITIVE_MARKER_LOOKUP',
    description: 'Resolving the range against `s_start`, `S_Start`, `S_START`, and any other case-folded variant against the same directory yields the same `MarkerRange` object (deep-equal).',
  },
  {
    id: 'END_BEFORE_START_IS_REJECTED',
    description: 'Calling `resolveMarkerRange(directory, "S_END", "S_START")` (markers swapped) throws an `Error` whose message contains "must come after". The runtime never returns an invalid range with a negative or zero content count.',
  },
  {
    id: 'MISSING_MARKER_IS_REJECTED',
    description:
      'Calling `resolveMarkerRange(directory, "NOTEXIST", "S_END")` or `(directory, "S_START", "NOTEXIST")` throws an `Error` whose message contains `W_GetNumForName: NOTEXIST not found!`, mirroring the upstream `I_Error` call when `W_CheckNumForName` returns `-1`.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/**
 * Snapshot of the marker range behavior exposed by the runtime
 * `resolveMarkerRange` helper for a known directory. The cross-check helper
 * consumes this shape so the focused test can both verify the live runtime
 * exports and exercise a deliberately tampered snapshot to prove the
 * failure modes are observable.
 */
export interface MarkerRangeSnapshot {
  /** S_START..S_END resolved against the live shareware IWAD. */
  readonly liveSpriteRange: { readonly startMarkerIndex: number; readonly endMarkerIndex: number; readonly firstContentIndex: number; readonly lastContentIndex: number; readonly count: number };
  /** F_START..F_END resolved against the live shareware IWAD (outer flat range, includes F1_START/F1_END inner markers). */
  readonly liveOuterFlatRange: { readonly startMarkerIndex: number; readonly endMarkerIndex: number; readonly firstContentIndex: number; readonly lastContentIndex: number; readonly count: number };
  /** F1_START..F1_END resolved against the live shareware IWAD (inner flat range, data flats only). */
  readonly liveInnerFlatRange: { readonly startMarkerIndex: number; readonly endMarkerIndex: number; readonly firstContentIndex: number; readonly lastContentIndex: number; readonly count: number };
  /** Resolution against a synthetic directory whose markers appear twice each (`X_START` at indices 0 and 3; `X_END` at indices 2 and 6). */
  readonly syntheticDuplicateMarkers: { readonly startMarkerIndex: number; readonly endMarkerIndex: number; readonly count: number };
  /** Resolution against a synthetic directory with adjacent markers (`Y_START` at index 0, `Y_END` at index 1). */
  readonly syntheticAdjacentMarkers: { readonly startMarkerIndex: number; readonly endMarkerIndex: number; readonly firstContentIndex: number; readonly lastContentIndex: number; readonly count: number };
  /** Resolution against a synthetic directory using mixed-case marker names (`s_start`/`S_End`). */
  readonly syntheticCaseInsensitive: { readonly startMarkerIndex: number; readonly endMarkerIndex: number; readonly count: number };
  /** Whether resolving against a directory missing the start marker throws the expected `W_GetNumForName` error. */
  readonly missingStartMarkerThrows: boolean;
  /** Whether resolving against a directory missing the end marker throws the expected `W_GetNumForName` error. */
  readonly missingEndMarkerThrows: boolean;
  /** Whether swapping the start and end marker names produces a "must come after" error. */
  readonly endBeforeStartThrows: boolean;
}

/**
 * Cross-check a `MarkerRangeSnapshot` against `MARKER_RANGE_SEMANTIC_AUDIT`
 * and `MARKER_RANGE_DERIVED_INVARIANTS`. Returns the list of failures by
 * stable identifier; an empty list means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckMarkerRangeSemantics(snapshot: MarkerRangeSnapshot): readonly string[] {
  const failures: string[] = [];

  const ranges = [snapshot.liveSpriteRange, snapshot.liveOuterFlatRange, snapshot.liveInnerFlatRange, snapshot.syntheticAdjacentMarkers];

  for (const range of ranges) {
    if (range.count !== range.endMarkerIndex - range.startMarkerIndex - 1) {
      failures.push('derived:COUNT_EQUALS_END_MINUS_START_MINUS_ONE');
      failures.push('audit:inclusive-count-formula:not-observed');
      break;
    }
  }

  for (const range of ranges) {
    if (range.firstContentIndex !== range.startMarkerIndex + 1) {
      failures.push('derived:FIRST_CONTENT_INDEX_EQUALS_START_PLUS_ONE');
      failures.push('audit:first-content-index-is-start-plus-one:not-observed');
      break;
    }
  }

  for (const range of ranges) {
    if (range.lastContentIndex !== range.endMarkerIndex - 1) {
      failures.push('derived:LAST_CONTENT_INDEX_EQUALS_END_MINUS_ONE');
      failures.push('audit:last-content-index-is-end-minus-one:not-observed');
      break;
    }
  }

  for (const range of ranges) {
    const span = range.lastContentIndex - range.firstContentIndex + 1;
    if (range.count !== Math.max(0, span)) {
      failures.push('derived:CONTENT_INDICES_FORM_A_CONTIGUOUS_SPAN');
      break;
    }
  }

  if (snapshot.syntheticAdjacentMarkers.count !== 0 || snapshot.syntheticAdjacentMarkers.firstContentIndex !== snapshot.syntheticAdjacentMarkers.lastContentIndex + 1) {
    failures.push('derived:EMPTY_RANGE_PRODUCES_ZERO_COUNT');
  }

  if (snapshot.liveOuterFlatRange.count !== snapshot.liveInnerFlatRange.count + 2) {
    failures.push('derived:INNER_MARKERS_INSIDE_OUTER_RANGE_ARE_COUNTED');
    failures.push('audit:inner-markers-are-counted-as-content:not-observed');
  }

  if (snapshot.syntheticDuplicateMarkers.startMarkerIndex !== 3 || snapshot.syntheticDuplicateMarkers.endMarkerIndex !== 6 || snapshot.syntheticDuplicateMarkers.count !== 2) {
    failures.push('derived:LAST_MARKER_WINS_ON_DUPLICATE_NAMES');
    failures.push('audit:last-marker-wins-on-duplicate-names:not-observed');
  }

  if (
    snapshot.syntheticCaseInsensitive.startMarkerIndex !== snapshot.liveSpriteRange.startMarkerIndex ||
    snapshot.syntheticCaseInsensitive.endMarkerIndex !== snapshot.liveSpriteRange.endMarkerIndex ||
    snapshot.syntheticCaseInsensitive.count !== snapshot.liveSpriteRange.count
  ) {
    failures.push('derived:CASE_INSENSITIVE_MARKER_LOOKUP');
    failures.push('audit:case-insensitive-marker-name-lookup:not-observed');
  }

  if (!snapshot.endBeforeStartThrows) {
    failures.push('derived:END_BEFORE_START_IS_REJECTED');
    failures.push('audit:end-must-strictly-follow-start:not-observed');
  }

  if (!snapshot.missingStartMarkerThrows || !snapshot.missingEndMarkerThrows) {
    failures.push('derived:MISSING_MARKER_IS_REJECTED');
    failures.push('audit:missing-marker-throws-w-get-num-for-name:not-observed');
  }

  const declaredAxes = new Set(MARKER_RANGE_SEMANTIC_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<MarkerRangeSemanticAuditEntry['id']> = [
    'inclusive-count-formula',
    'first-content-index-is-start-plus-one',
    'last-content-index-is-end-minus-one',
    'inner-markers-are-counted-as-content',
    'last-marker-wins-on-duplicate-names',
    'case-insensitive-marker-name-lookup',
    'end-must-strictly-follow-start',
    'missing-marker-throws-w-get-num-for-name',
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
 * Pinned facts about the marker layout of the local shareware
 * `doom/DOOM1.WAD` IWAD that the focused test cross-checks against the
 * live `resolveMarkerRange` calls built from the on-disk file. Sourced
 * from authority 2 (the local IWAD itself, parsed once by hand) and
 * cross-referenced with `reference/manifests/wad-map-summary.json`
 * (`lumpCategories.sprite: 483`, `lumpCategories.flat: 56`,
 * `lumpCategories.patch: 165`, `lumpCategories.marker: 8`).
 *
 * Outer ranges include inner sub-markers in their `count` value because the
 * inclusive-count formula does not skip them. `dataCount` excludes inner
 * sub-markers (size-zero entries inside the range) so it matches the
 * downstream sprite/patch/flat manifest counts when no inner markers are
 * present, and matches the data-only count when they are.
 */
export interface ShareWareDoom1WadMarkerOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Directory index of the `S_START` marker in shareware DOOM1.WAD. */
  readonly spriteStartIndex: 552;
  /** Directory index of the `S_END` marker in shareware DOOM1.WAD. */
  readonly spriteEndIndex: 1036;
  /** Number of sprite lumps between the markers (S_START..S_END contains 483 lumps; no inner markers). */
  readonly spriteCount: 483;
  /** Directory index of the `F_START` marker in shareware DOOM1.WAD. */
  readonly outerFlatStartIndex: 1206;
  /** Directory index of the `F_END` marker in shareware DOOM1.WAD. */
  readonly outerFlatEndIndex: 1263;
  /** Number of entries between F_START and F_END (includes F1_START and F1_END inner markers). */
  readonly outerFlatCount: 56;
  /** Directory index of the `F1_START` inner marker. */
  readonly innerFlatStartIndex: 1207;
  /** Directory index of the `F1_END` inner marker. */
  readonly innerFlatEndIndex: 1262;
  /** Number of data flats between F1_START and F1_END (no inner markers). */
  readonly innerFlatCount: 54;
  /** Directory index of the `P_START` marker in shareware DOOM1.WAD. */
  readonly outerPatchStartIndex: 1037;
  /** Directory index of the `P_END` marker in shareware DOOM1.WAD. */
  readonly outerPatchEndIndex: 1205;
  /** Number of entries between P_START and P_END (includes P1_START and P1_END inner markers). */
  readonly outerPatchCount: 167;
  /** Directory index of the `P1_START` inner marker. */
  readonly innerPatchStartIndex: 1038;
  /** Directory index of the `P1_END` inner marker. */
  readonly innerPatchEndIndex: 1204;
  /** Number of data patches between P1_START and P1_END (no inner markers). */
  readonly innerPatchCount: 165;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` marker layout. */
export const SHAREWARE_DOOM1_WAD_MARKER_ORACLE: ShareWareDoom1WadMarkerOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  spriteStartIndex: 552,
  spriteEndIndex: 1036,
  spriteCount: 483,
  outerFlatStartIndex: 1206,
  outerFlatEndIndex: 1263,
  outerFlatCount: 56,
  innerFlatStartIndex: 1207,
  innerFlatEndIndex: 1262,
  innerFlatCount: 54,
  outerPatchStartIndex: 1037,
  outerPatchEndIndex: 1205,
  outerPatchCount: 167,
  innerPatchStartIndex: 1038,
  innerPatchEndIndex: 1204,
  innerPatchCount: 165,
}) as ShareWareDoom1WadMarkerOracle;

/**
 * Sample shape mirroring the runtime `resolveMarkerRange` query results so
 * the focused test can call the live helper directly and feed the result
 * into the cross-check helper.
 */
export interface ShareWareDoom1WadMarkerSample {
  readonly spriteStartIndex: number;
  readonly spriteEndIndex: number;
  readonly spriteCount: number;
  readonly outerFlatStartIndex: number;
  readonly outerFlatEndIndex: number;
  readonly outerFlatCount: number;
  readonly innerFlatStartIndex: number;
  readonly innerFlatEndIndex: number;
  readonly innerFlatCount: number;
  readonly outerPatchStartIndex: number;
  readonly outerPatchEndIndex: number;
  readonly outerPatchCount: number;
  readonly innerPatchStartIndex: number;
  readonly innerPatchEndIndex: number;
  readonly innerPatchCount: number;
}

/**
 * Cross-check a shareware DOOM1.WAD marker layout sample against the
 * pinned oracle. Returns the list of failures by stable identifier; an
 * empty list means the live marker layout matches the oracle.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle field whose live
 *    counterpart disagrees with the pinned value.
 */
export function crossCheckShareWareDoom1WadMarkerSample(sample: ShareWareDoom1WadMarkerSample): readonly string[] {
  const failures: string[] = [];

  const fields: ReadonlyArray<keyof ShareWareDoom1WadMarkerSample & keyof Omit<ShareWareDoom1WadMarkerOracle, 'filename'>> = [
    'spriteStartIndex',
    'spriteEndIndex',
    'spriteCount',
    'outerFlatStartIndex',
    'outerFlatEndIndex',
    'outerFlatCount',
    'innerFlatStartIndex',
    'innerFlatEndIndex',
    'innerFlatCount',
    'outerPatchStartIndex',
    'outerPatchEndIndex',
    'outerPatchCount',
    'innerPatchStartIndex',
    'innerPatchEndIndex',
    'innerPatchCount',
  ];

  for (const field of fields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_MARKER_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Build a synthetic directory containing two `X_START` entries (indices 0
 * and 3) and two `X_END` entries (indices 2 and 6) so the focused test can
 * exercise the last-marker-wins precedence axis without depending on a
 * PWAD that defines a duplicate marker pair. The intervening entries
 * `A`, `B`, and `C` carry non-zero sizes so they are clearly distinguishable
 * from the marker entries.
 */
export function buildSyntheticDuplicateMarkerDirectory(): readonly DirectoryEntry[] {
  return Object.freeze([
    Object.freeze({ offset: 0, size: 0, name: 'X_START' }),
    Object.freeze({ offset: 0, size: 100, name: 'A' }),
    Object.freeze({ offset: 0, size: 0, name: 'X_END' }),
    Object.freeze({ offset: 0, size: 0, name: 'X_START' }),
    Object.freeze({ offset: 0, size: 200, name: 'B' }),
    Object.freeze({ offset: 0, size: 300, name: 'C' }),
    Object.freeze({ offset: 0, size: 0, name: 'X_END' }),
  ]);
}

/**
 * Build a synthetic directory whose start and end markers are adjacent
 * (`Y_START` at index 0, `Y_END` at index 1) so the focused test can
 * exercise the empty-range axis without scanning the live IWAD for a
 * pre-existing zero-content range.
 */
export function buildSyntheticAdjacentMarkerDirectory(): readonly DirectoryEntry[] {
  return Object.freeze([Object.freeze({ offset: 0, size: 0, name: 'Y_START' }), Object.freeze({ offset: 0, size: 0, name: 'Y_END' })]);
}
