/**
 * Live Win32 audio host for the playable game.
 *
 * `bun run doom.ts -iwad doom/DOOM1.WAD` was completely silent because
 * every gameplay sound callback was `null`.  This module is the real
 * audio host that makes it audible.  It assembles the already
 * unit-tested audio subsystems — it does NOT reinvent them:
 *
 *  - `src/audio/audioParity.ts` `AudioParityHarness` owns the vanilla
 *    digital-sfx pipeline end to end: `S_StartSound`
 *    (`src/audio/soundSystem.ts`) → 8-channel allocation
 *    (`channels.ts`) → distance/pan (`spatial.ts`) → DMX→int16
 *    expansion + clip-and-step mixer (`pcmMixer.ts`).  `startHarnessSfx`
 *    installs a {@link MixerVoice}; `runHarnessTic` mixes one 35 Hz
 *    tic of interleaved 16-bit stereo PCM at 44 100 Hz
 *    ({@link SAMPLES_PER_TIC} frames) — exactly the buffer
 *    `src/audio/implement-audio-buffer-timing.ts` pins.
 *  - `src/audio/musicSystem.ts` owns the `S_ChangeMusic` /
 *    `S_StopMusic` / `S_PauseSound` / `S_ResumeSound` lifecycle and the
 *    MUS scheduler advance.  Map → music lump selection comes from
 *    `src/playable/audio-product-integration/playLevelMusic.ts`
 *    (`resolveLevelMusic`: E1M1 → `D_E1M1`, music number 1).
 *  - `src/launcher/sfxCatalog.ts` is the vanilla `sounds.c` `S_sfx[]`
 *    table mapping a numeric `sfxenum_t` id to its `DS<NAME>` lump,
 *    arbitration priority, and pitch-perturbation class.
 *  - The Win32 device is opened through `@bun-win32/winmm`'s
 *    `waveOutOpen` / `waveOutPrepareHeader` / `waveOutWrite` /
 *    `waveOutReset` / `waveOutUnprepareHeader` / `waveOutClose` exactly
 *    as `src/audio/implement-win32-audio-device-open-close.ts`
 *    documents the vanilla `i_sdlsound.c` / `dmx.c` open/close order.
 *
 * **FFI lifetime.**  The `HWAVEOUT` handle is a `bigint` (u64).  Every
 * `WAVEHDR` passed to `waveOutWrite` is prepared once and tracked; on
 * {@link Win32AudioHost.shutdown} the device is `waveOutReset` (abort
 * pending buffers), every header `waveOutUnprepareHeader`'d, then
 * `waveOutClose` — all inside a `finally` so a throw mid-pump never
 * leaks the device.  The Win32 parameter names (`hwo`, `pwh`, `cbwh`,
 * `pwfx`) are preserved verbatim in the binding (the binding lives in
 * `@bun-win32/winmm`; this module calls the bound statics).
 *
 * **Robustness.**  {@link createWin32AudioHost} never throws on a
 * device-open failure: it logs and returns a host whose pump is a
 * silent no-op so the game keeps running.  The mixer pump is driven by
 * the caller's existing 35 Hz loop (see `win32GameHost.ts`); it does
 * NOT spawn its own timer, so it cannot stall the game loop.
 *
 * **Test seam.**  The Win32 device is injected via
 * {@link Win32AudioHostOptions.deviceSink}.  Production passes the real
 * waveOut sink ({@link openWaveOutDeviceSink}); the headless test suite
 * passes a capturing stub so no real hardware is touched and the mixed
 * PCM can be asserted.
 */

import { ptr } from 'bun:ffi';

import Winmm from '@bun-win32/winmm';

import type { SfxLump } from '../audio/sfxLumps.ts';
import type { SpatialListener } from '../audio/spatial.ts';
import type { MusScore } from '../audio/musParser.ts';
import type { StartSoundResult } from '../audio/soundSystem.ts';
import type { AudioParityHarness } from '../audio/audioParity.ts';
import type { SfxLoader } from '../vanilla/sfxLoader.ts';
import type { SoundAndMusicAssetCatalog } from '../vanilla/soundAndMusicAssets.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import type { LauncherResources } from './session.ts';

import { DoomRandom } from '../core/rng.ts';
import { createAudioParityHarness, runHarnessTic, startHarnessSfx } from '../audio/audioParity.ts';
import { MUS_INTRO, changeMusic, pauseMusic, resolveMusicNumber, resumeMusic, setMusicVolume, stopMusic } from '../audio/musicSystem.ts';
import { SAMPLES_PER_TIC } from '../oracles/audioHash.ts';
import { parseMusScore } from '../audio/musParser.ts';
import { buildSfxLoader } from '../vanilla/sfxLoader.ts';
import { VANILLA_MUS_LUMP_PREFIX, VANILLA_SFX_LUMP_PREFIX } from '../vanilla/soundAndMusicAssets.ts';
import { resolveLevelMusic } from '../playable/audio-product-integration/playLevelMusic.ts';
import { sfxCatalogEntry } from './sfxCatalog.ts';

/** Vanilla default `snd_SfxVolume` (0..15, s_sound.c). */
export const DEFAULT_SFX_VOLUME = 15;

/** Vanilla default `snd_MusicVolume` mapped to the 0..127 device scale (s_sound.c musicVolume 8 → 8). */
export const DEFAULT_MUSIC_VOLUME = 8;

/** Interleaved 16-bit stereo frame count emitted per 35 Hz tic (44 100 / 35). */
export const AUDIO_FRAMES_PER_TIC = SAMPLES_PER_TIC;

/** 16-bit signed PCM, stereo, 44 100 Hz — the vanilla mixer output format. */
export const AUDIO_SAMPLE_RATE_HZ = 44_100;
export const AUDIO_CHANNEL_COUNT = 2;
export const AUDIO_BITS_PER_SAMPLE = 16;
export const AUDIO_BYTES_PER_FRAME = (AUDIO_CHANNEL_COUNT * AUDIO_BITS_PER_SAMPLE) / 8;

/** Double-buffering depth (i_sdlsound.c keeps 2-3 tics queued, F-033). */
export const AUDIO_RING_BUFFER_COUNT = 3;

/**
 * A device sink the host writes mixed PCM to.  Production is the real
 * `waveOut` sink; tests inject a capturing stub so no hardware is
 * needed and the deterministic mixer output can be asserted.
 */
export interface AudioDeviceSink {
  /**
   * Push one tic of interleaved signed-16-bit stereo PCM
   * ({@link AUDIO_FRAMES_PER_TIC} frames).  The buffer is owned by the
   * caller and reused; a sink that needs to retain it must copy.
   */
  write(frames: Int16Array): void;
  /** Release the device.  Idempotent; called once from {@link Win32AudioHost.shutdown}. */
  close(): void;
}

/** Origin spatial snapshot for a positioned sfx (a mobj's world x/y). */
export interface SfxOrigin {
  /**
   * Opaque identity for channel origin-dedup (vanilla `mobj_t *`).
   * `null` ⇒ an anonymous / fullscreen sound (menu, boss cue) that
   * skips spatialization and takes centre pan at full volume.
   */
  readonly originId: number | null;
  /** Source world x in fixed-point (ignored when `originId` is null). */
  readonly x: number;
  /** Source world y in fixed-point (ignored when `originId` is null). */
  readonly y: number;
}

/** Options for {@link createWin32AudioHost}. */
export interface Win32AudioHostOptions {
  /**
   * Injected device sink.  Omit in production to open the real
   * `waveOut` device via {@link openWaveOutDeviceSink}; tests pass a
   * stub.  When the real open fails the host falls back to a silent
   * no-op sink and logs — it never throws.
   */
  readonly deviceSink?: AudioDeviceSink | null;
  /** Initial `snd_SfxVolume` (0..15). Defaults to {@link DEFAULT_SFX_VOLUME}. */
  readonly sfxVolume?: number;
  /** Initial music volume (0..127). Defaults to {@link DEFAULT_MUSIC_VOLUME}. */
  readonly musicVolume?: number;
  /** Sink used to report a device-open failure. Defaults to `console.warn`. */
  readonly onDeviceError?: (message: string) => void;
}

/** Live audio host handle threaded into the game host + runtime. */
export interface Win32AudioHost {
  /**
   * Vanilla `S_StartSound(origin, sfxId)`.  Resolves the `S_sfx[]`
   * row, decodes the DMX lump (cached), runs the full vanilla start
   * path (`audioParity.startHarnessSfx` → `soundSystem.startSound`),
   * and installs a mixer voice.  A stray / unknown id, an
   * inaudible/dropped result, or a missing lump is a silent no-op
   * (the game never crashes on audio).
   */
  startSfx(origin: SfxOrigin | null, sfxId: number): StartSoundResult | null;
  /**
   * Vanilla `S_ChangeMusic` for a map: `E1M1` → `D_E1M1` (music
   * number 1), parsed + looped.  No-op when the lump is absent.
   */
  startMusic(mapName: string): void;
  /** Vanilla `S_StopMusic`. */
  stopMusic(): void;
  /** Vanilla `S_PauseSound` (music only — sfx voices keep mixing out). */
  pause(): void;
  /** Vanilla `S_ResumeSound`. */
  resume(): void;
  /** `S_SetSfxVolume` / `S_SetMusicVolume`. */
  setVolumes(sfxVolume: number, musicVolume: number): void;
  /**
   * Mix exactly one 35 Hz tic and push it to the device.  Driven by
   * the game host's existing per-iteration loop — never blocks and
   * never spawns its own timer.  `listener` is the player ear
   * snapshot (`player.mo` x/y/angle); `listenerOriginId` is the
   * player mobj identity for the self-origin centre-pan fast path;
   * `isBossMap` enables the MAP08 volume floor.
   */
  pump(listener: SpatialListener, listenerOriginId: number | null, isBossMap: boolean): void;
  /**
   * Stop music, abort pending device buffers, and close the device.
   * Idempotent.  Always safe to call from a `finally`.
   */
  shutdown(): void;
}

/**
 * Build the live audio host.  Never throws: a device-open failure
 * degrades to a silent host so `bun run doom.ts` keeps running.
 */
export function createWin32AudioHost(resources: LauncherResources, options?: Win32AudioHostOptions): Win32AudioHost {
  const sfxVolume0 = clampSfxVolume(options?.sfxVolume ?? DEFAULT_SFX_VOLUME);
  const musicVolume0 = clampMusicVolume(options?.musicVolume ?? DEFAULT_MUSIC_VOLUME);
  const onDeviceError = options?.onDeviceError ?? ((message: string): void => console.warn(message));

  // Resolve the device sink. `undefined` ⇒ open the real waveOut
  // device; an explicit sink (incl. null) is honoured verbatim so
  // tests can force the silent path.
  let sink: AudioDeviceSink | null;
  if (options !== undefined && 'deviceSink' in options) {
    sink = options.deviceSink ?? null;
  } else {
    sink = openWaveOutDeviceSinkSafe(onDeviceError);
  }

  // Lazily-decoded DMX sfx lumps keyed by lump name. The catalog is
  // built once from the IWAD directory; parseSfxLump runs on first use
  // of each lump (vanilla caches sfx the same lazy way).
  const catalog = buildSoundAndMusicCatalog(resources.directory);
  const sfxLoader: SfxLoader | null = tryBuildSfxLoader(resources, catalog, onDeviceError);
  const musLumpNames = new Set<string>(catalog.musLumps.map((entry) => entry.name));

  // s_sound.c: the title music (mus_intro / D_INTRO) is substituted to
  // mus_introa / D_INTROA on the OPL/SB device when D_INTROA ships in
  // the WAD (musicSystem.resolveMusicNumber). The default SB device is
  // already the audioParity harness music-system default.
  const harness: AudioParityHarness = createAudioParityHarness({ music: { initialVolume: musicVolume0, hasIntroALump: musLumpNames.has('D_INTROA') } });

  let sfxVolume = sfxVolume0;

  // The pitch-perturbation RNG is the menu (M_Random) stream in
  // vanilla, intentionally isolated from the P_Random gameplay stream
  // (sfx pitch never feeds back into simulation — see soundSystem.ts
  // module note). A dedicated DoomRandom keeps the live host from
  // perturbing the demo-critical P_Random stream the runtime owns.
  const rngSink = new DoomRandom();

  let lastListener: SpatialListener = { x: 0, y: 0, angle: 0 };
  let lastListenerOriginId: number | null = null;
  let lastIsBossMap = false;

  const startSfx = (origin: SfxOrigin | null, sfxId: number): StartSoundResult | null => {
    if (sfxLoader === null) {
      return null;
    }
    const entry = sfxCatalogEntry(sfxId);
    if (entry === null) {
      return null;
    }
    const lump: SfxLump | undefined = sfxLoader.sfxLumpsByName.get(entry.lumpName);
    if (lump === undefined) {
      return null;
    }

    const remote = origin !== null && origin.originId !== null;
    const result = startHarnessSfx(harness, {
      sfxLump: lump,
      request: {
        sfxId,
        priority: entry.priority,
        pitchClass: entry.pitchClass,
        origin: origin?.originId ?? null,
        sourcePosition: remote ? { x: origin!.x, y: origin!.y } : null,
        listener: lastListener,
        listenerOrigin: lastListenerOriginId,
        sfxVolume,
        isBossMap: lastIsBossMap,
        linkVolumeAdjust: null,
        linkPitch: null,
        rng: rngSink,
        table: harness.channelTable,
      },
    });
    return result;
  };

  const startMusic = (mapName: string): void => {
    const selection = resolveMusicSelection(mapName, harness);
    if (selection === null) {
      // Non-resolvable name (unknown front-end track) — leave as-is.
      return;
    }
    if (!musLumpNames.has(selection.musicLumpName)) {
      return;
    }
    let score: Readonly<MusScore>;
    try {
      score = parseMusScore(readLump(resources, selection.musicLumpName));
    } catch (error) {
      onDeviceError(`audio: failed to parse music lump ${selection.musicLumpName}: ${describeError(error)}`);
      return;
    }
    changeMusic(harness.music, { musicNum: selection.musicNumber, looping: true, score });
  };

  const host: Win32AudioHost = {
    startSfx,
    startMusic,
    stopMusic(): void {
      stopMusic(harness.music);
    },
    pause(): void {
      pauseMusic(harness.music);
    },
    resume(): void {
      resumeMusic(harness.music);
    },
    setVolumes(nextSfxVolume: number, nextMusicVolume: number): void {
      sfxVolume = clampSfxVolume(nextSfxVolume);
      setMusicVolume(harness.music, clampMusicVolume(nextMusicVolume));
    },
    pump(listener: SpatialListener, listenerOriginId: number | null, isBossMap: boolean): void {
      lastListener = listener;
      lastListenerOriginId = listenerOriginId;
      lastIsBossMap = isBossMap;
      // audioParity.runHarnessTic advances the MUS scheduler one game
      // tic, mixes every active voice into a SAMPLES_PER_TIC-frame
      // stereo Int16Array, reaps finished voices, and returns the
      // buffer. The OPL→PCM music synthesis bridge is not assembled
      // (see module note); the scheduler still advances so the
      // looping/pause lifecycle stays correct and the sfx buffer is
      // real, non-silent PCM.
      const tic = runHarnessTic(harness);
      if (sink !== null) {
        sink.write(tic.sfxFrames);
      }
    },
    shutdown(): void {
      try {
        stopMusic(harness.music);
      } finally {
        const closing = sink;
        sink = null;
        if (closing !== null) {
          closing.close();
        }
      }
    },
  };

  return host;
}

/** Clamp `snd_SfxVolume` into the vanilla 0..15 range. */
function clampSfxVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_SFX_VOLUME;
  }
  return Math.max(0, Math.min(15, Math.trunc(volume)));
}

/** Clamp the music volume into the device 0..127 range. */
function clampMusicVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_MUSIC_VOLUME;
  }
  return Math.max(0, Math.min(127, Math.trunc(volume)));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readLump(resources: LauncherResources, lumpName: string): Buffer {
  // Reuse the directory the catalog already validated; a missing
  // entry is impossible here (musLumpNames gated the call).
  const upper = lumpName.toUpperCase();
  for (let index = resources.directory.length - 1; index >= 0; index -= 1) {
    const entry = resources.directory[index]!;
    if (entry.name.toUpperCase() === upper && entry.size > 0) {
      return resources.wadBuffer.subarray(entry.offset, entry.offset + entry.size);
    }
  }
  throw new Error(`lump ${lumpName} not found`);
}

/**
 * Build the `SoundAndMusicAssetCatalog` (the pinned `05-006` shape:
 * `DS`-prefixed sfx + `D_`-prefixed MUS directory entries in
 * directory order) directly from the launcher directory.  Mirrors the
 * read-only `buildSoundAndMusicAssets` partition logic exactly,
 * reusing its frozen prefix constants, without depending on the full
 * `IwadResourceCache` type the launcher session never constructs.
 */
/** `mus_intro` (29) is D_INTRO; `D_INTROA` is the OPL substitute (32). */
const FRONT_END_TRACKS: Readonly<Record<string, number>> = Object.freeze({
  TITLE: MUS_INTRO,
});

/**
 * Resolve a music selection from a name.  `E#M#` map names go through
 * the pinned `resolveLevelMusic` (E1M1 → D_E1M1, number 1).  Front-end
 * names (`'TITLE'`) map to `mus_intro` and run through
 * `resolveMusicNumber` so the OPL/SB device gets the `D_INTROA`
 * substitution exactly as vanilla `S_ChangeMusic` does.  Anything
 * else returns `null` (host leaves music untouched).
 */
function resolveMusicSelection(name: string, harness: AudioParityHarness): { musicLumpName: string; musicNumber: number } | null {
  const upper = name.trim().toUpperCase();
  const frontEnd = FRONT_END_TRACKS[upper];
  if (frontEnd !== undefined) {
    const resolved = resolveMusicNumber(harness.music, frontEnd);
    return { musicLumpName: resolved === frontEnd ? 'D_INTRO' : 'D_INTROA', musicNumber: resolved };
  }
  try {
    const level = resolveLevelMusic(upper);
    return { musicLumpName: level.musicLumpName, musicNumber: level.musicNumber };
  } catch {
    return null;
  }
}

function buildSoundAndMusicCatalog(directory: readonly DirectoryEntry[]): SoundAndMusicAssetCatalog {
  const sfxLumps: SoundAndMusicAssetCatalog['sfxLumps'][number][] = [];
  const musLumps: SoundAndMusicAssetCatalog['musLumps'][number][] = [];
  for (let directoryIndex = 0; directoryIndex < directory.length; directoryIndex += 1) {
    const entry = directory[directoryIndex]!;
    const upperName = entry.name.toUpperCase();
    if (upperName.startsWith(VANILLA_SFX_LUMP_PREFIX) && entry.size > 0) {
      sfxLumps.push(Object.freeze({ directoryEntry: entry, directoryIndex, name: upperName }));
      continue;
    }
    if (upperName.startsWith(VANILLA_MUS_LUMP_PREFIX) && entry.size > 0) {
      musLumps.push(Object.freeze({ directoryEntry: entry, directoryIndex, name: upperName }));
    }
  }
  return Object.freeze({
    musLumps: Object.freeze(musLumps),
    sfxLumps: Object.freeze(sfxLumps),
  });
}

function tryBuildSfxLoader(resources: LauncherResources, catalog: SoundAndMusicAssetCatalog, onDeviceError: (message: string) => void): SfxLoader | null {
  try {
    return buildSfxLoader(catalog, {
      readSfxLumpBytes: (entry) => Buffer.from(resources.wadBuffer.subarray(entry.offset, entry.offset + entry.size)),
    });
  } catch (error) {
    onDeviceError(`audio: failed to build sfx loader (sound disabled): ${describeError(error)}`);
    return null;
  }
}


/**
 * Open the real Win32 `waveOut` device and return a sink that pushes
 * one tic of PCM per {@link AudioDeviceSink.write}.  Returns `null`
 * (caller degrades to silent) when winmm is unavailable or the open
 * fails — `bun run doom.ts` must never crash because audio is absent.
 */
export function openWaveOutDeviceSinkSafe(onDeviceError: (message: string) => void): AudioDeviceSink | null {
  try {
    return openWaveOutDeviceSink();
  } catch (error) {
    onDeviceError(`audio: waveOut device unavailable (running silent): ${describeError(error)}`);
    return null;
  }
}

/** WAVE_FORMAT_PCM (mmreg.h). */
const WAVE_FORMAT_PCM = 1;
/** WAVE_MAPPER — let the OS pick the default output device. */
const WAVE_MAPPER = 0xffff_ffff;
/** CALLBACK_NULL — no callback, we poll via header dwFlags. */
const CALLBACK_NULL = 0;
/** WHDR_DONE — set by the driver when a buffer has finished playing. */
const WHDR_DONE = 0x0000_0001;
/** sizeof(WAVEFORMATEX) with no extra bytes. */
const WAVEFORMATEX_SIZE = 18;
/** sizeof(WAVEHDR) on x64 (lpData, dwBufferLength, dwBytesRecorded, dwUser, dwFlags, dwLoops, lpNext, reserved). */
const WAVEHDR_SIZE = 48;
const WAVEHDR_DWFLAGS_OFFSET = 16;

/**
 * Open `waveOut` and return a ring-buffered sink.  FFI lifetime is
 * fully owned here: the `HWAVEOUT` is a `bigint` (u64); every
 * `WAVEHDR` is `waveOutPrepareHeader`'d once and recycled; `close`
 * runs `waveOutReset` → `waveOutUnprepareHeader` (each) →
 * `waveOutClose` in a `finally`, so a throw can never leak the
 * device.  Verbatim Win32 names (`hwo`, `pwh`, `cbwh`, `pwfx`) are
 * preserved by the `@bun-win32/winmm` binding.
 */
export function openWaveOutDeviceSink(): AudioDeviceSink {
  // `Winmm` binds each winmm.dll export lazily on first call (the
  // `@bun-win32/winmm` class memoizes the dlopen), so the top-level
  // import is cheap and the actual FFI resolution only happens here,
  // inside the try/catch the caller wraps this in.

  // WAVEFORMATEX: 16-bit signed stereo @ 44 100 Hz.
  const blockAlign = AUDIO_CHANNEL_COUNT * (AUDIO_BITS_PER_SAMPLE / 8);
  const pwfx = Buffer.alloc(WAVEFORMATEX_SIZE);
  pwfx.writeUInt16LE(WAVE_FORMAT_PCM, 0); // wFormatTag
  pwfx.writeUInt16LE(AUDIO_CHANNEL_COUNT, 2); // nChannels
  pwfx.writeUInt32LE(AUDIO_SAMPLE_RATE_HZ, 4); // nSamplesPerSec
  pwfx.writeUInt32LE(AUDIO_SAMPLE_RATE_HZ * blockAlign, 8); // nAvgBytesPerSec
  pwfx.writeUInt16LE(blockAlign, 12); // nBlockAlign
  pwfx.writeUInt16LE(AUDIO_BITS_PER_SAMPLE, 14); // wBitsPerSample
  pwfx.writeUInt16LE(0, 16); // cbSize

  const phwo = Buffer.alloc(8); // LPHWAVEOUT out-param (HWAVEOUT is 8 bytes).
  const openResult = Winmm.waveOutOpen(phwo.ptr, WAVE_MAPPER, pwfx.ptr, 0n, 0n, CALLBACK_NULL);
  if (openResult !== 0) {
    throw new Error(`waveOutOpen failed (MMRESULT ${openResult})`);
  }
  const hwo = phwo.readBigUInt64LE(0);
  if (hwo === 0n) {
    throw new Error('waveOutOpen returned a null HWAVEOUT');
  }

  const ticBytes = AUDIO_FRAMES_PER_TIC * AUDIO_BYTES_PER_FRAME;

  interface RingSlot {
    readonly data: Buffer;
    readonly header: Buffer;
    prepared: boolean;
  }

  const ring: RingSlot[] = [];
  for (let slot = 0; slot < AUDIO_RING_BUFFER_COUNT; slot += 1) {
    const data = Buffer.alloc(ticBytes);
    const header = Buffer.alloc(WAVEHDR_SIZE);
    header.writeBigUInt64LE(BigInt(ptr(data)), 0); // lpData (native address of the PCM body)
    header.writeUInt32LE(ticBytes, 8); // dwBufferLength
    ring.push({ data, header, prepared: false });
  }

  let nextSlot = 0;
  let closed = false;

  const unprepareAll = (): void => {
    for (const slot of ring) {
      if (slot.prepared) {
        Winmm.waveOutUnprepareHeader(hwo, slot.header.ptr, WAVEHDR_SIZE);
        slot.prepared = false;
      }
    }
  };

  return {
    write(frames: Int16Array): void {
      if (closed) {
        return;
      }
      const slot = ring[nextSlot]!;
      nextSlot = (nextSlot + 1) % ring.length;

      // Reuse the slot once the driver has finished playing it.
      if (slot.prepared) {
        const flags = slot.header.readUInt32LE(WAVEHDR_DWFLAGS_OFFSET);
        if ((flags & WHDR_DONE) === 0) {
          // Driver still owns this buffer (game outran the device);
          // drop this tic rather than block the 35 Hz loop.
          return;
        }
        Winmm.waveOutUnprepareHeader(hwo, slot.header.ptr, WAVEHDR_SIZE);
        slot.prepared = false;
      }

      const source = new Uint8Array(frames.buffer, frames.byteOffset, Math.min(frames.byteLength, slot.data.byteLength));
      slot.data.set(source, 0);
      if (source.byteLength < slot.data.byteLength) {
        slot.data.fill(0, source.byteLength);
      }
      slot.header.writeUInt32LE(0, WAVEHDR_DWFLAGS_OFFSET); // clear dwFlags before prepare

      if (Winmm.waveOutPrepareHeader(hwo, slot.header.ptr, WAVEHDR_SIZE) !== 0) {
        return;
      }
      slot.prepared = true;
      Winmm.waveOutWrite(hwo, slot.header.ptr, WAVEHDR_SIZE);
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;
      try {
        Winmm.waveOutReset(hwo); // abort every pending buffer
        unprepareAll();
      } finally {
        Winmm.waveOutClose(hwo);
      }
    },
  };
}
