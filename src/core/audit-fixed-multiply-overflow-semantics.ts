/**
 * Audit ledger for the vanilla DOOM 1.9 fixed-point multiply overflow
 * semantics implemented by `fixedMul` in `src/core/fixed.ts`.
 *
 * Vanilla `FixedMul(a, b)` is a one-line int64-promoted multiply with
 * an arithmetic right shift back into the 16.16 fixed-point lane. The
 * implicit narrowing cast to `fixed_t` (int32) on return silently
 * truncates any product whose `>> FRACBITS` magnitude exceeds the
 * int32 range — vanilla demos, fast-projectile physics, AI sound
 * propagation, and the renderer all silently rely on this two's
 * complement wrap.
 *
 * This audit pins:
 *  - the canonical C declaration from Chocolate Doom 2.2.1 `m_fixed.c`,
 *  - the int64 → int32 truncation rule that controls the wrap,
 *  - a curated probe table of (a, b) → expected pairs hand-derived
 *    against the BigInt reference
 *    `Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b)) >> 16n))`
 *    (which models the C body bit-for-bit for every int32 input), and
 *  - a cross-check helper that any candidate `fixedMul` implementation
 *    must satisfy.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`m_fixed.h`, `m_fixed.c`, `tables.c`,
 *      `d_main.c`, `g_game.c`).
 *
 * The C declaration and body below are pinned against authority 5
 * because they are textual constants that DOSBox cannot disagree with.
 * The probe expectations are the unique values produced by the
 * canonical C body when executed in arbitrary precision and re-cast
 * back to int32 — the focused test re-verifies them against a BigInt
 * reference to defend against transcription drift in this ledger.
 *
 * The audit module deliberately does NOT import from `src/core/fixed.ts`.
 * Hardcoding the canonical FRACBITS / FRACUNIT / FIXED_MAX / FIXED_MIN
 * values here means a corruption of `src/core/fixed.ts` cannot also
 * silently corrupt the probe table that detects the corruption.
 */

/** Audited canonical value of FRACBITS — pinned independently of `src/core/fixed.ts`. */
export const AUDITED_FRACBITS = 16;

/** Audited canonical value of FRACUNIT — pinned independently of `src/core/fixed.ts`. */
export const AUDITED_FRACUNIT = 65_536;

/** Audited canonical value of FIXED_MAX (= INT32_MAX) — pinned independently. */
export const AUDITED_FIXED_MAX = 0x7fff_ffff;

/** Audited canonical value of FIXED_MIN (= INT32_MIN) — pinned independently. */
export const AUDITED_FIXED_MIN = -0x8000_0000;

/**
 * Stable identifier for one pinned fact about the canonical FixedMul
 * implementation or its overflow semantics.
 */
export type FixedMulOverflowFactId =
  | 'C_HEADER_DECLARATION'
  | 'C_BODY_INT64_PROMOTION'
  | 'C_BODY_ARITHMETIC_RIGHT_SHIFT'
  | 'C_RETURN_TRUNCATION_TO_INT32'
  | 'OVERFLOW_WRAPS_MODULO_2_TO_32'
  | 'OVERFLOW_RIGHT_SHIFT_ROUNDS_TOWARD_NEG_INF'
  | 'OVERFLOW_IDENTITY_BY_FRACUNIT'
  | 'OVERFLOW_ZERO_ABSORBS'
  | 'OVERFLOW_COMMUTES'
  | 'JS_DECOMPOSITION_BOUNDED_BY_2_TO_53';

/**
 * One pinned fact about the canonical FixedMul implementation or its
 * overflow semantics.
 */
export interface FixedMulOverflowFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FixedMulOverflowFactId;
  /** Whether the fact comes from the upstream C source, the wrap rule it implies, or the JavaScript decomposition that reproduces it. */
  readonly category: 'c-source' | 'overflow-rule' | 'js-implementation';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet (when applicable). */
  readonly cReference: string;
  /** Reference source path inside the Chocolate Doom 2.2.1 tree, the local TypeScript file, or the literal string `derived` for facts implied by the others. */
  readonly referenceSourceFile: 'src/m_fixed.h' | 'src/m_fixed.c' | 'src/core/fixed.ts' | 'derived';
}

/**
 * Pinned ledger of ten facts that together fully constrain the
 * vanilla FixedMul overflow semantics. The focused test asserts that
 * the ledger is closed (every id appears exactly once and the runtime
 * `fixedMul` honours every fact via the cross-check helper).
 */
export const FIXED_MUL_OVERFLOW_AUDIT: readonly FixedMulOverflowFact[] = [
  {
    id: 'C_HEADER_DECLARATION',
    category: 'c-source',
    description: 'Header-level declaration of FixedMul. Both inputs and the return value are fixed_t — a typedef alias for plain signed int (int32 on every platform vanilla DOOM 1.9 ever shipped on, including the DOS x86 build).',
    cReference: 'fixed_t FixedMul(fixed_t a, fixed_t b);',
    referenceSourceFile: 'src/m_fixed.h',
  },
  {
    id: 'C_BODY_INT64_PROMOTION',
    category: 'c-source',
    description:
      'Both operands are explicitly cast to int64_t before the multiplication, so the full 64-bit product is computed without losing the high 32 bits. Without this cast the multiply would overflow int32 silently and the 16.16 split of every downstream value (sector heights, projectile velocities, demo ticcmd movement) would be corrupted.',
    cReference: 'return ((int64_t) a * (int64_t) b) >> FRACBITS;',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'C_BODY_ARITHMETIC_RIGHT_SHIFT',
    category: 'c-source',
    description:
      'The right shift operator >> applied to a signed int64 is arithmetic (sign-preserving) on every platform Chocolate Doom 2.2.1 supports. Negative products therefore round toward negative infinity rather than toward zero — fixedMul(-3, 1) returns -1, not 0.',
    cReference: '((int64_t) a * (int64_t) b) >> FRACBITS',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'C_RETURN_TRUNCATION_TO_INT32',
    category: 'c-source',
    description:
      'The implicit cast back to fixed_t (int32) on return discards the upper 32 bits of the int48 result. When the >>16 product magnitude exceeds INT32_MAX, the truncation wraps modulo 2^32 — observable on FIXED_MAX*FIXED_MAX (= -FRACUNIT) and FIXED_MIN*FIXED_MIN (= 0).',
    cReference: 'return (fixed_t) (((int64_t) a * (int64_t) b) >> FRACBITS);',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'OVERFLOW_WRAPS_MODULO_2_TO_32',
    category: 'overflow-rule',
    description:
      'When the int48 intermediate result lies outside [INT32_MIN, INT32_MAX], the cast back to int32 wraps modulo 2^32. Vanilla demos, fast-projectile physics, and the renderer silently depend on this two-s-complement wrap; substituting saturation arithmetic would desynchronise every downstream subsystem.',
    cReference: '/* implicit narrowing cast on return */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'OVERFLOW_RIGHT_SHIFT_ROUNDS_TOWARD_NEG_INF',
    category: 'overflow-rule',
    description:
      'Arithmetic right shift on a negative product rounds toward negative infinity, not toward zero. fixedMul(-3, 1) === -1 (not 0); fixedMul(-1, 1) === -1; fixedMul(-1, -1) === 0. The fractional bits lost from the right shift are treated as a sign extension, not as a magnitude truncation.',
    cReference: '/* arithmetic >> on signed int64 */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'OVERFLOW_IDENTITY_BY_FRACUNIT',
    category: 'overflow-rule',
    description:
      'Multiplying any fixed_t by FRACUNIT (= 1.0 in 16.16) returns the original fixed_t bitwise. Proof: the int48 product equals a * 2^16, and the >>16 recovers a exactly; no narrowing-cast wrap path is reachable when one operand is FRACUNIT because |a * 2^16| stays within int48.',
    cReference: '/* derived from C body for b == FRACUNIT */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'OVERFLOW_ZERO_ABSORBS',
    category: 'overflow-rule',
    description: 'Multiplying any fixed_t by zero returns zero. Proof: the int48 product is zero and >>16 of zero is zero; no overflow path is reachable when either operand is zero, regardless of the magnitude of the other operand.',
    cReference: '/* derived from C body for a == 0 || b == 0 */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'OVERFLOW_COMMUTES',
    category: 'overflow-rule',
    description:
      'fixedMul(a, b) === fixedMul(b, a) for every (a, b) in int32 x int32. Commutativity follows from int64 multiplication being commutative; the >>16 and the int32 narrowing cast are unary and applied after the commutative product, so they preserve the symmetry.',
    cReference: '/* derived from C body, multiplication being commutative */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'JS_DECOMPOSITION_BOUNDED_BY_2_TO_53',
    category: 'js-implementation',
    description:
      'The TypeScript implementation in src/core/fixed.ts decomposes the int48 product into four 16x16 partial products so every intermediate term stays well below Number.MAX_SAFE_INTEGER (2^53). The largest partial term aHigh*bHigh*0x10000 is bounded by 2^15 * 2^15 * 2^16 = 2^46 (~128x below 2^53). The final | 0 truncation reproduces the C narrowing cast bit-for-bit; the cross-check helper confirms agreement with the BigInt reference for every probe.',
    cReference: 'function fixedMul(a, b) { const aHigh = a >> 16; const aLow = a & 0xffff; const bHigh = b >> 16; const bLow = b & 0xffff; return (aHigh*bHigh*0x10000 + aHigh*bLow + aLow*bHigh + ((aLow*bLow) >>> 16)) | 0; }',
    referenceSourceFile: 'src/core/fixed.ts',
  },
] as const;

/**
 * Stable identifier for one derived invariant the cross-check helper
 * enforces against any candidate FixedMul implementation.
 */
export type FixedMulOverflowInvariantId = 'IDENTITY_BY_FRACUNIT_LEFT' | 'IDENTITY_BY_FRACUNIT_RIGHT' | 'ZERO_LEFT_ABSORBS' | 'ZERO_RIGHT_ABSORBS' | 'COMMUTATIVE' | 'INT32_RANGE_RESULT' | 'AGREES_WITH_BIGINT_REFERENCE';

/**
 * One derived invariant the cross-check helper enforces over the full
 * probe sweep (in addition to the per-probe expected values).
 */
export interface FixedMulOverflowInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FixedMulOverflowInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of seven derived invariants. The focused test asserts
 * that the ledger is closed and that the cross-check helper returns
 * exactly the right failure id for each tampered candidate.
 */
export const FIXED_MUL_OVERFLOW_INVARIANTS: readonly FixedMulOverflowInvariant[] = [
  {
    id: 'IDENTITY_BY_FRACUNIT_LEFT',
    description: 'fixedMul(FRACUNIT, b) === (b | 0) for every probed b.',
  },
  {
    id: 'IDENTITY_BY_FRACUNIT_RIGHT',
    description: 'fixedMul(a, FRACUNIT) === (a | 0) for every probed a.',
  },
  {
    id: 'ZERO_LEFT_ABSORBS',
    description: 'fixedMul(0, b) === 0 for every probed b.',
  },
  {
    id: 'ZERO_RIGHT_ABSORBS',
    description: 'fixedMul(a, 0) === 0 for every probed a.',
  },
  {
    id: 'COMMUTATIVE',
    description: 'fixedMul(a, b) === fixedMul(b, a) for every (a, b) probe pair.',
  },
  {
    id: 'INT32_RANGE_RESULT',
    description: 'fixedMul(a, b) is always within [FIXED_MIN, FIXED_MAX] for every probe — the | 0 narrowing must run.',
  },
  {
    id: 'AGREES_WITH_BIGINT_REFERENCE',
    description: 'fixedMul(a, b) === Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b)) >> 16n)) for every probe — the canonical C body modelled in arbitrary precision.',
  },
] as const;

/**
 * Stable identifier for one curated FixedMul probe.
 */
export type FixedMulProbeId =
  | 'identity_FRACUNIT_x_FRACUNIT'
  | 'identity_FRACUNIT_x_zero'
  | 'identity_zero_x_FRACUNIT'
  | 'identity_FRACUNIT_x_seven'
  | 'identity_seven_x_FRACUNIT'
  | 'integer_three_x_two'
  | 'integer_three_x_neg_two'
  | 'integer_neg_three_x_neg_two'
  | 'fractional_half_x_half'
  | 'fractional_one_point_five_squared'
  | 'fractional_neg_one_point_five_x_one_point_five'
  | 'wrap_FIXED_MAX_squared'
  | 'wrap_FIXED_MIN_squared'
  | 'wrap_FIXED_MIN_x_FRACUNIT'
  | 'wrap_FIXED_MAX_x_FRACUNIT'
  | 'wrap_FIXED_MAX_x_two'
  | 'wrap_FIXED_MIN_x_two'
  | 'rounding_neg_three_x_one'
  | 'rounding_three_x_one'
  | 'rounding_neg_one_x_one'
  | 'rounding_neg_one_x_neg_one'
  | 'sub_unit_one_plus_epsilon_squared'
  | 'extreme_FIXED_MAX_x_FIXED_MIN'
  | 'extreme_one_x_FIXED_MAX'
  | 'extreme_one_x_FIXED_MIN';

/**
 * One curated (a, b) → expected probe.
 *
 * `expected` is the bit-for-bit output of the canonical C body
 * `((int64_t) a * (int64_t) b) >> FRACBITS` cast back to fixed_t,
 * hand-derived in arbitrary precision and re-checked by the focused
 * test against a BigInt reference (so transcription mistakes in this
 * ledger fail loudly rather than silently calibrating the runtime to
 * a wrong reference).
 */
export interface FixedMulProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FixedMulProbeId;
  /** Which behavioural class this probe exercises. */
  readonly category: 'identity' | 'zero' | 'integer' | 'fractional' | 'wrap' | 'rounding' | 'sub-unit' | 'extreme';
  /** First operand (int32). */
  readonly a: number;
  /** Second operand (int32). */
  readonly b: number;
  /** Expected canonical output (int32), hand-derived from the C body. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of twenty-five (a, b) → expected pairs. Each
 * probe is hand-derived from the canonical C body and re-verified
 * against the BigInt reference by the focused test.
 *
 * The probe set covers: identity by FRACUNIT (left and right), zero
 * absorption, plain integer multiplication (three sign combinations),
 * pure-fractional multiplication, the int48 → int32 wrap on the four
 * extremes, the arithmetic-right-shift rounding direction (negative
 * products and the smallest negative input), the sub-unit carry
 * preservation, the int32 boundary, and the cross-extreme product.
 */
export const FIXED_MUL_OVERFLOW_PROBES: readonly FixedMulProbe[] = [
  // Identity by FRACUNIT
  { id: 'identity_FRACUNIT_x_FRACUNIT', category: 'identity', a: 65_536, b: 65_536, expected: 65_536, note: '1.0 * 1.0 = 1.0 — the simplest identity probe, defends against a missing | 0 truncation that would leave 4_294_967_296.' },
  { id: 'identity_FRACUNIT_x_zero', category: 'zero', a: 65_536, b: 0, expected: 0, note: '1.0 * 0 = 0 — anything times zero is zero.' },
  { id: 'identity_zero_x_FRACUNIT', category: 'zero', a: 0, b: 65_536, expected: 0, note: '0 * 1.0 = 0 — symmetric companion to the previous probe.' },
  { id: 'identity_FRACUNIT_x_seven', category: 'identity', a: 65_536, b: 458_752, expected: 458_752, note: '1.0 * 7.0 = 7.0 — identity preserves arbitrary multiples of FRACUNIT.' },
  { id: 'identity_seven_x_FRACUNIT', category: 'identity', a: 458_752, b: 65_536, expected: 458_752, note: '7.0 * 1.0 = 7.0 — left-side identity by FRACUNIT.' },

  // Plain integer multiplication
  { id: 'integer_three_x_two', category: 'integer', a: 196_608, b: 131_072, expected: 393_216, note: '3.0 * 2.0 = 6.0 — plain integer multiplication.' },
  { id: 'integer_three_x_neg_two', category: 'integer', a: 196_608, b: -131_072, expected: -393_216, note: '3.0 * -2.0 = -6.0 — sign propagates correctly through one negative operand.' },
  { id: 'integer_neg_three_x_neg_two', category: 'integer', a: -196_608, b: -131_072, expected: 393_216, note: '-3.0 * -2.0 = 6.0 — two negatives multiply to a positive.' },

  // Pure fractional
  { id: 'fractional_half_x_half', category: 'fractional', a: 32_768, b: 32_768, expected: 16_384, note: '0.5 * 0.5 = 0.25 — pure fractional, the >>16 must drop exactly the right bits.' },
  { id: 'fractional_one_point_five_squared', category: 'fractional', a: 98_304, b: 98_304, expected: 147_456, note: '1.5 * 1.5 = 2.25 — fractional and integer parts both contribute to the product.' },
  { id: 'fractional_neg_one_point_five_x_one_point_five', category: 'fractional', a: -98_304, b: 98_304, expected: -147_456, note: '-1.5 * 1.5 = -2.25 — sign preservation across mixed-magnitude fractional.' },

  // Wrap on the four extremes
  {
    id: 'wrap_FIXED_MAX_squared',
    category: 'wrap',
    a: 0x7fff_ffff,
    b: 0x7fff_ffff,
    expected: -65_536,
    note: 'INT32_MAX^2 = 0x3FFFFFFF00000001; >>16 = 0x3FFFFFFF0000; truncated to int32 = 0xFFFF0000 = -FRACUNIT — the canonical wrap example.',
  },
  { id: 'wrap_FIXED_MIN_squared', category: 'wrap', a: -0x8000_0000, b: -0x8000_0000, expected: 0, note: 'INT32_MIN^2 = 2^62; >>16 = 2^46; truncated to int32 = 0 — every bit beyond bit 31 is dropped exactly.' },
  { id: 'wrap_FIXED_MIN_x_FRACUNIT', category: 'wrap', a: -0x8000_0000, b: 65_536, expected: -0x8000_0000, note: 'INT32_MIN * 1.0 = INT32_MIN — identity preserves the most negative input cleanly.' },
  { id: 'wrap_FIXED_MAX_x_FRACUNIT', category: 'wrap', a: 0x7fff_ffff, b: 65_536, expected: 0x7fff_ffff, note: 'INT32_MAX * 1.0 = INT32_MAX — identity preserves the most positive input cleanly.' },
  { id: 'wrap_FIXED_MAX_x_two', category: 'wrap', a: 0x7fff_ffff, b: 131_072, expected: -2, note: 'INT32_MAX * 2.0 = 0xFFFFFFFE_0000; >>16 = 0xFFFFFFFE; truncated to int32 = -2 — wrap carries past INT32_MAX into the negative half-line.' },
  { id: 'wrap_FIXED_MIN_x_two', category: 'wrap', a: -0x8000_0000, b: 131_072, expected: 0, note: 'INT32_MIN * 2.0 = -2^48; >>16 = -2^32; truncated to int32 = 0 — exact divisor of 2^32 wraps to zero, not -2^32.' },

  // Arithmetic right shift rounding direction
  { id: 'rounding_neg_three_x_one', category: 'rounding', a: -3, b: 1, expected: -1, note: 'arithmetic right shift on a tiny negative product rounds toward -infinity: floor(-3/65536) = -1, not 0 (which trunc-to-zero would give).' },
  { id: 'rounding_three_x_one', category: 'rounding', a: 3, b: 1, expected: 0, note: 'small positive products vanish under >>16: floor(3/65536) = 0.' },
  { id: 'rounding_neg_one_x_one', category: 'rounding', a: -1, b: 1, expected: -1, note: 'the smallest negative product still rounds toward -infinity: floor(-1/65536) = -1.' },
  { id: 'rounding_neg_one_x_neg_one', category: 'rounding', a: -1, b: -1, expected: 0, note: '(-1) * (-1) = 1; floor(1/65536) = 0 — the multiply itself flips sign before the shift, so the rounding direction does not apply.' },

  // Sub-unit carry
  {
    id: 'sub_unit_one_plus_epsilon_squared',
    category: 'sub-unit',
    a: 65_537,
    b: 65_537,
    expected: 65_538,
    note: '(1 + 1/65536)^2 = 1 + 2/65536 + 1/65536^2; the last term drops below 1 ulp; result = FRACUNIT + 2 — the sub-unit carry from aLow*bLow must reach aHigh*bLow + aLow*bHigh, otherwise the +2 disappears.',
  },

  // Cross-extreme and int32 boundary
  {
    id: 'extreme_FIXED_MAX_x_FIXED_MIN',
    category: 'extreme',
    a: 0x7fff_ffff,
    b: -0x8000_0000,
    expected: 32_768,
    note: 'INT32_MAX * INT32_MIN = -(2^62 - 2^31); >>16 = -(2^46 - 2^15); truncated to int32 = 32768 = 0x8000 — the cross-extreme wrap with non-trivial sign mixing.',
  },
  { id: 'extreme_one_x_FIXED_MAX', category: 'extreme', a: 1, b: 0x7fff_ffff, expected: 32_767, note: '1 * INT32_MAX = 0x7FFFFFFF; >>16 = 0x7FFF = INT16_MAX — the integer half of FIXED_MAX, by construction of the 16.16 split.' },
  { id: 'extreme_one_x_FIXED_MIN', category: 'extreme', a: 1, b: -0x8000_0000, expected: -32_768, note: '1 * INT32_MIN = -0x80000000; >>16 = -0x8000 = INT16_MIN — the integer half of FIXED_MIN, by construction of the 16.16 split.' },
] as const;

/** A candidate FixedMul implementation taking two int32 values and returning an int32 value. */
export type FixedMulFunction = (a: number, b: number) => number;

/**
 * Reference implementation modelling the canonical C body
 * `((int64_t) a * (int64_t) b) >> FRACBITS` in arbitrary precision.
 *
 * BigInt arithmetic is exact: the multiply produces the exact int64
 * product, the >> 16n is arithmetic (sign-preserving floor division
 * by 2^16), and `BigInt.asIntN(32, ...)` reproduces the implicit
 * narrowing cast back to int32 (two-s-complement wrap modulo 2^32).
 *
 * This reference is bit-for-bit identical to the C body for every
 * (a, b) in int32 x int32. It exists so the focused test can detect
 * transcription drift in the probe table — if the probe expectations
 * disagree with the reference, the focused test fails before the
 * runtime cross-check ever runs.
 *
 * Inputs that are not int32 (NaN, Infinity, fractional, or out of
 * [INT32_MIN, INT32_MAX]) are coerced via `| 0` to match the C
 * truncation that callers' int32-typed `fixed_t` arguments would
 * implicitly apply.
 */
export function fixedMulReference(a: number, b: number): number {
  const aInt32 = a | 0;
  const bInt32 = b | 0;
  const product = BigInt(aInt32) * BigInt(bInt32);
  const shifted = product >> BigInt(AUDITED_FRACBITS);
  return Number(BigInt.asIntN(32, shifted));
}

/**
 * Cross-check a candidate FixedMul implementation against
 * `FIXED_MUL_OVERFLOW_PROBES` and `FIXED_MUL_OVERFLOW_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the candidate is parity-safe under every audited fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one probe input.
 */
export function crossCheckFixedMulOverflowSemantics(fixedMulFn: FixedMulFunction): readonly string[] {
  const failures: string[] = [];

  for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
    const actual = fixedMulFn(probe.a, probe.b);
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Sweep over every probe input as the variable operand for the
  // identity-by-FRACUNIT, zero-absorption, commutativity, int32-range,
  // and BigInt-reference invariants. The probe inputs already cover
  // identity / zero / boundary / wrap / rounding cases, so the sweep
  // exercises every audited rule across the full operand space the
  // probes care about.
  const probeInputs = new Set<number>();
  for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
    probeInputs.add(probe.a);
    probeInputs.add(probe.b);
  }

  let identityLeftFailed = false;
  let identityRightFailed = false;
  let zeroLeftFailed = false;
  let zeroRightFailed = false;
  let commutativeFailed = false;
  let int32RangeFailed = false;
  let bigIntReferenceFailed = false;

  for (const value of probeInputs) {
    const valueInt32 = value | 0;

    if (!identityLeftFailed && fixedMulFn(AUDITED_FRACUNIT, value) !== valueInt32) {
      failures.push('invariant:IDENTITY_BY_FRACUNIT_LEFT');
      identityLeftFailed = true;
    }

    if (!identityRightFailed && fixedMulFn(value, AUDITED_FRACUNIT) !== valueInt32) {
      failures.push('invariant:IDENTITY_BY_FRACUNIT_RIGHT');
      identityRightFailed = true;
    }

    if (!zeroLeftFailed && fixedMulFn(0, value) !== 0) {
      failures.push('invariant:ZERO_LEFT_ABSORBS');
      zeroLeftFailed = true;
    }

    if (!zeroRightFailed && fixedMulFn(value, 0) !== 0) {
      failures.push('invariant:ZERO_RIGHT_ABSORBS');
      zeroRightFailed = true;
    }
  }

  for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
    const direct = fixedMulFn(probe.a, probe.b);
    const swapped = fixedMulFn(probe.b, probe.a);

    if (!commutativeFailed && direct !== swapped) {
      failures.push('invariant:COMMUTATIVE');
      commutativeFailed = true;
    }

    if (!int32RangeFailed && (direct < AUDITED_FIXED_MIN || direct > AUDITED_FIXED_MAX || (direct | 0) !== direct)) {
      failures.push('invariant:INT32_RANGE_RESULT');
      int32RangeFailed = true;
    }

    if (!bigIntReferenceFailed) {
      const reference = fixedMulReference(probe.a, probe.b);
      if (direct !== reference) {
        failures.push('invariant:AGREES_WITH_BIGINT_REFERENCE');
        bigIntReferenceFailed = true;
      }
    }
  }

  return failures;
}
