/**
 * Primary reference target for the DOOM Codex project.
 *
 * Every constant here is pinned to the exact version, hash, and
 * behavioral identity of the reference executable and WAD that all
 * oracle captures and parity tests are measured against.
 *
 * @example
 * ```ts
 * import { PRIMARY_TARGET } from "../src/reference/target.ts";
 * console.log(PRIMARY_TARGET.engine); // "Chocolate Doom"
 * ```
 */

export interface ReferenceTarget {
  /** Display name of the source-port engine. */
  readonly engine: string;
  /** Exact release version of the engine. */
  readonly engineVersion: string;
  /** Vanilla DOOM version the engine emulates. */
  readonly emulatedVersion: string;
  /** Game mode string printed at startup. */
  readonly gameMode: string;
  /** SHA-256 of the merged polyglot DOOM.EXE. */
  readonly executableHash: string;
  /** SHA-256 of the DOS-only DOOMD.EXE. */
  readonly dosExecutableHash: string;
  /** SHA-256 of the shareware IWAD (DOOM1.WAD). */
  readonly wadHash: string;
  /** WAD filename used for all reference runs. */
  readonly wadFilename: string;
  /** Number of lumps in the shareware IWAD. */
  readonly wadLumpCount: number;
  /** Tic rate in Hz the engine runs the game loop at. */
  readonly ticRateHz: number;
}

export const PRIMARY_TARGET: ReferenceTarget = Object.freeze({
  engine: 'Chocolate Doom',
  engineVersion: '2.2.1',
  emulatedVersion: '1.9',
  gameMode: 'shareware',
  executableHash: '5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2',
  dosExecutableHash: '9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B',
  wadHash: '1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771',
  wadFilename: 'DOOM1.WAD',
  wadLumpCount: 1264,
  ticRateHz: 35,
});
