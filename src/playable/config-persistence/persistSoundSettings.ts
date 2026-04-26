import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const CONFIG_PERSISTENCE_AUDIT_STEP_ID = '01-014';
export const PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: 'bun run doom.ts',
});
export const SOUND_SETTINGS_PERSISTENCE_SURFACE = 'soundSettingsPersistence';

export const PERSISTED_HOST_SOUND_FIELDS = Object.freeze([
  'snd_samplerate',
  'snd_cachesize',
  'snd_maxslicetime_ms',
  'snd_musiccmd',
  'snd_dmxoption',
  'opl_io_port',
  'use_libsamplerate',
  'libsamplerate_scale',
  'timidity_cfg_path',
  'gus_patch_path',
  'gus_ram_kb',
] as const);

export const PERSISTED_VANILLA_SOUND_FIELDS = Object.freeze(['sfx_volume', 'music_volume', 'snd_channels', 'snd_musicdevice', 'snd_sfxdevice', 'snd_sbport', 'snd_sbirq', 'snd_sbdma', 'snd_mport'] as const);

export interface PersistSoundSettingsInput {
  readonly command?: string;
  readonly hostConfig?: VanillaExtendedCfg;
  readonly soundSettings?: SoundSettingsOverrides;
  readonly vanillaConfig?: VanillaDefaultCfg;
}

export interface PersistSoundSettingsResult {
  readonly commandContract: typeof PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT;
  readonly deterministicReplay: SoundSettingsReplayEvidence;
  readonly hostConfig: VanillaExtendedCfg;
  readonly persistedHostFields: readonly PersistedHostSoundField[];
  readonly persistedVanillaFields: readonly PersistedVanillaSoundField[];
  readonly transition: SoundSettingsTransition;
  readonly vanillaConfig: VanillaDefaultCfg;
}

export type PersistedHostSoundField = (typeof PERSISTED_HOST_SOUND_FIELDS)[number];
export type PersistedVanillaSoundField = (typeof PERSISTED_VANILLA_SOUND_FIELDS)[number];

export interface SoundSettingsOverrides {
  readonly cacheSizeBytes?: number;
  readonly digitalMusicOption?: string;
  readonly gravisUltraSoundPatchPath?: string;
  readonly gravisUltraSoundRamKilobytes?: number;
  readonly libsamplerateScale?: number;
  readonly maximumSliceTimeMilliseconds?: number;
  readonly musicCommand?: string;
  readonly musicDevice?: number;
  readonly musicPort?: number;
  readonly musicVolume?: number;
  readonly oplInputOutputPort?: number;
  readonly sampleRate?: number;
  readonly sampleRateConversionEnabled?: boolean;
  readonly soundBlasterDirectMemoryAccess?: number;
  readonly soundBlasterInterruptRequest?: number;
  readonly soundBlasterPort?: number;
  readonly soundChannels?: number;
  readonly soundEffectDevice?: number;
  readonly soundEffectVolume?: number;
  readonly timidityConfigPath?: string;
}

export interface SoundSettingsReplayEvidence {
  readonly checksum: number;
  readonly hostHash: string;
  readonly signature: string;
  readonly vanillaHash: string;
}

export interface SoundSettingsTransition {
  readonly changedFieldCount: number;
  readonly hostSignature: string;
  readonly manifestSurface: typeof SOUND_SETTINGS_PERSISTENCE_SURFACE;
  readonly soundPersistenceSurface: 'default.cfg+chocolate-doom.cfg';
  readonly vanillaSignature: string;
}

const MAXIMUM_CONFIG_STRING_LENGTH = 260;

export function persistSoundSettings(input: PersistSoundSettingsInput = {}): PersistSoundSettingsResult {
  const command = input.command ?? PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT.targetCommand;
  assertProductCommand(command);

  const baseHostConfig = input.hostConfig ?? createDefaultHostExtraCfg();
  const baseVanillaConfig = input.vanillaConfig ?? createDefaultVanillaCfg();
  const soundSettings = input.soundSettings ?? {};

  const vanillaConfig: VanillaDefaultCfg = Object.freeze({
    ...baseVanillaConfig,
    music_volume: resolveIntegerSetting(soundSettings.musicVolume, baseVanillaConfig.music_volume, 0, 15, 'musicVolume'),
    sfx_volume: resolveIntegerSetting(soundSettings.soundEffectVolume, baseVanillaConfig.sfx_volume, 0, 15, 'soundEffectVolume'),
    snd_channels: resolveIntegerSetting(soundSettings.soundChannels, baseVanillaConfig.snd_channels, 1, 32, 'soundChannels'),
    snd_mport: resolveIntegerSetting(soundSettings.musicPort, baseVanillaConfig.snd_mport, 0, 0xffff, 'musicPort'),
    snd_musicdevice: resolveIntegerSetting(soundSettings.musicDevice, baseVanillaConfig.snd_musicdevice, 0, 9, 'musicDevice'),
    snd_sbport: resolveIntegerSetting(soundSettings.soundBlasterPort, baseVanillaConfig.snd_sbport, 0, 0xffff, 'soundBlasterPort'),
    snd_sbdma: resolveIntegerSetting(soundSettings.soundBlasterDirectMemoryAccess, baseVanillaConfig.snd_sbdma, 0, 7, 'soundBlasterDirectMemoryAccess'),
    snd_sbirq: resolveIntegerSetting(soundSettings.soundBlasterInterruptRequest, baseVanillaConfig.snd_sbirq, 0, 15, 'soundBlasterInterruptRequest'),
    snd_sfxdevice: resolveIntegerSetting(soundSettings.soundEffectDevice, baseVanillaConfig.snd_sfxdevice, 0, 9, 'soundEffectDevice'),
  });

  const hostConfig: VanillaExtendedCfg = Object.freeze({
    ...baseHostConfig,
    gus_patch_path: resolveConfigString(soundSettings.gravisUltraSoundPatchPath, baseHostConfig.gus_patch_path, 'gravisUltraSoundPatchPath'),
    gus_ram_kb: resolveIntegerSetting(soundSettings.gravisUltraSoundRamKilobytes, baseHostConfig.gus_ram_kb, 0, 65_536, 'gravisUltraSoundRamKilobytes'),
    libsamplerate_scale: resolveNumberSetting(soundSettings.libsamplerateScale, baseHostConfig.libsamplerate_scale, 0.01, 1, 'libsamplerateScale'),
    opl_io_port: resolveIntegerSetting(soundSettings.oplInputOutputPort, baseHostConfig.opl_io_port, 0, 0xffff, 'oplInputOutputPort'),
    snd_cachesize: resolveIntegerSetting(soundSettings.cacheSizeBytes, baseHostConfig.snd_cachesize, 0, 1_073_741_824, 'cacheSizeBytes'),
    snd_dmxoption: resolveConfigString(soundSettings.digitalMusicOption, baseHostConfig.snd_dmxoption, 'digitalMusicOption'),
    snd_maxslicetime_ms: resolveIntegerSetting(soundSettings.maximumSliceTimeMilliseconds, baseHostConfig.snd_maxslicetime_ms, 1, 1_000, 'maximumSliceTimeMilliseconds'),
    snd_musiccmd: resolveConfigString(soundSettings.musicCommand, baseHostConfig.snd_musiccmd, 'musicCommand'),
    snd_samplerate: resolveIntegerSetting(soundSettings.sampleRate, baseHostConfig.snd_samplerate, 8_000, 192_000, 'sampleRate'),
    timidity_cfg_path: resolveConfigString(soundSettings.timidityConfigPath, baseHostConfig.timidity_cfg_path, 'timidityConfigPath'),
    use_libsamplerate: resolveBooleanIntegerSetting(soundSettings.sampleRateConversionEnabled, baseHostConfig.use_libsamplerate, 'sampleRateConversionEnabled'),
  });

  const vanillaSignature = buildVanillaSoundSignature(vanillaConfig);
  const hostSignature = buildHostSoundSignature(hostConfig);
  const signature = `${PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT.targetCommand}|${vanillaSignature}|${hostSignature}`;

  const transition: SoundSettingsTransition = Object.freeze({
    changedFieldCount: countChangedFields(baseVanillaConfig, vanillaConfig, baseHostConfig, hostConfig),
    hostSignature,
    manifestSurface: SOUND_SETTINGS_PERSISTENCE_SURFACE,
    soundPersistenceSurface: 'default.cfg+chocolate-doom.cfg',
    vanillaSignature,
  });

  const deterministicReplay: SoundSettingsReplayEvidence = Object.freeze({
    checksum: computeReplayChecksum(signature),
    hostHash: computeSha256Hex(hostSignature),
    signature,
    vanillaHash: computeSha256Hex(vanillaSignature),
  });

  return Object.freeze({
    commandContract: PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT,
    deterministicReplay,
    hostConfig,
    persistedHostFields: PERSISTED_HOST_SOUND_FIELDS,
    persistedVanillaFields: PERSISTED_VANILLA_SOUND_FIELDS,
    transition,
    vanillaConfig,
  });
}

function assertProductCommand(command: string): void {
  if (command !== PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT.targetCommand) {
    throw new Error(`persist sound settings requires ${PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT.targetCommand}, got ${command}`);
  }
}

function buildHostSoundSignature(hostConfig: VanillaExtendedCfg): string {
  return PERSISTED_HOST_SOUND_FIELDS.map((fieldName) => `${fieldName}=${formatConfigValue(hostConfig[fieldName])}`).join(';');
}

function buildVanillaSoundSignature(vanillaConfig: VanillaDefaultCfg): string {
  return PERSISTED_VANILLA_SOUND_FIELDS.map((fieldName) => `${fieldName}=${formatConfigValue(vanillaConfig[fieldName])}`).join(';');
}

function computeReplayChecksum(value: string): number {
  let checksum = 0;
  for (let characterIndex = 0; characterIndex < value.length; characterIndex += 1) {
    checksum = (checksum * 131 + value.charCodeAt(characterIndex)) % 4_294_967_291;
  }
  return checksum;
}

function computeSha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

function countChangedFields(baseVanillaConfig: VanillaDefaultCfg, vanillaConfig: VanillaDefaultCfg, baseHostConfig: VanillaExtendedCfg, hostConfig: VanillaExtendedCfg): number {
  let changedFieldCount = 0;

  for (const fieldName of PERSISTED_VANILLA_SOUND_FIELDS) {
    if (baseVanillaConfig[fieldName] !== vanillaConfig[fieldName]) {
      changedFieldCount += 1;
    }
  }

  for (const fieldName of PERSISTED_HOST_SOUND_FIELDS) {
    if (baseHostConfig[fieldName] !== hostConfig[fieldName]) {
      changedFieldCount += 1;
    }
  }

  return changedFieldCount;
}

function formatConfigValue(value: number | string): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return String(value);
}

function resolveBooleanIntegerSetting(value: boolean | undefined, fallback: number, settingName: string): number {
  if (value === undefined) {
    return resolveIntegerSetting(undefined, fallback, 0, 1, settingName);
  }

  return value ? 1 : 0;
}

function resolveConfigString(value: string | undefined, fallback: string, settingName: string): string {
  const resolvedValue = value ?? fallback;

  if (resolvedValue.length > MAXIMUM_CONFIG_STRING_LENGTH) {
    throw new Error(`${settingName} must be ${MAXIMUM_CONFIG_STRING_LENGTH} characters or fewer`);
  }

  if (resolvedValue.includes('\0') || resolvedValue.includes('\n') || resolvedValue.includes('\r')) {
    throw new Error(`${settingName} must fit on one config line`);
  }

  return resolvedValue;
}

function resolveIntegerSetting(value: number | undefined, fallback: number, minimumValue: number, maximumValue: number, settingName: string): number {
  const resolvedValue = value ?? fallback;

  if (!Number.isInteger(resolvedValue) || resolvedValue < minimumValue || resolvedValue > maximumValue) {
    throw new Error(`${settingName} must be an integer from ${minimumValue} to ${maximumValue}`);
  }

  return resolvedValue;
}

function resolveNumberSetting(value: number | undefined, fallback: number, minimumValue: number, maximumValue: number, settingName: string): number {
  const resolvedValue = value ?? fallback;

  if (!Number.isFinite(resolvedValue) || resolvedValue < minimumValue || resolvedValue > maximumValue) {
    throw new Error(`${settingName} must be a number from ${minimumValue} to ${maximumValue}`);
  }

  return resolvedValue;
}
