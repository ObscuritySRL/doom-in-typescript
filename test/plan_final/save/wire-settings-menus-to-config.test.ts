import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  HOST_EXTRA_CFG_VARIABLE_COUNT,
  VANILLA_CHAT_MACRO_COUNT,
  VANILLA_CHAT_MACRO_NAMES,
  VANILLA_DETAIL_HIGH,
  VANILLA_DETAIL_LOW,
  VANILLA_GAMMA_LEVEL_COUNT,
  VANILLA_GAMMA_MAX,
  VANILLA_GAMMA_MIN,
  VANILLA_KEY_BINDING_NAMES,
  VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH,
  VANILLA_MOUSE_SETTING_NAMES,
  VANILLA_SCREENBLOCKS_MAX,
  VANILLA_SCREENBLOCKS_MIN,
  VANILLA_SETTINGS_CONFIG_INVARIANTS,
  VANILLA_SOUND_DEVICE_AWE32,
  VANILLA_SOUND_DEVICE_NONE,
  VANILLA_SOUND_VOLUME_MAX,
  VANILLA_SOUND_VOLUME_MIN,
  createDefaultHostExtraCfg,
  createDefaultVanillaChatMacros,
  createDefaultVanillaKeyBindings,
  createDefaultVanillaMouseSettings,
  createDefaultVanillaScreenSettings,
  createDefaultVanillaSoundSettings,
  serializeVanillaChatMacros,
  serializeVanillaKeyBindings,
  serializeVanillaMouseSettings,
  serializeVanillaScreenSettings,
  serializeVanillaSoundSettings,
} from '../../../src/vanilla/wireSettingsMenusToConfig.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSettingsMenusToConfig.ts');

describe('plan_final save: wire-settings-menus-to-config', () => {
  test('src/vanilla/wireSettingsMenusToConfig.ts exists, is a regular file, and cites plan_final step 12-002', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-002');
    expect(fileText).toContain('VANILLA_SETTINGS_CONFIG_INVARIANTS');
  });

  test('the facade re-exports only from the read-only config modules and menus.ts', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual([
      '../config/hostConfig.ts',
      '../config/persist-chat-macros.ts',
      '../config/persist-mouse-settings.ts',
      '../config/persist-screen-settings.ts',
      '../config/persist-sound-settings.ts',
      '../config/persist-vanilla-key-bindings.ts',
      '../ui/menus.ts',
    ]);
  });

  test('VANILLA_SETTINGS_CONFIG_INVARIANTS pins the six parity rules and is frozen', () => {
    expect(VANILLA_SETTINGS_CONFIG_INVARIANTS.length).toBe(6);
    expect(Object.isFrozen(VANILLA_SETTINGS_CONFIG_INVARIANTS)).toBe(true);
    const ids = VANILLA_SETTINGS_CONFIG_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'CHAT_MACROS_ARE_TEN_SLOTS_0_THROUGH_9',
      'COMPATIBILITY_SETTINGS_LIVE_IN_THE_EXTENDED_HOST_CFG',
      'KEY_BINDINGS_PERSIST_DOS_SCANCODES',
      'MOUSE_SETTINGS_MAP_TO_FIVE_VANILLA_MOUSE_VARIABLES',
      'SCREEN_SETTINGS_INCLUDE_MESSAGES_BLOCKS_DETAIL_GAMMA',
      'SOUND_SETTINGS_CLAMP_VOLUMES_0_15_WITH_DEVICE_IDS',
    ]);
    for (const invariant of VANILLA_SETTINGS_CONFIG_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the vanilla settings constants match the reference', () => {
    expect(VANILLA_SOUND_VOLUME_MIN).toBe(0);
    expect(VANILLA_SOUND_VOLUME_MAX).toBe(15);
    expect(VANILLA_SOUND_DEVICE_NONE).toBe(0);
    expect(VANILLA_SOUND_DEVICE_AWE32).toBe(9);
    expect(VANILLA_SCREENBLOCKS_MIN).toBe(3);
    expect(VANILLA_SCREENBLOCKS_MAX).toBe(11);
    expect(VANILLA_DETAIL_HIGH).toBe(0);
    expect(VANILLA_DETAIL_LOW).toBe(1);
    expect(VANILLA_GAMMA_MIN).toBe(0);
    expect(VANILLA_GAMMA_MAX).toBe(4);
    expect(VANILLA_GAMMA_LEVEL_COUNT).toBe(5);
    expect(VANILLA_MOUSE_SETTING_NAMES.length).toBe(5);
    expect(VANILLA_KEY_BINDING_NAMES.length).toBe(10);
    expect(VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH).toBe(30);
    expect(VANILLA_CHAT_MACRO_COUNT).toBe(10);
    expect([...VANILLA_CHAT_MACRO_NAMES]).toEqual(['chatmacro0', 'chatmacro1', 'chatmacro2', 'chatmacro3', 'chatmacro4', 'chatmacro5', 'chatmacro6', 'chatmacro7', 'chatmacro8', 'chatmacro9']);
    expect(HOST_EXTRA_CFG_VARIABLE_COUNT).toBe(113);
  });

  test('each settings category create+serialize round-trips into a non-empty config string', () => {
    expect(serializeVanillaSoundSettings(createDefaultVanillaSoundSettings()).length).toBeGreaterThan(0);
    expect(serializeVanillaScreenSettings(createDefaultVanillaScreenSettings()).length).toBeGreaterThan(0);
    expect(serializeVanillaMouseSettings(createDefaultVanillaMouseSettings()).length).toBeGreaterThan(0);
    expect(serializeVanillaKeyBindings(createDefaultVanillaKeyBindings()).length).toBeGreaterThan(0);
    expect(serializeVanillaChatMacros(createDefaultVanillaChatMacros()).length).toBeGreaterThan(0);
    expect(typeof createDefaultHostExtraCfg()).toBe('object');
  });

  test('serialized screen settings carry the messages toggle and gamma variables', () => {
    const screen = serializeVanillaScreenSettings(createDefaultVanillaScreenSettings());
    expect(screen).toContain('show_messages');
    expect(screen).toContain('usegamma');
    expect(screen).toContain('screenblocks');
    expect(screen).toContain('detaillevel');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const soundSource = await import('../../../src/config/persist-sound-settings.ts');
    const screenSource = await import('../../../src/config/persist-screen-settings.ts');
    const hostSource = await import('../../../src/config/hostConfig.ts');
    expect(serializeVanillaSoundSettings).toBe(soundSource.serializeVanillaSoundSettings);
    expect(createDefaultVanillaScreenSettings).toBe(screenSource.createDefaultVanillaScreenSettings);
    expect(createDefaultHostExtraCfg).toBe(hostSource.createDefaultHostExtraCfg);
    expect(VANILLA_SOUND_VOLUME_MAX).toBe(soundSource.VANILLA_SOUND_VOLUME_MAX);
  });
});
