/**
 * Reject bit-array loader.
 *
 * Parses the REJECT lump from a Doom map into a typed structure
 * matching P_LoadReject in Chocolate Doom's p_setup.c.
 *
 * The reject table is a flat bit-array of sectorCount × sectorCount
 * bits stored row-major with little-endian bit order. Bit (s1, s2)
 * is set when sector s1 definitely cannot see sector s2 — a set bit
 * lets P_CheckSight in p_sight.c return false immediately without a
 * full BSP line-of-sight trace.
 *
 * @example
 * ```ts
 * import { parseReject, isRejected } from "../src/map/reject.ts";
 * const reject = parseReject(bundle.reject, 85);
 * console.log(isRejected(reject, 0, 1)); // false = might see
 * ```
 */

/**
 * Compute the minimum byte size of a REJECT lump for the given
 * sector count.
 *
 * Matches the `minlength` calculation in P_LoadReject:
 * `(numsectors * numsectors + 7) / 8` (ceiling division).
 *
 * @param sectorCount - Number of sectors in the map.
 * @returns Required byte count.
 */
export function rejectSize(sectorCount: number): number {
  return (sectorCount * sectorCount + 7) >>> 3;
}

/**
 * A parsed reject map matching the structure loaded by P_LoadReject
 * in Chocolate Doom's p_setup.c.
 *
 * The data buffer is the raw reject bit-array. Sector pair (s1, s2)
 * maps to bit `(s1 * sectorCount + s2)` in the array with
 * little-endian bit order within each byte.
 */
export interface RejectMap {
  /** Number of sectors this reject table covers. */
  readonly sectorCount: number;
  /** Total number of bits in the matrix (sectorCount²). */
  readonly totalBits: number;
  /** Minimum required byte size: ceil(sectorCount² / 8). */
  readonly expectedSize: number;
  /** Raw reject bit-array data (at least expectedSize bytes). */
  readonly data: Buffer;
}

/**
 * Parse a REJECT lump into a typed reject map structure.
 *
 * Matches P_LoadReject in p_setup.c: the lump is a flat bit-array
 * of sectorCount² bits. If the lump is at least the expected size,
 * the first expectedSize bytes are used directly. Undersized lumps
 * are zero-padded to the expected size — zeroed bits mean "might see"
 * (conservative: the engine falls through to the full BSP trace).
 *
 * Chocolate Doom's PadRejectArray fills the gap with zone allocator
 * values to reproduce vanilla Doom's buffer overread behavior. That
 * emulation detail is not replicated here; zero-padding is used for
 * any undersized lump.
 *
 * @param lumpData - Raw REJECT lump buffer.
 * @param sectorCount - Number of sectors in the map.
 * @returns Frozen RejectMap structure.
 * @throws {RangeError} If sectorCount is not positive.
 */
export function parseReject(lumpData: Buffer | Uint8Array, sectorCount: number): RejectMap {
  if (sectorCount <= 0) {
    throw new RangeError(`REJECT sector count ${sectorCount} must be positive`);
  }

  const totalBits = sectorCount * sectorCount;
  const expectedSize = (totalBits + 7) >>> 3;

  let data: Buffer;

  if (lumpData.length >= expectedSize) {
    data = Buffer.isBuffer(lumpData) ? lumpData.subarray(0, expectedSize) : Buffer.from(lumpData.buffer, lumpData.byteOffset, expectedSize);
  } else {
    data = Buffer.alloc(expectedSize);
    Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength).copy(data);
  }

  return Object.freeze({
    sectorCount,
    totalBits,
    expectedSize,
    data,
  });
}

/**
 * Check whether two sectors are rejected (cannot see each other).
 *
 * Reproduces the reject lookup from P_CheckSight in p_sight.c:
 * ```c
 * pnum = s1 * numsectors + s2;
 * bytenum = pnum >> 3;
 * bitnum = 1 << (pnum & 7);
 * if (rejectmatrix[bytenum] & bitnum) ...
 * ```
 *
 * @param reject - Parsed reject map.
 * @param sector1 - Source sector index (the "looker").
 * @param sector2 - Target sector index (the "target").
 * @returns true if the pair is rejected (no LOS possible),
 *   false if a full BSP trace is needed.
 */
export function isRejected(reject: RejectMap, sector1: number, sector2: number): boolean {
  const pairNumber = sector1 * reject.sectorCount + sector2;
  const byteNumber = pairNumber >>> 3;
  const bitMask = 1 << (pairNumber & 7);
  return (reject.data[byteNumber]! & bitMask) !== 0;
}
