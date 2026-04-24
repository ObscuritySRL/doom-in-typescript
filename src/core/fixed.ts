/**
 * Doom 16.16 fixed-point type and constants.
 *
 * In the original C code, `fixed_t` is a plain signed `int` (32-bit)
 * interpreted as 16.16 fixed-point: the upper 16 bits hold the integer
 * part and the lower 16 bits hold the fractional part.
 *
 * @example
 * ```ts
 * import { FRACBITS, FRACUNIT } from "../src/core/fixed.ts";
 * const two = (FRACUNIT * 2) | 0; // 2.0 in fixed-point
 * ```
 */

/**
 * 16.16 fixed-point type alias.
 *
 * At runtime this is a plain JavaScript number. The alias documents
 * intent: values tagged `Fixed` represent 16.16 fixed-point integers
 * and must be kept within the signed 32-bit range
 * [`FIXED_MIN`, `FIXED_MAX`].
 */
export type Fixed = number;

/** Number of fractional bits in the 16.16 fixed-point format. */
export const FRACBITS = 16;

/** 1.0 in 16.16 fixed-point (1 << FRACBITS = 0x10000 = 65_536). */
export const FRACUNIT: Fixed = 1 << FRACBITS;

/** Maximum representable fixed-point value (INT32_MAX = 0x7FFF_FFFF). */
export const FIXED_MAX: Fixed = 0x7fff_ffff;

/** Minimum representable fixed-point value (INT32_MIN = -0x8000_0000). */
export const FIXED_MIN: Fixed = -0x8000_0000;

/**
 * Add two fixed-point values with int32 wrapping.
 *
 * Vanilla Doom uses plain C `+` on `fixed_t` (signed 32-bit int).
 * Two's complement overflow wraps silently — this is load-bearing
 * behavior, not a bug.
 *
 * @example
 * ```ts
 * import { fixedAdd, FRACUNIT } from "../src/core/fixed.ts";
 * fixedAdd(FRACUNIT, FRACUNIT); // 2.0 in fixed-point
 * ```
 */
export function fixedAdd(a: Fixed, b: Fixed): Fixed {
  return (a + b) | 0;
}

/**
 * Subtract two fixed-point values with int32 wrapping.
 *
 * Vanilla Doom uses plain C `-` on `fixed_t` (signed 32-bit int).
 * Two's complement underflow wraps silently — this is load-bearing
 * behavior, not a bug.
 *
 * @example
 * ```ts
 * import { fixedSub, FRACUNIT } from "../src/core/fixed.ts";
 * fixedSub(FRACUNIT, FRACUNIT); // 0
 * ```
 */
export function fixedSub(a: Fixed, b: Fixed): Fixed {
  return (a - b) | 0;
}

/**
 * Multiply two fixed-point values with int32 truncation.
 *
 * Canonical C: `((int64_t) a * (int64_t) b) >> FRACBITS`
 *
 * The full 64-bit product of two int32 values can exceed
 * `Number.MAX_SAFE_INTEGER`, so the multiplication is decomposed into
 * four 16×16-bit partial products whose sum always fits within the
 * safe-integer range. The final `| 0` truncates to int32, matching
 * the implicit C cast back to `fixed_t`.
 *
 * The arithmetic right shift (`>>`) on the full product means negative
 * results round toward negative infinity, not toward zero. This is
 * load-bearing: vanilla Doom relies on this truncation direction.
 *
 * @example
 * ```ts
 * import { fixedMul, FRACUNIT } from "../src/core/fixed.ts";
 * fixedMul(FRACUNIT * 3, FRACUNIT * 2); // 6.0 in fixed-point
 * ```
 */
export function fixedMul(a: Fixed, b: Fixed): Fixed {
  const aHigh = a >> 16;
  const aLow = a & 0xffff;
  const bHigh = b >> 16;
  const bLow = b & 0xffff;
  return (aHigh * bHigh * 0x10000 + aHigh * bLow + aLow * bHigh + ((aLow * bLow) >>> 16)) | 0;
}

/**
 * Divide two fixed-point values with overflow clamping.
 *
 * Canonical C: `FixedDiv` in m_fixed.c
 *
 * The overflow guard checks `(abs(a) >> 14) >= abs(b)`.  When true,
 * the shifted numerator meets or exceeds the denominator and the
 * true quotient would overflow int32, so the function returns
 * `FIXED_MAX` or `FIXED_MIN` based on result sign.  This guard
 * also covers division by zero (`abs(b) == 0`).
 *
 * `abs(FIXED_MIN)` is undefined behavior in C but evaluates to
 * `FIXED_MIN` on x86 — the `| 0` truncation after negation
 * reproduces this behavior exactly.
 *
 * When the guard does not trigger, the quotient is computed as
 * `(a * FRACUNIT) / b` using JavaScript `Number` arithmetic.
 * The product `a * 0x10000` fits within `Number.MAX_SAFE_INTEGER`
 * (at most 2^47, well under 2^53) because `a` is int32.
 * The `| 0` truncation on the result matches C integer cast
 * (truncation toward zero then modular reduction to int32).
 *
 * @example
 * ```ts
 * import { fixedDiv, FRACUNIT } from "../src/core/fixed.ts";
 * fixedDiv(FRACUNIT * 6, FRACUNIT * 2); // 3.0 in fixed-point
 * ```
 */
export function fixedDiv(a: Fixed, b: Fixed): Fixed {
  const absoluteA = a < 0 ? -a | 0 : a;
  const absoluteB = b < 0 ? -b | 0 : b;
  if (absoluteA >> 14 >= absoluteB) {
    return (a ^ b) < 0 ? FIXED_MIN : FIXED_MAX;
  }
  return ((a * 0x10000) / b) | 0;
}
