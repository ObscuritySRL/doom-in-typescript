/**
 * Vanilla DOOM 1.9 save-header version magic contract.
 *
 * Chocolate Doom 2.2.1 g_game.c G_DoSaveGame writes a fixed 16-byte
 * version field after the 24-byte description:
 *
 *   sprintf (savegamebuffer, "%s\0", "version 109");
 *   savegamebuffer += SAVESTRINGSIZE;
 *   sprintf (savegamebuffer, "version %i", VERSION);
 *   savegamebuffer += VERSIONSIZE;
 *
 * where VERSION = 109 (doomdef.h) and VERSIONSIZE = 16 (g_game.c).
 * The string `"version 109"` is 11 chars; the remaining 5 bytes are
 * NUL-padded.
 *
 * Parity-critical details:
 *   - VERSION = 109 is the DOOM 1.9 / Ultimate Doom / DOOM 2 magic.
 *     Earlier releases (DOOM 1.0..1.8) used 100..108. Chocolate Doom
 *     loads ONLY version 109 — older save files are rejected with
 *     "Savegame from different version".
 *   - VERSIONSIZE = 16. Strings shorter than 16 bytes are NUL-padded;
 *     a write of "version 109" produces bytes
 *     [v, e, r, s, i, o, n, ' ', 1, 0, 9, 0, 0, 0, 0, 0].
 *   - The version field is at byte offset SAVESTRINGSIZE = 24 within
 *     the savegame buffer (immediately after the description).
 *   - On load, vanilla compares the first 11 bytes against the
 *     literal "version 109" via strcmp; the trailing NUL padding is
 *     not compared.
 *   - The magic check is case-sensitive: "Version 109" or "VERSION
 *     109" would be rejected.
 */

export const VANILLA_SAVEGAME_VERSION_CODE = 109;

export const VANILLA_SAVEGAME_VERSION_SIZE = 16;

export const VANILLA_SAVEGAME_VERSION_MAGIC = `version ${VANILLA_SAVEGAME_VERSION_CODE}`;

export const VANILLA_SAVEGAME_VERSION_FIELD_OFFSET = 24;

export const VANILLA_SAVEGAME_INCOMPATIBLE_VERSION_ERROR = 'Savegame from different version';

export function encodeVanillaSaveVersionField(versionMagic: string = VANILLA_SAVEGAME_VERSION_MAGIC): Uint8Array {
  if (versionMagic.length > VANILLA_SAVEGAME_VERSION_SIZE) {
    throw new RangeError(`save version magic exceeds ${VANILLA_SAVEGAME_VERSION_SIZE} bytes (got ${versionMagic.length})`);
  }
  const bytes = new Uint8Array(VANILLA_SAVEGAME_VERSION_SIZE);
  for (let i = 0; i < versionMagic.length; i++) {
    const code = versionMagic.charCodeAt(i);
    if (code > 0xff) {
      throw new RangeError(`save version magic character at index ${i} (code 0x${code.toString(16)}) is outside single-byte ASCII`);
    }
    bytes[i] = code;
  }
  return bytes;
}

export function decodeVanillaSaveVersionField(bytes: Uint8Array): string {
  if (bytes.length < VANILLA_SAVEGAME_VERSION_SIZE) {
    throw new RangeError(`save version buffer must be at least ${VANILLA_SAVEGAME_VERSION_SIZE} bytes (got ${bytes.length})`);
  }
  let value = '';
  for (let i = 0; i < VANILLA_SAVEGAME_VERSION_SIZE; i++) {
    const code = bytes[i]!;
    if (code === 0) break;
    value += String.fromCharCode(code);
  }
  return value;
}

export function isVanillaSaveVersionCompatible(versionMagic: string): boolean {
  return versionMagic === VANILLA_SAVEGAME_VERSION_MAGIC;
}

export function isVanillaSaveVersionFieldCompatible(bytes: Uint8Array): boolean {
  if (bytes.length < VANILLA_SAVEGAME_VERSION_SIZE) return false;
  return isVanillaSaveVersionCompatible(decodeVanillaSaveVersionField(bytes));
}
