/**
 * Vanilla DOOM 1.9 framebuffer-hash hook integration point.
 *
 * The framebuffer hash hook is an oracle-side capture mechanism: it
 * records a SHA-256 hash of the raw 320x200 palette-indexed
 * framebuffer plus the active PLAYPAL palette index at each
 * sampled tic.  The hash output is the parity oracle that
 * `gate-renderer-framebuffer-parity` (09-037) compares against.
 *
 * From `src/oracles/framebufferHash.ts`:
 *
 *   FRAMEBUFFER_WIDTH = 320
 *   FRAMEBUFFER_HEIGHT = 200
 *   FRAMEBUFFER_SIZE = 320 * 200 = 64000 bytes (palette-indexed, 1 byte/pixel)
 *   PALETTE_COUNT = 14 (PLAYPAL palette set: normal, damage, bonus, rad-suit)
 *   DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS = 35 (one second at vanilla 35 Hz)
 *
 * Parity-critical invariants pinned here:
 *
 *   1. The framebuffer is exactly 320 × 200 = 64000 bytes of palette-
 *      indexed pixels.  Hash inputs that are not exactly this length
 *      are a parity error.
 *   2. The active palette is identified by index 0..13 into PLAYPAL.
 *      Index 0 is the normal palette; 1..8 are the damage-red ramp;
 *      9..12 are the bonus-pickup yellow ramp; 13 is the radiation-suit
 *      green tint.  The palette index at hash time IS part of the
 *      oracle signature (a green tint must match a green tint).
 *   3. Default sampling interval is 35 tics (= 1 second at the
 *      vanilla 35 Hz tic rate, F-010).  A capture-every-frame mode
 *      uses interval=1 for frame-by-frame parity debug.
 *   4. The hook fires AFTER all rendering for a tic completes — solid
 *      walls, planes, masked midtextures, sprites, player weapons,
 *      view-border, status bar, and automap have all written into
 *      the framebuffer by the time the hash is taken.  Sampling at
 *      any earlier point would hash a partially-rendered frame and
 *      produce non-deterministic results.
 *   5. The hook is a NO-OP in production builds where the oracle
 *      manifest is null — there is zero runtime cost when not
 *      capturing oracle data.
 */

/** Doom's fixed internal framebuffer width in pixels (mirrors src/oracles/framebufferHash.ts). */
export const VANILLA_FRAMEBUFFER_HASH_WIDTH = 320;

/** Doom's fixed internal framebuffer height in pixels. */
export const VANILLA_FRAMEBUFFER_HASH_HEIGHT = 200;

/** Total framebuffer byte size (palette-indexed, 1 byte per pixel). */
export const VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES = 64000;

/** Number of palettes in PLAYPAL (F-027). */
export const VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT = 14;

/** Default sampling interval: 35 tics = 1 second at vanilla tic rate. */
export const VANILLA_FRAMEBUFFER_HASH_DEFAULT_SAMPLING_INTERVAL_TICS = 35;

/** Hook phase: framebuffer is sampled AFTER all per-tic rendering completes. */
export const VANILLA_FRAMEBUFFER_HASH_HOOK_PHASE: 'after-tic-render-complete' = 'after-tic-render-complete';

/**
 * Decide whether the hash hook should fire for the given tic given
 * the sampling interval.  Vanilla samples every `interval` tics
 * starting at tic 0: `tic % interval === 0`.
 *
 * @throws {RangeError} If `interval` is not a positive integer.
 */
export function vanillaFramebufferHashShouldSample(tic: number, interval: number): boolean {
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new RangeError(`vanillaFramebufferHashShouldSample: interval must be a positive integer, got ${interval}`);
  }
  if (!Number.isInteger(tic) || tic < 0) {
    throw new RangeError(`vanillaFramebufferHashShouldSample: tic must be a non-negative integer, got ${tic}`);
  }
  return tic % interval === 0;
}

/**
 * Validate that a framebuffer slice has the exact vanilla dimensions
 * before hashing.  Returns `true` when valid; throws otherwise.
 *
 *   length === FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT = 64000
 */
export function vanillaFramebufferHashValidateLength(length: number): true {
  if (length !== VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES) {
    throw new RangeError(`vanillaFramebufferHashValidateLength: framebuffer must be ${VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES} bytes (320 × 200), got ${length}`);
  }
  return true;
}

/**
 * Validate that a palette index is in the PLAYPAL range `[0, 13]`.
 * Returns `true` when valid; throws otherwise.
 */
export function vanillaFramebufferHashValidatePaletteIndex(paletteIndex: number): true {
  if (!Number.isInteger(paletteIndex) || paletteIndex < 0 || paletteIndex >= VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT) {
    throw new RangeError(`vanillaFramebufferHashValidatePaletteIndex: paletteIndex must be in [0, ${VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT - 1}], got ${paletteIndex}`);
  }
  return true;
}
