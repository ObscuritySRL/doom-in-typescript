import { SAVEGAME_EOF } from '../../save/loadgame.ts';
import { readSaveGameHeader, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_TEXT, writeSaveGameHeader } from '../../save/saveHeader.ts';
import type { SaveGameHeader, SaveGamePlayerPresence } from '../../save/saveHeader.ts';

export const ADD_LIVE_SAVE_LOAD_ROUNDTRIP_HASH_TESTS_RUNTIME_COMMAND = 'bun run doom.ts';

const AUDIT_SURFACES = Object.freeze(['live-load-game-roundtrip', 'live-save-game-roundtrip'] as const);
const DEFAULT_LIVE_SECTION_BYTES = Object.freeze([0x4c, 0x49, 0x56, 0x45, 0x5f, 0x53, 0x41, 0x56, 0x45] as const);
const DEFAULT_PLAYER_PRESENCE = Object.freeze([1, 0, 0, 0] as const) satisfies SaveGamePlayerPresence;
const FNV_OFFSET_BASIS = 0x811c_9dc5;
const FNV_PRIME = 0x0100_0193;

const DEFAULT_SAVE_HEADER: SaveGameHeader = Object.freeze({
  description: 'ROUNDTRIP HASH',
  gameepisode: 1,
  gamemap: 1,
  gameskill: 2,
  leveltime: 0x00_23_45,
  playeringame: DEFAULT_PLAYER_PRESENCE,
});

export interface LiveSaveLoadRoundtripHashEvidence {
  readonly auditSurfaces: readonly string[];
  readonly headerSize: number;
  readonly loadHashSha256: string;
  readonly loadedHeader: SaveGameHeader;
  readonly replayChecksum: number;
  readonly roundtripByteCount: number;
  readonly runtimeCommand: string;
  readonly saveHashSha256: string;
  readonly savedHeader: SaveGameHeader;
  readonly transitionSignature: string;
  readonly versionText: string;
}

export interface LiveSaveLoadRoundtripHashInput {
  readonly liveSectionBytes?: Uint8Array;
  readonly runtimeCommand?: string;
  readonly saveHeader?: SaveGameHeader;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== ADD_LIVE_SAVE_LOAD_ROUNDTRIP_HASH_TESTS_RUNTIME_COMMAND) {
    throw new Error('add-live-save-load-roundtrip-hash-tests requires bun run doom.ts.');
  }
}

function calculateReplayChecksum(bytes: Uint8Array): number {
  let checksum = FNV_OFFSET_BASIS;

  for (const byte of bytes) {
    checksum = Math.imul(checksum ^ byte, FNV_PRIME) >>> 0;
  }

  return checksum;
}

function copyPlayerPresence(playeringame: SaveGamePlayerPresence): SaveGamePlayerPresence {
  return Object.freeze([playeringame[0], playeringame[1], playeringame[2], playeringame[3]] as const);
}

function copySaveHeader(saveHeader: SaveGameHeader): SaveGameHeader {
  return Object.freeze({
    description: saveHeader.description,
    gameepisode: saveHeader.gameepisode,
    gamemap: saveHeader.gamemap,
    gameskill: saveHeader.gameskill,
    leveltime: saveHeader.leveltime,
    playeringame: copyPlayerPresence(saveHeader.playeringame),
  });
}

function createDefaultLiveSectionBytes(): Uint8Array {
  return new Uint8Array(DEFAULT_LIVE_SECTION_BYTES);
}

function createRoundtripBytes(saveHeader: SaveGameHeader, liveSectionBytes: Uint8Array): Uint8Array {
  const headerBytes = writeSaveGameHeader(saveHeader);
  const roundtripBytes = new Uint8Array(SAVEGAME_HEADER_SIZE + liveSectionBytes.length + 1);

  roundtripBytes.set(headerBytes, 0);
  roundtripBytes.set(liveSectionBytes, SAVEGAME_HEADER_SIZE);
  roundtripBytes[SAVEGAME_HEADER_SIZE + liveSectionBytes.length] = SAVEGAME_EOF;

  return roundtripBytes;
}

function createTransitionSignature(saveHeader: SaveGameHeader, saveHashSha256: string): string {
  return [saveHeader.description, saveHeader.gameskill, saveHeader.gameepisode, saveHeader.gamemap, saveHeader.playeringame.join(''), saveHeader.leveltime, saveHashSha256.slice(0, 16)].join(':');
}

function hashBytesSha256(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(bytes);

  return hasher.digest('hex');
}

function headersMatch(leftHeader: SaveGameHeader, rightHeader: SaveGameHeader): boolean {
  return (
    leftHeader.description === rightHeader.description &&
    leftHeader.gameepisode === rightHeader.gameepisode &&
    leftHeader.gamemap === rightHeader.gamemap &&
    leftHeader.gameskill === rightHeader.gameskill &&
    leftHeader.leveltime === rightHeader.leveltime &&
    leftHeader.playeringame[0] === rightHeader.playeringame[0] &&
    leftHeader.playeringame[1] === rightHeader.playeringame[1] &&
    leftHeader.playeringame[2] === rightHeader.playeringame[2] &&
    leftHeader.playeringame[3] === rightHeader.playeringame[3]
  );
}

/**
 * Produce deterministic hash evidence for the live save/load roundtrip parity gate.
 * @param input Optional runtime command, header, and live section bytes used for the roundtrip.
 * @returns Frozen hash evidence for the serialized save and loaded header transition.
 * @example
 * ```ts
 * const evidence = addLiveSaveLoadRoundtripHashTests();
 * console.log(evidence.saveHashSha256);
 * ```
 */
export function addLiveSaveLoadRoundtripHashTests(input: LiveSaveLoadRoundtripHashInput = {}): LiveSaveLoadRoundtripHashEvidence {
  const runtimeCommand = input.runtimeCommand ?? ADD_LIVE_SAVE_LOAD_ROUNDTRIP_HASH_TESTS_RUNTIME_COMMAND;

  assertRuntimeCommand(runtimeCommand);

  const liveSectionBytes = input.liveSectionBytes === undefined ? createDefaultLiveSectionBytes() : new Uint8Array(input.liveSectionBytes);
  const savedHeader = copySaveHeader(input.saveHeader ?? DEFAULT_SAVE_HEADER);
  const roundtripBytes = createRoundtripBytes(savedHeader, liveSectionBytes);
  const loadedHeader = readSaveGameHeader(roundtripBytes);

  if (loadedHeader === null) {
    throw new RangeError('Live save/load roundtrip requires Doom 1.9 savegame version.');
  }

  if (!headersMatch(savedHeader, loadedHeader)) {
    throw new RangeError('Live save/load roundtrip changed the savegame header.');
  }

  const loadHashSha256 = hashBytesSha256(createRoundtripBytes(loadedHeader, liveSectionBytes));
  const saveHashSha256 = hashBytesSha256(roundtripBytes);

  return Object.freeze({
    auditSurfaces: AUDIT_SURFACES,
    headerSize: SAVEGAME_HEADER_SIZE,
    loadHashSha256,
    loadedHeader,
    replayChecksum: calculateReplayChecksum(roundtripBytes),
    roundtripByteCount: roundtripBytes.length,
    runtimeCommand,
    saveHashSha256,
    savedHeader,
    transitionSignature: createTransitionSignature(loadedHeader, saveHashSha256),
    versionText: SAVEGAME_VERSION_TEXT,
  });
}
