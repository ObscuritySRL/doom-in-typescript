import type { SaveGameMobj, SaveGamePlayerArchive, SaveGameReadResult, SaveGameWorld, SaveGameWorldLayout } from './coreSerialization.ts';
import type { SaveGameHeader } from './saveHeader.ts';
import type { SaveGameSpecialArchive } from './specialSerialization.ts';

import { readArchivedMobjs, readArchivedPlayers, readArchivedWorld } from './coreSerialization.ts';
import { readSaveGameHeader, SAVEGAME_HEADER_SIZE } from './saveHeader.ts';
import { readArchivedSpecials } from './specialSerialization.ts';

export const SAVEGAME_EOF = 0x1d;

export interface LoadGameLayout {
  readonly worldLayout: SaveGameWorldLayout;
}

export interface LoadGameRestore {
  readonly header: SaveGameHeader;
  readonly mobjs: readonly SaveGameMobj[];
  readonly players: SaveGamePlayerArchive;
  readonly specials: SaveGameSpecialArchive;
  readonly world: SaveGameWorld;
}

function assertStartOffset(startOffset: number): void {
  if (!Number.isInteger(startOffset) || startOffset < 0 || startOffset > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('startOffset must be a non-negative safe integer.');
  }
}

function readSaveGameEof(source: Uint8Array, relativeOffset: number): void {
  const value = source[relativeOffset];

  if (value !== SAVEGAME_EOF) {
    throw new RangeError('Bad savegame');
  }
}

/**
 * Parse a full Doom 1.9 savegame buffer using the canonical `G_DoLoadGame` section order.
 * @param source Complete savegame bytes starting with the 50-byte header.
 * @param layout The preloaded base-level layout needed to decode the world section.
 * @param startOffset Absolute savegame offset where `source` begins.
 * @returns The restored savegame sections, or `null` when the header version does not match Doom 1.9.
 * @example
 * ```ts
 * const restored = readLoadGame(bytes, {
 *   worldLayout: {
 *     lines: [{ sidenum: [0, -1] }],
 *     sectorCount: 1,
 *   },
 * });
 * ```
 */
export function readLoadGame(source: Uint8Array, layout: LoadGameLayout, startOffset = 0): SaveGameReadResult<LoadGameRestore> | null {
  assertStartOffset(startOffset);

  const header = readSaveGameHeader(source);

  if (header === null) {
    return null;
  }

  let bytesRead = SAVEGAME_HEADER_SIZE;
  let absoluteOffset = startOffset + bytesRead;

  const players = readArchivedPlayers(source.subarray(bytesRead), header.playeringame, absoluteOffset);

  bytesRead += players.bytesRead;
  absoluteOffset = players.nextOffset;

  const world = readArchivedWorld(source.subarray(bytesRead), layout.worldLayout, absoluteOffset);

  bytesRead += world.bytesRead;
  absoluteOffset = world.nextOffset;

  const mobjs = readArchivedMobjs(source.subarray(bytesRead), absoluteOffset);

  bytesRead += mobjs.bytesRead;
  absoluteOffset = mobjs.nextOffset;

  const specials = readArchivedSpecials(source.subarray(bytesRead), absoluteOffset);

  bytesRead += specials.bytesRead;
  absoluteOffset = specials.nextOffset;

  readSaveGameEof(source, bytesRead);
  bytesRead += 1;

  return Object.freeze({
    bytesRead,
    nextOffset: startOffset + bytesRead,
    value: Object.freeze({
      header,
      mobjs: mobjs.value,
      players: players.value,
      specials: specials.value,
      world: world.value,
    }),
  });
}
