import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';

import { createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const PERSIST_SCREEN_SETTINGS_AUDIT_LINK = Object.freeze({
  missingSurface: 'screenSettingsPersistence',
  stepId: '01-014',
});

export const PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: 'bun run doom.ts',
});

export interface PersistScreenSettingsReplayEvidence {
  readonly auditSurface: string;
  readonly command: string;
  readonly hostFieldOrder: readonly string[];
  readonly hostScreenHash: string;
  readonly replayChecksum: number;
  readonly stateHash: string;
  readonly transitionSignature: string;
  readonly vanillaFieldOrder: readonly string[];
  readonly vanillaScreenHash: string;
}

export interface PersistScreenSettingsRequest {
  readonly command: string;
  readonly hostConfig?: VanillaExtendedCfg;
  readonly settings?: Partial<PersistScreenSettingsValues>;
  readonly vanillaConfig?: VanillaDefaultCfg;
}

export interface PersistScreenSettingsResult {
  readonly commandContract: typeof PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT;
  readonly hostConfig: VanillaExtendedCfg;
  readonly replayEvidence: PersistScreenSettingsReplayEvidence;
  readonly transition: PersistScreenSettingsTransition;
  readonly vanillaConfig: VanillaDefaultCfg;
}

export interface PersistScreenSettingsTransition {
  readonly changedHostFields: readonly string[];
  readonly changedVanillaFields: readonly string[];
  readonly hostSignature: string;
  readonly vanillaSignature: string;
}

export interface PersistScreenSettingsValues {
  readonly aspect_ratio_correct: number;
  readonly autoadjust_video_settings: number;
  readonly detaillevel: number;
  readonly fullscreen: number;
  readonly png_screenshots: number;
  readonly screen_bpp: number;
  readonly screen_height: number;
  readonly screen_width: number;
  readonly screenblocks: number;
  readonly show_endoom: number;
  readonly startup_delay: number;
  readonly usegamma: number;
  readonly video_driver: string;
  readonly window_position: string;
}

const DEFAULT_PLAYABLE_SCREEN_SETTINGS: PersistScreenSettingsValues = Object.freeze({
  aspect_ratio_correct: 1,
  autoadjust_video_settings: 0,
  detaillevel: 0,
  fullscreen: 0,
  png_screenshots: 0,
  screen_bpp: 32,
  screen_height: 480,
  screen_width: 640,
  screenblocks: 9,
  show_endoom: 1,
  startup_delay: 1000,
  usegamma: 0,
  video_driver: '',
  window_position: '',
});

const HOST_SCREEN_FIELD_ORDER = Object.freeze([
  'autoadjust_video_settings',
  'fullscreen',
  'aspect_ratio_correct',
  'startup_delay',
  'screen_width',
  'screen_height',
  'screen_bpp',
  'show_endoom',
  'png_screenshots',
  'video_driver',
  'window_position',
] as const);

const SCREEN_BITS_PER_PIXEL_VALUES = Object.freeze([0, 8, 15, 16, 24, 32]);

const SCREEN_SETTING_NAMES: ReadonlySet<string> = new Set([
  'aspect_ratio_correct',
  'autoadjust_video_settings',
  'detaillevel',
  'fullscreen',
  'png_screenshots',
  'screen_bpp',
  'screen_height',
  'screen_width',
  'screenblocks',
  'show_endoom',
  'startup_delay',
  'usegamma',
  'video_driver',
  'window_position',
]);

const VANILLA_SCREEN_FIELD_ORDER = Object.freeze(['screenblocks', 'detaillevel', 'usegamma'] as const);

/**
 * Persist Doom screen settings into the typed vanilla and host config snapshots.
 *
 * @param request - Runtime command, optional config snapshots, and optional screen settings.
 * @returns Frozen config snapshots plus deterministic replay evidence for the persisted screen state.
 * @example
 * ```ts
 * const result = persistScreenSettings({
 *   command: 'bun run doom.ts',
 *   settings: { screenblocks: 10, usegamma: 2 },
 * });
 * result.vanillaConfig.screenblocks; // 10
 * ```
 */
export function persistScreenSettings(request: PersistScreenSettingsRequest): PersistScreenSettingsResult {
  assertProductCommand(request.command);

  const baseHostConfig = request.hostConfig ?? createDefaultHostExtraCfg();
  const baseVanillaConfig = request.vanillaConfig ?? createDefaultVanillaCfg();
  const screenSettings = resolveScreenSettings(request.settings);

  const vanillaConfig: VanillaDefaultCfg = Object.freeze({
    ...baseVanillaConfig,
    detaillevel: screenSettings.detaillevel,
    screenblocks: screenSettings.screenblocks,
    usegamma: screenSettings.usegamma,
  });

  const hostConfig: VanillaExtendedCfg = Object.freeze({
    ...baseHostConfig,
    aspect_ratio_correct: screenSettings.aspect_ratio_correct,
    autoadjust_video_settings: screenSettings.autoadjust_video_settings,
    fullscreen: screenSettings.fullscreen,
    png_screenshots: screenSettings.png_screenshots,
    screen_bpp: screenSettings.screen_bpp,
    screen_height: screenSettings.screen_height,
    screen_width: screenSettings.screen_width,
    show_endoom: screenSettings.show_endoom,
    startup_delay: screenSettings.startup_delay,
    video_driver: screenSettings.video_driver,
    window_position: screenSettings.window_position,
  });

  const transition = Object.freeze({
    changedHostFields: getChangedFields(baseHostConfig, hostConfig, HOST_SCREEN_FIELD_ORDER),
    changedVanillaFields: getChangedFields(baseVanillaConfig, vanillaConfig, VANILLA_SCREEN_FIELD_ORDER),
    hostSignature: serializeFields(hostConfig, HOST_SCREEN_FIELD_ORDER),
    vanillaSignature: serializeFields(vanillaConfig, VANILLA_SCREEN_FIELD_ORDER),
  });

  const hostScreenHash = hashText(transition.hostSignature);
  const vanillaScreenHash = hashText(transition.vanillaSignature);
  const transitionSignature = `screen-settings:${vanillaScreenHash}:${hostScreenHash}`;
  const stateHash = hashText(`${transition.vanillaSignature}\n${transition.hostSignature}`);

  return Object.freeze({
    commandContract: PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT,
    hostConfig,
    replayEvidence: Object.freeze({
      auditSurface: PERSIST_SCREEN_SETTINGS_AUDIT_LINK.missingSurface,
      command: PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT.targetCommand,
      hostFieldOrder: HOST_SCREEN_FIELD_ORDER,
      hostScreenHash,
      replayChecksum: checksumText(transitionSignature),
      stateHash,
      transitionSignature,
      vanillaFieldOrder: VANILLA_SCREEN_FIELD_ORDER,
      vanillaScreenHash,
    }),
    transition,
    vanillaConfig,
  });
}

function assertBinaryInteger(value: number, name: string): void {
  assertIntegerRange(value, name, 0, 1);
}

function assertConfigString(value: string, name: string): void {
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error(`${name} must not contain a config line break`);
  }

  if (value.length > 260) {
    throw new Error(`${name} must be 260 characters or shorter`);
  }
}

function assertIntegerRange(value: number, name: string, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
}

function assertProductCommand(command: string): void {
  if (command !== PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT.targetCommand) {
    throw new Error(`persist screen settings requires ${PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT.targetCommand}`);
  }
}

function assertScreenBitsPerPixel(value: number): void {
  if (!SCREEN_BITS_PER_PIXEL_VALUES.includes(value)) {
    throw new Error(`screen_bpp must be one of ${SCREEN_BITS_PER_PIXEL_VALUES.join(', ')}`);
  }
}

function checksumText(text: string): number {
  let checksum = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    checksum ^= text.charCodeAt(index);
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }

  return checksum;
}

function getChangedFields<FieldName extends string>(beforeConfig: Readonly<Record<FieldName, number | string>>, afterConfig: Readonly<Record<FieldName, number | string>>, fieldOrder: readonly FieldName[]): readonly string[] {
  const changedFields: string[] = [];

  for (const fieldName of fieldOrder) {
    if (beforeConfig[fieldName] !== afterConfig[fieldName]) {
      changedFields.push(fieldName);
    }
  }

  return Object.freeze(changedFields);
}

function hashText(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(text);
  return hasher.digest('hex');
}

function rejectUnknownSettings(settings: Partial<PersistScreenSettingsValues>): void {
  for (const settingName of Object.keys(settings)) {
    if (!SCREEN_SETTING_NAMES.has(settingName)) {
      throw new Error(`unknown screen setting ${settingName}`);
    }
  }
}

function resolveScreenSettings(settings: Partial<PersistScreenSettingsValues> | undefined): PersistScreenSettingsValues {
  if (settings !== undefined) {
    rejectUnknownSettings(settings);
  }

  const resolvedSettings: PersistScreenSettingsValues = Object.freeze({
    aspect_ratio_correct: settings?.aspect_ratio_correct ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.aspect_ratio_correct,
    autoadjust_video_settings: settings?.autoadjust_video_settings ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.autoadjust_video_settings,
    detaillevel: settings?.detaillevel ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.detaillevel,
    fullscreen: settings?.fullscreen ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.fullscreen,
    png_screenshots: settings?.png_screenshots ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.png_screenshots,
    screen_bpp: settings?.screen_bpp ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.screen_bpp,
    screen_height: settings?.screen_height ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.screen_height,
    screen_width: settings?.screen_width ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.screen_width,
    screenblocks: settings?.screenblocks ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.screenblocks,
    show_endoom: settings?.show_endoom ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.show_endoom,
    startup_delay: settings?.startup_delay ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.startup_delay,
    usegamma: settings?.usegamma ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.usegamma,
    video_driver: settings?.video_driver ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.video_driver,
    window_position: settings?.window_position ?? DEFAULT_PLAYABLE_SCREEN_SETTINGS.window_position,
  });

  assertBinaryInteger(resolvedSettings.aspect_ratio_correct, 'aspect_ratio_correct');
  assertBinaryInteger(resolvedSettings.autoadjust_video_settings, 'autoadjust_video_settings');
  assertBinaryInteger(resolvedSettings.detaillevel, 'detaillevel');
  assertBinaryInteger(resolvedSettings.fullscreen, 'fullscreen');
  assertBinaryInteger(resolvedSettings.png_screenshots, 'png_screenshots');
  assertBinaryInteger(resolvedSettings.show_endoom, 'show_endoom');
  assertConfigString(resolvedSettings.video_driver, 'video_driver');
  assertConfigString(resolvedSettings.window_position, 'window_position');
  assertIntegerRange(resolvedSettings.screen_height, 'screen_height', 0, 16_384);
  assertIntegerRange(resolvedSettings.screen_width, 'screen_width', 0, 16_384);
  assertIntegerRange(resolvedSettings.screenblocks, 'screenblocks', 3, 11);
  assertIntegerRange(resolvedSettings.startup_delay, 'startup_delay', 0, 10_000);
  assertIntegerRange(resolvedSettings.usegamma, 'usegamma', 0, 4);
  assertScreenBitsPerPixel(resolvedSettings.screen_bpp);

  return resolvedSettings;
}

function serializeField(value: number | string): string {
  return typeof value === 'string' ? JSON.stringify(value) : value.toString();
}

function serializeFields<FieldName extends string>(config: Readonly<Record<FieldName, number | string>>, fieldOrder: readonly FieldName[]): string {
  return fieldOrder.map((fieldName) => `${fieldName}=${serializeField(config[fieldName])}`).join(';');
}
