/**
 * Vanilla DOOM 1.9 audio-hash hook integration point.
 *
 * The audio hash hook is an oracle-side capture mechanism that records
 * a SHA-256 hash of the mixed SFX PCM output buffer plus the count of
 * active sound channels at each sampled tic.  Music events are
 * tracked separately by the music-event-log hook (11-027).  The
 * hash output is the parity oracle that 11-030 gate-sfx-audio-parity
 * compares against a local Chocolate Doom reference run.
 *
 * From `src/oracles/audioHash.ts`:
 *
 *   AUDIO_SAMPLE_RATE        = 44100 Hz  (F-033 chocolate-doom default)
 *   DMX_NATIVE_SAMPLE_RATE   = 11025 Hz  (F-028 vanilla DMX format)
 *   SAMPLES_PER_TIC          = 1260      (44100 / 35)
 *   AUDIO_MAX_CHANNELS       = 8         (snd_channels default)
 *
 * Parity-critical invariants pinned here:
 *
 *   1. The audio hash hashes the MIXED SFX BUFFER only — music
 *      events do NOT contribute to this hash.  Music goes through
 *      the separate music-event-log hook (11-027) because OPL
 *      synthesis is platform-dependent (DOSBox vs. host).
 *   2. Buffer size for each captured tic is exactly SAMPLES_PER_TIC
 *      stereo frames = 1260 × 2 channels × 2 bytes = 5040 bytes.
 *   3. The active-channel count is captured alongside the hash so
 *      oracle comparisons can correlate audio output with channel
 *      occupancy: a tic with 3 channels active hashing the same
 *      bytes as a tic with 1 channel active is a parity failure
 *      (sfx eviction must have been wrong).
 *   4. AUDIO_MAX_CHANNELS = 8 — the vanilla `snd_channels` default
 *      from default.cfg.  The active-channel count is in `[0, 8]`.
 *   5. Default sampling interval is 35 tics (= 1 second at 35 Hz).
 *      Frame-by-frame parity debug uses interval=1.
 *   6. The hook fires AFTER the per-tic mix completes (i.e. after
 *      all voices have been mixed and clipped per 11-009 / 11-008),
 *      but BEFORE the buffer is enqueued to the host audio device.
 *      Sampling at the host-device side would include any
 *      platform-specific output queueing artifacts.
 *   7. The hook is a NO-OP in production when the oracle manifest
 *      is null — zero runtime cost outside oracle capture mode.
 */

/** Vanilla audio output sample rate (F-033). */
export const VANILLA_AUDIO_HASH_HOOK_SAMPLE_RATE_HZ = 44_100;

/** Samples per tic at the standard rate (44100 / 35). */
export const VANILLA_AUDIO_HASH_HOOK_SAMPLES_PER_TIC = 1260;

/** Bytes per tic in the captured stereo int16 buffer (1260 × 4). */
export const VANILLA_AUDIO_HASH_HOOK_BYTES_PER_TIC = 5040;

/** Vanilla `snd_channels` default. */
export const VANILLA_AUDIO_HASH_HOOK_MAX_CHANNELS = 8;

/** Default sampling interval in tics (1 second at 35 Hz). */
export const VANILLA_AUDIO_HASH_HOOK_DEFAULT_SAMPLING_INTERVAL_TICS = 35;

/** Hook phase: after per-tic mix completes, before enqueue to host audio device. */
export const VANILLA_AUDIO_HASH_HOOK_PHASE: 'after-mix-before-enqueue' = 'after-mix-before-enqueue';

/** What the audio hash covers: SFX mix only — music goes through the music-event-log hook. */
export const VANILLA_AUDIO_HASH_HOOK_SCOPE: 'sfx-mix-only' = 'sfx-mix-only';

/**
 * Decide whether the audio hash hook should fire for the given tic
 * and sampling interval.  Mirrors the framebuffer-hash sampling rule
 * from 09-034: `tic % interval === 0`.
 */
export function vanillaAudioHashShouldSample(tic: number, interval: number): boolean {
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new RangeError(`vanillaAudioHashShouldSample: interval must be a positive integer, got ${interval}`);
  }
  if (!Number.isInteger(tic) || tic < 0) {
    throw new RangeError(`vanillaAudioHashShouldSample: tic must be a non-negative integer, got ${tic}`);
  }
  return tic % interval === 0;
}

/**
 * Validate that an audio buffer has the exact per-tic stereo-int16
 * length.  Length is in BYTES — the buffer must be 5040 bytes
 * (= 1260 frames × 2 channels × 2 bytes).
 */
export function vanillaAudioHashValidateBufferBytes(byteLength: number): true {
  if (byteLength !== VANILLA_AUDIO_HASH_HOOK_BYTES_PER_TIC) {
    throw new RangeError(`vanillaAudioHashValidateBufferBytes: per-tic buffer must be ${VANILLA_AUDIO_HASH_HOOK_BYTES_PER_TIC} bytes (1260 stereo frames), got ${byteLength}`);
  }
  return true;
}

/**
 * Validate that the active-channel count is in `[0, AUDIO_MAX_CHANNELS]`.
 */
export function vanillaAudioHashValidateChannelCount(activeChannels: number): true {
  if (!Number.isInteger(activeChannels) || activeChannels < 0 || activeChannels > VANILLA_AUDIO_HASH_HOOK_MAX_CHANNELS) {
    throw new RangeError(`vanillaAudioHashValidateChannelCount: activeChannels must be in [0, ${VANILLA_AUDIO_HASH_HOOK_MAX_CHANNELS}], got ${activeChannels}`);
  }
  return true;
}
