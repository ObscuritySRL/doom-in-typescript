/**
 * Audit ledger for the vanilla DOOM 1.9 deterministic random number
 * lookup table and the two index counters that index it
 * (`prndindex`, `rndindex`), as implemented by `src/core/rng.ts`.
 *
 * The RNG is the single substrate the entire simulation depends on for
 * deterministic outcomes: monster behaviour, weapon spread, damage
 * variation, item bobbing, fuzz pixel selection, and demo replay all
 * branch off `P_Random()`. A drift in any byte of the table or any step
 * of the index machinery corrupts every downstream subsystem and breaks
 * demo sync.
 *
 * Vanilla DOOM does not generate random numbers algorithmically — it
 * indexes a 256-entry static `unsigned char rndtable[]` with a
 * pre-incremented, byte-wrapped index. Two independent indices walk
 * the same table:
 *  - `prndindex` (deterministic) — driven by `P_Random()`. Every
 *    gameplay decision that must be replayable from a demo file uses
 *    this stream.
 *  - `rndindex` (intended to be non-deterministic) — driven by
 *    `M_Random()`. Used for menu animation, intermission ticker, and
 *    other UI effects that must NOT advance the gameplay stream.
 *
 * `M_ClearRandom()` resets BOTH indices to zero in vanilla DOOM 1.9 /
 * id Software linuxdoom-1.10 (see `m_random.c` body). Chocolate Doom
 * 2.2.1 later modified `M_ClearRandom()` to seed `rndindex` from
 * `time(NULL) & 0xff` so menu animation differs across runs, but the
 * shareware DOOM 1.9 target this audit pins matches the id Software
 * lineage (both-zero reset). The Chocolate enhancement is explicitly
 * NOT in scope.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. id Software `linuxdoom-1.10` source — PRIMARY for this audit
 *      because the RNG is a textual array literal and three short
 *      functions that the binary cannot disagree with,
 *   4. Chocolate Doom 2.2.1 source — secondary for this audit because
 *      its `M_ClearRandom()` seed-from-time enhancement is a
 *      deliberate post-1.9 deviation,
 *   5. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical declarations from id Software linuxdoom-1.10
 *    `m_random.c` (`unsigned char rndtable[256]`, `int rndindex = 0`,
 *    `int prndindex = 0`),
 *  - the canonical bodies of `P_Random`, `M_Random`, and
 *    `M_ClearRandom`,
 *  - the operational invariants every parity-faithful re-implementation
 *    must honour (length, byte range, pre-increment, byte wrap, stream
 *    independence, both-zero reset),
 *  - a sha256 fingerprint of the canonical 256-byte rndtable buffer (so
 *    a transcription drift fails loudly instead of silently calibrating
 *    the runtime to a wrong reference),
 *  - a curated probe table of `rndtable[index]` and stream-step
 *    expectations at canonical indices (the two zero entries, the only
 *    255 entry, the first/last entries, and a handful of mid-table
 *    sentinels),
 *  - and a cross-check helper that any candidate (table, P_Random,
 *    M_Random, M_ClearRandom, pSubRandom) tuple must satisfy.
 *
 * The audit module deliberately does NOT import from `src/core/rng.ts`.
 * Hardcoding the canonical length, fingerprint, and probe expectations
 * here means a corruption of `src/core/rng.ts` cannot also silently
 * corrupt the probe table that detects the corruption. The focused
 * test re-verifies the ledger against the runtime exports, so a drift
 * in either direction surfaces loudly.
 */

import { createHash } from 'node:crypto';

/**
 * Audited canonical length of `rndtable` — exactly 256 entries,
 * one for every value of an `unsigned char` index after the `& 0xff`
 * wrap. Pinned independently of `src/core/rng.ts` so a transcription
 * drift fails loudly.
 */
export const AUDITED_RNDTABLE_LENGTH = 256;

/**
 * Audited canonical first entry of `rndtable` — `rndtable[0] = 0`.
 * The first entry is NEVER returned by `P_Random()` after a fresh
 * `M_ClearRandom()` because the index is pre-incremented to 1 before
 * lookup. Its existence is structurally important: the table contains
 * an exact zero at index 0, and the second zero entry sits at index 83.
 */
export const AUDITED_RNDTABLE_FIRST_ENTRY = 0;

/**
 * Audited canonical second entry of `rndtable` — `rndtable[1] = 8`.
 * This IS the first value returned by `P_Random()` and `M_Random()`
 * after `M_ClearRandom()` — the canonical "first roll after reset".
 * Pinned independently of `src/core/rng.ts` to anchor the
 * pre-increment semantics of both stream functions.
 */
export const AUDITED_RNDTABLE_SECOND_ENTRY = 8;

/**
 * Audited canonical last entry of `rndtable` — `rndtable[255] = 249`.
 * The 255-th entry is the last value returned in a full 256-call cycle
 * before the index wraps back to 0; the value 249 is NOT 255, so a
 * tamper that confuses "last index" with "max value" would surface.
 */
export const AUDITED_RNDTABLE_LAST_ENTRY = 249;

/**
 * Audited canonical index of the only `rndtable` entry equal to 255 —
 * `rndtable[158] = 255`. Pinned because the 256-entry table is NOT a
 * permutation of 0..255 (only 166 distinct values appear); the unique
 * 255 entry sits at index 158, and a tamper that shifts it would be
 * invisible to length/range checks but would surface here.
 */
export const AUDITED_RNDTABLE_UNIQUE_255_INDEX = 158;

/**
 * Audited canonical indices of the two `rndtable` entries equal to 0 —
 * `rndtable[0] = 0` and `rndtable[83] = 0`. The two zeroes are the
 * only repeats of the value 0 in the table; pinned because a tamper
 * that drops or moves either zero would fail the distinct-zero
 * positions check.
 */
export const AUDITED_RNDTABLE_ZERO_INDICES: readonly [number, number] = [0, 83] as const;

/**
 * Audited canonical sum of every `rndtable` entry — exactly 32986.
 * Pinned because a single off-by-one transcription drift anywhere in
 * the table would change the sum but would NOT necessarily change the
 * length, byte range, or fingerprint check on its own (the fingerprint
 * is the strongest defence; the sum is a cheap second line that
 * defends against a deliberate tamper that updates the fingerprint to
 * match a corrupted table).
 */
export const AUDITED_RNDTABLE_SUM = 32_986;

/**
 * Audited canonical count of distinct values in `rndtable` — exactly
 * 166. The 256-entry table is NOT a permutation of 0..255; about a
 * third of byte values appear more than once. Pinned because a tamper
 * that converts the table to a true permutation (a common "fix") would
 * fail this invariant immediately.
 */
export const AUDITED_RNDTABLE_DISTINCT_VALUE_COUNT = 166;

/**
 * Audited canonical initial value of both `prndindex` and `rndindex` —
 * exactly 0. The C source declares `int rndindex = 0;` and `int
 * prndindex = 0;` at file scope; the constructor of any TypeScript
 * port must reproduce this so the first `P_Random()` after instance
 * construction returns `rndtable[1]` (= 8).
 */
export const AUDITED_RNG_INDEX_INITIAL_VALUE = 0;

/**
 * Audited canonical index-wrap mask — `0xff` (= 255). The C source
 * applies `& 0xff` to the post-increment, so the index always stays
 * in [0, 255]. Pinned because a tamper that uses `% RNG_TABLE.length`
 * would behave correctly for the canonical 256-length table but would
 * silently break for any other length — making the mask a stronger
 * invariant than "modulo length".
 */
export const AUDITED_RNG_INDEX_WRAP_MASK = 0xff;

/**
 * Audited canonical sha256 of the 256-byte `rndtable` buffer (each
 * entry written as a single `unsigned char` byte in canonical order).
 * A drift in any cell of the table changes this hash. Pinned
 * independently of `src/core/rng.ts` so a corruption that updates
 * both the table and a sibling fingerprint constant fails the focused
 * test by changing nothing but the live runtime exports.
 */
export const AUDITED_RNDTABLE_SHA256 = '908b529108dcbcd3fe82907cd646e08b12404a893eda2165fe58dadd709a413f';

/**
 * Stable identifier for one pinned C-source fact about the canonical
 * RNG table and indices.
 */
export type DoomRandomFactId =
  | 'C_HEADER_DECLARE_RNDTABLE_LENGTH_AND_TYPE'
  | 'C_HEADER_DECLARE_RNDINDEX_INITIAL_VALUE'
  | 'C_HEADER_DECLARE_PRNDINDEX_INITIAL_VALUE'
  | 'C_BODY_RNDTABLE_LITERAL_FIRST_ENTRY'
  | 'C_BODY_RNDTABLE_LITERAL_SECOND_ENTRY'
  | 'C_BODY_RNDTABLE_LITERAL_LAST_ENTRY'
  | 'C_BODY_P_RANDOM_PRE_INCREMENT_AND_MASK'
  | 'C_BODY_M_RANDOM_PRE_INCREMENT_AND_MASK'
  | 'C_BODY_M_CLEAR_RANDOM_RESETS_BOTH_TO_ZERO'
  | 'C_BODY_P_RANDOM_RETURN_TYPE_INT_FROM_UNSIGNED_CHAR';

/** One pinned C-source fact about the RNG table and indices. */
export interface DoomRandomFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomRandomFactId;
  /** Whether the fact comes from the upstream C declaration or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/m_random.c';
}

/**
 * Pinned ledger of ten C-source facts that together define the
 * canonical RNG table and index machinery. The focused test asserts
 * the ledger is closed (every id appears exactly once) and that every
 * fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — file-scope declaration whose presence and value
 *    are visible without entering any function body.
 *  - `c-body`   — array literal cell or function body statement.
 *
 * Both categories live in `m_random.c` because vanilla DOOM keeps the
 * RNG table and helpers in a single .c file with no header
 * declarations of its own — the header (`m_random.h`) only declares
 * function prototypes. The "c-header" entries below pin the file-scope
 * declarations of `rndtable`, `rndindex`, and `prndindex` as visible
 * inside `m_random.c` itself.
 */
export const DOOM_RANDOM_AUDIT: readonly DoomRandomFact[] = [
  {
    id: 'C_HEADER_DECLARE_RNDTABLE_LENGTH_AND_TYPE',
    category: 'c-header',
    description:
      'File-scope declaration of `rndtable` with type `unsigned char` and length exactly 256. The unsigned-char element type bounds every value to [0, 255]; the 256 length matches the `& 0xff` index wrap, so the index never indexes out of bounds. A port that uses a wider integer type for the table or any length other than 256 silently changes the value range or wrap behaviour.',
    cReference: 'unsigned char rndtable[256] = { ... };',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_HEADER_DECLARE_RNDINDEX_INITIAL_VALUE',
    category: 'c-header',
    description:
      'File-scope declaration of `rndindex` initialised to 0. The C compiler zero-initialises file-scope `int`s by default, but vanilla DOOM writes the initialiser explicitly. A port that constructs the menu-stream index at any value other than 0 makes the first `M_Random()` return something other than `rndtable[1] = 8`.',
    cReference: 'int rndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_HEADER_DECLARE_PRNDINDEX_INITIAL_VALUE',
    category: 'c-header',
    description:
      'File-scope declaration of `prndindex` initialised to 0. Combined with the matching `rndindex` initialiser, this is what makes a freshly-constructed RNG instance bit-identical to one that has just had `M_ClearRandom()` called on it. Demo replay starts from this exact state.',
    cReference: 'int prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_RNDTABLE_LITERAL_FIRST_ENTRY',
    category: 'c-body',
    description:
      'Array literal of `rndtable` opens with `0`. The first entry is structurally distinct: it is NEVER returned by `P_Random()` after a `M_ClearRandom()` because the pre-increment skips it, but it IS returned after a wrap (after 256 calls, the next call indexes `rndtable[(0+1) & 0xff] = rndtable[1] = 8` again — index 0 is only reached by a manual write, e.g. an off-by-one in a tampered port).',
    cReference: 'unsigned char rndtable[256] = { 0, 8, 109, ... };',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_RNDTABLE_LITERAL_SECOND_ENTRY',
    category: 'c-body',
    description:
      'Array literal of `rndtable` continues with `8` as the second entry. This IS the first value returned by `P_Random()` and `M_Random()` after `M_ClearRandom()` — the pre-increment moves the index from 0 to 1, then the function returns `rndtable[1] = 8`. The "first roll after reset" is the canonical sentinel for the pre-increment semantics.',
    cReference: 'unsigned char rndtable[256] = { 0, 8, 109, ... };',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_RNDTABLE_LITERAL_LAST_ENTRY',
    category: 'c-body',
    description:
      'Array literal of `rndtable` closes with `249` at index 255. The last value returned in a full 256-call cycle (i.e., the value visible just before the index wraps back to 0 and starts re-emitting `rndtable[1] = 8`). Pinned because a tamper that confused "last index" with "max byte value" (255) would fail here while passing the byte-range invariant.',
    cReference: 'unsigned char rndtable[256] = { ..., 120, 163, 236, 249 };',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_P_RANDOM_PRE_INCREMENT_AND_MASK',
    category: 'c-body',
    description:
      'Body of `P_Random` is exactly two statements: `prndindex = (prndindex+1)&0xff;` then `return rndtable[prndindex];`. The pre-increment is what makes `rndtable[1] = 8` the first value emitted after a clear; the `& 0xff` mask is what makes the index wrap at 256 without ever indexing out of bounds.',
    cReference: 'prndindex = (prndindex+1)&0xff;\\n    return rndtable[prndindex];',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_M_RANDOM_PRE_INCREMENT_AND_MASK',
    category: 'c-body',
    description:
      'Body of `M_Random` is exactly two statements that mirror `P_Random` but use `rndindex` instead of `prndindex`. The two streams share the table but never share an index — calling `M_Random()` cannot advance the deterministic stream that drives demo replay, and calling `P_Random()` cannot advance the menu stream that drives UI animation.',
    cReference: 'rndindex = (rndindex+1)&0xff;\\n    return rndtable[rndindex];',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_M_CLEAR_RANDOM_RESETS_BOTH_TO_ZERO',
    category: 'c-body',
    description:
      'Body of `M_ClearRandom` is exactly one statement: `rndindex = prndindex = 0;`. Both indices reset to 0 simultaneously — there is NO time-based seed in vanilla DOOM 1.9. Chocolate Doom 2.2.1 later modified this to `rndindex = time(NULL) & 0xff;` for non-deterministic menu animation, but that enhancement is post-vanilla and is explicitly NOT in scope for this parity audit.',
    cReference: 'rndindex = prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_P_RANDOM_RETURN_TYPE_INT_FROM_UNSIGNED_CHAR',
    category: 'c-body',
    description:
      'Function signature is `int P_Random (void)` returning the `unsigned char` value indexed in `rndtable` after C integer promotion. The promotion preserves the byte value (no sign extension because the source is unsigned), so callers that store the result in a signed int observe a non-negative value in [0, 255] — never a negative number. A TypeScript port that returns a signed value for table cells whose high bit is set would silently desync any branch that checks `result >= 0`.',
    cReference: 'int P_Random (void) { ... }',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate RNG tuple.
 */
export type DoomRandomInvariantId =
  | 'RNDTABLE_LENGTH_IS_256'
  | 'RNDTABLE_VALUES_ALL_IN_BYTE_RANGE'
  | 'RNDTABLE_FIRST_ENTRY_IS_ZERO'
  | 'RNDTABLE_LAST_ENTRY_IS_249'
  | 'RNDTABLE_UNIQUE_255_AT_INDEX_158'
  | 'RNDTABLE_TWO_ZERO_ENTRIES_AT_INDICES_0_AND_83'
  | 'RNDTABLE_SUM_IS_32986'
  | 'RNDTABLE_DISTINCT_VALUE_COUNT_IS_166'
  | 'P_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8'
  | 'M_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8'
  | 'P_RANDOM_FULL_CYCLE_RETURNS_INDEX_TO_ZERO'
  | 'P_RANDOM_AND_M_RANDOM_STREAMS_INDEPENDENT'
  | 'CLEAR_RANDOM_RESETS_BOTH_INDICES_TO_ZERO'
  | 'P_SUB_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_NEGATIVE_101'
  | 'P_SUB_RANDOM_CONSUMES_TWO_P_RANDOM_VALUES'
  | 'RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT';

/** One operational invariant the cross-check helper enforces. */
export interface DoomRandomInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomRandomInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of sixteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_RANDOM_INVARIANTS: readonly DoomRandomInvariant[] = [
  {
    id: 'RNDTABLE_LENGTH_IS_256',
    description: 'rndtable.length === 256 exactly. The length matches the `& 0xff` index wrap; any other length silently changes the period of the sequence.',
  },
  {
    id: 'RNDTABLE_VALUES_ALL_IN_BYTE_RANGE',
    description: 'Every rndtable[i] is an integer in [0, 255]. The `unsigned char` source type enforces this in C; a TypeScript port must enforce it explicitly because the Number type permits any value.',
  },
  {
    id: 'RNDTABLE_FIRST_ENTRY_IS_ZERO',
    description: 'rndtable[0] === 0 exactly. The first entry is a sentinel — never returned by P_Random/M_Random under normal stream operation, but its value is part of the canonical layout.',
  },
  {
    id: 'RNDTABLE_LAST_ENTRY_IS_249',
    description: 'rndtable[255] === 249 exactly. The last value emitted in a full 256-call cycle. A tamper that confuses last-index (255) with max-byte-value (255) would fail here.',
  },
  {
    id: 'RNDTABLE_UNIQUE_255_AT_INDEX_158',
    description: 'rndtable[158] === 255 AND rndtable contains exactly one entry equal to 255. The unique max-value entry; pinned because a tamper that shifts it would be invisible to length/range checks.',
  },
  {
    id: 'RNDTABLE_TWO_ZERO_ENTRIES_AT_INDICES_0_AND_83',
    description: 'rndtable[0] === 0 AND rndtable[83] === 0 AND rndtable contains exactly two entries equal to 0. The two zeroes are at distinct indices; a tamper that drops or moves either would fail.',
  },
  {
    id: 'RNDTABLE_SUM_IS_32986',
    description: 'Sum of every rndtable entry === 32986 exactly. Cheap second-line defence against a single off-by-one transcription drift that the fingerprint check would also catch.',
  },
  {
    id: 'RNDTABLE_DISTINCT_VALUE_COUNT_IS_166',
    description: 'rndtable contains exactly 166 distinct values across its 256 entries — it is NOT a permutation of 0..255. A tamper that converts the table to a true permutation would fail here.',
  },
  {
    id: 'P_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8',
    description: 'First call to P_Random() after clearRandom() returns rndtable[1] === 8. Anchors the pre-increment semantics: index moves 0 → 1 BEFORE lookup.',
  },
  {
    id: 'M_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8',
    description: 'First call to M_Random() after clearRandom() returns rndtable[1] === 8. Mirrors the P_Random invariant; both streams use the same pre-increment + table.',
  },
  {
    id: 'P_RANDOM_FULL_CYCLE_RETURNS_INDEX_TO_ZERO',
    description:
      'After 256 successive P_Random() calls from a fresh state, the underlying prndindex wraps back to 0 and the next call again returns rndtable[1] === 8. A tamper that uses `% length` rather than `& 0xff` would produce the same observable behaviour for a 256-entry table but would diverge for any other length — this invariant pins the period exactly.',
  },
  {
    id: 'P_RANDOM_AND_M_RANDOM_STREAMS_INDEPENDENT',
    description: 'Calling P_Random() never advances rndindex; calling M_Random() never advances prndindex. Demo replay can advance the gameplay stream independently of UI animation that advances the menu stream.',
  },
  {
    id: 'CLEAR_RANDOM_RESETS_BOTH_INDICES_TO_ZERO',
    description:
      'After clearRandom(), the next P_Random() call returns rndtable[1] === 8 AND the next M_Random() call returns rndtable[1] === 8. Both streams reset to index 0 simultaneously; there is no time-based seed in vanilla DOOM 1.9.',
  },
  {
    id: 'P_SUB_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_NEGATIVE_101',
    description:
      'First call to pSubRandom() after clearRandom() returns rndtable[1] - rndtable[2] === 8 - 109 === -101. Anchors the canonical subtraction order (first call - second call) — a port that swaps the order would return +101 instead.',
  },
  {
    id: 'P_SUB_RANDOM_CONSUMES_TWO_P_RANDOM_VALUES',
    description: 'A single pSubRandom() call advances prndindex by exactly 2 (consumes two P_Random values). The function is the canonical "directional offset" primitive (P_Random() - P_Random()); using it must NOT advance rndindex.',
  },
  {
    id: 'RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT',
    description: 'sha256 of the 256-byte rndtable buffer matches AUDITED_RNDTABLE_SHA256. A drift in any cell would surface here even if the sum, distinct count, and pinned probes happen to coincidentally still hold.',
  },
] as const;

/**
 * Stable identifier for one curated RNG probe.
 *
 * Probes target either a single `rndtable[index]` cell, a single
 * stream-step expectation (after a precise sequence of constructor
 * + clear + N P/M calls), or a `pSubRandom` step.
 */
export type DoomRandomProbeId =
  | 'rndtable_index_0_is_zero'
  | 'rndtable_index_1_is_8'
  | 'rndtable_index_2_is_109'
  | 'rndtable_index_83_is_zero'
  | 'rndtable_index_100_is_20'
  | 'rndtable_index_128_is_11'
  | 'rndtable_index_158_is_255'
  | 'rndtable_index_200_is_125'
  | 'rndtable_index_255_is_249'
  | 'fresh_p_random_first_call_returns_8'
  | 'fresh_p_random_second_call_returns_109'
  | 'fresh_p_random_third_call_returns_220'
  | 'fresh_m_random_first_call_returns_8'
  | 'fresh_p_sub_random_first_call_returns_neg_101'
  | 'fresh_p_random_after_full_cycle_returns_8'
  | 'fresh_p_random_after_partial_cycle_then_clear_returns_8';

/** Which kind of expectation a probe pins. */
export type DoomRandomProbeTarget = 'rndtable' | 'p_random_sequence' | 'm_random_sequence' | 'p_sub_random_sequence';

/** One curated RNG probe expectation. */
export interface DoomRandomProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomRandomProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomRandomProbeTarget;
  /**
   * For `rndtable` probes: the index to look up.
   * For sequence probes: a description of the call sequence run from a
   * freshly-constructed instance (no clearRandom required because a
   * fresh instance is bit-identical to a cleared one).
   */
  readonly input: number | { readonly setupPRandomCalls?: number; readonly setupMRandomCalls?: number; readonly clearAfterSetup?: boolean; readonly observation: 'pRandom' | 'mRandom' | 'pSubRandom' };
  /** Expected canonical output. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of sixteen probes. Each probe is hand-pinned
 * from the canonical id Software linuxdoom-1.10 source and re-verified
 * by the focused test against the live runtime.
 *
 * Coverage:
 *  - rndtable: first/second/third entry, both zero positions, the
 *    unique 255 position, mid-table sentinels, last entry.
 *  - P_Random: first three calls (8, 109, 220), full-cycle wrap
 *    behaviour, partial-cycle-then-clear behaviour.
 *  - M_Random: first call (8) — proves stream independence on its own.
 *  - pSubRandom: first call (-101 = 8 - 109).
 */
export const DOOM_RANDOM_PROBES: readonly DoomRandomProbe[] = [
  // rndtable cell probes — the 9 canonical sentinel cells.
  {
    id: 'rndtable_index_0_is_zero',
    target: 'rndtable',
    input: 0,
    expected: 0,
    note: 'rndtable[0] === 0. The first cell; never returned by stream operations under normal pre-incremented indexing.',
  },
  {
    id: 'rndtable_index_1_is_8',
    target: 'rndtable',
    input: 1,
    expected: 8,
    note: 'rndtable[1] === 8. The first cell returned by P_Random/M_Random after clearRandom — the canonical "first roll" sentinel.',
  },
  {
    id: 'rndtable_index_2_is_109',
    target: 'rndtable',
    input: 2,
    expected: 109,
    note: 'rndtable[2] === 109. The second cell returned in sequence; combined with rndtable[1] = 8 it pins the canonical pSubRandom first value (8 - 109 = -101).',
  },
  {
    id: 'rndtable_index_83_is_zero',
    target: 'rndtable',
    input: 83,
    expected: 0,
    note: 'rndtable[83] === 0. The second zero entry in the table; pinned because the table has exactly two zeroes and a tamper that drops this one would shift the distribution observed by every wrap-cycle of P_Random.',
  },
  {
    id: 'rndtable_index_100_is_20',
    target: 'rndtable',
    input: 100,
    expected: 20,
    note: 'rndtable[100] === 20. Mid-table sentinel; pinned to defend against a tamper that swaps any contiguous block of cells.',
  },
  {
    id: 'rndtable_index_128_is_11',
    target: 'rndtable',
    input: 128,
    expected: 11,
    note: 'rndtable[128] === 11. Geometric midpoint sentinel; the value 11 is unrelated to the index 128, defending against a "fix" that tries to make rndtable[i] = i.',
  },
  {
    id: 'rndtable_index_158_is_255',
    target: 'rndtable',
    input: 158,
    expected: 255,
    note: 'rndtable[158] === 255. The unique cell containing the maximum byte value; pinned because a tamper that shifts this single cell would be invisible to length/range/sum checks (the 255 would still be present, just at a different index).',
  },
  {
    id: 'rndtable_index_200_is_125',
    target: 'rndtable',
    input: 200,
    expected: 125,
    note: 'rndtable[200] === 125. Late-table sentinel; defends against a tamper that truncates and re-pads the table at the high end.',
  },
  {
    id: 'rndtable_index_255_is_249',
    target: 'rndtable',
    input: 255,
    expected: 249,
    note: 'rndtable[255] === 249. The last cell; final value emitted in a 256-call cycle before the index wraps back to 0.',
  },

  // Stream sequence probes — exact sequences from a fresh instance.
  {
    id: 'fresh_p_random_first_call_returns_8',
    target: 'p_random_sequence',
    input: { observation: 'pRandom' },
    expected: 8,
    note: 'Fresh DoomRandom + 1× pRandom() === 8. Anchors the pre-increment semantics: index moves 0 → 1 BEFORE lookup.',
  },
  {
    id: 'fresh_p_random_second_call_returns_109',
    target: 'p_random_sequence',
    input: { setupPRandomCalls: 1, observation: 'pRandom' },
    expected: 109,
    note: 'Fresh DoomRandom + 2× pRandom(); second call returns rndtable[2] === 109. Pins the second step of the canonical pre-incremented walk.',
  },
  {
    id: 'fresh_p_random_third_call_returns_220',
    target: 'p_random_sequence',
    input: { setupPRandomCalls: 2, observation: 'pRandom' },
    expected: 220,
    note: 'Fresh DoomRandom + 3× pRandom(); third call returns rndtable[3] === 220. Pins the third step.',
  },
  {
    id: 'fresh_m_random_first_call_returns_8',
    target: 'm_random_sequence',
    input: { observation: 'mRandom' },
    expected: 8,
    note: 'Fresh DoomRandom + 1× mRandom() === 8. Anchors the pre-increment semantics for the menu stream; mirrors the P_Random invariant.',
  },
  {
    id: 'fresh_p_sub_random_first_call_returns_neg_101',
    target: 'p_sub_random_sequence',
    input: { observation: 'pSubRandom' },
    expected: -101,
    note: 'Fresh DoomRandom + 1× pSubRandom() === 8 - 109 === -101. Pins the subtraction order (first call - second call); a port that swaps the order returns +101.',
  },
  {
    id: 'fresh_p_random_after_full_cycle_returns_8',
    target: 'p_random_sequence',
    input: { setupPRandomCalls: 256, observation: 'pRandom' },
    expected: 8,
    note: 'Fresh DoomRandom + 257× pRandom(); the 257th call returns rndtable[1] === 8 because the index wraps from 255 → 0 and the pre-increment moves it back to 1. Pins the wrap period at exactly 256.',
  },
  {
    id: 'fresh_p_random_after_partial_cycle_then_clear_returns_8',
    target: 'p_random_sequence',
    input: { setupPRandomCalls: 100, clearAfterSetup: true, observation: 'pRandom' },
    expected: 8,
    note: 'Fresh DoomRandom + 100× pRandom() + clearRandom() + 1× pRandom() === 8. Pins clearRandom semantics: after the clear, the prndindex is 0 again and the next pre-increment lands at index 1.',
  },
] as const;

/**
 * A candidate RNG tuple for cross-checking. The tuple captures the
 * full RNG surface so the cross-check helper can detect tampering in
 * either the table or any of the four operations.
 */
export interface DoomRandomCandidate {
  /** The 256-entry random table as bytes (Uint8Array preferred for byte-exact hashing). */
  readonly rndtable: Uint8Array;
  /** Factory that returns a fresh RNG instance with both indices at 0. */
  readonly create: () => {
    pRandom(): number;
    mRandom(): number;
    pSubRandom(): number;
    clearRandom(): void;
  };
}

/**
 * Compute the sha256 hash of a Uint8Array buffer (canonical
 * rndtable byte layout — one byte per cell in index order).
 */
export function sha256OfBytes(view: Uint8Array): string {
  const bytes = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Cross-check a candidate RNG tuple against `DOOM_RANDOM_PROBES` and
 * `DOOM_RANDOM_INVARIANTS`. Returns the list of failures by stable
 * identifier; an empty list means the candidate is parity-safe under
 * every audited fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one cell or stream observation.
 */
export function crossCheckDoomRandom(candidate: DoomRandomCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_RANDOM_PROBES) {
    let actual: number;
    if (probe.target === 'rndtable') {
      const index = probe.input as number;
      actual = candidate.rndtable[index] ?? Number.NaN;
    } else {
      const spec = probe.input as { readonly setupPRandomCalls?: number; readonly setupMRandomCalls?: number; readonly clearAfterSetup?: boolean; readonly observation: 'pRandom' | 'mRandom' | 'pSubRandom' };
      const instance = candidate.create();
      for (let i = 0; i < (spec.setupPRandomCalls ?? 0); i++) instance.pRandom();
      for (let i = 0; i < (spec.setupMRandomCalls ?? 0); i++) instance.mRandom();
      if (spec.clearAfterSetup === true) instance.clearRandom();
      if (spec.observation === 'pRandom') actual = instance.pRandom();
      else if (spec.observation === 'mRandom') actual = instance.mRandom();
      else actual = instance.pSubRandom();
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Length
  if (candidate.rndtable.length !== AUDITED_RNDTABLE_LENGTH) {
    failures.push('invariant:RNDTABLE_LENGTH_IS_256');
  }

  // Byte range
  let outOfRange = false;
  for (let i = 0; i < candidate.rndtable.length; i++) {
    const value = candidate.rndtable[i];
    if (value === undefined || !Number.isInteger(value) || value < 0 || value > 255) {
      outOfRange = true;
      break;
    }
  }
  if (outOfRange) {
    failures.push('invariant:RNDTABLE_VALUES_ALL_IN_BYTE_RANGE');
  }

  // First entry
  if (candidate.rndtable[0] !== AUDITED_RNDTABLE_FIRST_ENTRY) {
    failures.push('invariant:RNDTABLE_FIRST_ENTRY_IS_ZERO');
  }

  // Last entry
  if (candidate.rndtable[255] !== AUDITED_RNDTABLE_LAST_ENTRY) {
    failures.push('invariant:RNDTABLE_LAST_ENTRY_IS_249');
  }

  // Unique 255 cell
  let count255 = 0;
  for (let i = 0; i < candidate.rndtable.length; i++) {
    if (candidate.rndtable[i] === 255) count255++;
  }
  if (count255 !== 1 || candidate.rndtable[AUDITED_RNDTABLE_UNIQUE_255_INDEX] !== 255) {
    failures.push('invariant:RNDTABLE_UNIQUE_255_AT_INDEX_158');
  }

  // Two zeroes at fixed positions
  let countZero = 0;
  for (let i = 0; i < candidate.rndtable.length; i++) {
    if (candidate.rndtable[i] === 0) countZero++;
  }
  if (countZero !== 2 || candidate.rndtable[AUDITED_RNDTABLE_ZERO_INDICES[0]] !== 0 || candidate.rndtable[AUDITED_RNDTABLE_ZERO_INDICES[1]] !== 0) {
    failures.push('invariant:RNDTABLE_TWO_ZERO_ENTRIES_AT_INDICES_0_AND_83');
  }

  // Sum
  let sum = 0;
  for (let i = 0; i < candidate.rndtable.length; i++) {
    sum += candidate.rndtable[i] ?? 0;
  }
  if (sum !== AUDITED_RNDTABLE_SUM) {
    failures.push('invariant:RNDTABLE_SUM_IS_32986');
  }

  // Distinct count
  const distinct = new Set<number>();
  for (let i = 0; i < candidate.rndtable.length; i++) {
    const value = candidate.rndtable[i];
    if (value !== undefined) distinct.add(value);
  }
  if (distinct.size !== AUDITED_RNDTABLE_DISTINCT_VALUE_COUNT) {
    failures.push('invariant:RNDTABLE_DISTINCT_VALUE_COUNT_IS_166');
  }

  // First P_Random returns 8
  if (candidate.create().pRandom() !== 8) {
    failures.push('invariant:P_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8');
  }

  // First M_Random returns 8
  if (candidate.create().mRandom() !== 8) {
    failures.push('invariant:M_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8');
  }

  // P_Random full cycle wraps and re-emits 8 at call 257
  {
    const instance = candidate.create();
    for (let i = 0; i < 256; i++) instance.pRandom();
    if (instance.pRandom() !== 8) {
      failures.push('invariant:P_RANDOM_FULL_CYCLE_RETURNS_INDEX_TO_ZERO');
    }
  }

  // Stream independence
  {
    const a = candidate.create();
    const b = candidate.create();
    // Drive pRandom on a; mRandom should still emit 8 first.
    a.pRandom();
    a.pRandom();
    a.pRandom();
    if (a.mRandom() !== 8) {
      failures.push('invariant:P_RANDOM_AND_M_RANDOM_STREAMS_INDEPENDENT');
    } else {
      // Drive mRandom on b; pRandom should still emit 8 first.
      b.mRandom();
      b.mRandom();
      b.mRandom();
      if (b.pRandom() !== 8) {
        failures.push('invariant:P_RANDOM_AND_M_RANDOM_STREAMS_INDEPENDENT');
      }
    }
  }

  // clearRandom resets both indices to zero so the next pRandom AND
  // the next mRandom (each on a separately-prepared instance) both
  // emit rndtable[1] === 8.
  {
    const pInstance = candidate.create();
    for (let i = 0; i < 50; i++) pInstance.pRandom();
    for (let i = 0; i < 50; i++) pInstance.mRandom();
    pInstance.clearRandom();

    const mInstance = candidate.create();
    for (let i = 0; i < 50; i++) mInstance.pRandom();
    for (let i = 0; i < 50; i++) mInstance.mRandom();
    mInstance.clearRandom();

    if (pInstance.pRandom() !== AUDITED_RNDTABLE_SECOND_ENTRY || mInstance.mRandom() !== AUDITED_RNDTABLE_SECOND_ENTRY) {
      failures.push('invariant:CLEAR_RANDOM_RESETS_BOTH_INDICES_TO_ZERO');
    }
  }

  // pSubRandom first value after clear is -101
  if (candidate.create().pSubRandom() !== -101) {
    failures.push('invariant:P_SUB_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_NEGATIVE_101');
  }

  // pSubRandom advances prndindex by 2 (deduced by checking the next P_Random call)
  {
    const a = candidate.create();
    a.pSubRandom();
    // Next P_Random should return rndtable[3] === 220 because pSubRandom consumed indices 1 and 2.
    if (a.pRandom() !== 220) {
      failures.push('invariant:P_SUB_RANDOM_CONSUMES_TWO_P_RANDOM_VALUES');
    }
  }

  // Hash fingerprint
  if (sha256OfBytes(candidate.rndtable) !== AUDITED_RNDTABLE_SHA256) {
    failures.push('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  }

  return failures;
}
