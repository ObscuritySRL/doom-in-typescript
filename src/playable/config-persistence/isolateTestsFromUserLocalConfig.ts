import { relative, resolve } from 'node:path';
import { cwd } from 'node:process';

import { DEFAULT_CFG_VARIABLE_COUNT, VANILLA_DEFAULT_CFG_DEFINITIONS, createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import { HOST_EXTRA_CFG_VARIABLE_COUNT, VANILLA_EXTENDED_CFG_DEFINITIONS, createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_AUDIT = Object.freeze({
  explicitNullSurface: 'localConfigTestIsolation',
  manifestPath: 'plan_fps/manifests/01-014-audit-missing-config-persistence.json',
  schemaVersion: 1,
  stepId: '01-014',
});

export const ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: 'bun run doom.ts',
});

export const ISOLATED_TEST_CONFIG_DIRECTORY_NAME = '.doom-test-config';

export interface IsolateTestsFromUserLocalConfigEvidence {
  readonly auditManifestSchemaVersion: number;
  readonly commandContract: typeof ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT;
  readonly configFiles: readonly IsolateTestsFromUserLocalConfigFileEvidence[];
  readonly ignoredUserLocalConfigTokens: readonly string[];
  readonly isolationDirectory: string;
  readonly replayChecksum: number;
  readonly replayHash: string;
  readonly transition: readonly string[];
}

export interface IsolateTestsFromUserLocalConfigFileEvidence {
  readonly byteLength: number;
  readonly fileName: LocalConfigFileName;
  readonly path: string;
  readonly sha256: string;
  readonly source: 'generated-default';
  readonly variableCount: number;
}

export interface IsolateTestsFromUserLocalConfigInput {
  readonly command?: string;
  readonly isolationKey?: string;
  readonly workspaceRoot?: string;
}

export type LocalConfigFileName = (typeof LOCAL_CONFIG_FILE_NAMES)[number];

interface ConfigDefinitionSnapshot {
  readonly defaultValue: number | string;
  readonly name: string;
  readonly type: 'float' | 'integer' | 'string';
}

const CONFIG_SOURCE = 'generated-default';
const DEFAULT_ISOLATION_KEY = 'ralph-loop-12-009';
const LOCAL_CONFIG_FILE_NAMES = ['chocolate-doom.cfg', 'default.cfg'] as const;
const READ_ONLY_REFERENCE_ROOT_NAMES = ['doom', 'iwad', 'reference'] as const;
const READ_ONLY_REFERENCE_ROOT_NAME_SET: ReadonlySet<string> = new Set(READ_ONLY_REFERENCE_ROOT_NAMES);
const USER_LOCAL_CONFIG_TOKENS = Object.freeze([
  '%APPDATA%/Chocolate Doom/chocolate-doom.cfg',
  '%APPDATA%/Chocolate Doom/default.cfg',
  '%LOCALAPPDATA%/Chocolate Doom/chocolate-doom.cfg',
  '%LOCALAPPDATA%/Chocolate Doom/default.cfg',
  '~/Library/Application Support/chocolate-doom/chocolate-doom.cfg',
  '~/Library/Application Support/chocolate-doom/default.cfg',
  '~/.chocolate-doom/chocolate-doom.cfg',
  '~/.chocolate-doom/default.cfg',
]);

export function isolateTestsFromUserLocalConfig(input: IsolateTestsFromUserLocalConfigInput = {}): IsolateTestsFromUserLocalConfigEvidence {
  const command = input.command ?? ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT.targetCommand;
  assertProductCommand(command);

  const isolationKey = input.isolationKey ?? DEFAULT_ISOLATION_KEY;
  assertIsolationKey(isolationKey);

  const workspaceRoot = resolve(input.workspaceRoot ?? cwd());
  assertWorkspaceRootIsWritable(workspaceRoot);

  const isolationDirectory = resolve(workspaceRoot, ISOLATED_TEST_CONFIG_DIRECTORY_NAME, isolationKey);
  assertConfigDirectoryIsWritable(workspaceRoot, isolationDirectory);

  const hostConfig = createDefaultHostExtraCfg();
  const vanillaConfig = createDefaultVanillaCfg();
  const hostVariableCount = Object.keys(hostConfig).length;
  const vanillaVariableCount = Object.keys(vanillaConfig).length;

  if (hostVariableCount !== HOST_EXTRA_CFG_VARIABLE_COUNT) {
    throw new Error(`expected ${HOST_EXTRA_CFG_VARIABLE_COUNT} host config variables, got ${hostVariableCount}`);
  }

  if (vanillaVariableCount !== DEFAULT_CFG_VARIABLE_COUNT) {
    throw new Error(`expected ${DEFAULT_CFG_VARIABLE_COUNT} vanilla config variables, got ${vanillaVariableCount}`);
  }

  const portableIsolationDirectory = toPortablePath(isolationDirectory);
  const configFiles = Object.freeze([
    buildConfigFileEvidence({
      definitions: VANILLA_EXTENDED_CFG_DEFINITIONS,
      fileName: 'chocolate-doom.cfg',
      isolationDirectory: portableIsolationDirectory,
      variableCount: hostVariableCount,
    }),
    buildConfigFileEvidence({
      definitions: VANILLA_DEFAULT_CFG_DEFINITIONS,
      fileName: 'default.cfg',
      isolationDirectory: portableIsolationDirectory,
      variableCount: vanillaVariableCount,
    }),
  ]);
  const transition = Object.freeze([
    'validate bun run doom.ts command contract',
    'derive workspace-local isolated test config directory',
    'generate chocolate-doom.cfg from typed host defaults',
    'generate default.cfg from typed vanilla defaults',
    'ignore user-local config discovery tokens',
  ]);
  const replayInput = JSON.stringify({
    auditManifestSchemaVersion: ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_AUDIT.schemaVersion,
    configFiles,
    ignoredUserLocalConfigTokens: USER_LOCAL_CONFIG_TOKENS,
    isolationDirectory: portableIsolationDirectory,
    transition,
  });

  return Object.freeze({
    auditManifestSchemaVersion: ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_AUDIT.schemaVersion,
    commandContract: ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT,
    configFiles,
    ignoredUserLocalConfigTokens: USER_LOCAL_CONFIG_TOKENS,
    isolationDirectory: portableIsolationDirectory,
    replayChecksum: checksumText(replayInput),
    replayHash: sha256Text(replayInput),
    transition,
  });
}

function assertConfigDirectoryIsWritable(workspaceRoot: string, isolationDirectory: string): void {
  const relativeIsolationPath = relative(workspaceRoot, isolationDirectory);
  if (relativeIsolationPath === '' || relativeIsolationPath.startsWith('..')) {
    throw new Error(`isolated config directory must remain inside workspace root: ${toPortablePath(isolationDirectory)}`);
  }

  for (const rootName of READ_ONLY_REFERENCE_ROOT_NAMES) {
    const referenceRoot = resolve(workspaceRoot, rootName);
    if (isSamePathOrInside(isolationDirectory, referenceRoot)) {
      throw new Error(`isolated config directory must not be inside read-only ${rootName}/ root`);
    }
  }
}

function assertIsolationKey(isolationKey: string): void {
  if (!/^[0-9A-Za-z][0-9A-Za-z-]*$/.test(isolationKey)) {
    throw new Error('isolation key must contain only letters, numbers, and hyphens');
  }
}

function assertProductCommand(command: string): void {
  if (command !== ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT.targetCommand) {
    throw new Error(`expected Bun product command \`${ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT.targetCommand}\`, got \`${command}\``);
  }
}

function assertWorkspaceRootIsWritable(workspaceRoot: string): void {
  const portableWorkspaceRoot = toPortablePath(workspaceRoot);
  const workspaceRootName = portableWorkspaceRoot.slice(portableWorkspaceRoot.lastIndexOf('/') + 1);
  if (READ_ONLY_REFERENCE_ROOT_NAME_SET.has(workspaceRootName)) {
    throw new Error(`workspace root must not be read-only reference root ${workspaceRootName}/`);
  }
}

function buildConfigFileEvidence(parameters: {
  readonly definitions: readonly ConfigDefinitionSnapshot[];
  readonly fileName: LocalConfigFileName;
  readonly isolationDirectory: string;
  readonly variableCount: number;
}): IsolateTestsFromUserLocalConfigFileEvidence {
  const text = serializeDefinitions(parameters.definitions);

  return Object.freeze({
    byteLength: new TextEncoder().encode(text).byteLength,
    fileName: parameters.fileName,
    path: `${parameters.isolationDirectory}/${parameters.fileName}`,
    sha256: sha256Text(text),
    source: CONFIG_SOURCE,
    variableCount: parameters.variableCount,
  });
}

function checksumText(text: string): number {
  let checksum = 0x811c9dc5;
  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    checksum ^= text.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum;
}

function formatConfigValue(definition: ConfigDefinitionSnapshot): string {
  if (definition.type === 'string') {
    return `"${String(definition.defaultValue).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  }

  if (definition.type === 'float') {
    return Number(definition.defaultValue).toFixed(6);
  }

  return `${definition.defaultValue}`;
}

function isSamePathOrInside(candidatePath: string, ancestorPath: string): boolean {
  const relativePath = relative(ancestorPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.startsWith('\\') && !relativePath.startsWith('/'));
}

function serializeDefinitions(definitions: readonly ConfigDefinitionSnapshot[]): string {
  const lines: string[] = [];
  for (const definition of definitions) {
    lines.push(`${definition.name} ${formatConfigValue(definition)}`);
  }
  return `${lines.join('\n')}\n`;
}

function sha256Text(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

function toPortablePath(path: string): string {
  return path.replaceAll('\\', '/');
}
