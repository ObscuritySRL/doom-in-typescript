import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { DEFAULT_CFG_VARIABLE_COUNT, createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import { HOST_EXTRA_CFG_VARIABLE_COUNT, createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-014-audit-missing-config-persistence.json';
export const CONFIG_PERSISTENCE_AUDIT_SCHEMA_VERSION = 1;
export const CONFIG_PERSISTENCE_AUDIT_STEP_ID = '01-014';
export const PRODUCT_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: 'bun run doom.ts',
});
export const VANILLA_SAVE_SLOT_COUNT = 6;

export interface ConfigPathNamespacePolicy {
  readonly fileName: string;
  readonly namespace: 'host-extended' | 'vanilla-default';
  readonly variableCount: number;
}

export interface DefineSaveAndWindowPathPoliciesInput {
  readonly command?: string;
  readonly hostConfig?: VanillaExtendedCfg;
  readonly saveRoot?: string;
  readonly vanillaConfig?: VanillaDefaultCfg;
  readonly windowConfigPath?: string;
}

export interface DefineSaveAndWindowPathPoliciesResult {
  readonly auditManifestPath: string;
  readonly auditSchemaVersion: number;
  readonly auditStepId: string;
  readonly commandContract: typeof PRODUCT_COMMAND_CONTRACT;
  readonly configNamespaces: readonly ConfigPathNamespacePolicy[];
  readonly policyHash: string;
  readonly replayChecksum: number;
  readonly savePaths: readonly SavePathPolicy[];
  readonly serializedPolicy: string;
  readonly transition: 'missing-config-path-policy-to-deterministic-save-window-path-policy';
  readonly windowPolicy: WindowPathPolicy;
}

export interface SavePathPolicy {
  readonly fileName: string;
  readonly slot: number;
  readonly workspaceRelativePath: string;
}

export interface WindowPathPolicy {
  readonly aspectRatioCorrect: number;
  readonly configuredFullscreen: number;
  readonly configuredWindowPosition: string;
  readonly productPresentation: 'windowed-only';
  readonly screenHeight: number;
  readonly screenWidth: number;
  readonly windowConfigPath: string;
}

const DEFAULT_SAVE_ROOT = '.';
const DEFAULT_WINDOW_CONFIG_PATH = 'chocolate-doom.cfg';
const READ_ONLY_REFERENCE_ROOTS = Object.freeze(['doom', 'iwad', 'reference']);
const TRANSITION = 'missing-config-path-policy-to-deterministic-save-window-path-policy';
const WINDOW_HEIGHT_FALLBACK = 480;
const WINDOW_POSITION_FALLBACK = 'centered';
const WINDOW_WIDTH_FALLBACK = 640;

/**
 * Define deterministic save and window path policies for the Bun-run
 * playable product path.
 */
export function defineSaveAndWindowPathPolicies(input: DefineSaveAndWindowPathPoliciesInput = {}): DefineSaveAndWindowPathPoliciesResult {
  const command = input.command ?? PRODUCT_COMMAND_CONTRACT.targetCommand;
  assertProductCommand(command);

  const hostConfig = input.hostConfig ?? createDefaultHostExtraCfg();
  const saveRoot = normalizeWorkspaceRelativePath(input.saveRoot ?? DEFAULT_SAVE_ROOT, 'save root');
  const vanillaConfig = input.vanillaConfig ?? createDefaultVanillaCfg();
  const windowConfigPath = normalizeWorkspaceRelativePath(input.windowConfigPath ?? DEFAULT_WINDOW_CONFIG_PATH, 'window config');

  const savePaths = Object.freeze(buildSavePaths(saveRoot));
  const windowPolicy = Object.freeze({
    aspectRatioCorrect: hostConfig.aspect_ratio_correct,
    configuredFullscreen: hostConfig.fullscreen,
    configuredWindowPosition: normalizeWindowPosition(hostConfig.window_position),
    productPresentation: 'windowed-only',
    screenHeight: normalizeWindowDimension(hostConfig.screen_height, WINDOW_HEIGHT_FALLBACK, 'screen height'),
    screenWidth: normalizeWindowDimension(hostConfig.screen_width, WINDOW_WIDTH_FALLBACK, 'screen width'),
    windowConfigPath,
  });
  const configNamespaces = Object.freeze([
    Object.freeze({
      fileName: 'chocolate-doom.cfg',
      namespace: 'host-extended',
      variableCount: HOST_EXTRA_CFG_VARIABLE_COUNT,
    }),
    Object.freeze({
      fileName: 'default.cfg',
      namespace: 'vanilla-default',
      variableCount: DEFAULT_CFG_VARIABLE_COUNT,
    }),
  ]);
  const policy = Object.freeze({
    auditManifestPath: CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH,
    auditSchemaVersion: CONFIG_PERSISTENCE_AUDIT_SCHEMA_VERSION,
    auditStepId: CONFIG_PERSISTENCE_AUDIT_STEP_ID,
    commandContract: PRODUCT_COMMAND_CONTRACT,
    configNamespaces,
    saveMessagesEnabled: vanillaConfig.show_messages !== 0,
    savePaths,
    transition: TRANSITION,
    windowPolicy,
  });
  const serializedPolicy = JSON.stringify(policy);
  const result = Object.freeze({
    auditManifestPath: CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH,
    auditSchemaVersion: CONFIG_PERSISTENCE_AUDIT_SCHEMA_VERSION,
    auditStepId: CONFIG_PERSISTENCE_AUDIT_STEP_ID,
    commandContract: PRODUCT_COMMAND_CONTRACT,
    configNamespaces,
    policyHash: sha256Hex(serializedPolicy),
    replayChecksum: calculateReplayChecksum(serializedPolicy),
    savePaths,
    serializedPolicy,
    transition: TRANSITION,
    windowPolicy,
  });

  return result;
}

function assertProductCommand(command: string): void {
  if (command !== PRODUCT_COMMAND_CONTRACT.targetCommand) {
    throw new Error(`define save and window path policies requires ${PRODUCT_COMMAND_CONTRACT.targetCommand}, got ${command}`);
  }
}

function buildSavePaths(saveRoot: string): readonly SavePathPolicy[] {
  const savePaths: SavePathPolicy[] = [];

  for (let slot = 0; slot < VANILLA_SAVE_SLOT_COUNT; slot += 1) {
    const fileName = `doomsav${slot}.dsg`;
    savePaths.push(
      Object.freeze({
        fileName,
        slot,
        workspaceRelativePath: joinWorkspaceRelativePath(saveRoot, fileName),
      }),
    );
  }

  return savePaths;
}

function calculateReplayChecksum(content: string): number {
  let checksum = 0x811c9dc5;

  for (let characterIndex = 0; characterIndex < content.length; characterIndex += 1) {
    checksum ^= content.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }

  return checksum;
}

function joinWorkspaceRelativePath(parentPath: string, fileName: string): string {
  if (parentPath === '.') {
    return fileName;
  }

  return `${parentPath}/${fileName}`;
}

function normalizeWindowDimension(value: number, fallback: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }

  if (value === 0) {
    return fallback;
  }

  return value;
}

function normalizeWindowPosition(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return WINDOW_POSITION_FALLBACK;
  }

  if (trimmedValue.includes('\0') || trimmedValue.includes('\n') || trimmedValue.includes('\r')) {
    throw new Error('window position must fit on one config line');
  }

  return trimmedValue;
}

function normalizeWorkspaceRelativePath(inputPath: string, label: string): string {
  const trimmedPath = inputPath.trim();

  if (trimmedPath.length === 0) {
    throw new Error(`${label} path must not be empty`);
  }

  if (trimmedPath.includes('\0')) {
    throw new Error(`${label} path must not contain null bytes`);
  }

  const slashPath = trimmedPath.replaceAll('\\', '/');

  if (/^[A-Za-z]:/.test(slashPath) || slashPath.startsWith('/')) {
    throw new Error(`${label} path must be workspace-relative`);
  }

  const segments = slashPath.split('/').filter((segment) => segment.length > 0 && segment !== '.');

  if (segments.length === 0) {
    return '.';
  }

  for (const segment of segments) {
    if (segment === '..') {
      throw new Error(`${label} path must not contain parent directory traversal`);
    }
  }

  const normalizedPath = segments.join('/');
  const rootSegment = segments[0]?.toLowerCase();

  if (rootSegment !== undefined && READ_ONLY_REFERENCE_ROOTS.includes(rootSegment)) {
    throw new Error(`${label} path must not target read-only reference root ${rootSegment}`);
  }

  return normalizedPath;
}

function sha256Hex(content: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return hasher.digest('hex');
}
