import { describe, expect, test } from 'bun:test';

import { createDefaultVanillaCfg } from '../../../src/config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import { PERSIST_SCREEN_SETTINGS_AUDIT_LINK, PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT, persistScreenSettings } from '../../../src/playable/config-persistence/persistScreenSettings.ts';

const CUSTOM_REPLAY_EVIDENCE = Object.freeze({
  auditSurface: 'screenSettingsPersistence',
  command: 'bun run doom.ts',
  hostFieldOrder: Object.freeze(['autoadjust_video_settings', 'fullscreen', 'aspect_ratio_correct', 'startup_delay', 'screen_width', 'screen_height', 'screen_bpp', 'show_endoom', 'png_screenshots', 'video_driver', 'window_position']),
  hostScreenHash: 'f260617eec32d11513a572381a48978761eb2c4264a371ed750eae4eadf6ace5',
  replayChecksum: 696754359,
  stateHash: 'a71bb5cf00b7151192956d9c000eeefc380c5dddd620def43d54b7bd3c37af9d',
  transitionSignature: 'screen-settings:994832543eca4d8d861e67bc1974db1d236e92baae984cb7ebc6a90cb1c95c79:f260617eec32d11513a572381a48978761eb2c4264a371ed750eae4eadf6ace5',
  vanillaFieldOrder: Object.freeze(['screenblocks', 'detaillevel', 'usegamma']),
  vanillaScreenHash: '994832543eca4d8d861e67bc1974db1d236e92baae984cb7ebc6a90cb1c95c79',
});

const CUSTOM_SCREEN_SETTINGS = Object.freeze({
  aspect_ratio_correct: 0,
  autoadjust_video_settings: 1,
  detaillevel: 1,
  fullscreen: 0,
  png_screenshots: 1,
  screen_bpp: 24,
  screen_height: 600,
  screen_width: 800,
  screenblocks: 10,
  show_endoom: 0,
  startup_delay: 250,
  usegamma: 3,
  video_driver: 'windib',
  window_position: 'center',
});

const CUSTOM_TRANSITION = Object.freeze({
  changedHostFields: Object.freeze(['fullscreen', 'aspect_ratio_correct', 'startup_delay', 'screen_width', 'screen_height', 'screen_bpp', 'show_endoom', 'png_screenshots', 'video_driver', 'window_position']),
  changedVanillaFields: Object.freeze(['screenblocks', 'detaillevel', 'usegamma']),
  hostSignature: 'autoadjust_video_settings=1;fullscreen=0;aspect_ratio_correct=0;startup_delay=250;screen_width=800;screen_height=600;screen_bpp=24;show_endoom=0;png_screenshots=1;video_driver="windib";window_position="center"',
  vanillaSignature: 'screenblocks=10;detaillevel=1;usegamma=3',
});

const DEFAULT_REPLAY_EVIDENCE = Object.freeze({
  auditSurface: 'screenSettingsPersistence',
  command: 'bun run doom.ts',
  hostFieldOrder: Object.freeze(['autoadjust_video_settings', 'fullscreen', 'aspect_ratio_correct', 'startup_delay', 'screen_width', 'screen_height', 'screen_bpp', 'show_endoom', 'png_screenshots', 'video_driver', 'window_position']),
  hostScreenHash: '4671e01acb458b56edbc2bb12a2555c05fdf82f6c37498a8034ec0c760a1ea91',
  replayChecksum: 1904830269,
  stateHash: 'd518b3d1523854c3b277953151ba8cc2b634ddb817beeee303268572d14c439d',
  transitionSignature: 'screen-settings:c90eb4d3bc256a9ef6ffc8a7f5cbaa4c29042f7f034c847c06eb21432897f814:4671e01acb458b56edbc2bb12a2555c05fdf82f6c37498a8034ec0c760a1ea91',
  vanillaFieldOrder: Object.freeze(['screenblocks', 'detaillevel', 'usegamma']),
  vanillaScreenHash: 'c90eb4d3bc256a9ef6ffc8a7f5cbaa4c29042f7f034c847c06eb21432897f814',
});

const DEFAULT_TRANSITION = Object.freeze({
  changedHostFields: Object.freeze(['autoadjust_video_settings', 'fullscreen', 'screen_width', 'screen_height', 'screen_bpp']),
  changedVanillaFields: Object.freeze([]),
  hostSignature: 'autoadjust_video_settings=0;fullscreen=0;aspect_ratio_correct=1;startup_delay=1000;screen_width=640;screen_height=480;screen_bpp=32;show_endoom=1;png_screenshots=0;video_driver="";window_position=""',
  vanillaSignature: 'screenblocks=9;detaillevel=0;usegamma=0',
});

const TARGET_COMMAND = 'bun run doom.ts';

async function hashFile(path: string): Promise<string> {
  const fileText = await Bun.file(path).text();
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(fileText);
  return hasher.digest('hex');
}

describe('persistScreenSettings', () => {
  test('locks command contract, audit link, manifest schema, and source hash', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').text();

    expect(PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
      targetCommand: TARGET_COMMAND,
    });
    expect(PERSIST_SCREEN_SETTINGS_AUDIT_LINK).toEqual({
      missingSurface: 'screenSettingsPersistence',
      stepId: '01-014',
    });
    expect(manifestText).toContain('"schemaVersion": 1');
    expect(manifestText).toContain('"surface": "screenSettingsPersistence"');
    expect(manifestText).toContain('"targetCommand": "bun run doom.ts"');
    expect(await hashFile('src/playable/config-persistence/persistScreenSettings.ts')).toBe('3f7e8f9fca9e0e372f98697949d3d07a869ec22ca013421d8173b375ecdd3579');
  });

  test('persists default playable screen settings with deterministic replay evidence', () => {
    const result = persistScreenSettings({ command: TARGET_COMMAND });

    expect(result.commandContract).toBe(PERSIST_SCREEN_SETTINGS_COMMAND_CONTRACT);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.hostConfig)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence)).toBe(true);
    expect(Object.isFrozen(result.transition)).toBe(true);
    expect(Object.isFrozen(result.vanillaConfig)).toBe(true);
    expect(result.hostConfig.autoadjust_video_settings).toBe(0);
    expect(result.hostConfig.fullscreen).toBe(0);
    expect(result.hostConfig.screen_bpp).toBe(32);
    expect(result.hostConfig.screen_height).toBe(480);
    expect(result.hostConfig.screen_width).toBe(640);
    expect(result.replayEvidence).toEqual(DEFAULT_REPLAY_EVIDENCE);
    expect(result.transition).toEqual(DEFAULT_TRANSITION);
    expect(result.vanillaConfig.detaillevel).toBe(0);
    expect(result.vanillaConfig.screenblocks).toBe(9);
    expect(result.vanillaConfig.usegamma).toBe(0);
  });

  test('persists custom screen settings and preserves unrelated config values', () => {
    const hostConfig = Object.freeze({
      ...createDefaultHostExtraCfg(),
      snd_samplerate: 22050,
      window_position: 'preserve-check',
    });
    const vanillaConfig = Object.freeze({
      ...createDefaultVanillaCfg(),
      music_volume: 3,
      sfx_volume: 4,
    });

    const result = persistScreenSettings({
      command: TARGET_COMMAND,
      hostConfig,
      settings: CUSTOM_SCREEN_SETTINGS,
      vanillaConfig,
    });

    expect(result.hostConfig.aspect_ratio_correct).toBe(0);
    expect(result.hostConfig.png_screenshots).toBe(1);
    expect(result.hostConfig.screen_bpp).toBe(24);
    expect(result.hostConfig.screen_height).toBe(600);
    expect(result.hostConfig.screen_width).toBe(800);
    expect(result.hostConfig.snd_samplerate).toBe(22050);
    expect(result.hostConfig.video_driver).toBe('windib');
    expect(result.hostConfig.window_position).toBe('center');
    expect(result.replayEvidence).toEqual(CUSTOM_REPLAY_EVIDENCE);
    expect(result.transition).toEqual(CUSTOM_TRANSITION);
    expect(result.vanillaConfig.detaillevel).toBe(1);
    expect(result.vanillaConfig.music_volume).toBe(3);
    expect(result.vanillaConfig.screenblocks).toBe(10);
    expect(result.vanillaConfig.sfx_volume).toBe(4);
    expect(result.vanillaConfig.usegamma).toBe(3);
  });

  test('validates the product command before screen settings', () => {
    expect(() =>
      persistScreenSettings({
        command: 'bun run src/main.ts',
        settings: { screen_width: -1 },
      }),
    ).toThrow('persist screen settings requires bun run doom.ts');
  });

  test('rejects invalid screen settings', () => {
    const settingsWithUnknownField = {
      screenblocks: 9,
      unknown_screen_setting: 1,
    };

    expect(() =>
      persistScreenSettings({
        command: TARGET_COMMAND,
        settings: { screen_bpp: 12 },
      }),
    ).toThrow('screen_bpp must be one of 0, 8, 15, 16, 24, 32');
    expect(() =>
      persistScreenSettings({
        command: TARGET_COMMAND,
        settings: { screenblocks: 12 },
      }),
    ).toThrow('screenblocks must be an integer from 3 to 11');
    expect(() =>
      persistScreenSettings({
        command: TARGET_COMMAND,
        settings: { window_position: 'line-one\nline-two' },
      }),
    ).toThrow('window_position must not contain a config line break');
    expect(() =>
      persistScreenSettings({
        command: TARGET_COMMAND,
        settings: settingsWithUnknownField,
      }),
    ).toThrow('unknown screen setting unknown_screen_setting');
  });
});
