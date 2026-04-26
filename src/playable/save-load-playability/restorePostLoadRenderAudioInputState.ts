import type { SaveGameHeader } from '../../save/saveHeader.ts';

import { SAVEGAME_EOF } from '../../save/loadgame.ts';
import { SAVEGAME_VERSION_TEXT } from '../../save/saveHeader.ts';

export const RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_RUNTIME_COMMAND = 'bun run doom.ts';

export interface RestorePostLoadRenderAudioInputStateAudioState {
  readonly activeMusic: string | null;
  readonly loopMusic: boolean;
  readonly pendingSoundEffectsCleared: boolean;
  readonly resumeAudio: boolean;
}

export interface RestorePostLoadRenderAudioInputStateCommandContract {
  readonly entryFile: string;
  readonly program: string;
  readonly runtimeCommand: string;
  readonly subcommand: string;
}

export interface RestorePostLoadRenderAudioInputStateInputState {
  readonly heldKeysCleared: boolean;
  readonly horizontalMouseDelta: number;
  readonly mouseButtonsCleared: boolean;
  readonly pendingEventsCleared: boolean;
  readonly verticalMouseDelta: number;
}

export interface RestorePostLoadRenderAudioInputStateOptions {
  readonly command: string;
  readonly header: SaveGameHeader | null;
}

export interface RestorePostLoadRenderAudioInputStateRenderState {
  readonly automapStateCleared: boolean;
  readonly fullFrameRefreshRequired: boolean;
  readonly paletteIndex: number;
  readonly statusBarRefreshRequired: boolean;
  readonly viewMode: string | null;
}

export interface RestorePostLoadRenderAudioInputStateResult {
  readonly audioState: RestorePostLoadRenderAudioInputStateAudioState;
  readonly commandContract: RestorePostLoadRenderAudioInputStateCommandContract;
  readonly headerDescription: string | null;
  readonly inputState: RestorePostLoadRenderAudioInputStateInputState;
  readonly renderState: RestorePostLoadRenderAudioInputStateRenderState;
  readonly replayChecksum: number;
  readonly restoreAccepted: boolean;
  readonly transition: RestorePostLoadRenderAudioInputStateTransition;
  readonly transitionSignature: string;
}

export type RestorePostLoadRenderAudioInputStateTransition = 'restored' | 'skipped';

export const RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT: RestorePostLoadRenderAudioInputStateCommandContract = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_RUNTIME_COMMAND,
  subcommand: 'run',
});

function assertRuntimeCommand(command: string): void {
  if (command !== RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`restore post-load render/audio/input state requires ${RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT.runtimeCommand}.`);
  }
}

function calculateReplayChecksum(value: string): number {
  let checksum = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    checksum = Math.imul(checksum ^ value.charCodeAt(index), 0x01000193) >>> 0;
  }

  return checksum;
}

function createLoadedMapName(header: SaveGameHeader): string {
  return `E${header.gameepisode}M${header.gamemap}`;
}

function createMusicTrackName(header: SaveGameHeader): string {
  return `e${header.gameepisode}m${header.gamemap}`;
}

function createPlayerPresenceSignature(header: SaveGameHeader): string {
  let signature = '';

  for (let index = 0; index < header.playeringame.length; index += 1) {
    signature += String(header.playeringame[index]);
  }

  return signature;
}

function createRestoredSignature(header: SaveGameHeader): string {
  return [
    'restored',
    createLoadedMapName(header),
    `skill=${header.gameskill}`,
    `leveltime=${header.leveltime}`,
    `players=${createPlayerPresenceSignature(header)}`,
    `version=${SAVEGAME_VERSION_TEXT}`,
    `eof=${SAVEGAME_EOF}`,
    'render=full-frame',
    `audio=${createMusicTrackName(header)}`,
    'input=flushed',
  ].join('|');
}

function createSkippedSignature(): string {
  return ['skipped', `version=${SAVEGAME_VERSION_TEXT}`, `eof=${SAVEGAME_EOF}`, 'render=preserved', 'audio=preserved', 'input=preserved'].join('|');
}

function createRestoredResult(header: SaveGameHeader): RestorePostLoadRenderAudioInputStateResult {
  const transitionSignature = createRestoredSignature(header);

  return Object.freeze({
    audioState: Object.freeze({
      activeMusic: createMusicTrackName(header),
      loopMusic: true,
      pendingSoundEffectsCleared: true,
      resumeAudio: true,
    }),
    commandContract: RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT,
    headerDescription: header.description,
    inputState: Object.freeze({
      heldKeysCleared: true,
      horizontalMouseDelta: 0,
      mouseButtonsCleared: true,
      pendingEventsCleared: true,
      verticalMouseDelta: 0,
    }),
    renderState: Object.freeze({
      automapStateCleared: true,
      fullFrameRefreshRequired: true,
      paletteIndex: 0,
      statusBarRefreshRequired: true,
      viewMode: 'gameplay',
    }),
    replayChecksum: calculateReplayChecksum(transitionSignature),
    restoreAccepted: true,
    transition: 'restored',
    transitionSignature,
  });
}

function createSkippedResult(): RestorePostLoadRenderAudioInputStateResult {
  const transitionSignature = createSkippedSignature();

  return Object.freeze({
    audioState: Object.freeze({
      activeMusic: null,
      loopMusic: false,
      pendingSoundEffectsCleared: false,
      resumeAudio: false,
    }),
    commandContract: RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT,
    headerDescription: null,
    inputState: Object.freeze({
      heldKeysCleared: false,
      horizontalMouseDelta: 0,
      mouseButtonsCleared: false,
      pendingEventsCleared: false,
      verticalMouseDelta: 0,
    }),
    renderState: Object.freeze({
      automapStateCleared: false,
      fullFrameRefreshRequired: false,
      paletteIndex: 0,
      statusBarRefreshRequired: false,
      viewMode: null,
    }),
    replayChecksum: calculateReplayChecksum(transitionSignature),
    restoreAccepted: false,
    transition: 'skipped',
    transitionSignature,
  });
}

/**
 * Finalize deterministic render, audio, and input state immediately after a save load is accepted.
 * @param options Runtime command and parsed save header from the load path.
 * @returns Replay-safe post-load state evidence with no host handles.
 * @example
 * ```ts
 * const result = restorePostLoadRenderAudioInputState({
 *   command: 'bun run doom.ts',
 *   header,
 * });
 * ```
 */
export function restorePostLoadRenderAudioInputState(options: RestorePostLoadRenderAudioInputStateOptions): RestorePostLoadRenderAudioInputStateResult {
  assertRuntimeCommand(options.command);

  if (options.header === null) {
    return createSkippedResult();
  }

  return createRestoredResult(options.header);
}
