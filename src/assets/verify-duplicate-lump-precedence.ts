/**
 * Audit ledger for the vanilla DOOM 1.9 duplicate-lump precedence semantics
 * implemented by `src/wad/lumpLookup.ts` on top of the load order produced by
 * `W_AddFile` in Chocolate Doom 2.2.1's `src/w_wad.c`.
 *
 * Each entry pins one axis of the load-order plus lookup contract that
 * establishes which entry "wins" when multiple directory entries share a
 * lump name. The accompanying focused test imports the runtime
 * `LumpLookup` class plus the local `doom/DOOM1.WAD` oracle and
 * cross-checks every audit entry against the live runtime behavior. If a
 * future change silently de-duplicates lumps during directory assembly,
 * reorders entries within a WAD, breaks the PWAD-overrides-IWAD precedence,
 * or removes the `getAllIndicesForName` enumeration that exposes every
 * duplicate, the audit ledger and the focused test together reject the
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
 * because the C function bodies of `W_AddFile` and `W_CheckNumForName` are
 * textual constants the binary cannot disagree with: every append, scan
 * direction, and precedence rule is a property of the source function, not
 * of any runtime register state. The shareware `DOOM1.WAD` duplicate-count
 * oracle facts (nine duplicates per per-map lump, single occurrence for
 * global lumps such as PLAYPAL/COLORMAP/TEXTURE1) are pinned against
 * authority 2 — the local IWAD itself — and re-derived from the on-disk
 * file every test run.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited behavioral axis of the load-order plus lookup contract that
 * establishes duplicate lump precedence, pinned to its upstream Chocolate
 * Doom 2.2.1 declaration.
 */
export interface DuplicateLumpPrecedenceAuditEntry {
  /** Stable identifier of the precedence axis. */
  readonly id: 'append-only-load-order' | 'intra-wad-duplicates-preserved' | 'directory-order-within-wad-preserved' | 'pwad-overrides-iwad' | 'enumerate-all-duplicates';
  /** Which upstream C function or runtime API this axis is pinned to. */
  readonly source: 'W_AddFile' | 'W_CheckNumForName' | 'LumpLookup.getAllIndicesForName';
  /** Verbatim C source line(s) or runtime declaration line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree, or the runtime module path for runtime-only axes. */
  readonly referenceSourceFile: 'src/w_wad.c' | 'src/wad/lumpLookup.ts';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every behavioral axis of the duplicate-lump precedence
 * contract that the runtime `LumpLookup` class plus its caller-provided
 * directory must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every entry is reflected by an observable runtime behavior.
 */
export const DUPLICATE_LUMP_PRECEDENCE_AUDIT: readonly DuplicateLumpPrecedenceAuditEntry[] = [
  {
    id: 'append-only-load-order',
    source: 'W_AddFile',
    cSourceLines: ['startlump = numlumps_total;', 'numlumps_total += numlumps;', 'lumpinfo = I_Realloc(lumpinfo, numlumps_total * sizeof(lumpinfo_t *));'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      '`W_AddFile` records the current `numlumps_total` as the insertion point, increases the total by the number of lumps in the new WAD, then reallocates `lumpinfo` to fit. New entries are written at indices `[startlump, numlumps_total)`; previously loaded entries are never renumbered or moved. The runtime models this by treating its constructor argument as the already-assembled directory: callers concatenate IWAD then PWAD entries in load order before constructing a `LumpLookup`.',
  },
  {
    id: 'intra-wad-duplicates-preserved',
    source: 'W_AddFile',
    cSourceLines: ['for (i = startlump; i < numlumps_total; ++i)', '{', 'lumpinfo_t *lump_p = &filelumps[i - startlump];', 'strncpy(lump_p->name, filerover->name, 8);', 'lumpinfo[i] = lump_p;', '++filerover;', '}'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      '`W_AddFile` walks every directory entry in the new WAD and copies its name into a fresh `lumpinfo_t` slot without consulting any previously loaded entry. There is no de-duplication step: a single WAD that contains repeated names (e.g. shareware `DOOM1.WAD`, where every map carries its own `THINGS`/`LINEDEFS`/`SIDEDEFS`/`VERTEXES`/`SEGS`/`SSECTORS`/`NODES`/`SECTORS`/`REJECT`/`BLOCKMAP`) yields one `lumpinfo` entry per occurrence. The runtime models this with a `Map` keyed on the uppercased name for fast last-match lookup plus the underlying directory array preserved verbatim for enumeration.',
  },
  {
    id: 'directory-order-within-wad-preserved',
    source: 'W_AddFile',
    cSourceLines: ['filerover = fileinfo;', 'for (i = startlump; i < numlumps_total; ++i)', 'lumpinfo[i] = lump_p;', '++filerover;'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      "Within a single `W_AddFile` invocation, the for-loop iterates `filerover` over the source WAD's `fileinfo` array in directory order and writes the corresponding `lumpinfo[i]` slot at strictly ascending `i`. P_SetupLevel relies on this — it locates a specific map's `THINGS`/`LINEDEFS`/`SIDEDEFS`/etc. lumps via `mapnum + ML_THINGS`, `mapnum + ML_LINEDEFS`, … offsets from the map marker index rather than via `W_GetNumForName`, which would only return the LAST occurrence and would be useless for any map other than the latest one in load order.",
  },
  {
    id: 'pwad-overrides-iwad',
    source: 'W_CheckNumForName',
    cSourceLines: ['// scan backwards so patch lump files take precedence', 'for (i = numlumps_total - 1; i >= 0; --i)', '{', 'if (!strncasecmp(lumpinfo[i]->name, name, 8))', 'return i;', '}'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'Combining append-only load order with the backwards scan in `W_CheckNumForName` produces the canonical PWAD override behavior: vanilla loads the IWAD first via `W_AddFile`, then each PWAD passed via `-file` is appended in command-line order, and the last appended entry with a given name is the first one the backwards scan returns. A PWAD that contains a `PLAYPAL` lump shadows the IWAD `PLAYPAL` for every caller of `W_CheckNumForName("PLAYPAL")`. The runtime models this with `Map.set` overwriting earlier values during construction so the cached index is always the last occurrence.',
  },
  {
    id: 'enumerate-all-duplicates',
    source: 'LumpLookup.getAllIndicesForName',
    cSourceLines: [
      'getAllIndicesForName(name: string): readonly number[] {',
      'const upper = name.toUpperCase();',
      'const indices: number[] = [];',
      'for (let i = 0; i < this.entries.length; i++) {',
      'if (this.entries[i]!.name.toUpperCase() === upper) {',
      'indices.push(i);',
      '}',
      '}',
      'return indices;',
      '}',
    ],
    referenceSourceFile: 'src/wad/lumpLookup.ts',
    invariant:
      '`LumpLookup.getAllIndicesForName` walks the directory in ascending order and returns every index whose uppercased name matches. This is the only API that exposes the intra-WAD duplicates that `checkNumForName` collapses to the last index, and it is the runtime equivalent of iterating `lumpinfo[]` and collecting matches by name. Callers that need to enumerate per-map lumps without going through the map-marker-plus-offset shortcut, or that need to inspect every PWAD override, MUST use this enumeration; `checkNumForName` alone is insufficient.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top of
 * the raw audit entries. Failures point at concrete identities that any
 * vanilla parity rebuild must preserve.
 */
export interface DuplicateLumpPrecedenceDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const DUPLICATE_LUMP_PRECEDENCE_DERIVED_INVARIANTS: readonly DuplicateLumpPrecedenceDerivedInvariant[] = [
  {
    id: 'LAST_INDEX_AGREES_WITH_GET_ALL_INDICES_TAIL',
    description:
      'For any name that exists in the directory, `checkNumForName(name)` equals the last element of `getAllIndicesForName(name)`. Both APIs see the same backing directory; the only difference is that the former collapses to the last match and the latter exposes every match.',
  },
  {
    id: 'GET_ALL_INDICES_RETURNS_ASCENDING_ORDER',
    description:
      '`getAllIndicesForName(name)` returns indices in strictly ascending directory order. This is what `P_SetupLevel`-style indexing relies on: the *first* occurrence of a duplicate name corresponds to the earliest map / earliest WAD in load order.',
  },
  {
    id: 'GET_ALL_INDICES_EMPTY_FOR_MISS',
    description: 'A name that does not match any directory entry yields an empty array from `getAllIndicesForName`, mirroring the `-1` sentinel returned by `checkNumForName` for the same miss.',
  },
  {
    id: 'PWAD_OVERRIDE_SHADOWS_IWAD_LUMP',
    description:
      'Building a synthetic combined directory whose first three entries are an "IWAD" sequence (`PLAYPAL@0`, `COLORMAP@1`, `TEXTURE1@2`) and whose fourth entry is a "PWAD" `PLAYPAL@3` yields `checkNumForName("PLAYPAL") === 3`. The original IWAD index `0` is still observable via `getAllIndicesForName("PLAYPAL")`.',
  },
  {
    id: 'MAP_DATA_LUMP_DUPLICATE_COUNT_EQUALS_MAP_COUNT',
    description:
      'In a single IWAD that contains N maps, every map-data lump name (`THINGS`, `LINEDEFS`, `SIDEDEFS`, `VERTEXES`, `SEGS`, `SSECTORS`, `NODES`, `SECTORS`, `REJECT`, `BLOCKMAP`) appears exactly N times — once per map. Shareware `DOOM1.WAD` carries E1M1 through E1M9, so each map-data name appears exactly 9 times.',
  },
  {
    id: 'GLOBAL_LUMP_HAS_NO_DUPLICATES_IN_IWAD',
    description:
      'In a single IWAD, global lumps such as `PLAYPAL`, `COLORMAP`, `TEXTURE1`, `PNAMES`, and `ENDOOM` appear exactly once. Duplicate lookup precedence only matters once at least one PWAD is loaded; the IWAD alone has no global-lump duplicates to override.',
  },
];

/**
 * Snapshot of the duplicate-lump precedence behavior exposed by the runtime
 * `LumpLookup` class for a known directory. The cross-check helper consumes
 * this shape so the focused test can both verify the live runtime exports
 * and exercise a deliberately tampered snapshot to prove the failure modes
 * are observable.
 */
export interface DuplicateLumpPrecedenceSnapshot {
  /** Result of `checkNumForName('PLAYPAL')` on the synthetic IWAD+PWAD directory. */
  readonly pwadOverrideCheck: number;
  /** Result of `getAllIndicesForName('PLAYPAL')` on the synthetic IWAD+PWAD directory. */
  readonly pwadOverrideAllIndices: readonly number[];
  /** Result of `checkNumForName('THINGS')` on the live shareware IWAD. */
  readonly liveThingsCheck: number;
  /** Result of `getAllIndicesForName('THINGS')` on the live shareware IWAD. */
  readonly liveThingsAllIndices: readonly number[];
  /** Result of `getAllIndicesForName('NOTEXIST')` on the live shareware IWAD. */
  readonly liveMissAllIndices: readonly number[];
  /** Result of `getAllIndicesForName('PLAYPAL')` on the live shareware IWAD (single occurrence in IWAD). */
  readonly livePlaypalAllIndices: readonly number[];
}

/**
 * Cross-check a `DuplicateLumpPrecedenceSnapshot` against
 * `DUPLICATE_LUMP_PRECEDENCE_AUDIT` and
 * `DUPLICATE_LUMP_PRECEDENCE_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckDuplicateLumpPrecedence(snapshot: DuplicateLumpPrecedenceSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.pwadOverrideCheck !== 3 || snapshot.pwadOverrideAllIndices.length !== 2 || snapshot.pwadOverrideAllIndices[0] !== 0 || snapshot.pwadOverrideAllIndices[1] !== 3) {
    failures.push('derived:PWAD_OVERRIDE_SHADOWS_IWAD_LUMP');
    failures.push('audit:pwad-overrides-iwad:not-observed');
  }

  if (snapshot.liveThingsAllIndices.length === 0 || snapshot.liveThingsCheck !== snapshot.liveThingsAllIndices.at(-1)) {
    failures.push('derived:LAST_INDEX_AGREES_WITH_GET_ALL_INDICES_TAIL');
    failures.push('audit:enumerate-all-duplicates:not-observed');
  }

  if (!isStrictlyAscending(snapshot.liveThingsAllIndices) || !isStrictlyAscending(snapshot.pwadOverrideAllIndices) || !isStrictlyAscending(snapshot.livePlaypalAllIndices)) {
    failures.push('derived:GET_ALL_INDICES_RETURNS_ASCENDING_ORDER');
    failures.push('audit:directory-order-within-wad-preserved:not-observed');
  }

  if (snapshot.liveMissAllIndices.length !== 0) {
    failures.push('derived:GET_ALL_INDICES_EMPTY_FOR_MISS');
  }

  if (snapshot.liveThingsAllIndices.length !== 9) {
    failures.push('derived:MAP_DATA_LUMP_DUPLICATE_COUNT_EQUALS_MAP_COUNT');
    failures.push('audit:intra-wad-duplicates-preserved:not-observed');
  }

  if (snapshot.livePlaypalAllIndices.length !== 1) {
    failures.push('derived:GLOBAL_LUMP_HAS_NO_DUPLICATES_IN_IWAD');
    failures.push('audit:append-only-load-order:not-observed');
  }

  return failures;
}

function isStrictlyAscending(indices: readonly number[]): boolean {
  for (let i = 1; i < indices.length; i++) {
    if (indices[i]! <= indices[i - 1]!) {
      return false;
    }
  }
  return true;
}

/**
 * Pinned facts about the duplicate-lump structure of the local shareware
 * `doom/DOOM1.WAD` IWAD that the focused test cross-checks against the
 * live `LumpLookup` instance built from the on-disk file. Sourced from
 * authority 2 (the local IWAD itself, parsed once by hand) and
 * cross-referenced with `reference/manifests/wad-map-summary.json`.
 */
export interface ShareWareDoom1WadDuplicateOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Number of maps in the shareware IWAD (E1M1 through E1M9). */
  readonly mapCount: 9;
  /** Number of times each map-data lump name appears in the shareware IWAD. */
  readonly mapDataDuplicateCount: 9;
  /**
   * Map-data lump names whose duplicate count equals `mapCount` in the
   * shareware IWAD. Sourced verbatim from
   * `reference/manifests/wad-map-summary.json` `mapLumpOrder`.
   */
  readonly mapDataLumpNames: readonly ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'];
  /** Global lump names that appear exactly once in the shareware IWAD (no duplicates). */
  readonly globalLumpNames: readonly ['PLAYPAL', 'COLORMAP', 'PNAMES', 'TEXTURE1', 'ENDOOM'];
  /** Map marker names that appear exactly once each in the shareware IWAD. */
  readonly mapMarkerNames: readonly ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'];
  /** Directory index of the first `THINGS` lump (E1M1 marker is at index 6, so its `THINGS` is at index 7). */
  readonly firstThingsIndex: 7;
  /** Directory index of the last `THINGS` lump (E1M9 marker is at index 94, so its `THINGS` is at index 95). */
  readonly lastThingsIndex: 95;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` duplicate-lump structure. */
export const SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE: ShareWareDoom1WadDuplicateOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  mapCount: 9,
  mapDataDuplicateCount: 9,
  mapDataLumpNames: Object.freeze(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']),
  globalLumpNames: Object.freeze(['PLAYPAL', 'COLORMAP', 'PNAMES', 'TEXTURE1', 'ENDOOM']),
  mapMarkerNames: Object.freeze(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']),
  firstThingsIndex: 7,
  lastThingsIndex: 95,
}) as ShareWareDoom1WadDuplicateOracle;

/**
 * Sample shape mirroring the runtime `LumpLookup` query results so the
 * focused test can call the live methods directly and feed the result
 * into the cross-check helper.
 */
export interface ShareWareDoom1WadDuplicateSample {
  readonly mapDataDuplicateCounts: readonly { readonly name: string; readonly count: number }[];
  readonly globalLumpDuplicateCounts: readonly { readonly name: string; readonly count: number }[];
  readonly mapMarkerDuplicateCounts: readonly { readonly name: string; readonly count: number }[];
  readonly firstThingsIndex: number;
  readonly lastThingsIndex: number;
}

/**
 * Cross-check a shareware DOOM1.WAD duplicate-structure sample against the
 * pinned oracle. Returns the list of failures by stable identifier; an
 * empty list means the live lookup matches the oracle.
 *
 * Identifiers used:
 *  - `oracle:mapDataDuplicateCount:<NAME>:value-mismatch`
 *  - `oracle:globalLumpDuplicateCount:<NAME>:value-mismatch`
 *  - `oracle:mapMarkerDuplicateCount:<NAME>:value-mismatch`
 *  - `oracle:firstThingsIndex:value-mismatch`
 *  - `oracle:lastThingsIndex:value-mismatch`
 */
export function crossCheckShareWareDoom1WadDuplicateSample(sample: ShareWareDoom1WadDuplicateSample): readonly string[] {
  const failures: string[] = [];

  for (const entry of sample.mapDataDuplicateCounts) {
    if (entry.count !== SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapDataDuplicateCount) {
      failures.push(`oracle:mapDataDuplicateCount:${entry.name}:value-mismatch`);
    }
  }
  for (const entry of sample.globalLumpDuplicateCounts) {
    if (entry.count !== 1) {
      failures.push(`oracle:globalLumpDuplicateCount:${entry.name}:value-mismatch`);
    }
  }
  for (const entry of sample.mapMarkerDuplicateCounts) {
    if (entry.count !== 1) {
      failures.push(`oracle:mapMarkerDuplicateCount:${entry.name}:value-mismatch`);
    }
  }
  if (sample.firstThingsIndex !== SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.firstThingsIndex) {
    failures.push('oracle:firstThingsIndex:value-mismatch');
  }
  if (sample.lastThingsIndex !== SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.lastThingsIndex) {
    failures.push('oracle:lastThingsIndex:value-mismatch');
  }

  return failures;
}

/**
 * Build a synthetic combined directory simulating one IWAD followed by one
 * PWAD that overrides a single global lump. The first three entries model
 * the IWAD sequence `PLAYPAL@0, COLORMAP@1, TEXTURE1@2`; the fourth entry
 * models a PWAD that contributes a single `PLAYPAL` override at index 3.
 *
 * Used by the focused test to exercise the PWAD-overrides-IWAD precedence
 * axis without committing any proprietary IWAD bytes to the test fixture.
 */
export function buildSyntheticPwadOverrideDirectory(): readonly DirectoryEntry[] {
  return Object.freeze([
    Object.freeze({ offset: 12, size: 10_752, name: 'PLAYPAL' }),
    Object.freeze({ offset: 10_764, size: 8_704, name: 'COLORMAP' }),
    Object.freeze({ offset: 19_468, size: 32_672, name: 'TEXTURE1' }),
    Object.freeze({ offset: 52_140, size: 10_752, name: 'PLAYPAL' }),
  ]);
}
