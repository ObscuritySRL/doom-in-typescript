import { describe, expect, test } from 'bun:test';

import {
  createDefaultVanillaScreenSettings,
  serializeVanillaScreenSettings,
  VANILLA_DETAIL_HIGH,
  VANILLA_DETAIL_LOW,
  VANILLA_GAMMA_LEVEL_COUNT,
  VANILLA_GAMMA_MAX,
  VANILLA_GAMMA_MIN,
  VANILLA_SCREENBLOCKS_MAX,
  VANILLA_SCREENBLOCKS_MIN,
  VANILLA_SCREEN_SETTING_DEFAULTS,
  VANILLA_SCREEN_SETTING_NAMES,
} from '../../../src/config/persist-screen-settings.ts';

describe('vanilla DOOM 1.9 screen-setting persistence contract', () => {
  test('pins the four vanilla screen variables in canonical order', () => {
    expect(VANILLA_SCREEN_SETTING_NAMES).toEqual(['show_messages', 'screenblocks', 'detaillevel', 'usegamma']);
  });

  test('pins the r_main.c screenblocks 3..11 range and detail enum', () => {
    expect(VANILLA_SCREENBLOCKS_MIN).toBe(3);
    expect(VANILLA_SCREENBLOCKS_MAX).toBe(11);
    expect(VANILLA_DETAIL_HIGH).toBe(0);
    expect(VANILLA_DETAIL_LOW).toBe(1);
  });

  test('pins the 5-step gamma table from i_video.c usegamma', () => {
    expect(VANILLA_GAMMA_LEVEL_COUNT).toBe(5);
    expect(VANILLA_GAMMA_MIN).toBe(0);
    expect(VANILLA_GAMMA_MAX).toBe(4);
  });

  test('hardcoded defaults match Chocolate Doom 2.2.1 r_main.c / m_menu.c initializers', () => {
    expect(VANILLA_SCREEN_SETTING_DEFAULTS.get('show_messages')).toBe(1);
    expect(VANILLA_SCREEN_SETTING_DEFAULTS.get('screenblocks')).toBe(9);
    expect(VANILLA_SCREEN_SETTING_DEFAULTS.get('detaillevel')).toBe(VANILLA_DETAIL_HIGH);
    expect(VANILLA_SCREEN_SETTING_DEFAULTS.get('usegamma')).toBe(0);
  });

  test('createDefaultVanillaScreenSettings returns a frozen DOS-default config', () => {
    const s = createDefaultVanillaScreenSettings();
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.show_messages).toBe(1);
    expect(s.screenblocks).toBe(9);
    expect(s.detaillevel).toBe(0);
    expect(s.usegamma).toBe(0);
  });

  test('serializes defaults with column-30 padding and LF terminator', () => {
    const text = serializeVanillaScreenSettings(createDefaultVanillaScreenSettings());
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBe(5);
    expect(lines[0]).toBe('show_messages                  1');
    expect(lines[1]).toBe('screenblocks                   9');
    expect(lines[2]).toBe('detaillevel                    0');
    expect(lines[3]).toBe('usegamma                       0');
    expect(text.includes('\r')).toBe(false);
  });

  test('serializes user-customized low-detail/full-HUD/max-gamma in decimal', () => {
    const text = serializeVanillaScreenSettings({
      show_messages: 0,
      screenblocks: 3,
      detaillevel: VANILLA_DETAIL_LOW,
      usegamma: 4,
    });
    expect(text).toBe(['show_messages                  0', 'screenblocks                   3', 'detaillevel                    1', 'usegamma                       4', ''].join('\n'));
  });
});
