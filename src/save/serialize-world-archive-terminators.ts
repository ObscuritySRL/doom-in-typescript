/**
 * Vanilla DOOM 1.9 savegame archive section terminator contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_DoSaveGame and p_saveg.c, the
 * complete savegame buffer is assembled in this canonical section
 * order with these terminator bytes:
 *
 *   1. Header               (no terminator — fixed-width)
 *   2. P_ArchivePlayers     (no terminator — fixed-width 4 slots)
 *   3. P_ArchiveWorld       (no terminator — line/sector arrays of known count)
 *   4. P_ArchiveThinkers    → terminated by tc_end=0
 *   5. P_ArchiveSpecials    → terminated by tc_endspecials=7
 *   6. SAVE_GAME_TERMINATOR = 0x1d  (file end byte from doomdef.h)
 *
 * Parity-critical details:
 *   - The thinkers section's tc_end and the specials section's
 *     tc_endspecials are DIFFERENT bytes (0 vs 7) emitted by the same
 *     class-byte mechanism. Confusing them desyncs all save-file
 *     parity comparisons.
 *   - The 0x1d file-end byte is appended UNCONDITIONALLY after the
 *     specials terminator. G_DoLoadGame asserts the read pointer
 *     reaches the 0x1d byte and rejects the save with "Bad savegame"
 *     otherwise.
 *   - There is no padding between sections. PADSAVEP() only operates
 *     INSIDE P_ArchiveThinkers (between each class byte and record
 *     body), never at section boundaries.
 *   - The header/players/world sections have IMPLICIT terminators
 *     because their lengths are derivable from the map (numlines,
 *     numsectors, numsides) — readers compute exactly where each
 *     section ends before starting the next.
 */

export const VANILLA_THINKERS_SECTION_TERMINATOR_BYTE = 0;

export const VANILLA_SPECIALS_SECTION_TERMINATOR_BYTE = 7;

export const VANILLA_SAVE_GAME_FILE_TERMINATOR_BYTE = 0x1d;

export const VANILLA_BAD_SAVEGAME_ERROR = 'Bad savegame';

export const VANILLA_SAVE_SECTION_ORDER: readonly string[] = Object.freeze(['header', 'players', 'world', 'thinkers', 'specials', 'fileTerminator']);

export function isVanillaSaveGameFileTerminator(byte: number): boolean {
  return byte === VANILLA_SAVE_GAME_FILE_TERMINATOR_BYTE;
}

export function isVanillaArchiveSectionTerminator(byte: number): boolean {
  return byte === VANILLA_THINKERS_SECTION_TERMINATOR_BYTE || byte === VANILLA_SPECIALS_SECTION_TERMINATOR_BYTE;
}
