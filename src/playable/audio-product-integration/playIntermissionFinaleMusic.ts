import type { ChangeMusicRequest, MusicDeviceAction, MusicSystemState } from '../../audio/musicSystem.ts';
import { changeMusic } from '../../audio/musicSystem.ts';

export const PLAY_INTERMISSION_FINALE_MUSIC_AUDIT_STEP_ID = '01-011';
export const PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND = 'bun run doom.ts';

export const FINALE_BUNNY_MUSIC_NUMBER = 30;
export const FINALE_VICTORY_MUSIC_NUMBER = 31;
export const INTERMISSION_MUSIC_NUMBER = 28;

export type IntermissionFinaleMusicLumpName = 'D_BUNNY' | 'D_INTER' | 'D_VICTOR';
export type IntermissionFinaleMusicScene = 'finale-bunny' | 'finale-victory' | 'intermission';

export interface IntermissionFinaleMusicRoute {
  readonly looping: boolean;
  readonly musicLumpName: IntermissionFinaleMusicLumpName;
  readonly musicNumber: number;
  readonly scene: IntermissionFinaleMusicScene;
}

export interface PlayIntermissionFinaleMusicEvidence {
  readonly actionSignatures: readonly string[];
  readonly auditStepId: typeof PLAY_INTERMISSION_FINALE_MUSIC_AUDIT_STEP_ID;
  readonly currentMusicNumber: number | null;
  readonly dispatchedActionCount: number;
  readonly handleFree: true;
  readonly looping: boolean;
  readonly musicLumpName: IntermissionFinaleMusicLumpName;
  readonly musicNumber: number;
  readonly paused: boolean;
  readonly replayChecksum: number;
  readonly runtimeCommand: typeof PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND;
  readonly scene: IntermissionFinaleMusicScene;
  readonly transitionSignature: string;
}

export type PlayIntermissionFinaleMusicDispatcher = (action: Readonly<MusicDeviceAction>) => void;

export interface PlayIntermissionFinaleMusicRequest {
  readonly dispatchMusicDeviceAction?: PlayIntermissionFinaleMusicDispatcher;
  readonly runtimeCommand: string;
  readonly scene: IntermissionFinaleMusicScene;
  readonly score: ChangeMusicRequest['score'];
  readonly system: MusicSystemState;
}

const CHECKSUM_INITIAL_VALUE = 0x811c9dc5;
const CHECKSUM_MULTIPLIER = 0x01000193;

const FINALE_BUNNY_ROUTE = Object.freeze<IntermissionFinaleMusicRoute>({
  looping: true,
  musicLumpName: 'D_BUNNY',
  musicNumber: FINALE_BUNNY_MUSIC_NUMBER,
  scene: 'finale-bunny',
});

const FINALE_VICTORY_ROUTE = Object.freeze<IntermissionFinaleMusicRoute>({
  looping: true,
  musicLumpName: 'D_VICTOR',
  musicNumber: FINALE_VICTORY_MUSIC_NUMBER,
  scene: 'finale-victory',
});

const INTERMISSION_ROUTE = Object.freeze<IntermissionFinaleMusicRoute>({
  looping: true,
  musicLumpName: 'D_INTER',
  musicNumber: INTERMISSION_MUSIC_NUMBER,
  scene: 'intermission',
});

/**
 * Resolve the vanilla music number/lump pair for product intermission
 * and finale scenes.
 */
export function resolveIntermissionFinaleMusicRoute(scene: IntermissionFinaleMusicScene): IntermissionFinaleMusicRoute {
  switch (scene) {
    case 'finale-bunny':
      return FINALE_BUNNY_ROUTE;
    case 'finale-victory':
      return FINALE_VICTORY_ROUTE;
    case 'intermission':
      return INTERMISSION_ROUTE;
  }
}

/**
 * Start intermission or finale music through the Bun playable command
 * path and return deterministic, handle-free transition evidence.
 *
 * @param request - Music system, MUS score, runtime command, scene,
 * and optional live dispatcher.
 * @returns Frozen replay evidence for the music transition.
 *
 * @example
 * ```ts
 * const evidence = playIntermissionFinaleMusic({
 *   runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
 *   scene: "intermission",
 *   score,
 *   system,
 * });
 * ```
 */
export function playIntermissionFinaleMusic(request: PlayIntermissionFinaleMusicRequest): PlayIntermissionFinaleMusicEvidence {
  assertProductRuntimeCommand(request.runtimeCommand);

  const route = resolveIntermissionFinaleMusicRoute(request.scene);
  const actions = changeMusic(request.system, {
    looping: route.looping,
    musicNum: route.musicNumber,
    score: request.score,
  });
  const actionSignatures = Object.freeze(actions.map(createMusicDeviceActionSignature));

  for (const action of actions) {
    assertReplaySafeMusicAction(action);
  }

  if (request.dispatchMusicDeviceAction !== undefined) {
    for (const action of actions) {
      request.dispatchMusicDeviceAction(action);
    }
  }

  const transitionSignature = createTransitionSignature(route, actionSignatures, request.system);

  return Object.freeze({
    actionSignatures,
    auditStepId: PLAY_INTERMISSION_FINALE_MUSIC_AUDIT_STEP_ID,
    currentMusicNumber: request.system.currentMusicNum,
    dispatchedActionCount: actions.length,
    handleFree: true,
    looping: route.looping,
    musicLumpName: route.musicLumpName,
    musicNumber: route.musicNumber,
    paused: request.system.paused,
    replayChecksum: computeReplayChecksum(transitionSignature),
    runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
    scene: route.scene,
    transitionSignature,
  });
}

function assertProductRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND) {
    throw new Error(`playIntermissionFinaleMusic requires ${PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND}`);
  }
}

function assertReplaySafeMusicAction(action: MusicDeviceAction): void {
  switch (action.kind) {
    case 'pause-song':
    case 'resume-song':
      return;
    case 'play-song':
      if (!Number.isInteger(action.musicNum) || typeof action.looping !== 'boolean') {
        throw new TypeError(`invalid play-song action for deterministic replay`);
      }
      return;
    case 'set-volume':
      if (!Number.isInteger(action.volume)) {
        throw new TypeError(`invalid set-volume action for deterministic replay`);
      }
      return;
    case 'stop-song':
      if (!Number.isInteger(action.musicNum)) {
        throw new TypeError(`invalid stop-song action for deterministic replay`);
      }
      return;
  }
}

function computeReplayChecksum(signature: string): number {
  let checksum = CHECKSUM_INITIAL_VALUE;
  for (let characterIndex = 0; characterIndex < signature.length; characterIndex += 1) {
    checksum ^= signature.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, CHECKSUM_MULTIPLIER) >>> 0;
  }
  return checksum >>> 0;
}

function createMusicDeviceActionSignature(action: MusicDeviceAction): string {
  switch (action.kind) {
    case 'pause-song':
      return 'pause-song';
    case 'play-song':
      return `play-song:${action.musicNum}:${action.looping ? 'looping' : 'once'}`;
    case 'resume-song':
      return 'resume-song';
    case 'set-volume':
      return `set-volume:${action.volume}`;
    case 'stop-song':
      return `stop-song:${action.musicNum}`;
  }
}

function createTransitionSignature(route: IntermissionFinaleMusicRoute, actionSignatures: readonly string[], system: Readonly<MusicSystemState>): string {
  return [
    `scene=${route.scene}`,
    `lump=${route.musicLumpName}`,
    `music=${route.musicNumber}`,
    `looping=${route.looping ? 'looping' : 'once'}`,
    `actions=${actionSignatures.join(',')}`,
    `current=${system.currentMusicNum ?? 'none'}`,
    `paused=${system.paused}`,
  ].join('|');
}
