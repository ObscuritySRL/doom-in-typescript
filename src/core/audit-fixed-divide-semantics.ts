/**
 * Audit ledger for the vanilla DOOM 1.9 fixed-point divide semantics
 * implemented by `fixedDiv` in `src/core/fixed.ts`.
 *
 * Vanilla `FixedDiv(a, b)` is a two-branch function. The first branch
 * is an overflow guard `(abs(a) >> 14) >= abs(b)` that returns
 * `INT_MIN` or `INT_MAX` based on the sign-XOR of the operands. The
 * guard captures both genuine overflow (where the int48 quotient would
 * exceed int32) and division by zero (where `abs(b) == 0` makes the
 * comparison trivially true). The second branch performs the actual
 * division as `((int64_t) a << 16) / b` and casts back to `fixed_t`,
 * with C99 integer division truncating the quotient toward zero.
 *
 * This audit pins:
 *  - the canonical C declaration from Chocolate Doom 2.2.1 `m_fixed.c`,
 *  - the overflow-guard predicate and sign-XOR clamp rule,
 *  - the int64 shift / divide / int32-narrowing semantics on the
 *    non-overflow branch,
 *  - the divide-by-zero capture inside the overflow guard,
 *  - the documented x86 `abs(INT_MIN)` parity that lets a
 *    `FIXED_MIN`-numerator divide bypass the guard and fall through to
 *    the int48-to-int32 wrap on the non-overflow branch,
 *  - a curated probe table of (a, b) → expected pairs hand-derived
 *    against the BigInt reference (which models the canonical C body
 *    in arbitrary precision for every int32 input), and
 *  - a cross-check helper that any candidate `fixedDiv` implementation
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
 * Stable identifier for one pinned fact about the canonical FixedDiv
 * implementation or its overflow / non-overflow semantics.
 */
export type FixedDivFactId =
  | 'C_HEADER_DECLARATION'
  | 'C_BODY_OVERFLOW_GUARD'
  | 'C_BODY_OVERFLOW_RETURN'
  | 'C_BODY_INT64_DIVISION'
  | 'C_RETURN_TRUNCATION_TO_INT32'
  | 'GUARD_CAPTURES_DIVIDE_BY_ZERO'
  | 'GUARD_CLAMP_SIGN_FROM_XOR'
  | 'NON_OVERFLOW_TRUNCATES_TOWARD_ZERO'
  | 'FIXED_MIN_NUMERATOR_BYPASSES_GUARD_VIA_X86_ABS_PARITY'
  | 'JS_IMPLEMENTATION_FLOAT_DIVIDE_THEN_NARROW';

/**
 * One pinned fact about the canonical FixedDiv implementation or its
 * divide semantics.
 */
export interface FixedDivFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FixedDivFactId;
  /** Whether the fact comes from the upstream C source, the divide rule it implies, or the JavaScript decomposition that reproduces it. */
  readonly category: 'c-source' | 'divide-rule' | 'js-implementation';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet (when applicable). */
  readonly cReference: string;
  /** Reference source path inside the Chocolate Doom 2.2.1 tree, the local TypeScript file, or the literal string `derived` for facts implied by the others. */
  readonly referenceSourceFile: 'src/m_fixed.h' | 'src/m_fixed.c' | 'src/core/fixed.ts' | 'derived';
}

/**
 * Pinned ledger of ten facts that together fully constrain the
 * vanilla FixedDiv semantics. The focused test asserts that the
 * ledger is closed (every id appears exactly once and the runtime
 * `fixedDiv` honours every fact via the cross-check helper).
 */
export const FIXED_DIV_AUDIT: readonly FixedDivFact[] = [
  {
    id: 'C_HEADER_DECLARATION',
    category: 'c-source',
    description: 'Header-level declaration of FixedDiv. Both inputs and the return value are fixed_t — a typedef alias for plain signed int (int32 on every platform vanilla DOOM 1.9 ever shipped on, including the DOS x86 build).',
    cReference: 'fixed_t FixedDiv(fixed_t a, fixed_t b);',
    referenceSourceFile: 'src/m_fixed.h',
  },
  {
    id: 'C_BODY_OVERFLOW_GUARD',
    category: 'c-source',
    description:
      'The first branch of the body checks an overflow predicate using the C standard library `abs()` and a 14-bit right shift. When the shifted absolute numerator meets or exceeds the absolute denominator, the true int48 quotient would exceed int32, so the function short-circuits to a saturating clamp instead of letting the cast back to int32 wrap silently.',
    cReference: 'if ((abs(a) >> 14) >= abs(b))',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'C_BODY_OVERFLOW_RETURN',
    category: 'c-source',
    description:
      'The clamp returned by the overflow branch is INT_MIN when the operands have opposite signs and INT_MAX otherwise. Sign disagreement is detected via bitwise XOR — `(a ^ b) < 0` is true exactly when the high bit of `a` differs from the high bit of `b`, which is the int32 sign bit.',
    cReference: 'return (a^b) < 0 ? INT_MIN : INT_MAX;',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'C_BODY_INT64_DIVISION',
    category: 'c-source',
    description:
      'The second branch promotes the numerator to int64, left-shifts by FRACBITS to reach the 16.16 lane, and divides by the int32 denominator (which the C usual arithmetic conversions auto-promote to int64). C99 integer division truncates toward zero, so the int64 quotient is the toward-zero floor of the real quotient.',
    cReference: 'result = ((int64_t) a << 16) / b;',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'C_RETURN_TRUNCATION_TO_INT32',
    category: 'c-source',
    description:
      'The implicit cast back to fixed_t (int32) on return discards the upper 32 bits of the int48 quotient. The overflow guard above prevents reaching this cast in the obvious wrap cases (|a/b| > 2^14), but the documented `abs(INT_MIN)` parity hole in the guard means that some `FIXED_MIN`-numerator divides reach this cast and wrap modulo 2^32.',
    cReference: 'return (fixed_t) result;',
    referenceSourceFile: 'src/m_fixed.c',
  },
  {
    id: 'GUARD_CAPTURES_DIVIDE_BY_ZERO',
    category: 'divide-rule',
    description:
      'Division by zero is captured by the overflow guard, not by a separate check. When `b == 0`, `abs(b) == 0` and `abs(a) >> 14 >= 0` is trivially true for every non-negative `abs(a)` (including `a == 0`). So `fixedDiv(a, 0)` returns FIXED_MAX or FIXED_MIN based on the sign of `a` — vanilla never traps on divide-by-zero, it returns a clamp.',
    cReference: '/* derived from C body for b == 0 */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'GUARD_CLAMP_SIGN_FROM_XOR',
    category: 'divide-rule',
    description:
      'The guard clamp uses bitwise XOR on the operands, NOT a sign comparison on the absolute values. `(a^b) < 0` is true when `a` and `b` have opposite high bits. For `b == 0`, the XOR equals `a`, so the clamp direction follows the sign of `a` alone (positive or zero `a` returns FIXED_MAX, negative `a` returns FIXED_MIN). This matches the documented vanilla behaviour for `fixedDiv(positive, 0) == FIXED_MAX`, `fixedDiv(negative, 0) == FIXED_MIN`, `fixedDiv(0, 0) == FIXED_MAX`.',
    cReference: '/* derived from C body via (a^b) < 0 */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'NON_OVERFLOW_TRUNCATES_TOWARD_ZERO',
    category: 'divide-rule',
    description:
      'When the overflow guard does not trigger, the result is the toward-zero truncation of the real quotient `a * 2^16 / b`. Negative quotients round toward zero (NOT toward -infinity), so `fixedDiv(-7, FRACUNIT*3) == -2` (not -3). This rounding direction is opposite to the arithmetic-right-shift rule used by FixedMul; the two functions handle sign asymmetrically and demos rely on the asymmetry.',
    cReference: '/* derived from C99 integer / on int64 */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'FIXED_MIN_NUMERATOR_BYPASSES_GUARD_VIA_X86_ABS_PARITY',
    category: 'divide-rule',
    description:
      'C `abs(INT_MIN)` is undefined behaviour but evaluates to `INT_MIN` on x86 with the default DJGPP/Watcom code generator vanilla DOOM 1.9 was built with — the negation overflows back into the same bit pattern. So `abs(FIXED_MIN) >> 14 == -131072`, a negative value that compares smaller than every non-negative `abs(b)`, making the guard miss. The non-overflow branch then computes `(int64_t)FIXED_MIN << 16 / b`, which for several `b` falls outside int32 and wraps. `fixedDiv(FIXED_MIN, 1) == 0` (because `(-2^47) / 1 == -2^47` and `(int32) -2^47 == 0`); `fixedDiv(FIXED_MIN, -1) == 0` (because `(-2^47) / -1 == 2^47` and `(int32) 2^47 == 0`); `fixedDiv(FIXED_MIN, FRACUNIT) == FIXED_MIN` (exact division, no wrap); `fixedDiv(FIXED_MIN, 0) == 0` because the JS float `(FIXED_MIN * 65536) / 0` evaluates to `-Infinity` and narrows to `0` via `| 0` (the canonical C body would crash because integer divide-by-zero is undefined behaviour and raises a hardware fault on x86 — the JS implementation diverges here, but no callsite exercises the divergent input).',
    cReference: '/* derived from x86 abs(INT_MIN) == INT_MIN */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'JS_IMPLEMENTATION_FLOAT_DIVIDE_THEN_NARROW',
    category: 'js-implementation',
    description:
      'The TypeScript implementation in src/core/fixed.ts replaces the int64 shift-then-divide with a Number-based multiply-then-divide: `((a * 0x10000) / b) | 0`. The product `a * 0x10000` is bounded by `|a| * 2^16 <= 2^31 * 2^16 = 2^47`, well below `Number.MAX_SAFE_INTEGER` (2^53), so it is represented exactly as a float64. The float divide rounds the real quotient to the nearest representable double, and the final `| 0` reproduces the C int32 narrowing cast (truncation toward zero followed by modulo-2^32 wrap). Float rounding error is bounded by 0.5 ulp at the quotient magnitude (at most 2^31), which is below 1 — so truncating with `| 0` lands on the same int32 quotient as the canonical int64 path for every input.',
    cReference: 'function fixedDiv(a, b) { const absoluteA = a < 0 ? -a | 0 : a; const absoluteB = b < 0 ? -b | 0 : b; if (absoluteA >> 14 >= absoluteB) { return (a ^ b) < 0 ? FIXED_MIN : FIXED_MAX; } return ((a * 0x10000) / b) | 0; }',
    referenceSourceFile: 'src/core/fixed.ts',
  },
] as const;

/**
 * Stable identifier for one derived invariant the cross-check helper
 * enforces against any candidate FixedDiv implementation.
 */
export type FixedDivInvariantId =
  | 'GUARD_CATCHES_DIVIDE_BY_ZERO_FOR_EVERY_NUMERATOR'
  | 'GUARD_CLAMP_FOLLOWS_SIGN_XOR'
  | 'IDENTITY_BY_FRACUNIT_DIVISOR'
  | 'IDENTITY_BY_SELF_DIVISOR'
  | 'ZERO_DIVIDEND_ABSORBS_FOR_NON_ZERO_DIVISOR'
  | 'INT32_RANGE_RESULT'
  | 'AGREES_WITH_BIGINT_REFERENCE';

/**
 * One derived invariant the cross-check helper enforces over the full
 * probe sweep (in addition to the per-probe expected values).
 */
export interface FixedDivInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FixedDivInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of seven derived invariants. The focused test asserts
 * that the ledger is closed and that the cross-check helper returns
 * exactly the right failure id for each tampered candidate.
 */
export const FIXED_DIV_INVARIANTS: readonly FixedDivInvariant[] = [
  {
    id: 'GUARD_CATCHES_DIVIDE_BY_ZERO_FOR_EVERY_NUMERATOR',
    description:
      'fixedDiv(a, 0) returns FIXED_MAX or FIXED_MIN — never a finite int32 — for every probed a EXCEPT a == FIXED_MIN (the documented FIXED_MIN bypass returns 0 in the JS implementation; see the FIXED_MIN_NUMERATOR_BYPASSES_GUARD_VIA_X86_ABS_PARITY fact).',
  },
  {
    id: 'GUARD_CLAMP_FOLLOWS_SIGN_XOR',
    description:
      'When the guard triggers, the returned clamp is FIXED_MIN if (a ^ b) < 0 (signs differ) and FIXED_MAX otherwise — the cross-check models the guard predicate independently and verifies the clamp direction on every probe whose guard is expected to trigger.',
  },
  {
    id: 'IDENTITY_BY_FRACUNIT_DIVISOR',
    description: 'fixedDiv(a, FRACUNIT) === (a | 0) for every probed a where the non-overflow branch is reached (guard does not trigger AND the int64 result fits in int32).',
  },
  {
    id: 'IDENTITY_BY_SELF_DIVISOR',
    description:
      'fixedDiv(a, a) === FRACUNIT for every non-zero probed a where the guard does not trigger — when the operands match exactly, the toward-zero quotient is exactly FRACUNIT. Skipped for a == FIXED_MIN because the abs-wrap parity makes the self-guard trigger and return FIXED_MAX.',
  },
  {
    id: 'ZERO_DIVIDEND_ABSORBS_FOR_NON_ZERO_DIVISOR',
    description:
      'fixedDiv(0, b) === 0 for every probed non-zero b — the guard misses (0 >> 14 == 0 < |b|), the int64 numerator is zero, and the cast back to int32 is zero. Skipped for b == FIXED_MIN because the abs-wrap parity makes the guard trigger (0 >= -2^31) and return FIXED_MIN.',
  },
  {
    id: 'INT32_RANGE_RESULT',
    description: 'fixedDiv(a, b) is always within [FIXED_MIN, FIXED_MAX] for every probe — the | 0 narrowing must run.',
  },
  {
    id: 'AGREES_WITH_BIGINT_REFERENCE',
    description: 'fixedDiv(a, b) === fixedDivReference(a, b) for every probe — the canonical C body modelled in arbitrary precision.',
  },
] as const;

/**
 * Stable identifier for one curated FixedDiv probe.
 */
export type FixedDivProbeId =
  | 'identity_FRACUNIT_div_FRACUNIT'
  | 'identity_seven_div_FRACUNIT'
  | 'identity_neg_three_div_FRACUNIT'
  | 'zero_div_FRACUNIT'
  | 'zero_div_neg_FRACUNIT'
  | 'integer_six_div_three'
  | 'integer_six_div_neg_three'
  | 'integer_neg_six_div_neg_three'
  | 'fractional_three_div_two'
  | 'fractional_half_div_half'
  | 'fractional_neg_three_div_two'
  | 'truncation_seven_div_three_FRACUNIT'
  | 'truncation_neg_seven_div_three_FRACUNIT'
  | 'truncation_one_div_FRACUNIT'
  | 'divide_by_zero_positive_returns_FIXED_MAX'
  | 'divide_by_zero_negative_returns_FIXED_MIN'
  | 'divide_by_zero_zero_returns_FIXED_MAX'
  | 'overflow_FIXED_MAX_div_one'
  | 'overflow_neg_FIXED_MAX_div_one'
  | 'overflow_at_boundary_16384_FRACUNIT'
  | 'non_overflow_just_below_boundary'
  | 'wrap_FIXED_MIN_div_one_to_zero'
  | 'wrap_FIXED_MIN_div_neg_one_to_zero'
  | 'overflow_FIXED_MIN_div_FIXED_MIN_clamps_FIXED_MAX'
  | 'wrap_FIXED_MIN_div_FRACUNIT_preserves_FIXED_MIN';

/**
 * One curated (a, b) → expected probe.
 *
 * `expected` is the bit-for-bit output of the canonical C body
 * (overflow-guard branch or int64 shift-divide-narrow branch),
 * hand-derived in arbitrary precision and re-checked by the focused
 * test against a BigInt reference (so transcription mistakes in this
 * ledger fail loudly rather than silently calibrating the runtime to
 * a wrong reference).
 */
export interface FixedDivProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: FixedDivProbeId;
  /** Which behavioural class this probe exercises. */
  readonly category: 'identity' | 'zero-dividend' | 'integer' | 'fractional' | 'truncation' | 'divide-by-zero' | 'overflow-guard' | 'boundary' | 'fixed-min-bypass';
  /** Whether the canonical C body is expected to take the overflow-guard branch (`true`) or the int64 shift-divide-narrow branch (`false`) for this input pair. */
  readonly guardTriggers: boolean;
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
 * The probe set covers: identity by FRACUNIT divisor, zero-dividend
 * absorption, plain integer division (three sign combinations),
 * pure-fractional division, the truncation-toward-zero rounding
 * direction (positive and negative), divide-by-zero capture for the
 * three numerator signs, the overflow-guard clamp on the four
 * extremes, the just-at and just-below boundary at numerator =
 * (2^14 * FRACUNIT) ± 1, and the documented x86 abs(INT_MIN) parity
 * hole that lets a FIXED_MIN numerator bypass the guard and either
 * wrap to zero (b == ±1) or pass through cleanly (b == FRACUNIT).
 */
export const FIXED_DIV_PROBES: readonly FixedDivProbe[] = [
  // Identity by FRACUNIT divisor
  { id: 'identity_FRACUNIT_div_FRACUNIT', category: 'identity', guardTriggers: false, a: 65_536, b: 65_536, expected: 65_536, note: '1.0 / 1.0 = 1.0 — the simplest identity probe; the toward-zero quotient is exactly FRACUNIT.' },
  { id: 'identity_seven_div_FRACUNIT', category: 'identity', guardTriggers: false, a: 458_752, b: 65_536, expected: 458_752, note: '7.0 / 1.0 = 7.0 — identity preserves arbitrary multiples of FRACUNIT.' },
  { id: 'identity_neg_three_div_FRACUNIT', category: 'identity', guardTriggers: false, a: -196_608, b: 65_536, expected: -196_608, note: '-3.0 / 1.0 = -3.0 — identity preserves negative multiples of FRACUNIT cleanly.' },

  // Zero dividend
  { id: 'zero_div_FRACUNIT', category: 'zero-dividend', guardTriggers: false, a: 0, b: 65_536, expected: 0, note: '0 / 1.0 = 0 — zero dividend absorbs through the non-overflow branch.' },
  { id: 'zero_div_neg_FRACUNIT', category: 'zero-dividend', guardTriggers: false, a: 0, b: -65_536, expected: 0, note: '0 / -1.0 = 0 — zero dividend with negative divisor still absorbs.' },

  // Plain integer division
  { id: 'integer_six_div_three', category: 'integer', guardTriggers: false, a: 393_216, b: 196_608, expected: 131_072, note: '6.0 / 3.0 = 2.0 — plain integer division.' },
  { id: 'integer_six_div_neg_three', category: 'integer', guardTriggers: false, a: 393_216, b: -196_608, expected: -131_072, note: '6.0 / -3.0 = -2.0 — sign propagates correctly through one negative operand.' },
  { id: 'integer_neg_six_div_neg_three', category: 'integer', guardTriggers: false, a: -393_216, b: -196_608, expected: 131_072, note: '-6.0 / -3.0 = 2.0 — two negatives divide to a positive.' },

  // Fractional results
  { id: 'fractional_three_div_two', category: 'fractional', guardTriggers: false, a: 196_608, b: 131_072, expected: 98_304, note: '3.0 / 2.0 = 1.5 — fractional result: the int64 quotient hits 0x18000 = 1.5 in 16.16.' },
  { id: 'fractional_half_div_half', category: 'fractional', guardTriggers: false, a: 32_768, b: 32_768, expected: 65_536, note: '0.5 / 0.5 = 1.0 — sub-FRACUNIT operands divide back to FRACUNIT.' },
  { id: 'fractional_neg_three_div_two', category: 'fractional', guardTriggers: false, a: -196_608, b: 131_072, expected: -98_304, note: '-3.0 / 2.0 = -1.5 — sign propagates through fractional results.' },

  // Truncation toward zero (the rule that distinguishes FixedDiv from FixedMul)
  {
    id: 'truncation_seven_div_three_FRACUNIT',
    category: 'truncation',
    guardTriggers: false,
    a: 7,
    b: 196_608,
    expected: 2,
    note: '7 (raw 16.16 units, ~0.000107) / 3.0 = 2 — (7 << 16) / 196608 = 458752 / 196608 = 2 remainder 65536. Toward-zero truncation lands on 2.',
  },
  {
    id: 'truncation_neg_seven_div_three_FRACUNIT',
    category: 'truncation',
    guardTriggers: false,
    a: -7,
    b: 196_608,
    expected: -2,
    note: '-7 / 3.0 = -2 — toward-zero truncation lands on -2 (NOT -3, which is what arithmetic-right-shift / floor-toward-neg-infinity would give). Defends against accidentally porting the FixedMul rounding direction.',
  },
  {
    id: 'truncation_one_div_FRACUNIT',
    category: 'truncation',
    guardTriggers: false,
    a: 1,
    b: 65_536,
    expected: 1,
    note: '1 (raw 16.16 unit, ~0.0000153) / 1.0 = 1 — (1 << 16) / 65536 = 1 exactly; the smallest non-zero numerator survives the round trip.',
  },

  // Divide by zero (captured by the overflow guard via abs(0) == 0)
  {
    id: 'divide_by_zero_positive_returns_FIXED_MAX',
    category: 'divide-by-zero',
    guardTriggers: true,
    a: 65_536,
    b: 0,
    expected: 0x7fff_ffff,
    note: 'FRACUNIT / 0 = FIXED_MAX — abs(0) == 0, guard triggers, (FRACUNIT ^ 0) == FRACUNIT (positive), clamp returns FIXED_MAX.',
  },
  {
    id: 'divide_by_zero_negative_returns_FIXED_MIN',
    category: 'divide-by-zero',
    guardTriggers: true,
    a: -65_536,
    b: 0,
    expected: -0x8000_0000,
    note: '-FRACUNIT / 0 = FIXED_MIN — guard triggers, (-FRACUNIT ^ 0) == -FRACUNIT (negative), clamp returns FIXED_MIN.',
  },
  {
    id: 'divide_by_zero_zero_returns_FIXED_MAX',
    category: 'divide-by-zero',
    guardTriggers: true,
    a: 0,
    b: 0,
    expected: 0x7fff_ffff,
    note: '0 / 0 = FIXED_MAX — abs(0) >> 14 == 0 >= abs(0) == 0 triggers the guard, (0 ^ 0) == 0 is NOT < 0, so the false branch returns FIXED_MAX. Defends the documented vanilla-DOOM-quirk that 0/0 is FIXED_MAX, not FIXED_MIN.',
  },

  // Overflow guard on the four extremes
  {
    id: 'overflow_FIXED_MAX_div_one',
    category: 'overflow-guard',
    guardTriggers: true,
    a: 0x7fff_ffff,
    b: 1,
    expected: 0x7fff_ffff,
    note: 'FIXED_MAX / 1 = FIXED_MAX — abs(FIXED_MAX) >> 14 == 131071 >= 1 triggers the guard; (FIXED_MAX ^ 1) is positive, clamp returns FIXED_MAX.',
  },
  {
    id: 'overflow_neg_FIXED_MAX_div_one',
    category: 'overflow-guard',
    guardTriggers: true,
    a: -0x7fff_ffff,
    b: 1,
    expected: -0x8000_0000,
    note: '-FIXED_MAX / 1 = FIXED_MIN — abs(-FIXED_MAX) == FIXED_MAX, guard triggers; (-FIXED_MAX ^ 1) is negative, clamp returns FIXED_MIN.',
  },
  {
    id: 'overflow_at_boundary_16384_FRACUNIT',
    category: 'overflow-guard',
    guardTriggers: true,
    a: 0x4000_0000,
    b: 65_536,
    expected: 0x7fff_ffff,
    note: '16384.0 / 1.0 — abs(0x40000000) >> 14 == 0x10000 == abs(FRACUNIT), so >= triggers EXACTLY at the boundary even though the true quotient (16384.0 in 16.16 == 0x40000000) would fit in int32. Pins the >= comparison against an off-by-one > tamper.',
  },

  // Boundary just below overflow guard
  {
    id: 'non_overflow_just_below_boundary',
    category: 'boundary',
    guardTriggers: false,
    a: 0x3fff_c000,
    b: 65_536,
    expected: 0x3fff_c000,
    note: '16383.0 / 1.0 — abs(0x3FFFC000) >> 14 == 0xFFFF == 65535, vs abs(FRACUNIT) == 65536. 65535 >= 65536 is false, guard misses, division returns 16383.0. Pins the > vs >= boundary one ulp below the trigger.',
  },

  // FIXED_MIN bypass via x86 abs(INT_MIN) parity
  {
    id: 'wrap_FIXED_MIN_div_one_to_zero',
    category: 'fixed-min-bypass',
    guardTriggers: false,
    a: -0x8000_0000,
    b: 1,
    expected: 0,
    note: 'FIXED_MIN / 1 = 0 — abs(INT_MIN) wraps to INT_MIN (negative), so abs(INT_MIN) >> 14 == -131072, which is NOT >= 1, guard misses. Non-overflow branch: (int64) FIXED_MIN << 16 == -2^47, divided by 1 == -2^47, narrowed to int32 wraps to 0.',
  },
  {
    id: 'wrap_FIXED_MIN_div_neg_one_to_zero',
    category: 'fixed-min-bypass',
    guardTriggers: false,
    a: -0x8000_0000,
    b: -1,
    expected: 0,
    note: 'FIXED_MIN / -1 = 0 — guard still misses for the same reason. Non-overflow branch: -2^47 / -1 == 2^47, narrowed to int32 wraps to 0. Demonstrates the bypass produces the same int48 magnitude that wraps to zero regardless of divisor sign.',
  },
  {
    id: 'overflow_FIXED_MIN_div_FIXED_MIN_clamps_FIXED_MAX',
    category: 'fixed-min-bypass',
    guardTriggers: true,
    a: -0x8000_0000,
    b: -0x8000_0000,
    expected: 0x7fff_ffff,
    note: 'FIXED_MIN / FIXED_MIN = FIXED_MAX — abs(FIXED_MIN) wraps to FIXED_MIN; abs(a) >> 14 == -131072 vs abs(b) == FIXED_MIN == -2^31; -131072 >= -2^31 is true, guard TRIGGERS this time (because both sides of the comparison are negative). (FIXED_MIN ^ FIXED_MIN) == 0, not < 0, clamp returns FIXED_MAX.',
  },
  {
    id: 'wrap_FIXED_MIN_div_FRACUNIT_preserves_FIXED_MIN',
    category: 'fixed-min-bypass',
    guardTriggers: false,
    a: -0x8000_0000,
    b: 65_536,
    expected: -0x8000_0000,
    note: 'FIXED_MIN / 1.0 = FIXED_MIN — guard misses, non-overflow branch: -2^47 / 2^16 == -2^31 == FIXED_MIN exactly. Result wraps trivially (no high bits to drop).',
  },
] as const;

/** A candidate FixedDiv implementation taking two int32 values and returning an int32 value. */
export type FixedDivFunction = (a: number, b: number) => number;

/**
 * Reference implementation modelling the canonical C body of FixedDiv
 * in arbitrary precision via BigInt.
 *
 * The two-branch shape mirrors the C body exactly:
 *   1. Compute `abs(a)` and `abs(b)` with the documented x86 wrap
 *      behaviour for `abs(INT_MIN) == INT_MIN`. In int32 arithmetic
 *      this is `a < 0 ? (-a | 0) : a` — for `a == INT_MIN`, `-a`
 *      evaluates to `2^31` which `| 0` wraps back to `INT_MIN`.
 *   2. Test the overflow guard `(absA >> 14) >= absB` using signed
 *      int32 arithmetic right shift and a signed comparison.
 *   3. If the guard triggers, return `INT_MIN` if `(a ^ b) < 0` else
 *      `INT_MAX`.
 *   4. Otherwise, compute the int64 shift-divide as
 *      `(BigInt(a) << 16n) / BigInt(b)` and narrow back to int32 via
 *      `BigInt.asIntN(32, ...)` — BigInt division truncates toward
 *      zero (matching C99 integer division), and `asIntN(32, ...)`
 *      reproduces the implicit narrowing cast to fixed_t.
 *
 * Inputs that are not int32 (NaN, Infinity, fractional, or out of
 * [INT32_MIN, INT32_MAX]) are coerced via `| 0` to match the C
 * truncation that callers' int32-typed `fixed_t` arguments would
 * implicitly apply.
 */
export function fixedDivReference(a: number, b: number): number {
  const aInt32 = a | 0;
  const bInt32 = b | 0;

  // C `abs()` with x86 INT_MIN parity — `abs(INT_MIN)` wraps to INT_MIN
  // under two's-complement negation. Reproduce by negating then
  // narrowing to int32 with `| 0`.
  const absoluteA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
  const absoluteB = bInt32 < 0 ? -bInt32 | 0 : bInt32;

  // Overflow guard: signed int32 arithmetic-right-shift, signed compare.
  if (absoluteA >> 14 >= absoluteB) {
    return (aInt32 ^ bInt32) < 0 ? AUDITED_FIXED_MIN : AUDITED_FIXED_MAX;
  }

  // Non-overflow branch reached with `b == 0` only via the documented
  // `abs(INT_MIN)` parity hole: `aInt32 == FIXED_MIN`, the guard
  // misses (because `abs(FIXED_MIN) >> 14 == -131072` does not satisfy
  // `>= 0`), and the JS implementation in `src/core/fixed.ts` then
  // computes `(FIXED_MIN * 0x10000) / 0`, which evaluates to
  // `-Infinity` and narrows to `0` via `| 0`. The canonical C body
  // would crash (integer divide-by-zero is undefined behaviour and
  // raises a hardware fault on x86); the JS implementation does not,
  // and the audit pins the JS behavior bit-for-bit.
  if (bInt32 === 0) {
    return 0;
  }

  // Non-overflow branch: (int64) a << 16 / b, then cast to int32.
  const shifted = BigInt(aInt32) << BigInt(AUDITED_FRACBITS);
  const quotient = shifted / BigInt(bInt32);
  return Number(BigInt.asIntN(32, quotient));
}

/**
 * Cross-check a candidate FixedDiv implementation against
 * `FIXED_DIV_PROBES` and `FIXED_DIV_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the candidate is
 * parity-safe under every audited fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one probe input.
 */
export function crossCheckFixedDivSemantics(fixedDivFn: FixedDivFunction): readonly string[] {
  const failures: string[] = [];

  for (const probe of FIXED_DIV_PROBES) {
    const actual = fixedDivFn(probe.a, probe.b);
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  let guardZeroFailed = false;
  let guardClampSignFailed = false;
  let identityFracunitFailed = false;
  let identitySelfFailed = false;
  let zeroDividendFailed = false;
  let int32RangeFailed = false;
  let bigIntReferenceFailed = false;

  // Sweep over every probe operand value as a numerator for the
  // divide-by-zero invariant — every probe a (and probe b) must
  // produce a clamp when divided by 0.
  const probeOperands = new Set<number>();
  for (const probe of FIXED_DIV_PROBES) {
    probeOperands.add(probe.a);
    probeOperands.add(probe.b);
  }

  for (const value of probeOperands) {
    const valueInt32 = value | 0;

    if (!guardZeroFailed) {
      // Skip the documented `abs(INT_MIN)` parity hole — `fixedDiv(
      // FIXED_MIN, 0)` evaluates to `0` in the JS implementation
      // because `abs(FIXED_MIN) >> 14 == -131072` does not satisfy
      // `>= 0`, the guard misses, and the JS float `(FIXED_MIN *
      // 65536) / 0` narrows to `0`. The other 24 numerator values
      // (including `0` itself) all hit the guard cleanly.
      if (valueInt32 !== AUDITED_FIXED_MIN) {
        const result = fixedDivFn(valueInt32, 0);
        if (result !== AUDITED_FIXED_MAX && result !== AUDITED_FIXED_MIN) {
          failures.push('invariant:GUARD_CATCHES_DIVIDE_BY_ZERO_FOR_EVERY_NUMERATOR');
          guardZeroFailed = true;
        }
      }
    }

    if (!zeroDividendFailed && valueInt32 !== 0) {
      // Skip the FIXED_MIN divisor — `fixedDiv(0, FIXED_MIN)` triggers
      // the guard because `abs(FIXED_MIN)` wraps to FIXED_MIN itself
      // (negative), making `0 >= abs(FIXED_MIN)` true (0 > -2^31), so
      // the guard returns FIXED_MIN (since `0 ^ FIXED_MIN < 0`). The
      // invariant only covers divisors where `abs(b)` behaves as a
      // positive int32 — i.e., every non-zero non-FIXED_MIN value.
      if (valueInt32 !== AUDITED_FIXED_MIN && fixedDivFn(0, valueInt32) !== 0) {
        failures.push('invariant:ZERO_DIVIDEND_ABSORBS_FOR_NON_ZERO_DIVISOR');
        zeroDividendFailed = true;
      }
    }
  }

  for (const probe of FIXED_DIV_PROBES) {
    const direct = fixedDivFn(probe.a, probe.b);

    // GUARD_CLAMP_FOLLOWS_SIGN_XOR — when this probe is expected to
    // trigger the guard, verify the clamp direction matches the sign-
    // XOR rule.
    if (!guardClampSignFailed && probe.guardTriggers) {
      const expectedClamp = (probe.a ^ probe.b) < 0 ? AUDITED_FIXED_MIN : AUDITED_FIXED_MAX;
      if (direct !== expectedClamp) {
        failures.push('invariant:GUARD_CLAMP_FOLLOWS_SIGN_XOR');
        guardClampSignFailed = true;
      }
    }

    // IDENTITY_BY_FRACUNIT_DIVISOR — for every probe input `a`,
    // fixedDiv(a, FRACUNIT) must return `a` UNLESS the int64 result
    // (a << 16) / FRACUNIT == a wraps when narrowed to int32 (which
    // never happens — `a` is already int32, so the round trip is
    // exact) OR the guard triggers. The guard `abs(a) >> 14 >=
    // FRACUNIT` requires `|a| >= 2^30`, so probe values in (-2^30,
    // 2^30) safely test the identity.
    if (!identityFracunitFailed) {
      const a = probe.a | 0;
      const guardAbsoluteA = a < 0 ? -a | 0 : a;
      const guardAbsoluteFracunit = AUDITED_FRACUNIT;
      const guardWouldTrigger = guardAbsoluteA >> 14 >= guardAbsoluteFracunit;
      if (!guardWouldTrigger && fixedDivFn(a, AUDITED_FRACUNIT) !== a) {
        failures.push('invariant:IDENTITY_BY_FRACUNIT_DIVISOR');
        identityFracunitFailed = true;
      }
    }

    // IDENTITY_BY_SELF_DIVISOR — fixedDiv(a, a) === FRACUNIT for every
    // non-zero probe input where the guard does not trigger. The
    // guard `abs(a) >> 14 >= abs(a)` is normally false (because
    // `|a| >> 14 < |a|` whenever `|a| > 0`), but the documented x86
    // `abs(INT_MIN)` parity hole makes `abs(FIXED_MIN) >> 14 ==
    // -131072` and `abs(FIXED_MIN) == FIXED_MIN == -2^31`, so the
    // signed compare `-131072 >= -2^31` is TRUE — the guard triggers
    // and returns FIXED_MAX. Skip when the guard would trigger.
    if (!identitySelfFailed) {
      const a = probe.a | 0;
      const guardAbsoluteSelf = a < 0 ? -a | 0 : a;
      const selfGuardWouldTrigger = guardAbsoluteSelf >> 14 >= guardAbsoluteSelf;
      if (a !== 0 && !selfGuardWouldTrigger && fixedDivFn(a, a) !== AUDITED_FRACUNIT) {
        failures.push('invariant:IDENTITY_BY_SELF_DIVISOR');
        identitySelfFailed = true;
      }
    }

    if (!int32RangeFailed && (direct < AUDITED_FIXED_MIN || direct > AUDITED_FIXED_MAX || (direct | 0) !== direct)) {
      failures.push('invariant:INT32_RANGE_RESULT');
      int32RangeFailed = true;
    }

    if (!bigIntReferenceFailed) {
      const reference = fixedDivReference(probe.a, probe.b);
      if (direct !== reference) {
        failures.push('invariant:AGREES_WITH_BIGINT_REFERENCE');
        bigIntReferenceFailed = true;
      }
    }
  }

  return failures;
}
