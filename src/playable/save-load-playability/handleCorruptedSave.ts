import type { LoadGameLayout } from '../../save/loadgame.ts';
import type { SaveGameHeader } from '../../save/saveHeader.ts';

import { readLoadGame } from '../../save/loadgame.ts';
import { readSaveGameHeader } from '../../save/saveHeader.ts';

export const HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND = 'bun run doom.ts';
export const HANDLE_CORRUPTED_SAVE_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json';

export type HandleCorruptedSaveReason = 'archive-read-failed' | 'header-read-failed' | 'header-validation-only' | 'loadgame-read-succeeded' | 'version-mismatch';

export interface HandleCorruptedSaveOptions {
  readonly layout?: LoadGameLayout;
  readonly runtimeCommand: string;
  readonly source: Uint8Array;
  readonly startOffset?: number;
}

export interface HandleCorruptedSaveResult {
  readonly bytesRead: number | null;
  readonly commandContract: string;
  readonly corrupted: boolean;
  readonly description: string | null;
  readonly diagnostic: string | null;
  readonly header: SaveGameHeader | null;
  readonly nextOffset: number | null;
  readonly reason: HandleCorruptedSaveReason;
  readonly replayChecksum: number;
  readonly safeToRestore: boolean;
  readonly sourceByteChecksum: number;
  readonly status: HandleCorruptedSaveStatus;
  readonly transitionSignature: string;
}

export type HandleCorruptedSaveStatus = 'corrupted' | 'header-valid' | 'restorable' | 'unsupported-version';

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND) {
    throw new Error(`Expected runtime command ${HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND}.`);
  }
}

function assertStartOffset(startOffset: number): void {
  if (!Number.isInteger(startOffset) || startOffset < 0 || startOffset > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('startOffset must be a non-negative safe integer.');
  }
}

function createResult(parameters: {
  readonly bytesRead: number | null;
  readonly corrupted: boolean;
  readonly diagnostic: string | null;
  readonly header: SaveGameHeader | null;
  readonly nextOffset: number | null;
  readonly reason: HandleCorruptedSaveReason;
  readonly safeToRestore: boolean;
  readonly source: Uint8Array;
  readonly startOffset: number;
  readonly status: HandleCorruptedSaveStatus;
}): HandleCorruptedSaveResult {
  const description = parameters.header?.description ?? null;
  const sourceByteChecksum = computeByteChecksum(parameters.source);
  const transitionSignature = [
    'handle-corrupted-save',
    `status=${parameters.status}`,
    `reason=${parameters.reason}`,
    `length=${parameters.source.length}`,
    `sourceChecksum=${sourceByteChecksum}`,
    `startOffset=${parameters.startOffset}`,
    `bytesRead=${parameters.bytesRead ?? 'none'}`,
    `nextOffset=${parameters.nextOffset ?? 'none'}`,
    `description=${description ?? 'none'}`,
    `diagnostic=${parameters.diagnostic ?? 'none'}`,
  ].join('|');

  return Object.freeze({
    bytesRead: parameters.bytesRead,
    commandContract: HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND,
    corrupted: parameters.corrupted,
    description,
    diagnostic: parameters.diagnostic,
    header: parameters.header,
    nextOffset: parameters.nextOffset,
    reason: parameters.reason,
    replayChecksum: computeStringChecksum(transitionSignature),
    safeToRestore: parameters.safeToRestore,
    sourceByteChecksum,
    status: parameters.status,
    transitionSignature,
  });
}

function computeByteChecksum(source: Uint8Array): number {
  let checksum = 0x811c_9dc5;

  for (const byte of source) {
    checksum ^= byte;
    checksum = Math.imul(checksum, 0x0100_0193) >>> 0;
  }

  return checksum;
}

function computeStringChecksum(value: string): number {
  let checksum = 0x811c_9dc5;

  for (let index = 0; index < value.length; index += 1) {
    checksum ^= value.charCodeAt(index) & 0xff;
    checksum = Math.imul(checksum, 0x0100_0193) >>> 0;
  }

  return checksum;
}

function normalizeDiagnostic(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Classify a load attempt without restoring state when the save buffer is corrupted or incompatible.
 * @param options Save buffer, optional restore layout, and the required Bun runtime command.
 * @returns Replay-safe evidence describing whether the save may be restored.
 * @example
 * ```ts
 * const result = handleCorruptedSave({
 *   runtimeCommand: HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND,
 *   source: new Uint8Array(0),
 * });
 *
 * console.log(result.status);
 * ```
 */
export function handleCorruptedSave(options: HandleCorruptedSaveOptions): HandleCorruptedSaveResult {
  assertRuntimeCommand(options.runtimeCommand);

  const startOffset = options.startOffset ?? 0;
  assertStartOffset(startOffset);

  let header: SaveGameHeader | null;

  try {
    header = readSaveGameHeader(options.source);
  } catch (error: unknown) {
    return createResult({
      bytesRead: null,
      corrupted: true,
      diagnostic: normalizeDiagnostic(error),
      header: null,
      nextOffset: null,
      reason: 'header-read-failed',
      safeToRestore: false,
      source: options.source,
      startOffset,
      status: 'corrupted',
    });
  }

  if (header === null) {
    return createResult({
      bytesRead: null,
      corrupted: false,
      diagnostic: 'Savegame version does not match Doom 1.9.',
      header: null,
      nextOffset: null,
      reason: 'version-mismatch',
      safeToRestore: false,
      source: options.source,
      startOffset,
      status: 'unsupported-version',
    });
  }

  if (options.layout === undefined) {
    return createResult({
      bytesRead: null,
      corrupted: false,
      diagnostic: null,
      header,
      nextOffset: null,
      reason: 'header-validation-only',
      safeToRestore: false,
      source: options.source,
      startOffset,
      status: 'header-valid',
    });
  }

  try {
    const restored = readLoadGame(options.source, options.layout, startOffset);

    if (restored === null) {
      return createResult({
        bytesRead: null,
        corrupted: false,
        diagnostic: 'Savegame version does not match Doom 1.9.',
        header: null,
        nextOffset: null,
        reason: 'version-mismatch',
        safeToRestore: false,
        source: options.source,
        startOffset,
        status: 'unsupported-version',
      });
    }

    return createResult({
      bytesRead: restored.bytesRead,
      corrupted: false,
      diagnostic: null,
      header: restored.value.header,
      nextOffset: restored.nextOffset,
      reason: 'loadgame-read-succeeded',
      safeToRestore: true,
      source: options.source,
      startOffset,
      status: 'restorable',
    });
  } catch (error: unknown) {
    return createResult({
      bytesRead: null,
      corrupted: true,
      diagnostic: normalizeDiagnostic(error),
      header,
      nextOffset: null,
      reason: 'archive-read-failed',
      safeToRestore: false,
      source: options.source,
      startOffset,
      status: 'corrupted',
    });
  }
}
