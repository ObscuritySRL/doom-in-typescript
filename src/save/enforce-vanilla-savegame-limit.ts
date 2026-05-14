/**
 * Vanilla DOOM 1.9 savegame size limit contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c:
 *
 *   #define SAVEGAMESIZE  0x2c000
 *   ...
 *   if (length >= SAVEGAMESIZE) {
 *     I_Error ("Savegame buffer overrun");
 *   }
 *
 * Parity-critical details:
 *   - SAVEGAMESIZE = 0x2c000 bytes = 180224 decimal. The vanilla
 *     buffer is a fixed-size stack allocation in G_DoSaveGame; any
 *     overflow triggers `I_Error` with the literal string
 *     "Savegame buffer overrun" (exact match required for parity).
 *   - The `vanilla_savegame_limit` cvar from chocolate-doom.cfg
 *     governs whether the limit is enforced. Setting it to 0
 *     allows arbitrarily large saves; default is 1 (enforce).
 *   - The check uses `>=` not `>`, so a file of EXACTLY 0x2c000
 *     bytes is the maximum WRITABLE size. Writing 0x2c000 bytes
 *     would push the next write past the buffer boundary; the
 *     check fires the cycle BEFORE that next write.
 *   - On overflow, vanilla calls `I_Error` which calls
 *     `I_ShutdownGraphics`, prints the error, and `exit(-1)`.
 *     Chocolate Doom Windows port also displays a system dialog.
 *   - The cap is independent of `SAVESTRINGSIZE` (24, description)
 *     and `VERSIONSIZE` (16, version magic) — those govern fixed
 *     header fields, not buffer total.
 */

export const VANILLA_SAVEGAMESIZE = 0x2c000;

export const VANILLA_SAVEGAMESIZE_DECIMAL = 180224;

export const VANILLA_SAVEGAME_BUFFER_OVERRUN_ERROR = 'Savegame buffer overrun';

export const VANILLA_SAVEGAME_LIMIT_DEFAULT_ENABLED = 1;

export function vanillaSaveGameLimitExceeded(buffer_bytes_written: number): boolean {
  if (!Number.isInteger(buffer_bytes_written) || buffer_bytes_written < 0) {
    throw new RangeError(`buffer_bytes_written must be a non-negative integer (got ${buffer_bytes_written})`);
  }
  return buffer_bytes_written >= VANILLA_SAVEGAMESIZE;
}

export function assertVanillaSaveGameLimit(buffer_bytes_written: number): void {
  if (vanillaSaveGameLimitExceeded(buffer_bytes_written)) {
    throw new RangeError(VANILLA_SAVEGAME_BUFFER_OVERRUN_ERROR);
  }
}
