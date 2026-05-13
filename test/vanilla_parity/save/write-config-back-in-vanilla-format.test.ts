import { describe, expect, test } from 'bun:test';

import { createVanillaDefaultCfgWithHardcodedDefaults, parseVanillaDefaultCfg } from '../../../src/config/parse-default-cfg.ts';
import { VANILLA_CONFIG_TOTAL_LINE_COUNT, writeVanillaDefaultCfg } from '../../../src/config/write-config-back-in-vanilla-format.ts';

describe('vanilla DOOM 1.9 default.cfg round-trip writer contract', () => {
  test('pins the 43-line vanilla config total', () => {
    expect(VANILLA_CONFIG_TOTAL_LINE_COUNT).toBe(43);
  });

  test('serializes the vanilla defaults as 43 LF-terminated lines with no CRLF', () => {
    const text = writeVanillaDefaultCfg(createVanillaDefaultCfgWithHardcodedDefaults());
    expect(text.includes('\r')).toBe(false);
    expect(text.endsWith('\n')).toBe(true);
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBe(44);
  });

  test('emits variables in canonical M_SaveDefaults order', () => {
    const text = writeVanillaDefaultCfg(createVanillaDefaultCfgWithHardcodedDefaults());
    const lines = text.split('\n').slice(0, -1);
    expect(lines[0]?.startsWith('mouse_sensitivity')).toBe(true);
    expect(lines[1]?.startsWith('sfx_volume')).toBe(true);
    expect(lines[2]?.startsWith('music_volume')).toBe(true);
    expect(lines[3]?.startsWith('show_messages')).toBe(true);
    expect(lines[4]?.startsWith('key_right')).toBe(true);
    expect(lines[14]?.startsWith('use_mouse')).toBe(true);
    expect(lines[23]?.startsWith('screenblocks')).toBe(true);
    expect(lines[33]?.startsWith('chatmacro0')).toBe(true);
    expect(lines[42]?.startsWith('chatmacro9')).toBe(true);
  });

  test('parse(write(defaults)) round-trips to the original defaults object', () => {
    const original = createVanillaDefaultCfgWithHardcodedDefaults();
    const text = writeVanillaDefaultCfg(original);
    const reparsed = parseVanillaDefaultCfg(text);
    expect(reparsed).toEqual(original);
  });

  test('round-trips user-customized integer and string values byte-for-byte', () => {
    const original = createVanillaDefaultCfgWithHardcodedDefaults();
    const customized = Object.freeze({
      ...original,
      mouse_sensitivity: 9,
      key_fire: 1,
      key_strafe: 184,
      snd_musicdevice: 5,
      snd_sbport: 544,
      chatmacro0: 'Y',
      chatmacro5: 'easy mode',
    });
    const text = writeVanillaDefaultCfg(customized);
    const reparsed = parseVanillaDefaultCfg(text);
    expect(reparsed.mouse_sensitivity).toBe(9);
    expect(reparsed.key_fire).toBe(1);
    expect(reparsed.key_strafe).toBe(184);
    expect(reparsed.snd_musicdevice).toBe(5);
    expect(reparsed.snd_sbport).toBe(544);
    expect(reparsed.chatmacro0).toBe('Y');
    expect(reparsed.chatmacro5).toBe('easy mode');
  });

  test('each line is name padded to column 30, single space, value, single LF', () => {
    const text = writeVanillaDefaultCfg(createVanillaDefaultCfgWithHardcodedDefaults());
    const lines = text.split('\n').slice(0, -1);
    for (const line of lines) {
      expect(line.charAt(29)).toBe(' ');
      expect(line.charAt(30)).toBe(' ');
      expect(line.length).toBeGreaterThan(30);
    }
  });

  test('integer values write as decimal with no 0x prefix and no sign for non-negative', () => {
    const text = writeVanillaDefaultCfg(createVanillaDefaultCfgWithHardcodedDefaults());
    expect(text.includes('0x')).toBe(false);
    expect(text.match(/\+\d/)).toBe(null);
  });

  test('chat macro values write surrounded by literal double quotes', () => {
    const text = writeVanillaDefaultCfg(createVanillaDefaultCfgWithHardcodedDefaults());
    expect(text.includes('chatmacro1                     "I\'m ready to kick butt!"')).toBe(true);
    expect(text.includes('chatmacro6                     "Next time, scumbag..."')).toBe(true);
  });
});
