/**
 * Vanilla DOOM 1.9 Win32 audio device open/close contract.
 *
 * From Chocolate Doom 2.2.1 i_sdlsound.c (and the original waveOut* path in
 * dmx.c for DOS):
 *   waveOutOpen → waveOutPrepareHeader → waveOutWrite. Close via
 *   waveOutReset → waveOutUnprepareHeader → waveOutClose.
 *
 *   Buffer format: 16-bit signed, mono or stereo, 11025 Hz (DOOM default
 *   SFX rate) or 49716 Hz (OPL music rate).
 *   Number of buffers: 2 (double-buffering for low latency).
 *   Buffer size: 1024 samples (SFX) or computed by OPL render quantum.
 */

export const VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ = 11025;
export const VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ = 49716;
export const VANILLA_AUDIO_OUTPUT_BITS = 16;
export const VANILLA_AUDIO_DOUBLE_BUFFER_COUNT = 2;
export const VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES = 1024;
