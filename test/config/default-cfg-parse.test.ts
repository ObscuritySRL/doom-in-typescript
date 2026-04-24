import { describe, expect, test } from 'bun:test';

import { createDefaultVanillaCfg, DEFAULT_CFG_VARIABLE_COUNT, parseDefaultCfg, VANILLA_DEFAULT_CFG_DEFINITIONS } from '../../src/config/defaultCfg.ts';
import type { VanillaDefaultCfg } from '../../src/config/defaultCfg.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';

const REFERENCE_DEFAULT_CFG_PATH = `${REFERENCE_BUNDLE_PATH}\\default.cfg`;

/** Expected reference-bundle `default.cfg` values (F-033, config-variable-summary.json). */
const REFERENCE_STORED_VALUES: Readonly<Record<string, number | string>> = Object.freeze({
  mouse_sensitivity: 5,
  sfx_volume: 8,
  music_volume: 8,
  show_messages: 1,
  key_right: 77,
  key_left: 75,
  key_up: 72,
  key_down: 80,
  key_strafeleft: 51,
  key_straferight: 52,
  key_fire: 29,
  key_use: 57,
  key_strafe: 56,
  key_speed: 54,
  use_mouse: 1,
  mouseb_fire: 0,
  mouseb_strafe: 1,
  mouseb_forward: 2,
  use_joystick: 0,
  joyb_fire: 0,
  joyb_strafe: 1,
  joyb_use: 3,
  joyb_speed: 2,
  screenblocks: 9,
  detaillevel: 0,
  snd_channels: 8,
  snd_musicdevice: 3,
  snd_sfxdevice: 3,
  snd_sbport: 0,
  snd_sbirq: 0,
  snd_sbdma: 0,
  snd_mport: 0,
  usegamma: 0,
  chatmacro0: 'No',
  chatmacro1: "I'm ready to kick butt!",
  chatmacro2: "I'm OK.",
  chatmacro3: "I'm not looking too good!",
  chatmacro4: 'Help!',
  chatmacro5: 'You suck!',
  chatmacro6: 'Next time, scumbag...',
  chatmacro7: 'Come here!',
  chatmacro8: "I'll take care of it.",
  chatmacro9: 'Yes',
});

describe('DEFAULT_CFG_VARIABLE_COUNT', () => {
  test('locks the vanilla namespace size at 43 variables (F-022)', () => {
    expect(DEFAULT_CFG_VARIABLE_COUNT).toBe(43);
  });

  test('matches the definition array length', () => {
    expect(VANILLA_DEFAULT_CFG_DEFINITIONS.length).toBe(DEFAULT_CFG_VARIABLE_COUNT);
  });
});

describe('VANILLA_DEFAULT_CFG_DEFINITIONS', () => {
  test('is a frozen array', () => {
    expect(Object.isFrozen(VANILLA_DEFAULT_CFG_DEFINITIONS)).toBe(true);
  });

  test('every definition is frozen', () => {
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });

  test('every name is unique', () => {
    const seen = new Set<string>();
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      expect(seen.has(definition.name)).toBe(false);
      seen.add(definition.name);
    }
    expect(seen.size).toBe(DEFAULT_CFG_VARIABLE_COUNT);
  });

  test('includes 33 integer variables and 10 string variables', () => {
    let integers = 0;
    let strings = 0;
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      if (definition.type === 'integer') integers++;
      else if (definition.type === 'string') strings++;
    }
    expect(integers).toBe(33);
    expect(strings).toBe(10);
  });

  test('contains exactly the 10 chatmacro variables', () => {
    const macros = VANILLA_DEFAULT_CFG_DEFINITIONS.filter((d) => d.name.startsWith('chatmacro'));
    expect(macros.length).toBe(10);
    for (const macro of macros) {
      expect(macro.type).toBe('string');
    }
    const macroNames = macros.map((d) => d.name).sort();
    expect(macroNames).toEqual(['chatmacro0', 'chatmacro1', 'chatmacro2', 'chatmacro3', 'chatmacro4', 'chatmacro5', 'chatmacro6', 'chatmacro7', 'chatmacro8', 'chatmacro9']);
  });

  test('ordering matches the reference bundle serialization order', () => {
    const orderedNames = VANILLA_DEFAULT_CFG_DEFINITIONS.map((d) => d.name);
    expect(orderedNames[0]).toBe('mouse_sensitivity');
    expect(orderedNames[1]).toBe('sfx_volume');
    expect(orderedNames[2]).toBe('music_volume');
    expect(orderedNames[3]).toBe('show_messages');
    expect(orderedNames[4]).toBe('key_right');
    expect(orderedNames[DEFAULT_CFG_VARIABLE_COUNT - 1]).toBe('chatmacro9');
  });

  test('every definition has a type matching the expected value shape', () => {
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      if (definition.type === 'integer') {
        expect(typeof definition.defaultValue).toBe('number');
        expect(Number.isInteger(definition.defaultValue as number)).toBe(true);
      } else if (definition.type === 'string') {
        expect(typeof definition.defaultValue).toBe('string');
      } else {
        throw new Error(`unexpected type ${definition.type} for ${definition.name}`);
      }
    }
  });
});

describe('createDefaultVanillaCfg', () => {
  test('returns a frozen object', () => {
    const cfg = createDefaultVanillaCfg();
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test('returns a new object on each call', () => {
    const a = createDefaultVanillaCfg();
    const b = createDefaultVanillaCfg();
    expect(a).not.toBe(b);
  });

  test('has every variable from the definitions', () => {
    const cfg = createDefaultVanillaCfg();
    const keys = Object.keys(cfg);
    expect(keys.length).toBe(DEFAULT_CFG_VARIABLE_COUNT);
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      expect(keys.includes(definition.name)).toBe(true);
    }
  });

  test('every field equals the C-level hardcoded default', () => {
    const cfg = createDefaultVanillaCfg();
    const indexed = cfg as unknown as Record<string, number | string>;
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      expect(indexed[definition.name]).toBe(definition.defaultValue);
    }
  });

  test('volumes default to 8, not 15', () => {
    const cfg = createDefaultVanillaCfg();
    expect(cfg.sfx_volume).toBe(8);
    expect(cfg.music_volume).toBe(8);
  });

  test('key bindings default to DOS scan codes', () => {
    const cfg = createDefaultVanillaCfg();
    expect(cfg.key_right).toBe(77);
    expect(cfg.key_left).toBe(75);
    expect(cfg.key_up).toBe(72);
    expect(cfg.key_down).toBe(80);
    expect(cfg.key_fire).toBe(29);
    expect(cfg.key_use).toBe(57);
    expect(cfg.key_strafe).toBe(56);
    expect(cfg.key_speed).toBe(54);
    expect(cfg.key_strafeleft).toBe(51);
    expect(cfg.key_straferight).toBe(52);
  });

  test('sound device defaults point to SoundBlaster (3)', () => {
    const cfg = createDefaultVanillaCfg();
    expect(cfg.snd_musicdevice).toBe(3);
    expect(cfg.snd_sfxdevice).toBe(3);
    expect(cfg.snd_channels).toBe(8);
  });

  test('chat macro 1 is the vanilla HUSTR_CHATMACRO1 string', () => {
    const cfg = createDefaultVanillaCfg();
    expect(cfg.chatmacro1).toBe("I'm ready to kick butt!");
  });
});

describe('parseDefaultCfg basic parsing', () => {
  test('parses a single-integer line and falls back on the rest', () => {
    const cfg = parseDefaultCfg('mouse_sensitivity 9\n');
    expect(cfg.mouse_sensitivity).toBe(9);
    expect(cfg.sfx_volume).toBe(8);
    expect(cfg.chatmacro0).toBe('No');
  });

  test('parses a single-string line with spaces and apostrophe', () => {
    const cfg = parseDefaultCfg('chatmacro1                    "Hello, world!"\n');
    expect(cfg.chatmacro1).toBe('Hello, world!');
  });

  test('returns a frozen object', () => {
    const cfg = parseDefaultCfg('');
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test('empty content returns the default cfg object', () => {
    const parsed = parseDefaultCfg('');
    const defaults = createDefaultVanillaCfg();
    for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
      const key = definition.name as keyof VanillaDefaultCfg;
      expect(parsed[key]).toBe(defaults[key]);
    }
  });

  test('silently ignores unknown variable lines', () => {
    const cfg = parseDefaultCfg('unknown_var 42\nsome_other_var "junk"\nmouse_sensitivity 7\n');
    expect(cfg.mouse_sensitivity).toBe(7);
    expect(Object.keys(cfg).length).toBe(DEFAULT_CFG_VARIABLE_COUNT);
    expect(Object.hasOwn(cfg, 'unknown_var')).toBe(false);
    expect(Object.hasOwn(cfg, 'some_other_var')).toBe(false);
  });

  test('handles Windows line endings', () => {
    const cfg = parseDefaultCfg('mouse_sensitivity 3\r\nsfx_volume 12\r\n');
    expect(cfg.mouse_sensitivity).toBe(3);
    expect(cfg.sfx_volume).toBe(12);
  });

  test('skips blank and whitespace-only lines', () => {
    const cfg = parseDefaultCfg('\n   \n\nmouse_sensitivity 4\n\n');
    expect(cfg.mouse_sensitivity).toBe(4);
  });

  test('later lines override earlier lines for the same variable', () => {
    const cfg = parseDefaultCfg('sfx_volume 3\nsfx_volume 11\n');
    expect(cfg.sfx_volume).toBe(11);
  });

  test('parses negative integers (unbound sentinel convention)', () => {
    const cfg = parseDefaultCfg('mouseb_fire -1\n');
    expect(cfg.mouseb_fire).toBe(-1);
  });

  test('parses zero integer', () => {
    const cfg = parseDefaultCfg('usegamma 0\n');
    expect(cfg.usegamma).toBe(0);
  });

  test('ignores a line that is only a variable name with no value', () => {
    const cfg = parseDefaultCfg('sfx_volume\nmouse_sensitivity 2\n');
    expect(cfg.sfx_volume).toBe(8);
    expect(cfg.mouse_sensitivity).toBe(2);
  });
});

describe('parseDefaultCfg type safety', () => {
  test('integer variables remain numbers even when typed via wide access', () => {
    const cfg = parseDefaultCfg('snd_channels 4\n');
    expect(typeof cfg.snd_channels).toBe('number');
  });

  test('string variables remain strings', () => {
    const cfg = parseDefaultCfg('chatmacro9 "Affirmative"\n');
    expect(typeof cfg.chatmacro9).toBe('string');
    expect(cfg.chatmacro9).toBe('Affirmative');
  });

  test('empty-quoted chat macro round-trips as empty string', () => {
    const cfg = parseDefaultCfg('chatmacro5 ""\n');
    expect(cfg.chatmacro5).toBe('');
  });
});

describe('parseDefaultCfg reference bundle', () => {
  test('parses the reference default.cfg exactly (F-033)', async () => {
    const content = await Bun.file(REFERENCE_DEFAULT_CFG_PATH).text();
    const cfg = parseDefaultCfg(content);
    const indexed = cfg as unknown as Record<string, number | string>;
    for (const [name, expected] of Object.entries(REFERENCE_STORED_VALUES)) {
      expect(indexed[name]).toBe(expected);
    }
  });

  test('reference file has 43 non-empty lines', async () => {
    const content = await Bun.file(REFERENCE_DEFAULT_CFG_PATH).text();
    const nonEmptyLines = content.split('\n').filter((line) => line.trim().length > 0);
    expect(nonEmptyLines.length).toBe(DEFAULT_CFG_VARIABLE_COUNT);
  });

  test('every reference line maps to a known definition', async () => {
    const content = await Bun.file(REFERENCE_DEFAULT_CFG_PATH).text();
    const names = new Set(VANILLA_DEFAULT_CFG_DEFINITIONS.map((d) => d.name));
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      const match = trimmed.match(/^(\S+)\s+(.+)$/);
      expect(match).not.toBeNull();
      expect(names.has(match![1]!)).toBe(true);
    }
  });
});

describe('parity-sensitive edge cases', () => {
  test('chat macros preserve apostrophes (quirk: vanilla "I\'m" ships literal)', () => {
    const cfg = parseDefaultCfg('chatmacro1 "I\'m ready to kick butt!"\nchatmacro2 "I\'m OK."\nchatmacro8 "I\'ll take care of it."\n');
    expect(cfg.chatmacro1).toBe("I'm ready to kick butt!");
    expect(cfg.chatmacro2).toBe("I'm OK.");
    expect(cfg.chatmacro8).toBe("I'll take care of it.");
  });

  test('chat macro 6 preserves the trailing ellipsis exactly', () => {
    const cfg = parseDefaultCfg('chatmacro6 "Next time, scumbag..."\n');
    expect(cfg.chatmacro6).toBe('Next time, scumbag...');
    expect(cfg.chatmacro6.endsWith('...')).toBe(true);
  });

  test('snd_sbport accepts both decimal 544 and hex 0x220 forms', () => {
    const decimal = parseDefaultCfg('snd_sbport 544\n');
    const hex = parseDefaultCfg('snd_sbport 0x220\n');
    expect(decimal.snd_sbport).toBe(544);
    expect(hex.snd_sbport).toBe(0x220);
    expect(decimal.snd_sbport).toBe(hex.snd_sbport);
  });

  test('vanilla reference stores 0 (not 0x220) for snd_sbport', async () => {
    const content = await Bun.file(REFERENCE_DEFAULT_CFG_PATH).text();
    const cfg = parseDefaultCfg(content);
    expect(cfg.snd_sbport).toBe(0);
  });

  test('key_use=57 is the DOS scan code for space, not ASCII 32', () => {
    const cfg = parseDefaultCfg('key_use 57\n');
    expect(cfg.key_use).toBe(57);
    expect(cfg.key_use).not.toBe(32);
  });

  test('defaults are NOT mutated when parseDefaultCfg is called', () => {
    const beforeDefault = createDefaultVanillaCfg();
    const beforeSfx = beforeDefault.sfx_volume;
    parseDefaultCfg('sfx_volume 1\n');
    const afterDefault = createDefaultVanillaCfg();
    expect(afterDefault.sfx_volume).toBe(beforeSfx);
    expect(afterDefault.sfx_volume).toBe(8);
  });

  test('definitions table is NOT mutated when parseDefaultCfg is called', () => {
    const snapshot = VANILLA_DEFAULT_CFG_DEFINITIONS.map((d) => `${d.name}|${d.type}|${d.defaultValue}`).join(';');
    parseDefaultCfg('sfx_volume 1\nchatmacro0 "Mutated"\n');
    const after = VANILLA_DEFAULT_CFG_DEFINITIONS.map((d) => `${d.name}|${d.type}|${d.defaultValue}`).join(';');
    expect(after).toBe(snapshot);
  });
});
