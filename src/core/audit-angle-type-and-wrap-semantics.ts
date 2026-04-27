/**
 * Audit ledger for the vanilla DOOM 1.9 angle_t type and wrap
 * semantics implemented by `angleWrap` and the four `ANG*` constants
 * in `src/core/angle.ts`.
 *
 * Vanilla angle_t is `typedef unsigned angle_t;` — a plain `unsigned
 * int` (uint32 on every platform vanilla DOOM 1.9 ever shipped on,
 * including the DOS x86 build). Angle arithmetic is C unsigned
 * arithmetic: addition, subtraction, and assignment all wrap modulo
 * 2^32 silently. The renderer's FOV-delta computation
 * (`R_ScaleFromGlobalAngle`'s `ANG90 + (visangle-viewangle)`) and the
 * player hitscan random offset (`P_GunShot`'s `angle += (P_Random()-
 * P_Random())<<18`) both rely on negative signed differences
 * reinterpreting as large unsigned values — substituting saturating
 * or clamped arithmetic would desynchronise both subsystems.
 *
 * This audit pins:
 *  - the canonical C header declaration of `angle_t` from
 *    Chocolate Doom 2.2.1 `tables.h`,
 *  - the four BAM constants `ANG45`, `ANG90`, `ANG180`, `ANG270` and
 *    the `ANG_MAX` sentinel from `tables.h`,
 *  - the natural unsigned wrap rule that addition / subtraction
 *    inherit from the unsigned type,
 *  - the renderer FOV-delta and player hitscan use cases that rely on
 *    the wrap behaving exactly like the C unsigned-int operators,
 *  - a curated probe table of (input → expected) pairs hand-derived
 *    against a BigInt reference (`(BigInt(input) % 2^32 + 2^32) %
 *    2^32`, which models the C unsigned wrap bit-for-bit for every
 *    finite Number input), and
 *  - a cross-check helper that any candidate `angleWrap`
 *    implementation must satisfy.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`m_fixed.h`, `m_fixed.c`,
 *      `tables.h`, `tables.c`, `d_main.c`, `g_game.c`, `r_main.c`,
 *      `p_pspr.c`).
 *
 * The C declaration and constant macros below are pinned against
 * authority 5 because they are textual constants that DOSBox cannot
 * disagree with. The probe expectations are the unique uint32 values
 * produced by the canonical C wrap when the operand is reduced modulo
 * 2^32 — the focused test re-verifies them against a BigInt reference
 * to defend against transcription drift in this ledger.
 *
 * The audit module deliberately does NOT import from
 * `src/core/angle.ts`. Hardcoding the canonical ANG45 / ANG90 /
 * ANG180 / ANG270 / ANG_MAX values here means a corruption of
 * `src/core/angle.ts` cannot also silently corrupt the probe table
 * that detects the corruption.
 */

/** Audited canonical value of ANG45 — pinned independently of `src/core/angle.ts`. */
export const AUDITED_ANG45 = 0x2000_0000;

/** Audited canonical value of ANG90 — pinned independently of `src/core/angle.ts`. */
export const AUDITED_ANG90 = 0x4000_0000;

/** Audited canonical value of ANG180 — pinned independently of `src/core/angle.ts`. */
export const AUDITED_ANG180 = 0x8000_0000;

/** Audited canonical value of ANG270 — pinned independently of `src/core/angle.ts`. */
export const AUDITED_ANG270 = 0xc000_0000;

/** Audited canonical value of ANG_MAX (= UINT32_MAX) — pinned independently. */
export const AUDITED_ANG_MAX = 0xffff_ffff;

/** Audited canonical span of one full circle in BAM units (= 2^32). */
export const AUDITED_FULL_CIRCLE = 0x1_0000_0000;

/**
 * Stable identifier for one pinned fact about the canonical angle_t
 * type, the BAM constants, or the unsigned wrap semantics.
 */
export type AngleWrapFactId =
  | 'C_HEADER_TYPEDEF_ANGLE_T'
  | 'C_HEADER_DEFINE_ANG45'
  | 'C_HEADER_DEFINE_ANG90'
  | 'C_HEADER_DEFINE_ANG180'
  | 'C_HEADER_DEFINE_ANG270'
  | 'C_HEADER_DEFINE_ANG_MAX'
  | 'UNSIGNED_ARITHMETIC_WRAPS_MOD_2_TO_32'
  | 'RENDERER_FOV_DELTA_RELIES_ON_UNSIGNED_SUBTRACT'
  | 'PLAYER_HITSCAN_RANDOM_RELIES_ON_UNSIGNED_ADD'
  | 'JS_IMPLEMENTATION_USES_UNSIGNED_RIGHT_SHIFT_ZERO';

/**
 * One pinned fact about the canonical angle_t typedef, the BAM
 * constants, or the natural unsigned wrap semantics that downstream
 * code relies on.
 */
export interface AngleWrapFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: AngleWrapFactId;
  /** Whether the fact comes from the upstream C source, the wrap rule it implies, or the JavaScript decomposition that reproduces it. */
  readonly category: 'c-source' | 'wrap-rule' | 'js-implementation';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet (when applicable). */
  readonly cReference: string;
  /** Reference source path inside the Chocolate Doom 2.2.1 tree, the local TypeScript file, or the literal string `derived` for facts implied by the others. */
  readonly referenceSourceFile: 'src/tables.h' | 'src/r_main.c' | 'src/p_pspr.c' | 'src/core/angle.ts' | 'derived';
}

/**
 * Pinned ledger of ten facts that together fully constrain the
 * vanilla angle_t type, the BAM constants, and the wrap semantics
 * downstream code relies on. The focused test asserts that the
 * ledger is closed (every id appears exactly once and the runtime
 * `angleWrap` honours every fact via the cross-check helper).
 */
export const ANGLE_WRAP_AUDIT: readonly AngleWrapFact[] = [
  {
    id: 'C_HEADER_TYPEDEF_ANGLE_T',
    category: 'c-source',
    description:
      'Header-level typedef of angle_t. The type is a plain unsigned int — uint32 on every platform vanilla DOOM 1.9 ever shipped on (DOS x86, where int is 32 bits). The canonical declaration omits the explicit `int` keyword: the C grammar treats `unsigned` alone as `unsigned int`. All angle arithmetic inherits the unsigned-wrap semantics of this base type.',
    cReference: 'typedef unsigned angle_t;',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DEFINE_ANG45',
    category: 'c-source',
    description:
      'Header-level macro for one-eighth of a full circle. The literal is exactly 0x20000000 — eight times this value is exactly 2^32, so eight ANG45 increments span one full circle. The other three named constants are derived as integer multiples of ANG45.',
    cReference: '#define ANG45           0x20000000',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DEFINE_ANG90',
    category: 'c-source',
    description: 'Header-level macro for one-quarter of a full circle. The literal is exactly 0x40000000 — twice ANG45, four times this value is exactly 2^32, the renderer FOV-delta sum `ANG90 + (visangle-viewangle)` uses this directly.',
    cReference: '#define ANG90           0x40000000',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DEFINE_ANG180',
    category: 'c-source',
    description:
      'Header-level macro for half a full circle. The literal is exactly 0x80000000 — twice ANG90, this is also the bit pattern that signed INT32_MIN reinterprets to under the unsigned cast, so any signed-overflow path through angle arithmetic that lands at INT32_MIN observably equals ANG180.',
    cReference: '#define ANG180          0x80000000',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DEFINE_ANG270',
    category: 'c-source',
    description:
      'Header-level macro for three-quarters of a full circle. The literal is exactly 0xc0000000 — ANG180 + ANG90, this is also the unsigned-wrap result of `0 - ANG90` and the renderer relies on that equivalence when computing back-facing wall angles.',
    cReference: '#define ANG270          0xc0000000',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'C_HEADER_DEFINE_ANG_MAX',
    category: 'c-source',
    description:
      'Header-level macro for the largest angle_t value. The literal is exactly 0xffffffff — adding 1 wraps to zero (one full circle), and this value is also the unsigned-wrap result of -1 (which the player turn-rate carry computation in g_game.c briefly produces before the next wrap). The runtime exports the four named constants but does not need to export ANG_MAX as a named constant — the cross-check helper covers it via the wrap probes.',
    cReference: '#define ANG_MAX         0xffffffff',
    referenceSourceFile: 'src/tables.h',
  },
  {
    id: 'UNSIGNED_ARITHMETIC_WRAPS_MOD_2_TO_32',
    category: 'wrap-rule',
    description:
      'Because angle_t is unsigned, every arithmetic operator (+, -, *, +=, -=) wraps modulo 2^32 silently. Addition past UINT32_MAX wraps to zero; subtraction below zero wraps up to the high half of the uint32 range. This wrap is load-bearing for the renderer FOV delta, the player hitscan random spread, the demo turn-rate carry, the automap rotation, and the AI sound-propagation angle. Substituting saturation or signed arithmetic would desynchronise every downstream subsystem.',
    cReference: '/* derived from C unsigned-int operator semantics on `angle_t` */',
    referenceSourceFile: 'derived',
  },
  {
    id: 'RENDERER_FOV_DELTA_RELIES_ON_UNSIGNED_SUBTRACT',
    category: 'wrap-rule',
    description:
      'R_ScaleFromGlobalAngle computes `anglea = ANG90 + (visangle-viewangle)` and `angleb = ANG90 + (visangle-rw_normalangle)` to find the FOV-relative angles of a wall segment. When `viewangle > visangle` the inner subtraction underflows below zero and wraps to a large uint32; the outer add then wraps the sum back into a meaningful BAM angle. The runtime `angleWrap` must reproduce this exact behavior on every signed/unsigned input pair the renderer can produce — substituting Math.abs or a clamp here would desynchronise every wall scale.',
    cReference: 'anglea = ANG90 + (visangle-viewangle);',
    referenceSourceFile: 'src/r_main.c',
  },
  {
    id: 'PLAYER_HITSCAN_RANDOM_RELIES_ON_UNSIGNED_ADD',
    category: 'wrap-rule',
    description:
      'P_GunShot adds a random spread to the firing angle as `angle += (P_Random()-P_Random())<<18`. The inner subtraction is signed (P_Random returns 0..255, the difference is -255..255), the <<18 produces a possibly-negative int32 of magnitude up to 0x3FC0000, and the += into `angle` (an angle_t) wraps via unsigned arithmetic. Demos rely on this wrap reproducing the exact final BAM angle bit-for-bit.',
    cReference: 'angle += (P_Random()-P_Random())<<18;',
    referenceSourceFile: 'src/p_pspr.c',
  },
  {
    id: 'JS_IMPLEMENTATION_USES_UNSIGNED_RIGHT_SHIFT_ZERO',
    category: 'js-implementation',
    description:
      'The TypeScript implementation in src/core/angle.ts uses the JavaScript `>>> 0` operator (ToUint32) to coerce a Number to the canonical unsigned-32-bit range. The operator first applies ECMAScript ToInt32 (mathematical modulo 2^32, then range-shift to [-2^31, 2^31)), then reinterprets the int32 bit pattern as uint32 by adding 2^32 to negative values. The composition exactly reproduces the C unsigned-int wrap for every JS Number that fits in [-2^53, 2^53] (the safe-integer range — every realistic angle arithmetic result, since BAM constants are bounded by 2^32 and addition stays well below 2^53).',
    cReference: 'function angleWrap(angle) { return angle >>> 0; }',
    referenceSourceFile: 'src/core/angle.ts',
  },
] as const;

/**
 * Stable identifier for one derived invariant the cross-check helper
 * enforces against any candidate angleWrap implementation.
 */
export type AngleWrapInvariantId =
  | 'WRAP_PRESERVES_VALUES_IN_UINT32_RANGE'
  | 'WRAP_FULL_CIRCLE_RETURNS_ZERO'
  | 'WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX'
  | 'WRAP_INT32_MIN_RETURNS_ANG180'
  | 'WRAP_IS_IDEMPOTENT'
  | 'WRAP_RESULT_IS_UINT32'
  | 'WRAP_AGREES_WITH_BIGINT_REFERENCE';

/**
 * One derived invariant the cross-check helper enforces over the full
 * probe sweep (in addition to the per-probe expected values).
 */
export interface AngleWrapInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: AngleWrapInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of seven derived invariants. The focused test asserts
 * that the ledger is closed and that the cross-check helper returns
 * exactly the right failure id for each tampered candidate.
 */
export const ANGLE_WRAP_INVARIANTS: readonly AngleWrapInvariant[] = [
  {
    id: 'WRAP_PRESERVES_VALUES_IN_UINT32_RANGE',
    description: 'angleWrap(value) === value for every probed value already in the canonical unsigned-32-bit range [0, 0xFFFFFFFF] — the wrap is identity inside the range and only acts on out-of-range inputs.',
  },
  {
    id: 'WRAP_FULL_CIRCLE_RETURNS_ZERO',
    description: 'angleWrap(2^32) === 0 — adding one full circle wraps back to zero. The cross-check verifies this on the canonical 0x100000000 input and on integer multiples produced by repeated addition probes.',
  },
  {
    id: 'WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX',
    description: 'angleWrap(-1) === 0xFFFFFFFF — the canonical signed-to-unsigned wrap result for -1, which the player turn-rate carry computation produces transiently in g_game.c.',
  },
  {
    id: 'WRAP_INT32_MIN_RETURNS_ANG180',
    description:
      'angleWrap(-0x80000000) === 0x80000000 (= ANG180) — INT32_MIN reinterprets as ANG180 under the unsigned cast. Renderer FOV delta computation observably depends on this when the visangle-viewangle subtraction lands at INT32_MIN.',
  },
  {
    id: 'WRAP_IS_IDEMPOTENT',
    description: 'angleWrap(angleWrap(x)) === angleWrap(x) for every probed x — once a value lands in [0, 0xFFFFFFFF], a second wrap is the identity. Defends against a tamper that recursively shifts.',
  },
  {
    id: 'WRAP_RESULT_IS_UINT32',
    description: 'angleWrap(x) is always within [0, 0xFFFFFFFF] for every probe — a tamper that returns a signed int32 or a float would fail.',
  },
  {
    id: 'WRAP_AGREES_WITH_BIGINT_REFERENCE',
    description: 'angleWrap(x) === Number((BigInt(Math.trunc(x)) % 2^32n + 2^32n) % 2^32n) for every probed x — the canonical C unsigned wrap modelled in arbitrary precision.',
  },
] as const;

/**
 * Stable identifier for one curated angleWrap probe.
 */
export type AngleWrapProbeId =
  | 'preserve_zero'
  | 'preserve_ANG45'
  | 'preserve_ANG90'
  | 'preserve_ANG180'
  | 'preserve_ANG270'
  | 'preserve_ANG_MAX'
  | 'sum_ANG90_plus_ANG90_to_ANG180'
  | 'sum_ANG180_plus_ANG180_to_zero'
  | 'sum_ANG270_plus_ANG180_to_ANG90'
  | 'sum_ANG_MAX_plus_one_to_zero'
  | 'sum_full_circle_plus_one_to_one'
  | 'sum_double_full_circle_to_zero'
  | 'wrap_negative_one_to_ANG_MAX'
  | 'wrap_neg_ANG45_to_ANG315'
  | 'wrap_neg_ANG90_to_ANG270'
  | 'wrap_neg_ANG180_to_ANG180'
  | 'wrap_neg_full_circle_to_zero'
  | 'wrap_INT32_MIN_to_ANG180'
  | 'sub_ANG45_minus_ANG90_to_ANG315'
  | 'sub_ANG90_minus_ANG270_to_ANG180'
  | 'renderer_FOV_delta_view_eq_vis_to_ANG90'
  | 'renderer_FOV_delta_view_ANG90_above_vis_zero_to_zero'
  | 'renderer_FOV_delta_view_ANG270_above_vis_ANG45_to_ANG225'
  | 'hitscan_random_neg_255_offset_added_to_ANG90'
  | 'demo_turn_carry_negative_minus_ANG_MAX_to_one';

/**
 * One curated input → expected probe.
 *
 * `expected` is the bit-for-bit output of the canonical C unsigned
 * wrap on the input value, hand-derived in arbitrary precision and
 * re-checked by the focused test against a BigInt reference (so
 * transcription mistakes in this ledger fail loudly rather than
 * silently calibrating the runtime to a wrong reference).
 */
export interface AngleWrapProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: AngleWrapProbeId;
  /** Which behavioural class this probe exercises. */
  readonly category: 'preserve' | 'sum-wrap' | 'negative-wrap' | 'subtract-wrap' | 'renderer-fov-delta' | 'hitscan-random' | 'demo-turn-carry';
  /** Input angle (Number — may be outside uint32 range). */
  readonly input: number;
  /** Expected canonical output (uint32, hand-derived from C unsigned wrap). */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of twenty-five (input → expected) pairs. Each
 * probe is hand-derived from the canonical C unsigned wrap and
 * re-verified against the BigInt reference by the focused test.
 *
 * The probe set covers: identity preservation on the four named
 * BAM constants and ANG_MAX, addition wrap (one full circle, two
 * full circles, off-by-one above UINT32_MAX), negative wrap (every
 * canonical negative test case from the existing `angle.wrap.test.ts`
 * regression set), subtract wrap (cross-quadrant), the
 * renderer FOV delta `ANG90 + (visangle-viewangle)` evaluated at
 * three observably distinct configurations from `r_main.c`'s
 * `R_ScaleFromGlobalAngle`, the player hitscan random offset from
 * `p_pspr.c`'s `P_GunShot`, and the demo turn-rate carry edge case
 * from `g_game.c`. The INT32_MIN probe is the most parity-critical
 * single fact — it is the bit pattern produced by signed overflow in
 * the visangle-viewangle subtraction and observably equals ANG180.
 */
export const ANGLE_WRAP_PROBES: readonly AngleWrapProbe[] = [
  // Preservation inside [0, UINT32_MAX]
  { id: 'preserve_zero', category: 'preserve', input: 0, expected: 0, note: '0 stays 0 — wrap is identity at the lower endpoint.' },
  { id: 'preserve_ANG45', category: 'preserve', input: 0x2000_0000, expected: 0x2000_0000, note: 'ANG45 stays ANG45 — identity preserves the canonical one-eighth-circle constant.' },
  { id: 'preserve_ANG90', category: 'preserve', input: 0x4000_0000, expected: 0x4000_0000, note: 'ANG90 stays ANG90 — identity preserves the canonical quarter-circle constant.' },
  {
    id: 'preserve_ANG180',
    category: 'preserve',
    input: 0x8000_0000,
    expected: 0x8000_0000,
    note: 'ANG180 stays ANG180 — identity preserves the canonical half-circle constant. Defends against a tamper that signed-narrows the INT32_MIN bit pattern.',
  },
  { id: 'preserve_ANG270', category: 'preserve', input: 0xc000_0000, expected: 0xc000_0000, note: 'ANG270 stays ANG270 — identity preserves the canonical three-quarter-circle constant.' },
  {
    id: 'preserve_ANG_MAX',
    category: 'preserve',
    input: 0xffff_ffff,
    expected: 0xffff_ffff,
    note: 'ANG_MAX stays ANG_MAX — identity preserves the maximum uint32 (UINT32_MAX). Defends against a tamper that truncates to int32 (would return -1).',
  },

  // Sum wrap (forward across the boundary)
  { id: 'sum_ANG90_plus_ANG90_to_ANG180', category: 'sum-wrap', input: 0x4000_0000 + 0x4000_0000, expected: 0x8000_0000, note: 'ANG90 + ANG90 = 0x80000000 = ANG180 — sum stays inside uint32 range, identity case for sum-wrap probe class.' },
  { id: 'sum_ANG180_plus_ANG180_to_zero', category: 'sum-wrap', input: 0x8000_0000 + 0x8000_0000, expected: 0, note: 'ANG180 + ANG180 = 2^32 — wraps cleanly to zero. The canonical "two halves equal one full circle" parity check.' },
  {
    id: 'sum_ANG270_plus_ANG180_to_ANG90',
    category: 'sum-wrap',
    input: 0xc000_0000 + 0x8000_0000,
    expected: 0x4000_0000,
    note: 'ANG270 + ANG180 = 0x140000000 — wraps to 0x40000000 = ANG90. Defends against a tamper that masks with 0x7FFFFFFF (would return ANG270 incorrectly).',
  },
  { id: 'sum_ANG_MAX_plus_one_to_zero', category: 'sum-wrap', input: 0xffff_ffff + 1, expected: 0, note: 'ANG_MAX + 1 = 2^32 — exactly one full circle wraps to zero. Defends against off-by-one in the modulo.' },
  { id: 'sum_full_circle_plus_one_to_one', category: 'sum-wrap', input: 0x1_0000_0000 + 1, expected: 1, note: '2^32 + 1 wraps to 1 — defends against an implementation that hardcodes only the simple wrap-to-zero case.' },
  { id: 'sum_double_full_circle_to_zero', category: 'sum-wrap', input: 0x2_0000_0000, expected: 0, note: '2 * 2^32 wraps to 0 — defends against an implementation that subtracts 2^32 once instead of taking modulo.' },

  // Negative input wrap (renderer FOV / demo turn-carry / Random offsets)
  { id: 'wrap_negative_one_to_ANG_MAX', category: 'negative-wrap', input: -1, expected: 0xffff_ffff, note: '-1 wraps to UINT32_MAX (= ANG_MAX). The simplest negative-wrap probe; defends against signed-only arithmetic.' },
  {
    id: 'wrap_neg_ANG45_to_ANG315',
    category: 'negative-wrap',
    input: -0x2000_0000,
    expected: 0xe000_0000,
    note: '-ANG45 wraps to ANG270 + ANG45 = 0xE0000000 (ANG315). Defends against signed truncation that would return -ANG45 unchanged.',
  },
  {
    id: 'wrap_neg_ANG90_to_ANG270',
    category: 'negative-wrap',
    input: -0x4000_0000,
    expected: 0xc000_0000,
    note: '-ANG90 wraps to ANG270 = 0xC0000000. The renderer-critical case that R_ScaleFromGlobalAngle relies on for back-facing wall handling.',
  },
  {
    id: 'wrap_neg_ANG180_to_ANG180',
    category: 'negative-wrap',
    input: -0x8000_0000,
    expected: 0x8000_0000,
    note: '-ANG180 wraps to ANG180 — the half-circle is its own additive inverse. Note: the input is represented as -0x80000000 in JS, the same bit pattern as INT32_MIN.',
  },
  { id: 'wrap_neg_full_circle_to_zero', category: 'negative-wrap', input: -0x1_0000_0000, expected: 0, note: '-2^32 wraps to 0 — symmetrically defends against the same off-by-one as the positive full-circle probe.' },
  {
    id: 'wrap_INT32_MIN_to_ANG180',
    category: 'negative-wrap',
    input: -0x8000_0000,
    expected: 0x8000_0000,
    note: 'INT32_MIN reinterprets as ANG180 under the unsigned cast — the most parity-critical single fact in this audit. Renderer FOV delta computation observably depends on this when the visangle-viewangle subtraction lands at INT32_MIN. Defends against an implementation that returns INT32_MIN unchanged or applies Math.abs.',
  },

  // Subtract wrap (cross-quadrant)
  {
    id: 'sub_ANG45_minus_ANG90_to_ANG315',
    category: 'subtract-wrap',
    input: 0x2000_0000 - 0x4000_0000,
    expected: 0xe000_0000,
    note: 'ANG45 - ANG90 = -ANG45 — wraps to ANG315. Cross-quadrant subtraction probe; the result must not depend on the operands being expressed as a single negative literal vs a difference.',
  },
  {
    id: 'sub_ANG90_minus_ANG270_to_ANG180',
    category: 'subtract-wrap',
    input: 0x4000_0000 - 0xc000_0000,
    expected: 0x8000_0000,
    note: 'ANG90 - ANG270 = -ANG180 — wraps to ANG180. Defends against a JS-specific bug where one of the operands is implicitly converted to int32 before the subtract (would lose the high bit of ANG270).',
  },

  // Renderer FOV delta probes (R_ScaleFromGlobalAngle)
  {
    id: 'renderer_FOV_delta_view_eq_vis_to_ANG90',
    category: 'renderer-fov-delta',
    input: 0x4000_0000 + (0x4000_0000 - 0x4000_0000),
    expected: 0x4000_0000,
    note: 'ANG90 + (ANG90 - ANG90) = ANG90 + 0 = ANG90 — viewangle equal to visangle yields a perpendicular sight line, no wrap needed. Boundary identity for the FOV delta formula.',
  },
  {
    id: 'renderer_FOV_delta_view_ANG90_above_vis_zero_to_zero',
    category: 'renderer-fov-delta',
    input: 0x4000_0000 + (0 - 0x4000_0000),
    expected: 0,
    note: 'ANG90 + (0 - ANG90) = ANG90 + -ANG90 = 0 — viewangle ANG90 ahead of visangle 0 yields a back-facing sight line (zero degrees). The inner subtract underflows below zero and the outer add wraps the sum back into a meaningful BAM angle.',
  },
  {
    id: 'renderer_FOV_delta_view_ANG270_above_vis_ANG45_to_ANG225',
    category: 'renderer-fov-delta',
    input: 0x4000_0000 + (0x2000_0000 - 0xc000_0000),
    expected: 0xa000_0000,
    note: 'ANG90 + (ANG45 - ANG270) = ANG90 + (0x20000000 - 0xC0000000) = ANG90 + (-0xA0000000) = -0x60000000 — wraps to 0xA0000000 = ANG225 (= ANG180 + ANG45). Cross-quadrant FOV delta where both the inner subtract AND the outer add wrap.',
  },

  // Player hitscan random offset (P_GunShot)
  {
    id: 'hitscan_random_neg_255_offset_added_to_ANG90',
    category: 'hitscan-random',
    input: 0x4000_0000 + (-255 << 18),
    expected: 0x3c04_0000,
    note: 'angle ANG90 + ((P_Random()-P_Random())<<18) where the random difference is -255 (worst-case left spread): -255 << 18 = -0x3FC0000; ANG90 - 0x3FC0000 = 0x3C040000 (still positive, no wrap needed). Defends against a tamper that masks the random offset before adding.',
  },

  // Demo turn-rate carry (G_BuildTiccmd)
  {
    id: 'demo_turn_carry_negative_minus_ANG_MAX_to_one',
    category: 'demo-turn-carry',
    input: 0 - 0xffff_ffff,
    expected: 1,
    note: '0 - ANG_MAX wraps to 1 — defends the JS Number-arithmetic path that produces a large negative literal (-4294967295) and must wrap to +1 via mod 2^32. The demo turn-rate carry computation in g_game.c can produce this transient value.',
  },
] as const;

/** A candidate angleWrap implementation taking one Number and returning a uint32 Number. */
export type AngleWrapFunction = (angle: number) => number;

/**
 * Reference implementation modelling the canonical C unsigned wrap
 * `(unsigned int) value` in arbitrary precision via BigInt.
 *
 * The wrap shape mirrors C semantics exactly:
 *   1. Truncate the input toward zero (matching the C int conversion
 *      from float that callers' int32-typed angle_t arguments would
 *      implicitly apply when the input came from an int operation).
 *   2. Convert to BigInt for arbitrary-precision modulo.
 *   3. Compute `((value mod 2^32) + 2^32) mod 2^32` to ensure a
 *      non-negative result (BigInt's `%` operator preserves the sign
 *      of the dividend, so a single `%` is not enough for negatives).
 *   4. Convert back to Number (always representable since the result
 *      is in [0, 2^32 - 1] which fits in a float64 exactly).
 *
 * Inputs that are not finite (NaN, ±Infinity) coerce to 0, matching
 * the ECMAScript ToInt32 behaviour the JS implementation inherits via
 * `>>> 0`.
 */
export function angleWrapReference(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  const truncated = BigInt(Math.trunc(angle));
  const modulus = 1n << 32n;
  const wrapped = ((truncated % modulus) + modulus) % modulus;
  return Number(wrapped);
}

/**
 * Cross-check a candidate angleWrap implementation against
 * `ANGLE_WRAP_PROBES` and `ANGLE_WRAP_INVARIANTS`. Returns the list
 * of failures by stable identifier; an empty list means the candidate
 * is parity-safe under every audited fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one probe input.
 */
export function crossCheckAngleWrapSemantics(angleWrapFn: AngleWrapFunction): readonly string[] {
  const failures: string[] = [];

  for (const probe of ANGLE_WRAP_PROBES) {
    const actual = angleWrapFn(probe.input);
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  let preserveFailed = false;
  let fullCircleFailed = false;
  let negativeOneFailed = false;
  let int32MinFailed = false;
  let idempotentFailed = false;
  let uint32RangeFailed = false;
  let bigIntReferenceFailed = false;

  for (const probe of ANGLE_WRAP_PROBES) {
    const wrapped = angleWrapFn(probe.input);

    // WRAP_PRESERVES_VALUES_IN_UINT32_RANGE — when the canonical
    // expected value is itself in the uint32 range (always true in
    // this probe set), wrapping the expected value must be identity.
    if (!preserveFailed && angleWrapFn(probe.expected) !== probe.expected) {
      failures.push('invariant:WRAP_PRESERVES_VALUES_IN_UINT32_RANGE');
      preserveFailed = true;
    }

    // WRAP_IS_IDEMPOTENT — wrapping the wrapped value must equal the
    // wrapped value.
    if (!idempotentFailed && angleWrapFn(wrapped) !== wrapped) {
      failures.push('invariant:WRAP_IS_IDEMPOTENT');
      idempotentFailed = true;
    }

    // WRAP_RESULT_IS_UINT32 — the result must be a non-negative
    // integer within [0, 0xFFFFFFFF].
    if (!uint32RangeFailed && (wrapped < 0 || wrapped > 0xffff_ffff || !Number.isInteger(wrapped))) {
      failures.push('invariant:WRAP_RESULT_IS_UINT32');
      uint32RangeFailed = true;
    }

    // WRAP_AGREES_WITH_BIGINT_REFERENCE — every probe input must
    // produce the same uint32 as the canonical BigInt reference.
    if (!bigIntReferenceFailed) {
      const reference = angleWrapReference(probe.input);
      if (wrapped !== reference) {
        failures.push('invariant:WRAP_AGREES_WITH_BIGINT_REFERENCE');
        bigIntReferenceFailed = true;
      }
    }
  }

  // Specific invariant probes that do not need a probe sweep.
  if (!fullCircleFailed && angleWrapFn(AUDITED_FULL_CIRCLE) !== 0) {
    failures.push('invariant:WRAP_FULL_CIRCLE_RETURNS_ZERO');
    fullCircleFailed = true;
  }

  if (!negativeOneFailed && angleWrapFn(-1) !== AUDITED_ANG_MAX) {
    failures.push('invariant:WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX');
    negativeOneFailed = true;
  }

  if (!int32MinFailed && angleWrapFn(-0x8000_0000) !== AUDITED_ANG180) {
    failures.push('invariant:WRAP_INT32_MIN_RETURNS_ANG180');
    int32MinFailed = true;
  }

  return failures;
}
