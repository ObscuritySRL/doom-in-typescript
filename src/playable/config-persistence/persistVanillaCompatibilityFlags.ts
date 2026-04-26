import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import { createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const CONFIG_PERSISTENCE_AUDIT_LINK = Object.freeze({
  manifestPath: 'plan_fps/manifests/01-014-audit-missing-config-persistence.json',
  missingSurface: 'vanillaCompatibilityFlags',
  stepId: '01-014',
});

export interface RuntimeCommandContract {
  readonly entryFile: string;
  readonly program: string;
  readonly subcommand: string;
  readonly targetCommand: string;
}

export const PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT: RuntimeCommandContract = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: 'bun run doom.ts',
});

export const VANILLA_COMPATIBILITY_FLAG_NAMES = Object.freeze(['vanilla_savegame_limit', 'vanilla_demo_limit', 'vanilla_keyboard_mapping'] as const);

export type VanillaCompatibilityFlagName = (typeof VANILLA_COMPATIBILITY_FLAG_NAMES)[number];
export type VanillaCompatibilityFlagValue = boolean | number;

export interface PersistVanillaCompatibilityFlagsOptions {
  readonly commandContract?: RuntimeCommandContract;
  readonly defaultConfig?: VanillaDefaultCfg;
  readonly flags?: VanillaCompatibilityFlagSettings;
  readonly hostConfig?: VanillaExtendedCfg;
}

export interface PersistVanillaCompatibilityFlagsResult {
  readonly afterFlags: PersistedVanillaCompatibilityFlags;
  readonly afterHash: string;
  readonly afterSerializedState: string;
  readonly auditLink: typeof CONFIG_PERSISTENCE_AUDIT_LINK;
  readonly beforeFlags: PersistedVanillaCompatibilityFlags;
  readonly beforeHash: string;
  readonly beforeSerializedState: string;
  readonly commandContract: RuntimeCommandContract;
  readonly defaultConfigUnchanged: boolean;
  readonly persistedDefaultConfig: VanillaDefaultCfg;
  readonly persistedHostConfig: VanillaExtendedCfg;
  readonly replayChecksum: number;
  readonly replayMaterialHash: string;
  readonly transitionSignature: string;
}

export interface PersistedVanillaCompatibilityFlags {
  readonly vanilla_demo_limit: number;
  readonly vanilla_keyboard_mapping: number;
  readonly vanilla_savegame_limit: number;
}

export interface VanillaCompatibilityFlagSettings {
  readonly vanilla_demo_limit?: VanillaCompatibilityFlagValue;
  readonly vanilla_keyboard_mapping?: VanillaCompatibilityFlagValue;
  readonly vanilla_savegame_limit?: VanillaCompatibilityFlagValue;
}

function computeReplayChecksum(content: string): number {
  let checksum = 0x811c9dc5;

  for (let characterIndex = 0; characterIndex < content.length; characterIndex += 1) {
    checksum ^= content.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }

  return checksum;
}

function computeSha256(content: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return hasher.digest('hex');
}

function normalizeCompatibilityFlag(flagName: VanillaCompatibilityFlagName, value: VanillaCompatibilityFlagValue): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (Number.isInteger(value) && (value === 0 || value === 1)) {
    return value;
  }

  throw new Error(`invalid ${flagName}: expected boolean, 0, or 1`);
}

function pickCompatibilityFlags(hostConfig: VanillaExtendedCfg): PersistedVanillaCompatibilityFlags {
  return Object.freeze({
    vanilla_demo_limit: hostConfig.vanilla_demo_limit,
    vanilla_keyboard_mapping: hostConfig.vanilla_keyboard_mapping,
    vanilla_savegame_limit: hostConfig.vanilla_savegame_limit,
  });
}

function resolveCompatibilityFlags(hostConfig: VanillaExtendedCfg, settings: VanillaCompatibilityFlagSettings): PersistedVanillaCompatibilityFlags {
  return Object.freeze({
    vanilla_demo_limit: settings.vanilla_demo_limit === undefined ? hostConfig.vanilla_demo_limit : normalizeCompatibilityFlag('vanilla_demo_limit', settings.vanilla_demo_limit),
    vanilla_keyboard_mapping: settings.vanilla_keyboard_mapping === undefined ? hostConfig.vanilla_keyboard_mapping : normalizeCompatibilityFlag('vanilla_keyboard_mapping', settings.vanilla_keyboard_mapping),
    vanilla_savegame_limit: settings.vanilla_savegame_limit === undefined ? hostConfig.vanilla_savegame_limit : normalizeCompatibilityFlag('vanilla_savegame_limit', settings.vanilla_savegame_limit),
  });
}

function serializeCompatibilityFlags(flags: PersistedVanillaCompatibilityFlags): string {
  return VANILLA_COMPATIBILITY_FLAG_NAMES.map((flagName) => `${flagName}=${flags[flagName]}`).join('\n');
}

function validateCommandContract(commandContract: RuntimeCommandContract): void {
  if (
    commandContract.entryFile !== PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT.entryFile ||
    commandContract.program !== PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT.program ||
    commandContract.subcommand !== PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT.subcommand ||
    commandContract.targetCommand !== PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT.targetCommand
  ) {
    throw new Error('persist vanilla compatibility flags requires command contract bun run doom.ts');
  }
}

/**
 * Persist Chocolate Doom vanilla compatibility flags for the Bun playable path.
 *
 * @param options - Optional command contract, starting configs, and flag updates.
 * @returns Frozen deterministic config persistence evidence for replay tests.
 *
 * @example
 * ```ts
 * const evidence = persistVanillaCompatibilityFlags({
 *   flags: { vanilla_demo_limit: false, vanilla_savegame_limit: true },
 * });
 * evidence.persistedHostConfig.vanilla_savegame_limit; // 1
 * ```
 */
export function persistVanillaCompatibilityFlags(options: PersistVanillaCompatibilityFlagsOptions = {}): PersistVanillaCompatibilityFlagsResult {
  const commandContract = options.commandContract ?? PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT;
  validateCommandContract(commandContract);

  const defaultConfig = options.defaultConfig ?? createDefaultVanillaCfg();
  const hostConfig = options.hostConfig ?? createDefaultHostExtraCfg();
  const afterFlags = resolveCompatibilityFlags(hostConfig, options.flags ?? {});
  const beforeFlags = pickCompatibilityFlags(hostConfig);
  const afterSerializedState = serializeCompatibilityFlags(afterFlags);
  const beforeSerializedState = serializeCompatibilityFlags(beforeFlags);
  const persistedHostConfig: VanillaExtendedCfg = Object.freeze({
    ...hostConfig,
    vanilla_demo_limit: afterFlags.vanilla_demo_limit,
    vanilla_keyboard_mapping: afterFlags.vanilla_keyboard_mapping,
    vanilla_savegame_limit: afterFlags.vanilla_savegame_limit,
  });
  const replayMaterial = [commandContract.targetCommand, CONFIG_PERSISTENCE_AUDIT_LINK.stepId, beforeSerializedState, afterSerializedState].join('\n');
  const transitionSignature = `${beforeSerializedState.replaceAll('\n', '|')} -> ${afterSerializedState.replaceAll('\n', '|')}`;

  return Object.freeze({
    afterFlags,
    afterHash: computeSha256(afterSerializedState),
    afterSerializedState,
    auditLink: CONFIG_PERSISTENCE_AUDIT_LINK,
    beforeFlags,
    beforeHash: computeSha256(beforeSerializedState),
    beforeSerializedState,
    commandContract,
    defaultConfigUnchanged: true,
    persistedDefaultConfig: defaultConfig,
    persistedHostConfig,
    replayChecksum: computeReplayChecksum(replayMaterial),
    replayMaterialHash: computeSha256(replayMaterial),
    transitionSignature,
  });
}
