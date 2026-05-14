/**
 * Vanilla DOOM 1.9 G_DoLoadGame compatible-header acceptance contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_DoLoadGame:
 *
 *   1. Read 24 bytes of description (SAVESTRINGSIZE).
 *   2. Read 16 bytes of version magic (VERSIONSIZE).
 *   3. strcmp the version against "version 109" — reject with
 *      "Savegame from different version" on mismatch.
 *   4. Read gameskill (1 byte), gameepisode (1 byte), gamemap (1 byte).
 *   5. Read playeringame[MAXPLAYERS=4] (4 bytes).
 *   6. Read leveltime (3 bytes, big-endian: high << 16 | mid << 8 | low).
 *   7. Continue with players → world → thinkers → specials → 0x1d.
 *
 * Parity-critical details:
 *   - Total header byte length = 24 + 16 + 1 + 1 + 1 + 4 + 3 = 50.
 *   - The leveltime field is THREE bytes big-endian, not four;
 *     vanilla cannot represent leveltime >= 2^24 tics
 *     (~ 5.3 hours at 35Hz). Saves from extended runs are silently
 *     truncated.
 *   - gameskill values: 0 (ITYTD) .. 4 (NIGHTMARE!). Out-of-range
 *     values are NOT validated — vanilla trusts the file.
 *   - gameepisode values: 1..4 (Ultimate Doom) or any (DOOM 2).
 *     gamemap values: 1..9 (DOOM 1) or 1..32 (DOOM 2). Again
 *     unvalidated.
 *   - playeringame is a per-slot byte: 0 = absent, non-zero = present.
 *     Vanilla writes the C bool's bit pattern, so non-zero values
 *     may be 1 or 0x01 — load logic must treat any non-zero as
 *     present.
 */

export const VANILLA_LOAD_HEADER_DESCRIPTION_BYTES = 24;
export const VANILLA_LOAD_HEADER_VERSION_BYTES = 16;
export const VANILLA_LOAD_HEADER_GAMESKILL_BYTES = 1;
export const VANILLA_LOAD_HEADER_GAMEEPISODE_BYTES = 1;
export const VANILLA_LOAD_HEADER_GAMEMAP_BYTES = 1;
export const VANILLA_LOAD_HEADER_PLAYERINGAME_BYTES = 4;
export const VANILLA_LOAD_HEADER_LEVELTIME_BYTES = 3;

export const VANILLA_LOAD_HEADER_TOTAL_BYTES =
  VANILLA_LOAD_HEADER_DESCRIPTION_BYTES +
  VANILLA_LOAD_HEADER_VERSION_BYTES +
  VANILLA_LOAD_HEADER_GAMESKILL_BYTES +
  VANILLA_LOAD_HEADER_GAMEEPISODE_BYTES +
  VANILLA_LOAD_HEADER_GAMEMAP_BYTES +
  VANILLA_LOAD_HEADER_PLAYERINGAME_BYTES +
  VANILLA_LOAD_HEADER_LEVELTIME_BYTES;

export const VANILLA_LEVELTIME_MAX_REPRESENTABLE = (1 << 24) - 1;

export interface VanillaSaveHeaderFields {
  readonly description: string;
  readonly versionMagic: string;
  readonly gameskill: number;
  readonly gameepisode: number;
  readonly gamemap: number;
  readonly playeringame: readonly [number, number, number, number];
  readonly leveltime: number;
}

export function decodeVanillaLeveltime(highByte: number, midByte: number, lowByte: number): number {
  return ((highByte & 0xff) << 16) | ((midByte & 0xff) << 8) | (lowByte & 0xff);
}

export function encodeVanillaLeveltime(leveltime: number): readonly [number, number, number] {
  if (!Number.isInteger(leveltime) || leveltime < 0) {
    throw new RangeError(`leveltime must be a non-negative integer (got ${leveltime})`);
  }
  return Object.freeze([(leveltime >> 16) & 0xff, (leveltime >> 8) & 0xff, leveltime & 0xff]) as readonly [number, number, number];
}

export function vanillaPlayerPresent(playerInGameByte: number): boolean {
  return (playerInGameByte & 0xff) !== 0;
}
