import { isAbsolute, relative, resolve } from 'node:path';

import type { ConfigDefinition } from '../../bootstrap/config.ts';
import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import { createDefaultVanillaCfg, VANILLA_DEFAULT_CFG_DEFINITIONS } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { createDefaultHostExtraCfg, VANILLA_EXTENDED_CFG_DEFINITIONS } from '../../config/hostConfig.ts';

export const WRITE_CONFIG_BACK_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
});

export type ConfigWriteLineEnding = '\n' | '\r\n';

export interface WriteConfigBackOptions {
  readonly defaultCfg?: VanillaDefaultCfg;
  readonly defaultCfgPath: string;
  readonly hostExtraCfg?: VanillaExtendedCfg;
  readonly hostExtraCfgPath: string;
  readonly lineEnding?: ConfigWriteLineEnding;
  readonly runtimeCommand?: string;
}

export interface WriteConfigBackResult {
  readonly commandContract: typeof WRITE_CONFIG_BACK_COMMAND_CONTRACT;
  readonly defaultCfgBytesWritten: number;
  readonly defaultCfgHash: string;
  readonly defaultCfgPath: string;
  readonly hostExtraCfgBytesWritten: number;
  readonly hostExtraCfgHash: string;
  readonly hostExtraCfgPath: string;
  readonly replayChecksum: number;
  readonly transition: 'config-writeback-complete';
}

const DEFAULT_LINE_ENDING: ConfigWriteLineEnding = '\n';
const READ_ONLY_REFERENCE_ROOTS = Object.freeze(['doom', 'iwad', 'reference']);
const TEXT_ENCODER = new TextEncoder();

/**
 * Write vanilla `default.cfg` and Chocolate Doom `chocolate-doom.cfg`
 * content through the Bun runtime path.
 *
 * @param options - Runtime command, config paths, and typed config values to serialize.
 * @returns Deterministic writeback evidence for replay and tests.
 * @example
 * ```ts
 * await writeConfigBack({
 *   defaultCfgPath: 'default.cfg',
 *   hostExtraCfgPath: 'chocolate-doom.cfg',
 * });
 * ```
 */
export async function writeConfigBack(options: WriteConfigBackOptions): Promise<WriteConfigBackResult> {
  const runtimeCommand = options.runtimeCommand ?? WRITE_CONFIG_BACK_COMMAND_CONTRACT.runtimeCommand;

  if (runtimeCommand !== WRITE_CONFIG_BACK_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`write config back requires ${WRITE_CONFIG_BACK_COMMAND_CONTRACT.runtimeCommand}`);
  }

  const defaultCfgPath = resolveWritableConfigPath(options.defaultCfgPath, 'defaultCfgPath');
  const hostExtraCfgPath = resolveWritableConfigPath(options.hostExtraCfgPath, 'hostExtraCfgPath');
  const lineEnding = options.lineEnding ?? DEFAULT_LINE_ENDING;
  const defaultCfgContent = serializeConfigFile(VANILLA_DEFAULT_CFG_DEFINITIONS, options.defaultCfg ?? createDefaultVanillaCfg(), lineEnding);
  const hostExtraCfgContent = serializeConfigFile(VANILLA_EXTENDED_CFG_DEFINITIONS, options.hostExtraCfg ?? createDefaultHostExtraCfg(), lineEnding);

  const defaultCfgBytesWritten = await Bun.write(defaultCfgPath, defaultCfgContent);
  const hostExtraCfgBytesWritten = await Bun.write(hostExtraCfgPath, hostExtraCfgContent);
  const result: WriteConfigBackResult = {
    commandContract: WRITE_CONFIG_BACK_COMMAND_CONTRACT,
    defaultCfgBytesWritten,
    defaultCfgHash: sha256Hex(defaultCfgContent),
    defaultCfgPath,
    hostExtraCfgBytesWritten,
    hostExtraCfgHash: sha256Hex(hostExtraCfgContent),
    hostExtraCfgPath,
    replayChecksum: calculateReplayChecksum(defaultCfgContent, hostExtraCfgContent),
    transition: 'config-writeback-complete',
  };

  return Object.freeze(result);
}

function calculateReplayChecksum(defaultCfgContent: string, hostExtraCfgContent: string): number {
  let checksum = 0x811c9dc5;

  for (const content of [defaultCfgContent, hostExtraCfgContent]) {
    for (const byte of TEXT_ENCODER.encode(content)) {
      checksum ^= byte;
      checksum = Math.imul(checksum, 0x01000193) >>> 0;
    }

    checksum ^= 0x00;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }

  return checksum;
}

function formatConfigValue(definition: ConfigDefinition, rawValue: unknown): string {
  if (definition.type === 'string') {
    if (typeof rawValue !== 'string') {
      throw new Error(`expected string config value ${definition.name}`);
    }

    return quoteConfigString(rawValue, definition.name);
  }

  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    throw new Error(`expected numeric config value ${definition.name}`);
  }

  if (definition.type === 'float') {
    return rawValue.toFixed(6);
  }

  if (!Number.isInteger(rawValue)) {
    throw new Error(`expected integer config value ${definition.name}`);
  }

  if (definition.name === 'opl_io_port') {
    return `0x${rawValue.toString(16)}`;
  }

  return String(rawValue);
}

function hasOwnConfigKey<Config extends object>(config: Config, name: string): name is Extract<keyof Config, string> {
  return Object.hasOwn(config, name);
}

function isInsideOrEqualPath(candidatePath: string, rootPath: string): boolean {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function quoteConfigString(value: string, name: string): string {
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error(`config string ${name} cannot contain a line break`);
  }

  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function resolveWritableConfigPath(configPath: string, optionName: string): string {
  if (configPath.trim().length === 0) {
    throw new Error(`${optionName} must not be empty`);
  }

  if (configPath.includes('\0')) {
    throw new Error(`${optionName} must not contain NUL`);
  }

  const resolvedPath = resolve(configPath);
  const workspaceRoot = resolve('.');

  for (const referenceRoot of READ_ONLY_REFERENCE_ROOTS) {
    const referenceRootPath = resolve(workspaceRoot, referenceRoot);

    if (isInsideOrEqualPath(resolvedPath, referenceRootPath)) {
      throw new Error(`${optionName} must not target read-only reference root ${referenceRoot}`);
    }
  }

  return resolvedPath;
}

function serializeConfigFile<Config extends object>(definitions: readonly ConfigDefinition[], config: Config, lineEnding: ConfigWriteLineEnding): string {
  const lines: string[] = [];

  for (const definition of definitions) {
    const definitionName = definition.name;

    if (!hasOwnConfigKey(config, definitionName)) {
      throw new Error(`missing config value ${definitionName}`);
    }

    lines.push(`${definitionName} ${formatConfigValue(definition, config[definitionName])}`);
  }

  return `${lines.join(lineEnding)}${lineEnding}`;
}

function sha256Hex(content: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return hasher.digest('hex');
}
