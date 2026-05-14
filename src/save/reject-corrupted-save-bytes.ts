/**
 * Vanilla DOOM 1.9 corrupted-save detection contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_DoLoadGame, corruption is
 * detected at TWO sites:
 *
 *   1. After reading the entire archive (header → players → world →
 *      thinkers → specials), the read pointer is compared against
 *      the SAVE_GAME_TERMINATOR=0x1d byte position:
 *
 *        if (*save_p != SAVE_GAME_TERMINATOR)
 *          I_Error ("Bad savegame");
 *
 *   2. P_UnArchiveThinkers / P_UnArchiveSpecials switch on the
 *      thinker class byte. An unrecognized class value triggers
 *      `I_Error("Unknown tclass %i in savegame", tclass)`.
 *
 * Parity-critical details:
 *   - The "Bad savegame" string is exact (no trailing period, no
 *     filename interpolation). Tests comparing oracle outputs must
 *     match the literal string.
 *   - The "Unknown tclass %i in savegame" template substitutes a
 *     decimal integer for the unknown class byte. Vanilla uses
 *     printf-style formatting; the comma is present.
 *   - File length is NOT validated upfront. Corruption is detected
 *     IN-STREAM as parsing proceeds, so a truncated save can read
 *     part of the world section before failing at an arbitrary
 *     PADSAVEP boundary.
 *   - Buffer-overrun on write is a separate concern handled by
 *     SAVEGAMESIZE (see ./enforce-vanilla-savegame-limit.ts).
 *   - No checksum or CRC is computed; only structural validation
 *     via class-byte and terminator-byte.
 */

export const VANILLA_BAD_SAVEGAME_ERROR_STRING = 'Bad savegame';

export const VANILLA_UNKNOWN_THINKER_CLASS_ERROR_TEMPLATE = 'Unknown tclass %i in savegame';

export const VANILLA_RECOGNIZED_THINKER_CLASSES: ReadonlyMap<number, string> = Object.freeze(
  new Map<number, string>([
    [0, 'tc_end / tc_ceiling'],
    [1, 'tc_mobj / tc_door'],
    [2, 'tc_floor'],
    [3, 'tc_plat'],
    [4, 'tc_flash'],
    [5, 'tc_strobe'],
    [6, 'tc_glow'],
    [7, 'tc_endspecials'],
  ]),
);

export function isVanillaRecognizedThinkerClass(byte: number): boolean {
  return VANILLA_RECOGNIZED_THINKER_CLASSES.has(byte);
}

export function formatVanillaUnknownThinkerClassError(unknownClassByte: number): string {
  return VANILLA_UNKNOWN_THINKER_CLASS_ERROR_TEMPLATE.replace('%i', String(unknownClassByte));
}

export function isVanillaTerminatorByte(byte: number, expected = 0x1d): boolean {
  return byte === expected;
}
