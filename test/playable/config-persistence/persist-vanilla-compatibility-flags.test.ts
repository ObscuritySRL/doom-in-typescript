import { expect, test } from 'bun:test';

import { createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import {
  CONFIG_PERSISTENCE_AUDIT_LINK,
  PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT,
  VANILLA_COMPATIBILITY_FLAG_NAMES,
  persistVanillaCompatibilityFlags,
} from '../../../src/playable/config-persistence/persistVanillaCompatibilityFlags.ts';

const EXPECTED_CUSTOM_AFTER_HASH = '0d597b88100e42eefd57db88466fa8be18ded76aa0fe279d6c25d5a4288ddfd7';
const EXPECTED_CUSTOM_BEFORE_HASH = '2db6ee31aa96c4e7364ba03a5c00372ba9be7447f5b41c4050e309e26e3f6fd9';
const EXPECTED_CUSTOM_REPLAY_CHECKSUM = 746_307_453;
const EXPECTED_CUSTOM_REPLAY_MATERIAL_HASH = 'fb3ec9481c30d9b2db0678dd26203a8b27374b18ffb3533cdde8840f539a01c8';
const EXPECTED_CUSTOM_TRANSITION = 'vanilla_savegame_limit=0|vanilla_demo_limit=1|vanilla_keyboard_mapping=0 -> vanilla_savegame_limit=1|vanilla_demo_limit=0|vanilla_keyboard_mapping=1';
const EXPECTED_DEFAULT_HASH = 'ee75d83843bbec10ba0544d21555e835dfe92c91c6b5a7155b23bb412150a5c5';
const EXPECTED_DEFAULT_REPLAY_CHECKSUM = 938_433_384;
const EXPECTED_DEFAULT_REPLAY_MATERIAL_HASH = 'ef49bd7f32b2c9fc2fe0d937825794eae9a4d9d7545ea2ddfeee9903aadf91a7';
const EXPECTED_DEFAULT_SERIALIZED_STATE = 'vanilla_savegame_limit=1\nvanilla_demo_limit=1\nvanilla_keyboard_mapping=1';
const EXPECTED_DEFAULT_TRANSITION = 'vanilla_savegame_limit=1|vanilla_demo_limit=1|vanilla_keyboard_mapping=1 -> vanilla_savegame_limit=1|vanilla_demo_limit=1|vanilla_keyboard_mapping=1';
const EXPECTED_SOURCE_SHA256 = '9ab1421782529844efd366033dfdbdb55e0622f15a26e1f2dc356cb00390833b';

function sha256Hex(content: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return hasher.digest('hex');
}

test('locks the Bun command contract and missing config persistence audit link', async () => {
  expect(PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT).toEqual({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    targetCommand: 'bun run doom.ts',
  });
  expect(CONFIG_PERSISTENCE_AUDIT_LINK).toEqual({
    manifestPath: 'plan_fps/manifests/01-014-audit-missing-config-persistence.json',
    missingSurface: 'vanillaCompatibilityFlags',
    stepId: '01-014',
  });
  expect(VANILLA_COMPATIBILITY_FLAG_NAMES).toEqual(['vanilla_savegame_limit', 'vanilla_demo_limit', 'vanilla_keyboard_mapping']);

  const auditManifest = await Bun.file(CONFIG_PERSISTENCE_AUDIT_LINK.manifestPath).text();
  expect(auditManifest).toContain('"schemaVersion": 1');
  expect(auditManifest).toContain('"surface": "vanillaCompatibilityFlags"');
  expect(auditManifest).toContain('"targetCommand": "bun run doom.ts"');
});

test('locks the formatted implementation hash', async () => {
  const source = await Bun.file('src/playable/config-persistence/persistVanillaCompatibilityFlags.ts').text();

  expect(sha256Hex(source)).toBe(EXPECTED_SOURCE_SHA256);
});

test('persists default vanilla compatibility flags deterministically', () => {
  const result = persistVanillaCompatibilityFlags();

  expect(result.afterFlags).toEqual({
    vanilla_demo_limit: 1,
    vanilla_keyboard_mapping: 1,
    vanilla_savegame_limit: 1,
  });
  expect(result.afterHash).toBe(EXPECTED_DEFAULT_HASH);
  expect(result.afterSerializedState).toBe(EXPECTED_DEFAULT_SERIALIZED_STATE);
  expect(result.beforeFlags).toEqual(result.afterFlags);
  expect(result.beforeHash).toBe(EXPECTED_DEFAULT_HASH);
  expect(result.beforeSerializedState).toBe(EXPECTED_DEFAULT_SERIALIZED_STATE);
  expect(result.commandContract).toEqual(PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT);
  expect(result.defaultConfigUnchanged).toBe(true);
  expect(result.persistedHostConfig.vanilla_demo_limit).toBe(1);
  expect(result.persistedHostConfig.vanilla_keyboard_mapping).toBe(1);
  expect(result.persistedHostConfig.vanilla_savegame_limit).toBe(1);
  expect(result.replayChecksum).toBe(EXPECTED_DEFAULT_REPLAY_CHECKSUM);
  expect(result.replayMaterialHash).toBe(EXPECTED_DEFAULT_REPLAY_MATERIAL_HASH);
  expect(result.transitionSignature).toBe(EXPECTED_DEFAULT_TRANSITION);
});

test('applies custom vanilla compatibility flag transitions without touching other host settings', () => {
  const hostConfig = Object.freeze({
    ...createDefaultHostExtraCfg(),
    fullscreen: 0,
    vanilla_demo_limit: 1,
    vanilla_keyboard_mapping: 0,
    vanilla_savegame_limit: 0,
  });
  const result = persistVanillaCompatibilityFlags({
    flags: {
      vanilla_demo_limit: false,
      vanilla_keyboard_mapping: true,
      vanilla_savegame_limit: true,
    },
    hostConfig,
  });

  expect(result.afterFlags).toEqual({
    vanilla_demo_limit: 0,
    vanilla_keyboard_mapping: 1,
    vanilla_savegame_limit: 1,
  });
  expect(result.afterHash).toBe(EXPECTED_CUSTOM_AFTER_HASH);
  expect(result.afterSerializedState).toBe('vanilla_savegame_limit=1\nvanilla_demo_limit=0\nvanilla_keyboard_mapping=1');
  expect(result.beforeFlags).toEqual({
    vanilla_demo_limit: 1,
    vanilla_keyboard_mapping: 0,
    vanilla_savegame_limit: 0,
  });
  expect(result.beforeHash).toBe(EXPECTED_CUSTOM_BEFORE_HASH);
  expect(result.beforeSerializedState).toBe('vanilla_savegame_limit=0\nvanilla_demo_limit=1\nvanilla_keyboard_mapping=0');
  expect(result.persistedHostConfig.fullscreen).toBe(0);
  expect(result.persistedHostConfig.vanilla_demo_limit).toBe(0);
  expect(result.persistedHostConfig.vanilla_keyboard_mapping).toBe(1);
  expect(result.persistedHostConfig.vanilla_savegame_limit).toBe(1);
  expect(result.replayChecksum).toBe(EXPECTED_CUSTOM_REPLAY_CHECKSUM);
  expect(result.replayMaterialHash).toBe(EXPECTED_CUSTOM_REPLAY_MATERIAL_HASH);
  expect(result.transitionSignature).toBe(EXPECTED_CUSTOM_TRANSITION);
});

test('prevalidates the product command contract before compatibility changes', () => {
  expect(() =>
    persistVanillaCompatibilityFlags({
      commandContract: {
        ...PERSIST_VANILLA_COMPATIBILITY_FLAGS_COMMAND_CONTRACT,
        targetCommand: 'bun run src/main.ts',
      },
      flags: {
        vanilla_savegame_limit: 0,
      },
    }),
  ).toThrow('persist vanilla compatibility flags requires command contract bun run doom.ts');
});

test('rejects invalid vanilla compatibility flag values', () => {
  expect(() =>
    persistVanillaCompatibilityFlags({
      flags: {
        vanilla_demo_limit: 2,
      },
    }),
  ).toThrow('invalid vanilla_demo_limit: expected boolean, 0, or 1');
});
