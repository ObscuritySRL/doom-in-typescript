/**
 * Vanilla DOOM 1.9 G_DoLoadGame version rejection contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_DoLoadGame:
 *
 *   if (strcmp (vcheck, "version 109"))
 *     return; // bad version
 *
 * The "bad version" path silently returns without loading the rest of
 * the file; the in-memory game state is unchanged. There is no
 * explicit I_Error — the load is treated as a no-op. The Load menu
 * does NOT pop a confirmation, but the player notices their progress
 * was not restored.
 *
 * Parity-critical details:
 *   - "version 109" is the ONLY accepted magic string. Vanilla
 *     refuses older saves (versions 100..108) and any future-version
 *     saves the same way.
 *   - The comparison is byte-exact via strcmp; case-sensitive, no
 *     whitespace tolerance. "VERSION 109" or "version  109" would
 *     fail.
 *   - The 16-byte version field is NUL-padded; strcmp on the buffer
 *     stops at the first NUL within the 11-char "version 109"
 *     prefix, so the trailing 5 NUL bytes do not affect the compare.
 *   - The PWAD-overridden constant `SAVE_GAME_TERMINATOR` differs
 *     between vanilla DOOM 1.9 (0x1d) and Chocolate Doom — the
 *     version magic is the same.
 *   - Chocolate Doom adds an explicit error dialog in newer versions
 *     ("Savegame from different version"); vanilla DOS silently
 *     returns.
 */

import { isVanillaSaveVersionCompatible } from './implement-save-header-version.ts';

export const VANILLA_REJECTED_SAVE_VERSIONS: readonly string[] = Object.freeze([
  'version 100',
  'version 101',
  'version 102',
  'version 103',
  'version 104',
  'version 105',
  'version 106',
  'version 107',
  'version 108',
  // 109 is the only accepted version
  'version 110',
  'version 111',
  'version 112',
]);

export const VANILLA_INCOMPATIBLE_SAVE_REJECTION_MODE = 'silent-return';

export type VanillaSaveVersionAcceptance = 'accept' | 'reject';

export function classifyVanillaSaveVersion(versionMagic: string): VanillaSaveVersionAcceptance {
  return isVanillaSaveVersionCompatible(versionMagic) ? 'accept' : 'reject';
}

export function rejectionPathForVanillaSaveVersion(versionMagic: string): 'load' | typeof VANILLA_INCOMPATIBLE_SAVE_REJECTION_MODE {
  return isVanillaSaveVersionCompatible(versionMagic) ? 'load' : VANILLA_INCOMPATIBLE_SAVE_REJECTION_MODE;
}
