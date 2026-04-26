import { describe, expect, test } from 'bun:test';

import type { VanillaDefaultCfg } from '../../../src/config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../../src/config/hostConfig.ts';
import type { SoundSettingsOverrides } from '../../../src/playable/config-persistence/persistSoundSettings.ts';
import { createDefaultVanillaCfg } from '../../../src/config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import { CONFIG_PERSISTENCE_AUDIT_STEP_ID, PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT, SOUND_SETTINGS_PERSISTENCE_SURFACE, persistSoundSettings } from '../../../src/playable/config-persistence/persistSoundSettings.ts';

const CUSTOM_SOUND_SETTINGS: SoundSettingsOverrides = Object.freeze({
  cacheSizeBytes: 33_554_432,
  digitalMusicOption: '-opl3',
  gravisUltraSoundPatchPath: 'C:\\DOOM\\PATCHES',
  gravisUltraSoundRamKilobytes: 2_048,
  libsamplerateScale: 0.75,
  maximumSliceTimeMilliseconds: 24,
  musicCommand: 'timidity -A120',
  musicDevice: 5,
  musicPort: 0x330,
  musicVolume: 5,
  oplInputOutputPort: 0x389,
  sampleRate: 48_000,
  sampleRateConversionEnabled: true,
  soundBlasterDirectMemoryAccess: 3,
  soundBlasterInterruptRequest: 7,
  soundBlasterPort: 0x220,
  soundChannels: 16,
  soundEffectDevice: 5,
  soundEffectVolume: 12,
  timidityConfigPath: 'C:\\DOOM\\timidity.cfg',
});

const CUSTOM_HOST_SIGNATURE =
  'snd_samplerate=48000;snd_cachesize=33554432;snd_maxslicetime_ms=24;snd_musiccmd="timidity -A120";snd_dmxoption="-opl3";opl_io_port=905;use_libsamplerate=1;libsamplerate_scale=0.75;timidity_cfg_path="C:\\\\DOOM\\\\timidity.cfg";gus_patch_path="C:\\\\DOOM\\\\PATCHES";gus_ram_kb=2048';
const CUSTOM_VANILLA_SIGNATURE = 'sfx_volume=12;music_volume=5;snd_channels=16;snd_musicdevice=5;snd_sfxdevice=5;snd_sbport=544;snd_sbirq=7;snd_sbdma=3;snd_mport=816';
const DEFAULT_HOST_SIGNATURE =
  'snd_samplerate=44100;snd_cachesize=67108864;snd_maxslicetime_ms=28;snd_musiccmd="";snd_dmxoption="";opl_io_port=904;use_libsamplerate=0;libsamplerate_scale=0.65;timidity_cfg_path="";gus_patch_path="";gus_ram_kb=1024';
const DEFAULT_VANILLA_SIGNATURE = 'sfx_volume=8;music_volume=8;snd_channels=8;snd_musicdevice=3;snd_sfxdevice=3;snd_sbport=0;snd_sbirq=0;snd_sbdma=0;snd_mport=0';

describe('persistSoundSettings', () => {
  test('locks the Bun command contract and 01-014 sound persistence audit linkage', async () => {
    expect(PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
      targetCommand: 'bun run doom.ts',
    });
    expect(CONFIG_PERSISTENCE_AUDIT_STEP_ID).toBe('01-014');
    expect(SOUND_SETTINGS_PERSISTENCE_SURFACE).toBe('soundSettingsPersistence');

    const auditManifestText = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').text();
    expect(auditManifestText).toContain('"stepId": "01-014"');
    expect(auditManifestText).toContain('"surface": "soundSettingsPersistence"');
    expect(auditManifestText).toContain('"visibleConfigPersistenceSurface": null');
  });

  test('locks the formatted source hash', async () => {
    const sourceText = await Bun.file('src/playable/config-persistence/persistSoundSettings.ts').text();

    expect(computeTextSha256(sourceText)).toBe('fede7f0c98e65e980e2ed2e5253148ce81837bd5d16dc9ef9400c33befaba884');
  });

  test('persists default sound settings with deterministic replay evidence', () => {
    const result = persistSoundSettings();

    expect(result.persistedHostFields).toEqual([
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
    ]);
    expect(result.persistedVanillaFields).toEqual(['sfx_volume', 'music_volume', 'snd_channels', 'snd_musicdevice', 'snd_sfxdevice', 'snd_sbport', 'snd_sbirq', 'snd_sbdma', 'snd_mport']);
    expect(result.transition).toEqual({
      changedFieldCount: 0,
      hostSignature: DEFAULT_HOST_SIGNATURE,
      manifestSurface: SOUND_SETTINGS_PERSISTENCE_SURFACE,
      soundPersistenceSurface: 'default.cfg+chocolate-doom.cfg',
      vanillaSignature: DEFAULT_VANILLA_SIGNATURE,
    });
    expect(result.deterministicReplay).toEqual({
      checksum: 3_520_840_356,
      hostHash: '0a87c3ebf08c40f0e4197f6ab5d057f447b87bd80afc12e4c58e5463fe4d39bb',
      signature: `bun run doom.ts|${DEFAULT_VANILLA_SIGNATURE}|${DEFAULT_HOST_SIGNATURE}`,
      vanillaHash: '50b4426cb512e3904c01ca7fd2912be8c5192f5a64b4a9cede8b55c81024e1bd',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.deterministicReplay)).toBe(true);
    expect(Object.isFrozen(result.hostConfig)).toBe(true);
    expect(Object.isFrozen(result.transition)).toBe(true);
    expect(Object.isFrozen(result.vanillaConfig)).toBe(true);
  });

  test('persists custom sound settings across vanilla and host config snapshots', () => {
    const result = persistSoundSettings({ soundSettings: CUSTOM_SOUND_SETTINGS });

    expect(result.vanillaConfig.sfx_volume).toBe(12);
    expect(result.vanillaConfig.music_volume).toBe(5);
    expect(result.vanillaConfig.snd_channels).toBe(16);
    expect(result.vanillaConfig.snd_musicdevice).toBe(5);
    expect(result.vanillaConfig.snd_sfxdevice).toBe(5);
    expect(result.vanillaConfig.snd_sbport).toBe(0x220);
    expect(result.vanillaConfig.snd_sbirq).toBe(7);
    expect(result.vanillaConfig.snd_sbdma).toBe(3);
    expect(result.vanillaConfig.snd_mport).toBe(0x330);
    expect(result.hostConfig.snd_samplerate).toBe(48_000);
    expect(result.hostConfig.snd_cachesize).toBe(33_554_432);
    expect(result.hostConfig.snd_maxslicetime_ms).toBe(24);
    expect(result.hostConfig.snd_musiccmd).toBe('timidity -A120');
    expect(result.hostConfig.snd_dmxoption).toBe('-opl3');
    expect(result.hostConfig.opl_io_port).toBe(0x389);
    expect(result.hostConfig.use_libsamplerate).toBe(1);
    expect(result.hostConfig.libsamplerate_scale).toBe(0.75);
    expect(result.hostConfig.timidity_cfg_path).toBe('C:\\DOOM\\timidity.cfg');
    expect(result.hostConfig.gus_patch_path).toBe('C:\\DOOM\\PATCHES');
    expect(result.hostConfig.gus_ram_kb).toBe(2_048);
    expect(result.transition).toEqual({
      changedFieldCount: 20,
      hostSignature: CUSTOM_HOST_SIGNATURE,
      manifestSurface: SOUND_SETTINGS_PERSISTENCE_SURFACE,
      soundPersistenceSurface: 'default.cfg+chocolate-doom.cfg',
      vanillaSignature: CUSTOM_VANILLA_SIGNATURE,
    });
    expect(result.deterministicReplay).toEqual({
      checksum: 3_582_559_748,
      hostHash: '5080527494c4c41b4753127a6fab490a9948ab1a3544cb9a716506d330bfdfea',
      signature: `bun run doom.ts|${CUSTOM_VANILLA_SIGNATURE}|${CUSTOM_HOST_SIGNATURE}`,
      vanillaHash: 'aadd9b554abf3a987c316c609509eee594fa857b29bd178704dac90fbac67688',
    });
  });

  test('preserves non-sound config values while changing sound values', () => {
    const baseHostConfig: VanillaExtendedCfg = Object.freeze({
      ...createDefaultHostExtraCfg(),
      fullscreen: 0,
      grabmouse: 0,
      key_menu_up: 17,
    });
    const baseVanillaConfig: VanillaDefaultCfg = Object.freeze({
      ...createDefaultVanillaCfg(),
      key_fire: 44,
      screenblocks: 7,
      usegamma: 2,
    });

    const result = persistSoundSettings({
      hostConfig: baseHostConfig,
      soundSettings: {
        musicVolume: 6,
        sampleRate: 22_050,
        soundEffectVolume: 4,
      },
      vanillaConfig: baseVanillaConfig,
    });

    expect(result.hostConfig.fullscreen).toBe(0);
    expect(result.hostConfig.grabmouse).toBe(0);
    expect(result.hostConfig.key_menu_up).toBe(17);
    expect(result.hostConfig.snd_samplerate).toBe(22_050);
    expect(result.vanillaConfig.key_fire).toBe(44);
    expect(result.vanillaConfig.music_volume).toBe(6);
    expect(result.vanillaConfig.screenblocks).toBe(7);
    expect(result.vanillaConfig.sfx_volume).toBe(4);
    expect(result.vanillaConfig.usegamma).toBe(2);
    expect(result.transition.changedFieldCount).toBe(3);
  });

  test('validates the product command before applying settings', () => {
    expect(() =>
      persistSoundSettings({
        command: 'bun run src/main.ts',
        soundSettings: {
          soundEffectVolume: -1,
        },
      }),
    ).toThrow('persist sound settings requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects invalid sound setting values', () => {
    expect(() =>
      persistSoundSettings({
        soundSettings: {
          soundEffectVolume: 16,
        },
      }),
    ).toThrow('soundEffectVolume must be an integer from 0 to 15');
    expect(() =>
      persistSoundSettings({
        soundSettings: {
          sampleRate: 7_999,
        },
      }),
    ).toThrow('sampleRate must be an integer from 8000 to 192000');
    expect(() =>
      persistSoundSettings({
        soundSettings: {
          digitalMusicOption: 'line\nbreak',
        },
      }),
    ).toThrow('digitalMusicOption must fit on one config line');
  });
});

function computeTextSha256(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
