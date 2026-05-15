/**
 * Vanilla DOOM 1.9 MUS + OPL synth runtime.
 *
 * Plan_final step `11-006` (lane: audio) wires the MUS lump parsing
 * (vanilla `Mus_LoadSong`), the per-tic MUS event scheduler
 * (`Mus_GetEventsSinceLastTic`), the OPL synth primitives
 * (phase increment, waveform sample, total-level gain, operator
 * combiner from Chocolate Doom 2.2.1 `opl_queue.c` /
 * `i_oplmusic.c`), and the `musicSystem` start/stop/pause/resume/
 * change action machine into a single frozen runtime façade the
 * launch sequence + the per-tic main loop consume.
 *
 * The wrapper imports the read-only primitives without modifying
 * them.  The actual OPL register writes (FM hardware register
 * 0x20..0xC0 ranges) are driven by the synth helpers exposed here,
 * combined with the per-tic MUS event stream produced by the
 * scheduler.  The runtime façade exposes:
 *
 *   - `parseMus(lumpBytes)` — re-export of {@link parseMusScore}.
 *   - `createScheduler(score, options?)` — wrapper over
 *     {@link createMusScheduler}.
 *   - `advanceScheduler(state, quickticks)` — wrapper over
 *     {@link advanceMusScheduler}.
 *   - `createMusicSystem(options?)` — wrapper over
 *     {@link createMusicSystem}.
 *   - The full `musicSystem` action surface (start/stop/pause/resume/
 *     change/setVolume/advance/isPlaying).
 *
 * The runtime artifact does not allocate any state of its own
 * besides re-exporting the read-only primitives behind a frozen
 * façade.  The actual OPL hardware register writes happen inside
 * the OPL emulator the launch sequence wires later; this step
 * exposes the building blocks.
 *
 * @example
 * ```ts
 * import { createMusOplRuntime } from './musOplRuntime.ts';
 *
 * const audio = createMusOplRuntime();
 * const score = audio.parseMus(lumpBytes);
 * const scheduler = audio.createScheduler(score);
 * const events = audio.advanceScheduler(scheduler, 700);
 * ```
 */

import { advanceMusScheduler, createMusScheduler, type CreateMusSchedulerOptions, type DispatchedMusEventEntry, type MusSchedulerState } from '../audio/musScheduler.ts';
import {
  advanceMusic,
  changeMusic,
  createMusicSystem,
  type ChangeMusicRequest,
  type CreateMusicSystemOptions,
  type MusicDeviceAction,
  type MusicSystemState,
  type StartMusicRequest,
  isMusicPlaying,
  pauseMusic,
  resolveMusicNumber,
  resumeMusic,
  setMusicVolume,
  startMusic,
  stopMusic,
} from '../audio/musicSystem.ts';
import { parseMusScore, type MusScore } from '../audio/musParser.ts';
import { combineOperators, computePhaseIncrement, computeTotalLevelGain, computeWaveformSample } from '../audio/oplSynth.ts';

/**
 * Frozen runtime façade carrying the MUS parser, the per-tic
 * scheduler, the OPL synth primitives, and the musicSystem action
 * machine.  Every method is a thin pass-through onto the
 * corresponding read-only helper.
 */
export interface MusOplRuntime {
  readonly advanceMusic: (system: MusicSystemState, gameTics: number) => readonly DispatchedMusEventEntry[];
  readonly advanceScheduler: (state: MusSchedulerState, quickticks: number) => readonly DispatchedMusEventEntry[];
  readonly changeMusic: (system: MusicSystemState, request: ChangeMusicRequest) => readonly MusicDeviceAction[];
  readonly combineOperators: (modulatorSample: number, carrierSample: number, algorithm: number) => number;
  readonly computePhaseIncrement: (fNumber: number, block: number, multiplierCode: number) => number;
  readonly computeTotalLevelGain: (tl: number) => number;
  readonly computeWaveformSample: (phase: number, waveform: number) => number;
  readonly createMusicSystem: (options?: CreateMusicSystemOptions) => MusicSystemState;
  readonly createScheduler: (score: Readonly<MusScore>, options?: CreateMusSchedulerOptions) => MusSchedulerState;
  readonly isMusicPlaying: (system: Readonly<MusicSystemState>) => boolean;
  readonly parseMus: (lumpBytes: Buffer) => Readonly<MusScore>;
  readonly pauseMusic: (system: MusicSystemState) => readonly MusicDeviceAction[];
  readonly resolveMusicNumber: (system: Readonly<MusicSystemState>, musicNum: number) => number;
  readonly resumeMusic: (system: MusicSystemState) => readonly MusicDeviceAction[];
  readonly setMusicVolume: (system: MusicSystemState, volume: number) => readonly MusicDeviceAction[];
  readonly startMusic: (system: MusicSystemState, request: StartMusicRequest) => readonly MusicDeviceAction[];
  readonly stopMusic: (system: MusicSystemState) => readonly MusicDeviceAction[];
}

/**
 * Build a fresh frozen {@link MusOplRuntime} façade.  Every method
 * is a thin pass-through onto the read-only audio primitives; no
 * additional state is allocated.  The façade is frozen so
 * downstream subsystems cannot replace the method references.
 */
export function createMusOplRuntime(): MusOplRuntime {
  return Object.freeze({
    advanceMusic: (system: MusicSystemState, gameTics: number): readonly DispatchedMusEventEntry[] => advanceMusic(system, gameTics),
    advanceScheduler: (state: MusSchedulerState, quickticks: number): readonly DispatchedMusEventEntry[] => advanceMusScheduler(state, quickticks),
    changeMusic: (system: MusicSystemState, request: ChangeMusicRequest): readonly MusicDeviceAction[] => changeMusic(system, request),
    combineOperators: (modulatorSample: number, carrierSample: number, algorithm: number): number => combineOperators(modulatorSample, carrierSample, algorithm),
    computePhaseIncrement: (fNumber: number, block: number, multiplierCode: number): number => computePhaseIncrement(fNumber, block, multiplierCode),
    computeTotalLevelGain: (tl: number): number => computeTotalLevelGain(tl),
    computeWaveformSample: (phase: number, waveform: number): number => computeWaveformSample(phase, waveform),
    createMusicSystem: (options?: CreateMusicSystemOptions): MusicSystemState => createMusicSystem(options),
    createScheduler: (score: Readonly<MusScore>, options?: CreateMusSchedulerOptions): MusSchedulerState => createMusScheduler(score, options),
    isMusicPlaying: (system: Readonly<MusicSystemState>): boolean => isMusicPlaying(system),
    parseMus: (lumpBytes: Buffer): Readonly<MusScore> => parseMusScore(lumpBytes),
    pauseMusic: (system: MusicSystemState): readonly MusicDeviceAction[] => pauseMusic(system),
    resolveMusicNumber: (system: Readonly<MusicSystemState>, musicNum: number): number => resolveMusicNumber(system, musicNum),
    resumeMusic: (system: MusicSystemState): readonly MusicDeviceAction[] => resumeMusic(system),
    setMusicVolume: (system: MusicSystemState, volume: number): readonly MusicDeviceAction[] => setMusicVolume(system, volume),
    startMusic: (system: MusicSystemState, request: StartMusicRequest): readonly MusicDeviceAction[] => startMusic(system, request),
    stopMusic: (system: MusicSystemState): readonly MusicDeviceAction[] => stopMusic(system),
  });
}
