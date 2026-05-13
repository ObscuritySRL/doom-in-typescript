/**
 * Vanilla DOOM 1.9 save-directory policy contract.
 *
 * Chocolate Doom 2.2.1 g_game.c G_DoSaveGame writes savegame files
 * (`doomsav0.dsg` through `doomsav5.dsg`, with `temp.dsg` as the
 * write-then-rename staging file) into `savegamedir`. The resolution
 * order from m_misc.c / d_main.c is:
 *
 *   1. The directory supplied by `-savedir <path>` on the command line.
 *   2. Otherwise, the per-user `configDirectory` (the same root used
 *      for `default.cfg` / `chocolate-doom.cfg`):
 *      - Windows: %APPDATA%\Chocolate Doom\
 *      - Linux:   ~/.local/share/chocolate-doom/
 *      - macOS:   ~/Library/Application Support/Chocolate Doom/
 *   3. The directory is created on first save if it does not exist;
 *      Chocolate Doom uses `M_MakeDirectory` (CreateDirectoryA on
 *      Windows, mkdir(2) on POSIX) with mode 0o755.
 *
 * Parity-critical details:
 *   - The savegame filename pattern is `doomsav%i.dsg` where `%i` is
 *     the slot index 0..5. SAVEGAMENAMESIZE=24 in dstrings.h caps the
 *     length, but vanilla never uses longer than 11 chars.
 *   - The staging file is `temp.dsg` (lowercase, no slot number). It
 *     is renamed to `doomsav%i.dsg` on successful completion to make
 *     save commits atomic — a partial write leaves the previous slot
 *     intact.
 *   - There are exactly 6 save slots (SAVEGAMENAMESIZE indexes 0..5
 *     via SAVEGAMENAME prefix). The menu UI also caps at 6.
 *   - SAVEGAMESIZE = 0x2c000 bytes (180224) is the vanilla save buffer
 *     cap; pinned independently in src/save/vanillaLimits.ts.
 *   - On Windows, paths are constructed with `\` separators by
 *     Chocolate Doom. The TypeScript port uses POSIX-style `/`
 *     internally for portability; the host-Win32 layer converts at
 *     the FFI boundary.
 */

export const VANILLA_SAVE_SLOT_COUNT = 6;

export const VANILLA_SAVE_SLOT_FILENAME_PREFIX = 'doomsav';

export const VANILLA_SAVE_SLOT_FILENAME_EXTENSION = '.dsg';

export const VANILLA_SAVE_STAGING_FILENAME = 'temp.dsg';

export const VANILLA_SAVEGAME_NAME_SIZE = 24;

export const VANILLA_SAVE_DIRECTORY_MODE = 0o755;

export const VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM: ReadonlyMap<'darwin' | 'linux' | 'win32', readonly string[]> = Object.freeze(
  new Map<'darwin' | 'linux' | 'win32', readonly string[]>([
    ['win32', Object.freeze(['%APPDATA%', 'Chocolate Doom'])],
    ['linux', Object.freeze(['~', '.local', 'share', 'chocolate-doom'])],
    ['darwin', Object.freeze(['~', 'Library', 'Application Support', 'Chocolate Doom'])],
  ]),
);

export function vanillaSaveSlotFilename(slotIndex: number): string {
  if (!Number.isInteger(slotIndex)) {
    throw new RangeError(`save slot index must be an integer (got ${slotIndex})`);
  }
  if (slotIndex < 0 || slotIndex >= VANILLA_SAVE_SLOT_COUNT) {
    throw new RangeError(`save slot index must be in [0, ${VANILLA_SAVE_SLOT_COUNT}) (got ${slotIndex})`);
  }
  return `${VANILLA_SAVE_SLOT_FILENAME_PREFIX}${slotIndex}${VANILLA_SAVE_SLOT_FILENAME_EXTENSION}`;
}

export function isVanillaSaveSlotFilename(filename: string): boolean {
  if (!filename.startsWith(VANILLA_SAVE_SLOT_FILENAME_PREFIX)) return false;
  if (!filename.endsWith(VANILLA_SAVE_SLOT_FILENAME_EXTENSION)) return false;
  const slotPart = filename.slice(VANILLA_SAVE_SLOT_FILENAME_PREFIX.length, filename.length - VANILLA_SAVE_SLOT_FILENAME_EXTENSION.length);
  if (slotPart.length === 0) return false;
  if (!/^\d+$/.test(slotPart)) return false;
  const slot = Number.parseInt(slotPart, 10);
  return slot >= 0 && slot < VANILLA_SAVE_SLOT_COUNT;
}

export function vanillaSaveDirectoryPathSegments(platform: 'darwin' | 'linux' | 'win32'): readonly string[] {
  const segments = VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM.get(platform);
  if (segments === undefined) {
    throw new RangeError(`unsupported platform for vanilla save directory policy: "${platform}"`);
  }
  return segments;
}
