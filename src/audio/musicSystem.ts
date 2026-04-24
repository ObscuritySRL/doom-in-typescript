/**
 * Music device integration (s_sound.c `S_StartMusic` /
 * `S_ChangeMusic` / `S_StopMusic` / `S_PauseSound` / `S_ResumeSound` /
 * `S_SetMusicVolume`).
 *
 * Vanilla Doom splits the music lifecycle across seven `s_sound.c`
 * entry points plus one predicate (`S_MusicPlaying`).  Each entry point
 * mutates at most three pieces of state — the currently-registered
 * song (`mus_playing`), the paused flag (`mus_paused`), and the volume
 * slider delegated to `I_SetMusicVolume` — and then delegates the
 * device-side work (OPL register writes, MIDI dispatch) to the
 * `I_*Song` / `I_*MusicVolume` shim.  This module mirrors that state
 * machine without speaking to any audio device directly: each mutating
 * call returns an ordered `MusicDeviceAction[]` that a host-side
 * bridge dispatches to the real device.
 *
 * The state machine's shape is dictated by the reference code:
 *
 * ```c
 * void S_ChangeMusic(int musicnum, int looping) {
 *     if (musicnum == mus_intro &&
 *         (snd_musicdevice == SNDDEVICE_ADLIB || snd_musicdevice == SNDDEVICE_SB) &&
 *         W_CheckNumForName("D_INTROA") >= 0) {
 *         musicnum = mus_introa;
 *     }
 *     if (musicnum <= mus_None || musicnum >= NUMMUSIC) I_Error(...);
 *     music = &S_music[musicnum];
 *     if (mus_playing == music) return;     // no-op when already playing
 *     S_StopMusic();                        // resume-if-paused, stop, unregister
 *     handle = I_RegisterSong(music->data, W_LumpLength(music->lumpnum));
 *     music->handle = handle;
 *     I_PlaySong(handle, looping);
 *     mus_playing = music;
 * }
 * void S_StopMusic(void) {
 *     if (mus_playing) {
 *         if (mus_paused) I_ResumeSong();   // must resume before stop
 *         I_StopSong();
 *         I_UnRegisterSong(mus_playing->handle);
 *         W_ReleaseLumpNum(mus_playing->lumpnum);
 *         mus_playing->data = NULL;
 *         mus_playing = NULL;
 *     }
 * }
 * void S_PauseSound(void)  { if (mus_playing && !mus_paused) { I_PauseSong();  mus_paused = true;  } }
 * void S_ResumeSound(void) { if (mus_playing &&  mus_paused) { I_ResumeSong(); mus_paused = false; } }
 * void S_SetMusicVolume(int volume) {
 *     if (volume < 0 || volume > 127) I_Error(...);
 *     I_SetMusicVolume(volume);
 * }
 * ```
 *
 * Parity-critical details preserved here:
 *
 *  - **`mus_intro` → `mus_introa` substitution** runs BEFORE the
 *    `NUMMUSIC` range check and only when the music device is an OPL
 *    variant (`SNDDEVICE_ADLIB` or `SNDDEVICE_SB`) AND the `D_INTROA`
 *    lump exists in the WAD.  Doom 1 IWADs ship both `D_INTRO` (a
 *    PC-speaker/GUS-tuned track) and `D_INTROA` (an OPL-tuned
 *    variant); the substitution is what makes the title screen sound
 *    right on a SoundBlaster.  A port that forgets the substitution
 *    or applies it unconditionally will fail the title-sequence
 *    music-event-log oracle (F-025).
 *  - **Same-track no-op**: `S_ChangeMusic(mus_playing, ...)` returns
 *    without emitting any device action, matching vanilla's
 *    `if (mus_playing == music) return` early-out.  This is load-
 *    bearing for the title loop which polls `S_ChangeMusic` every tic
 *    while the title music is already running.
 *  - **Resume-before-stop ordering**: `S_StopMusic` calls
 *    `I_ResumeSong()` first when `mus_paused` is set so the device
 *    leaves its "paused" state cleanly before being torn down.  A
 *    port that skips the resume leaves the device in an inconsistent
 *    state that the subsequent `I_StopSong` may not fully recover
 *    from (observable as a stuck-note artifact on the next song).
 *  - **Volume range**: `S_SetMusicVolume` throws `RangeError` outside
 *    `[MUSIC_VOLUME_MIN, MUSIC_VOLUME_MAX]` = `[0, 127]`, matching the
 *    vanilla `I_Error` abort.  Emits a `set-volume` action
 *    unconditionally — even when no song is loaded, even when the
 *    value is unchanged — because vanilla calls `I_SetMusicVolume`
 *    every time.  The abstract device treats `set-volume` as
 *    idempotent.
 *  - **Pause is a no-op when no song is loaded** (`mus_playing ==
 *    NULL`) AND when the song is already paused.  Resume mirrors the
 *    same early-out for the non-paused case.  This prevents spurious
 *    `I_PauseSong` / `I_ResumeSong` calls across the menu system which
 *    pokes these functions on every mode transition.
 *  - **Scheduler integration**: `advanceMusic(system, gameTics)`
 *    advances the inner {@link MusSchedulerState} by `gameTics *
 *    MUS_TICKS_PER_GAME_TIC` quickticks, returning the dispatched
 *    events for the host's MIDI-to-OPL bridge (15-009 / 15-010) to
 *    apply to the register file.  When the system is paused the
 *    scheduler does NOT advance — vanilla's pause stops time for the
 *    OPL device, and a port that keeps advancing under pause would
 *    burn through the score silently and then resume at the wrong
 *    offset.
 *  - **Scheduler reset on change**: `changeMusic` always allocates a
 *    fresh scheduler via {@link createMusScheduler}.  The per-channel
 *    velocity cache is therefore re-seeded to {@link MUS_DEFAULT_VELOCITY}
 *    on every song change, matching the `i_oplmusic.c` behaviour of
 *    re-initialising the MIDI state when a new song is registered.
 *  - **`MUS_NONE` / `NUMMUSIC` boundaries**: the allowed music-number
 *    range is `(MUS_NONE, NUMMUSIC)` = `[1, 67]` inclusive.  Values at
 *    either endpoint throw `RangeError`.
 *
 * The module is pure: mutations only affect the caller-supplied
 * {@link MusicSystemState}, and every returned action array is frozen
 * with frozen entries.  Zero Win32 bindings, zero audio device calls,
 * zero global mutable state.  The scheduler advance is where the
 * module's per-call allocation budget goes; everything else is O(1)
 * mutation plus a small O(1) action-list allocation.
 *
 * @example
 * ```ts
 * import { parseMusScore } from '../src/audio/musParser.ts';
 * import {
 *   advanceMusic,
 *   changeMusic,
 *   createMusicSystem,
 *   SNDDEVICE_SB,
 *   setMusicVolume,
 * } from '../src/audio/musicSystem.ts';
 *
 * const system = createMusicSystem({
 *   musicDevice: SNDDEVICE_SB,
 *   hasIntroALump: true,
 *   initialVolume: 8,
 * });
 * const score = parseMusScore(lookup.getLumpData('D_E1M1', wad));
 * const actions = changeMusic(system, { musicNum: 1, looping: true, score });
 * // actions = [{ kind: 'play-song', musicNum: 1, score, looping: true }]
 *
 * // Each 35 Hz game tic:
 * const dispatched = advanceMusic(system, 1);
 * for (const entry of dispatched) applyEventToOplDevice(entry.event);
 *
 * setMusicVolume(system, 12);
 * // [{ kind: 'set-volume', volume: 12 }]
 * ```
 */

import type { MusScore } from './musParser.ts';
import type { DispatchedMusEventEntry, MusSchedulerState } from './musScheduler.ts';
import { MUS_TICKS_PER_GAME_TIC, advanceMusScheduler, createMusScheduler } from './musScheduler.ts';

/** Inclusive lower bound on a valid `S_SetMusicVolume` argument. */
export const MUSIC_VOLUME_MIN = 0;

/** Inclusive upper bound on a valid `S_SetMusicVolume` argument (vanilla `I_Error` threshold). */
export const MUSIC_VOLUME_MAX = 127;

/** Vanilla `musicVolume = 8` default from `s_sound.c`. */
export const DEFAULT_MUSIC_VOLUME = 8;

/** `snddevice_t` sentinel — no audio device selected. */
export const SNDDEVICE_NONE = 0;

/** `snddevice_t` — PC speaker beeper (vanilla config id `1`). */
export const SNDDEVICE_PCSPEAKER = 1;

/** `snddevice_t` — Adlib / OPL2 (vanilla config id `2`). */
export const SNDDEVICE_ADLIB = 2;

/** `snddevice_t` — SoundBlaster (vanilla config id `3`, the reference-run default per F-022 / F-033). */
export const SNDDEVICE_SB = 3;

/** `snddevice_t` — Pro Audio Spectrum (vanilla config id `4`). */
export const SNDDEVICE_PAS = 4;

/** `snddevice_t` — Gravis UltraSound (vanilla config id `5`). */
export const SNDDEVICE_GUS = 5;

/** `snddevice_t` — WaveBlaster (vanilla config id `6`). */
export const SNDDEVICE_WAVEBLASTER = 6;

/** `snddevice_t` — Sound Canvas (vanilla config id `7`). */
export const SNDDEVICE_SOUNDCANVAS = 7;

/** `snddevice_t` — Generic General MIDI (vanilla config id `8`). */
export const SNDDEVICE_GENMIDI = 8;

/** `snddevice_t` — AWE32 (vanilla config id `9`). */
export const SNDDEVICE_AWE32 = 9;

/** `mus_None` sentinel (music id 0) — not a valid song. */
export const MUS_NONE = 0;

/** `mus_intro` id from `sounds.h` — the PC-speaker / GUS-tuned title track. */
export const MUS_INTRO = 29;

/** `mus_introa` id from `sounds.h` — the OPL-tuned title variant substituted in for ADLIB/SB devices. */
export const MUS_INTROA = 32;

/** `NUMMUSIC` terminator — the exclusive upper bound of valid music ids. */
export const NUMMUSIC = 68;

/**
 * Load a new MUS score and start playback.
 *
 * Emitted by {@link changeMusic} when the requested song differs from
 * the currently-registered one.  Host bridge should call the device's
 * equivalent of `I_RegisterSong` then `I_PlaySong` using the supplied
 * score and the `looping` flag.
 */
export interface MusicPlaySongAction {
  readonly kind: 'play-song';
  readonly musicNum: number;
  readonly score: Readonly<MusScore>;
  readonly looping: boolean;
}

/**
 * Stop and unregister the currently-loaded song.
 *
 * Emitted by {@link stopMusic} and by {@link changeMusic} when a prior
 * song is being replaced.  Host bridge should call the device's
 * equivalent of `I_StopSong` then `I_UnRegisterSong` for `musicNum`.
 */
export interface MusicStopSongAction {
  readonly kind: 'stop-song';
  readonly musicNum: number;
}

/** Pause the currently-loaded song in place.  Emitted by {@link pauseMusic}. */
export interface MusicPauseSongAction {
  readonly kind: 'pause-song';
}

/**
 * Resume a paused song.
 *
 * Emitted by {@link resumeMusic}.  Also emitted by {@link stopMusic}
 * and {@link changeMusic} as the first action when tearing down a
 * paused song — vanilla's `S_StopMusic` explicitly calls `I_ResumeSong`
 * before `I_StopSong` so the device leaves its paused state cleanly.
 */
export interface MusicResumeSongAction {
  readonly kind: 'resume-song';
}

/** Update the global music volume.  Emitted by {@link setMusicVolume} unconditionally. */
export interface MusicSetVolumeAction {
  readonly kind: 'set-volume';
  readonly volume: number;
}

/** Discriminated union of every host-dispatched music device action. */
export type MusicDeviceAction = MusicPlaySongAction | MusicStopSongAction | MusicPauseSongAction | MusicResumeSongAction | MusicSetVolumeAction;

/** Options accepted by {@link createMusicSystem}. */
export interface CreateMusicSystemOptions {
  /** Initial music volume in `[0, 127]`.  Defaults to {@link DEFAULT_MUSIC_VOLUME} (8). */
  readonly initialVolume?: number;
  /** `snddevice_t` for the music device.  Defaults to {@link SNDDEVICE_SB} (vanilla reference). */
  readonly musicDevice?: number;
  /** Whether the WAD being played contains a `D_INTROA` lump.  Defaults to `false`. */
  readonly hasIntroALump?: boolean;
}

/** Mutable music system state. */
export interface MusicSystemState {
  /** Current music volume 0..127. */
  musicVolume: number;
  /** `music_num` of the currently registered song, or `null` when no song is loaded. */
  currentMusicNum: number | null;
  /** Scheduler driving the current score, or `null` when no song is loaded. */
  scheduler: MusSchedulerState | null;
  /** `true` when the current song was registered with `looping=true`. */
  looping: boolean;
  /** `true` when the song has been paused via {@link pauseMusic}. */
  paused: boolean;
  /** Music device id (selects the `mus_intro` → `mus_introa` substitution rule). */
  musicDevice: number;
  /** Whether the loaded WAD exposes a `D_INTROA` lump. */
  hasIntroALump: boolean;
}

/** Request accepted by {@link changeMusic}. */
export interface ChangeMusicRequest {
  /** `music_num` from `sounds.h`; must satisfy `MUS_NONE < musicNum < NUMMUSIC`. */
  readonly musicNum: number;
  /** When `true`, the scheduler rewinds on `ScoreEnd` and replays the score. */
  readonly looping: boolean;
  /** Parsed score for the target song.  Caller is responsible for the WAD lookup. */
  readonly score: Readonly<MusScore>;
}

/** Request accepted by {@link startMusic}.  Identical to {@link ChangeMusicRequest} sans the `looping` field. */
export type StartMusicRequest = Omit<ChangeMusicRequest, 'looping'>;

/**
 * Create a fresh music system seeded with the supplied options.
 *
 * Every field defaults to the vanilla reference configuration: volume
 * `8`, device `SNDDEVICE_SB` (3), no `D_INTROA` lump available.  The
 * initial volume is validated against `[MUSIC_VOLUME_MIN,
 * MUSIC_VOLUME_MAX]`; supplying an out-of-range value is a
 * programming error and throws `RangeError` (vanilla `I_Error`).
 *
 * @throws {RangeError} If `initialVolume` is outside `[0, 127]` or not
 *   an integer.
 */
export function createMusicSystem(options?: CreateMusicSystemOptions): MusicSystemState {
  const volume = options?.initialVolume ?? DEFAULT_MUSIC_VOLUME;
  validateMusicVolume(volume);
  return {
    musicVolume: volume,
    currentMusicNum: null,
    scheduler: null,
    looping: false,
    paused: false,
    musicDevice: options?.musicDevice ?? SNDDEVICE_SB,
    hasIntroALump: options?.hasIntroALump ?? false,
  };
}

/**
 * Resolve the `mus_intro` → `mus_introa` substitution for OPL music
 * devices when the WAD provides a `D_INTROA` lump.
 *
 * Applies only when `musicNum === MUS_INTRO`, the music device is
 * {@link SNDDEVICE_ADLIB} or {@link SNDDEVICE_SB}, and
 * `system.hasIntroALump` is `true`.  Every other case returns the
 * input unchanged so callers can always pipe through this helper.
 *
 * The substitution is NOT gated on the `NUMMUSIC` range check —
 * vanilla applies it before the validity check, so an out-of-range
 * `MUS_INTRO` value (which cannot happen for well-formed inputs)
 * would still flow through the substitution and fail the check as
 * `MUS_INTROA`.  Defensive callers should validate the input before
 * calling this helper.
 */
export function resolveMusicNumber(system: Readonly<MusicSystemState>, musicNum: number): number {
  if (musicNum !== MUS_INTRO) {
    return musicNum;
  }
  if (!system.hasIntroALump) {
    return musicNum;
  }
  if (system.musicDevice !== SNDDEVICE_ADLIB && system.musicDevice !== SNDDEVICE_SB) {
    return musicNum;
  }
  return MUS_INTROA;
}

/**
 * Change to a new song (or start the first song), mirroring vanilla's
 * `S_ChangeMusic(musicnum, looping)`.
 *
 * Resolves the intro → introa substitution, validates the final
 * `musicNum`, and returns the ordered action list describing the
 * device-side transition.  When the resolved `musicNum` equals the
 * already-registered song the call is a no-op and returns an empty
 * frozen array — matching vanilla's `if (mus_playing == music) return`
 * early-out.
 *
 * Mutates `system` in place to reflect the new song: `currentMusicNum`,
 * `scheduler` (freshly created), `looping`, `paused = false`.  The
 * per-channel velocity cache on the new scheduler is seeded to
 * {@link MUS_DEFAULT_VELOCITY} just like every other
 * {@link createMusScheduler} call.
 *
 * @throws {RangeError} If `musicNum` is not an integer in
 *   `(MUS_NONE, NUMMUSIC)` AFTER the intro→introa substitution.
 */
export function changeMusic(system: MusicSystemState, request: ChangeMusicRequest): readonly MusicDeviceAction[] {
  const resolved = resolveMusicNumber(system, request.musicNum);
  validateMusicNumber(resolved);

  if (system.currentMusicNum === resolved) {
    return Object.freeze<MusicDeviceAction[]>([]);
  }

  const actions: MusicDeviceAction[] = [];

  if (system.currentMusicNum !== null) {
    if (system.paused) {
      actions.push(Object.freeze<MusicResumeSongAction>({ kind: 'resume-song' }));
    }
    actions.push(Object.freeze<MusicStopSongAction>({ kind: 'stop-song', musicNum: system.currentMusicNum }));
  }

  actions.push(
    Object.freeze<MusicPlaySongAction>({
      kind: 'play-song',
      musicNum: resolved,
      score: request.score,
      looping: request.looping,
    }),
  );

  system.currentMusicNum = resolved;
  system.scheduler = createMusScheduler(request.score, { looping: request.looping });
  system.looping = request.looping;
  system.paused = false;

  return Object.freeze(actions);
}

/**
 * Non-looping convenience over {@link changeMusic}, mirroring
 * vanilla's `S_StartMusic(m_id)` which delegates to
 * `S_ChangeMusic(m_id, false)`.
 */
export function startMusic(system: MusicSystemState, request: StartMusicRequest): readonly MusicDeviceAction[] {
  return changeMusic(system, { ...request, looping: false });
}

/**
 * Stop and unregister the current song, mirroring vanilla's
 * `S_StopMusic()`.
 *
 * Returns an empty frozen array when no song is loaded (vanilla's
 * `if (mus_playing)` guard).  When the song is paused, emits a
 * `resume-song` action BEFORE the `stop-song` action — vanilla calls
 * `I_ResumeSong()` before `I_StopSong()` so the device leaves its
 * paused state cleanly.
 *
 * Clears `currentMusicNum`, `scheduler`, `looping`, `paused` on the
 * state.
 */
export function stopMusic(system: MusicSystemState): readonly MusicDeviceAction[] {
  if (system.currentMusicNum === null) {
    return Object.freeze<MusicDeviceAction[]>([]);
  }
  const actions: MusicDeviceAction[] = [];
  if (system.paused) {
    actions.push(Object.freeze<MusicResumeSongAction>({ kind: 'resume-song' }));
  }
  actions.push(Object.freeze<MusicStopSongAction>({ kind: 'stop-song', musicNum: system.currentMusicNum }));
  system.currentMusicNum = null;
  system.scheduler = null;
  system.looping = false;
  system.paused = false;
  return Object.freeze(actions);
}

/**
 * Pause the current song, mirroring vanilla's `S_PauseSound()`.
 *
 * Returns an empty frozen array when no song is loaded or when the
 * song is already paused — vanilla's guard is `if (mus_playing &&
 * !mus_paused)`.  Sets `paused = true` on the state.
 */
export function pauseMusic(system: MusicSystemState): readonly MusicDeviceAction[] {
  if (system.currentMusicNum === null || system.paused) {
    return Object.freeze<MusicDeviceAction[]>([]);
  }
  system.paused = true;
  return Object.freeze<MusicDeviceAction[]>([Object.freeze<MusicPauseSongAction>({ kind: 'pause-song' })]);
}

/**
 * Resume a paused song, mirroring vanilla's `S_ResumeSound()`.
 *
 * Returns an empty frozen array when no song is loaded or when the
 * song is not currently paused — vanilla's guard is `if (mus_playing
 * && mus_paused)`.  Clears `paused` on the state.
 */
export function resumeMusic(system: MusicSystemState): readonly MusicDeviceAction[] {
  if (system.currentMusicNum === null || !system.paused) {
    return Object.freeze<MusicDeviceAction[]>([]);
  }
  system.paused = false;
  return Object.freeze<MusicDeviceAction[]>([Object.freeze<MusicResumeSongAction>({ kind: 'resume-song' })]);
}

/**
 * Update the global music volume, mirroring vanilla's
 * `S_SetMusicVolume(volume)`.
 *
 * Emits a `set-volume` action unconditionally — even when no song is
 * loaded, even when the value matches the prior volume — because
 * vanilla always calls `I_SetMusicVolume` regardless of state.  The
 * device treats `set-volume` as idempotent.
 *
 * @throws {RangeError} If `volume` is not an integer in `[0, 127]`.
 */
export function setMusicVolume(system: MusicSystemState, volume: number): readonly MusicDeviceAction[] {
  validateMusicVolume(volume);
  system.musicVolume = volume;
  return Object.freeze<MusicDeviceAction[]>([Object.freeze<MusicSetVolumeAction>({ kind: 'set-volume', volume })]);
}

/**
 * Report whether a song is loaded (regardless of pause state),
 * mirroring vanilla's `S_MusicPlaying()` → `I_MusicIsPlaying()`.
 *
 * Vanilla semantics: returns `true` if a song has been registered and
 * not yet stopped, whether or not it is paused.  A finished
 * non-looping song also reports `true` until it is explicitly stopped.
 */
export function isMusicPlaying(system: Readonly<MusicSystemState>): boolean {
  return system.currentMusicNum !== null;
}

/**
 * Advance the inner MUS scheduler by `gameTics` 35 Hz game tics and
 * return the dispatched events for the host's MIDI-to-OPL bridge.
 *
 * Each game tic consumes {@link MUS_TICKS_PER_GAME_TIC} (4) MUS
 * quickticks on the scheduler.  When the system has no loaded song or
 * is paused, the call is a no-op and returns an empty frozen array —
 * vanilla's pause halts time on the OPL device, and a port that kept
 * advancing under pause would silently burn through the score.
 *
 * @throws {RangeError} If `gameTics` is not a non-negative integer.
 */
export function advanceMusic(system: MusicSystemState, gameTics: number): readonly DispatchedMusEventEntry[] {
  if (!Number.isInteger(gameTics) || gameTics < 0) {
    throw new RangeError(`advanceMusic: gameTics must be a non-negative integer, got ${gameTics}`);
  }
  if (system.scheduler === null || system.paused) {
    return Object.freeze<DispatchedMusEventEntry[]>([]);
  }
  return advanceMusScheduler(system.scheduler, gameTics * MUS_TICKS_PER_GAME_TIC);
}

function validateMusicVolume(volume: number): void {
  if (!Number.isInteger(volume) || volume < MUSIC_VOLUME_MIN || volume > MUSIC_VOLUME_MAX) {
    throw new RangeError(`music volume must be an integer in [${MUSIC_VOLUME_MIN}, ${MUSIC_VOLUME_MAX}], got ${volume}`);
  }
}

function validateMusicNumber(musicNum: number): void {
  if (!Number.isInteger(musicNum) || musicNum <= MUS_NONE || musicNum >= NUMMUSIC) {
    throw new RangeError(`music number must be an integer in (${MUS_NONE}, ${NUMMUSIC}), got ${musicNum}`);
  }
}
