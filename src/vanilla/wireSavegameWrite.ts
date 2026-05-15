/**
 * Vanilla DOOM 1.9 savegame-write wiring facade.
 *
 * Plan_final step `12-004` (lane: save-config-demo) wires the
 * savegame write path — the header, the per-player archive, the
 * world (sectors / lines / sides) and its thinker list, the active
 * specials, the class terminators, and the fixed record sizes that
 * bound the save — over the read-only `src/save/saveHeader.ts`,
 * `src/save/coreSerialization.ts`, and
 * `src/save/specialSerialization.ts` modules.
 *
 * Those modules already implement the byte-exact P_Archive* /
 * P_UnArchive* layout from Chocolate Doom 2.2.1 `p_saveg.c` and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.  The shared `SAVEGAME_PLAYER_COUNT` /
 * `SaveGamePlayerPresence` names are surfaced from `saveHeader.ts`
 * only so the barrel has no duplicate export names.
 *
 * Five parity invariants this step pins:
 *
 *   1. The header is a fixed `SAVEGAME_HEADER_SIZE` block carrying
 *      the 24-byte description and the `version 109`
 *      (`SAVEGAME_VERSION_CODE`) string; `read` rejects a buffer
 *      whose version field does not match.
 *   2. Mobj and player records are fixed size
 *      (`SAVEGAME_MOBJ_SIZE` = 154, `SAVEGAME_PLAYER_SIZE` = 280).
 *   3. The world is written sectors → lines → sides, then the
 *      thinker list.
 *   4. The thinker list is terminated by the
 *      `SAVEGAME_THINKER_CLASS_END` = 0 class byte (mobj entries use
 *      `SAVEGAME_THINKER_CLASS_MOBJ` = 1).
 *   5. Active specials are serialized by class
 *      (`SAVEGAME_SPECIAL_THINKER_CLASS_CEILING` = 0,
 *      `_DOOR` = 1, …) with their fixed per-class sizes.
 *
 * @example
 * ```ts
 * import { writeSaveGameHeader, readSaveGameHeader, VANILLA_SAVEGAME_WRITE_INVARIANTS } from './wireSavegameWrite.ts';
 * readSaveGameHeader(writeSaveGameHeader({ description: 'X', gameepisode: 1, gamemap: 1, gameskill: 2, leveltime: 0, playeringame: [1, 0, 0, 0] }))?.gamemap; // 1
 * VANILLA_SAVEGAME_WRITE_INVARIANTS.length;                                                                                                                  // 5
 * ```
 */

export {
  SAVEGAME_DESCRIPTION_SIZE,
  SAVEGAME_HEADER_SIZE,
  SAVEGAME_LEVELTIME_SIZE,
  SAVEGAME_PLAYER_COUNT,
  SAVEGAME_VERSION_CODE,
  SAVEGAME_VERSION_SIZE,
  SAVEGAME_VERSION_TEXT,
  readSaveGameHeader,
  writeSaveGameHeader,
} from '../save/saveHeader.ts';
export type { SaveGameHeader, SaveGamePlayerPresence } from '../save/saveHeader.ts';
export {
  SAVEGAME_ALIGNMENT,
  SAVEGAME_LINE_BASE_SIZE,
  SAVEGAME_MOBJ_SIZE,
  SAVEGAME_PLAYER_SIZE,
  SAVEGAME_SECTOR_SIZE,
  SAVEGAME_SIDE_SIZE,
  SAVEGAME_THINKER_CLASS_END,
  SAVEGAME_THINKER_CLASS_MOBJ,
  readArchivedMobjs,
  readArchivedPlayers,
  readArchivedWorld,
  writeArchivedMobjs,
  writeArchivedPlayers,
  writeArchivedWorld,
} from '../save/coreSerialization.ts';
export type { SaveGameMobj, SaveGamePlayer, SaveGamePlayerArchive, SaveGameReadResult, SaveGameThinker, SaveGameWorld, SaveGameWorldLayout } from '../save/coreSerialization.ts';
export {
  SAVEGAME_SPECIAL_DOOR_SIZE,
  SAVEGAME_SPECIAL_FLOOR_SIZE,
  SAVEGAME_SPECIAL_REFERENCE_SIZE,
  SAVEGAME_SPECIAL_THINKER_CLASS_CEILING,
  SAVEGAME_SPECIAL_THINKER_CLASS_DOOR,
  SAVEGAME_SPECIAL_THINKER_SIZE,
  readArchivedSpecials,
  writeArchivedSpecials,
} from '../save/specialSerialization.ts';
export type { SaveGameSpecialArchive, SaveGameSpecialThinker } from '../save/specialSerialization.ts';

/**
 * One pinned savegame-write parity invariant.
 */
export interface VanillaSavegameWriteInvariant {
  readonly id:
    | 'HEADER_IS_FIXED_SIZE_WITH_VERSION_109'
    | 'MOBJ_AND_PLAYER_RECORDS_ARE_FIXED_SIZE'
    | 'SPECIALS_SERIALIZE_BY_CLASS_WITH_FIXED_SIZES'
    | 'THINKER_LIST_TERMINATED_BY_CLASS_END_0'
    | 'WORLD_WRITES_SECTORS_LINES_SIDES_THEN_THINKERS';
  readonly rule: string;
}

/**
 * Frozen manifest of the five savegame-write parity invariants this
 * step pins.  A later step that drives the live save must preserve
 * all five.
 */
export const VANILLA_SAVEGAME_WRITE_INVARIANTS: readonly VanillaSavegameWriteInvariant[] = Object.freeze([
  Object.freeze({
    id: 'HEADER_IS_FIXED_SIZE_WITH_VERSION_109',
    rule: 'writeSaveGameHeader emits a fixed SAVEGAME_HEADER_SIZE block carrying the 24-byte description and the "version 109" (SAVEGAME_VERSION_CODE) text; readSaveGameHeader returns null when the version field does not match.',
  } satisfies VanillaSavegameWriteInvariant),
  Object.freeze({
    id: 'MOBJ_AND_PLAYER_RECORDS_ARE_FIXED_SIZE',
    rule: 'Archived mobj records are SAVEGAME_MOBJ_SIZE = 154 bytes and player records are SAVEGAME_PLAYER_SIZE = 280 bytes, matching the p_saveg.c struct layout.',
  } satisfies VanillaSavegameWriteInvariant),
  Object.freeze({
    id: 'SPECIALS_SERIALIZE_BY_CLASS_WITH_FIXED_SIZES',
    rule: 'Active specials are serialized by class tag (SAVEGAME_SPECIAL_THINKER_CLASS_CEILING = 0, _DOOR = 1, …) with their fixed per-class record sizes (SAVEGAME_SPECIAL_DOOR_SIZE / _FLOOR_SIZE / …).',
  } satisfies VanillaSavegameWriteInvariant),
  Object.freeze({
    id: 'THINKER_LIST_TERMINATED_BY_CLASS_END_0',
    rule: 'The archived thinker list is terminated by the SAVEGAME_THINKER_CLASS_END = 0 class byte; mobj entries are tagged SAVEGAME_THINKER_CLASS_MOBJ = 1.',
  } satisfies VanillaSavegameWriteInvariant),
  Object.freeze({
    id: 'WORLD_WRITES_SECTORS_LINES_SIDES_THEN_THINKERS',
    rule: 'writeArchivedWorld writes the sectors, then lines and their sides, then the thinker list, matching the vanilla P_ArchiveWorld / P_ArchiveThinkers order.',
  } satisfies VanillaSavegameWriteInvariant),
]);
