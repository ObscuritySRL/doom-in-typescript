/**
 * Doom unsigned 32-bit angle type and wrapping.
 *
 * In the original C code, `angle_t` is an `unsigned int` (32-bit)
 * representing a full circle as 0 to 0xFFFF_FFFF. Angles wrap
 * naturally via unsigned overflow — this is the Binary Angle
 * Measurement (BAM) system.
 *
 * @example
 * ```ts
 * import { ANG90, angleWrap } from "../src/core/angle.ts";
 * const turned = angleWrap(ANG90 + ANG90); // ANG180
 * ```
 */

/**
 * Unsigned 32-bit angle type alias.
 *
 * At runtime this is a plain JavaScript number. The alias documents
 * intent: values tagged `Angle` represent unsigned 32-bit angles
 * where the full circle spans 0 to 0xFFFF_FFFF.
 */
export type Angle = number;

/** 45 degrees in BAM (0x2000_0000). */
export const ANG45: Angle = 0x2000_0000;

/** 90 degrees in BAM (0x4000_0000). */
export const ANG90: Angle = 0x4000_0000;

/** 180 degrees in BAM (0x8000_0000). */
export const ANG180: Angle = 0x8000_0000;

/** 270 degrees in BAM (0xC000_0000). */
export const ANG270: Angle = 0xc000_0000;

/**
 * Normalize an angle to the unsigned 32-bit range [0, 0xFFFF_FFFF].
 *
 * In C, angle arithmetic wraps naturally because `angle_t` is
 * `unsigned int`. In JavaScript, `>>> 0` coerces a number to
 * uint32, reproducing the same wrap semantics. This is load-bearing
 * for angle subtraction in the renderer (e.g., computing FOV deltas
 * where signed differences reinterpret as large unsigned values).
 *
 * @example
 * ```ts
 * import { angleWrap, ANG270, ANG180 } from "../src/core/angle.ts";
 * angleWrap(ANG270 + ANG180); // ANG90
 * ```
 */
export function angleWrap(angle: Angle): Angle {
  return angle >>> 0;
}
