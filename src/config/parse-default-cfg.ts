/**
 * Vanilla DOOM 1.9 `default.cfg` parser contract.
 *
 * From Chocolate Doom 2.2.1 m_config.c M_LoadDefaults plus the
 * `default.cfg` namespace defined by m_misc.c doom_defaults_list and
 * the C-level globals seeded in g_game.c (key bindings),
 * m_menu.c (volumes), r_main.c (screenblocks, detaillevel),
 * i_sound.c (snd_*), and hu_stuff.c (chatmacro*).
 *
 * Parity-critical details:
 *   - 43 variables total in the vanilla namespace, disjoint from
 *     `chocolate-doom.cfg`. The variable count is pinned by
 *     VANILLA_DEFAULT_CFG_VARIABLE_COUNT so any inventory drift fails
 *     before parse-time behavior changes.
 *   - Each line is `name<whitespace>value` per M_LoadDefaults; blank
 *     lines and unknown variable names are silently ignored.
 *   - Integers accept decimal and `0x` hex (e.g. `0x388`).
 *   - Strings are surrounded by literal double quotes; the quotes are
 *     stripped on read but no escape processing is performed, so
 *     apostrophes (`"I'm OK."`) and punctuation runs
 *     (`"Next time, scumbag..."`) survive byte-for-byte.
 *   - Key bindings are DOS BIOS scan codes (e.g. key_right=77 → 0x4D
 *     Right-Arrow). The parser preserves the integer verbatim; any
 *     translation to platform virtual keys happens later in the input
 *     subsystem under the chocolate-doom.cfg `vanilla_keyboard_mapping`
 *     flag.
 */

import { parseDefaultCfg, type VanillaDefaultCfg, VANILLA_DEFAULT_CFG_DEFINITIONS, DEFAULT_CFG_VARIABLE_COUNT, createDefaultVanillaCfg } from './defaultCfg.ts';

export type VanillaDefaultCfgValues = VanillaDefaultCfg;

export const VANILLA_DEFAULT_CFG_VARIABLE_COUNT = DEFAULT_CFG_VARIABLE_COUNT;

export const VANILLA_DEFAULT_CFG_FILENAME = 'default.cfg';

export const VANILLA_DEFAULT_CFG_VARIABLE_NAMES: readonly string[] = Object.freeze(VANILLA_DEFAULT_CFG_DEFINITIONS.map((definition) => definition.name));

export function parseVanillaDefaultCfg(content: string): VanillaDefaultCfg {
  return parseDefaultCfg(content);
}

export function createVanillaDefaultCfgWithHardcodedDefaults(): VanillaDefaultCfg {
  return createDefaultVanillaCfg();
}
