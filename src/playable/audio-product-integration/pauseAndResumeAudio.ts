import type { MusicDeviceAction, MusicSystemState } from '../../audio/musicSystem.ts';
import { pauseMusic, resumeMusic } from '../../audio/musicSystem.ts';

export const PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND = 'bun run doom.ts';

export type PauseAndResumeAudioMusicActionKind = MusicDeviceAction['kind'];
export type PauseAndResumeAudioSoundEffectPolicy = 'unchanged';
export type PauseAndResumeAudioTransition = 'pause' | 'resume';

export interface PauseAndResumeAudioRequest {
  readonly dispatchMusicAction?: (action: MusicDeviceAction) => void;
  readonly musicSystem: MusicSystemState;
  readonly runtimeCommand: string;
  readonly transition: PauseAndResumeAudioTransition;
}

export interface PauseAndResumeAudioEvidence {
  readonly dispatchedMusicActionCount: number;
  readonly musicActionKinds: readonly PauseAndResumeAudioMusicActionKind[];
  readonly musicLoadedAfter: boolean;
  readonly musicLoadedBefore: boolean;
  readonly musicPausedAfter: boolean;
  readonly musicPausedBefore: boolean;
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly runtimeCommand: typeof PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND;
  readonly soundEffectPolicy: PauseAndResumeAudioSoundEffectPolicy;
  readonly transition: PauseAndResumeAudioTransition;
}

/**
 * Pause or resume the live music device path while preserving
 * deterministic replay evidence.
 *
 * @example
 * ```ts
 * import { createMusicSystem } from '../../audio/musicSystem.ts';
 * import { pauseAndResumeAudio } from './pauseAndResumeAudio.ts';
 *
 * const musicSystem = createMusicSystem();
 * musicSystem.currentMusicNum = 1;
 * pauseAndResumeAudio({
 *   musicSystem,
 *   runtimeCommand: 'bun run doom.ts',
 *   transition: 'pause',
 * });
 * ```
 */
export function pauseAndResumeAudio(request: PauseAndResumeAudioRequest): PauseAndResumeAudioEvidence {
  const { dispatchMusicAction, musicSystem, runtimeCommand, transition } = request;

  if (runtimeCommand !== PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND) {
    throw new RangeError(`pauseAndResumeAudio requires ${PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND}, got ${runtimeCommand}`);
  }

  const musicLoadedBefore = musicSystem.currentMusicNum !== null;
  const musicPausedBefore = musicSystem.paused;
  let musicActions: readonly MusicDeviceAction[];

  switch (transition) {
    case 'pause':
      musicActions = pauseMusic(musicSystem);
      break;
    case 'resume':
      musicActions = resumeMusic(musicSystem);
      break;
  }

  const musicActionKinds: PauseAndResumeAudioMusicActionKind[] = [];
  for (const musicAction of musicActions) {
    musicActionKinds.push(musicAction.kind);
    if (dispatchMusicAction !== undefined) {
      dispatchMusicAction(musicAction);
    }
  }

  const frozenMusicActionKinds = Object.freeze(musicActionKinds);
  const musicLoadedAfter = musicSystem.currentMusicNum !== null;
  const musicPausedAfter = musicSystem.paused;
  const replaySignature = [
    `runtimeCommand=${PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND}`,
    `transition=${transition}`,
    `musicLoadedBefore=${musicLoadedBefore ? 1 : 0}`,
    `musicLoadedAfter=${musicLoadedAfter ? 1 : 0}`,
    `musicPausedBefore=${musicPausedBefore ? 1 : 0}`,
    `musicPausedAfter=${musicPausedAfter ? 1 : 0}`,
    `musicActionKinds=${frozenMusicActionKinds.length === 0 ? 'none' : frozenMusicActionKinds.join(',')}`,
    'soundEffectPolicy=unchanged',
  ].join('|');
  let replayChecksum = 2_166_136_261;

  for (let characterIndex = 0; characterIndex < replaySignature.length; characterIndex += 1) {
    replayChecksum ^= replaySignature.charCodeAt(characterIndex);
    replayChecksum = Math.imul(replayChecksum, 16_777_619) >>> 0;
  }

  return Object.freeze({
    dispatchedMusicActionCount: frozenMusicActionKinds.length,
    musicActionKinds: frozenMusicActionKinds,
    musicLoadedAfter,
    musicLoadedBefore,
    musicPausedAfter,
    musicPausedBefore,
    replayChecksum,
    replaySignature,
    runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
    soundEffectPolicy: 'unchanged',
    transition,
  });
}
