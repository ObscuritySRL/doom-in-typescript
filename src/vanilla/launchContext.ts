/**
 * Vanilla DOOM 1.9 launch context: the resolved set of paths and
 * derived facts the launch lane needs before the engine init order
 * runs.
 *
 * Plan_final step `03-004` (lane: launch-host-input) wires four
 * discovery results into a single typed context object so subsequent
 * steps (init order, asset load, host bring-up) can consume them
 * without re-deriving the same paths.  The four wired discoveries:
 *
 *   - **IWAD**.  When `-iwad <path>` is supplied on the command line
 *     (a Chocolate Doom 2.2.1 layer over vanilla `IdentifyVersion`),
 *     that path is honored verbatim and the matched-filename / game
 *     mode are derived from the basename when possible.  When `-iwad`
 *     is absent, the resolution walks the vanilla seven-candidate
 *     probe order pinned by
 *     `src/bootstrap/implement-iwad-discovery-order.ts`
 *     under the effective search directory (`DOOMWADDIR` if set,
 *     otherwise the literal current-working-directory `'.'`).  The
 *     probe is first-match-wins and the matched filename alone pins
 *     the game mode (no lump inspection at this layer — that is left
 *     to the WAD-load step).
 *
 *   - **default.cfg**.  Chocolate Doom 2.2.1 `M_SetConfigFilenames`
 *     installs `"default.cfg"` as the main-config slot for the
 *     vanilla 43-variable namespace, and the `-config <path>` flag
 *     overrides that slot.  When `-config <path>` is absent the
 *     literal filename `"default.cfg"` is returned.
 *
 *   - **chocolate-doom.cfg**.  Chocolate Doom 2.2.1
 *     `M_SetConfigFilenames` also installs `"chocolate-doom.cfg"` as
 *     the extra-config slot for the 113-variable extended namespace.
 *     The corresponding override flag is `-extraconfig <path>`, which
 *     is **not** wired by plan_final step `03-003` (the previous
 *     launch-host-input step), so the resolution for this step
 *     returns the literal filename `"chocolate-doom.cfg"`
 *     unconditionally.  When a later step wires `-extraconfig`, this
 *     resolution will gain the override branch.
 *
 *   - **Save directory**.  Chocolate Doom 2.2.1 `-savedir <path>`
 *     overrides the engine save directory; when absent the
 *     resolution falls back to the literal current-working-directory
 *     `'.'`, matching the vanilla DOS behavior where save slots live
 *     beside the executable.
 *
 * The wrapper does NOT perform any filesystem I/O of its own.  All
 * existence probing is delegated to a caller-supplied
 * {@link LaunchContextEnvironment} so the launch-context resolution
 * stays deterministic and unit-testable.  Subsequent host bring-up
 * steps will adapt a Bun-backed environment that calls
 * `Bun.file(path).exists()` and reads `Bun.env.DOOMWADDIR`.
 *
 * @example
 * ```ts
 * import { resolveLaunchContext } from './launchContext.ts';
 * import { parseCommandLineConfiguration } from './commandLineConfiguration.ts';
 *
 * const configuration = parseCommandLineConfiguration([
 *   'doom_codex',
 *   '-iwad', 'doom/DOOM1.WAD',
 *   '-savedir', 'saves/',
 * ]);
 * const context = resolveLaunchContext(configuration, {
 *   doomWadDirectoryEnvironmentValue: null,
 *   doesBasenameExistInWadDirectory: () => false,
 * });
 * context.iwad.resolvedPath;      // 'doom/DOOM1.WAD'
 * context.iwad.source;            // 'iwad-flag'
 * context.defaultConfigPath;      // 'default.cfg'
 * context.hostConfigPath;         // 'chocolate-doom.cfg'
 * context.saveDirectory;          // 'saves/'
 * ```
 */

import type { GameMission, GameMode } from '../bootstrap/gameMode.ts';
import { identifyMission } from '../bootstrap/gameMode.ts';
import type { VanillaIwadCandidate } from '../bootstrap/implement-iwad-discovery-order.ts';
import { VANILLA_DEFAULT_SEARCH_DIRECTORY, VANILLA_IWAD_CANDIDATES } from '../bootstrap/implement-iwad-discovery-order.ts';
import type { CommandLineConfiguration } from './commandLineConfiguration.ts';

/**
 * Caller-supplied probes that abstract the filesystem and environment
 * the launch-context resolution needs.  Each probe is invoked at most
 * once per resolution; the environment object itself is consumed
 * read-only.
 */
export interface LaunchContextEnvironment {
  /**
   * Value of the `DOOMWADDIR` environment variable, or `null` when the
   * variable is unset.  Following the vanilla `IdentifyVersion`
   * contract, a present-but-empty string is treated as set and yields
   * a leading-slash candidate path; `null` triggers the
   * current-working-directory fallback `'.'`.
   */
  readonly doomWadDirectoryEnvironmentValue: string | null;

  /**
   * Predicate consulted during IWAD discovery: does the given
   * candidate basename exist on the filesystem under the resolved
   * search directory?  The candidate is one of the seven canonical
   * vanilla candidates (`doom2f.wad`, `doom2.wad`, …, `doom1.wad`).
   * The function is not invoked when `-iwad <path>` is supplied.
   */
  readonly doesBasenameExistInWadDirectory: (basename: VanillaIwadCandidate['filename']) => boolean;
}

/**
 * Resolution result for the IWAD-discovery slot of a launch context.
 *
 * `source` records whether the path came from the explicit `-iwad`
 * flag or from the vanilla seven-candidate probe walk.  In the
 * `'iwad-flag'` branch the probe sequence is empty and
 * `matchedFilename` is the lowercase basename of the supplied path
 * iff that basename is one of the seven canonical candidates;
 * otherwise it is `null` and `gameMode` falls back to whatever
 * `identifyMission` recognized (mapped to `'indetermined'` when the
 * basename is unknown).
 */
export interface ResolvedIwad {
  /** Whether the path came from `-iwad <path>` or from automatic probe walking. */
  readonly source: 'discovery' | 'iwad-flag';
  /** The path that will be opened for the IWAD load.  Always non-empty. */
  readonly resolvedPath: string;
  /** The directory the candidate was resolved against, or `null` for `iwad-flag` mode. */
  readonly searchDirectory: string | null;
  /** The matched canonical candidate basename, or `null` when no canonical match was made. */
  readonly matchedFilename: VanillaIwadCandidate['filename'] | null;
  /** The candidate sequence the probe walked.  Empty for `iwad-flag` mode. */
  readonly probedSequence: readonly VanillaIwadCandidate['filename'][];
  /** Game mode pinned by the matched canonical filename. */
  readonly gameMode: GameMode;
  /** Game mission derived from the matched canonical filename. */
  readonly gameMission: GameMission;
}

/**
 * Typed launch context wiring four discovery results: IWAD, vanilla
 * `default.cfg`, Chocolate Doom `chocolate-doom.cfg`, and the save
 * directory.  Every field is required and the returned object is
 * frozen so downstream subsystems cannot mutate the resolved
 * contract.
 */
export interface LaunchContext {
  readonly iwad: ResolvedIwad;
  readonly defaultConfigPath: string;
  readonly hostConfigPath: string;
  readonly saveDirectory: string;
}

/** Literal Chocolate Doom 2.2.1 main-config filename installed by `M_SetConfigFilenames("default.cfg", ...)`. */
export const VANILLA_DEFAULT_CONFIG_FILENAME = 'default.cfg';

/** Literal Chocolate Doom 2.2.1 extra-config filename installed by `M_SetConfigFilenames(..., "chocolate-doom.cfg")`. */
export const HOST_EXTRA_CONFIG_FILENAME = 'chocolate-doom.cfg';

/**
 * Resolve the effective IWAD-discovery search directory from an
 * environment probe.  Mirrors the vanilla `IdentifyVersion` rule
 * `if (!doomwaddir) doomwaddir = ".";` — a `null` environment value
 * (unset variable) collapses to the literal current-working-directory
 * `'.'`, while an empty-string value is treated as set and yields the
 * literal empty prefix.
 */
function resolveWadSearchDirectory(environment: LaunchContextEnvironment): string {
  if (environment.doomWadDirectoryEnvironmentValue === null) {
    return VANILLA_DEFAULT_SEARCH_DIRECTORY;
  }
  return environment.doomWadDirectoryEnvironmentValue;
}

/**
 * Compose a candidate path under a search directory.  Empty search
 * directories yield a leading `'/'` prefix (matching the vanilla
 * `sprintf("%s/%s", doomwaddir, filename)` behavior); a `'.'` prefix
 * yields a leading `'./'`; any other prefix is concatenated with a
 * single `'/'` separator.
 */
function composeCandidatePath(searchDirectory: string, candidateBasename: string): string {
  return `${searchDirectory}/${candidateBasename}`;
}

/**
 * Extract a lowercase basename from a path that may use either
 * forward-slash or backslash separators.  Used to recognize whether
 * an explicit `-iwad <path>` argument names one of the seven
 * canonical vanilla candidates.
 */
function extractLowercaseBasename(path: string): string {
  const segments = path.split(/[/\\]/);
  const tail = segments[segments.length - 1] ?? '';
  return tail.toLowerCase();
}

function findCanonicalCandidate(basename: string): VanillaIwadCandidate | null {
  for (const candidate of VANILLA_IWAD_CANDIDATES) {
    if (candidate.filename === basename) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve the IWAD slot of a launch context.  When the
 * configuration's `iwadPath` field is non-null (i.e. `-iwad <path>`
 * was supplied), the explicit path is honored verbatim.  Otherwise
 * the canonical seven-candidate probe walks under the resolved
 * search directory and the first match wins; if no candidate
 * matches, the result reports `'indetermined'` with a null matched
 * filename and the full seven-entry probe sequence.
 */
function resolveIwad(configuration: CommandLineConfiguration, environment: LaunchContextEnvironment): ResolvedIwad {
  if (configuration.iwadPath !== null) {
    const lowercaseBasename = extractLowercaseBasename(configuration.iwadPath);
    const canonical = findCanonicalCandidate(lowercaseBasename);
    const gameMission = identifyMission(configuration.iwadPath);
    if (canonical !== null) {
      return Object.freeze({
        gameMission,
        gameMode: canonical.gameMode,
        matchedFilename: canonical.filename,
        probedSequence: Object.freeze<VanillaIwadCandidate['filename'][]>([]),
        resolvedPath: configuration.iwadPath,
        searchDirectory: null,
        source: 'iwad-flag',
      });
    }
    return Object.freeze({
      gameMission,
      gameMode: 'indetermined',
      matchedFilename: null,
      probedSequence: Object.freeze<VanillaIwadCandidate['filename'][]>([]),
      resolvedPath: configuration.iwadPath,
      searchDirectory: null,
      source: 'iwad-flag',
    });
  }

  const searchDirectory = resolveWadSearchDirectory(environment);
  const probed: VanillaIwadCandidate['filename'][] = [];
  for (const candidate of VANILLA_IWAD_CANDIDATES) {
    probed.push(candidate.filename);
    if (environment.doesBasenameExistInWadDirectory(candidate.filename)) {
      return Object.freeze({
        gameMission: identifyMission(candidate.filename),
        gameMode: candidate.gameMode,
        matchedFilename: candidate.filename,
        probedSequence: Object.freeze([...probed]),
        resolvedPath: composeCandidatePath(searchDirectory, candidate.filename),
        searchDirectory,
        source: 'discovery',
      });
    }
  }

  return Object.freeze({
    gameMission: 'none',
    gameMode: 'indetermined',
    matchedFilename: null,
    probedSequence: Object.freeze([...probed]),
    resolvedPath: composeCandidatePath(searchDirectory, VANILLA_IWAD_CANDIDATES[VANILLA_IWAD_CANDIDATES.length - 1]!.filename),
    searchDirectory,
    source: 'discovery',
  });
}

/**
 * Resolve the `default.cfg` slot of a launch context.  Honors the
 * Chocolate Doom 2.2.1 `-config <path>` override and otherwise
 * returns the literal filename `"default.cfg"`.  Empty-string paths
 * are rejected upstream by `parseCommandLineConfiguration`, so the
 * non-null branch always returns a non-empty path.
 */
function resolveDefaultConfigPath(configuration: CommandLineConfiguration): string {
  if (configuration.configPath !== null) {
    return configuration.configPath;
  }
  return VANILLA_DEFAULT_CONFIG_FILENAME;
}

/**
 * Resolve the `chocolate-doom.cfg` slot of a launch context.
 * Plan_final step `03-003` does not wire `-extraconfig`, so the
 * resolution returns the literal filename
 * `"chocolate-doom.cfg"` unconditionally.  A later step that wires
 * `-extraconfig <path>` will gain the override branch here.
 */
function resolveHostConfigPath(): string {
  return HOST_EXTRA_CONFIG_FILENAME;
}

/**
 * Resolve the save-directory slot of a launch context.  Honors the
 * Chocolate Doom 2.2.1 `-savedir <path>` override and otherwise
 * falls back to the literal current-working-directory `'.'`,
 * matching the vanilla DOS behavior where save slots live beside
 * the executable.  Empty paths are rejected upstream by
 * `parseCommandLineConfiguration`.
 */
function resolveSaveDirectory(configuration: CommandLineConfiguration): string {
  if (configuration.savedirPath !== null) {
    return configuration.savedirPath;
  }
  return VANILLA_DEFAULT_SEARCH_DIRECTORY;
}

/**
 * Resolve a complete {@link LaunchContext} from a parsed
 * {@link CommandLineConfiguration} and a caller-supplied
 * {@link LaunchContextEnvironment}.  The returned object is frozen
 * and the IWAD slot inside it is frozen as well.
 *
 * @param configuration A parsed vanilla command-line configuration.
 * @param environment   Probes that abstract the filesystem and
 *                      `DOOMWADDIR` environment value.
 * @returns A frozen launch context with every slot resolved.
 *
 * @example
 * ```ts
 * resolveLaunchContext(parseCommandLineConfiguration(['doom_codex']), {
 *   doomWadDirectoryEnvironmentValue: null,
 *   doesBasenameExistInWadDirectory: (basename) => basename === 'doom1.wad',
 * });
 * // => { iwad: { source: 'discovery', resolvedPath: './doom1.wad', ... },
 * //      defaultConfigPath: 'default.cfg',
 * //      hostConfigPath: 'chocolate-doom.cfg',
 * //      saveDirectory: '.' }
 * ```
 */
export function resolveLaunchContext(configuration: CommandLineConfiguration, environment: LaunchContextEnvironment): LaunchContext {
  return Object.freeze({
    defaultConfigPath: resolveDefaultConfigPath(configuration),
    hostConfigPath: resolveHostConfigPath(),
    iwad: resolveIwad(configuration, environment),
    saveDirectory: resolveSaveDirectory(configuration),
  });
}
