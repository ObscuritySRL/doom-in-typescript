import { afterEach, describe, expect, test } from 'bun:test';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { VanillaDefaultCfg } from '../../../src/config/defaultCfg.ts';
import { createDefaultVanillaCfg } from '../../../src/config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../../src/config/hostConfig.ts';
import { createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import { WRITE_CONFIG_BACK_COMMAND_CONTRACT, writeConfigBack } from '../../../src/playable/config-persistence/writeConfigBack.ts';

const SOURCE_PATH = 'src/playable/config-persistence/writeConfigBack.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const temporaryDirectory of temporaryDirectories.splice(0)) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

describe('write config back', () => {
  test('locks the product command contract and audit linkage', async () => {
    const auditManifestText = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').text();

    expect(WRITE_CONFIG_BACK_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(auditManifestText).toContain('"surface": "configFileWrite"');
    expect(auditManifestText).toContain('"targetCommand": "bun run doom.ts"');
  });

  test('writes deterministic default and host config files with Bun', async () => {
    const temporaryDirectory = await createTemporaryDirectory();
    const defaultCfgPath = join(temporaryDirectory, 'default.cfg');
    const hostExtraCfgPath = join(temporaryDirectory, 'chocolate-doom.cfg');
    const defaultCfg = {
      ...createDefaultVanillaCfg(),
      chatmacro0: 'Config saved',
      mouse_sensitivity: 7,
      screenblocks: 10,
    } satisfies VanillaDefaultCfg;
    const hostExtraCfg = {
      ...createDefaultHostExtraCfg(),
      fullscreen: 0,
      mouse_acceleration: 2.5,
      opl_io_port: 0x388,
      player_name: 'stevp',
      screen_height: 400,
      screen_width: 640,
      vanilla_keyboard_mapping: 1,
    } satisfies VanillaExtendedCfg;

    const result = await writeConfigBack({
      defaultCfg,
      defaultCfgPath,
      hostExtraCfg,
      hostExtraCfgPath,
    });

    expect(await sourceSha256()).toBe('cf1cccca005bb6dd124cd0014aefbe393385889b97d7d252cca9434c3e28a708');
    expect(result).toEqual({
      commandContract: WRITE_CONFIG_BACK_COMMAND_CONTRACT,
      defaultCfgBytesWritten: 737,
      defaultCfgHash: '9df3ba4e52333fada1e1bc7c8d071b719561cb1b2dba978725322817e1333e8b',
      defaultCfgPath,
      hostExtraCfgBytesWritten: 2197,
      hostExtraCfgHash: '71fa0823f2359a8b8fc4d8497ac8885a9d6bb4675e951cf66f2560a191427faf',
      hostExtraCfgPath,
      replayChecksum: 574854910,
      transition: 'config-writeback-complete',
    });
    expect(await Bun.file(defaultCfgPath).text()).toContain('mouse_sensitivity 7\n');
    expect(await Bun.file(defaultCfgPath).text()).toContain('chatmacro0 "Config saved"\n');
    expect(await Bun.file(hostExtraCfgPath).text()).toContain('fullscreen 0\n');
    expect(await Bun.file(hostExtraCfgPath).text()).toContain('mouse_acceleration 2.500000\n');
    expect(await Bun.file(hostExtraCfgPath).text()).toContain('opl_io_port 0x388\n');
    expect(await Bun.file(hostExtraCfgPath).text()).toContain('player_name "stevp"\n');
  });

  test('prevalidates the product command before touching paths', async () => {
    const temporaryDirectory = await createTemporaryDirectory();
    const defaultCfgPath = join(temporaryDirectory, 'default.cfg');
    const hostExtraCfgPath = join(temporaryDirectory, 'chocolate-doom.cfg');

    await expect(
      writeConfigBack({
        defaultCfgPath,
        hostExtraCfgPath,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).rejects.toThrow('write config back requires bun run doom.ts');
    expect(await Bun.file(defaultCfgPath).exists()).toBe(false);
    expect(await Bun.file(hostExtraCfgPath).exists()).toBe(false);
  });

  test('rejects read-only reference roots before writing', async () => {
    const temporaryDirectory = await createTemporaryDirectory();
    const hostExtraCfgPath = join(temporaryDirectory, 'chocolate-doom.cfg');

    await expect(
      writeConfigBack({
        defaultCfgPath: 'doom/default.cfg',
        hostExtraCfgPath,
      }),
    ).rejects.toThrow('defaultCfgPath must not target read-only reference root doom');
    expect(await Bun.file(hostExtraCfgPath).exists()).toBe(false);
  });

  test('rejects ambiguous string values before writing', async () => {
    const temporaryDirectory = await createTemporaryDirectory();
    const defaultCfgPath = join(temporaryDirectory, 'default.cfg');
    const hostExtraCfgPath = join(temporaryDirectory, 'chocolate-doom.cfg');
    const defaultCfg = {
      ...createDefaultVanillaCfg(),
      chatmacro0: 'saved\nagain',
    } satisfies VanillaDefaultCfg;

    await expect(
      writeConfigBack({
        defaultCfg,
        defaultCfgPath,
        hostExtraCfgPath,
      }),
    ).rejects.toThrow('config string chatmacro0 cannot contain a line break');
    expect(await Bun.file(defaultCfgPath).exists()).toBe(false);
    expect(await Bun.file(hostExtraCfgPath).exists()).toBe(false);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-config-write-'));
  temporaryDirectories.push(temporaryDirectory);
  return temporaryDirectory;
}

async function sourceSha256(): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(SOURCE_PATH).text());
  return hasher.digest('hex');
}
