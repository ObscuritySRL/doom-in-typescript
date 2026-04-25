import { MUSIC_VOLUME_MAX, MUSIC_VOLUME_MIN, MUS_NONE, NUMMUSIC } from '../../audio/musicSystem.ts';

export const CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND = 'bun run doom.ts';

export interface ConnectMusicSystemPauseSongAction {
  readonly kind: 'pause-song';
}

export interface ConnectMusicSystemPlaySongAction {
  readonly kind: 'play-song';
  readonly looping: boolean;
  readonly musicNum: number;
  readonly score: unknown;
}

export interface ConnectMusicSystemResumeSongAction {
  readonly kind: 'resume-song';
}

export interface ConnectMusicSystemSetVolumeAction {
  readonly kind: 'set-volume';
  readonly volume: number;
}

export interface ConnectMusicSystemStopSongAction {
  readonly kind: 'stop-song';
  readonly musicNum: number;
}

export type ConnectMusicSystemAction = ConnectMusicSystemPauseSongAction | ConnectMusicSystemPlaySongAction | ConnectMusicSystemResumeSongAction | ConnectMusicSystemSetVolumeAction | ConnectMusicSystemStopSongAction;

export interface ConnectMusicSystemPauseSongReplayEvidence {
  readonly kind: 'pause-song';
  readonly ordinal: number;
}

export interface ConnectMusicSystemPlaySongReplayEvidence {
  readonly kind: 'play-song';
  readonly looping: boolean;
  readonly musicNum: number;
  readonly ordinal: number;
}

export interface ConnectMusicSystemResumeSongReplayEvidence {
  readonly kind: 'resume-song';
  readonly ordinal: number;
}

export interface ConnectMusicSystemSetVolumeReplayEvidence {
  readonly kind: 'set-volume';
  readonly ordinal: number;
  readonly volume: number;
}

export interface ConnectMusicSystemStopSongReplayEvidence {
  readonly kind: 'stop-song';
  readonly musicNum: number;
  readonly ordinal: number;
}

export type ConnectMusicSystemReplayEvidence =
  | ConnectMusicSystemPauseSongReplayEvidence
  | ConnectMusicSystemPlaySongReplayEvidence
  | ConnectMusicSystemResumeSongReplayEvidence
  | ConnectMusicSystemSetVolumeReplayEvidence
  | ConnectMusicSystemStopSongReplayEvidence;

export interface ConnectMusicSystemRequest {
  readonly actions: readonly unknown[];
  readonly dispatchMusicAction: (action: ConnectMusicSystemAction) => void;
  readonly runtimeCommand: string;
}

export interface ConnectMusicSystemResult {
  readonly dispatchedActionCount: number;
  readonly replayChecksum: number;
  readonly replayEvidence: readonly ConnectMusicSystemReplayEvidence[];
  readonly runtimeCommand: string;
}

export function connectMusicSystem(request: ConnectMusicSystemRequest): ConnectMusicSystemResult {
  if (request.runtimeCommand !== CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND) {
    throw new Error(`connectMusicSystem requires ${CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND}`);
  }

  const actions: ConnectMusicSystemAction[] = [];
  for (let actionIndex = 0; actionIndex < request.actions.length; actionIndex += 1) {
    actions.push(normalizeMusicAction(request.actions[actionIndex], actionIndex));
  }

  const replayEvidence = Object.freeze(actions.map(createReplayEvidence));

  for (const action of actions) {
    request.dispatchMusicAction(action);
  }

  return Object.freeze({
    dispatchedActionCount: actions.length,
    replayChecksum: checksumText(JSON.stringify(replayEvidence)),
    replayEvidence,
    runtimeCommand: request.runtimeCommand,
  });
}

function checksumText(text: string): number {
  let checksum = 0x811c9dc5;
  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    checksum = Math.imul(checksum ^ text.charCodeAt(characterIndex), 0x01000193) >>> 0;
  }
  return checksum;
}

function createReplayEvidence(action: ConnectMusicSystemAction, actionIndex: number): ConnectMusicSystemReplayEvidence {
  switch (action.kind) {
    case 'pause-song':
      return Object.freeze({
        kind: action.kind,
        ordinal: actionIndex,
      });
    case 'play-song':
      return Object.freeze({
        kind: action.kind,
        looping: action.looping,
        musicNum: action.musicNum,
        ordinal: actionIndex,
      });
    case 'resume-song':
      return Object.freeze({
        kind: action.kind,
        ordinal: actionIndex,
      });
    case 'set-volume':
      return Object.freeze({
        kind: action.kind,
        ordinal: actionIndex,
        volume: action.volume,
      });
    case 'stop-song':
      return Object.freeze({
        kind: action.kind,
        musicNum: action.musicNum,
        ordinal: actionIndex,
      });
  }
}

function normalizeMusicAction(action: unknown, actionIndex: number): ConnectMusicSystemAction {
  const actionRecord = requireActionRecord(action, actionIndex);
  const kind = requireProperty(actionRecord, 'kind', actionIndex);

  switch (kind) {
    case 'pause-song':
      return Object.freeze({
        kind,
      });
    case 'play-song':
      return Object.freeze({
        kind,
        looping: requireBooleanProperty(actionRecord, 'looping', actionIndex),
        musicNum: requireMusicNumberProperty(actionRecord, 'musicNum', actionIndex),
        score: requireProperty(actionRecord, 'score', actionIndex),
      });
    case 'resume-song':
      return Object.freeze({
        kind,
      });
    case 'set-volume':
      return Object.freeze({
        kind,
        volume: requireMusicVolumeProperty(actionRecord, 'volume', actionIndex),
      });
    case 'stop-song':
      return Object.freeze({
        kind,
        musicNum: requireMusicNumberProperty(actionRecord, 'musicNum', actionIndex),
      });
    default:
      throw new TypeError(`music action ${actionIndex} has unsupported kind ${String(kind)}`);
  }
}

function requireActionRecord(action: unknown, actionIndex: number): object {
  if (typeof action !== 'object' || action === null || Array.isArray(action)) {
    throw new TypeError(`music action ${actionIndex} must be an object`);
  }
  return action;
}

function requireBooleanProperty(actionRecord: object, propertyName: string, actionIndex: number): boolean {
  const value = requireProperty(actionRecord, propertyName, actionIndex);
  if (typeof value !== 'boolean') {
    throw new TypeError(`music action ${actionIndex} property ${propertyName} must be a boolean`);
  }
  return value;
}

function requireMusicNumberProperty(actionRecord: object, propertyName: string, actionIndex: number): number {
  const value = requireProperty(actionRecord, propertyName, actionIndex);
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= MUS_NONE || value >= NUMMUSIC) {
    throw new RangeError(`music action ${actionIndex} property ${propertyName} must be an integer in (${MUS_NONE}, ${NUMMUSIC})`);
  }
  return value;
}

function requireMusicVolumeProperty(actionRecord: object, propertyName: string, actionIndex: number): number {
  const value = requireProperty(actionRecord, propertyName, actionIndex);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MUSIC_VOLUME_MIN || value > MUSIC_VOLUME_MAX) {
    throw new RangeError(`music action ${actionIndex} property ${propertyName} must be an integer in [${MUSIC_VOLUME_MIN}, ${MUSIC_VOLUME_MAX}]`);
  }
  return value;
}

function requireProperty(actionRecord: object, propertyName: string, actionIndex: number): unknown {
  if (!Object.hasOwn(actionRecord, propertyName)) {
    throw new TypeError(`music action ${actionIndex} is missing ${propertyName}`);
  }
  return Reflect.get(actionRecord, propertyName);
}
