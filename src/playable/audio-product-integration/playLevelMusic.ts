import type { ChangeMusicRequest, MusicDeviceAction, MusicSystemState } from '../../audio/musicSystem.ts';
import { changeMusic } from '../../audio/musicSystem.ts';

export const LEVEL_MUSIC_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';
export const LEVEL_MUSIC_ENTRY_FILE = 'doom.ts';
export const LEVEL_MUSIC_LOOPING = true;
export const LEVEL_MUSIC_MAPS_PER_EPISODE = 9;
export const LEVEL_MUSIC_MAXIMUM_EPISODE = 3;
export const LEVEL_MUSIC_MINIMUM_EPISODE = 1;
export const LEVEL_MUSIC_RUNTIME_COMMAND = 'bun run doom.ts';

export interface LevelMusicCommandContract {
  readonly entryFile: string;
  readonly runtimeCommand: string;
}

export const LEVEL_MUSIC_COMMAND_CONTRACT: LevelMusicCommandContract = Object.freeze({
  entryFile: LEVEL_MUSIC_ENTRY_FILE,
  runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
});

export type LevelMusicDispatcher = (action: MusicDeviceAction) => void;

export interface LevelMusicSelection {
  readonly mapName: string;
  readonly musicLumpName: string;
  readonly musicNumber: number;
}

export type LevelMusicReplayAction =
  | {
      readonly kind: 'pause-song';
    }
  | {
      readonly kind: 'play-song';
      readonly looping: boolean;
      readonly musicNumber: number;
    }
  | {
      readonly kind: 'resume-song';
    }
  | {
      readonly kind: 'set-volume';
      readonly volume: number;
    }
  | {
      readonly kind: 'stop-song';
      readonly musicNumber: number;
    };

export interface PlayLevelMusicRequest {
  readonly dispatchMusicAction?: LevelMusicDispatcher;
  readonly mapName: string;
  readonly runtimeCommand: string;
  readonly score: ChangeMusicRequest['score'];
  readonly system: MusicSystemState;
}

export interface PlayLevelMusicResult {
  readonly auditManifestPath: string;
  readonly commandContract: LevelMusicCommandContract;
  readonly currentMusicNumber: number | null;
  readonly looping: boolean;
  readonly mapName: string;
  readonly musicLumpName: string;
  readonly musicNumber: number;
  readonly paused: boolean;
  readonly replayActions: readonly LevelMusicReplayAction[];
  readonly replayChecksum: number;
}

const LEVEL_MUSIC_MAP_PATTERN = /^E([1-3])M([1-9])$/i;
const REPLAY_CHECKSUM_OFFSET_BASIS = 0x811c9dc5;
const REPLAY_CHECKSUM_PRIME = 0x01000193;

export function playLevelMusic(request: PlayLevelMusicRequest): PlayLevelMusicResult {
  validateLevelMusicRuntimeCommand(request.runtimeCommand);

  const selection = resolveLevelMusic(request.mapName);
  const musicActions = changeMusic(request.system, {
    looping: LEVEL_MUSIC_LOOPING,
    musicNum: selection.musicNumber,
    score: request.score,
  });

  for (const musicAction of musicActions) {
    request.dispatchMusicAction?.(musicAction);
  }

  const replayActions = Object.freeze(musicActions.map(createLevelMusicReplayAction));

  return Object.freeze({
    auditManifestPath: LEVEL_MUSIC_AUDIT_MANIFEST_PATH,
    commandContract: LEVEL_MUSIC_COMMAND_CONTRACT,
    currentMusicNumber: request.system.currentMusicNum,
    looping: request.system.looping,
    mapName: selection.mapName,
    musicLumpName: selection.musicLumpName,
    musicNumber: selection.musicNumber,
    paused: request.system.paused,
    replayActions,
    replayChecksum: createLevelMusicReplayChecksum({
      currentMusicNumber: request.system.currentMusicNum,
      looping: request.system.looping,
      mapName: selection.mapName,
      musicNumber: selection.musicNumber,
      paused: request.system.paused,
      replayActions,
    }),
  });
}

export function resolveLevelMusic(mapName: string): LevelMusicSelection {
  const normalizedMapName = mapName.trim().toUpperCase();
  const match = LEVEL_MUSIC_MAP_PATTERN.exec(normalizedMapName);

  if (match === null) {
    throw new RangeError(`level music map must be E1M1 through E3M9, got ${mapName}`);
  }

  const episodeText = match[1];
  const mapText = match[2];

  if (episodeText === undefined || mapText === undefined) {
    throw new RangeError(`level music map must be E1M1 through E3M9, got ${mapName}`);
  }

  const episodeNumber = Number.parseInt(episodeText, 10);
  const mapNumber = Number.parseInt(mapText, 10);
  const musicNumber = (episodeNumber - LEVEL_MUSIC_MINIMUM_EPISODE) * LEVEL_MUSIC_MAPS_PER_EPISODE + mapNumber;

  return Object.freeze({
    mapName: normalizedMapName,
    musicLumpName: `D_${normalizedMapName}`,
    musicNumber,
  });
}

export function validateLevelMusicRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== LEVEL_MUSIC_RUNTIME_COMMAND) {
    throw new Error(`play-level-music requires ${LEVEL_MUSIC_RUNTIME_COMMAND}, got ${runtimeCommand}`);
  }
}

function createLevelMusicReplayAction(action: MusicDeviceAction): LevelMusicReplayAction {
  switch (action.kind) {
    case 'pause-song':
      return Object.freeze({ kind: 'pause-song' });
    case 'play-song':
      return Object.freeze({
        kind: 'play-song',
        looping: action.looping,
        musicNumber: action.musicNum,
      });
    case 'resume-song':
      return Object.freeze({ kind: 'resume-song' });
    case 'set-volume':
      return Object.freeze({
        kind: 'set-volume',
        volume: action.volume,
      });
    case 'stop-song':
      return Object.freeze({
        kind: 'stop-song',
        musicNumber: action.musicNum,
      });
  }
}

function createLevelMusicReplayChecksum(input: {
  readonly currentMusicNumber: number | null;
  readonly looping: boolean;
  readonly mapName: string;
  readonly musicNumber: number;
  readonly paused: boolean;
  readonly replayActions: readonly LevelMusicReplayAction[];
}): number {
  const checksumText = JSON.stringify({
    currentMusicNumber: input.currentMusicNumber,
    looping: input.looping,
    mapName: input.mapName,
    musicNumber: input.musicNumber,
    paused: input.paused,
    replayActions: input.replayActions,
  });

  let checksum = REPLAY_CHECKSUM_OFFSET_BASIS;
  for (let characterIndex = 0; characterIndex < checksumText.length; characterIndex += 1) {
    checksum ^= checksumText.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, REPLAY_CHECKSUM_PRIME) >>> 0;
  }
  return checksum;
}
