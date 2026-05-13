import { describe, expect, test } from 'bun:test';

import { createDefaultVanillaMouseSettings, serializeVanillaMouseSettings, VANILLA_MOUSE_SETTING_DEFAULTS, VANILLA_MOUSE_SETTING_NAMES } from '../../../src/config/persist-mouse-settings.ts';

describe('vanilla DOOM 1.9 mouse-setting persistence contract', () => {
  test('pins the five vanilla mouse variable names in canonical order', () => {
    expect(VANILLA_MOUSE_SETTING_NAMES).toEqual(['mouse_sensitivity', 'use_mouse', 'mouseb_fire', 'mouseb_strafe', 'mouseb_forward']);
  });

  test('pins the DOOM 1.9 g_game.c / i_input.c hardcoded mouse defaults', () => {
    expect(VANILLA_MOUSE_SETTING_DEFAULTS.get('mouse_sensitivity')).toBe(5);
    expect(VANILLA_MOUSE_SETTING_DEFAULTS.get('use_mouse')).toBe(1);
    expect(VANILLA_MOUSE_SETTING_DEFAULTS.get('mouseb_fire')).toBe(0);
    expect(VANILLA_MOUSE_SETTING_DEFAULTS.get('mouseb_strafe')).toBe(1);
    expect(VANILLA_MOUSE_SETTING_DEFAULTS.get('mouseb_forward')).toBe(2);
  });

  test('createDefaultVanillaMouseSettings returns a frozen object matching the defaults map', () => {
    const settings = createDefaultVanillaMouseSettings();
    expect(Object.isFrozen(settings)).toBe(true);
    expect(settings.mouse_sensitivity).toBe(5);
    expect(settings.use_mouse).toBe(1);
    expect(settings.mouseb_fire).toBe(0);
    expect(settings.mouseb_strafe).toBe(1);
    expect(settings.mouseb_forward).toBe(2);
  });

  test('serializes vanilla defaults with name padded to column 30, decimal value, LF terminator', () => {
    const text = serializeVanillaMouseSettings(createDefaultVanillaMouseSettings());
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBe(6);
    expect(lines[0]).toBe('mouse_sensitivity              5');
    expect(lines[1]).toBe('use_mouse                      1');
    expect(lines[2]).toBe('mouseb_fire                    0');
    expect(lines[3]).toBe('mouseb_strafe                  1');
    expect(lines[4]).toBe('mouseb_forward                 2');
    expect(text.includes('\r')).toBe(false);
  });

  test('serializes user-customized button assignments without sign or zero padding', () => {
    const custom = {
      mouse_sensitivity: 10,
      use_mouse: 0,
      mouseb_fire: 2,
      mouseb_strafe: 0,
      mouseb_forward: 1,
    };
    const text = serializeVanillaMouseSettings(custom);
    expect(text).toBe(['mouse_sensitivity              10', 'use_mouse                      0', 'mouseb_fire                    2', 'mouseb_strafe                  0', 'mouseb_forward                 1', ''].join('\n'));
  });
});
