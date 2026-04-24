import { describe, expect, test } from 'bun:test';

import { VANILLA_DEFAULT_CFG_DEFINITIONS } from '../../src/config/defaultCfg.ts';
import type { VanillaExtendedCfg } from '../../src/config/hostConfig.ts';
import { createDefaultHostExtraCfg, HOST_EXTRA_CFG_VARIABLE_COUNT, parseHostExtraCfg, VANILLA_EXTENDED_CFG_DEFINITIONS } from '../../src/config/hostConfig.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';

const REFERENCE_EXTENDED_CFG_PATH = `${REFERENCE_BUNDLE_PATH}\\chocolate-doom.cfg`;

/**
 * Expected reference-bundle `chocolate-doom.cfg` values (F-022, F-033,
 * config-variable-summary.json). These are the on-disk values from the
 * reference machine capture, NOT the C-level hardcoded defaults — a few
 * of these (screen_width, screen_height, screen_bpp, player_name)
 * diverge from the pristine defaults because the reference file reflects
 * a post-first-run state after autoadjust + user-name population.
 */
const REFERENCE_STORED_VALUES: Readonly<VanillaExtendedCfg> = Object.freeze({
  autoadjust_video_settings: 1,
  fullscreen: 1,
  aspect_ratio_correct: 1,
  startup_delay: 1000,
  screen_width: 640,
  screen_height: 480,
  screen_bpp: 32,
  grabmouse: 1,
  novert: 0,
  mouse_acceleration: 2.0,
  mouse_threshold: 10,
  snd_samplerate: 44100,
  snd_cachesize: 67108864,
  snd_maxslicetime_ms: 28,
  snd_musiccmd: '',
  snd_dmxoption: '',
  opl_io_port: 0x388,
  show_endoom: 1,
  png_screenshots: 0,
  vanilla_savegame_limit: 1,
  vanilla_demo_limit: 1,
  vanilla_keyboard_mapping: 1,
  video_driver: '',
  window_position: '',
  player_name: 'stevp',
  joystick_index: -1,
  joystick_x_axis: 0,
  joystick_x_invert: 0,
  joystick_y_axis: 1,
  joystick_y_invert: 0,
  joystick_strafe_axis: -1,
  joystick_strafe_invert: 0,
  joystick_physical_button0: 0,
  joystick_physical_button1: 1,
  joystick_physical_button2: 2,
  joystick_physical_button3: 3,
  joystick_physical_button4: 4,
  joystick_physical_button5: 5,
  joystick_physical_button6: 6,
  joystick_physical_button7: 7,
  joystick_physical_button8: 8,
  joystick_physical_button9: 9,
  joyb_strafeleft: -1,
  joyb_straferight: -1,
  joyb_menu_activate: -1,
  joyb_prevweapon: -1,
  joyb_nextweapon: -1,
  mouseb_strafeleft: -1,
  mouseb_straferight: -1,
  mouseb_use: -1,
  mouseb_backward: -1,
  mouseb_prevweapon: -1,
  mouseb_nextweapon: -1,
  dclick_use: 1,
  use_libsamplerate: 0,
  libsamplerate_scale: 0.65,
  timidity_cfg_path: '',
  gus_patch_path: '',
  gus_ram_kb: 1024,
  key_pause: 69,
  key_menu_activate: 1,
  key_menu_up: 72,
  key_menu_down: 80,
  key_menu_left: 75,
  key_menu_right: 77,
  key_menu_back: 14,
  key_menu_forward: 28,
  key_menu_confirm: 21,
  key_menu_abort: 49,
  key_menu_help: 59,
  key_menu_save: 60,
  key_menu_load: 61,
  key_menu_volume: 62,
  key_menu_detail: 63,
  key_menu_qsave: 64,
  key_menu_endgame: 65,
  key_menu_messages: 66,
  key_menu_qload: 67,
  key_menu_quit: 68,
  key_menu_gamma: 87,
  key_spy: 88,
  key_menu_incscreen: 13,
  key_menu_decscreen: 12,
  key_menu_screenshot: 0,
  key_map_toggle: 15,
  key_map_north: 72,
  key_map_south: 80,
  key_map_east: 77,
  key_map_west: 75,
  key_map_zoomin: 13,
  key_map_zoomout: 12,
  key_map_maxzoom: 11,
  key_map_follow: 33,
  key_map_grid: 34,
  key_map_mark: 50,
  key_map_clearmark: 46,
  key_weapon1: 2,
  key_weapon2: 3,
  key_weapon3: 4,
  key_weapon4: 5,
  key_weapon5: 6,
  key_weapon6: 7,
  key_weapon7: 8,
  key_weapon8: 9,
  key_prevweapon: 0,
  key_nextweapon: 0,
  key_message_refresh: 28,
  key_demo_quit: 16,
  key_multi_msg: 20,
  key_multi_msgplayer1: 34,
  key_multi_msgplayer2: 23,
  key_multi_msgplayer3: 48,
  key_multi_msgplayer4: 19,
});

describe('HOST_EXTRA_CFG_VARIABLE_COUNT', () => {
  test('locks the extended namespace size at 113 variables (F-022)', () => {
    expect(HOST_EXTRA_CFG_VARIABLE_COUNT).toBe(113);
  });

  test('matches the definition array length', () => {
    expect(VANILLA_EXTENDED_CFG_DEFINITIONS.length).toBe(HOST_EXTRA_CFG_VARIABLE_COUNT);
  });
});

describe('VANILLA_EXTENDED_CFG_DEFINITIONS', () => {
  test('is a frozen array', () => {
    expect(Object.isFrozen(VANILLA_EXTENDED_CFG_DEFINITIONS)).toBe(true);
  });

  test('every definition is frozen', () => {
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });

  test('every name is unique', () => {
    const seen = new Set<string>();
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      expect(seen.has(definition.name)).toBe(false);
      seen.add(definition.name);
    }
    expect(seen.size).toBe(HOST_EXTRA_CFG_VARIABLE_COUNT);
  });

  test('includes 104 integer, 7 string, and 2 float variables (F-022 distribution)', () => {
    let integers = 0;
    let strings = 0;
    let floats = 0;
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      if (definition.type === 'integer') integers++;
      else if (definition.type === 'string') strings++;
      else if (definition.type === 'float') floats++;
    }
    expect(integers).toBe(104);
    expect(strings).toBe(7);
    expect(floats).toBe(2);
  });

  test('every definition has a type matching the expected value shape', () => {
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      if (definition.type === 'integer') {
        expect(typeof definition.defaultValue).toBe('number');
        expect(Number.isInteger(definition.defaultValue as number)).toBe(true);
      } else if (definition.type === 'float') {
        expect(typeof definition.defaultValue).toBe('number');
      } else if (definition.type === 'string') {
        expect(typeof definition.defaultValue).toBe('string');
      } else {
        throw new Error(`unexpected type ${definition.type} for ${definition.name}`);
      }
    }
  });

  test('ordering matches the reference bundle serialization order', () => {
    const orderedNames = VANILLA_EXTENDED_CFG_DEFINITIONS.map((d) => d.name);
    expect(orderedNames[0]).toBe('autoadjust_video_settings');
    expect(orderedNames[1]).toBe('fullscreen');
    expect(orderedNames[2]).toBe('aspect_ratio_correct');
    expect(orderedNames[HOST_EXTRA_CFG_VARIABLE_COUNT - 1]).toBe('key_multi_msgplayer4');
  });

  test('has zero overlap with VANILLA_DEFAULT_CFG_DEFINITIONS (F-022 disjoint namespaces)', () => {
    const extendedNames = new Set(VANILLA_EXTENDED_CFG_DEFINITIONS.map((d) => d.name));
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      expect(extendedNames.has(definition.name)).toBe(false);
    }
  });

  test('includes exactly the 2 float variables documented in the manifest', () => {
    const floats = VANILLA_EXTENDED_CFG_DEFINITIONS.filter((d) => d.type === 'float');
    expect(floats.length).toBe(2);
    const floatNames = floats.map((d) => d.name).sort();
    expect(floatNames).toEqual(['libsamplerate_scale', 'mouse_acceleration']);
  });

  test('includes exactly the 3 vanilla_* compatibility flags', () => {
    const vanillaCompat = VANILLA_EXTENDED_CFG_DEFINITIONS.filter((d) => d.name.startsWith('vanilla_'));
    expect(vanillaCompat.length).toBe(3);
    const names = vanillaCompat.map((d) => d.name).sort();
    expect(names).toEqual(['vanilla_demo_limit', 'vanilla_keyboard_mapping', 'vanilla_savegame_limit']);
    for (const definition of vanillaCompat) {
      expect(definition.type).toBe('integer');
      expect(definition.defaultValue).toBe(1);
    }
  });
});

describe('createDefaultHostExtraCfg', () => {
  test('returns a frozen object', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test('returns a new object on each call', () => {
    const a = createDefaultHostExtraCfg();
    const b = createDefaultHostExtraCfg();
    expect(a).not.toBe(b);
  });

  test('has every variable from the definitions', () => {
    const cfg = createDefaultHostExtraCfg();
    const keys = Object.keys(cfg);
    expect(keys.length).toBe(HOST_EXTRA_CFG_VARIABLE_COUNT);
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      expect(keys.includes(definition.name)).toBe(true);
    }
  });

  test('every field equals the C-level hardcoded default', () => {
    const cfg = createDefaultHostExtraCfg();
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      const key = definition.name as keyof VanillaExtendedCfg;
      expect(cfg[key]).toBe(definition.defaultValue);
    }
  });

  test('video auto-detect sentinels (screen_width / screen_height / screen_bpp) default to 0', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.screen_width).toBe(0);
    expect(cfg.screen_height).toBe(0);
    expect(cfg.screen_bpp).toBe(0);
  });

  test('player_name defaults to empty string (runtime-populated by I_GetUserName)', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.player_name).toBe('');
  });

  test('vanilla_* compatibility flags default to enabled (F-023)', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.vanilla_demo_limit).toBe(1);
    expect(cfg.vanilla_keyboard_mapping).toBe(1);
    expect(cfg.vanilla_savegame_limit).toBe(1);
  });

  test('opl_io_port defaults to 0x388 (904)', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.opl_io_port).toBe(0x388);
    expect(cfg.opl_io_port).toBe(904);
  });

  test('joyb_* and mouseb_* modern bindings default to unbound sentinel (-1)', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.joyb_strafeleft).toBe(-1);
    expect(cfg.joyb_straferight).toBe(-1);
    expect(cfg.joyb_menu_activate).toBe(-1);
    expect(cfg.joyb_prevweapon).toBe(-1);
    expect(cfg.joyb_nextweapon).toBe(-1);
    expect(cfg.mouseb_strafeleft).toBe(-1);
    expect(cfg.mouseb_straferight).toBe(-1);
    expect(cfg.mouseb_use).toBe(-1);
    expect(cfg.mouseb_backward).toBe(-1);
    expect(cfg.mouseb_prevweapon).toBe(-1);
    expect(cfg.mouseb_nextweapon).toBe(-1);
  });

  test('joystick_physical_button0..9 default to identity mapping (0..9)', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.joystick_physical_button0).toBe(0);
    expect(cfg.joystick_physical_button1).toBe(1);
    expect(cfg.joystick_physical_button2).toBe(2);
    expect(cfg.joystick_physical_button3).toBe(3);
    expect(cfg.joystick_physical_button4).toBe(4);
    expect(cfg.joystick_physical_button5).toBe(5);
    expect(cfg.joystick_physical_button6).toBe(6);
    expect(cfg.joystick_physical_button7).toBe(7);
    expect(cfg.joystick_physical_button8).toBe(8);
    expect(cfg.joystick_physical_button9).toBe(9);
  });

  test('key_menu_* DOS scan codes match vanilla F-key bindings (F1..F10 = 59..68)', () => {
    const cfg = createDefaultHostExtraCfg();
    expect(cfg.key_menu_help).toBe(59);
    expect(cfg.key_menu_save).toBe(60);
    expect(cfg.key_menu_load).toBe(61);
    expect(cfg.key_menu_volume).toBe(62);
    expect(cfg.key_menu_detail).toBe(63);
    expect(cfg.key_menu_qsave).toBe(64);
    expect(cfg.key_menu_endgame).toBe(65);
    expect(cfg.key_menu_messages).toBe(66);
    expect(cfg.key_menu_qload).toBe(67);
    expect(cfg.key_menu_quit).toBe(68);
  });
});

describe('parseHostExtraCfg basic parsing', () => {
  test('parses a single-integer line and falls back on the rest', () => {
    const cfg = parseHostExtraCfg('snd_samplerate 48000\n');
    expect(cfg.snd_samplerate).toBe(48000);
    expect(cfg.snd_cachesize).toBe(67108864);
    expect(cfg.fullscreen).toBe(1);
  });

  test('parses a single-string line with quoted content', () => {
    const cfg = parseHostExtraCfg('player_name "Alice"\n');
    expect(cfg.player_name).toBe('Alice');
  });

  test('parses an empty quoted string correctly', () => {
    const cfg = parseHostExtraCfg('snd_musiccmd ""\n');
    expect(cfg.snd_musiccmd).toBe('');
  });

  test('parses a single-float line with trailing zeros', () => {
    const cfg = parseHostExtraCfg('mouse_acceleration 2.000000\n');
    expect(cfg.mouse_acceleration).toBe(2.0);
  });

  test('returns a frozen object', () => {
    const cfg = parseHostExtraCfg('');
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test('empty content returns the default extra cfg object', () => {
    const parsed = parseHostExtraCfg('');
    const defaults = createDefaultHostExtraCfg();
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      const key = definition.name as keyof VanillaExtendedCfg;
      expect(parsed[key]).toBe(defaults[key]);
    }
  });

  test('silently ignores unknown variable lines', () => {
    const cfg = parseHostExtraCfg('unknown_extended 99\nsome_future_option "junk"\nfullscreen 0\n');
    expect(cfg.fullscreen).toBe(0);
    expect(Object.keys(cfg).length).toBe(HOST_EXTRA_CFG_VARIABLE_COUNT);
    expect(Object.hasOwn(cfg, 'unknown_extended')).toBe(false);
    expect(Object.hasOwn(cfg, 'some_future_option')).toBe(false);
  });

  test('silently ignores a vanilla-namespace variable (disjoint namespaces)', () => {
    const cfg = parseHostExtraCfg('sfx_volume 15\nmusic_volume 15\nfullscreen 0\n');
    expect(cfg.fullscreen).toBe(0);
    expect(Object.hasOwn(cfg, 'sfx_volume')).toBe(false);
    expect(Object.hasOwn(cfg, 'music_volume')).toBe(false);
  });

  test('handles Windows line endings', () => {
    const cfg = parseHostExtraCfg('fullscreen 0\r\nsnd_samplerate 22050\r\n');
    expect(cfg.fullscreen).toBe(0);
    expect(cfg.snd_samplerate).toBe(22050);
  });

  test('skips blank and whitespace-only lines', () => {
    const cfg = parseHostExtraCfg('\n   \n\nfullscreen 0\n\n');
    expect(cfg.fullscreen).toBe(0);
  });

  test('later lines override earlier lines for the same variable', () => {
    const cfg = parseHostExtraCfg('snd_samplerate 22050\nsnd_samplerate 48000\n');
    expect(cfg.snd_samplerate).toBe(48000);
  });

  test('parses negative integers (unbound sentinel -1)', () => {
    const cfg = parseHostExtraCfg('joyb_strafeleft -1\n');
    expect(cfg.joyb_strafeleft).toBe(-1);
  });

  test('ignores a line that is only a variable name with no value', () => {
    const cfg = parseHostExtraCfg('snd_samplerate\nfullscreen 0\n');
    expect(cfg.snd_samplerate).toBe(44100);
    expect(cfg.fullscreen).toBe(0);
  });
});

describe('parseHostExtraCfg type safety', () => {
  test('integer variables remain numbers', () => {
    const cfg = parseHostExtraCfg('snd_samplerate 48000\n');
    expect(typeof cfg.snd_samplerate).toBe('number');
    expect(Number.isInteger(cfg.snd_samplerate)).toBe(true);
  });

  test('float variables remain numbers with decimal precision', () => {
    const cfg = parseHostExtraCfg('libsamplerate_scale 0.5\n');
    expect(typeof cfg.libsamplerate_scale).toBe('number');
    expect(cfg.libsamplerate_scale).toBe(0.5);
  });

  test('string variables remain strings', () => {
    const cfg = parseHostExtraCfg('video_driver "directx"\n');
    expect(typeof cfg.video_driver).toBe('string');
    expect(cfg.video_driver).toBe('directx');
  });
});

describe('parseHostExtraCfg reference bundle', () => {
  test('parses the reference chocolate-doom.cfg exactly (F-033)', async () => {
    const content = await Bun.file(REFERENCE_EXTENDED_CFG_PATH).text();
    const cfg = parseHostExtraCfg(content);
    for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
      const key = definition.name as keyof VanillaExtendedCfg;
      expect(cfg[key]).toBe(REFERENCE_STORED_VALUES[key]);
    }
  });

  test('reference file has 113 non-empty lines', async () => {
    const content = await Bun.file(REFERENCE_EXTENDED_CFG_PATH).text();
    const nonEmptyLines = content.split('\n').filter((line) => line.trim().length > 0);
    expect(nonEmptyLines.length).toBe(HOST_EXTRA_CFG_VARIABLE_COUNT);
  });

  test('every reference line maps to a known extended definition', async () => {
    const content = await Bun.file(REFERENCE_EXTENDED_CFG_PATH).text();
    const names = new Set(VANILLA_EXTENDED_CFG_DEFINITIONS.map((d) => d.name));
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      const match = trimmed.match(/^(\S+)\s+(.+)$/);
      expect(match).not.toBeNull();
      expect(names.has(match![1]!)).toBe(true);
    }
  });

  test('reference opl_io_port is stored as hex 0x388 and parses to 904', async () => {
    const content = await Bun.file(REFERENCE_EXTENDED_CFG_PATH).text();
    expect(content.includes('opl_io_port                   0x388')).toBe(true);
    const cfg = parseHostExtraCfg(content);
    expect(cfg.opl_io_port).toBe(904);
    expect(cfg.opl_io_port).toBe(0x388);
  });

  test('reference screen dimensions override the 0-default post-autoadjust', async () => {
    const content = await Bun.file(REFERENCE_EXTENDED_CFG_PATH).text();
    const cfg = parseHostExtraCfg(content);
    expect(cfg.screen_width).toBe(640);
    expect(cfg.screen_height).toBe(480);
    expect(cfg.screen_bpp).toBe(32);
    const defaults = createDefaultHostExtraCfg();
    expect(defaults.screen_width).toBe(0);
    expect(defaults.screen_height).toBe(0);
    expect(defaults.screen_bpp).toBe(0);
  });
});

describe('parity-sensitive edge cases', () => {
  test('opl_io_port accepts both decimal 904 and hex 0x388 forms', () => {
    const decimal = parseHostExtraCfg('opl_io_port 904\n');
    const hex = parseHostExtraCfg('opl_io_port 0x388\n');
    expect(decimal.opl_io_port).toBe(904);
    expect(hex.opl_io_port).toBe(0x388);
    expect(decimal.opl_io_port).toBe(hex.opl_io_port);
  });

  test('float mouse_acceleration accepts trailing-zero decimal and plain decimal', () => {
    const trailing = parseHostExtraCfg('mouse_acceleration 2.000000\n');
    const plain = parseHostExtraCfg('mouse_acceleration 2.0\n');
    const integer = parseHostExtraCfg('mouse_acceleration 3\n');
    expect(trailing.mouse_acceleration).toBe(2.0);
    expect(plain.mouse_acceleration).toBe(2.0);
    expect(integer.mouse_acceleration).toBe(3.0);
  });

  test('vanilla_keyboard_mapping controls whether DOS scan codes are translated', () => {
    const enabled = parseHostExtraCfg('vanilla_keyboard_mapping 1\n');
    const disabled = parseHostExtraCfg('vanilla_keyboard_mapping 0\n');
    expect(enabled.vanilla_keyboard_mapping).toBe(1);
    expect(disabled.vanilla_keyboard_mapping).toBe(0);
  });

  test('key_menu_activate=1 is the DOS scan code for Escape, not ASCII 27', () => {
    const cfg = parseHostExtraCfg('key_menu_activate 1\n');
    expect(cfg.key_menu_activate).toBe(1);
    expect(cfg.key_menu_activate).not.toBe(27);
  });

  test('snd_cachesize accepts the canonical 64 MiB value 67108864', () => {
    const cfg = parseHostExtraCfg('snd_cachesize 67108864\n');
    expect(cfg.snd_cachesize).toBe(67108864);
    expect(cfg.snd_cachesize).toBe(64 * 1024 * 1024);
  });

  test('defaults are NOT mutated when parseHostExtraCfg is called', () => {
    const beforeDefault = createDefaultHostExtraCfg();
    const beforeFullscreen = beforeDefault.fullscreen;
    parseHostExtraCfg('fullscreen 0\n');
    const afterDefault = createDefaultHostExtraCfg();
    expect(afterDefault.fullscreen).toBe(beforeFullscreen);
    expect(afterDefault.fullscreen).toBe(1);
  });

  test('definitions table is NOT mutated when parseHostExtraCfg is called', () => {
    const snapshot = VANILLA_EXTENDED_CFG_DEFINITIONS.map((d) => `${d.name}|${d.type}|${d.defaultValue}`).join(';');
    parseHostExtraCfg('fullscreen 0\nopl_io_port 0x220\nplayer_name "Changed"\n');
    const after = VANILLA_EXTENDED_CFG_DEFINITIONS.map((d) => `${d.name}|${d.type}|${d.defaultValue}`).join(';');
    expect(after).toBe(snapshot);
  });

  test('player_name with spaces inside quotes is preserved exactly', () => {
    const cfg = parseHostExtraCfg('player_name "John Romero"\n');
    expect(cfg.player_name).toBe('John Romero');
  });

  test('joystick_strafe_axis=-1 is the disconnected sentinel distinct from axis 0', () => {
    const disconnected = parseHostExtraCfg('joystick_strafe_axis -1\n');
    const axisZero = parseHostExtraCfg('joystick_strafe_axis 0\n');
    expect(disconnected.joystick_strafe_axis).toBe(-1);
    expect(axisZero.joystick_strafe_axis).toBe(0);
    expect(disconnected.joystick_strafe_axis).not.toBe(axisZero.joystick_strafe_axis);
  });
});
