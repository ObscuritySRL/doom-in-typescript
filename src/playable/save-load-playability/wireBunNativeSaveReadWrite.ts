import type { SaveGameHeader, SaveGamePlayerPresence } from '../../save/saveHeader.ts';

import { SAVEGAME_HEADER_SIZE, readSaveGameHeader } from '../../save/saveHeader.ts';

export const WIRE_BUN_NATIVE_SAVE_READ_WRITE_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json';
export const WIRE_BUN_NATIVE_SAVE_READ_WRITE_AUDIT_SURFACE = 'live-save-game-roundtrip';
export const WIRE_BUN_NATIVE_SAVE_READ_WRITE_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
});

export interface BunNativeSaveReadRequest {
  readonly command: string;
  readonly filePath: string;
  readonly operation: 'read';
}

export interface BunNativeSaveReadResult {
  readonly bytes: Uint8Array;
  readonly evidence: BunNativeSaveReadWriteEvidence;
  readonly header: SaveGameHeader | null;
  readonly operation: 'read';
}

export interface BunNativeSaveReadWriteEvidence {
  readonly byteLength: number;
  readonly gameepisode: number | null;
  readonly gamemap: number | null;
  readonly gameskill: number | null;
  readonly hashSha256: string;
  readonly headerDescription: string | null;
  readonly leveltime: number | null;
  readonly operation: BunNativeSaveReadWriteOperation;
  readonly playeringame: SaveGamePlayerPresence | null;
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly versionMatches: boolean;
}

export type BunNativeSaveReadWriteOperation = 'read' | 'write';

export type BunNativeSaveReadWriteRequest = BunNativeSaveReadRequest | BunNativeSaveWriteRequest;
export type BunNativeSaveReadWriteResult = BunNativeSaveReadResult | BunNativeSaveWriteResult;

export interface BunNativeSaveWriteRequest {
  readonly bytes: Uint8Array;
  readonly command: string;
  readonly filePath: string;
  readonly operation: 'write';
}

export interface BunNativeSaveWriteResult {
  readonly bytesWritten: number;
  readonly evidence: BunNativeSaveReadWriteEvidence;
  readonly header: SaveGameHeader | null;
  readonly operation: 'write';
}

function assertRuntimeCommand(command: string): void {
  if (command !== WIRE_BUN_NATIVE_SAVE_READ_WRITE_COMMAND_CONTRACT.runtimeCommand) {
    throw new RangeError(`Save read/write requires ${WIRE_BUN_NATIVE_SAVE_READ_WRITE_COMMAND_CONTRACT.runtimeCommand}.`);
  }
}

function assertSaveFilePath(filePath: string): void {
  if (filePath.length === 0) {
    throw new RangeError('Save file path is required.');
  }

  if (filePath.includes('\0')) {
    throw new RangeError('Save file path must not contain NUL bytes.');
  }
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(bytes.length);
  output.set(bytes);
  return output;
}

function createEvidence(operation: BunNativeSaveReadWriteOperation, bytes: Uint8Array): BunNativeSaveReadWriteEvidence {
  const hashSha256 = hashBytesSha256(bytes);
  const header = readHeaderOrNull(bytes);
  const replaySignature = createReplaySignature(operation, bytes.length, hashSha256, header);

  return Object.freeze({
    byteLength: bytes.length,
    gameepisode: header?.gameepisode ?? null,
    gamemap: header?.gamemap ?? null,
    gameskill: header?.gameskill ?? null,
    hashSha256,
    headerDescription: header?.description ?? null,
    leveltime: header?.leveltime ?? null,
    operation,
    playeringame: header?.playeringame ?? null,
    replayChecksum: checksumText(replaySignature),
    replaySignature,
    versionMatches: header !== null,
  });
}

function createReplaySignature(operation: BunNativeSaveReadWriteOperation, byteLength: number, hashSha256: string, header: SaveGameHeader | null): string {
  const headerSignature =
    header === null ? 'header=null' : `description=${header.description};episode=${header.gameepisode};map=${header.gamemap};skill=${header.gameskill};players=${header.playeringame.join(',')};leveltime=${header.leveltime}`;

  return `operation=${operation};byteLength=${byteLength};hashSha256=${hashSha256};${headerSignature}`;
}

function checksumText(value: string): number {
  let checksum = 0x811c_9dc5;

  for (let index = 0; index < value.length; index += 1) {
    checksum ^= value.charCodeAt(index) & 0xff;
    checksum = Math.imul(checksum, 0x0100_0193) >>> 0;
  }

  return checksum >>> 0;
}

function hashBytesSha256(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}

function readHeaderOrNull(bytes: Uint8Array): SaveGameHeader | null {
  if (bytes.length < SAVEGAME_HEADER_SIZE) {
    return null;
  }

  return readSaveGameHeader(bytes);
}

/**
 * Read or write a Doom savegame through Bun-native file APIs for the product command path.
 * @param request Save read/write operation and local save path.
 * @returns The byte result or write count with deterministic replay evidence.
 * @example
 * ```ts
 * const result = await wireBunNativeSaveReadWrite({
 *   command: 'bun run doom.ts',
 *   filePath: 'savegames/doomsav0.dsg',
 *   operation: 'read',
 * });
 * ```
 */
export function wireBunNativeSaveReadWrite(request: BunNativeSaveReadRequest): Promise<BunNativeSaveReadResult>;
export function wireBunNativeSaveReadWrite(request: BunNativeSaveWriteRequest): Promise<BunNativeSaveWriteResult>;
export async function wireBunNativeSaveReadWrite(request: BunNativeSaveReadWriteRequest): Promise<BunNativeSaveReadWriteResult> {
  assertRuntimeCommand(request.command);
  assertSaveFilePath(request.filePath);

  if (request.operation === 'read') {
    const bytes = new Uint8Array(await Bun.file(request.filePath).arrayBuffer());
    const header = readHeaderOrNull(bytes);

    return Object.freeze({
      bytes,
      evidence: createEvidence(request.operation, bytes),
      header,
      operation: request.operation,
    });
  }

  const bytes = copyBytes(request.bytes);
  const bytesWritten = await Bun.write(request.filePath, bytes);
  const header = readHeaderOrNull(bytes);

  return Object.freeze({
    bytesWritten,
    evidence: createEvidence(request.operation, bytes),
    header,
    operation: request.operation,
  });
}
