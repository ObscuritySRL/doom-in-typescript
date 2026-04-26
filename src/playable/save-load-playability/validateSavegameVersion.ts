import type { SaveGameHeader } from '../../save/saveHeader.ts';

import { readSaveGameHeader, SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_SIZE, SAVEGAME_VERSION_TEXT } from '../../save/saveHeader.ts';

const REPLAY_CHECKSUM_OFFSET_BASIS = 0x811c9dc5;
const REPLAY_CHECKSUM_PRIME = 0x01000193;
const SAVEGAME_VERSION_FIELD_OFFSET = SAVEGAME_DESCRIPTION_SIZE;

export const VALIDATE_SAVEGAME_VERSION_AUDIT_LINK = Object.freeze({
  manifestPath: 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json',
  stepId: '01-013',
  surface: 'live-load-game-roundtrip',
});

export const VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND = 'bun run doom.ts';

export interface ValidateSavegameVersionOptions {
  readonly runtimeCommand: string;
  readonly savegameBytes: Uint8Array;
}

export interface ValidateSavegameVersionResult {
  readonly compatible: boolean;
  readonly expectedVersionText: string;
  readonly header: SaveGameHeader | null;
  readonly observedVersionText: string;
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly versionFieldOffset: number;
  readonly versionFieldSize: number;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND) {
    throw new RangeError(`validateSavegameVersion requires runtime command ${VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND}.`);
  }
}

function assertSavegameHeaderBytes(savegameBytes: Uint8Array): void {
  if (savegameBytes.length < SAVEGAME_HEADER_SIZE) {
    throw new RangeError(`Savegame header requires ${SAVEGAME_HEADER_SIZE} bytes.`);
  }
}

function calculateReplayChecksum(replaySignature: string): number {
  let replayChecksum = REPLAY_CHECKSUM_OFFSET_BASIS;

  for (let index = 0; index < replaySignature.length; index += 1) {
    replayChecksum ^= replaySignature.charCodeAt(index);
    replayChecksum = Math.imul(replayChecksum, REPLAY_CHECKSUM_PRIME) >>> 0;
  }

  return replayChecksum;
}

function createReplaySignature(compatible: boolean, header: SaveGameHeader | null, observedVersionText: string): string {
  const playerPresence = header === null ? 'none' : header.playeringame.join(',');

  return [
    'validate-savegame-version',
    `compatible=${compatible ? 1 : 0}`,
    `expected=${SAVEGAME_VERSION_TEXT}`,
    `observed=${observedVersionText}`,
    `description=${header?.description ?? 'none'}`,
    `gameskill=${header?.gameskill ?? 'none'}`,
    `gameepisode=${header?.gameepisode ?? 'none'}`,
    `gamemap=${header?.gamemap ?? 'none'}`,
    `playeringame=${playerPresence}`,
    `leveltime=${header?.leveltime ?? 'none'}`,
  ].join('|');
}

function readObservedVersionText(savegameBytes: Uint8Array): string {
  assertSavegameHeaderBytes(savegameBytes);

  let observedVersionText = '';

  for (let index = 0; index < SAVEGAME_VERSION_SIZE; index += 1) {
    const byte = savegameBytes[SAVEGAME_VERSION_FIELD_OFFSET + index];

    if (byte === 0) {
      break;
    }

    observedVersionText += String.fromCharCode(byte);
  }

  return observedVersionText;
}

/**
 * Validate the Doom 1.9 savegame version field without restoring world state.
 * @param options Runtime command and savegame bytes to inspect.
 * @returns Replay-safe version compatibility evidence.
 * @example
 * ```ts
 * const savegameBytes = new Uint8Array(50);
 * const validation = validateSavegameVersion({
 *   runtimeCommand: VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND,
 *   savegameBytes,
 * });
 * console.log(validation.compatible);
 * ```
 */
export function validateSavegameVersion(options: ValidateSavegameVersionOptions): ValidateSavegameVersionResult {
  assertRuntimeCommand(options.runtimeCommand);

  const observedVersionText = readObservedVersionText(options.savegameBytes);
  const header = readSaveGameHeader(options.savegameBytes);
  const compatible = header !== null;
  const replaySignature = createReplaySignature(compatible, header, observedVersionText);

  return Object.freeze({
    compatible,
    expectedVersionText: SAVEGAME_VERSION_TEXT,
    header,
    observedVersionText,
    replayChecksum: calculateReplayChecksum(replaySignature),
    replaySignature,
    versionFieldOffset: SAVEGAME_VERSION_FIELD_OFFSET,
    versionFieldSize: SAVEGAME_VERSION_SIZE,
  });
}
