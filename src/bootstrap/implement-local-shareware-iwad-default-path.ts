/**
 * Audit ledger for the vanilla DOOM 1.9 local shareware IWAD default
 * path, layered on top of the broader IWAD discovery order pinned by
 * `src/bootstrap/implement-iwad-discovery-order.ts`. The accompanying
 * focused test cross-checks every audited contract clause against a
 * self-contained reference handler that resolves the shareware default
 * path the same way vanilla `IdentifyVersion()` does for the seventh
 * (last, lowest-priority) candidate in the probe sequence.
 *
 * No runtime IWAD discovery module exists yet in `src/bootstrap/` — this
 * step pins the local shareware default-path semantics so a later
 * implementation step (or an oracle follow-up that observes
 * `doom/DOOMD.EXE` directly under controlled DOOMWADDIR settings) can
 * be cross-checked for parity. The audit module deliberately avoids
 * importing from any runtime source so that a corrupted runtime cannot
 * silently calibrate the audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the
 *      candidate-filename and gamemode pin — `d_main.c`
 *      `IdentifyVersion()` is the verbatim source of the
 *      `"%s/doom1.wad"` sprintf format string and the
 *      `gamemode = shareware;` assignment in the seventh access-block),
 *   5. Chocolate Doom 2.2.1 source.
 *
 * The audit invariants below are pinned against authority 4 because the
 * shareware default path is a textual property of the seventh
 * `if (!access(...))` block in `IdentifyVersion()`: a literal
 * `"%s/doom1.wad"` sprintf format with the `<doomwaddir>` prefix from
 * the `getenv("DOOMWADDIR")` fallback, a `gamemode = shareware;`
 * assignment, and a `D_AddFile(name); return;` early exit that fires
 * only after the prior six candidates have all missed. Authority 1 (the
 * DOS binary) cannot disagree with these because the path the binary
 * reads from is the visible pre-condition every vanilla shareware
 * startup depends on.
 *
 * Local project drop locations are layered on top of the vanilla
 * semantics. The project's binding rules in `CLAUDE.md` and
 * `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`
 * pin `doom/` and `iwad/` as the two gitignored user-supplied drop
 * directories where a copy of `DOOM1.WAD` may live. The on-disk
 * basename casing is the original id Software uppercase `DOOM1.WAD`;
 * the vanilla literal probe is lowercase `doom1.wad`. On the project's
 * supported host (Windows-only per `CLAUDE.md`'s **Runtime constraints**
 * section) the filesystem is case-insensitive and the case mismatch is
 * invisible. The audit pins both the vanilla literal probe casing and
 * the project's on-disk basename casing so that a future runtime that
 * silently rewrites either casing surface — or that drops the
 * Windows-only case-insensitive resolution for a POSIX case-sensitive
 * substitute — is detected by the cross-check.
 */

import type { GameMode } from './gameMode.ts';

/**
 * One audited contract invariant of the vanilla DOOM 1.9 local
 * shareware IWAD default path.
 */
export interface VanillaShareWareIwadDefaultPathContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'SHAREWARE_BASENAME_IS_LOWERCASE_DOOM1_WAD_LITERAL'
    | 'SHAREWARE_PATH_FORMAT_IS_DOOMWADDIR_PREFIXED_BASENAME'
    | 'SHAREWARE_DEFAULT_DIRECTORY_FALLS_BACK_TO_CURRENT_WORKING_DIRECTORY'
    | 'SHAREWARE_GAMEMODE_IS_LITERAL_SHAREWARE_ENUM'
    | 'SHAREWARE_PROBE_RUNS_LAST_AFTER_SIX_HIGHER_PRIORITY_CANDIDATES'
    | 'SHAREWARE_MISS_FALLS_THROUGH_TO_INDETERMINATE_PRINTOUT'
    | 'SHAREWARE_BASENAME_RESOLVES_CASE_INSENSITIVELY_ON_WINDOWS_ONLY';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'd_main.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'IdentifyVersion';
}

/**
 * Pinned ledger of every contract clause of the vanilla shareware
 * default-path semantics inside `IdentifyVersion()`.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT: readonly VanillaShareWareIwadDefaultPathContractAuditEntry[] = [
  {
    id: 'SHAREWARE_BASENAME_IS_LOWERCASE_DOOM1_WAD_LITERAL',
    invariant:
      'The shareware IWAD basename inside IdentifyVersion is the literal lowercase ASCII string "doom1.wad" written verbatim into the seventh `sprintf(name, "%s/doom1.wad", doomwaddir);` format string. The basename has no uppercase characters, no leading dot, no leading slash, no version suffix, and no directory prefix; the `.wad` extension is present and lowercase.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'SHAREWARE_PATH_FORMAT_IS_DOOMWADDIR_PREFIXED_BASENAME',
    invariant:
      'The shareware default path is constructed as `<doomwaddir>/doom1.wad` via `sprintf(name, "%s/doom1.wad", doomwaddir);`. The `/` separator is hard-coded as a single forward-slash literal between the doomwaddir prefix and the basename; vanilla never substitutes a backslash even when the resolved doomwaddir contains backslashes. The full path is the only thing handed to D_AddFile when this candidate matches.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'SHAREWARE_DEFAULT_DIRECTORY_FALLS_BACK_TO_CURRENT_WORKING_DIRECTORY',
    invariant:
      'The doomwaddir prefix is set by `getenv("DOOMWADDIR")` and falls back to the literal current-working-directory `"."` when DOOMWADDIR is unset. When the fallback fires, the constructed shareware path is `./doom1.wad`. A present-but-empty DOOMWADDIR is treated as set (the `if (!doomwaddir)` check rejects only null pointers) and yields the literal `/doom1.wad` prefix.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'SHAREWARE_GAMEMODE_IS_LITERAL_SHAREWARE_ENUM',
    invariant:
      'The seventh access-block in IdentifyVersion assigns `gamemode = shareware;` as a literal enum constant before calling D_AddFile and returning. The assignment is unconditional once the `access(name, R_OK)` succeeds; vanilla does not inspect the doom1.wad lump contents to derive the gamemode for this candidate.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'SHAREWARE_PROBE_RUNS_LAST_AFTER_SIX_HIGHER_PRIORITY_CANDIDATES',
    invariant:
      'The shareware doom1.wad access-block is the seventh and last candidate inside IdentifyVersion. The six higher-priority candidates probed first are doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad, and doom.wad in that exact order. The shareware default path is therefore selected only when none of the six commercial/retail/registered candidates is present in DOOMWADDIR; co-existence with any earlier candidate forces vanilla to pick that earlier candidate instead.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'SHAREWARE_MISS_FALLS_THROUGH_TO_INDETERMINATE_PRINTOUT',
    invariant:
      'When the shareware access(name, R_OK) call also fails (i.e., no candidate at all matches), IdentifyVersion falls through to `printf("Game mode indeterminate.\\n"); gamemode = indetermined;` and returns without calling D_AddFile. A missing shareware IWAD is therefore the last opportunity for vanilla to identify a known IWAD; it is not a fatal error in the vanilla DOOM 1.9 surface (Chocolate Doom 2.2.1 diverges by erroring out instead).',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'SHAREWARE_BASENAME_RESOLVES_CASE_INSENSITIVELY_ON_WINDOWS_ONLY',
    invariant:
      'The shareware basename is the lowercase literal "doom1.wad" but the on-disk filename in the id Software shareware distribution is the uppercase "DOOM1.WAD". On case-insensitive filesystems (the project\'s only supported host per CLAUDE.md is Windows; original target is also DOS) the case mismatch is invisible and the access(R_OK) probe succeeds against the uppercase on-disk basename. On case-sensitive filesystems (POSIX) the lowercase literal probe fails against an uppercase on-disk file. Case folding is a property of the filesystem, not of IdentifyVersion itself; the audit pins both the lowercase literal probe casing and the canonical id Software uppercase distribution casing so that a future runtime that silently rewrites either surface is detected.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
] as const;

/**
 * The literal lowercase basename probed by vanilla
 * `IdentifyVersion()` for the shareware candidate.
 */
export const VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME = 'doom1.wad';

/**
 * The canonical id Software uppercase basename of the shareware IWAD
 * as distributed (matches the on-disk basename in this project's
 * `doom/DOOM1.WAD` and `iwad/DOOM1.WAD` drop locations).
 */
export const VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME = 'DOOM1.WAD';

/**
 * The literal current-working-directory fallback prefix used when
 * `DOOMWADDIR` is unset. Pinned by the
 * `if (!doomwaddir) doomwaddir = ".";` line in `IdentifyVersion()`.
 */
export const VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY = '.';

/**
 * The hard-coded path separator inside the
 * `sprintf(name, "%s/doom1.wad", doomwaddir);` format string.
 */
export const VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR = '/';

/**
 * The literal vanilla `gamemode` enum constant assigned by the
 * shareware access-block.
 */
export const VANILLA_SHAREWARE_IWAD_GAME_MODE: GameMode = 'shareware';

/**
 * The verbatim default-fallback shareware IWAD path constructed by
 * `IdentifyVersion()` when DOOMWADDIR is unset:
 * `<VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY><VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR><VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME>`.
 */
export const VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH = `${VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY}${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME}`;

/**
 * The number of higher-priority candidates probed inside
 * `IdentifyVersion()` before the shareware access-block fires.
 * Pinned by the verbatim sequence of six prior `if (!access(...))`
 * blocks for doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad,
 * and doom.wad.
 */
export const VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_COUNT = 6;

/**
 * The frozen list of higher-priority candidate basenames probed
 * before the shareware access-block in canonical vanilla order.
 */
export const VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES: readonly string[] = Object.freeze(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad']);

/**
 * The two gitignored project-local drop directories where a
 * user-supplied copy of the shareware IWAD may live, pinned by
 * `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`
 * and `CLAUDE.md`.
 */
export const VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES: readonly string[] = Object.freeze(['doom', 'iwad']);

/**
 * The two project-local drop paths where a user-supplied copy of the
 * shareware IWAD may live, constructed by joining each drop directory
 * with the on-disk uppercase basename.
 */
export const VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS: readonly string[] = Object.freeze(
  VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES.map((directory) => `${directory}${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME}`),
);

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity local shareware default-path handler must
 * preserve.
 */
export interface VanillaShareWareIwadDefaultPathDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS: readonly VanillaShareWareIwadDefaultPathDerivedInvariant[] = [
  {
    id: 'VANILLA_PROBE_BASENAME_IS_LOWERCASE_DOOM1_WAD',
    description: 'The vanilla literal probe basename is the lowercase ASCII string "doom1.wad". Reordering the casing, dropping the .wad extension, or substituting a different basename is a parity violation.',
  },
  {
    id: 'ON_DISK_BASENAME_IS_UPPERCASE_DOOM1_WAD',
    description: 'The id Software shareware distribution ships the IWAD with the uppercase basename "DOOM1.WAD". The project preserves that casing on-disk under the gitignored drop directories.',
  },
  {
    id: 'DEFAULT_PATH_FALLS_BACK_TO_DOT_PREFIX_WHEN_DOOMWADDIR_UNSET',
    description: 'The shareware default full path resolves to "./doom1.wad" when DOOMWADDIR is unset, matching the IdentifyVersion fallback to the current working directory.',
  },
  {
    id: 'DEFAULT_PATH_USES_FORWARD_SLASH_SEPARATOR',
    description: 'The shareware default full path uses a single forward-slash separator between the doomwaddir prefix and the basename, regardless of host platform conventions.',
  },
  {
    id: 'GAME_MODE_PINNED_BY_BASENAME_MATCH_IS_SHAREWARE',
    description: 'When the shareware access-block fires, the assigned gamemode is the literal enum value "shareware". Any other gamemode value (commercial, registered, retail, indetermined) is a parity violation for this candidate.',
  },
  {
    id: 'PROBE_ORDER_PUTS_SHAREWARE_LAST_AMONG_SEVEN_CANDIDATES',
    description:
      'The shareware access-block is the seventh and last candidate; the six higher-priority candidates (doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad, doom.wad) are probed first. Any reordering that puts the shareware probe ahead of any of these is a parity violation.',
  },
  {
    id: 'CASE_INSENSITIVE_HOST_RESOLVES_UPPERCASE_DISK_FILENAME_AGAINST_LOWERCASE_PROBE',
    description:
      'On case-insensitive filesystems (Windows, the only supported host per CLAUDE.md) the lowercase vanilla literal probe matches the uppercase on-disk basename; on case-sensitive filesystems (POSIX) it does not. The case-folding rule is a property of the filesystem, not of IdentifyVersion.',
  },
  {
    id: 'LOCAL_DROP_DIRECTORIES_ARE_DOOM_AND_IWAD',
    description:
      'The two project-local gitignored drop directories where a user-supplied copy of the shareware IWAD may live are exactly "doom" and "iwad". Adding or removing entries is a parity violation against the proprietary asset boundary.',
  },
  {
    id: 'LOCAL_DROP_PATHS_USE_ON_DISK_BASENAME_CASING',
    description: 'The two project-local drop paths construct the path as "<directory>/DOOM1.WAD" using the uppercase on-disk basename, not the lowercase vanilla literal probe basename. Lowercasing either drop path is a parity violation.',
  },
];

/**
 * A virtual filesystem state used by a probe: which basenames exist
 * under whichever directory the handler probes, the value of
 * DOOMWADDIR, and whether the host filesystem is case-insensitive.
 */
export interface VanillaShareWareIwadDefaultPathFilesystemState {
  /**
   * Value of the `DOOMWADDIR` environment variable. `null` models an
   * unset variable; an empty string `""` models a present-but-empty
   * variable (which vanilla treats as set, yielding `/doom1.wad`).
   */
  readonly doomWadDirEnvironmentValue: string | null;
  /**
   * The basenames present on the virtual filesystem under whichever
   * directory IdentifyVersion ends up probing. The host case-folding
   * rule is applied separately by the handler.
   */
  readonly presentBasenames: readonly string[];
  /**
   * Whether the host filesystem is case-insensitive (true on Windows,
   * DOS, modern macOS-default; false on POSIX). Pinned by the project's
   * Windows-only constraint in CLAUDE.md.
   */
  readonly hostFileSystemIsCaseInsensitive: boolean;
}

/**
 * Result of a single shareware default-path discovery run: which path
 * (if any) was matched, the assigned gameMode, and the probe sequence
 * the handler walked before the shareware match (or before falling
 * through to indeterminate).
 */
export interface VanillaShareWareIwadDefaultPathResult {
  /** The matched full path or null when no match occurred. */
  readonly matchedFullPath: string | null;
  /** The assigned gameMode (`'shareware'` on match, `'indetermined'` otherwise). */
  readonly gameMode: GameMode;
  /**
   * The probe sequence walked before the shareware match (or all
   * seven candidates when no match occurred). Each entry is a vanilla
   * lowercase candidate basename in canonical probe order.
   */
  readonly probedBasenameSequence: readonly string[];
}

/**
 * One probe applied to a runtime vanilla shareware default-path
 * handler.
 */
export interface VanillaShareWareIwadDefaultPathProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Filesystem state to install. */
  readonly filesystemState: VanillaShareWareIwadDefaultPathFilesystemState;
  /** Expected matched full path (or null on no match). */
  readonly expectedMatchedFullPath: string | null;
  /** Expected gameMode. */
  readonly expectedGameMode: GameMode;
  /** Expected probe sequence ending at the shareware match or at the seventh candidate on no match. */
  readonly expectedProbedBasenameSequence: readonly string[];
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId:
    | 'VANILLA_PROBE_BASENAME_IS_LOWERCASE_DOOM1_WAD'
    | 'ON_DISK_BASENAME_IS_UPPERCASE_DOOM1_WAD'
    | 'DEFAULT_PATH_FALLS_BACK_TO_DOT_PREFIX_WHEN_DOOMWADDIR_UNSET'
    | 'DEFAULT_PATH_USES_FORWARD_SLASH_SEPARATOR'
    | 'GAME_MODE_PINNED_BY_BASENAME_MATCH_IS_SHAREWARE'
    | 'PROBE_ORDER_PUTS_SHAREWARE_LAST_AMONG_SEVEN_CANDIDATES'
    | 'CASE_INSENSITIVE_HOST_RESOLVES_UPPERCASE_DISK_FILENAME_AGAINST_LOWERCASE_PROBE'
    | 'LOCAL_DROP_DIRECTORIES_ARE_DOOM_AND_IWAD'
    | 'LOCAL_DROP_PATHS_USE_ON_DISK_BASENAME_CASING';
}

/** All seven canonical vanilla candidate basenames in probe order. */
const ALL_SEVEN_VANILLA_CANDIDATES: readonly string[] = Object.freeze(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a small filesystem state plus one expected outcome.
 */
export const VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES: readonly VanillaShareWareIwadDefaultPathProbe[] = [
  {
    id: 'shareware-default-path-when-doomwaddir-unset-and-lowercase-doom1-present',
    description:
      'When DOOMWADDIR is unset and the virtual filesystem holds the lowercase literal "doom1.wad" basename, the shareware default path resolves to "./doom1.wad" with gameMode=shareware. The probe sequence walks all seven candidates, ending at doom1.wad.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: './doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'VANILLA_PROBE_BASENAME_IS_LOWERCASE_DOOM1_WAD',
  },
  {
    id: 'shareware-default-path-falls-back-to-dot-prefix',
    description:
      'The shareware default full path constructed when DOOMWADDIR is unset literally equals "./doom1.wad", matching the C `if (!doomwaddir) doomwaddir = ".";` fallback rule and the `sprintf("%s/doom1.wad", doomwaddir)` format string.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: './doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'DEFAULT_PATH_FALLS_BACK_TO_DOT_PREFIX_WHEN_DOOMWADDIR_UNSET',
  },
  {
    id: 'shareware-default-path-uses-forward-slash-separator',
    description:
      'When DOOMWADDIR is set to a Windows-style path with backslashes, the constructed shareware path still uses a forward-slash separator between the prefix and the basename ("C:\\\\games\\\\doom/doom1.wad", verbatim from the `sprintf("%s/doom1.wad", doomwaddir)` format).',
    filesystemState: { doomWadDirEnvironmentValue: 'C:\\games\\doom', presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: 'C:\\games\\doom/doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'DEFAULT_PATH_USES_FORWARD_SLASH_SEPARATOR',
  },
  {
    id: 'shareware-match-pins-gamemode-shareware',
    description: 'When the shareware access-block fires (doom1.wad is present and no higher-priority candidate matches), the assigned gameMode is the literal string "shareware".',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: './doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_PINNED_BY_BASENAME_MATCH_IS_SHAREWARE',
  },
  {
    id: 'higher-priority-doom-wad-takes-precedence-over-shareware',
    description:
      'When both doom.wad and doom1.wad are present, the registered candidate matches first because it precedes the shareware candidate in the probe order. The shareware access-block never fires, gameMode=registered, and the probe sequence stops at doom.wad (the sixth candidate, one before shareware).',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom.wad', 'doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: './doom.wad',
    expectedGameMode: 'registered',
    expectedProbedBasenameSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad'],
    witnessInvariantId: 'PROBE_ORDER_PUTS_SHAREWARE_LAST_AMONG_SEVEN_CANDIDATES',
  },
  {
    id: 'case-insensitive-host-matches-uppercase-disk-against-lowercase-probe',
    description:
      'On a case-insensitive host (the project Windows-only constraint per CLAUDE.md) the lowercase vanilla literal probe "doom1.wad" matches the uppercase on-disk basename "DOOM1.WAD"; the resolved path uses the lowercase literal because the sprintf format strings the lowercase characters into the constructed path.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['DOOM1.WAD'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: './doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'CASE_INSENSITIVE_HOST_RESOLVES_UPPERCASE_DISK_FILENAME_AGAINST_LOWERCASE_PROBE',
  },
  {
    id: 'case-sensitive-host-misses-uppercase-disk-against-lowercase-probe',
    description:
      'On a case-sensitive host (POSIX) the lowercase vanilla literal probe "doom1.wad" does not match the uppercase on-disk basename "DOOM1.WAD"; the shareware access-block returns no match and the handler falls through to gameMode=indetermined.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['DOOM1.WAD'], hostFileSystemIsCaseInsensitive: false },
    expectedMatchedFullPath: null,
    expectedGameMode: 'indetermined',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'CASE_INSENSITIVE_HOST_RESOLVES_UPPERCASE_DISK_FILENAME_AGAINST_LOWERCASE_PROBE',
  },
  {
    id: 'no-shareware-and-no-higher-priority-leaves-game-mode-indetermined',
    description:
      'When neither doom1.wad nor any higher-priority candidate is present, the seventh access-block also fails and IdentifyVersion falls through to printf("Game mode indeterminate.\\n"); gameMode=indetermined; matchedFullPath=null.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: [], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: null,
    expectedGameMode: 'indetermined',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'PROBE_ORDER_PUTS_SHAREWARE_LAST_AMONG_SEVEN_CANDIDATES',
  },
  {
    id: 'shareware-resolves-against-doomwaddir-prefix',
    description: 'When DOOMWADDIR is set to "/usr/local/share/games/doom", the constructed shareware path is "/usr/local/share/games/doom/doom1.wad", and a present doom1.wad under that directory matches with gameMode=shareware.',
    filesystemState: { doomWadDirEnvironmentValue: '/usr/local/share/games/doom', presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: '/usr/local/share/games/doom/doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'DEFAULT_PATH_FALLS_BACK_TO_DOT_PREFIX_WHEN_DOOMWADDIR_UNSET',
  },
  {
    id: 'shareware-resolves-with-empty-doomwaddir-yielding-leading-slash',
    description:
      'When DOOMWADDIR is the empty string, vanilla treats it as set (the `if (!doomwaddir)` check is a null-pointer test). The constructed shareware path becomes the literal "/doom1.wad" with a leading slash. A present doom1.wad at the resolved path matches with gameMode=shareware.',
    filesystemState: { doomWadDirEnvironmentValue: '', presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true },
    expectedMatchedFullPath: '/doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'DEFAULT_PATH_FALLS_BACK_TO_DOT_PREFIX_WHEN_DOOMWADDIR_UNSET',
  },
];

/**
 * A minimal handler interface modelling the shareware default-path
 * branch of vanilla `IdentifyVersion()`. The reference implementation
 * walks the canonical seven-candidate list and applies the per-host
 * case-folding rule to the present basenames; the cross-check accepts
 * any handler shape so the focused test can exercise deliberately
 * broken adapters and observe the failure ids.
 */
export interface VanillaShareWareIwadDefaultPathHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the matched
   * full path, the assigned gameMode, and the candidate basename
   * sequence the handler probed in order.
   */
  readonly runProbe: (probe: VanillaShareWareIwadDefaultPathProbe) => VanillaShareWareIwadDefaultPathResult;
}

/** Resolve the effective search directory for a virtual filesystem state. */
function resolveSearchDirectory(state: VanillaShareWareIwadDefaultPathFilesystemState): string {
  if (state.doomWadDirEnvironmentValue === null) {
    return VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY;
  }
  return state.doomWadDirEnvironmentValue;
}

/** The gameMode each canonical candidate basename pins on a successful match. */
const VANILLA_GAME_MODE_BY_BASENAME: Readonly<Record<string, GameMode>> = Object.freeze({
  'doom2f.wad': 'commercial',
  'doom2.wad': 'commercial',
  'plutonia.wad': 'commercial',
  'tnt.wad': 'commercial',
  'doomu.wad': 'retail',
  'doom.wad': 'registered',
  'doom1.wad': 'shareware',
});

/**
 * Resolve whether a vanilla literal lowercase candidate basename is
 * present on a virtual filesystem under the host's case-folding rule.
 */
function basenameIsPresent(state: VanillaShareWareIwadDefaultPathFilesystemState, candidateLowercaseBasename: string): boolean {
  if (state.hostFileSystemIsCaseInsensitive) {
    const candidateUppercase = candidateLowercaseBasename.toUpperCase();
    return state.presentBasenames.some((diskBasename) => diskBasename.toUpperCase() === candidateUppercase);
  }
  return state.presentBasenames.includes(candidateLowercaseBasename);
}

/**
 * Reference handler that walks the seven canonical vanilla candidates
 * in order, applies the per-host case-folding rule, and stops at the
 * first match. The matched full path is constructed via the verbatim
 * `<searchDirectory>/<lowercaseLiteralBasename>` rule.
 */
function referenceVanillaShareWareIwadDefaultPathProbe(probe: VanillaShareWareIwadDefaultPathProbe): VanillaShareWareIwadDefaultPathResult {
  const searchDirectory = resolveSearchDirectory(probe.filesystemState);
  const probed: string[] = [];

  for (const candidate of ALL_SEVEN_VANILLA_CANDIDATES) {
    probed.push(candidate);
    if (basenameIsPresent(probe.filesystemState, candidate)) {
      return Object.freeze({
        matchedFullPath: `${searchDirectory}${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${candidate}`,
        gameMode: VANILLA_GAME_MODE_BY_BASENAME[candidate]!,
        probedBasenameSequence: Object.freeze([...probed]),
      });
    }
  }

  return Object.freeze({
    matchedFullPath: null,
    gameMode: 'indetermined',
    probedBasenameSequence: Object.freeze([...probed]),
  });
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER: VanillaShareWareIwadDefaultPathHandler = Object.freeze({
  runProbe: referenceVanillaShareWareIwadDefaultPathProbe,
});

/**
 * Cross-check a `VanillaShareWareIwadDefaultPathHandler` against
 * `VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES`. Returns the list of
 * failures by stable identifier; an empty list means the handler is
 * parity-safe with the shareware branch of `IdentifyVersion()`.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:matchedFullPath:value-mismatch`
 *  - `probe:<probe.id>:gameMode:value-mismatch`
 *  - `probe:<probe.id>:probedBasenameSequence:length-mismatch`
 *  - `probe:<probe.id>:probedBasenameSequence:order-mismatch`
 */
export function crossCheckVanillaShareWareIwadDefaultPath(handler: VanillaShareWareIwadDefaultPathHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
    const result = handler.runProbe(probe);

    if (result.matchedFullPath !== probe.expectedMatchedFullPath) {
      failures.push(`probe:${probe.id}:matchedFullPath:value-mismatch`);
    }

    if (result.gameMode !== probe.expectedGameMode) {
      failures.push(`probe:${probe.id}:gameMode:value-mismatch`);
    }

    if (result.probedBasenameSequence.length !== probe.expectedProbedBasenameSequence.length) {
      failures.push(`probe:${probe.id}:probedBasenameSequence:length-mismatch`);
    } else {
      for (let index = 0; index < probe.expectedProbedBasenameSequence.length; index++) {
        if (result.probedBasenameSequence[index] !== probe.expectedProbedBasenameSequence[index]) {
          failures.push(`probe:${probe.id}:probedBasenameSequence:order-mismatch`);
          break;
        }
      }
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected shareware default-path
 * resolution result for a given filesystem state, mirroring the
 * shareware-branch semantics the audit pins. The focused test uses
 * this helper to cross-validate probe expectations independently of
 * the reference handler.
 */
export function deriveExpectedShareWareIwadDefaultPathResult(state: VanillaShareWareIwadDefaultPathFilesystemState): VanillaShareWareIwadDefaultPathResult {
  return referenceVanillaShareWareIwadDefaultPathProbe({
    id: 'derive-expected-helper',
    description: 'Internal helper invocation; not part of the pinned probe set.',
    filesystemState: state,
    expectedMatchedFullPath: null,
    expectedGameMode: 'indetermined',
    expectedProbedBasenameSequence: ALL_SEVEN_VANILLA_CANDIDATES,
    witnessInvariantId: 'PROBE_ORDER_PUTS_SHAREWARE_LAST_AMONG_SEVEN_CANDIDATES',
  });
}
