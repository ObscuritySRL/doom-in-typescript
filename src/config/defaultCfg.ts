/**
 * Vanilla Doom `default.cfg` parser.
 *
 * Chocolate Doom 2.2.1 keeps the original Doom config namespace
 * (`default.cfg`) disjoint from its own extended config
 * (`chocolate-doom.cfg`). The vanilla file ships with exactly 43 named
 * variables covering mouse / keyboard / joystick bindings, volumes,
 * screen presentation, sound hardware, gamma, and the ten chat macros.
 * This module surfaces those 43 variables as a strongly-typed object so
 * the bootstrap layer and later phases (audio, input, UI) can consume
 * the parsed result directly without string lookups.
 *
 * The module is a thin typed shell around the generic parser primitives
 * in `../bootstrap/config.ts` — it adds the variable inventory, the
 * hardcoded defaults from the Chocolate Doom C-level globals
 * (`g_game.c` key bindings, `m_menu.c` volumes, `r_main.c` screenblocks
 * / detaillevel, `i_sound.c` audio device defaults, `hu_stuff.c` chat
 * macros), and the `VanillaDefaultCfg` interface that keeps parsed
 * values addressable by field name.
 *
 * Parity-critical details preserved here:
 *
 *   - **43 variables, zero overlap with `chocolate-doom.cfg`**: the
 *     definition array length is locked to `DEFAULT_CFG_VARIABLE_COUNT`
 *     so a drifted inventory surfaces as a constant mismatch before any
 *     parser behavior changes.
 *   - **Key-binding units are DOS scan codes**: `key_right = 77` is
 *     `0x4D`, the BIOS scan code for Right-Arrow, not a Windows virtual
 *     key or an ASCII codepoint. The `vanilla_keyboard_mapping` flag in
 *     `chocolate-doom.cfg` governs whether Chocolate Doom converts these
 *     at load time — the vanilla parser itself preserves the integer
 *     verbatim.
 *   - **Defaults match the C-level initializers**: missing variables
 *     fall back to the values the Chocolate Doom globals are seeded with
 *     in source (e.g. `mouse_sensitivity = 5`, `sfx_volume = 8`,
 *     `music_volume = 8`), NOT the user-tuned values stored in the
 *     reference bundle. This keeps fresh-installation behavior byte
 *     identical to a vanilla `chocolate-doom` first-run.
 *   - **Chat macro quoting**: every `chatmacro` variable is serialized
 *     as a double-quoted string, including apostrophes (`"I'm OK."`)
 *     and punctuation runs (`"Next time, scumbag..."`). The generic
 *     `parseConfigValue` strips the quotes and returns the literal
 *     contents — a port that unescapes backslashes or collapses runs
 *     would desync chat messages against the reference.
 *   - **Unknown variables are silently ignored**, matching Chocolate
 *     Doom's `M_LoadDefaultCollection`. `default.cfg` files from
 *     Chocolate Doom 3.x or from source-port forks that add extended
 *     variables here will simply drop the unrecognized lines.
 *
 * @example
 * ```ts
 * import { parseDefaultCfg } from '../src/config/defaultCfg.ts';
 * const cfg = parseDefaultCfg(await Bun.file('default.cfg').text());
 * cfg.sfx_volume;   // 8
 * cfg.chatmacro1;   // "I'm ready to kick butt!"
 * cfg.key_fire;     // 29  (DOS scan code 0x1D, Right-Ctrl)
 * ```
 */

import type { ConfigDefinition } from '../bootstrap/config.ts';
import { buildDefinitionMap, parseConfigFileContent } from '../bootstrap/config.ts';

/** Number of variables in the vanilla Doom `default.cfg` namespace (F-022, F-065). */
export const DEFAULT_CFG_VARIABLE_COUNT = 43;

/**
 * Ordered definition list for every variable in the vanilla
 * `default.cfg` namespace. The order matches the reference bundle's
 * serialization order (mouse / volumes / messages / keys / mouse
 * buttons / joystick / display / sound / gamma / chat macros).
 *
 * Default values come from the Chocolate Doom 2.2.1 C-level globals,
 * not from the reference `default.cfg` file's stored user preferences.
 */
export const VANILLA_DEFAULT_CFG_DEFINITIONS: readonly ConfigDefinition[] = Object.freeze([
  Object.freeze({ name: 'mouse_sensitivity', type: 'integer', defaultValue: 5 }),
  Object.freeze({ name: 'sfx_volume', type: 'integer', defaultValue: 8 }),
  Object.freeze({ name: 'music_volume', type: 'integer', defaultValue: 8 }),
  Object.freeze({ name: 'show_messages', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'key_right', type: 'integer', defaultValue: 77 }),
  Object.freeze({ name: 'key_left', type: 'integer', defaultValue: 75 }),
  Object.freeze({ name: 'key_up', type: 'integer', defaultValue: 72 }),
  Object.freeze({ name: 'key_down', type: 'integer', defaultValue: 80 }),
  Object.freeze({ name: 'key_strafeleft', type: 'integer', defaultValue: 51 }),
  Object.freeze({ name: 'key_straferight', type: 'integer', defaultValue: 52 }),
  Object.freeze({ name: 'key_fire', type: 'integer', defaultValue: 29 }),
  Object.freeze({ name: 'key_use', type: 'integer', defaultValue: 57 }),
  Object.freeze({ name: 'key_strafe', type: 'integer', defaultValue: 56 }),
  Object.freeze({ name: 'key_speed', type: 'integer', defaultValue: 54 }),
  Object.freeze({ name: 'use_mouse', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'mouseb_fire', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'mouseb_strafe', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'mouseb_forward', type: 'integer', defaultValue: 2 }),
  Object.freeze({ name: 'use_joystick', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joyb_fire', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joyb_strafe', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'joyb_use', type: 'integer', defaultValue: 3 }),
  Object.freeze({ name: 'joyb_speed', type: 'integer', defaultValue: 2 }),
  Object.freeze({ name: 'screenblocks', type: 'integer', defaultValue: 9 }),
  Object.freeze({ name: 'detaillevel', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'snd_channels', type: 'integer', defaultValue: 8 }),
  Object.freeze({ name: 'snd_musicdevice', type: 'integer', defaultValue: 3 }),
  Object.freeze({ name: 'snd_sfxdevice', type: 'integer', defaultValue: 3 }),
  Object.freeze({ name: 'snd_sbport', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'snd_sbirq', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'snd_sbdma', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'snd_mport', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'usegamma', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'chatmacro0', type: 'string', defaultValue: 'No' }),
  Object.freeze({ name: 'chatmacro1', type: 'string', defaultValue: "I'm ready to kick butt!" }),
  Object.freeze({ name: 'chatmacro2', type: 'string', defaultValue: "I'm OK." }),
  Object.freeze({ name: 'chatmacro3', type: 'string', defaultValue: "I'm not looking too good!" }),
  Object.freeze({ name: 'chatmacro4', type: 'string', defaultValue: 'Help!' }),
  Object.freeze({ name: 'chatmacro5', type: 'string', defaultValue: 'You suck!' }),
  Object.freeze({ name: 'chatmacro6', type: 'string', defaultValue: 'Next time, scumbag...' }),
  Object.freeze({ name: 'chatmacro7', type: 'string', defaultValue: 'Come here!' }),
  Object.freeze({ name: 'chatmacro8', type: 'string', defaultValue: "I'll take care of it." }),
  Object.freeze({ name: 'chatmacro9', type: 'string', defaultValue: 'Yes' }),
]);

/**
 * Strongly-typed parsed `default.cfg` result. Field names match the
 * wire-format keys byte-for-byte and the field types mirror the
 * Chocolate Doom C-level types (`int` → `number`, `char*` → `string`).
 */
export interface VanillaDefaultCfg {
  readonly mouse_sensitivity: number;
  readonly sfx_volume: number;
  readonly music_volume: number;
  readonly show_messages: number;
  readonly key_right: number;
  readonly key_left: number;
  readonly key_up: number;
  readonly key_down: number;
  readonly key_strafeleft: number;
  readonly key_straferight: number;
  readonly key_fire: number;
  readonly key_use: number;
  readonly key_strafe: number;
  readonly key_speed: number;
  readonly use_mouse: number;
  readonly mouseb_fire: number;
  readonly mouseb_strafe: number;
  readonly mouseb_forward: number;
  readonly use_joystick: number;
  readonly joyb_fire: number;
  readonly joyb_strafe: number;
  readonly joyb_use: number;
  readonly joyb_speed: number;
  readonly screenblocks: number;
  readonly detaillevel: number;
  readonly snd_channels: number;
  readonly snd_musicdevice: number;
  readonly snd_sfxdevice: number;
  readonly snd_sbport: number;
  readonly snd_sbirq: number;
  readonly snd_sbdma: number;
  readonly snd_mport: number;
  readonly usegamma: number;
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

const VANILLA_DEFINITION_MAP = buildDefinitionMap(VANILLA_DEFAULT_CFG_DEFINITIONS);

/**
 * Return a frozen {@link VanillaDefaultCfg} seeded with the Chocolate
 * Doom C-level hardcoded defaults. Matches the runtime state reached
 * when `default.cfg` is missing and `M_LoadDefaults` retains every
 * global's initializer value.
 */
export function createDefaultVanillaCfg(): VanillaDefaultCfg {
  const seed: Record<string, number | string> = {};
  for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
    seed[definition.name] = definition.defaultValue;
  }
  return Object.freeze(seed) as unknown as VanillaDefaultCfg;
}

/**
 * Parse raw `default.cfg` text into a typed {@link VanillaDefaultCfg}.
 * Missing variables fall back to the hardcoded defaults from
 * {@link VANILLA_DEFAULT_CFG_DEFINITIONS}. Unknown variables in the
 * content are silently ignored, matching Chocolate Doom behavior.
 *
 * @param content - Raw UTF-8 text of a `default.cfg` file. Windows
 *                  (`\r\n`) and Unix (`\n`) line endings are both
 *                  accepted. Blank lines are skipped.
 */
export function parseDefaultCfg(content: string): VanillaDefaultCfg {
  const merged: Record<string, number | string> = {};
  for (const definition of VANILLA_DEFAULT_CFG_DEFINITIONS) {
    merged[definition.name] = definition.defaultValue;
  }
  const parsed = parseConfigFileContent(content, VANILLA_DEFINITION_MAP);
  for (const [name, value] of parsed) {
    merged[name] = value;
  }
  return Object.freeze(merged) as unknown as VanillaDefaultCfg;
}
