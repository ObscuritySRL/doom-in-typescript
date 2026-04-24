/**
 * Config load precedence matching Chocolate Doom 2.2.1 M_LoadDefaults.
 *
 * Chocolate Doom loads two disjoint config files in order:
 * 1. `default.cfg` — vanilla Doom variable namespace (or `-config` override)
 * 2. `chocolate-doom.cfg` — extended variable namespace (or `-extraconfig` override)
 *
 * Both default to `configDirectory + filename`.  Hardcoded default values
 * are used for any variable not present in the file.  Unknown variable
 * names in a config file are silently ignored.
 *
 * @example
 * ```ts
 * import { parseConfigFileContent, buildDefinitionMap } from "../src/bootstrap/config.ts";
 * const defs = buildDefinitionMap([{ name: "sfx_volume", type: "integer", defaultValue: 8 }]);
 * const values = parseConfigFileContent("sfx_volume 10\n", defs);
 * values.get("sfx_volume"); // 10
 * ```
 */

import { join } from 'node:path';

import type { CommandLine } from './cmdline.ts';

/** Supported config value types matching Chocolate Doom's DEFAULT_INT / DEFAULT_STRING / DEFAULT_FLOAT. */
export type ConfigValueType = 'float' | 'integer' | 'string';

/** A single config variable definition with its hardcoded default. */
export interface ConfigDefinition {
  readonly name: string;
  readonly type: ConfigValueType;
  readonly defaultValue: number | string;
}

/** Result of loading both config files with full precedence applied. */
export interface ConfigLoadResult {
  /** Merged variable values after precedence (defaults → vanilla file → extended file). */
  readonly values: ReadonlyMap<string, number | string>;
  /** Resolved path used for the vanilla config file. */
  readonly vanillaConfigPath: string;
  /** Resolved path used for the extended config file. */
  readonly extendedConfigPath: string;
  /** Whether the vanilla config file was found and loaded. */
  readonly vanillaLoaded: boolean;
  /** Whether the extended config file was found and loaded. */
  readonly extendedLoaded: boolean;
}

/** Vanilla Doom config filename. */
export const VANILLA_CONFIG_FILENAME = 'default.cfg';

/** Chocolate Doom extended config filename. */
export const EXTENDED_CONFIG_FILENAME = 'chocolate-doom.cfg';

/**
 * Parse a raw value string according to its declared type.
 *
 * - `"integer"`: decimal or `0x` hex prefix
 * - `"string"`: strips surrounding double quotes
 * - `"float"`: standard decimal notation
 *
 * @param raw  - Raw value string from the config file.
 * @param type - Declared type of the variable.
 */
export function parseConfigValue(raw: string, type: ConfigValueType): number | string {
  switch (type) {
    case 'float':
      return parseFloat(raw);
    case 'integer':
      return raw.startsWith('0x') || raw.startsWith('0X') ? parseInt(raw, 16) : parseInt(raw, 10);
    case 'string':
      return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  }
}

/**
 * Parse config file content, extracting values for known variables only.
 *
 * Each line is expected in `name<whitespace>value` format.  Lines that
 * do not match or reference unknown variable names are silently ignored,
 * matching Chocolate Doom behavior.
 *
 * @param content        - Raw text content of a config file.
 * @param knownVariables - Lookup map of recognized variable definitions.
 */
export function parseConfigFileContent(content: string, knownVariables: ReadonlyMap<string, ConfigDefinition>): Map<string, number | string> {
  const result = new Map<string, number | string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const match = trimmed.match(/^(\S+)\s+(.+)$/);
    if (!match) continue;
    const name = match[1]!;
    const rawValue = match[2]!;
    const definition = knownVariables.get(name);
    if (!definition) continue;
    result.set(name, parseConfigValue(rawValue, definition.type));
  }
  return result;
}

/**
 * Build a name→definition lookup map from a definitions array.
 *
 * @param definitions - Array of config variable definitions.
 */
export function buildDefinitionMap(definitions: readonly ConfigDefinition[]): ReadonlyMap<string, ConfigDefinition> {
  const map = new Map<string, ConfigDefinition>();
  for (const definition of definitions) {
    map.set(definition.name, definition);
  }
  return map;
}

/**
 * Initialize a values map from definitions using their hardcoded defaults.
 *
 * @param definitions - Array of config variable definitions.
 */
export function initializeDefaults(definitions: readonly ConfigDefinition[]): Map<string, number | string> {
  const result = new Map<string, number | string>();
  for (const definition of definitions) {
    result.set(definition.name, definition.defaultValue);
  }
  return result;
}

/**
 * Resolve the path for the vanilla config file (`default.cfg`).
 *
 * Honors `-config <path>` on the command line; falls back to
 * `configDirectory/default.cfg`.
 *
 * @param commandLine    - Parsed command line.
 * @param configDirectory - Directory containing config files.
 */
export function resolveVanillaConfigPath(commandLine: CommandLine, configDirectory: string): string {
  const overridePath = commandLine.getParameter('-config');
  return overridePath ?? join(configDirectory, VANILLA_CONFIG_FILENAME);
}

/**
 * Resolve the path for the extended config file (`chocolate-doom.cfg`).
 *
 * Honors `-extraconfig <path>` on the command line; falls back to
 * `configDirectory/chocolate-doom.cfg`.
 *
 * @param commandLine    - Parsed command line.
 * @param configDirectory - Directory containing config files.
 */
export function resolveExtendedConfigPath(commandLine: CommandLine, configDirectory: string): string {
  const overridePath = commandLine.getParameter('-extraconfig');
  return overridePath ?? join(configDirectory, EXTENDED_CONFIG_FILENAME);
}

/**
 * Load both config files with Chocolate Doom 2.2.1 precedence.
 *
 * Precedence order (later wins):
 * 1. Hardcoded defaults from definition arrays
 * 2. Values from `default.cfg` (or `-config` override path)
 * 3. Values from `chocolate-doom.cfg` (or `-extraconfig` override path)
 *
 * The two config files use disjoint variable namespaces (zero overlap).
 * Unknown variables in either file are silently ignored.  Missing files
 * cause no error; all variables retain their defaults.
 *
 * @param commandLine         - Parsed command line for path override lookup.
 * @param vanillaDefinitions  - Variable definitions for `default.cfg`.
 * @param extendedDefinitions - Variable definitions for `chocolate-doom.cfg`.
 * @param configDirectory     - Directory containing both config files.
 */
export async function loadDefaults(commandLine: CommandLine, vanillaDefinitions: readonly ConfigDefinition[], extendedDefinitions: readonly ConfigDefinition[], configDirectory: string): Promise<ConfigLoadResult> {
  const vanillaConfigPath = resolveVanillaConfigPath(commandLine, configDirectory);
  const extendedConfigPath = resolveExtendedConfigPath(commandLine, configDirectory);

  const values = new Map<string, number | string>();
  for (const definition of vanillaDefinitions) {
    values.set(definition.name, definition.defaultValue);
  }
  for (const definition of extendedDefinitions) {
    values.set(definition.name, definition.defaultValue);
  }

  const vanillaMap = buildDefinitionMap(vanillaDefinitions);
  const vanillaContent = await readFileContent(vanillaConfigPath);
  let vanillaLoaded = false;
  if (vanillaContent !== null) {
    vanillaLoaded = true;
    for (const [name, value] of parseConfigFileContent(vanillaContent, vanillaMap)) {
      values.set(name, value);
    }
  }

  const extendedMap = buildDefinitionMap(extendedDefinitions);
  const extendedContent = await readFileContent(extendedConfigPath);
  let extendedLoaded = false;
  if (extendedContent !== null) {
    extendedLoaded = true;
    for (const [name, value] of parseConfigFileContent(extendedContent, extendedMap)) {
      values.set(name, value);
    }
  }

  return Object.freeze({
    values,
    vanillaConfigPath,
    extendedConfigPath,
    vanillaLoaded,
    extendedLoaded,
  });
}

async function readFileContent(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (await file.exists()) {
    return await file.text();
  }
  return null;
}
