import { describe, expect, test } from 'bun:test';

import type { VanillaDefaultCfg } from '../../../src/config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../../src/config/hostConfig.ts';
import { createDefaultVanillaCfg } from '../../../src/config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import {
  CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH,
  CONFIG_PERSISTENCE_AUDIT_SCHEMA_VERSION,
  CONFIG_PERSISTENCE_AUDIT_STEP_ID,
  PRODUCT_COMMAND_CONTRACT,
  VANILLA_SAVE_SLOT_COUNT,
  defineSaveAndWindowPathPolicies,
} from '../../../src/playable/config-persistence/defineSaveAndWindowPathPolicies.ts';

const SOURCE_PATH = 'src/playable/config-persistence/defineSaveAndWindowPathPolicies.ts';
const TRANSITION = 'missing-config-path-policy-to-deterministic-save-window-path-policy';

describe('defineSaveAndWindowPathPolicies', () => {
  test('locks the Bun runtime command and 01-014 audit manifest contract', async () => {
    const manifest = await Bun.file(CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH).json();

    expect(PRODUCT_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
      targetCommand: 'bun run doom.ts',
    });
    expect(CONFIG_PERSISTENCE_AUDIT_SCHEMA_VERSION).toBe(1);
    expect(CONFIG_PERSISTENCE_AUDIT_STEP_ID).toBe('01-014');
    expect(manifest.schemaVersion).toBe(CONFIG_PERSISTENCE_AUDIT_SCHEMA_VERSION);
    expect(manifest.stepId).toBe(CONFIG_PERSISTENCE_AUDIT_STEP_ID);
    expect(manifest.targetCommandContract).toEqual(PRODUCT_COMMAND_CONTRACT);
  });

  test('locks the formatted source hash', async () => {
    const source = await Bun.file(SOURCE_PATH).text();

    expect(sha256Hex(source)).toBe('3b005b4bb2d30d562fd303faf9accc7dc306db1677424624336c9daedf399963');
  });

  test('defines deterministic default save and window path policies', () => {
    const result = defineSaveAndWindowPathPolicies();

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.auditManifestPath).toBe(CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH);
    expect(result.commandContract).toBe(PRODUCT_COMMAND_CONTRACT);
    expect(result.configNamespaces).toEqual([
      {
        fileName: 'chocolate-doom.cfg',
        namespace: 'host-extended',
        variableCount: 113,
      },
      {
        fileName: 'default.cfg',
        namespace: 'vanilla-default',
        variableCount: 43,
      },
    ]);
    expect(result.savePaths).toEqual([
      {
        fileName: 'doomsav0.dsg',
        slot: 0,
        workspaceRelativePath: 'doomsav0.dsg',
      },
      {
        fileName: 'doomsav1.dsg',
        slot: 1,
        workspaceRelativePath: 'doomsav1.dsg',
      },
      {
        fileName: 'doomsav2.dsg',
        slot: 2,
        workspaceRelativePath: 'doomsav2.dsg',
      },
      {
        fileName: 'doomsav3.dsg',
        slot: 3,
        workspaceRelativePath: 'doomsav3.dsg',
      },
      {
        fileName: 'doomsav4.dsg',
        slot: 4,
        workspaceRelativePath: 'doomsav4.dsg',
      },
      {
        fileName: 'doomsav5.dsg',
        slot: 5,
        workspaceRelativePath: 'doomsav5.dsg',
      },
    ]);
    expect(result.savePaths).toHaveLength(VANILLA_SAVE_SLOT_COUNT);
    expect(result.serializedPolicy).toContain('"saveMessagesEnabled":true');
    expect(result.transition).toBe(TRANSITION);
    expect(result.windowPolicy).toEqual({
      aspectRatioCorrect: 1,
      configuredFullscreen: 1,
      configuredWindowPosition: 'centered',
      productPresentation: 'windowed-only',
      screenHeight: 480,
      screenWidth: 640,
      windowConfigPath: 'chocolate-doom.cfg',
    });
    expect(result.policyHash).toBe('dadfce9ecc089e4e1cef789e93736a2dd6ff2e3abab2b54458f198342bd49ec0');
    expect(result.replayChecksum).toBe(2_978_728_848);
  });

  test('normalizes custom workspace-relative save and window paths', () => {
    const hostConfig = {
      ...createDefaultHostExtraCfg(),
      aspect_ratio_correct: 0,
      fullscreen: 0,
      screen_height: 720,
      screen_width: 960,
      window_position: '  12,34  ',
    } satisfies VanillaExtendedCfg;
    const vanillaConfig = {
      ...createDefaultVanillaCfg(),
      show_messages: 0,
    } satisfies VanillaDefaultCfg;
    const result = defineSaveAndWindowPathPolicies({
      hostConfig,
      saveRoot: '.\\saves\\profile-a',
      vanillaConfig,
      windowConfigPath: 'profiles\\profile-a\\chocolate-doom.cfg',
    });

    expect(result.savePaths[0]).toEqual({
      fileName: 'doomsav0.dsg',
      slot: 0,
      workspaceRelativePath: 'saves/profile-a/doomsav0.dsg',
    });
    expect(result.savePaths[5]).toEqual({
      fileName: 'doomsav5.dsg',
      slot: 5,
      workspaceRelativePath: 'saves/profile-a/doomsav5.dsg',
    });
    expect(result.serializedPolicy).toContain('"saveMessagesEnabled":false');
    expect(result.windowPolicy).toEqual({
      aspectRatioCorrect: 0,
      configuredFullscreen: 0,
      configuredWindowPosition: '12,34',
      productPresentation: 'windowed-only',
      screenHeight: 720,
      screenWidth: 960,
      windowConfigPath: 'profiles/profile-a/chocolate-doom.cfg',
    });
    expect(result.policyHash).toBe('9ac9d13ea3ee4e425c7a1b79d39564bcd287faaada9b350b1d4dc4543e2ed8e0');
    expect(result.replayChecksum).toBe(3_834_865_986);
  });

  test('validates the product command before path handling', () => {
    expect(() =>
      defineSaveAndWindowPathPolicies({
        command: 'bun run src/main.ts',
        saveRoot: '..\\escape',
      }),
    ).toThrow('define save and window path policies requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects paths and window dimensions that would break deterministic replay', () => {
    const invalidHostConfig = {
      ...createDefaultHostExtraCfg(),
      screen_width: -1,
    } satisfies VanillaExtendedCfg;

    expect(() =>
      defineSaveAndWindowPathPolicies({
        saveRoot: 'doom\\saves',
      }),
    ).toThrow('save root path must not target read-only reference root doom');
    expect(() =>
      defineSaveAndWindowPathPolicies({
        windowConfigPath: 'C:\\Users\\stevp\\chocolate-doom.cfg',
      }),
    ).toThrow('window config path must be workspace-relative');
    expect(() =>
      defineSaveAndWindowPathPolicies({
        hostConfig: invalidHostConfig,
      }),
    ).toThrow('screen width must be a non-negative integer');
  });
});

function sha256Hex(content: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return hasher.digest('hex');
}
