import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-014-audit-missing-config-persistence.json';
export const MOUSE_SETTINGS_AUDIT_SURFACE = 'mouseSettingsPersistence';
export const PLAYABLE_CONFIG_COMMAND = 'bun run doom.ts';

const MOUSE_FIELD_NAMES = Object.freeze([
  'mouse_sensitivity',
  'use_mouse',
  'mouseb_fire',
  'mouseb_strafe',
  'mouseb_forward',
  'grabmouse',
  'novert',
  'mouse_acceleration',
  'mouse_threshold',
  'mouseb_strafeleft',
  'mouseb_straferight',
  'mouseb_use',
  'mouseb_backward',
  'mouseb_prevweapon',
  'mouseb_nextweapon',
  'dclick_use',
] as const);

export type BinaryConfigValue = 0 | 1;

export interface PersistMouseSettingsChanges {
  readonly dclickUse?: BinaryConfigValue;
  readonly grabMouse?: BinaryConfigValue;
  readonly mouseAcceleration?: number;
  readonly mouseBackwardButton?: number;
  readonly mouseFireButton?: number;
  readonly mouseForwardButton?: number;
  readonly mouseNextWeaponButton?: number;
  readonly mousePreviousWeaponButton?: number;
  readonly mouseSensitivity?: number;
  readonly mouseStrafeButton?: number;
  readonly mouseStrafeLeftButton?: number;
  readonly mouseStrafeRightButton?: number;
  readonly mouseThreshold?: number;
  readonly mouseUseButton?: number;
  readonly noVerticalMouseMovement?: BinaryConfigValue;
  readonly useMouse?: BinaryConfigValue;
}

export interface PersistMouseSettingsReplayEvidence {
  readonly auditManifestPath: typeof CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH;
  readonly auditSurface: typeof MOUSE_SETTINGS_AUDIT_SURFACE;
  readonly command: typeof PLAYABLE_CONFIG_COMMAND;
  readonly fieldNames: readonly string[];
  readonly replayChecksum: number;
  readonly serializedState: string;
  readonly stateHash: string;
  readonly transition: 'mouse-settings-persisted';
}

export interface PersistMouseSettingsRequest {
  readonly command?: string;
  readonly hostConfig?: VanillaExtendedCfg;
  readonly mouseSettings?: PersistMouseSettingsChanges;
  readonly vanillaConfig?: VanillaDefaultCfg;
}

export interface PersistMouseSettingsResult {
  readonly command: typeof PLAYABLE_CONFIG_COMMAND;
  readonly hostConfig: VanillaExtendedCfg;
  readonly replayEvidence: PersistMouseSettingsReplayEvidence;
  readonly vanillaConfig: VanillaDefaultCfg;
}

/**
 * Persist playable mouse settings into the vanilla and extended config snapshots.
 *
 * @param request - Optional command, base config snapshots, and mouse setting overrides.
 * @returns Frozen config snapshots plus deterministic replay evidence.
 *
 * @example
 * ```ts
 * import { persistMouseSettings } from './persistMouseSettings.ts';
 *
 * const result = persistMouseSettings({
 *   mouseSettings: { mouseSensitivity: 7, useMouse: 1 },
 * });
 * result.vanillaConfig.mouse_sensitivity; // 7
 * ```
 */
export function persistMouseSettings(request: PersistMouseSettingsRequest = {}): PersistMouseSettingsResult {
  const command = request.command ?? PLAYABLE_CONFIG_COMMAND;
  if (command !== PLAYABLE_CONFIG_COMMAND) {
    throw new Error(`persist mouse settings requires ${PLAYABLE_CONFIG_COMMAND}`);
  }

  const hostConfig = request.hostConfig ?? createDefaultHostExtraCfg();
  const mouseSettings = request.mouseSettings ?? {};
  const vanillaConfig = request.vanillaConfig ?? createDefaultVanillaCfg();

  const persistedVanillaConfig: VanillaDefaultCfg = Object.freeze({
    ...vanillaConfig,
    mouse_sensitivity: normalizeInteger('mouse_sensitivity', mouseSettings.mouseSensitivity ?? vanillaConfig.mouse_sensitivity, 0, 9),
    mouseb_fire: normalizeButton('mouseb_fire', mouseSettings.mouseFireButton ?? vanillaConfig.mouseb_fire, 0),
    mouseb_forward: normalizeButton('mouseb_forward', mouseSettings.mouseForwardButton ?? vanillaConfig.mouseb_forward, 0),
    mouseb_strafe: normalizeButton('mouseb_strafe', mouseSettings.mouseStrafeButton ?? vanillaConfig.mouseb_strafe, 0),
    use_mouse: normalizeBinary('use_mouse', mouseSettings.useMouse ?? vanillaConfig.use_mouse),
  });

  const persistedHostConfig: VanillaExtendedCfg = Object.freeze({
    ...hostConfig,
    dclick_use: normalizeBinary('dclick_use', mouseSettings.dclickUse ?? hostConfig.dclick_use),
    grabmouse: normalizeBinary('grabmouse', mouseSettings.grabMouse ?? hostConfig.grabmouse),
    mouse_acceleration: normalizeFloat('mouse_acceleration', mouseSettings.mouseAcceleration ?? hostConfig.mouse_acceleration),
    mouse_threshold: normalizeInteger('mouse_threshold', mouseSettings.mouseThreshold ?? hostConfig.mouse_threshold, 0, 255),
    mouseb_backward: normalizeButton('mouseb_backward', mouseSettings.mouseBackwardButton ?? hostConfig.mouseb_backward, -1),
    mouseb_nextweapon: normalizeButton('mouseb_nextweapon', mouseSettings.mouseNextWeaponButton ?? hostConfig.mouseb_nextweapon, -1),
    mouseb_prevweapon: normalizeButton('mouseb_prevweapon', mouseSettings.mousePreviousWeaponButton ?? hostConfig.mouseb_prevweapon, -1),
    mouseb_strafeleft: normalizeButton('mouseb_strafeleft', mouseSettings.mouseStrafeLeftButton ?? hostConfig.mouseb_strafeleft, -1),
    mouseb_straferight: normalizeButton('mouseb_straferight', mouseSettings.mouseStrafeRightButton ?? hostConfig.mouseb_straferight, -1),
    mouseb_use: normalizeButton('mouseb_use', mouseSettings.mouseUseButton ?? hostConfig.mouseb_use, -1),
    novert: normalizeBinary('novert', mouseSettings.noVerticalMouseMovement ?? hostConfig.novert),
  });

  const serializedState = serializeMouseState(persistedVanillaConfig, persistedHostConfig);
  const replayEvidence: PersistMouseSettingsReplayEvidence = Object.freeze({
    auditManifestPath: CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH,
    auditSurface: MOUSE_SETTINGS_AUDIT_SURFACE,
    command: PLAYABLE_CONFIG_COMMAND,
    fieldNames: MOUSE_FIELD_NAMES,
    replayChecksum: checksumString(serializedState),
    serializedState,
    stateHash: hashString(serializedState),
    transition: 'mouse-settings-persisted',
  });

  return Object.freeze({
    command: PLAYABLE_CONFIG_COMMAND,
    hostConfig: persistedHostConfig,
    replayEvidence,
    vanillaConfig: persistedVanillaConfig,
  });
}

function checksumString(value: string): number {
  let checksum = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    checksum ^= byte;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum;
}

function hashString(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

function normalizeBinary(name: string, value: number): BinaryConfigValue {
  if (value !== 0 && value !== 1) {
    throw new RangeError(`${name} must be 0 or 1`);
  }
  return value;
}

function normalizeButton(name: string, value: number, minimum: -1 | 0): number {
  return normalizeInteger(name, value, minimum, 15);
}

function normalizeFloat(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
  return value;
}

function normalizeInteger(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function serializeFloat(value: number): string {
  return value.toFixed(6);
}

function serializeMouseState(vanillaConfig: VanillaDefaultCfg, hostConfig: VanillaExtendedCfg): string {
  return [
    `mouse_sensitivity=${vanillaConfig.mouse_sensitivity}`,
    `use_mouse=${vanillaConfig.use_mouse}`,
    `mouseb_fire=${vanillaConfig.mouseb_fire}`,
    `mouseb_strafe=${vanillaConfig.mouseb_strafe}`,
    `mouseb_forward=${vanillaConfig.mouseb_forward}`,
    `grabmouse=${hostConfig.grabmouse}`,
    `novert=${hostConfig.novert}`,
    `mouse_acceleration=${serializeFloat(hostConfig.mouse_acceleration)}`,
    `mouse_threshold=${hostConfig.mouse_threshold}`,
    `mouseb_strafeleft=${hostConfig.mouseb_strafeleft}`,
    `mouseb_straferight=${hostConfig.mouseb_straferight}`,
    `mouseb_use=${hostConfig.mouseb_use}`,
    `mouseb_backward=${hostConfig.mouseb_backward}`,
    `mouseb_prevweapon=${hostConfig.mouseb_prevweapon}`,
    `mouseb_nextweapon=${hostConfig.mouseb_nextweapon}`,
    `dclick_use=${hostConfig.dclick_use}`,
  ].join('\n');
}
