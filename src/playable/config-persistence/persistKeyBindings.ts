import type { VanillaDefaultCfg } from '../../config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../config/hostConfig.ts';
import { createDefaultVanillaCfg } from '../../config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../config/hostConfig.ts';

export const PERSIST_KEY_BINDINGS_AUDIT_STEP_ID = '01-014';
export const PERSIST_KEY_BINDINGS_AUDIT_SURFACE = 'keyBindingPersistence';
export const PERSIST_KEY_BINDINGS_COMMAND = 'bun run doom.ts';
export const PERSIST_KEY_BINDINGS_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: PERSIST_KEY_BINDINGS_COMMAND,
});

export const DEFAULT_CFG_KEY_BINDING_NAMES = Object.freeze([
  'key_down',
  'key_fire',
  'key_left',
  'key_right',
  'key_speed',
  'key_strafe',
  'key_strafeleft',
  'key_straferight',
  'key_up',
  'key_use',
] as const satisfies readonly (keyof VanillaDefaultCfg)[]);

export const HOST_CFG_KEY_BINDING_NAMES = Object.freeze([
  'key_demo_quit',
  'key_map_clearmark',
  'key_map_east',
  'key_map_follow',
  'key_map_grid',
  'key_map_mark',
  'key_map_maxzoom',
  'key_map_north',
  'key_map_south',
  'key_map_toggle',
  'key_map_west',
  'key_map_zoomin',
  'key_map_zoomout',
  'key_menu_abort',
  'key_menu_activate',
  'key_menu_back',
  'key_menu_confirm',
  'key_menu_decscreen',
  'key_menu_detail',
  'key_menu_down',
  'key_menu_endgame',
  'key_menu_forward',
  'key_menu_gamma',
  'key_menu_help',
  'key_menu_incscreen',
  'key_menu_left',
  'key_menu_load',
  'key_menu_messages',
  'key_menu_qload',
  'key_menu_qsave',
  'key_menu_quit',
  'key_menu_right',
  'key_menu_save',
  'key_menu_screenshot',
  'key_menu_up',
  'key_menu_volume',
  'key_message_refresh',
  'key_multi_msg',
  'key_multi_msgplayer1',
  'key_multi_msgplayer2',
  'key_multi_msgplayer3',
  'key_multi_msgplayer4',
  'key_nextweapon',
  'key_pause',
  'key_prevweapon',
  'key_spy',
  'key_weapon1',
  'key_weapon2',
  'key_weapon3',
  'key_weapon4',
  'key_weapon5',
  'key_weapon6',
  'key_weapon7',
  'key_weapon8',
] as const satisfies readonly (keyof VanillaExtendedCfg)[]);

export type DefaultCfgKeyBindingName = (typeof DEFAULT_CFG_KEY_BINDING_NAMES)[number];
export type HostCfgKeyBindingName = (typeof HOST_CFG_KEY_BINDING_NAMES)[number];
export type PersistedKeyBindingName = DefaultCfgKeyBindingName | HostCfgKeyBindingName;
export type PersistedKeyBindingNamespace = 'chocolate-doom.cfg' | 'default.cfg';
export type PersistedKeyBindingOverrides = Partial<Record<PersistedKeyBindingName, number>>;

export interface PersistKeyBindingsInput {
  readonly defaultConfiguration?: VanillaDefaultCfg;
  readonly hostConfiguration?: VanillaExtendedCfg;
  readonly keyBindingOverrides?: PersistedKeyBindingOverrides;
  readonly runtimeCommand?: string;
}

export interface PersistKeyBindingsReplayEvidence {
  readonly auditStepId: typeof PERSIST_KEY_BINDINGS_AUDIT_STEP_ID;
  readonly auditSurface: typeof PERSIST_KEY_BINDINGS_AUDIT_SURFACE;
  readonly checksum: number;
  readonly command: typeof PERSIST_KEY_BINDINGS_COMMAND;
  readonly defaultCfgBindingCount: number;
  readonly hostCfgBindingCount: number;
  readonly serializedKeyBindingState: string;
  readonly transition: 'key-bindings-persisted';
}

export interface PersistedKeyBinding {
  readonly name: PersistedKeyBindingName;
  readonly namespace: PersistedKeyBindingNamespace;
  readonly value: number;
}

export interface PersistKeyBindingsResult {
  readonly defaultConfiguration: VanillaDefaultCfg;
  readonly hostConfiguration: VanillaExtendedCfg;
  readonly keyBindings: readonly PersistedKeyBinding[];
  readonly replayEvidence: PersistKeyBindingsReplayEvidence;
}

type MutableVanillaDefaultConfiguration = {
  -readonly [Key in keyof VanillaDefaultCfg]: VanillaDefaultCfg[Key];
};

type MutableVanillaHostConfiguration = {
  -readonly [Key in keyof VanillaExtendedCfg]: VanillaExtendedCfg[Key];
};

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PERSIST_KEY_BINDINGS_COMMAND) {
    throw new Error(`persist key bindings requires ${PERSIST_KEY_BINDINGS_COMMAND}`);
  }
}

function assertValidScanCode(name: PersistedKeyBindingName, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`invalid DOS scan code for ${name}`);
  }
}

function checksumSerializedState(serializedKeyBindingState: string): number {
  let checksum = 0x811c9dc5;
  for (let index = 0; index < serializedKeyBindingState.length; index += 1) {
    checksum ^= serializedKeyBindingState.charCodeAt(index);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum;
}

function serializeKeyBindings(keyBindings: readonly PersistedKeyBinding[]): string {
  const lines: string[] = [];
  for (const keyBinding of keyBindings) {
    lines.push(`${keyBinding.namespace}:${keyBinding.name}=${keyBinding.value}`);
  }
  return lines.join('\n');
}

export function persistKeyBindings(input: PersistKeyBindingsInput = {}): PersistKeyBindingsResult {
  const runtimeCommand = input.runtimeCommand ?? PERSIST_KEY_BINDINGS_COMMAND;
  assertRuntimeCommand(runtimeCommand);

  const defaultConfiguration: MutableVanillaDefaultConfiguration = {
    ...(input.defaultConfiguration ?? createDefaultVanillaCfg()),
  };
  const hostConfiguration: MutableVanillaHostConfiguration = {
    ...(input.hostConfiguration ?? createDefaultHostExtraCfg()),
  };
  const keyBindingOverrides = input.keyBindingOverrides ?? {};
  const keyBindings: PersistedKeyBinding[] = [];

  for (const name of DEFAULT_CFG_KEY_BINDING_NAMES) {
    const value = keyBindingOverrides[name] ?? defaultConfiguration[name];
    assertValidScanCode(name, value);
    defaultConfiguration[name] = value;
    keyBindings.push(Object.freeze({ name, namespace: 'default.cfg', value }));
  }

  for (const name of HOST_CFG_KEY_BINDING_NAMES) {
    const value = keyBindingOverrides[name] ?? hostConfiguration[name];
    assertValidScanCode(name, value);
    hostConfiguration[name] = value;
    keyBindings.push(Object.freeze({ name, namespace: 'chocolate-doom.cfg', value }));
  }

  const frozenDefaultConfiguration: VanillaDefaultCfg = Object.freeze(defaultConfiguration);
  const frozenHostConfiguration: VanillaExtendedCfg = Object.freeze(hostConfiguration);
  const frozenKeyBindings = Object.freeze(keyBindings);
  const serializedKeyBindingState = serializeKeyBindings(frozenKeyBindings);

  return Object.freeze({
    defaultConfiguration: frozenDefaultConfiguration,
    hostConfiguration: frozenHostConfiguration,
    keyBindings: frozenKeyBindings,
    replayEvidence: Object.freeze({
      auditStepId: PERSIST_KEY_BINDINGS_AUDIT_STEP_ID,
      auditSurface: PERSIST_KEY_BINDINGS_AUDIT_SURFACE,
      checksum: checksumSerializedState(serializedKeyBindingState),
      command: PERSIST_KEY_BINDINGS_COMMAND,
      defaultCfgBindingCount: DEFAULT_CFG_KEY_BINDING_NAMES.length,
      hostCfgBindingCount: HOST_CFG_KEY_BINDING_NAMES.length,
      serializedKeyBindingState,
      transition: 'key-bindings-persisted',
    }),
  });
}
