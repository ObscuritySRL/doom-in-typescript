import type { LoadGameLayout, LoadGameRestore } from '../../save/loadgame.ts';
import type { SaveGameHeader } from '../../save/saveHeader.ts';

import { readLoadGame } from '../../save/loadgame.ts';
import { readSaveGameHeader, SAVEGAME_HEADER_SIZE } from '../../save/saveHeader.ts';

export const RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND = 'bun run doom.ts';

export type RestoreGameStateFromSaveStatus = 'corrupted' | 'restored' | 'unsupported-version';

export interface RestoreGameStateFromSaveInput {
  readonly command?: string;
  readonly layout: LoadGameLayout;
  readonly saveBytes: Uint8Array;
  readonly startOffset?: number;
}

export interface RestoreGameStateFromSaveEvidence {
  readonly auditStepId: '01-013';
  readonly auditSurface: 'live-load-game-roundtrip';
  readonly command: typeof RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND;
  readonly replayChecksum: number;
  readonly restored: LoadGameRestore | null;
  readonly transition: RestoreGameStateFromSaveTransition;
}

export interface RestoreGameStateFromSaveTransition {
  readonly bytesRead: number;
  readonly description: string | null;
  readonly gameepisode: number | null;
  readonly gamemap: number | null;
  readonly gameskill: number | null;
  readonly leveltime: number | null;
  readonly nextOffset: number | null;
  readonly playerMask: number;
  readonly restoreHashSha256: string;
  readonly status: RestoreGameStateFromSaveStatus;
}

function assertRuntimeCommand(command: string): void {
  if (command !== RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND) {
    throw new RangeError(`Restore game state from save must run through ${RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND}.`);
  }
}

function assertStartOffset(startOffset: number | undefined): void {
  if (startOffset !== undefined && (!Number.isInteger(startOffset) || startOffset < 0 || startOffset > Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('startOffset must be a non-negative safe integer.');
  }
}

function createByteHash(source: Uint8Array, byteCount: number): string {
  const inspectedByteCount = Math.max(0, Math.min(byteCount, source.length));
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(source.subarray(0, inspectedByteCount));

  return hasher.digest('hex');
}

function createFailureTransition(status: Exclude<RestoreGameStateFromSaveStatus, 'restored'>, source: Uint8Array, bytesRead: number, header: SaveGameHeader | null): RestoreGameStateFromSaveTransition {
  return Object.freeze({
    bytesRead,
    description: header?.description ?? null,
    gameepisode: header?.gameepisode ?? null,
    gamemap: header?.gamemap ?? null,
    gameskill: header?.gameskill ?? null,
    leveltime: header?.leveltime ?? null,
    nextOffset: null,
    playerMask: header === null ? 0 : createPlayerMask(header.playeringame),
    restoreHashSha256: createByteHash(source, bytesRead),
    status,
  });
}

function createPlayerMask(playeringame: readonly number[]): number {
  let playerMask = 0;

  for (let playerIndex = 0; playerIndex < playeringame.length; playerIndex += 1) {
    if (playeringame[playerIndex] !== 0) {
      playerMask |= 1 << playerIndex;
    }
  }

  return playerMask;
}

function createReplayChecksum(transition: RestoreGameStateFromSaveTransition): number {
  const payload = [
    transition.bytesRead,
    transition.description ?? '',
    transition.gameepisode ?? '',
    transition.gamemap ?? '',
    transition.gameskill ?? '',
    transition.leveltime ?? '',
    transition.nextOffset ?? '',
    transition.playerMask,
    transition.restoreHashSha256,
    transition.status,
  ].join('\n');
  let checksum = 0x811c_9dc5;

  for (let index = 0; index < payload.length; index += 1) {
    checksum = Math.imul(checksum ^ payload.charCodeAt(index), 0x0100_0193) >>> 0;
  }

  return checksum;
}

function createRestoredTransition(restored: LoadGameRestore, source: Uint8Array, bytesRead: number, nextOffset: number): RestoreGameStateFromSaveTransition {
  return Object.freeze({
    bytesRead,
    description: restored.header.description,
    gameepisode: restored.header.gameepisode,
    gamemap: restored.header.gamemap,
    gameskill: restored.header.gameskill,
    leveltime: restored.header.leveltime,
    nextOffset,
    playerMask: createPlayerMask(restored.header.playeringame),
    restoreHashSha256: createByteHash(source, bytesRead),
    status: 'restored',
  });
}

function createRestoreEvidence(restored: LoadGameRestore | null, transition: RestoreGameStateFromSaveTransition): RestoreGameStateFromSaveEvidence {
  return Object.freeze({
    auditStepId: '01-013',
    auditSurface: 'live-load-game-roundtrip',
    command: RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND,
    replayChecksum: createReplayChecksum(transition),
    restored,
    transition,
  });
}

/**
 * Restore a Doom 1.9 savegame through the Bun-run playable command path.
 * @param input Save bytes, world layout, and optional command/start offset.
 * @returns Deterministic restore evidence plus restored state when the save is compatible.
 * @example
 * ```ts
 * const evidence = restoreGameStateFromSave({
 *   layout,
 *   saveBytes,
 * });
 * ```
 */
export function restoreGameStateFromSave(input: RestoreGameStateFromSaveInput): RestoreGameStateFromSaveEvidence {
  const command = input.command ?? RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND;

  assertRuntimeCommand(command);
  assertStartOffset(input.startOffset);

  let header: SaveGameHeader | null;

  try {
    header = readSaveGameHeader(input.saveBytes);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    const transition = createFailureTransition('corrupted', input.saveBytes, 0, null);

    return createRestoreEvidence(null, transition);
  }

  if (header === null) {
    const transition = createFailureTransition('unsupported-version', input.saveBytes, SAVEGAME_HEADER_SIZE, null);

    return createRestoreEvidence(null, transition);
  }

  try {
    const result = readLoadGame(input.saveBytes, input.layout, input.startOffset);

    if (result === null) {
      const transition = createFailureTransition('unsupported-version', input.saveBytes, SAVEGAME_HEADER_SIZE, null);

      return createRestoreEvidence(null, transition);
    }

    const transition = createRestoredTransition(result.value, input.saveBytes, result.bytesRead, result.nextOffset);

    return createRestoreEvidence(result.value, transition);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    const transition = createFailureTransition('corrupted', input.saveBytes, SAVEGAME_HEADER_SIZE, header);

    return createRestoreEvidence(null, transition);
  }
}
