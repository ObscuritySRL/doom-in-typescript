/**
 * Distance attenuation and stereo separation for digital sfx
 * (`S_AdjustSoundParams` in s_sound.c).
 *
 * Every time `S_StartSoundAtVolume` / `S_UpdateSounds` mixes a sound,
 * it consults `S_AdjustSoundParams(listener, source, vol, sep)` to
 * compute the per-channel volume (0..`snd_SfxVolume`) and stereo
 * balance (`0..255`, centred at `NORM_SEP = 128`).  The reference
 * logic is transcribed verbatim from chocolate-doom 2.2.1's
 * `S_AdjustSoundParams`:
 *
 * ```c
 * adx = abs(listener->x - source->x);
 * ady = abs(listener->y - source->y);
 * approx_dist = adx + ady - ((adx < ady ? adx : ady) >> 1);
 *
 * if (gamemap != 8 && approx_dist > S_CLIPPING_DIST) return 0;
 *
 * angle = R_PointToAngle2(listener->x, listener->y,
 *                         source->x,   source->y);
 * if (angle > listener->angle) angle -= listener->angle;
 * else                         angle += (0xffffffff - listener->angle);
 * angle >>= ANGLETOFINESHIFT;
 *
 * *sep = 128 - (FixedMul(S_STEREO_SWING, finesine[angle]) >> FRACBITS);
 *
 * if      (approx_dist < S_CLOSE_DIST) *vol = snd_SfxVolume;
 * else if (gamemap == 8) {
 *     if (approx_dist > S_CLIPPING_DIST) approx_dist = S_CLIPPING_DIST;
 *     *vol = 15 + ((snd_SfxVolume - 15)
 *                  * ((S_CLIPPING_DIST - approx_dist) >> FRACBITS))
 *            / S_ATTENUATOR;
 * } else {
 *     *vol = (snd_SfxVolume
 *             * ((S_CLIPPING_DIST - approx_dist) >> FRACBITS))
 *            / S_ATTENUATOR;
 * }
 *
 * return (*vol > 0);
 * ```
 *
 * Parity-critical details preserved here:
 *
 *  - `approx_dist` is the "Game Graphics Gems" Manhattan-minus-half-min
 *    approximation shared with {@link ./../world/zMovement.ts}'s
 *    `approxDistance`.  Duplicated inline here to keep the audio
 *    module independent of the gameplay layer.
 *  - The off-by-one in the signed-angle wrap (`angle + (0xffffffff -
 *    listener->angle)` instead of the true unsigned `angle -
 *    listener->angle`) is a vanilla behaviour: when the source sits
 *    exactly on the listener's view vector, `relAngle` becomes
 *    `0xffffffff` and selects `finesine[FINEMASK]` rather than
 *    `finesine[0]`.  That shifts `sep` by a single unit which is
 *    audible in demo parity comparisons and must not be "fixed".
 *  - `S_ATTENUATOR = (S_CLIPPING_DIST - S_CLOSE_DIST) >> FRACBITS`
 *    reduces to the integer `1000`; the reference code emits a
 *    compile-time integer, so we do too.
 *  - The MAP08 branch (`isBossMap === true`) does NOT clip the sound
 *    beyond `S_CLIPPING_DIST` — the distance is clamped and a floor
 *    of `BOSS_MAP_MIN_VOLUME = 15` is applied so Keen-style mapwide
 *    cues stay audible, which is the "boss brain" level-8 quirk.
 *  - Integer division in the volume branches truncates toward zero,
 *    matching C.  JavaScript `Math.trunc(a / b)` reproduces the
 *    behaviour for both signs (the boss branch produces negative
 *    intermediates when `sfxVolume < 15`).
 *  - The return sentinel is `volume > 0`; a silent computation still
 *    populates `separation` (from the angle math when it was
 *    executed, or {@link NORM_SEP} when the early-exit short-circuited
 *    the angle math entirely).
 *
 * The module is pure: no Win32 bindings, no mixer state, no globals.
 * Each call is a function of its inputs.
 *
 * @example
 * ```ts
 * import { adjustSoundParams, NORM_SEP } from "../src/audio/spatial.ts";
 * import { FRACUNIT } from "../src/core/fixed.ts";
 *
 * const result = adjustSoundParams({
 *   listener: { x: 0,            y: 0, angle: 0 },
 *   source:   { x: 100 * FRACUNIT, y: 0 },
 *   sfxVolume: 15,
 *   isBossMap: false,
 * });
 * result.audible;     // true (within S_CLOSE_DIST)
 * result.volume;      // 15 (full volume because distance < S_CLOSE_DIST)
 * result.separation;  // near NORM_SEP (source is on the view vector)
 * ```
 */

import type { Angle } from '../core/angle.ts';
import { ANG90, ANG180, ANG270, angleWrap } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, FINEMASK, finesine, slopeDiv, tantoangle } from '../core/trig.ts';

/** `S_CLOSE_DIST = 200 * FRACUNIT` — below this, volume is `snd_SfxVolume`. */
export const S_CLOSE_DIST: Fixed = 200 * FRACUNIT;

/** `S_CLIPPING_DIST = 1200 * FRACUNIT` — at/above this, non-boss sounds are silent. */
export const S_CLIPPING_DIST: Fixed = 1200 * FRACUNIT;

/**
 * `S_ATTENUATOR = (S_CLIPPING_DIST - S_CLOSE_DIST) >> FRACBITS` = `1000`.
 *
 * Denominator of the linear attenuation ramp.  Preserved as an
 * integer so the division matches vanilla byte-for-byte.
 */
export const S_ATTENUATOR: number = (S_CLIPPING_DIST - S_CLOSE_DIST) >> FRACBITS;

/** `S_STEREO_SWING = 96 * FRACUNIT` — maximum stereo swing around {@link NORM_SEP}. */
export const S_STEREO_SWING: Fixed = 96 * FRACUNIT;

/** `NORM_SEP = 128` — centred-pan value (equal amplitude in both channels). */
export const NORM_SEP = 128;

/** Minimum volume floor that the MAP08 boss-map branch applies. */
export const BOSS_MAP_MIN_VOLUME = 15;

/**
 * The `gamemap` value that triggers the volume-floor branch.  Vanilla
 * reference uses `gamemap == 8` regardless of episode, so the caller
 * checks `mapnumber === BOSS_MAP_NUMBER`.  Exposed as a constant so
 * host-side map-index arithmetic stays byte-identical with the C
 * source.
 */
export const BOSS_MAP_NUMBER = 8;

/** Minimum stereo-separation value reachable with `finesine === +FRACUNIT`. */
export const MIN_STEREO_SEP = NORM_SEP - 96;

/** Maximum stereo-separation value reachable with `finesine === -FRACUNIT`. */
export const MAX_STEREO_SEP = NORM_SEP + 96;

/**
 * Listener snapshot consumed by {@link adjustSoundParams}.  Matches
 * the subset of `mobj_t` that `S_AdjustSoundParams` actually reads:
 * position (x, y) and facing angle.
 */
export interface SpatialListener {
  /** Listener world x in fixed-point. */
  x: Fixed;

  /** Listener world y in fixed-point. */
  y: Fixed;

  /** Listener BAM facing angle (0 = east, ANG90 = north). */
  angle: Angle;
}

/**
 * Source snapshot consumed by {@link adjustSoundParams}.  The
 * reference reads only the (x, y) of the sound origin; z is
 * irrelevant to the 2-D attenuation curve.
 */
export interface SpatialSource {
  /** Source world x in fixed-point. */
  x: Fixed;

  /** Source world y in fixed-point. */
  y: Fixed;
}

/** Inputs for {@link adjustSoundParams}. */
export interface AdjustSoundParams {
  /** Listener (camera / player ear position). */
  listener: SpatialListener;

  /** Sound origin in world space. */
  source: SpatialSource;

  /**
   * Global sfx volume slider (`snd_SfxVolume` in the reference).
   * Vanilla range is `0..15`; values outside that range are passed
   * through unchanged because the reference does not clamp.
   */
  sfxVolume: number;

  /**
   * `true` iff the current level is MAP08 (boss level).  Enables the
   * floor-of-15 branch so boss cues stay audible regardless of
   * distance.
   */
  isBossMap: boolean;
}

/**
 * Output of {@link adjustSoundParams}.  Mirrors the two output
 * pointers of `S_AdjustSoundParams` plus the function's boolean
 * return value.
 */
export interface AdjustSoundResult {
  /** `true` iff `volume > 0` — the mixer should start / keep the sound. */
  audible: boolean;

  /** Computed volume in `[0, sfxVolume]` (or the boss floor of 15). */
  volume: number;

  /** Computed stereo balance in `[MIN_STEREO_SEP, MAX_STEREO_SEP]`. */
  separation: number;
}

/**
 * "Game Programming Gems" approximate Euclidean distance shared with
 * `P_AproxDistance` / {@link ../world/zMovement.ts}'s `approxDistance`.
 * Duplicated inline to keep the audio module independent of the
 * gameplay layer.
 */
function approxDist2D(dx: Fixed, dy: Fixed): Fixed {
  const adx = dx < 0 ? -dx | 0 : dx;
  const ady = dy < 0 ? -dy | 0 : dy;
  if (adx < ady) {
    return (adx + ady - (adx >> 1)) | 0;
  }
  return (adx + ady - (ady >> 1)) | 0;
}

/**
 * `R_PointToAngle2` from r_main.c reproduced via the octant-based
 * `SlopeDiv` / `tantoangle` lookup.  Identical in structure to the
 * local helpers in {@link ../world/slideMove.ts} and
 * {@link ../ai/targeting.ts}; duplicated here so the audio module
 * does not reach into gameplay sources.
 */
function pointToAngle2(x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed): Angle {
  let x = (x2 - x1) | 0;
  let y = (y2 - y1) | 0;

  if (x === 0 && y === 0) {
    return 0;
  }

  if (x >= 0) {
    if (y >= 0) {
      if (x > y) {
        return tantoangle[slopeDiv(y, x)]!;
      }
      return angleWrap(ANG90 - 1 - tantoangle[slopeDiv(x, y)]!);
    }
    y = -y;
    if (x > y) {
      return angleWrap(-tantoangle[slopeDiv(y, x)]!);
    }
    return angleWrap(ANG270 + tantoangle[slopeDiv(x, y)]!);
  }

  x = -x;
  if (y >= 0) {
    if (x > y) {
      return angleWrap(ANG180 - 1 - tantoangle[slopeDiv(y, x)]!);
    }
    return angleWrap(ANG90 + tantoangle[slopeDiv(x, y)]!);
  }
  y = -y;
  if (x > y) {
    return angleWrap(ANG180 + tantoangle[slopeDiv(y, x)]!);
  }
  return angleWrap(ANG270 - 1 - tantoangle[slopeDiv(x, y)]!);
}

/**
 * Vanilla signed-angle wrap.
 *
 * Chocolate-doom's `S_AdjustSoundParams` uses a hand-rolled unsigned
 * subtraction that is off-by-one when `angle <= listener.angle`:
 *
 * ```c
 * if (angle > listener->angle)  angle -= listener->angle;
 * else                          angle += (0xffffffff - listener->angle);
 * ```
 *
 * `angle + (0xffffffff - listener->angle)` equals the true unsigned
 * `angle - listener->angle` minus one (mod 2^32).  That is visible
 * when the source sits directly on the view vector: the true wrap
 * gives `0`, the vanilla wrap gives `0xffffffff`.  Preserved as-is.
 */
function relativeAngle(angle: Angle, listenerAngle: Angle): Angle {
  if (angle > listenerAngle) {
    return (angle - listenerAngle) >>> 0;
  }
  return (angle + (0xffffffff - listenerAngle)) >>> 0;
}

/**
 * Reproduce `S_AdjustSoundParams` for a single listener/source pair.
 *
 * Returns the `audible` flag, the per-channel `volume`, and the
 * stereo `separation`.  When the non-boss early-out fires (distance
 * strictly greater than {@link S_CLIPPING_DIST}), `separation` is
 * returned as {@link NORM_SEP} since the reference never executes the
 * angle math in that branch and the mixer would discard the sound
 * anyway.
 */
export function adjustSoundParams(params: AdjustSoundParams): AdjustSoundResult {
  const { listener, source, sfxVolume, isBossMap } = params;

  const approxDist = approxDist2D((source.x - listener.x) | 0, (source.y - listener.y) | 0);

  if (!isBossMap && approxDist > S_CLIPPING_DIST) {
    return { audible: false, volume: 0, separation: NORM_SEP };
  }

  const rawAngle = pointToAngle2(listener.x, listener.y, source.x, source.y);
  const rel = relativeAngle(rawAngle, listener.angle);
  const fineIdx = (rel >>> ANGLETOFINESHIFT) & FINEMASK;
  const sep = (NORM_SEP - (fixedMul(S_STEREO_SWING, finesine[fineIdx]!) >> FRACBITS)) | 0;

  let volume: number;
  if (approxDist < S_CLOSE_DIST) {
    volume = sfxVolume;
  } else if (isBossMap) {
    const clamped = approxDist > S_CLIPPING_DIST ? S_CLIPPING_DIST : approxDist;
    const ramp = (S_CLIPPING_DIST - clamped) >> FRACBITS;
    volume = BOSS_MAP_MIN_VOLUME + Math.trunc(((sfxVolume - BOSS_MAP_MIN_VOLUME) * ramp) / S_ATTENUATOR);
  } else {
    const ramp = (S_CLIPPING_DIST - approxDist) >> FRACBITS;
    volume = Math.trunc((sfxVolume * ramp) / S_ATTENUATOR);
  }

  return { audible: volume > 0, volume, separation: sep };
}
