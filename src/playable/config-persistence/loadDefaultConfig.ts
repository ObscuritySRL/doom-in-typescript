import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { DEFAULT_CFG_VARIABLE_COUNT, createDefaultVanillaCfg, parseDefaultCfg } from '../../config/defaultCfg.ts';
import { HOST_EXTRA_CFG_VARIABLE_COUNT, createDefaultHostExtraCfg, parseHostExtraCfg } from '../../config/hostConfig.ts';

export const LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
});

export interface LoadDefaultConfigInput {
  readonly command: string;
  readonly defaultConfigPath?: string;
  readonly hostConfigPath?: string;
}

export interface LoadDefaultConfigResult {
  readonly commandContract: typeof LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT;
  readonly defaultConfig: VanillaDefaultCfg;
  readonly hostConfig: VanillaExtendedCfg;
  readonly sourceSummary: LoadDefaultConfigSourceSummary;
  readonly transition: LoadDefaultConfigTransition;
}

export interface LoadDefaultConfigSource {
  readonly path: string | null;
  readonly state: LoadDefaultConfigSourceState;
  readonly variableCount: number;
}

export interface LoadDefaultConfigSourceSummary {
  readonly defaultConfig: LoadDefaultConfigSource;
  readonly hostConfig: LoadDefaultConfigSource;
}

export type LoadDefaultConfigSourceState = 'hardcoded-defaults' | 'loaded-file' | 'missing-file-defaults';

export interface LoadDefaultConfigTransition {
  readonly auditStepId: '01-014';
  readonly bunFileReadCount: number;
  readonly command: string;
  readonly defaultConfigVariableCount: number;
  readonly deterministicReplayCompatible: true;
  readonly hostConfigVariableCount: number;
  readonly replayChecksum: number;
  readonly replayHash: string;
}

function assertProductCommand(command: string): void {
  if (command !== LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command) {
    throw new Error(`load default config requires ${LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command}`);
  }
}

function createReplayChecksum(seed: string): number {
  let checksum = 2_166_136_261;
  for (let characterIndex = 0; characterIndex < seed.length; characterIndex += 1) {
    checksum ^= seed.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 16_777_619) >>> 0;
  }
  return checksum;
}

function createReplayHash(seed: string): string {
  return new Bun.CryptoHasher('sha256').update(seed).digest('hex');
}

function createReplaySeed(defaultConfig: VanillaDefaultCfg, defaultConfigState: LoadDefaultConfigSourceState, hostConfig: VanillaExtendedCfg, hostConfigState: LoadDefaultConfigSourceState, readCount: number): string {
  return [
    LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command,
    defaultConfigState,
    hostConfigState,
    `reads=${readCount}`,
    `defaultVariables=${DEFAULT_CFG_VARIABLE_COUNT}`,
    `hostVariables=${HOST_EXTRA_CFG_VARIABLE_COUNT}`,
    `mouse_sensitivity=${defaultConfig.mouse_sensitivity}`,
    `sfx_volume=${defaultConfig.sfx_volume}`,
    `music_volume=${defaultConfig.music_volume}`,
    `key_fire=${defaultConfig.key_fire}`,
    `chatmacro1=${defaultConfig.chatmacro1}`,
    `fullscreen=${hostConfig.fullscreen}`,
    `screen_width=${hostConfig.screen_width}`,
    `screen_height=${hostConfig.screen_height}`,
    `snd_samplerate=${hostConfig.snd_samplerate}`,
    `vanilla_keyboard_mapping=${hostConfig.vanilla_keyboard_mapping}`,
    `key_menu_activate=${hostConfig.key_menu_activate}`,
  ].join('\n');
}

function normalizeConfigPath(path: string | undefined, label: string): string | null {
  if (path === undefined) {
    return null;
  }

  if (path.trim().length === 0) {
    throw new Error(`${label} path must not be empty`);
  }

  return path;
}

/**
 * Load the vanilla `default.cfg` and Chocolate Doom host config for the
 * Bun playable command path, falling back to hardcoded parser defaults
 * when either file is absent.
 *
 * @param input - Runtime command and optional config file paths.
 * @returns Frozen parsed config objects plus deterministic replay evidence.
 * @example
 * ```ts
 * const loadedConfig = await loadDefaultConfig({ command: 'bun run doom.ts' });
 * loadedConfig.defaultConfig.sfx_volume;
 * ```
 */
export async function loadDefaultConfig(input: LoadDefaultConfigInput): Promise<LoadDefaultConfigResult> {
  assertProductCommand(input.command);

  const defaultConfigPath = normalizeConfigPath(input.defaultConfigPath, 'default.cfg');
  const hostConfigPath = normalizeConfigPath(input.hostConfigPath, 'chocolate-doom.cfg');

  let bunFileReadCount = 0;
  let defaultConfig = createDefaultVanillaCfg();
  let defaultConfigState: LoadDefaultConfigSourceState = 'hardcoded-defaults';
  let hostConfig = createDefaultHostExtraCfg();
  let hostConfigState: LoadDefaultConfigSourceState = 'hardcoded-defaults';

  if (defaultConfigPath !== null) {
    const defaultConfigFile = Bun.file(defaultConfigPath);
    if (await defaultConfigFile.exists()) {
      defaultConfig = parseDefaultCfg(await defaultConfigFile.text());
      bunFileReadCount += 1;
      defaultConfigState = 'loaded-file';
    } else {
      defaultConfigState = 'missing-file-defaults';
    }
  }

  if (hostConfigPath !== null) {
    const hostConfigFile = Bun.file(hostConfigPath);
    if (await hostConfigFile.exists()) {
      hostConfig = parseHostExtraCfg(await hostConfigFile.text());
      bunFileReadCount += 1;
      hostConfigState = 'loaded-file';
    } else {
      hostConfigState = 'missing-file-defaults';
    }
  }

  const replaySeed = createReplaySeed(defaultConfig, defaultConfigState, hostConfig, hostConfigState, bunFileReadCount);
  const sourceSummary: LoadDefaultConfigSourceSummary = Object.freeze({
    defaultConfig: Object.freeze({
      path: defaultConfigPath,
      state: defaultConfigState,
      variableCount: DEFAULT_CFG_VARIABLE_COUNT,
    }),
    hostConfig: Object.freeze({
      path: hostConfigPath,
      state: hostConfigState,
      variableCount: HOST_EXTRA_CFG_VARIABLE_COUNT,
    }),
  });
  const transition: LoadDefaultConfigTransition = Object.freeze({
    auditStepId: '01-014',
    bunFileReadCount,
    command: input.command,
    defaultConfigVariableCount: DEFAULT_CFG_VARIABLE_COUNT,
    deterministicReplayCompatible: true,
    hostConfigVariableCount: HOST_EXTRA_CFG_VARIABLE_COUNT,
    replayChecksum: createReplayChecksum(replaySeed),
    replayHash: createReplayHash(replaySeed),
  });

  return Object.freeze({
    commandContract: LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT,
    defaultConfig,
    hostConfig,
    sourceSummary,
    transition,
  });
}
