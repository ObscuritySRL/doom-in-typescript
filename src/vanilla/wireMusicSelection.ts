/**
 * Vanilla DOOM 1.9 per-game-state music-selection facade.
 *
 * Plan_final step `11-007` (lane: audio) wires which song plays in
 * each game state — the title/demo page loop, the active level, the
 * intermission, the finale, the paused game, and the music-volume
 * control — onto the read-only `src/audio/musicSystem.ts` engine
 * (the `S_ChangeMusic` / `S_StartMusic` / `S_StopMusic` /
 * `S_PauseSound` / `S_ResumeSound` / `S_SetMusicVolume` port) plus
 * the per-state music cues the UI modules already resolve.
 *
 * The read-only `src/audio/musicSystem.ts`,
 * `src/ui/frontEndSequence.ts` (title/demo `ShowPageTickAction.musicLump`),
 * `src/ui/intermission.ts` (`IntermissionMusicCue`), and
 * `src/ui/finale.ts` (`FinaleMusicCue`) already implement the
 * per-piece behavior byte-for-byte and are SHA-pinned by the
 * inventory; this module does NOT modify them.  It is a pure
 * re-export barrel (split value/type for `verbatimModuleSyntax`, no
 * `const enum` re-exports) plus a frozen invariants manifest.
 *
 * Six parity invariants this step pins:
 *
 *   1. The title/demo page music is whatever the front-end
 *      `ShowPageTickAction.musicLump` carries for the current page
 *      (e.g. `D_INTRO` under TITLEPIC) — the page loop owns it.
 *   2. Level music: `S_ChangeMusic` resolves `MUS_INTRO → MUS_INTROA`
 *      only on an OPL device (ADLIB/SB) when the WAD ships
 *      `D_INTROA`; every other song passes through unchanged and is
 *      range-checked against `(MUS_NONE, NUMMUSIC)`.
 *   3. Intermission music is the Doom-1 `mus_inter` cue; the
 *      commercial `mus_dm2int` cue is not emitted on the C1 target.
 *   4. Finale music is `mus_victor`, swapping to `mus_bunny` on the
 *      episode-3 bunny scroll (`mus_read_m` is the Doom-2 finale).
 *   5. Pause halts the song (`pauseMusic` → `pause-song`, no-op when
 *      no song or already paused) and resume restores it
 *      (`resumeMusic` → `resume-song`, guarded by `paused`).
 *   6. Music volume is an integer in `[MUSIC_VOLUME_MIN,
 *      MUSIC_VOLUME_MAX]` = `[0, 127]`, default `DEFAULT_MUSIC_VOLUME`
 *      = 8; `setMusicVolume` rejects out-of-range with a RangeError
 *      and always emits a `set-volume` action.
 *
 * @example
 * ```ts
 * import { createMusicSystem, setMusicVolume, VANILLA_MUSIC_SELECTION_INVARIANTS } from './wireMusicSelection.ts';
 * const system = createMusicSystem();
 * setMusicVolume(system, 64);                       // [{ kind: 'set-volume', volume: 64 }]
 * VANILLA_MUSIC_SELECTION_INVARIANTS.length;        // 6
 * ```
 */

export {
  DEFAULT_MUSIC_VOLUME,
  MUS_INTRO,
  MUS_INTROA,
  MUS_NONE,
  MUSIC_VOLUME_MAX,
  MUSIC_VOLUME_MIN,
  NUMMUSIC,
  SNDDEVICE_ADLIB,
  SNDDEVICE_AWE32,
  SNDDEVICE_GENMIDI,
  SNDDEVICE_GUS,
  SNDDEVICE_NONE,
  SNDDEVICE_PAS,
  SNDDEVICE_PCSPEAKER,
  SNDDEVICE_SB,
  SNDDEVICE_SOUNDCANVAS,
  SNDDEVICE_WAVEBLASTER,
  advanceMusic,
  changeMusic,
  createMusicSystem,
  isMusicPlaying,
  pauseMusic,
  resolveMusicNumber,
  resumeMusic,
  setMusicVolume,
  startMusic,
  stopMusic,
} from '../audio/musicSystem.ts';
export type {
  ChangeMusicRequest,
  CreateMusicSystemOptions,
  MusicDeviceAction,
  MusicPauseSongAction,
  MusicPlaySongAction,
  MusicResumeSongAction,
  MusicSetVolumeAction,
  MusicStopSongAction,
  MusicSystemState,
  StartMusicRequest,
} from '../audio/musicSystem.ts';
export type { ShowPageTickAction } from '../ui/frontEndSequence.ts';
export type { IntermissionMusicCue } from '../ui/intermission.ts';
export type { FinaleMusicCue } from '../ui/finale.ts';

/**
 * One pinned per-game-state music-selection parity invariant.
 */
export interface VanillaMusicSelectionInvariant {
  readonly id:
    | 'FINALE_USES_VICTOR_THEN_BUNNY_ON_EPISODE_3'
    | 'INTERMISSION_USES_MUS_INTER_FOR_DOOM1'
    | 'LEVEL_MUSIC_RESOLVES_INTRO_TO_INTROA_ON_OPL'
    | 'MUSIC_VOLUME_INTEGER_0_127_DEFAULT_8'
    | 'PAUSE_HALTS_MUSIC_AND_RESUME_RESTORES_IT'
    | 'TITLE_DEMO_PAGE_MUSIC_DRIVEN_BY_SHOWPAGE_ACTION';
  readonly rule: string;
}

/**
 * Frozen manifest of the six per-game-state music-selection parity
 * invariants this step pins.  A later step that wires the music
 * engine into the live game-state loop must preserve all six.
 */
export const VANILLA_MUSIC_SELECTION_INVARIANTS: readonly VanillaMusicSelectionInvariant[] = Object.freeze([
  Object.freeze({
    id: 'FINALE_USES_VICTOR_THEN_BUNNY_ON_EPISODE_3',
    rule: 'The finale plays mus_victor and swaps to mus_bunny on the episode-3 bunny-scroll artscreen transition; mus_read_m is the Doom-2 commercial finale cue (FinaleMusicCue).',
  } satisfies VanillaMusicSelectionInvariant),
  Object.freeze({
    id: 'INTERMISSION_USES_MUS_INTER_FOR_DOOM1',
    rule: 'The intermission emits the IntermissionMusicCue mus_inter on bcnt === 1; the commercial mus_dm2int cue is not emitted on the C1 shareware/registered target.',
  } satisfies VanillaMusicSelectionInvariant),
  Object.freeze({
    id: 'LEVEL_MUSIC_RESOLVES_INTRO_TO_INTROA_ON_OPL',
    rule: 'S_ChangeMusic resolves MUS_INTRO to MUS_INTROA only on an OPL device (SNDDEVICE_ADLIB or SNDDEVICE_SB) when the WAD ships D_INTROA; all other songs pass through unchanged and are range-checked against (MUS_NONE, NUMMUSIC).',
  } satisfies VanillaMusicSelectionInvariant),
  Object.freeze({
    id: 'MUSIC_VOLUME_INTEGER_0_127_DEFAULT_8',
    rule: 'Music volume is an integer in [MUSIC_VOLUME_MIN, MUSIC_VOLUME_MAX] = [0, 127] with DEFAULT_MUSIC_VOLUME = 8; setMusicVolume rejects out-of-range values with a RangeError and always emits a set-volume action.',
  } satisfies VanillaMusicSelectionInvariant),
  Object.freeze({
    id: 'PAUSE_HALTS_MUSIC_AND_RESUME_RESTORES_IT',
    rule: 'pauseMusic emits pause-song and sets paused (no-op when no song or already paused); resumeMusic emits resume-song guarded by paused; advanceMusic is a no-op while paused so the score does not burn under pause.',
  } satisfies VanillaMusicSelectionInvariant),
  Object.freeze({
    id: 'TITLE_DEMO_PAGE_MUSIC_DRIVEN_BY_SHOWPAGE_ACTION',
    rule: 'The title/demo page loop owns its music: the front-end ShowPageTickAction.musicLump carries the page song (e.g. D_INTRO under TITLEPIC); the music engine plays whatever lump the page action names.',
  } satisfies VanillaMusicSelectionInvariant),
]);
