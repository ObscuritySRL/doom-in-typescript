/**
 * Vanilla DOOM 1.9 chat-macro storage contract for config compatibility.
 *
 * From Chocolate Doom 2.2.1 m_config.c default_t array and m_misc.c chat_macros[] array:
 *
 *   #define HUSTR_CHATMACRO0 "No"
 *   #define HUSTR_CHATMACRO1 "I'm ready to kick butt!"
 *   #define HUSTR_CHATMACRO2 "I'm OK."
 *   #define HUSTR_CHATMACRO3 "I'm not looking too good!"
 *   #define HUSTR_CHATMACRO4 "Help!"
 *   #define HUSTR_CHATMACRO5 "You suck!"
 *   #define HUSTR_CHATMACRO6 "Next time, scumbag..."
 *   #define HUSTR_CHATMACRO7 "Come here!"
 *   #define HUSTR_CHATMACRO8 "I'll take care of it."
 *   #define HUSTR_CHATMACRO9 "Yes"
 *
 *   char *chat_macros[10] =
 *   {
 *       HUSTR_CHATMACRO0,
 *       HUSTR_CHATMACRO1,
 *       ...,
 *       HUSTR_CHATMACRO9
 *   };
 *
 *   // Config entries: chatmacro0 ... chatmacro9 (string, defaults to HUSTR_CHATMACROn)
 *
 * Notes for parity:
 *   - 10 chat macros indexed 0..9.
 *   - Config keys are exactly `chatmacro0`..`chatmacro9` (all lowercase, no underscore).
 *   - Default values match the upstream HUSTR_CHATMACRO* preprocessor macros.
 *   - Macros are stored as strings in default.cfg / chocolate-doom.cfg.
 *   - Macros are stored AS-IS — the parser does not trim, quote, or escape spaces;
 *     trailing/leading whitespace is part of the macro content.
 */

export const VANILLA_CHAT_MACRO_COUNT = 10;

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

export function getVanillaChatMacroConfigKey(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= VANILLA_CHAT_MACRO_COUNT) {
    throw new RangeError(`chat macro index ${index} is out of range 0..${VANILLA_CHAT_MACRO_COUNT - 1}`);
  }
  return `chatmacro${index}`;
}

export function getVanillaChatMacroDefault(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= VANILLA_CHAT_MACRO_COUNT) {
    throw new RangeError(`chat macro index ${index} is out of range 0..${VANILLA_CHAT_MACRO_COUNT - 1}`);
  }
  return VANILLA_CHAT_MACRO_DEFAULTS[index]!;
}

export function listVanillaChatMacroConfigKeys(): readonly string[] {
  const keys: string[] = [];
  for (let i = 0; i < VANILLA_CHAT_MACRO_COUNT; i += 1) {
    keys.push(`chatmacro${i}`);
  }
  return Object.freeze(keys);
}
