import { describe, expect, test } from 'bun:test';

import { createDefaultVanillaChatMacros, formatVanillaChatMacroLine, serializeVanillaChatMacros, VANILLA_CHAT_MACRO_COUNT, VANILLA_CHAT_MACRO_DEFAULTS, VANILLA_CHAT_MACRO_NAMES } from '../../../src/config/persist-chat-macros.ts';

describe('vanilla DOOM 1.9 chat-macro persistence contract', () => {
  test('pins the 10 chatmacro variables (chatmacro0 .. chatmacro9)', () => {
    expect(VANILLA_CHAT_MACRO_COUNT).toBe(10);
    expect(VANILLA_CHAT_MACRO_NAMES.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(VANILLA_CHAT_MACRO_NAMES[i]).toBe(`chatmacro${i}`);
    }
  });

  test('pins the DOOM 1.9 default chat macro strings byte-for-byte', () => {
    expect(VANILLA_CHAT_MACRO_DEFAULTS.length).toBe(10);
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

  test('createDefaultVanillaChatMacros returns a frozen object with default strings', () => {
    const macros = createDefaultVanillaChatMacros();
    expect(Object.isFrozen(macros)).toBe(true);
    expect(macros.chatmacro0).toBe('No');
    expect(macros.chatmacro1).toBe("I'm ready to kick butt!");
    expect(macros.chatmacro8).toBe("I'll take care of it.");
    expect(macros.chatmacro9).toBe('Yes');
  });

  test('formats a chat macro line as name padded to column 30 with quoted value and LF terminator', () => {
    const line = formatVanillaChatMacroLine('chatmacro0', 'No');
    expect(line).toBe('chatmacro0                     "No"\n');
    expect(line.endsWith('\n')).toBe(true);
    expect(line.includes('\r')).toBe(false);
  });

  test('preserves apostrophes and ellipses in the quoted string body', () => {
    expect(formatVanillaChatMacroLine('chatmacro2', "I'm OK.")).toBe('chatmacro2                     "I\'m OK."\n');
    expect(formatVanillaChatMacroLine('chatmacro6', 'Next time, scumbag...')).toBe('chatmacro6                     "Next time, scumbag..."\n');
  });

  test('serializes defaults with all 10 macros wrapped in double quotes', () => {
    const text = serializeVanillaChatMacros(createDefaultVanillaChatMacros());
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBe(11);
    expect(lines[0]).toBe('chatmacro0                     "No"');
    expect(lines[1]).toBe('chatmacro1                     "I\'m ready to kick butt!"');
    expect(lines[6]).toBe('chatmacro6                     "Next time, scumbag..."');
    expect(lines[9]).toBe('chatmacro9                     "Yes"');
    expect(text.includes('\r')).toBe(false);
  });

  test('serializes user-customized macros byte-for-byte without escape processing', () => {
    const custom = {
      chatmacro0: 'Yes!',
      chatmacro1: 'attacking',
      chatmacro2: 'medkit?',
      chatmacro3: 'guarding',
      chatmacro4: 'flag captured',
      chatmacro5: 'enemy spotted',
      chatmacro6: 'retreat',
      chatmacro7: 'follow me',
      chatmacro8: 'on my way',
      chatmacro9: 'gg',
    };
    const text = serializeVanillaChatMacros(custom);
    expect(text.includes('"attacking"')).toBe(true);
    expect(text.includes('"flag captured"')).toBe(true);
    expect(text.includes('"gg"')).toBe(true);
  });
});
