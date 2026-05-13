import { describe, expect, test } from 'bun:test';

import {
  createVanillaChocolateDoomCfgWithHardcodedDefaults,
  parseVanillaChocolateDoomCfg,
  VANILLA_CHOCOLATE_DOOM_CFG_FILENAME,
  VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_COUNT,
  VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_NAMES,
} from '../../../src/config/parse-chocolate-doom-cfg.ts';
import { VANILLA_DEFAULT_CFG_VARIABLE_NAMES } from '../../../src/config/parse-default-cfg.ts';

describe('vanilla Chocolate Doom chocolate-doom.cfg extended-config parser contract', () => {
  test('pins the extended namespace at 113 variables disjoint from default.cfg', () => {
    expect(VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_COUNT).toBe(113);
    expect(VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_NAMES.length).toBe(113);
    expect(new Set(VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_NAMES).size).toBe(113);
    expect(VANILLA_CHOCOLATE_DOOM_CFG_FILENAME).toBe('chocolate-doom.cfg');

    const vanillaSet = new Set(VANILLA_DEFAULT_CFG_VARIABLE_NAMES);
    for (const name of VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_NAMES) {
      expect(vanillaSet.has(name)).toBe(false);
    }
  });

  test('hardcoded defaults match Chocolate Doom 2.2.1 m_config.c initializers', () => {
    const defaults = createVanillaChocolateDoomCfgWithHardcodedDefaults();
    expect(defaults.fullscreen).toBe(1);
    expect(defaults.aspect_ratio_correct).toBe(1);
    expect(defaults.grabmouse).toBe(1);
    expect(defaults.snd_samplerate).toBe(44100);
    expect(defaults.snd_maxslicetime_ms).toBe(28);
    expect(defaults.opl_io_port).toBe(0x388);
    expect(defaults.vanilla_savegame_limit).toBe(1);
    expect(defaults.vanilla_demo_limit).toBe(1);
    expect(defaults.vanilla_keyboard_mapping).toBe(1);
    expect(defaults.show_endoom).toBe(1);
    expect(defaults.dclick_use).toBe(1);
  });

  test('parses integers, hex integers, floats, and quoted strings', () => {
    const content = ['snd_samplerate 22050', 'opl_io_port 0x388', 'mouse_acceleration 2.000000', 'libsamplerate_scale 0.650000', 'player_name "doomguy"', 'window_position "center"', ''].join('\n');
    const cfg = parseVanillaChocolateDoomCfg(content);
    expect(cfg.snd_samplerate).toBe(22050);
    expect(cfg.opl_io_port).toBe(904);
    expect(cfg.mouse_acceleration).toBe(2);
    expect(cfg.libsamplerate_scale).toBeCloseTo(0.65, 5);
    expect(cfg.player_name).toBe('doomguy');
    expect(cfg.window_position).toBe('center');
  });

  test('preserves negative-one unbound sentinel for mouse buttons, joystick buttons, and disconnected axes', () => {
    const content = ['mouseb_strafeleft -1', 'mouseb_backward -1', 'joystick_index -1', 'joystick_strafe_axis -1', 'joyb_strafeleft -1', 'joyb_menu_activate -1', ''].join('\n');
    const cfg = parseVanillaChocolateDoomCfg(content);
    expect(cfg.mouseb_strafeleft).toBe(-1);
    expect(cfg.mouseb_backward).toBe(-1);
    expect(cfg.joystick_index).toBe(-1);
    expect(cfg.joystick_strafe_axis).toBe(-1);
    expect(cfg.joyb_strafeleft).toBe(-1);
    expect(cfg.joyb_menu_activate).toBe(-1);
  });

  test('missing variables fall back to hardcoded defaults', () => {
    const cfg = parseVanillaChocolateDoomCfg('fullscreen 0\n');
    expect(cfg.fullscreen).toBe(0);
    expect(cfg.snd_samplerate).toBe(44100);
    expect(cfg.opl_io_port).toBe(0x388);
    expect(cfg.vanilla_keyboard_mapping).toBe(1);
  });

  test('unknown variables are silently ignored', () => {
    const cfg = parseVanillaChocolateDoomCfg('mod_specific_setting 42\nsnd_samplerate 11025\n');
    expect(cfg.snd_samplerate).toBe(11025);
    expect(Object.prototype.hasOwnProperty.call(cfg, 'mod_specific_setting')).toBe(false);
  });

  test('CRLF and blank lines are tolerated', () => {
    const cfg = parseVanillaChocolateDoomCfg('\r\nfullscreen 0\r\n\r\nsnd_samplerate 22050\r\n');
    expect(cfg.fullscreen).toBe(0);
    expect(cfg.snd_samplerate).toBe(22050);
  });
});
