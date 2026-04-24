/**
 * Doom deterministic RNG (m_random.c).
 *
 * Doom uses a 256-element lookup table instead of a formula-based PRNG.
 * Two independent indices walk the same table: `prndindex` for the
 * gameplay simulation (P_Random) and `rndindex` for menus and
 * non-deterministic effects (M_Random). Separating the streams ensures
 * that menu activity cannot desync demo playback.
 *
 * @example
 * ```ts
 * import { DoomRandom } from "../src/core/rng.ts";
 * const rng = new DoomRandom();
 * const value = rng.pRandom(); // 0–255 from the gameplay stream
 * ```
 */

/** The canonical 256-element Doom random number table from m_random.c. */
export const RNG_TABLE: readonly number[] = Object.freeze([
  0, 8, 109, 220, 222, 241, 149, 107, 75, 248, 254, 140, 16, 66, 74, 21, 211, 47, 80, 242, 154, 27, 205, 128, 161, 89, 77, 36, 95, 110, 85, 48, 212, 140, 211, 249, 22, 79, 200, 50, 28, 188, 52, 140, 202, 120, 68, 145, 62, 70, 184, 190, 91,
  197, 152, 224, 149, 104, 25, 178, 252, 182, 202, 182, 141, 197, 4, 81, 181, 242, 145, 42, 39, 227, 156, 198, 225, 193, 219, 93, 122, 175, 249, 0, 175, 143, 70, 239, 46, 246, 163, 53, 163, 109, 168, 135, 2, 235, 25, 92, 20, 145, 138, 77,
  69, 166, 78, 176, 173, 212, 166, 113, 94, 161, 41, 50, 239, 49, 111, 164, 70, 60, 2, 37, 171, 75, 136, 156, 11, 56, 42, 146, 138, 229, 73, 146, 77, 61, 98, 196, 135, 106, 63, 197, 195, 86, 96, 203, 113, 101, 170, 247, 181, 113, 80, 250,
  108, 7, 255, 237, 129, 226, 79, 107, 112, 166, 103, 241, 24, 223, 239, 120, 198, 58, 60, 82, 128, 3, 184, 66, 143, 224, 145, 224, 81, 206, 163, 45, 63, 90, 168, 114, 59, 33, 159, 95, 28, 139, 123, 98, 125, 196, 15, 70, 194, 253, 54, 14,
  109, 226, 71, 17, 161, 93, 186, 87, 244, 138, 20, 52, 123, 251, 26, 36, 17, 46, 52, 231, 232, 76, 31, 221, 84, 37, 216, 165, 212, 106, 197, 242, 98, 43, 39, 175, 254, 145, 190, 84, 118, 222, 187, 136, 120, 163, 236, 249,
]);

/**
 * Doom random number generator.
 *
 * Encapsulates the two index counters and the four canonical RNG
 * operations from m_random.c. Creating separate instances allows
 * isolated testing; the game wires a single instance globally.
 *
 * @example
 * ```ts
 * import { DoomRandom } from "../src/core/rng.ts";
 * const rng = new DoomRandom();
 * rng.pRandom();     // gameplay stream
 * rng.mRandom();     // menu stream
 * rng.clearRandom(); // reset both indices to 0
 * ```
 */
export class DoomRandom {
  #prndindex = 0;
  #rndindex = 0;

  /**
   * Return a 0–255 value from the gameplay-deterministic stream.
   *
   * This is the stream that must stay synchronized for demo playback
   * parity. The index is incremented before lookup (pre-increment),
   * so the first call after clear returns `RNG_TABLE[1]` (8), not
   * `RNG_TABLE[0]` (0).
   *
   * @example
   * ```ts
   * const rng = new DoomRandom();
   * rng.pRandom(); // 8
   * ```
   */
  pRandom(): number {
    this.#prndindex = (this.#prndindex + 1) & 0xff;
    return RNG_TABLE[this.#prndindex];
  }

  /**
   * Return a 0–255 value from the non-deterministic (menu) stream.
   *
   * Uses a separate index so that menu RNG calls do not advance the
   * gameplay stream and cannot desync demo playback.
   *
   * @example
   * ```ts
   * const rng = new DoomRandom();
   * rng.mRandom(); // 8
   * ```
   */
  mRandom(): number {
    this.#rndindex = (this.#rndindex + 1) & 0xff;
    return RNG_TABLE[this.#rndindex];
  }

  /**
   * Reset both RNG indices to 0.
   *
   * Called at the start of demo recording/playback and new games to
   * ensure deterministic replay from a known initial state.
   *
   * @example
   * ```ts
   * const rng = new DoomRandom();
   * rng.pRandom();
   * rng.clearRandom();
   * rng.pRandom(); // 8 again
   * ```
   */
  clearRandom(): void {
    this.#rndindex = 0;
    this.#prndindex = 0;
  }

  /**
   * Return `P_Random() - P_Random()`.
   *
   * Consumes two values from the gameplay stream. The result range
   * is -255 to +255. Used for randomized directional offsets
   * (e.g., projectile spread, monster movement variation).
   *
   * @example
   * ```ts
   * const rng = new DoomRandom();
   * rng.pSubRandom(); // 8 - 109 = -101
   * ```
   */
  pSubRandom(): number {
    const first = this.pRandom();
    return first - this.pRandom();
  }

  /** Current gameplay stream index (0–255). */
  get prndindex(): number {
    return this.#prndindex;
  }

  /** Current menu stream index (0–255). */
  get rndindex(): number {
    return this.#rndindex;
  }
}
