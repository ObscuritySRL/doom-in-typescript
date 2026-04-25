import type { LoadGameLayout, LoadGameRestore } from '../../save/loadgame.ts';
import type { SaveGameHeader, SaveGamePlayerPresence } from '../../save/saveHeader.ts';

import { readLoadGame, SAVEGAME_EOF } from '../../save/loadgame.ts';
import { readSaveGameHeader, SAVEGAME_HEADER_SIZE, writeSaveGameHeader } from '../../save/saveHeader.ts';

export const IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_STEP_ID = '01-013';
export const IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_SURFACES = Object.freeze(['live-load-game-roundtrip', 'live-save-game-roundtrip']);
export const IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
});
export const LIVE_GAME_SAVE_SLOT_COUNT = 6;

export type LiveGameSaveLoadOperation = 'load' | 'save';

export interface LiveGameSaveRequest {
  readonly header: SaveGameHeader;
  readonly operation: 'save';
  readonly runtimeCommand: string;
  readonly serializedSections: Uint8Array;
  readonly slotIndex: number;
}

export interface LiveGameLoadRequest {
  readonly layout?: LoadGameLayout;
  readonly operation: 'load';
  readonly runtimeCommand: string;
  readonly saveBytes: Uint8Array;
  readonly slotIndex: number;
}

export type LiveGameSaveLoadRequest = LiveGameLoadRequest | LiveGameSaveRequest;

interface LiveGameSaveLoadEvidence {
  readonly auditStepId: typeof IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_STEP_ID;
  readonly auditSurfaces: readonly string[];
  readonly byteLength: number;
  readonly commandContract: typeof IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT;
  readonly header: SaveGameHeader;
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly saveHashSha256: string;
  readonly slotIndex: number;
}

export interface LiveGameLoadResult extends LiveGameSaveLoadEvidence {
  readonly operation: 'load';
  readonly restored: LoadGameRestore | null;
  readonly restoredBytesRead: number | null;
}

export interface LiveGameSaveResult extends LiveGameSaveLoadEvidence {
  readonly operation: 'save';
  readonly saveBytes: Uint8Array;
}

export type LiveGameSaveLoadResult = LiveGameLoadResult | LiveGameSaveResult;

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT.runtimeCommand) {
    throw new RangeError(`runtimeCommand must be ${IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT.runtimeCommand}.`);
  }
}

function assertSaveBytes(saveBytes: Uint8Array): void {
  if (!(saveBytes instanceof Uint8Array)) {
    throw new TypeError('saveBytes must be a Uint8Array.');
  }

  if (saveBytes.length < SAVEGAME_HEADER_SIZE + 1) {
    throw new RangeError(`Savegame bytes must include at least ${SAVEGAME_HEADER_SIZE} header bytes and an EOF marker.`);
  }

  if (saveBytes[saveBytes.length - 1] !== SAVEGAME_EOF) {
    throw new RangeError('Savegame bytes must end with the Doom EOF marker.');
  }
}

function assertSerializedSections(serializedSections: Uint8Array): void {
  if (!(serializedSections instanceof Uint8Array)) {
    throw new TypeError('serializedSections must be a Uint8Array.');
  }
}

function assertSlotIndex(slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= LIVE_GAME_SAVE_SLOT_COUNT) {
    throw new RangeError(`slotIndex must be an integer from 0 to ${LIVE_GAME_SAVE_SLOT_COUNT - 1}.`);
  }
}

function cloneHeader(header: SaveGameHeader): SaveGameHeader {
  const playeringame: SaveGamePlayerPresence = Object.freeze([header.playeringame[0], header.playeringame[1], header.playeringame[2], header.playeringame[3]]);

  return Object.freeze({
    description: header.description,
    gameepisode: header.gameepisode,
    gamemap: header.gamemap,
    gameskill: header.gameskill,
    leveltime: header.leveltime,
    playeringame,
  });
}

function createReplaySignature(operation: LiveGameSaveLoadOperation, slotIndex: number, header: SaveGameHeader, saveHashSha256: string): string {
  return [
    `command=${IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT.runtimeCommand}`,
    `operation=${operation}`,
    `slot=${slotIndex}`,
    `description=${header.description}`,
    `gameskill=${header.gameskill}`,
    `gameepisode=${header.gameepisode}`,
    `gamemap=${header.gamemap}`,
    `playeringame=${header.playeringame.join(',')}`,
    `leveltime=${header.leveltime}`,
    `saveHashSha256=${saveHashSha256}`,
  ].join('|');
}

function createSaveBytes(header: SaveGameHeader, serializedSections: Uint8Array): Uint8Array {
  const headerBytes = writeSaveGameHeader(header);
  const saveBytes = new Uint8Array(headerBytes.length + serializedSections.length + 1);

  saveBytes.set(headerBytes, 0);
  saveBytes.set(serializedSections, headerBytes.length);
  saveBytes[saveBytes.length - 1] = SAVEGAME_EOF;

  return saveBytes;
}

function hashBytes(source: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(source).digest('hex');
}

function readLiveLoadHeader(saveBytes: Uint8Array): SaveGameHeader {
  const header = readSaveGameHeader(saveBytes);

  if (header === null) {
    throw new RangeError('Savegame version does not match Doom 1.9.');
  }

  return cloneHeader(header);
}

function replayChecksum(signature: string): number {
  let checksum = 0x811c_9dc5;

  for (let index = 0; index < signature.length; index += 1) {
    checksum ^= signature.charCodeAt(index);
    checksum = Math.imul(checksum, 0x0100_0193) >>> 0;
  }

  return checksum;
}

function assertOperation(operation: LiveGameSaveLoadOperation): void {
  if (operation !== 'load' && operation !== 'save') {
    throw new RangeError(`Unsupported live save/load operation: ${String(operation)}.`);
  }
}

/**
 * Apply the live save/load transition used by the Bun-run playable path.
 * @param request Save or load transition request for one local save slot.
 * @returns Replay-safe transition evidence and, for saves, the serialized save bytes.
 * @example
 * ```ts
 * const result = implementLiveGameSaveLoad({
 *   header,
 *   operation: 'save',
 *   runtimeCommand: 'bun run doom.ts',
 *   serializedSections: gameStateBytes,
 *   slotIndex: 0,
 * });
 * ```
 */
export function implementLiveGameSaveLoad(request: LiveGameLoadRequest): LiveGameLoadResult;
export function implementLiveGameSaveLoad(request: LiveGameSaveRequest): LiveGameSaveResult;
export function implementLiveGameSaveLoad(request: LiveGameSaveLoadRequest): LiveGameSaveLoadResult {
  assertRuntimeCommand(request.runtimeCommand);
  assertSlotIndex(request.slotIndex);
  assertOperation(request.operation);

  switch (request.operation) {
    case 'load': {
      assertSaveBytes(request.saveBytes);

      const header = readLiveLoadHeader(request.saveBytes);
      const saveHashSha256 = hashBytes(request.saveBytes);
      const replaySignature = createReplaySignature(request.operation, request.slotIndex, header, saveHashSha256);
      const restoreResult = request.layout === undefined ? null : readLoadGame(request.saveBytes, request.layout);

      return Object.freeze({
        auditStepId: IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_STEP_ID,
        auditSurfaces: IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_SURFACES,
        byteLength: request.saveBytes.length,
        commandContract: IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT,
        header,
        operation: request.operation,
        replayChecksum: replayChecksum(replaySignature),
        replaySignature,
        restored: restoreResult === null ? null : restoreResult.value,
        restoredBytesRead: restoreResult === null ? null : restoreResult.bytesRead,
        saveHashSha256,
        slotIndex: request.slotIndex,
      });
    }

    case 'save': {
      assertSerializedSections(request.serializedSections);

      const header = cloneHeader(request.header);
      const saveBytes = createSaveBytes(header, request.serializedSections);
      const saveHashSha256 = hashBytes(saveBytes);
      const replaySignature = createReplaySignature(request.operation, request.slotIndex, header, saveHashSha256);

      return Object.freeze({
        auditStepId: IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_STEP_ID,
        auditSurfaces: IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_SURFACES,
        byteLength: saveBytes.length,
        commandContract: IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT,
        header,
        operation: request.operation,
        replayChecksum: replayChecksum(replaySignature),
        replaySignature,
        saveBytes,
        saveHashSha256,
        slotIndex: request.slotIndex,
      });
    }
  }
}
