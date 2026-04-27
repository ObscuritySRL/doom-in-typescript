/**
 * Audit ledger for the vanilla DOOM 1.9 lump name lookup semantics
 * implemented by `src/wad/lumpLookup.ts`.
 *
 * Each entry pins one behavioral axis of `W_CheckNumForName` and
 * `W_GetNumForName` to its upstream Chocolate Doom 2.2.1 declaration in
 * `src/w_wad.c`. The accompanying focused test imports the runtime
 * `LumpLookup` class plus the local `doom/DOOM1.WAD` oracle and
 * cross-checks every audit entry against the live runtime behavior. If a
 * future change silently drops case-insensitivity, breaks last-match-wins
 * (PWAD override) semantics, alters the miss-returns-negative-one contract
 * for `checkNumForName`, or removes the throw-on-miss contract for
 * `getNumForName`, the audit ledger and the focused test together reject
 * the change.
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
 * because the C function bodies of `W_CheckNumForName` and
 * `W_GetNumForName` are textual constants the binary cannot disagree with:
 * every comparison rule and return value is a property of the source
 * function, not of any runtime register state. The shareware `DOOM1.WAD`
 * lookup oracle facts (PLAYPAL at index 0, COLORMAP at index 1, E1M1
 * presence, TEXTURE2 absence) are pinned against authority 2 — the local
 * IWAD itself — and re-derived from the on-disk file every test run.
 */

/**
 * One audited behavioral axis of `W_CheckNumForName` / `W_GetNumForName`
 * pinned to its upstream Chocolate Doom 2.2.1 declaration.
 */
export interface LumpLookupSemanticAuditEntry {
  /** Stable identifier of the semantic axis. */
  readonly id: 'case-insensitivity' | 'last-match-wins' | 'eight-byte-name-field' | 'check-miss-returns-negative-one' | 'get-throws-on-miss';
  /** Which upstream C function this axis is pinned to. */
  readonly cFunction: 'W_CheckNumForName' | 'W_GetNumForName';
  /** Verbatim C source line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/w_wad.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every behavioral axis of the upstream lump name lookup
 * functions that the runtime `LumpLookup` class must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every entry is reflected by an observable runtime behavior.
 */
export const LUMP_LOOKUP_SEMANTIC_AUDIT: readonly LumpLookupSemanticAuditEntry[] = [
  {
    id: 'case-insensitivity',
    cFunction: 'W_CheckNumForName',
    cSourceLines: ['strncpy (name8,name,8);', 'name8[8] = 0;', '// case insensitive', 'strupr (name8);'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'The lookup uppercases the search name before comparison. Every directory entry name participates in the lookup as if uppercased, so case-different inputs that fold to the same uppercase form must resolve to the same lump index. The runtime models this with `name.toUpperCase()` on both the lookup input and the cached map keys.',
  },
  {
    id: 'last-match-wins',
    cFunction: 'W_CheckNumForName',
    cSourceLines: ['// scan backwards so patch lump files take precedence', 'lump_p = lumpinfo + numlumps;', 'while (lump_p-- != lumpinfo)'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'When multiple directory entries share the same uppercased name, the lookup returns the index of the LAST one. Vanilla scans the directory backwards from `numlumps - 1` to `0` and returns the first hit; the runtime models this with `Map.set` overwriting earlier values during construction so the cached index is always the last occurrence. This is the PWAD override mechanism — a patch-WAD entry appended to the directory shadows an IWAD entry with the same name.',
  },
  {
    id: 'eight-byte-name-field',
    cFunction: 'W_CheckNumForName',
    cSourceLines: ['char	name8[9];', 'long long v1;', 'long long v2;', 'v1 = *(long long *)name8;', 'v2 = *(long long *)lump_p->name;'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'Name comparison is performed against the 8-byte `lumpinfo_t.name` field. Vanilla casts both the search name and the directory entry name to `long long` and compares them as 64-bit integers, which is byte-for-byte equality across exactly 8 bytes. The runtime models this by parsing `filelump_t.name` as up to 8 ASCII bytes (trailing nulls stripped by `parseWadDirectory`) and storing them as JavaScript strings — equivalent for any name that fits within 8 bytes, which every lump in every shipped IWAD does.',
  },
  {
    id: 'check-miss-returns-negative-one',
    cFunction: 'W_CheckNumForName',
    cSourceLines: ['// TFB. Not found.', 'return -1;'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      '`W_CheckNumForName` returns `-1` when no directory entry matches the search name. The runtime `LumpLookup.checkNumForName` returns `-1` for misses via `Map.get(...) ?? -1`, preserving the sentinel value so callers that test `idx === -1` keep working unchanged.',
  },
  {
    id: 'get-throws-on-miss',
    cFunction: 'W_GetNumForName',
    cSourceLines: ['i = W_CheckNumForName (name);', 'if (i == -1)', 'I_Error ("W_GetNumForName: %s not found!", name);'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      '`W_GetNumForName` calls through to `W_CheckNumForName` and then errors out via `I_Error` when the result is `-1`. The runtime models this with `LumpLookup.getNumForName` throwing an `Error` whose message starts with `W_GetNumForName: ` followed by the missing name and ends with ` not found!`, preserving the error-message prefix and suffix so `expect(...).toThrow(/W_GetNumForName: .* not found/)` keeps matching.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top of
 * the raw semantic audit entries. Failures point at concrete identities
 * that any vanilla parity rebuild must preserve.
 */
export interface LumpLookupDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const LUMP_LOOKUP_DERIVED_INVARIANTS: readonly LumpLookupDerivedInvariant[] = [
  {
    id: 'CHECK_NUM_FOR_NAME_IS_CASE_INSENSITIVE',
    description: 'Looking up `playpal`, `Playpal`, `PlayPal`, and `PLAYPAL` against the same directory all return the same lump index.',
  },
  {
    id: 'CHECK_NUM_FOR_NAME_LAST_MATCH_WINS',
    description: 'Building a synthetic directory with two entries named `FOO` (at indices 0 and 2) yields `checkNumForName("FOO") === 2`.',
  },
  {
    id: 'CHECK_NUM_FOR_NAME_RETURNS_NEGATIVE_ONE_ON_MISS',
    description: 'A name that does not match any directory entry yields `-1` from `checkNumForName`.',
  },
  {
    id: 'GET_NUM_FOR_NAME_THROWS_ON_MISS',
    description: 'A name that does not match any directory entry causes `getNumForName` to throw an `Error` whose message contains `W_GetNumForName:` and ` not found`.',
  },
  {
    id: 'CHECK_AND_GET_AGREE_ON_HITS',
    description: 'For every name that exists in the directory, `checkNumForName(name) === getNumForName(name)`. The two functions only differ in their miss policy.',
  },
  {
    id: 'UNIQUE_COUNT_NEVER_EXCEEDS_TOTAL_COUNT',
    description: 'The number of unique uppercased names is at most the total number of directory entries; equality holds only when every name is distinct.',
  },
  {
    id: 'EIGHT_BYTE_NAME_FIELD',
    description: 'The audit ledger declares the `eight-byte-name-field` axis pinning the 8-byte `lumpinfo_t.name` field width that vanilla compares as a single `long long`.',
  },
];

/**
 * Snapshot of the lookup behavior exposed by the runtime `LumpLookup`
 * class for a known directory. The cross-check helper consumes this shape
 * so the focused test can both verify the live runtime exports and
 * exercise a deliberately tampered snapshot to prove the failure modes
 * are observable.
 */
export interface LumpLookupSnapshot {
  /** Result of `checkNumForName('PLAYPAL')`. */
  readonly checkPlaypalUpper: number;
  /** Result of `checkNumForName('playpal')`. */
  readonly checkPlaypalLower: number;
  /** Result of `checkNumForName('PlAyPaL')`. */
  readonly checkPlaypalMixed: number;
  /** Result of `checkNumForName('NOTEXIST')`. */
  readonly checkMiss: number;
  /** Result of `getNumForName('PLAYPAL')`. */
  readonly getPlaypal: number;
  /** Whether `getNumForName('NOTEXIST')` threw an Error matching the W_GetNumForName message contract. */
  readonly getMissThrows: boolean;
  /** Last-match-wins result on a synthetic directory with duplicate `FOO` at indices 0 and 2. */
  readonly lastMatchWinsResult: number;
  /** Total number of directory entries. */
  readonly totalCount: number;
  /** Number of unique uppercased names. */
  readonly uniqueCount: number;
}

/**
 * Cross-check a `LumpLookupSnapshot` against `LUMP_LOOKUP_SEMANTIC_AUDIT`
 * and `LUMP_LOOKUP_DERIVED_INVARIANTS`. Returns the list of failures by
 * stable identifier; an empty list means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckLumpLookupSemantics(snapshot: LumpLookupSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.checkPlaypalUpper < 0 || snapshot.checkPlaypalUpper !== snapshot.checkPlaypalLower || snapshot.checkPlaypalUpper !== snapshot.checkPlaypalMixed) {
    failures.push('derived:CHECK_NUM_FOR_NAME_IS_CASE_INSENSITIVE');
    failures.push('audit:case-insensitivity:not-observed');
  }

  if (snapshot.lastMatchWinsResult !== 2) {
    failures.push('derived:CHECK_NUM_FOR_NAME_LAST_MATCH_WINS');
    failures.push('audit:last-match-wins:not-observed');
  }

  if (snapshot.checkMiss !== -1) {
    failures.push('derived:CHECK_NUM_FOR_NAME_RETURNS_NEGATIVE_ONE_ON_MISS');
    failures.push('audit:check-miss-returns-negative-one:not-observed');
  }

  if (!snapshot.getMissThrows) {
    failures.push('derived:GET_NUM_FOR_NAME_THROWS_ON_MISS');
    failures.push('audit:get-throws-on-miss:not-observed');
  }

  if (snapshot.checkPlaypalUpper !== snapshot.getPlaypal) {
    failures.push('derived:CHECK_AND_GET_AGREE_ON_HITS');
  }

  if (snapshot.uniqueCount > snapshot.totalCount) {
    failures.push('derived:UNIQUE_COUNT_NEVER_EXCEEDS_TOTAL_COUNT');
  }

  const hasEightByteAxis = LUMP_LOOKUP_SEMANTIC_AUDIT.some((entry) => entry.id === 'eight-byte-name-field');
  if (!hasEightByteAxis) {
    failures.push('derived:EIGHT_BYTE_NAME_FIELD');
  }

  return failures;
}

/**
 * Pinned facts about the local shareware `doom/DOOM1.WAD` lookup behavior
 * that the focused test cross-checks against the live `LumpLookup`
 * instance built from the on-disk file. Sourced from authority 2 (the
 * local IWAD itself, parsed once by hand) and cross-referenced with
 * `reference/manifests/wad-map-summary.json`.
 */
export interface ShareWareDoom1WadLookupOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Total number of directory entries the lookup table exposes. */
  readonly totalCount: 1264;
  /** Directory index of the first PLAYPAL lump in shareware DOOM1.WAD. */
  readonly playpalIndex: 0;
  /** Directory index of the first COLORMAP lump in shareware DOOM1.WAD. */
  readonly colormapIndex: 1;
  /** Whether the E1M1 map marker is present in the shareware IWAD. */
  readonly hasE1M1: true;
  /** Whether the TEXTURE1 lump is present in the shareware IWAD. */
  readonly hasTexture1: true;
  /** Whether the TEXTURE2 lump is absent from the shareware IWAD (it is — TEXTURE2 only exists in registered/Ultimate DOOM). */
  readonly hasTexture2: false;
  /** Whether the DEMO1 lump is present in the shareware IWAD. */
  readonly hasDemo1: true;
  /** Whether the F_END marker is present in the shareware IWAD. */
  readonly hasFEnd: true;
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` lookup behavior.
 * Every value here is verifiable by parsing the local IWAD's directory
 * and constructing a `LumpLookup` over it; the focused test re-derives
 * all of them from the on-disk file every run and rejects any drift.
 */
export const SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE: ShareWareDoom1WadLookupOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  totalCount: 1264,
  playpalIndex: 0,
  colormapIndex: 1,
  hasE1M1: true,
  hasTexture1: true,
  hasTexture2: false,
  hasDemo1: true,
  hasFEnd: true,
});

/**
 * Sample shape mirroring the runtime `LumpLookup` query results so the
 * focused test can call the live methods directly and feed the result
 * into the cross-check helper.
 */
export interface ShareWareDoom1WadLookupSample {
  readonly totalCount: number;
  readonly playpalIndex: number;
  readonly colormapIndex: number;
  readonly hasE1M1: boolean;
  readonly hasTexture1: boolean;
  readonly hasTexture2: boolean;
  readonly hasDemo1: boolean;
  readonly hasFEnd: boolean;
}

/**
 * Cross-check a shareware DOOM1.WAD lookup sample against the pinned
 * oracle. Returns the list of failures by stable identifier; an empty
 * list means the live lookup matches the oracle.
 *
 * Identifiers used:
 *  - `oracle:totalCount:value-mismatch`
 *  - `oracle:playpalIndex:value-mismatch`
 *  - `oracle:colormapIndex:value-mismatch`
 *  - `oracle:hasE1M1:value-mismatch`
 *  - `oracle:hasTexture1:value-mismatch`
 *  - `oracle:hasTexture2:value-mismatch`
 *  - `oracle:hasDemo1:value-mismatch`
 *  - `oracle:hasFEnd:value-mismatch`
 */
export function crossCheckShareWareDoom1WadLookupSample(sample: ShareWareDoom1WadLookupSample): readonly string[] {
  const failures: string[] = [];

  if (sample.totalCount !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.totalCount) {
    failures.push('oracle:totalCount:value-mismatch');
  }
  if (sample.playpalIndex !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.playpalIndex) {
    failures.push('oracle:playpalIndex:value-mismatch');
  }
  if (sample.colormapIndex !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.colormapIndex) {
    failures.push('oracle:colormapIndex:value-mismatch');
  }
  if (sample.hasE1M1 !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasE1M1) {
    failures.push('oracle:hasE1M1:value-mismatch');
  }
  if (sample.hasTexture1 !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasTexture1) {
    failures.push('oracle:hasTexture1:value-mismatch');
  }
  if (sample.hasTexture2 !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasTexture2) {
    failures.push('oracle:hasTexture2:value-mismatch');
  }
  if (sample.hasDemo1 !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasDemo1) {
    failures.push('oracle:hasDemo1:value-mismatch');
  }
  if (sample.hasFEnd !== SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasFEnd) {
    failures.push('oracle:hasFEnd:value-mismatch');
  }

  return failures;
}
