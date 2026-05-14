/**
 * Vanilla DOOM 1.9 command-line configuration extracted from a parsed
 * argument vector.
 *
 * Plan_final step `03-003` (lane: launch-host-input) wires the existing
 * vanilla command-line parser at `src/bootstrap/cmdline.ts` into the
 * `runDoomMain` entrypoint surface introduced by `03-001`.  This module
 * defines the typed configuration shape consumed by `runDoomMain` and the
 * extractor that walks a validated argv via the `CommandLine` class and
 * the M_CheckParmWithArgs contract.
 *
 * Chocolate Doom 2.2.1 `D_DoomMain` (`src/d_main.c`) reads the following
 * flags during startup that are relevant to this step:
 *   - `-iwad <path>`       — explicit IWAD selection (Chocolate Doom
 *                            addition layered over vanilla 1.9; pinned
 *                            here as part of the surface the future
 *                            launch lane consumes).
 *   - `-config <path>`     — override default.cfg path.
 *   - `-warp <episode> <map>` for episodic IWADs (Ultimate Doom) or
 *     `-warp <map>` for Doom 2 / Final Doom — warp directly to a map.
 *   - `-playdemo <name>`   — non-blocking demo playback.
 *   - `-timedemo <name>`   — timed demo playback.
 *   - `-skill <1..5>`      — initial skill level.
 *   - `-savedir <path>`    — Chocolate Doom override for the save
 *                            directory.
 *
 * The flag set above is the exact surface plan_final 03-003 commits to.
 * Other vanilla and Chocolate Doom flags (`-file`, `-deh`, `-nomusic`,
 * `-nosound`, etc.) are intentionally out of scope for this step and
 * will be added by subsequent launch-host-input steps.
 *
 * @example
 * ```ts
 * import { parseCommandLineConfiguration } from './commandLineConfiguration.ts';
 * const configuration = parseCommandLineConfiguration([
 *   'doom_codex',
 *   '-iwad', 'doom/DOOM1.WAD',
 *   '-skill', '4',
 *   '-warp', '1', '1',
 * ]);
 * configuration.iwadPath;     // 'doom/DOOM1.WAD'
 * configuration.skill;        // 4
 * configuration.warp?.episode; // 1
 * configuration.warp?.map;     // 1
 * ```
 */

import { CommandLine } from '../bootstrap/cmdline.ts';

/**
 * Thrown when {@link parseCommandLineConfiguration} encounters a flag
 * whose trailing values violate the vanilla contract — missing trailing
 * arg, non-numeric skill, out-of-range skill, non-numeric warp slot, or
 * empty path.  The thrown error always names the offending parameter and
 * the offending received value so the caller can surface a precise
 * diagnostic to the user.
 */
export class CommandLineParseError extends Error {
  /** The vanilla flag whose argument failed validation (e.g., `'-skill'`). */
  public readonly parameterName: string;
  /** The verbatim argv value that was rejected, or `null` when the flag was missing its trailing argument entirely. */
  public readonly receivedValue: string | null;

  public constructor(parameterName: string, receivedValue: string | null, message: string) {
    super(message);
    this.name = 'CommandLineParseError';
    this.parameterName = parameterName;
    this.receivedValue = receivedValue;
  }
}

/**
 * Warp-to-map target extracted from `-warp`.
 *
 * Vanilla DOOM 1.9 `-warp` accepts either two trailing arguments
 * (episode + map, used by Ultimate Doom and Doom 1 episodic IWADs) or
 * one trailing argument (map only, used by Doom 2 and Final Doom).  The
 * extracted shape preserves both flavors.  `episode` is `null` when only
 * a single trailing argument was supplied.
 */
export interface WarpTarget {
  readonly episode: number | null;
  readonly map: number;
}

/**
 * Typed vanilla command-line configuration produced by
 * {@link parseCommandLineConfiguration}.
 *
 * Every field is `null` when the corresponding flag is absent.  The
 * `argv` field preserves the verbatim input argument vector (including
 * the program-name slot at index 0) so downstream subsystems retain
 * access to flags this step does not yet parse.
 */
export interface CommandLineConfiguration {
  readonly argv: readonly string[];
  readonly iwadPath: string | null;
  readonly configPath: string | null;
  readonly warp: WarpTarget | null;
  readonly playdemoName: string | null;
  readonly timedemoName: string | null;
  readonly skill: number | null;
  readonly savedirPath: string | null;
}

const VANILLA_SKILL_MINIMUM = 1;
const VANILLA_SKILL_MAXIMUM = 5;
const VANILLA_WARP_EPISODE_MINIMUM = 1;
const VANILLA_WARP_EPISODE_MAXIMUM = 4;
const VANILLA_WARP_MAP_MINIMUM = 1;
const VANILLA_WARP_DOOM2_MAP_MAXIMUM = 32;

function readSingleValueParameter(commandLine: CommandLine, parameterName: string): string | null {
  if (!commandLine.parameterExists(parameterName)) {
    return null;
  }
  const value = commandLine.getParameter(parameterName);
  if (value === null) {
    throw new CommandLineParseError(parameterName, null, `command-line flag "${parameterName}" requires a trailing value but none was supplied`);
  }
  if (value.length === 0) {
    throw new CommandLineParseError(parameterName, value, `command-line flag "${parameterName}" rejected empty trailing value`);
  }
  return value;
}

function parsePositiveIntegerInRange(parameterName: string, rawValue: string, minimumInclusive: number, maximumInclusive: number): number {
  if (!/^-?\d+$/.test(rawValue)) {
    throw new CommandLineParseError(parameterName, rawValue, `command-line flag "${parameterName}" expected an integer in [${minimumInclusive}, ${maximumInclusive}]; received "${rawValue}"`);
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < minimumInclusive || parsed > maximumInclusive) {
    throw new CommandLineParseError(parameterName, rawValue, `command-line flag "${parameterName}" value out of range [${minimumInclusive}, ${maximumInclusive}]; received "${rawValue}"`);
  }
  return parsed;
}

function extractSkill(commandLine: CommandLine): number | null {
  const rawValue = readSingleValueParameter(commandLine, '-skill');
  if (rawValue === null) {
    return null;
  }
  return parsePositiveIntegerInRange('-skill', rawValue, VANILLA_SKILL_MINIMUM, VANILLA_SKILL_MAXIMUM);
}

function extractWarp(commandLine: CommandLine): WarpTarget | null {
  if (!commandLine.parameterExists('-warp')) {
    return null;
  }
  const trailingValues = commandLine.getParameterValues('-warp');
  if (trailingValues.length === 0) {
    throw new CommandLineParseError('-warp', null, 'command-line flag "-warp" requires either "-warp <episode> <map>" or "-warp <map>"; no trailing arguments were supplied');
  }
  if (trailingValues.length >= 2) {
    const episode = parsePositiveIntegerInRange('-warp', trailingValues[0]!, VANILLA_WARP_EPISODE_MINIMUM, VANILLA_WARP_EPISODE_MAXIMUM);
    const map = parsePositiveIntegerInRange('-warp', trailingValues[1]!, VANILLA_WARP_MAP_MINIMUM, VANILLA_WARP_DOOM2_MAP_MAXIMUM);
    return { episode, map };
  }
  const map = parsePositiveIntegerInRange('-warp', trailingValues[0]!, VANILLA_WARP_MAP_MINIMUM, VANILLA_WARP_DOOM2_MAP_MAXIMUM);
  return { episode: null, map };
}

/**
 * Parse a validated vanilla argv into a typed
 * {@link CommandLineConfiguration}.
 *
 * The supplied argv must already be a `readonly string[]` (callers are
 * expected to validate the array shape upstream — `runDoomMain` does
 * exactly this via its `InvalidArgumentError` argv guard).  Element 0 is
 * the program name and is never inspected for flags, matching the
 * vanilla M_CheckParm contract.
 *
 * @param argumentVector Validated argv with the program name at index 0.
 * @returns The extracted configuration.  Every flag-derived field is
 *   `null` when the corresponding flag is absent.
 * @throws CommandLineParseError When a recognized flag has a missing,
 *   empty, non-numeric, or out-of-range trailing value.
 *
 * @example
 * ```ts
 * parseCommandLineConfiguration(['doom_codex', '-skill', '3']);
 * // => { argv: [...], iwadPath: null, ..., skill: 3, savedirPath: null }
 * ```
 */
export function parseCommandLineConfiguration(argumentVector: readonly string[]): CommandLineConfiguration {
  const commandLine = new CommandLine(argumentVector);
  return Object.freeze({
    argv: Object.freeze([...argumentVector]),
    configPath: readSingleValueParameter(commandLine, '-config'),
    iwadPath: readSingleValueParameter(commandLine, '-iwad'),
    playdemoName: readSingleValueParameter(commandLine, '-playdemo'),
    savedirPath: readSingleValueParameter(commandLine, '-savedir'),
    skill: extractSkill(commandLine),
    timedemoName: readSingleValueParameter(commandLine, '-timedemo'),
    warp: extractWarp(commandLine),
  });
}
