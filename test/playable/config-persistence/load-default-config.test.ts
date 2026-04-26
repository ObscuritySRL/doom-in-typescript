import { afterAll, describe, expect, test } from 'bun:test';

import { mkdir as createDirectory, rm as removeFileTree } from 'node:fs/promises';

import { LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT, loadDefaultConfig } from '../../../src/playable/config-persistence/loadDefaultConfig.ts';

const DEFAULT_REPLAY_CHECKSUM = 1_517_864_489;
const DEFAULT_REPLAY_HASH = 'd297b0aa7695d2eae9ff37270c371e1b439e08b9a6f6b3973ec0f93a49afe258';
const LOADED_REPLAY_CHECKSUM = 2_965_749_322;
const LOADED_REPLAY_HASH = '7de4eb69e2d7eb5c34ddce93147f0c49ddb8a32b8964e9ec0dfb5564323230ac';
const MISSING_REPLAY_CHECKSUM = 329_318_743;
const MISSING_REPLAY_HASH = '634764f7eb5702ffa91b751c720cea152ab3917abd50e1180ce539744d290361';
const PRODUCT_SOURCE_SHA256 = 'ebe00386faf7ed528feea07b43d4aa33d31193880821b5fc5771f6cb30543f1b';

const temporaryDirectories: string[] = [];

interface AuditMissingConfigPersistenceManifest {
  readonly explicitNullSurfaces: readonly {
    readonly surface: string;
  }[];
  readonly schemaVersion: number;
  readonly targetCommandContract: {
    readonly entryFile: string;
    readonly targetCommand: string;
  };
}

async function createConfigFixtureDirectory(): Promise<{
  readonly defaultConfigPath: string;
  readonly hostConfigPath: string;
}> {
  const temporaryRoot = Bun.env.TEMP ?? '.';
  const temporaryDirectory = `${temporaryRoot}/doom-in-typescript-load-default-config-${Date.now()}`;
  temporaryDirectories.push(temporaryDirectory);
  await createDirectory(temporaryDirectory, { recursive: true });

  const defaultConfigPath = `${temporaryDirectory}/default.cfg`;
  const hostConfigPath = `${temporaryDirectory}/chocolate-doom.cfg`;

  await Bun.write(defaultConfigPath, ['mouse_sensitivity 9', 'sfx_volume 3', 'music_volume 4', 'key_fire 30', 'chatmacro1 "Loaded default config"', 'unknown_default_config 400', ''].join('\n'));
  await Bun.write(hostConfigPath, ['fullscreen 0', 'screen_width 640', 'screen_height 480', 'snd_samplerate 22050', 'vanilla_keyboard_mapping 0', 'key_menu_activate 2', 'unknown_host_config 400', ''].join('\n'));

  return {
    defaultConfigPath,
    hostConfigPath,
  };
}

function createSha256(content: string): string {
  return new Bun.CryptoHasher('sha256').update(content).digest('hex');
}

describe('loadDefaultConfig', () => {
  afterAll(async () => {
    for (const temporaryDirectory of temporaryDirectories) {
      await removeFileTree(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('locks the Bun command contract and config audit linkage', async () => {
    expect(LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
    });

    const auditManifest: AuditMissingConfigPersistenceManifest = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').json();
    const explicitNullSurfaceNames = auditManifest.explicitNullSurfaces.map((explicitNullSurface) => explicitNullSurface.surface);

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.targetCommandContract.entryFile).toBe('doom.ts');
    expect(auditManifest.targetCommandContract.targetCommand).toBe(LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command);
    expect(explicitNullSurfaceNames).toContain('configFileRead');
    expect(explicitNullSurfaceNames).toContain('defaultCfgCompatibility');
  });

  test('locks the formatted product source hash', async () => {
    const sourceContent = await Bun.file('src/playable/config-persistence/loadDefaultConfig.ts').text();

    expect(createSha256(sourceContent)).toBe(PRODUCT_SOURCE_SHA256);
  });

  test('loads hardcoded parser defaults when no config paths are provided', async () => {
    const loadedConfig = await loadDefaultConfig({
      command: LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command,
    });

    expect(loadedConfig.defaultConfig.mouse_sensitivity).toBe(5);
    expect(loadedConfig.defaultConfig.sfx_volume).toBe(8);
    expect(loadedConfig.hostConfig.fullscreen).toBe(1);
    expect(loadedConfig.hostConfig.snd_samplerate).toBe(44_100);
    expect(loadedConfig.sourceSummary).toEqual({
      defaultConfig: {
        path: null,
        state: 'hardcoded-defaults',
        variableCount: 43,
      },
      hostConfig: {
        path: null,
        state: 'hardcoded-defaults',
        variableCount: 113,
      },
    });
    expect(loadedConfig.transition).toEqual({
      auditStepId: '01-014',
      bunFileReadCount: 0,
      command: LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command,
      defaultConfigVariableCount: 43,
      deterministicReplayCompatible: true,
      hostConfigVariableCount: 113,
      replayChecksum: DEFAULT_REPLAY_CHECKSUM,
      replayHash: DEFAULT_REPLAY_HASH,
    });
  });

  test('loads present config files through Bun file reads', async () => {
    const { defaultConfigPath, hostConfigPath } = await createConfigFixtureDirectory();

    const loadedConfig = await loadDefaultConfig({
      command: LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command,
      defaultConfigPath,
      hostConfigPath,
    });

    expect(loadedConfig.defaultConfig.mouse_sensitivity).toBe(9);
    expect(loadedConfig.defaultConfig.sfx_volume).toBe(3);
    expect(loadedConfig.defaultConfig.music_volume).toBe(4);
    expect(loadedConfig.defaultConfig.key_fire).toBe(30);
    expect(loadedConfig.defaultConfig.chatmacro1).toBe('Loaded default config');
    expect(loadedConfig.hostConfig.fullscreen).toBe(0);
    expect(loadedConfig.hostConfig.screen_width).toBe(640);
    expect(loadedConfig.hostConfig.screen_height).toBe(480);
    expect(loadedConfig.hostConfig.snd_samplerate).toBe(22_050);
    expect(loadedConfig.hostConfig.vanilla_keyboard_mapping).toBe(0);
    expect(loadedConfig.hostConfig.key_menu_activate).toBe(2);
    expect(loadedConfig.sourceSummary).toEqual({
      defaultConfig: {
        path: defaultConfigPath,
        state: 'loaded-file',
        variableCount: 43,
      },
      hostConfig: {
        path: hostConfigPath,
        state: 'loaded-file',
        variableCount: 113,
      },
    });
    expect(loadedConfig.transition.replayChecksum).toBe(LOADED_REPLAY_CHECKSUM);
    expect(loadedConfig.transition.replayHash).toBe(LOADED_REPLAY_HASH);
    expect(loadedConfig.transition.bunFileReadCount).toBe(2);
  });

  test('falls back to defaults when configured paths are absent', async () => {
    const temporaryRoot = Bun.env.TEMP ?? '.';
    const loadedConfig = await loadDefaultConfig({
      command: LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command,
      defaultConfigPath: `${temporaryRoot}/missing-default-config-for-load-default-config.cfg`,
      hostConfigPath: `${temporaryRoot}/missing-host-config-for-load-default-config.cfg`,
    });

    expect(loadedConfig.defaultConfig.mouse_sensitivity).toBe(5);
    expect(loadedConfig.hostConfig.fullscreen).toBe(1);
    expect(loadedConfig.sourceSummary.defaultConfig.state).toBe('missing-file-defaults');
    expect(loadedConfig.sourceSummary.hostConfig.state).toBe('missing-file-defaults');
    expect(loadedConfig.transition.bunFileReadCount).toBe(0);
    expect(loadedConfig.transition.replayChecksum).toBe(MISSING_REPLAY_CHECKSUM);
    expect(loadedConfig.transition.replayHash).toBe(MISSING_REPLAY_HASH);
  });

  test('rejects non-product commands and invalid paths before loading config', async () => {
    await expect(
      loadDefaultConfig({
        command: 'bun run src/main.ts',
        defaultConfigPath: 'default.cfg',
      }),
    ).rejects.toThrow('load default config requires bun run doom.ts');

    await expect(
      loadDefaultConfig({
        command: LOAD_DEFAULT_CONFIG_COMMAND_CONTRACT.command,
        hostConfigPath: '   ',
      }),
    ).rejects.toThrow('chocolate-doom.cfg path must not be empty');
  });
});
