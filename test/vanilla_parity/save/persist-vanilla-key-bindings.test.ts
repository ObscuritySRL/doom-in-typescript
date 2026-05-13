import { describe, expect, test } from 'bun:test';

import {
  createDefaultVanillaKeyBindings,
  formatVanillaConfigLine,
  serializeVanillaKeyBindings,
  VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS,
  VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH,
  VANILLA_KEY_BINDING_NAMES,
} from '../../../src/config/persist-vanilla-key-bindings.ts';

describe('vanilla DOOM 1.9 key-binding persistence contract', () => {
  test('pins the ten vanilla key-binding variable names', () => {
    expect(VANILLA_KEY_BINDING_NAMES.length).toBe(10);
    expect(VANILLA_KEY_BINDING_NAMES).toEqual(['key_right', 'key_left', 'key_up', 'key_down', 'key_strafeleft', 'key_straferight', 'key_fire', 'key_use', 'key_strafe', 'key_speed']);
  });

  test('pins the DOS BIOS scan code defaults from DOOM 1.9 g_game.c', () => {
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_right')).toBe(77);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_left')).toBe(75);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_up')).toBe(72);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_down')).toBe(80);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_strafeleft')).toBe(51);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_straferight')).toBe(52);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_fire')).toBe(29);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_use')).toBe(57);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_strafe')).toBe(56);
    expect(VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS.get('key_speed')).toBe(54);
  });

  test('formats a line as name left-padded to 30 chars, one space, decimal value, LF terminator', () => {
    expect(VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH).toBe(30);
    const line = formatVanillaConfigLine('key_right', 77);
    expect(line).toBe('key_right                      77\n');
    expect(line.endsWith('\n')).toBe(true);
    expect(line.includes('\r')).toBe(false);
    const padded = line.slice(0, VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH);
    expect(padded).toBe('key_right                     ');
    expect(line.charAt(VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH)).toBe(' ');
  });

  test('formats longer names exactly at the 30-char column boundary', () => {
    const line = formatVanillaConfigLine('key_straferight', 52);
    expect(line).toBe('key_straferight                52\n');
    expect(line.slice(0, 30)).toBe('key_straferight               ');
  });

  test('formats multi-digit decimal values without sign or zero padding', () => {
    expect(formatVanillaConfigLine('key_fire', 29)).toBe('key_fire                       29\n');
    expect(formatVanillaConfigLine('key_use', 57)).toBe('key_use                        57\n');
    expect(formatVanillaConfigLine('key_strafeleft', 0)).toBe('key_strafeleft                 0\n');
  });

  test('serializes vanilla defaults in canonical order', () => {
    const text = serializeVanillaKeyBindings(createDefaultVanillaKeyBindings());
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBe(11);
    expect(lines[0]).toBe('key_right                      77');
    expect(lines[1]).toBe('key_left                       75');
    expect(lines[2]).toBe('key_up                         72');
    expect(lines[3]).toBe('key_down                       80');
    expect(lines[4]).toBe('key_strafeleft                 51');
    expect(lines[5]).toBe('key_straferight                52');
    expect(lines[6]).toBe('key_fire                       29');
    expect(lines[7]).toBe('key_use                        57');
    expect(lines[8]).toBe('key_strafe                     56');
    expect(lines[9]).toBe('key_speed                      54');
  });

  test('round-trips through the default.cfg parser preserving every scan code', () => {
    const customBindings = {
      key_right: 205,
      key_left: 203,
      key_up: 200,
      key_down: 208,
      key_strafeleft: 30,
      key_straferight: 32,
      key_fire: 1,
      key_use: 28,
      key_strafe: 184,
      key_speed: 42,
    };
    const text = serializeVanillaKeyBindings(customBindings);
    for (const name of VANILLA_KEY_BINDING_NAMES) {
      expect(text.includes(`${name.padEnd(30, ' ')} `)).toBe(true);
    }
    expect(text.split('\n').filter((line) => line.length > 0).length).toBe(10);
  });
});
