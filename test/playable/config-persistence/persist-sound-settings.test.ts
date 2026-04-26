import { describe, expect, test } from 'bun:test';

import type { VanillaDefaultCfg } from '../../../src/config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../../src/config/hostConfig.ts';
import type { SoundSettingsOverrides } from '../../../src/playable/config-persistence/persistSoundSettings.ts';
import { VANILLA_DEFAULT_CFG_DEFINITIONS, createDefaultVanillaCfg } from '../../../src/config/defaultCfg.ts';
import { VANILLA_EXTENDED_CFG_DEFINITIONS, createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import {
  CONFIG_PERSISTENCE_AUDIT_STEP_ID,
  PERSISTED_HOST_SOUND_FIELDS,
  PERSISTED_VANILLA_SOUND_FIELDS,
  PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT,
  SOUND_SETTINGS_PERSISTENCE_SURFACE,
  persistSoundSettings,
} from '../../../src/playable/config-persistence/persistSoundSettings.ts';

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

  test('rejects every numeric setting that falls outside its permitted integer range', () => {
    const cases: ReadonlyArray<{ readonly setting: SoundSettingsOverrides; readonly errorPrefix: string }> = [
      { setting: { musicVolume: -1 }, errorPrefix: 'musicVolume must be an integer from 0 to 15' },
      { setting: { musicVolume: 16 }, errorPrefix: 'musicVolume must be an integer from 0 to 15' },
      { setting: { musicVolume: 1.5 }, errorPrefix: 'musicVolume must be an integer from 0 to 15' },
      { setting: { musicVolume: Number.NaN }, errorPrefix: 'musicVolume must be an integer from 0 to 15' },
      { setting: { soundChannels: 0 }, errorPrefix: 'soundChannels must be an integer from 1 to 32' },
      { setting: { soundChannels: 33 }, errorPrefix: 'soundChannels must be an integer from 1 to 32' },
      { setting: { musicDevice: -1 }, errorPrefix: 'musicDevice must be an integer from 0 to 9' },
      { setting: { musicDevice: 10 }, errorPrefix: 'musicDevice must be an integer from 0 to 9' },
      { setting: { soundEffectDevice: -1 }, errorPrefix: 'soundEffectDevice must be an integer from 0 to 9' },
      { setting: { soundEffectDevice: 10 }, errorPrefix: 'soundEffectDevice must be an integer from 0 to 9' },
      { setting: { soundBlasterPort: -1 }, errorPrefix: 'soundBlasterPort must be an integer from 0 to 65535' },
      { setting: { soundBlasterPort: 65_536 }, errorPrefix: 'soundBlasterPort must be an integer from 0 to 65535' },
      { setting: { soundBlasterInterruptRequest: -1 }, errorPrefix: 'soundBlasterInterruptRequest must be an integer from 0 to 15' },
      { setting: { soundBlasterInterruptRequest: 16 }, errorPrefix: 'soundBlasterInterruptRequest must be an integer from 0 to 15' },
      { setting: { soundBlasterDirectMemoryAccess: -1 }, errorPrefix: 'soundBlasterDirectMemoryAccess must be an integer from 0 to 7' },
      { setting: { soundBlasterDirectMemoryAccess: 8 }, errorPrefix: 'soundBlasterDirectMemoryAccess must be an integer from 0 to 7' },
      { setting: { musicPort: -1 }, errorPrefix: 'musicPort must be an integer from 0 to 65535' },
      { setting: { musicPort: 65_536 }, errorPrefix: 'musicPort must be an integer from 0 to 65535' },
      { setting: { sampleRate: 192_001 }, errorPrefix: 'sampleRate must be an integer from 8000 to 192000' },
      { setting: { cacheSizeBytes: -1 }, errorPrefix: 'cacheSizeBytes must be an integer from 0 to 1073741824' },
      { setting: { cacheSizeBytes: 1_073_741_825 }, errorPrefix: 'cacheSizeBytes must be an integer from 0 to 1073741824' },
      { setting: { maximumSliceTimeMilliseconds: 0 }, errorPrefix: 'maximumSliceTimeMilliseconds must be an integer from 1 to 1000' },
      { setting: { maximumSliceTimeMilliseconds: 1_001 }, errorPrefix: 'maximumSliceTimeMilliseconds must be an integer from 1 to 1000' },
      { setting: { oplInputOutputPort: -1 }, errorPrefix: 'oplInputOutputPort must be an integer from 0 to 65535' },
      { setting: { oplInputOutputPort: 65_536 }, errorPrefix: 'oplInputOutputPort must be an integer from 0 to 65535' },
      { setting: { gravisUltraSoundRamKilobytes: -1 }, errorPrefix: 'gravisUltraSoundRamKilobytes must be an integer from 0 to 65536' },
      { setting: { gravisUltraSoundRamKilobytes: 65_537 }, errorPrefix: 'gravisUltraSoundRamKilobytes must be an integer from 0 to 65536' },
      { setting: { soundEffectVolume: -1 }, errorPrefix: 'soundEffectVolume must be an integer from 0 to 15' },
    ];

    for (const { setting, errorPrefix } of cases) {
      expect(() => persistSoundSettings({ soundSettings: setting })).toThrow(errorPrefix);
    }
  });

  test('rejects libsamplerateScale values that are not finite or outside the [0.01, 1] range', () => {
    const expectedMessage = 'libsamplerateScale must be a number from 0.01 to 1';
    const invalidValues: readonly number[] = [0, 1.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.5];

    for (const value of invalidValues) {
      expect(() => persistSoundSettings({ soundSettings: { libsamplerateScale: value } })).toThrow(expectedMessage);
    }
  });

  test('rejects every config string that exceeds length, contains a line break, or contains a null byte', () => {
    const tooLong = 'x'.repeat(261);
    const cases: ReadonlyArray<{ readonly setting: SoundSettingsOverrides; readonly errorPrefix: string }> = [
      { setting: { musicCommand: tooLong }, errorPrefix: 'musicCommand must be 260 characters or fewer' },
      { setting: { musicCommand: 'a\nb' }, errorPrefix: 'musicCommand must fit on one config line' },
      { setting: { musicCommand: 'a\rb' }, errorPrefix: 'musicCommand must fit on one config line' },
      { setting: { musicCommand: 'a\0b' }, errorPrefix: 'musicCommand must fit on one config line' },
      { setting: { digitalMusicOption: tooLong }, errorPrefix: 'digitalMusicOption must be 260 characters or fewer' },
      { setting: { digitalMusicOption: 'a\rb' }, errorPrefix: 'digitalMusicOption must fit on one config line' },
      { setting: { digitalMusicOption: 'a\0b' }, errorPrefix: 'digitalMusicOption must fit on one config line' },
      { setting: { timidityConfigPath: tooLong }, errorPrefix: 'timidityConfigPath must be 260 characters or fewer' },
      { setting: { timidityConfigPath: 'a\nb' }, errorPrefix: 'timidityConfigPath must fit on one config line' },
      { setting: { gravisUltraSoundPatchPath: tooLong }, errorPrefix: 'gravisUltraSoundPatchPath must be 260 characters or fewer' },
      { setting: { gravisUltraSoundPatchPath: 'a\0b' }, errorPrefix: 'gravisUltraSoundPatchPath must fit on one config line' },
      { setting: { gravisUltraSoundPatchPath: 'a\rb' }, errorPrefix: 'gravisUltraSoundPatchPath must fit on one config line' },
    ];

    for (const { setting, errorPrefix } of cases) {
      expect(() => persistSoundSettings({ soundSettings: setting })).toThrow(errorPrefix);
    }
  });

  test('accepts the minimum and maximum boundary values for every numeric and string range', () => {
    const minimumOverrides: SoundSettingsOverrides = {
      cacheSizeBytes: 0,
      gravisUltraSoundRamKilobytes: 0,
      libsamplerateScale: 0.01,
      maximumSliceTimeMilliseconds: 1,
      musicDevice: 0,
      musicPort: 0,
      musicVolume: 0,
      oplInputOutputPort: 0,
      sampleRate: 8_000,
      soundBlasterDirectMemoryAccess: 0,
      soundBlasterInterruptRequest: 0,
      soundBlasterPort: 0,
      soundChannels: 1,
      soundEffectDevice: 0,
      soundEffectVolume: 0,
    };
    const minimumResult = persistSoundSettings({ soundSettings: minimumOverrides });
    expect(minimumResult.vanillaConfig.music_volume).toBe(0);
    expect(minimumResult.vanillaConfig.sfx_volume).toBe(0);
    expect(minimumResult.vanillaConfig.snd_channels).toBe(1);
    expect(minimumResult.vanillaConfig.snd_sbport).toBe(0);
    expect(minimumResult.hostConfig.snd_samplerate).toBe(8_000);
    expect(minimumResult.hostConfig.snd_maxslicetime_ms).toBe(1);
    expect(minimumResult.hostConfig.libsamplerate_scale).toBe(0.01);
    expect(minimumResult.hostConfig.snd_cachesize).toBe(0);
    expect(minimumResult.hostConfig.gus_ram_kb).toBe(0);

    const maximumOverrides: SoundSettingsOverrides = {
      cacheSizeBytes: 1_073_741_824,
      gravisUltraSoundRamKilobytes: 65_536,
      libsamplerateScale: 1,
      maximumSliceTimeMilliseconds: 1_000,
      musicDevice: 9,
      musicPort: 65_535,
      musicVolume: 15,
      oplInputOutputPort: 65_535,
      sampleRate: 192_000,
      soundBlasterDirectMemoryAccess: 7,
      soundBlasterInterruptRequest: 15,
      soundBlasterPort: 65_535,
      soundChannels: 32,
      soundEffectDevice: 9,
      soundEffectVolume: 15,
    };
    const maximumResult = persistSoundSettings({ soundSettings: maximumOverrides });
    expect(maximumResult.vanillaConfig.music_volume).toBe(15);
    expect(maximumResult.vanillaConfig.sfx_volume).toBe(15);
    expect(maximumResult.vanillaConfig.snd_channels).toBe(32);
    expect(maximumResult.vanillaConfig.snd_sbport).toBe(65_535);
    expect(maximumResult.hostConfig.snd_samplerate).toBe(192_000);
    expect(maximumResult.hostConfig.snd_maxslicetime_ms).toBe(1_000);
    expect(maximumResult.hostConfig.libsamplerate_scale).toBe(1);
    expect(maximumResult.hostConfig.snd_cachesize).toBe(1_073_741_824);
    expect(maximumResult.hostConfig.gus_ram_kb).toBe(65_536);

    const maxString = 'x'.repeat(260);
    const maxStringResult = persistSoundSettings({
      soundSettings: { digitalMusicOption: maxString, gravisUltraSoundPatchPath: maxString, musicCommand: maxString, timidityConfigPath: maxString },
    });
    expect(maxStringResult.hostConfig.snd_musiccmd).toBe(maxString);
    expect(maxStringResult.hostConfig.snd_dmxoption).toBe(maxString);
    expect(maxStringResult.hostConfig.timidity_cfg_path).toBe(maxString);
    expect(maxStringResult.hostConfig.gus_patch_path).toBe(maxString);

    expect(persistSoundSettings({ soundSettings: { sampleRateConversionEnabled: true } }).hostConfig.use_libsamplerate).toBe(1);
    expect(persistSoundSettings({ soundSettings: { sampleRateConversionEnabled: false } }).hostConfig.use_libsamplerate).toBe(0);
  });

  test('rejects an invalid base hostConfig.use_libsamplerate when sampleRateConversionEnabled is omitted', () => {
    const corruptedHostConfig: VanillaExtendedCfg = Object.freeze({
      ...createDefaultHostExtraCfg(),
      use_libsamplerate: 2,
    });

    expect(() => persistSoundSettings({ hostConfig: corruptedHostConfig })).toThrow('sampleRateConversionEnabled must be an integer from 0 to 1');
  });

  test('rejects the wrong runtime command before allocating result snapshots and leaves inputs untouched', () => {
    const baseHostConfig: VanillaExtendedCfg = Object.freeze({
      ...createDefaultHostExtraCfg(),
      snd_samplerate: 22_050,
    });
    const baseVanillaConfig: VanillaDefaultCfg = Object.freeze({
      ...createDefaultVanillaCfg(),
      sfx_volume: 11,
    });

    expect(() =>
      persistSoundSettings({
        command: 'bun run other.ts',
        hostConfig: baseHostConfig,
        soundSettings: { sampleRate: 48_000 },
        vanillaConfig: baseVanillaConfig,
      }),
    ).toThrow('persist sound settings requires bun run doom.ts, got bun run other.ts');

    expect(Object.isFrozen(baseHostConfig)).toBe(true);
    expect(Object.isFrozen(baseVanillaConfig)).toBe(true);
    expect(baseHostConfig.snd_samplerate).toBe(22_050);
    expect(baseVanillaConfig.sfx_volume).toBe(11);
  });

  test('locks the persisted field-order arrays against drift from the canonical config namespaces', () => {
    const persistedHostFieldNameSet: ReadonlySet<string> = new Set<string>(PERSISTED_HOST_SOUND_FIELDS);
    const canonicalHostOrder: readonly string[] = VANILLA_EXTENDED_CFG_DEFINITIONS.filter((definition) => persistedHostFieldNameSet.has(definition.name)).map((definition) => definition.name);
    expect(canonicalHostOrder).toEqual([...PERSISTED_HOST_SOUND_FIELDS]);

    const persistedVanillaFieldNameSet: ReadonlySet<string> = new Set<string>(PERSISTED_VANILLA_SOUND_FIELDS);
    const canonicalVanillaOrder: readonly string[] = VANILLA_DEFAULT_CFG_DEFINITIONS.filter((definition) => persistedVanillaFieldNameSet.has(definition.name)).map((definition) => definition.name);
    expect(canonicalVanillaOrder).toEqual([...PERSISTED_VANILLA_SOUND_FIELDS]);

    expect(PERSISTED_HOST_SOUND_FIELDS.length).toBe(11);
    expect(PERSISTED_VANILLA_SOUND_FIELDS.length).toBe(9);
  });

  test('persists a single override while keeping every other sound field at its default', () => {
    const result = persistSoundSettings({ soundSettings: { musicVolume: 10 } });

    expect(result.vanillaConfig.music_volume).toBe(10);
    expect(result.vanillaConfig.sfx_volume).toBe(8);
    expect(result.vanillaConfig.snd_channels).toBe(8);
    expect(result.vanillaConfig.snd_musicdevice).toBe(3);
    expect(result.vanillaConfig.snd_sfxdevice).toBe(3);
    expect(result.vanillaConfig.snd_sbport).toBe(0);
    expect(result.vanillaConfig.snd_sbirq).toBe(0);
    expect(result.vanillaConfig.snd_sbdma).toBe(0);
    expect(result.vanillaConfig.snd_mport).toBe(0);

    expect(result.hostConfig.snd_samplerate).toBe(44_100);
    expect(result.hostConfig.snd_cachesize).toBe(67_108_864);
    expect(result.hostConfig.snd_maxslicetime_ms).toBe(28);
    expect(result.hostConfig.snd_musiccmd).toBe('');
    expect(result.hostConfig.snd_dmxoption).toBe('');
    expect(result.hostConfig.opl_io_port).toBe(0x388);
    expect(result.hostConfig.use_libsamplerate).toBe(0);
    expect(result.hostConfig.libsamplerate_scale).toBe(0.65);
    expect(result.hostConfig.timidity_cfg_path).toBe('');
    expect(result.hostConfig.gus_patch_path).toBe('');
    expect(result.hostConfig.gus_ram_kb).toBe(1_024);

    expect(result.transition.changedFieldCount).toBe(1);
    expect(result.transition.vanillaSignature).toBe('sfx_volume=8;music_volume=10;snd_channels=8;snd_musicdevice=3;snd_sfxdevice=3;snd_sbport=0;snd_sbirq=0;snd_sbdma=0;snd_mport=0');
    expect(result.transition.hostSignature).toBe(DEFAULT_HOST_SIGNATURE);
  });

  test('locks frozen field-name arrays and command contract identity', () => {
    const result = persistSoundSettings();

    expect(Object.isFrozen(result.persistedHostFields)).toBe(true);
    expect(Object.isFrozen(result.persistedVanillaFields)).toBe(true);
    expect(Object.isFrozen(result.commandContract)).toBe(true);
    expect(result.persistedHostFields).toBe(PERSISTED_HOST_SOUND_FIELDS);
    expect(result.persistedVanillaFields).toBe(PERSISTED_VANILLA_SOUND_FIELDS);
    expect(result.commandContract).toBe(PERSIST_SOUND_SETTINGS_COMMAND_CONTRACT);
  });

  test('locks the deterministic replay evidence shape with hex hashes, uint32 checksum, and signature composition', () => {
    const result = persistSoundSettings({ soundSettings: CUSTOM_SOUND_SETTINGS });

    expect(result.deterministicReplay.hostHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.deterministicReplay.vanillaHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isInteger(result.deterministicReplay.checksum)).toBe(true);
    expect(result.deterministicReplay.checksum).toBeGreaterThanOrEqual(0);
    expect(result.deterministicReplay.checksum).toBeLessThan(4_294_967_291);
    expect(result.deterministicReplay.checksum >>> 0).toBe(result.deterministicReplay.checksum);
    expect(result.deterministicReplay.signature).toBe(`bun run doom.ts|${result.transition.vanillaSignature}|${result.transition.hostSignature}`);
    expect(result.deterministicReplay.signature.startsWith('bun run doom.ts|')).toBe(true);
    expect(result.deterministicReplay.signature.split('|').length).toBe(3);
  });
});

function computeTextSha256(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
