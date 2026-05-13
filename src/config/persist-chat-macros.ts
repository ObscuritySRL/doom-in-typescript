/**
 * Vanilla DOOM 1.9 chat-macro persistence contract.
 *
 * The vanilla `default.cfg` namespace ends with 10 chat-macro strings
 * (chatmacro0 .. chatmacro9). From Chocolate Doom 2.2.1 hu_stuff.c
 * HU_QueueChatChar and the m_misc.c doom_defaults_list:
 *
 *   chatmacro0  "No"
 *   chatmacro1  "I'm ready to kick butt!"
 *   chatmacro2  "I'm OK."
 *   chatmacro3  "I'm not looking too good!"
 *   chatmacro4  "Help!"
 *   chatmacro5  "You suck!"
 *   chatmacro6  "Next time, scumbag..."
 *   chatmacro7  "Come here!"
 *   chatmacro8  "I'll take care of it."
 *   chatmacro9  "Yes"
 *
 * Parity-critical details:
 *   - Each macro is sent as-is when the player presses Alt+0..9 in
 *     multiplayer. Apostrophes, exclamation marks, and ellipses are
 *     transmitted verbatim through the network protocol.
 *   - Persistence wraps each value in literal double quotes; no
 *     internal escape processing. A user who edits a macro to contain
 *     a `"` character would break the file — vanilla Chocolate Doom
 *     accepts that risk.
 *   - All 10 keys are written even when the user has not customized
 *     them — M_SaveDefaults walks the entire doom_defaults_list array
 *     unconditionally.
 *   - The 0-based name suffix (`chatmacro0`) matches the on-disk
 *     ordering. The first macro (`chatmacro0 "No"`) maps to the
 *     player's Alt+0 keystroke.
 */

import { VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH } from './persist-vanilla-key-bindings.ts';

export const VANILLA_CHAT_MACRO_COUNT = 10;

export const VANILLA_CHAT_MACRO_NAMES: readonly string[] = Object.freeze(['chatmacro0', 'chatmacro1', 'chatmacro2', 'chatmacro3', 'chatmacro4', 'chatmacro5', 'chatmacro6', 'chatmacro7', 'chatmacro8', 'chatmacro9']);

export const VANILLA_CHAT_MACRO_DEFAULTS: readonly string[] = Object.freeze([
  'No',
  "I'm ready to kick butt!",
  "I'm OK.",
  "I'm not looking too good!",
  'Help!',
  'You suck!',
  'Next time, scumbag...',
  'Come here!',
  "I'll take care of it.",
  'Yes',
]);

export interface VanillaChatMacros {
  readonly chatmacro0: string;
  readonly chatmacro1: string;
  readonly chatmacro2: string;
  readonly chatmacro3: string;
  readonly chatmacro4: string;
  readonly chatmacro5: string;
  readonly chatmacro6: string;
  readonly chatmacro7: string;
  readonly chatmacro8: string;
  readonly chatmacro9: string;
}

export function createDefaultVanillaChatMacros(): VanillaChatMacros {
  return Object.freeze({
    chatmacro0: VANILLA_CHAT_MACRO_DEFAULTS[0]!,
    chatmacro1: VANILLA_CHAT_MACRO_DEFAULTS[1]!,
    chatmacro2: VANILLA_CHAT_MACRO_DEFAULTS[2]!,
    chatmacro3: VANILLA_CHAT_MACRO_DEFAULTS[3]!,
    chatmacro4: VANILLA_CHAT_MACRO_DEFAULTS[4]!,
    chatmacro5: VANILLA_CHAT_MACRO_DEFAULTS[5]!,
    chatmacro6: VANILLA_CHAT_MACRO_DEFAULTS[6]!,
    chatmacro7: VANILLA_CHAT_MACRO_DEFAULTS[7]!,
    chatmacro8: VANILLA_CHAT_MACRO_DEFAULTS[8]!,
    chatmacro9: VANILLA_CHAT_MACRO_DEFAULTS[9]!,
  });
}

export function formatVanillaChatMacroLine(name: string, value: string): string {
  return `${name.padEnd(VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH, ' ')} "${value}"\n`;
}

export function serializeVanillaChatMacros(values: VanillaChatMacros): string {
  return (
    formatVanillaChatMacroLine('chatmacro0', values.chatmacro0) +
    formatVanillaChatMacroLine('chatmacro1', values.chatmacro1) +
    formatVanillaChatMacroLine('chatmacro2', values.chatmacro2) +
    formatVanillaChatMacroLine('chatmacro3', values.chatmacro3) +
    formatVanillaChatMacroLine('chatmacro4', values.chatmacro4) +
    formatVanillaChatMacroLine('chatmacro5', values.chatmacro5) +
    formatVanillaChatMacroLine('chatmacro6', values.chatmacro6) +
    formatVanillaChatMacroLine('chatmacro7', values.chatmacro7) +
    formatVanillaChatMacroLine('chatmacro8', values.chatmacro8) +
    formatVanillaChatMacroLine('chatmacro9', values.chatmacro9)
  );
}
