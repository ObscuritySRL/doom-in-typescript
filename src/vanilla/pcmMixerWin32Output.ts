/**
 * Vanilla DOOM 1.9 PCM mixer + Win32 audio output runtime.
 *
 * Plan_final step `11-005` (lane: audio) wires the PCM mixer
 * (DMX → int16 expansion, stereo separation, multi-voice mixing,
 * clipping to int16 range) and the canonical Win32 audio output
 * policy (16-bit, two double-buffer slices, 11_025 Hz native SFX,
 * 49_716 Hz native music, 1024-sample SFX buffer) into a single
 * frozen runtime artifact the host driver consumes.
 *
 * The wrapper imports the read-only mixer primitives from
 * `src/audio/pcmMixer.ts` (`expandDmxSamples`, `computeStereoGains`,
 * `createMixerVoice`, `mixVoices`, `dmxByteToInt16`, `clipToInt16`,
 * plus the sample-rate and volume constants) and the canonical Win32
 * audio constants from
 * `src/audio/implement-win32-audio-device-open-close.ts`
 * (`VANILLA_AUDIO_*` constants).  The actual `dlopen` of `winmm.dll`
 * and the per-buffer `waveOutWrite` FFI calls are intentionally NOT
 * inlined — FFI calls cannot be unit-tested without a real audio
 * device, and the launcher already proves the canonical Win32 audio
 * shape end-to-end.  This wrapper provides the building blocks a
 * later host bring-up step can compose.
 *
 * The runtime artifact is frozen at the top level; the mixer-voice
 * arrays inside it are mutable per-frame (vanilla's `channels[]` is a
 * file-scope global).  Vanilla shutdown policy is encoded via the
 * `shutdownPolicy` field: every Win32 audio resource (waveOut handle,
 * mixer buffers, double-buffer queue) must be released before
 * process exit, matching the `I_ShutdownSound` pattern.
 *
 * @example
 * ```ts
 * import { createPcmMixerWin32Output } from './pcmMixerWin32Output.ts';
 *
 * const audio = createPcmMixerWin32Output();
 * audio.outputSampleRateHz;             // 44100
 * audio.outputBitsPerSample;             // 16
 * audio.outputDoubleBufferCount;         // 2
 * audio.mixerSfxBufferSampleCount;       // 1024
 * const mixed = audio.mix(voices, 1024); // Int16Array of length 1024 * 2
 * ```
 */

import { DEFAULT_OUTPUT_SAMPLE_RATE, DMX_NATIVE_SAMPLE_RATE, MIX_MAX_VOLUME, type MixerVoice, expandDmxSamples, mixVoices } from '../audio/pcmMixer.ts';
import {
  VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES,
  VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_DOUBLE_BUFFER_COUNT,
  VANILLA_AUDIO_OUTPUT_BITS,
} from '../audio/implement-win32-audio-device-open-close.ts';
import { VANILLA_SFX_CHANNEL_COUNT } from './channelAndPriorityRuntime.ts';

/**
 * Description of the Win32 audio shutdown policy.  The launcher /
 * host driver must release every audio resource before
 * `D_Quit` returns; this descriptor enumerates the resources every
 * shutdown path must touch.
 */
export interface PcmMixerShutdownPolicy {
  readonly closesWaveOutHandle: boolean;
  readonly drainsDoubleBufferQueue: boolean;
  readonly releasesMixerBuffers: boolean;
  readonly waitsForLastBufferToFlush: boolean;
}

/**
 * Frozen runtime artifact assembled by
 * {@link createPcmMixerWin32Output}.  Carries the canonical Win32
 * audio output parameters, the mixer expansion / mixing primitives
 * exposed as pure functions, and the shutdown policy descriptor.
 */
export interface PcmMixerWin32Output {
  readonly mix: (voices: MixerVoice[], frameCount: number, output?: Int16Array) => Int16Array;
  readonly mixerMaxVolume: number;
  readonly mixerSfxBufferSampleCount: number;
  readonly nativeMusicSampleRateHz: number;
  readonly nativeSfxSampleRateHz: number;
  readonly outputBitsPerSample: number;
  readonly outputChannelCount: number;
  readonly outputDoubleBufferCount: number;
  readonly outputSampleRateHz: number;
  readonly shutdownPolicy: PcmMixerShutdownPolicy;
  readonly vanillaSfxChannelCount: number;
  readonly expandDmxSamplesToOutputRate: (samples: Uint8Array, sourceRateHz: number) => Int16Array;
}

const VANILLA_AUDIO_OUTPUT_CHANNEL_COUNT = 2;

const VANILLA_PCM_MIXER_SHUTDOWN_POLICY: PcmMixerShutdownPolicy = Object.freeze({
  closesWaveOutHandle: true,
  drainsDoubleBufferQueue: true,
  releasesMixerBuffers: true,
  waitsForLastBufferToFlush: true,
});

/**
 * Build a fresh frozen {@link PcmMixerWin32Output} carrying the
 * canonical Win32 audio output parameters, the mixer expansion and
 * mixing primitives (as bound methods on the frozen façade), and the
 * vanilla shutdown policy descriptor.  The actual `dlopen` of
 * `winmm.dll` is left to the host driver step that composes this
 * wrapper into a live audio device.
 *
 * @example
 * ```ts
 * const audio = createPcmMixerWin32Output();
 * audio.nativeSfxSampleRateHz;       // 11025
 * audio.outputSampleRateHz;          // 44100
 * audio.shutdownPolicy.closesWaveOutHandle; // true
 * ```
 */
export function createPcmMixerWin32Output(): PcmMixerWin32Output {
  return Object.freeze({
    expandDmxSamplesToOutputRate: (samples: Uint8Array, sourceRateHz: number): Int16Array => expandDmxSamples(samples, sourceRateHz, DEFAULT_OUTPUT_SAMPLE_RATE),
    mix: (voices: MixerVoice[], frameCount: number, output?: Int16Array): Int16Array => mixVoices(voices, frameCount, output),
    mixerMaxVolume: MIX_MAX_VOLUME,
    mixerSfxBufferSampleCount: VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES,
    nativeMusicSampleRateHz: VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ,
    nativeSfxSampleRateHz: VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ,
    outputBitsPerSample: VANILLA_AUDIO_OUTPUT_BITS,
    outputChannelCount: VANILLA_AUDIO_OUTPUT_CHANNEL_COUNT,
    outputDoubleBufferCount: VANILLA_AUDIO_DOUBLE_BUFFER_COUNT,
    outputSampleRateHz: DEFAULT_OUTPUT_SAMPLE_RATE,
    shutdownPolicy: VANILLA_PCM_MIXER_SHUTDOWN_POLICY,
    vanillaSfxChannelCount: VANILLA_SFX_CHANNEL_COUNT,
  });
}

void DMX_NATIVE_SAMPLE_RATE;
