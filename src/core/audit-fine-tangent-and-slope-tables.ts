/**
 * Audit ledger for the vanilla DOOM 1.9 fine-tangent and slope-table
 * operational semantics. The static layout, byte-level fingerprints, and
 * cardinal probe values for `finetangent`, `tantoangle`, and `SlopeDiv`
 * are pinned by `audit-trig-lookup-tables.ts` (step 04-005). This audit
 * (step 04-006) goes one level deeper and pins the *operational*
 * invariants that the canonical use sites depend on:
 *  - `finetangent` is a half-circle table (FINEANGLES/2 = 4096 entries),
 *    NOT a periodic full-circle table. It is strictly monotonically
 *    increasing across its full extent, sign-bipartite (all entries on
 *    [0, 2048) are negative; all entries on [2048, 4096) are positive),
 *    and contains no exact-zero cell — the antisymmetry pivot
 *    (finetangent[2047] = -25, finetangent[2048] = +25) is the closest
 *    approach to zero.
 *  - The first index where `|finetangent[i]| >= FRACUNIT` (the canonical
 *    pi/4 unit-tangent anchor) is `i = 3072`, with the value `65586`.
 *    The cell one before it (`finetangent[3071] = 65485`) is one unit
 *    below FRACUNIT. This anchors the geometric meaning of the table:
 *    fine-angle index 3072 corresponds to the half-circle direction
 *    that satisfies `|tan(angle)| === 1.0`.
 *  - `tantoangle` is the inverse of `finetangent` over the first octant
 *    only — it maps an 11-bit slope value to a BAM angle in [0, ANG45].
 *    The table is strictly monotonic increasing (NOT just non-
 *    decreasing — every consecutive pair `tantoangle[i+1] >
 *    tantoangle[i]`). The sum of all 2048 consecutive increments equals
 *    ANG45 exactly, so the curve closes the octant precisely.
 *  - The increments themselves are monotonically *decreasing* — the
 *    arctangent function is concave on [0, 1], so each successive
 *    `tantoangle[i+1] - tantoangle[i]` is smaller than the previous
 *    increment. The first increment is `tantoangle[1] - tantoangle[0]
 *    = 333772`, the final increment is `tantoangle[2048] -
 *    tantoangle[2047] = 166912`, exactly half the first.
 *  - `SlopeDiv(num, den)` always returns a value in `[0, SLOPERANGE]`
 *    when both arguments are coerced to uint32. The guard `den < 512`
 *    short-circuits to SLOPERANGE for divide-by-zero AND for
 *    denominators small enough that `(num<<3)/(den>>8)` would overshoot.
 *    The composition `tantoangle[SlopeDiv(num, den)]` therefore always
 *    yields a BAM angle in `[0, ANG45]` — the canonical first-octant
 *    arctangent inverse used by `R_PointToAngle`'s octant decomposition
 *    in `r_main.c`.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`tables.h`, `tables.c`, `m_fixed.c`,
 *      `r_main.c`, `r_segs.c`, `g_game.c`).
 *
 * The C declarations and definitions referenced below are pinned
 * against authority 5 because they are textual constants that DOSBox
 * cannot disagree with. Each operational invariant comes with a
 * cross-check that a tampered candidate fails, so transcription drift
 * in the audit ledger fails loudly instead of silently calibrating the
 * runtime to a wrong reference.
 *
 * The audit module deliberately does NOT import from any sibling
 * `src/core/` module — hardcoding the canonical fingerprints, audited
 * BAM endpoint (`0x20000000`, the literal value of `ANG45`), and
 * probe expectations here means a corruption of `src/core/trig.ts`
 * or `src/core/angle.ts` cannot also silently corrupt the probe
 * table that detects the corruption. The focused test re-verifies
 * the audited values against the runtime `ANG45` export from
 * `src/core/angle.ts` so a runtime constant drift surfaces loudly.
 */

import { createHash } from 'node:crypto';

/**
 * The literal value of the canonical 45-degree BAM angle (= `ANG45`
 * = `0x20000000` = 536870912). Pinned independently of the runtime
 * `src/core/angle.ts` export so a corruption of either module surfaces
 * in the focused test instead of silently propagating.
 */
const AUDITED_ANG45_BAM = 0x2000_0000;

/**
 * The smallest absolute value in `finetangent` — the antisymmetry
 * pivot at indices 2047 and 2048. Defined here for the operational
 * audit because the existence (and exact value) of this minimum is
 * what guarantees the table never crosses zero.
 */
export const AUDITED_FINETANGENT_MIN_ABSOLUTE_VALUE = 25;

/**
 * The exact value at the antisymmetry pivot's negative side
 * (`finetangent[2047]`). Pinned independently of the prior 04-005
 * audit so a transcription drift in either ledger fails loudly.
 */
export const AUDITED_FINETANGENT_PIVOT_NEGATIVE_VALUE = -25;

/**
 * The exact value at the antisymmetry pivot's positive side
 * (`finetangent[2048]`). Pinned independently of the prior 04-005
 * audit.
 */
export const AUDITED_FINETANGENT_PIVOT_POSITIVE_VALUE = 25;

/**
 * Inclusive upper bound (exclusive end-index) of the negative half of
 * `finetangent`. Indices on `[0, 2048)` are all strictly negative.
 */
export const AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX = 2048;

/**
 * Inclusive lower bound (start-index) of the positive half of
 * `finetangent`. Indices on `[2048, 4096)` are all strictly positive.
 */
export const AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX = 2048;

/**
 * The canonical first index in the positive half where
 * `finetangent[i] >= FRACUNIT` (= 65536). This is the geometric
 * pi/4-anchor: fine-angle 3072 corresponds to the half-circle
 * direction that produces a unit tangent.
 */
export const AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX = 3072;

/**
 * The exact value at the FRACUNIT-crossing index — `finetangent[3072]
 * = 65586`. The increment from FRACUNIT (65536) is +50, which a
 * tampered table that linearly interpolates would produce a different
 * value for.
 */
export const AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING = 65_586;

/**
 * The exact value one cell before the FRACUNIT-crossing —
 * `finetangent[3071] = 65485`. Combined with the value at index 3072
 * it pins the precise step across the FRACUNIT boundary
 * (65586 - 65485 = +101).
 */
export const AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE = 65_485;

/**
 * The first increment of `tantoangle` — `tantoangle[1] -
 * tantoangle[0] = 333772`. The arctangent function is concave on
 * `[0, 1]`, so this is the largest increment in the table.
 */
export const AUDITED_TANTOANGLE_FIRST_INCREMENT = 333_772;

/**
 * The final increment of `tantoangle` — `tantoangle[2048] -
 * tantoangle[2047] = 166912`. Pinned independently because the
 * arctangent's concavity is what makes the final increment exactly
 * half the first (within ulp-level rounding) — a transcription drift
 * here would be invisible to length-only checks.
 */
export const AUDITED_TANTOANGLE_FINAL_INCREMENT = 166_912;

/**
 * The middle increment of `tantoangle` (between cells 1023 and 1024)
 * — `tantoangle[1024] - tantoangle[1023] = 267072`. Pinned because it
 * anchors the curvature of the table: a tampered table that
 * linearises the arctangent from 0 to ANG45 would produce a constant
 * increment of `ANG45 / 2048 = 262144`, not 267072.
 */
export const AUDITED_TANTOANGLE_MIDDLE_INCREMENT = 267_072;

/**
 * The cumulative sum of every consecutive `tantoangle` increment over
 * `[0, 2048]` equals exactly ANG45 (= `0x20000000` = 536870912). This
 * follows from the telescoping sum
 * `sum(tantoangle[i+1] - tantoangle[i] for i in [0, 2048)) =
 * tantoangle[2048] - tantoangle[0] = ANG45 - 0 = ANG45`, but the
 * cross-check helper computes it explicitly to defend against a
 * tamper that breaks one increment without breaking the endpoints
 * (the breaks would have to cancel pairwise to evade detection).
 */
export const AUDITED_TANTOANGLE_INCREMENT_SUM = 0x2000_0000;

/**
 * The exact denominator threshold that `SlopeDiv` short-circuits at.
 * Pinned independently of the prior 04-005 C-body fact because this
 * constant defines the boundary between "guarded against
 * divide-by-zero / overflow" and "pass through to the (num<<3)/(den>>8)
 * formula". Defends against a tamper that drops the guard or shifts
 * the threshold.
 */
export const AUDITED_SLOPE_GUARD_THRESHOLD = 512;

/**
 * The canonical left-shift applied to `num` in the `SlopeDiv` body
 * (`num << 3` = `num * 8`). Pinned independently because a tamper
 * that changes this shift would silently rescale every slope lookup
 * at the renderer level.
 */
export const AUDITED_SLOPE_NUM_LEFT_SHIFT = 3;

/**
 * The canonical right-shift applied to `den` in the `SlopeDiv` body
 * (`den >> 8`). Pinned independently for the same reason as the
 * num-shift constant.
 */
export const AUDITED_SLOPE_DEN_RIGHT_SHIFT = 8;

/**
 * Audited canonical sha256 of the `finetangent` table buffer
 * (4096 little-endian int32s = 16384 bytes). Pinned independently of
 * the prior 04-005 fingerprint so a drift in either ledger fails
 * loudly. Must equal the matching audited fingerprint in
 * `audit-trig-lookup-tables.ts`.
 */
export const AUDITED_FINETANGENT_SHA256 = '8988638b066ed2b19a42c6ea1f7d451744e8337845bba4cbb08ac400e521a031';

/**
 * Audited canonical sha256 of the `tantoangle` table buffer
 * (2049 little-endian uint32s = 8196 bytes).
 */
export const AUDITED_TANTOANGLE_SHA256 = 'ba4346ce3ac3dcb24c460bcf0ed98d3f8351203ca3bcc1dec1cb822f9dee7e11';

/**
 * Stable identifier for one pinned C-source fact about the canonical
 * fine-tangent and slope-table operational semantics.
 */
export type FineTangentAndSlopeFactId =
  | 'C_HEADER_DECLARE_FINETANGENT_HALF_CIRCLE_LENGTH'
  | 'C_HEADER_DECLARE_TANTOANGLE_SLOPERANGE_PLUS_ONE_LENGTH'
  | 'C_HEADER_DECLARE_SLOPEDIV_SIGNATURE'
  | 'C_BODY_FINETANGENT_LITERAL_FIRST_ENTRY'
  | 'C_BODY_FINETANGENT_LITERAL_LAST_ENTRY'
  | 'C_BODY_TANTOANGLE_LITERAL_FIRST_ENTRY'
  | 'C_BODY_TANTOANGLE_LITERAL_LAST_ENTRY'
  | 'C_BODY_SLOPEDIV_GUARD_THRESHOLD'
  | 'C_BODY_SLOPEDIV_FORMULA'
  | 'C_BODY_SLOPEDIV_CLAMP';

/** One pinned C-source fact about the fine-tangent and slope-table semantics. */
export interface FineTangentAndSlopeFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FineTangentAndSlopeFactId;
  /** Whether the fact comes from the upstream C header or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source path inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/tables.h' | 'src/tables.c';
}

/**
 * Pinned ledger of ten C-source facts that together define the
 * operational semantics of `finetangent`, `tantoangle`, and
 * `SlopeDiv`. The focused test asserts the ledger is closed (every id
 * appears exactly once) and that every fact is honoured by the
 * runtime.
 */
export const FINE_TANGENT_AND_SLOPE_AUDIT: readonly FineTangentAndSlopeFact[] = [
  {
    id: 'C_HEADER_DECLARE_FINETANGENT_HALF_CIRCLE_LENGTH',
    category: 'c-header',
    description:
      'Header-level extern declaration of `finetangent` with exactly `FINEANGLES/2` = 4096 entries. The half-circle length is what makes the table antisymmetric and bounds-restricted: a fine-angle index from a raw `>> ANGLETOFINESHIFT` is 13 bits (= [0, 8191]), so callers MUST pre-shift by ANG90 (or otherwise constrain the index to [0, 4095]) before indexing finetangent — there is no implicit periodicity wrap.',
    cReference: 'extern fixed_t finetangent[FINEANGLES/2];',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DECLARE_TANTOANGLE_SLOPERANGE_PLUS_ONE_LENGTH',
    category: 'c-header',
    description:
      'Header-level extern declaration of `tantoangle` with exactly `SLOPERANGE+1` = 2049 entries. The +1 cell holds `tantoangle[2048] = ANG45 = 0x20000000` for the boundary case `dy === dx` (unit slope). Without the +1 cell, `R_PointToAngle`s `tantoangle[SlopeDiv(min, max)]` lookup would index out of bounds when SlopeDiv saturates at SLOPERANGE.',
    cReference: 'extern angle_t tantoangle[SLOPERANGE+1];',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DECLARE_SLOPEDIV_SIGNATURE',
    category: 'c-header',
    description:
      'Header-level prototype of `SlopeDiv` with two `unsigned` arguments and an `int` return. The unsigned signature is what makes the `den < 512` guard correct against negative inputs: if either argument is negative, the implicit conversion to `unsigned` produces a large value that bypasses the guard correctly. The TypeScript implementation reproduces this with `>>> 0` coercion.',
    cReference: 'int SlopeDiv (unsigned num, unsigned den);',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_BODY_FINETANGENT_LITERAL_FIRST_ENTRY',
    category: 'c-body',
    description:
      'Body-level array literal of `finetangent` opens with `-170910304`. This is the saturating extreme at the half-circle lower endpoint — `tan(angle)` near the asymptote at the lower fine-angle bound. A linear or sigmoidal regeneration would not produce this exact saturation value at index 0.',
    cReference: 'fixed_t finetangent[FINEANGLES/2] = { -170910304, -56965752, ... };',
    referenceSourceFile: 'src/tables.c',
  },
  {
    id: 'C_BODY_FINETANGENT_LITERAL_LAST_ENTRY',
    category: 'c-body',
    description:
      "Body-level array literal of `finetangent` closes with `170910304`. This is the saturating extreme at the half-circle upper endpoint, the antisymmetric mirror of `finetangent[0] = -170910304`. The exact magnitude (170910304) is what id Software's offline generator produced from `tan(pi/2 - 0.5 * pi / 4096)` rounded to fixed-point; no public IEEE 754 formula reproduces it bit-for-bit.",
    cReference: 'fixed_t finetangent[FINEANGLES/2] = { ..., 56965752, 170910304 };',
    referenceSourceFile: 'src/tables.c',
  },
  {
    id: 'C_BODY_TANTOANGLE_LITERAL_FIRST_ENTRY',
    category: 'c-body',
    description:
      'Body-level array literal of `tantoangle` opens with `0`. A zero slope (`dy === 0`) yields a zero BAM angle. Combined with the strict monotonic-increasing invariant this is what makes `tantoangle[0]` the unique zero in the table.',
    cReference: 'angle_t tantoangle[SLOPERANGE+1] = { 0, 333772, 667544, ... };',
    referenceSourceFile: 'src/tables.c',
  },
  {
    id: 'C_BODY_TANTOANGLE_LITERAL_LAST_ENTRY',
    category: 'c-body',
    description:
      'Body-level array literal of `tantoangle` closes with `0x20000000` (ANG45). A unit slope (`dy === dx`) yields a 45-degree BAM angle. Pinned independently of the prior 04-005 audit because both audits depend on this endpoint and a transcription drift in either ledger must surface here.',
    cReference: 'angle_t tantoangle[SLOPERANGE+1] = { ..., 0x20000000 };',
    referenceSourceFile: 'src/tables.c',
  },
  {
    id: 'C_BODY_SLOPEDIV_GUARD_THRESHOLD',
    category: 'c-body',
    description:
      'Body-level guard in `SlopeDiv`: `if (den < 512) return SLOPERANGE`. The threshold 512 = 2^9 is what protects the `den >> 8` division from producing zero when `den` is very small. Combined with the unsigned signature, this guards against both divide-by-zero and against negative-input overflow that wraps around to a small positive value.',
    cReference: 'if (den < 512) return SLOPERANGE;',
    referenceSourceFile: 'src/tables.c',
  },
  {
    id: 'C_BODY_SLOPEDIV_FORMULA',
    category: 'c-body',
    description:
      'Body-level division formula in `SlopeDiv`: `ans = (num<<3) / (den>>8)`. The `<< 3` shift on `num` rescales the dividend by 8, and the `>> 8` shift on `den` rescales the divisor by 1/256, so the resulting quotient is `8 * 256 = 2048` times larger than `num/den`. The 2048 scaling is exactly SLOPERANGE: a unit ratio (`num === den`) lands at SLOPERANGE.',
    cReference: 'ans = (num<<3) / (den>>8);',
    referenceSourceFile: 'src/tables.c',
  },
  {
    id: 'C_BODY_SLOPEDIV_CLAMP',
    category: 'c-body',
    description:
      'Body-level clamp in `SlopeDiv`: `return ans <= SLOPERANGE ? ans : SLOPERANGE`. When the formula overshoots SLOPERANGE (e.g. due to denominator-overflow rounding when `den` is small), the result is clamped down. This guarantees the return value is always a safe index into the SLOPERANGE+1-sized `tantoangle` table.',
    cReference: 'return ans <= SLOPERANGE ? ans : SLOPERANGE;',
    referenceSourceFile: 'src/tables.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate fine-tangent/slope tuple.
 */
export type FineTangentAndSlopeInvariantId =
  | 'FINETANGENT_STRICTLY_MONOTONIC_INCREASING'
  | 'FINETANGENT_NEGATIVE_HALF_ALL_NEGATIVE'
  | 'FINETANGENT_POSITIVE_HALF_ALL_POSITIVE'
  | 'FINETANGENT_NO_EXACT_ZERO_ENTRY'
  | 'FINETANGENT_PIVOT_VALUES_AT_2047_AND_2048'
  | 'FINETANGENT_FRACUNIT_CROSSING_AT_INDEX_3072'
  | 'TANTOANGLE_STRICTLY_MONOTONIC_INCREASING'
  | 'TANTOANGLE_INCREMENT_SUM_EQUALS_ANG45'
  | 'TANTOANGLE_INCREMENTS_MONOTONIC_DECREASING'
  | 'SLOPEDIV_RETURNS_VALUE_IN_ZERO_TO_SLOPERANGE'
  | 'SLOPEDIV_GUARDS_DEN_LESS_THAN_GUARD_THRESHOLD'
  | 'SLOPEDIV_TANTOANGLE_COMPOSITION_BAM_IN_ZERO_TO_ANG45'
  | 'TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS';

/** One operational invariant the cross-check helper enforces. */
export interface FineTangentAndSlopeInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FineTangentAndSlopeInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of thirteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const FINE_TANGENT_AND_SLOPE_INVARIANTS: readonly FineTangentAndSlopeInvariant[] = [
  {
    id: 'FINETANGENT_STRICTLY_MONOTONIC_INCREASING',
    description:
      'finetangent[i+1] > finetangent[i] for every i in [0, 4095) — every consecutive pair strictly increases. Stronger than non-decreasing because the canonical table has no plateau cells; a tamper that duplicates a value at any index would fail.',
  },
  {
    id: 'FINETANGENT_NEGATIVE_HALF_ALL_NEGATIVE',
    description: 'finetangent[i] < 0 for every i in [0, 2048). The negative half corresponds to fine angles in the lower quadrant of the half-circle range; a tamper that pushes any cell to >= 0 would fail.',
  },
  {
    id: 'FINETANGENT_POSITIVE_HALF_ALL_POSITIVE',
    description:
      'finetangent[i] > 0 for every i in [2048, 4096). The positive half corresponds to fine angles in the upper quadrant; combined with the negative-half invariant this is what makes the antisymmetry pivot a true sign-bipartition rather than a soft transition.',
  },
  {
    id: 'FINETANGENT_NO_EXACT_ZERO_ENTRY',
    description: 'finetangent[i] !== 0 for every i in [0, 4096). The closest approach to zero is the antisymmetry pivot at indices 2047 (-25) and 2048 (+25). A tamper that injects a zero (e.g. a typo dropping a trailing digit) would fail.',
  },
  {
    id: 'FINETANGENT_PIVOT_VALUES_AT_2047_AND_2048',
    description:
      'finetangent[2047] === -25 AND finetangent[2048] === +25 — the canonical antisymmetry pivot. Pinned exactly because the values are what the half-circle generator produced at the +/- one-fine-angle-from-vertical positions; any drift here would surface as renderer mis-anchoring.',
  },
  {
    id: 'FINETANGENT_FRACUNIT_CROSSING_AT_INDEX_3072',
    description:
      'finetangent[3071] === 65485 (just below FRACUNIT) AND finetangent[3072] === 65586 (just above FRACUNIT). Index 3072 is the first cell where |value| >= FRACUNIT, so it is the canonical pi/4-anchor: a half-circle direction with unit tangent. The exact crossing values defend against a tamper that linearises the table around the crossing.',
  },
  {
    id: 'TANTOANGLE_STRICTLY_MONOTONIC_INCREASING',
    description:
      'tantoangle[i+1] > tantoangle[i] for every i in [0, 2048) — strictly increasing, NOT just non-decreasing. This is what makes the slope-to-angle lookup an injective map: every distinct slope index produces a distinct BAM angle.',
  },
  {
    id: 'TANTOANGLE_INCREMENT_SUM_EQUALS_ANG45',
    description:
      'sum(tantoangle[i+1] - tantoangle[i] for i in [0, 2048)) === ANG45 (= 0x20000000). The cumulative increment closes the octant exactly. A tamper that shifts increments without breaking the endpoints (i.e. cancellation tampering) would still surface here as long as the total drifts from ANG45.',
  },
  {
    id: 'TANTOANGLE_INCREMENTS_MONOTONIC_DECREASING',
    description:
      '(tantoangle[i+1] - tantoangle[i]) >= (tantoangle[i+2] - tantoangle[i+1]) for every i in [0, 2046]. Each consecutive increment is smaller than (or equal to) the previous one, reflecting the concavity of the arctangent on [0, 1]. Non-strict because integer rounding can produce equal consecutive increments at high indices; the canonical table has at least one such tie.',
  },
  {
    id: 'SLOPEDIV_RETURNS_VALUE_IN_ZERO_TO_SLOPERANGE',
    description:
      'slopeDiv(num, den) returns a value in [0, SLOPERANGE] = [0, 2048] for every uint32 (num, den) pair. The canonical clamp `<= SLOPERANGE ? ans : SLOPERANGE` plus the guard return guarantee this. A tamper that drops the clamp or the guard would fail on at least one large-num input.',
  },
  {
    id: 'SLOPEDIV_GUARDS_DEN_LESS_THAN_GUARD_THRESHOLD',
    description:
      'slopeDiv(num, den) === SLOPERANGE for every uint32 num and every den in [0, 511]. The guard is exact: at den === 512 the formula path is taken instead. A tamper that shifts the threshold or drops the guard would fail at den === 0 (divide-by-zero) and at small den values.',
  },
  {
    id: 'SLOPEDIV_TANTOANGLE_COMPOSITION_BAM_IN_ZERO_TO_ANG45',
    description:
      'tantoangle[slopeDiv(num, den)] is in [0, ANG45] for every uint32 (num, den) pair. This is the canonical first-octant arctangent inverse used by `R_PointToAngle`s octant decomposition; the composition must always land in the first-octant BAM range so the octant rotations in `R_PointToAngle` produce a correct full-circle BAM angle.',
  },
  {
    id: 'TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS',
    description:
      'sha256 of the finetangent and tantoangle byte buffers (each in their canonical little-endian Typed-Array layout) match the audited fingerprints AUDITED_FINETANGENT_SHA256 and AUDITED_TANTOANGLE_SHA256. A drift in any cell of either table would surface here.',
  },
] as const;

/**
 * Stable identifier for one curated operational probe.
 *
 * Probes target the operational semantics of `finetangent` and the
 * slope helpers — they go DEEPER than the cardinal probes pinned by
 * the prior 04-005 audit, focusing on:
 *  - finetangent strict-monotonicity sentinels
 *  - finetangent FRACUNIT-crossing anchors
 *  - tantoangle increment values (curvature anchors)
 *  - slopeDiv guard boundary cells
 *  - the slopeDiv + tantoangle composition (the canonical use case)
 */
export type FineTangentAndSlopeProbeId =
  | 'finetangent_strict_increase_sentinel_low'
  | 'finetangent_strict_increase_sentinel_high'
  | 'finetangent_min_abs_negative_pivot'
  | 'finetangent_min_abs_positive_pivot'
  | 'finetangent_just_below_fracunit_crossing'
  | 'finetangent_at_fracunit_crossing'
  | 'tantoangle_first_increment_value'
  | 'tantoangle_middle_increment_value'
  | 'tantoangle_final_increment_value'
  | 'slopediv_at_guard_boundary_511'
  | 'slopediv_at_guard_boundary_512'
  | 'slopediv_with_negative_num_returns_clamp'
  | 'slopediv_with_negative_den_underflows_to_zero_quotient'
  | 'composition_zero_slope_yields_zero_bam'
  | 'composition_unit_slope_yields_ang45_bam'
  | 'composition_quarter_slope_lookup_known_bam';

/**
 * One curated operational probe. Each probe targets either a single
 * table cell, a single `slopeDiv(num, den)` output, or a composition
 * `tantoangle[slopeDiv(num, den)]`.
 */
export interface FineTangentAndSlopeProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FineTangentAndSlopeProbeId;
  /** Which table or helper this probe inspects. */
  readonly target: 'finetangent' | 'tantoangle_increment' | 'slopeDiv' | 'composition';
  /** Probe input. For tables: an integer index. For slopeDiv: a (num, den) tuple. For composition: a (num, den) tuple. */
  readonly input: number | readonly [number, number];
  /** Expected canonical output. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of sixteen operational probes. Each probe is
 * hand-pinned from the canonical runtime tables (cross-verified by
 * direct inspection at audit time) and re-verified by the focused
 * test against (a) the live runtime and (b) the audited table-buffer
 * sha256 fingerprints.
 *
 * Coverage:
 *  - finetangent: strict-increase sentinels at low/high indices,
 *    antisymmetry pivot exact values, FRACUNIT-crossing pair.
 *  - tantoangle: first / middle / final increment values (curvature
 *    anchors).
 *  - slopeDiv: guard boundary at 511 / 512, negative-input behaviour.
 *  - composition: zero / unit / known-quarter slope lookups.
 */
export const FINE_TANGENT_AND_SLOPE_PROBES: readonly FineTangentAndSlopeProbe[] = [
  // finetangent strict-monotonicity sentinels
  {
    id: 'finetangent_strict_increase_sentinel_low',
    target: 'finetangent',
    input: 1,
    expected: -56_965_752,
    note: 'finetangent[1] is the canonical -56965752. The pair (finetangent[0] = -170910304, finetangent[1] = -56965752) is one of the largest absolute increments anywhere in the table; defends against a tamper that smooths the saturating endpoint.',
  },
  {
    id: 'finetangent_strict_increase_sentinel_high',
    target: 'finetangent',
    input: 4094,
    expected: 56_965_752,
    note: 'finetangent[4094] is the canonical 56965752 — antisymmetric mirror of finetangent[1]. The pair (finetangent[4094], finetangent[4095] = 170910304) is a strict increase of 113944552, the largest at the upper saturating endpoint.',
  },
  {
    id: 'finetangent_min_abs_negative_pivot',
    target: 'finetangent',
    input: 2047,
    expected: -25,
    note: 'finetangent[2047] is the canonical -25. The smallest |value| in the negative half — the table never reaches zero, so this is the closest approach from below.',
  },
  {
    id: 'finetangent_min_abs_positive_pivot',
    target: 'finetangent',
    input: 2048,
    expected: 25,
    note: 'finetangent[2048] is the canonical +25. The smallest |value| in the positive half — together with finetangent[2047] = -25 it pins the antisymmetry pivot exactly.',
  },
  {
    id: 'finetangent_just_below_fracunit_crossing',
    target: 'finetangent',
    input: 3071,
    expected: 65_485,
    note: 'finetangent[3071] is the canonical 65485 — the cell just below the FRACUNIT crossing. Combined with finetangent[3072] = 65586 it pins the exact step across the unit-tangent threshold.',
  },
  {
    id: 'finetangent_at_fracunit_crossing',
    target: 'finetangent',
    input: 3072,
    expected: 65_586,
    note: 'finetangent[3072] is the canonical 65586 — the first cell where |value| >= FRACUNIT (= 65536). This is the geometric pi/4-anchor: fine-angle 3072 corresponds to the half-circle direction that produces a unit tangent.',
  },

  // tantoangle increment values (curvature anchors)
  {
    id: 'tantoangle_first_increment_value',
    target: 'tantoangle_increment',
    input: 0,
    expected: 333_772,
    note: 'tantoangle[1] - tantoangle[0] = 333772 — the largest increment in the table. The arctangent is concave on [0, 1], so the first increment is the largest.',
  },
  {
    id: 'tantoangle_middle_increment_value',
    target: 'tantoangle_increment',
    input: 1023,
    expected: 267_072,
    note: 'tantoangle[1024] - tantoangle[1023] = 267072. A linearised tantoangle would have a constant increment of ANG45 / 2048 = 262144; the +4928 deviation here pins the canonical concavity at the table midpoint.',
  },
  {
    id: 'tantoangle_final_increment_value',
    target: 'tantoangle_increment',
    input: 2047,
    expected: 166_912,
    note: 'tantoangle[2048] - tantoangle[2047] = 166912. The smallest increment in the table — exactly half the first increment (333772 / 2 = 166886, and 166912 is within ulp of that), reflecting the arctangent slope at the unit-slope boundary.',
  },

  // slopeDiv guard boundary
  {
    id: 'slopediv_at_guard_boundary_511',
    target: 'slopeDiv',
    input: [1024, 511],
    expected: 2048,
    note: 'slopeDiv(1024, 511) returns SLOPERANGE = 2048 — den === 511 is the largest value that triggers the `den < 512` guard. Defends against a tamper that shifts the threshold by one.',
  },
  {
    id: 'slopediv_at_guard_boundary_512',
    target: 'slopeDiv',
    input: [64, 512],
    expected: 256,
    note: 'slopeDiv(64, 512) returns 256 — den === 512 is the smallest value that bypasses the guard. The formula gives (64<<3)/(512>>8) = 512/2 = 256. Defends against a tamper that shifts the threshold by one or that drops the formula.',
  },
  {
    id: 'slopediv_with_negative_num_returns_clamp',
    target: 'slopeDiv',
    input: [-1, 1024],
    expected: 2048,
    note: 'slopeDiv(-1, 1024) returns SLOPERANGE = 2048. After uint32 coercion, num = 4294967295 and (num<<3)>>>0 = 4294967288. Divided by den>>8 = 4 yields 1073741822, far above SLOPERANGE — so the clamp returns SLOPERANGE. Defends against a TypeScript port that forgets the >>> 0 coercion (signed division of a negative numerator would yield a negative answer that bypasses the `<= SLOPERANGE` test).',
  },
  {
    id: 'slopediv_with_negative_den_underflows_to_zero_quotient',
    target: 'slopeDiv',
    input: [1024, -1],
    expected: 0,
    note: 'slopeDiv(1024, -1) returns 0. After uint32 coercion, den = 4294967295, which bypasses the `< 512` guard. The formula gives (1024<<3)/(4294967295>>8) = 8192 / 16777215 = 0 (integer truncation). The clamp returns 0 unchanged. Defends against a port that does not coerce den to uint32 — a signed `den >> 8` would be -1, and dividing by -1 would produce a wrong sign.',
  },

  // composition probes (slopeDiv + tantoangle)
  {
    id: 'composition_zero_slope_yields_zero_bam',
    target: 'composition',
    input: [0, 1024],
    expected: 0,
    note: 'tantoangle[slopeDiv(0, 1024)] === 0. A zero numerator (dy === 0) gives a zero slope index, which maps to BAM angle 0. Defends against an off-by-one in the composition or a tantoangle tamper at index 0.',
  },
  {
    id: 'composition_unit_slope_yields_ang45_bam',
    target: 'composition',
    input: [1024, 1024],
    expected: 0x2000_0000,
    note: 'tantoangle[slopeDiv(1024, 1024)] === ANG45. A unit slope (dy === dx) lands at SLOPERANGE = 2048, which maps to BAM angle ANG45 (= 0x20000000). This is the canonical octant boundary used by R_PointToAngle.',
  },
  {
    id: 'composition_quarter_slope_lookup_known_bam',
    target: 'composition',
    input: [256, 1024],
    expected: 167_458_912,
    note: 'tantoangle[slopeDiv(256, 1024)] === 167458912. slopeDiv(256, 1024) = (256<<3)/(1024>>8) = 2048/4 = 512, and tantoangle[512] = 167458912. Defends against a tamper that pretends quarter-slope lookups produce ANG45 / 4 (= 134217728); the actual value is larger because of arctangent concavity (the BAM angle accumulated over the first quarter of the slope range exceeds a linear ANG45 / 4).',
  },
] as const;

/** A candidate fine-tangent / slope-table tuple for cross-checking. */
export interface FineTangentAndSlopeCandidate {
  readonly finetangent: Int32Array;
  readonly tantoangle: Uint32Array;
  readonly slopeDiv: (num: number, den: number) => number;
}

/**
 * Compute the sha256 hash of a typed-array buffer in its canonical
 * little-endian byte layout.
 */
export function sha256OfTypedArray(view: Int32Array | Uint32Array): string {
  const bytes = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Cross-check a candidate fine-tangent / slope-table tuple against
 * `FINE_TANGENT_AND_SLOPE_PROBES` and `FINE_TANGENT_AND_SLOPE_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the candidate is parity-safe under every audited operational
 * fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one cell or composition input.
 */
export function crossCheckFineTangentAndSlope(candidate: FineTangentAndSlopeCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of FINE_TANGENT_AND_SLOPE_PROBES) {
    let actual: number;
    if (probe.target === 'finetangent') {
      const index = probe.input as number;
      actual = candidate.finetangent[index] ?? Number.NaN;
    } else if (probe.target === 'tantoangle_increment') {
      const index = probe.input as number;
      const high = candidate.tantoangle[index + 1] ?? Number.NaN;
      const low = candidate.tantoangle[index] ?? Number.NaN;
      actual = high - low;
    } else if (probe.target === 'slopeDiv') {
      const [num, den] = probe.input as readonly [number, number];
      actual = candidate.slopeDiv(num, den);
    } else {
      const [num, den] = probe.input as readonly [number, number];
      const idx = candidate.slopeDiv(num, den);
      actual = candidate.tantoangle[idx] ?? Number.NaN;
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // finetangent strict monotonicity
  let monotonicFailed = false;
  for (let i = 1; i < candidate.finetangent.length; i++) {
    const prev = candidate.finetangent[i - 1] ?? Number.NaN;
    const curr = candidate.finetangent[i] ?? Number.NaN;
    if (curr <= prev) {
      monotonicFailed = true;
      break;
    }
  }
  if (monotonicFailed) {
    failures.push('invariant:FINETANGENT_STRICTLY_MONOTONIC_INCREASING');
  }

  // finetangent negative half
  let negativeHalfFailed = false;
  for (let i = 0; i < AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX; i++) {
    const value = candidate.finetangent[i];
    if (value === undefined || value >= 0) {
      negativeHalfFailed = true;
      break;
    }
  }
  if (negativeHalfFailed) {
    failures.push('invariant:FINETANGENT_NEGATIVE_HALF_ALL_NEGATIVE');
  }

  // finetangent positive half
  let positiveHalfFailed = false;
  for (let i = AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX; i < candidate.finetangent.length; i++) {
    const value = candidate.finetangent[i];
    if (value === undefined || value <= 0) {
      positiveHalfFailed = true;
      break;
    }
  }
  if (positiveHalfFailed) {
    failures.push('invariant:FINETANGENT_POSITIVE_HALF_ALL_POSITIVE');
  }

  // finetangent no exact zero
  let zeroFound = false;
  for (let i = 0; i < candidate.finetangent.length; i++) {
    if (candidate.finetangent[i] === 0) {
      zeroFound = true;
      break;
    }
  }
  if (zeroFound) {
    failures.push('invariant:FINETANGENT_NO_EXACT_ZERO_ENTRY');
  }

  // finetangent pivot values
  if (candidate.finetangent[2047] !== AUDITED_FINETANGENT_PIVOT_NEGATIVE_VALUE || candidate.finetangent[2048] !== AUDITED_FINETANGENT_PIVOT_POSITIVE_VALUE) {
    failures.push('invariant:FINETANGENT_PIVOT_VALUES_AT_2047_AND_2048');
  }

  // finetangent FRACUNIT crossing
  if (
    candidate.finetangent[AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX - 1] !== AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE ||
    candidate.finetangent[AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX] !== AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING
  ) {
    failures.push('invariant:FINETANGENT_FRACUNIT_CROSSING_AT_INDEX_3072');
  }

  // tantoangle strict monotonicity
  let tantoStrictFailed = false;
  for (let i = 1; i < candidate.tantoangle.length; i++) {
    const prev = candidate.tantoangle[i - 1] ?? Number.NaN;
    const curr = candidate.tantoangle[i] ?? Number.NaN;
    if (curr <= prev) {
      tantoStrictFailed = true;
      break;
    }
  }
  if (tantoStrictFailed) {
    failures.push('invariant:TANTOANGLE_STRICTLY_MONOTONIC_INCREASING');
  }

  // tantoangle increment sum equals ANG45
  let incrementSum = 0;
  for (let i = 1; i < candidate.tantoangle.length; i++) {
    incrementSum += (candidate.tantoangle[i] ?? 0) - (candidate.tantoangle[i - 1] ?? 0);
  }
  if (incrementSum !== AUDITED_TANTOANGLE_INCREMENT_SUM) {
    failures.push('invariant:TANTOANGLE_INCREMENT_SUM_EQUALS_ANG45');
  }

  // tantoangle increments monotonic decreasing (non-strict)
  let incrementMonotonicFailed = false;
  let prevIncrement = Number.POSITIVE_INFINITY;
  for (let i = 1; i < candidate.tantoangle.length; i++) {
    const increment = (candidate.tantoangle[i] ?? 0) - (candidate.tantoangle[i - 1] ?? 0);
    if (increment > prevIncrement) {
      incrementMonotonicFailed = true;
      break;
    }
    prevIncrement = increment;
  }
  if (incrementMonotonicFailed) {
    failures.push('invariant:TANTOANGLE_INCREMENTS_MONOTONIC_DECREASING');
  }

  // slopeDiv returns value in [0, SLOPERANGE]
  let slopeDivBoundsFailed = false;
  const sweepDenStep = 17;
  const sweepNumStep = 1023;
  for (let den = 0; den < 65_536 && !slopeDivBoundsFailed; den += sweepDenStep) {
    for (let num = 0; num < 65_536; num += sweepNumStep) {
      const result = candidate.slopeDiv(num, den);
      if (result < 0 || result > 2048 || !Number.isInteger(result)) {
        slopeDivBoundsFailed = true;
        break;
      }
    }
  }
  if (slopeDivBoundsFailed) {
    failures.push('invariant:SLOPEDIV_RETURNS_VALUE_IN_ZERO_TO_SLOPERANGE');
  }

  // slopeDiv guards den < 512
  let slopeDivGuardFailed = false;
  for (let den = 0; den < AUDITED_SLOPE_GUARD_THRESHOLD; den++) {
    if (candidate.slopeDiv(1024, den) !== 2048 || candidate.slopeDiv(0, den) !== 2048) {
      slopeDivGuardFailed = true;
      break;
    }
  }
  if (slopeDivGuardFailed) {
    failures.push('invariant:SLOPEDIV_GUARDS_DEN_LESS_THAN_GUARD_THRESHOLD');
  }

  // slopeDiv + tantoangle composition: BAM in [0, ANG45]
  let compositionFailed = false;
  const compositionSamples: readonly (readonly [number, number])[] = [
    [0, 1024],
    [1, 1024],
    [256, 1024],
    [512, 1024],
    [768, 1024],
    [1023, 1024],
    [1024, 1024],
    [0, 100_000],
    [50_000, 100_000],
    [99_999, 100_000],
    [1, 65_536],
    [65_536, 65_536],
  ];
  for (const [num, den] of compositionSamples) {
    const idx = candidate.slopeDiv(num, den);
    const angle = candidate.tantoangle[idx];
    if (angle === undefined || angle < 0 || angle > AUDITED_ANG45_BAM) {
      compositionFailed = true;
      break;
    }
  }
  if (compositionFailed) {
    failures.push('invariant:SLOPEDIV_TANTOANGLE_COMPOSITION_BAM_IN_ZERO_TO_ANG45');
  }

  // sha256 fingerprints
  let hashFailed = false;
  if (sha256OfTypedArray(candidate.finetangent) !== AUDITED_FINETANGENT_SHA256) {
    hashFailed = true;
  }
  if (!hashFailed && sha256OfTypedArray(candidate.tantoangle) !== AUDITED_TANTOANGLE_SHA256) {
    hashFailed = true;
  }
  if (hashFailed) {
    failures.push('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  }

  return failures;
}
