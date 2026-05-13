import { describe, expect, test } from 'bun:test';

import { createVanillaDefaultCfgWithHardcodedDefaults, parseVanillaDefaultCfg, VANILLA_DEFAULT_CFG_FILENAME, VANILLA_DEFAULT_CFG_VARIABLE_COUNT, VANILLA_DEFAULT_CFG_VARIABLE_NAMES } from '../../../src/config/parse-default-cfg.ts';

describe('vanilla DOOM 1.9 default.cfg parser contract', () => {
  test('pins the vanilla namespace at 43 disjoint variables', () => {
    expect(VANILLA_DEFAULT_CFG_VARIABLE_COUNT).toBe(43);
    expect(VANILLA_DEFAULT_CFG_VARIABLE_NAMES.length).toBe(43);
    expect(new Set(VANILLA_DEFAULT_CFG_VARIABLE_NAMES).size).toBe(43);
    expect(VANILLA_DEFAULT_CFG_FILENAME).toBe('default.cfg');
  });

  test('hardcoded defaults match Chocolate Doom 2.2.1 C-level globals', () => {
    const defaults = createVanillaDefaultCfgWithHardcodedDefaults();
    expect(defaults.mouse_sensitivity).toBe(5);
    expect(defaults.sfx_volume).toBe(8);
    expect(defaults.music_volume).toBe(8);
    expect(defaults.show_messages).toBe(1);
    expect(defaults.key_right).toBe(77);
    expect(defaults.key_fire).toBe(29);
    expect(defaults.key_use).toBe(57);
    expect(defaults.screenblocks).toBe(9);
    expect(defaults.detaillevel).toBe(0);
    expect(defaults.snd_channels).toBe(8);
    expect(defaults.usegamma).toBe(0);
    expect(defaults.chatmacro0).toBe('No');
    expect(defaults.chatmacro1).toBe("I'm ready to kick butt!");
  });

  test('parses canonical key<whitespace>value lines into typed values', () => {
    const content = 'mouse_sensitivity             7\nsfx_volume                    15\nkey_right                     77\nchatmacro1                    "Hello world"\n';
    const cfg = parseVanillaDefaultCfg(content);
    expect(cfg.mouse_sensitivity).toBe(7);
    expect(cfg.sfx_volume).toBe(15);
    expect(cfg.key_right).toBe(77);
    expect(cfg.chatmacro1).toBe('Hello world');
  });

  test('missing variables fall back to hardcoded defaults (M_LoadDefaults semantics)', () => {
    const cfg = parseVanillaDefaultCfg('mouse_sensitivity 10\n');
    expect(cfg.mouse_sensitivity).toBe(10);
    expect(cfg.sfx_volume).toBe(8);
    expect(cfg.music_volume).toBe(8);
    expect(cfg.chatmacro1).toBe("I'm ready to kick butt!");
  });

  test('unknown variables are silently ignored (Chocolate Doom M_LoadDefaultCollection)', () => {
    const cfg = parseVanillaDefaultCfg('some_unknown_variable 42\nsfx_volume 12\n');
    expect(cfg.sfx_volume).toBe(12);
    expect(Object.prototype.hasOwnProperty.call(cfg, 'some_unknown_variable')).toBe(false);
  });

  test('chat macro strings preserve apostrophes and punctuation runs byte-for-byte', () => {
    const content = ['chatmacro2                    "I\'m OK."', 'chatmacro6                    "Next time, scumbag..."', 'chatmacro8                    "I\'ll take care of it."', ''].join('\n');
    const cfg = parseVanillaDefaultCfg(content);
    expect(cfg.chatmacro2).toBe("I'm OK.");
    expect(cfg.chatmacro6).toBe('Next time, scumbag...');
    expect(cfg.chatmacro8).toBe("I'll take care of it.");
  });

  test('blank lines and CRLF line endings are tolerated', () => {
    const cfg = parseVanillaDefaultCfg('\r\nmouse_sensitivity 3\r\n\r\nsfx_volume 4\r\n');
    expect(cfg.mouse_sensitivity).toBe(3);
    expect(cfg.sfx_volume).toBe(4);
  });

  test('parses the reference doom/default.cfg sample without throwing', () => {
    const referenceText = [
      'mouse_sensitivity             5',
      'sfx_volume                    8',
      'music_volume                  8',
      'show_messages                 1',
      'key_right                     77',
      'key_left                      75',
      'key_up                        72',
      'key_down                      80',
      'key_strafeleft                51',
      'key_straferight               52',
      'key_fire                      29',
      'key_use                       57',
      'key_strafe                    56',
      'key_speed                     54',
      'use_mouse                     1',
      'mouseb_fire                   0',
      'mouseb_strafe                 1',
      'mouseb_forward                2',
      'use_joystick                  0',
      'joyb_fire                     0',
      'joyb_strafe                   1',
      'joyb_use                      3',
      'joyb_speed                    2',
      'screenblocks                  9',
      'detaillevel                   0',
      'snd_channels                  8',
      'snd_musicdevice               3',
      'snd_sfxdevice                 3',
      'snd_sbport                    0',
      'snd_sbirq                     0',
      'snd_sbdma                     0',
      'snd_mport                     0',
      'usegamma                      0',
      'chatmacro0                    "No"',
      'chatmacro1                    "I\'m ready to kick butt!"',
      'chatmacro2                    "I\'m OK."',
      'chatmacro3                    "I\'m not looking too good!"',
      'chatmacro4                    "Help!"',
      'chatmacro5                    "You suck!"',
      'chatmacro6                    "Next time, scumbag..."',
      'chatmacro7                    "Come here!"',
      'chatmacro8                    "I\'ll take care of it."',
      'chatmacro9                    "Yes"',
      '',
    ].join('\n');
    const cfg = parseVanillaDefaultCfg(referenceText);
    expect(cfg.key_right).toBe(77);
    expect(cfg.key_left).toBe(75);
    expect(cfg.snd_musicdevice).toBe(3);
    expect(cfg.chatmacro3).toBe("I'm not looking too good!");
    expect(cfg.chatmacro7).toBe('Come here!');
  });
});
