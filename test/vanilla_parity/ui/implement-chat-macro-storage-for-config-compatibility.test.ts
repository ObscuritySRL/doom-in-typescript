import { describe, expect, test } from 'bun:test';

import { VANILLA_CHAT_MACRO_COUNT, VANILLA_CHAT_MACRO_DEFAULTS, getVanillaChatMacroConfigKey, getVanillaChatMacroDefault, listVanillaChatMacroConfigKeys } from '../../../src/ui/implement-chat-macro-storage-for-config-compatibility.ts';

describe('VANILLA_CHAT_MACRO_DEFAULTS shape', () => {
  test('has exactly 10 macros', () => {
    expect(VANILLA_CHAT_MACRO_COUNT).toBe(10);
    expect(VANILLA_CHAT_MACRO_DEFAULTS.length).toBe(10);
  });

  test('matches upstream HUSTR_CHATMACRO* values in order', () => {
    expect(VANILLA_CHAT_MACRO_DEFAULTS[0]).toBe('No');
    expect(VANILLA_CHAT_MACRO_DEFAULTS[1]).toBe("I'm ready to kick butt!");
    expect(VANILLA_CHAT_MACRO_DEFAULTS[2]).toBe("I'm OK.");
    expect(VANILLA_CHAT_MACRO_DEFAULTS[3]).toBe("I'm not looking too good!");
    expect(VANILLA_CHAT_MACRO_DEFAULTS[4]).toBe('Help!');
    expect(VANILLA_CHAT_MACRO_DEFAULTS[5]).toBe('You suck!');
    expect(VANILLA_CHAT_MACRO_DEFAULTS[6]).toBe('Next time, scumbag...');
    expect(VANILLA_CHAT_MACRO_DEFAULTS[7]).toBe('Come here!');
    expect(VANILLA_CHAT_MACRO_DEFAULTS[8]).toBe("I'll take care of it.");
    expect(VANILLA_CHAT_MACRO_DEFAULTS[9]).toBe('Yes');
  });

  test('defaults array is frozen', () => {
    expect(Object.isFrozen(VANILLA_CHAT_MACRO_DEFAULTS)).toBe(true);
  });
});

describe('getVanillaChatMacroConfigKey', () => {
  test('returns chatmacroN (lowercase, no underscore) for valid indices', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(getVanillaChatMacroConfigKey(i)).toBe(`chatmacro${i}`);
    }
  });

  test('throws on negative index', () => {
    expect(() => getVanillaChatMacroConfigKey(-1)).toThrow(RangeError);
  });

  test('throws on index >= 10', () => {
    expect(() => getVanillaChatMacroConfigKey(10)).toThrow(RangeError);
    expect(() => getVanillaChatMacroConfigKey(100)).toThrow(RangeError);
  });

  test('throws on non-integer index', () => {
    expect(() => getVanillaChatMacroConfigKey(1.5)).toThrow(RangeError);
  });
});

describe('getVanillaChatMacroDefault', () => {
  test('returns expected default for each index', () => {
    expect(getVanillaChatMacroDefault(0)).toBe('No');
    expect(getVanillaChatMacroDefault(9)).toBe('Yes');
  });

  test('throws on out-of-range index', () => {
    expect(() => getVanillaChatMacroDefault(-1)).toThrow(RangeError);
    expect(() => getVanillaChatMacroDefault(10)).toThrow(RangeError);
  });
});

describe('listVanillaChatMacroConfigKeys', () => {
  test('returns chatmacro0..chatmacro9 in order', () => {
    const keys = listVanillaChatMacroConfigKeys();
    expect(keys.length).toBe(10);
    expect([...keys]).toEqual(['chatmacro0', 'chatmacro1', 'chatmacro2', 'chatmacro3', 'chatmacro4', 'chatmacro5', 'chatmacro6', 'chatmacro7', 'chatmacro8', 'chatmacro9']);
  });

  test('returned array is frozen', () => {
    expect(Object.isFrozen(listVanillaChatMacroConfigKeys())).toBe(true);
  });
});
