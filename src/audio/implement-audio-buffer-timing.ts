/**
 * Vanilla DOOM 1.9 audio buffer-timing parity facts.
 *
 * The audio mixer runs in lock-step with the vanilla tic rate.  Each
 * tic the mixer produces exactly one chunk of stereo PCM samples.
 * Chocolate Doom's SDL_mixer callback consumes whole-tic chunks so
 * sfx start/stop boundaries align with game logic.
 *
 *   ticRateHz       = 35  (TICRATE from doomdef.h)
 *   outputSampleRate = 44100 Hz (default; configurable via snd_samplerate)
 *   samplesPerTic    = outputSampleRate / ticRateHz
 *
 * Parity-critical invariants pinned here:
 *
 *   1. Vanilla tic rate is exactly 35 Hz (F-010).  All audio timing
 *      derives from this rate; a different tic rate would shift sfx
 *      start times relative to game events.
 *   2. The output sample rate MUST be divisible by the tic rate so
 *      `samplesPerTic` is an integer.  At 44100 Hz output and 35 Hz
 *      tics: 44100 / 35 = 1260 samples per tic (per channel).
 *   3. The mix buffer is exactly `samplesPerTic` STEREO FRAMES per
 *      audio tic, NOT mono samples.  A frame is 2 interleaved int16
 *      values (left, right).  Total bytes per tic at 44100 Hz =
 *      1260 frames × 2 channels × 2 bytes = 5040 bytes.
 *   4. The per-tic chunk is emitted as a single SDL_QueueAudio call
 *      (or equivalent on other backends).  Partial-chunk emission
 *      would desynchronize the per-tic sfx boundary.
 *   5. Audio chunks accumulate latency-free: the queue contains AT
 *      MOST 2-3 tics worth of unconsumed audio under normal load,
 *      so an sfx that starts on tic N is audible within ~57-86 ms.
 *   6. The mixer voice loop advances by ONE source sample per
 *      OUTPUT sample (after the 11025→44100 upsample expansion
 *      step from 11-008), so a 1-second sfx (44100 samples at
 *      mixer rate) consumes exactly 35 tics worth of mix chunks.
 *   7. When the source sfx ends, the voice is marked `finished` so
 *      the channel allocator (11-010) can reuse the slot.
 *      `finished` is set INSIDE the mix loop, not at the chunk
 *      boundary — partial-final chunks are zero-padded.
 */

/** Vanilla TICRATE from doomdef.h. */
export const VANILLA_AUDIO_TIMING_TICRATE_HZ = 35;

/** Default chocolate-doom output sample rate. */
export const VANILLA_AUDIO_TIMING_DEFAULT_OUTPUT_RATE_HZ = 44_100;

/** Default `samplesPerTic` at 44100 Hz output / 35 Hz tic = 1260. */
export const VANILLA_AUDIO_TIMING_DEFAULT_SAMPLES_PER_TIC = 1260;

/** Bytes per stereo frame (2 channels × 2 bytes int16). */
export const VANILLA_AUDIO_TIMING_BYTES_PER_STEREO_FRAME = 4;

/** Default bytes-per-tic at 44100 Hz: 1260 × 4 = 5040 bytes. */
export const VANILLA_AUDIO_TIMING_DEFAULT_BYTES_PER_TIC = 5040;

/**
 * Compute `samplesPerTic` from output sample rate and tic rate.
 * Throws when the rates do not divide evenly (vanilla's invariant —
 * the mix buffer must be an integer number of frames).
 */
export function vanillaAudioTimingSamplesPerTic(outputSampleRate: number, ticRateHz: number): number {
  if (!Number.isInteger(outputSampleRate) || outputSampleRate <= 0) {
    throw new RangeError(`vanillaAudioTimingSamplesPerTic: outputSampleRate must be a positive integer, got ${outputSampleRate}`);
  }
  if (!Number.isInteger(ticRateHz) || ticRateHz <= 0) {
    throw new RangeError(`vanillaAudioTimingSamplesPerTic: ticRateHz must be a positive integer, got ${ticRateHz}`);
  }
  if (outputSampleRate % ticRateHz !== 0) {
    throw new RangeError(`vanillaAudioTimingSamplesPerTic: outputSampleRate (${outputSampleRate}) must divide evenly by ticRateHz (${ticRateHz})`);
  }
  return outputSampleRate / ticRateHz;
}

/**
 * Compute the byte size of one stereo PCM chunk at the given output
 * rate.  `samplesPerTic × 2 channels × 2 bytes = samplesPerTic × 4`.
 */
export function vanillaAudioTimingBytesPerTic(samplesPerTic: number): number {
  if (!Number.isInteger(samplesPerTic) || samplesPerTic <= 0) {
    throw new RangeError(`vanillaAudioTimingBytesPerTic: samplesPerTic must be a positive integer, got ${samplesPerTic}`);
  }
  return samplesPerTic * VANILLA_AUDIO_TIMING_BYTES_PER_STEREO_FRAME;
}

/**
 * Validate that an output sample rate is a vanilla-compatible choice
 * (divides evenly by 35 Hz).  Common valid choices: 35×n for integer n.
 * Returns `true` when compatible; throws otherwise.
 */
export function vanillaAudioTimingValidateOutputRate(outputSampleRate: number): true {
  if (outputSampleRate % VANILLA_AUDIO_TIMING_TICRATE_HZ !== 0) {
    throw new RangeError(`vanillaAudioTimingValidateOutputRate: outputSampleRate (${outputSampleRate}) must be a multiple of ${VANILLA_AUDIO_TIMING_TICRATE_HZ} Hz`);
  }
  return true;
}
