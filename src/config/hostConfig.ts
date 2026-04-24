/**
 * Chocolate Doom `chocolate-doom.cfg` extended host config parser.
 *
 * Chocolate Doom 2.2.1 splits its runtime configuration across two
 * disjoint namespaces. The vanilla namespace (`default.cfg`, 43
 * variables, covered by `./defaultCfg.ts`) preserves the original
 * Doom config layout byte-for-byte. The *extended* namespace
 * (`chocolate-doom.cfg`, 113 variables) holds everything the port
 * added on top — video presentation (screen_width / aspect_ratio_correct
 * / fullscreen), host audio (snd_samplerate / opl_io_port / snd_dmxoption),
 * modern input (mouseb_backward / joystick_physical_button0..9 /
 * key_menu_activate / key_map_follow), joystick axis/button mappings,
 * and the three `vanilla_*` compatibility toggles.
 *
 * The two files have **zero overlap** — a variable name in one is not
 * in the other. That disjoint-namespace invariant is locked by
 * `F-022 / F-065` and is asserted by the namespace-intersection test
 * in this module's test suite.
 *
 * This module is a thin typed shell around the generic parser primitives
 * in `../bootstrap/config.ts` — it adds the 113-variable inventory, the
 * hardcoded defaults from the Chocolate Doom C-level globals
 * (`m_config.c` / `chocolate_doom.c`), and the `VanillaExtendedCfg`
 * interface that keeps parsed values addressable by field name.
 *
 * Parity-critical details preserved here:
 *
 *   - **113 variables, zero overlap with `default.cfg`**: the
 *     definition array length is locked to `HOST_EXTRA_CFG_VARIABLE_COUNT`
 *     so a drifted inventory surfaces as a constant mismatch before any
 *     parser behavior changes.
 *   - **Key-binding units are DOS scan codes** matching vanilla's
 *     convention — `key_menu_up = 72` is `0x48` (up-arrow scan), NOT a
 *     Windows virtual key or an ASCII codepoint. The
 *     `vanilla_keyboard_mapping` flag governs whether Chocolate Doom
 *     converts these at load time; the parser itself preserves the
 *     integer verbatim.
 *   - **Unbound sentinel is `-1`** for `joyb_*`, `mouseb_*`, and some
 *     `joystick_*` axes. `key_*` variables use `0` for "unbound" while
 *     `-1` is reserved for `joystick_index` and the joystick axis
 *     assignments that can be physically disconnected.
 *   - **Float variables use trailing-zero decimal format**:
 *     `mouse_acceleration = 2.000000` and `libsamplerate_scale = 0.650000`
 *     in the reference file. The generic `parseConfigValue` float path
 *     uses `parseFloat` which accepts both forms.
 *   - **Hex-form integers** are preserved through `parseInt(raw, 16)`
 *     when the value starts with `0x` or `0X`: `opl_io_port = 0x388`
 *     round-trips to the numeric value 904. The reference file writes
 *     `opl_io_port` in hex; other `snd_sb*` variables in `default.cfg`
 *     are stored in decimal.
 *   - **Runtime-dependent defaults for `player_name` and screen
 *     dimensions**: the C-level initializers are `""` for `player_name`
 *     (populated by `I_GetUserName` before the first save) and `0` for
 *     `screen_width` / `screen_height` / `screen_bpp` (populated by
 *     `I_InitGraphics` auto-detect before the first save). The reference
 *     file captures the post-autoadjust values (`640`/`480`/`32` and
 *     `"stevp"`) which differ from the pristine C-level defaults — this
 *     is expected, and the parser correctly layers the file values on
 *     top of the pristine defaults.
 *   - **Unknown variables are silently ignored**, matching Chocolate
 *     Doom's `M_LoadDefaultCollection`.
 *
 * @example
 * ```ts
 * import { parseHostExtraCfg } from '../src/config/hostConfig.ts';
 * const cfg = parseHostExtraCfg(await Bun.file('chocolate-doom.cfg').text());
 * cfg.snd_samplerate;            // 44100
 * cfg.opl_io_port;               // 904  (0x388)
 * cfg.vanilla_keyboard_mapping;  // 1
 * cfg.key_menu_activate;         // 1    (Esc scan code)
 * ```
 */

import type { ConfigDefinition } from '../bootstrap/config.ts';
import { buildDefinitionMap, parseConfigFileContent } from '../bootstrap/config.ts';

/** Number of variables in the Chocolate Doom extended config namespace (F-022, F-065). */
export const HOST_EXTRA_CFG_VARIABLE_COUNT = 113;

/**
 * Ordered definition list for every variable in the Chocolate Doom
 * extended `chocolate-doom.cfg` namespace. The order matches the
 * reference bundle's serialization order (video → audio → input →
 * joystick → mouse → keyboard).
 *
 * Default values come from the Chocolate Doom 2.2.1 C-level globals.
 * For variables whose canonical C-level default is the pre-autoadjust
 * "auto-detect" sentinel (`screen_width`, `screen_height`, `screen_bpp`)
 * or the runtime-populated empty string (`player_name`), the defaults
 * here are the pristine C-level values — NOT the post-autoadjust values
 * the reference file captures.
 */
export const VANILLA_EXTENDED_CFG_DEFINITIONS: readonly ConfigDefinition[] = Object.freeze([
  Object.freeze({ name: 'autoadjust_video_settings', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'fullscreen', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'aspect_ratio_correct', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'startup_delay', type: 'integer', defaultValue: 1000 }),
  Object.freeze({ name: 'screen_width', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'screen_height', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'screen_bpp', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'grabmouse', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'novert', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'mouse_acceleration', type: 'float', defaultValue: 2.0 }),
  Object.freeze({ name: 'mouse_threshold', type: 'integer', defaultValue: 10 }),
  Object.freeze({ name: 'snd_samplerate', type: 'integer', defaultValue: 44100 }),
  Object.freeze({ name: 'snd_cachesize', type: 'integer', defaultValue: 67108864 }),
  Object.freeze({ name: 'snd_maxslicetime_ms', type: 'integer', defaultValue: 28 }),
  Object.freeze({ name: 'snd_musiccmd', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'snd_dmxoption', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'opl_io_port', type: 'integer', defaultValue: 0x388 }),
  Object.freeze({ name: 'show_endoom', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'png_screenshots', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'vanilla_savegame_limit', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'vanilla_demo_limit', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'vanilla_keyboard_mapping', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'video_driver', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'window_position', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'player_name', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'joystick_index', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'joystick_x_axis', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joystick_x_invert', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joystick_y_axis', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'joystick_y_invert', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joystick_strafe_axis', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'joystick_strafe_invert', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joystick_physical_button0', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'joystick_physical_button1', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'joystick_physical_button2', type: 'integer', defaultValue: 2 }),
  Object.freeze({ name: 'joystick_physical_button3', type: 'integer', defaultValue: 3 }),
  Object.freeze({ name: 'joystick_physical_button4', type: 'integer', defaultValue: 4 }),
  Object.freeze({ name: 'joystick_physical_button5', type: 'integer', defaultValue: 5 }),
  Object.freeze({ name: 'joystick_physical_button6', type: 'integer', defaultValue: 6 }),
  Object.freeze({ name: 'joystick_physical_button7', type: 'integer', defaultValue: 7 }),
  Object.freeze({ name: 'joystick_physical_button8', type: 'integer', defaultValue: 8 }),
  Object.freeze({ name: 'joystick_physical_button9', type: 'integer', defaultValue: 9 }),
  Object.freeze({ name: 'joyb_strafeleft', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'joyb_straferight', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'joyb_menu_activate', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'joyb_prevweapon', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'joyb_nextweapon', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'mouseb_strafeleft', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'mouseb_straferight', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'mouseb_use', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'mouseb_backward', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'mouseb_prevweapon', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'mouseb_nextweapon', type: 'integer', defaultValue: -1 }),
  Object.freeze({ name: 'dclick_use', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'use_libsamplerate', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'libsamplerate_scale', type: 'float', defaultValue: 0.65 }),
  Object.freeze({ name: 'timidity_cfg_path', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'gus_patch_path', type: 'string', defaultValue: '' }),
  Object.freeze({ name: 'gus_ram_kb', type: 'integer', defaultValue: 1024 }),
  Object.freeze({ name: 'key_pause', type: 'integer', defaultValue: 69 }),
  Object.freeze({ name: 'key_menu_activate', type: 'integer', defaultValue: 1 }),
  Object.freeze({ name: 'key_menu_up', type: 'integer', defaultValue: 72 }),
  Object.freeze({ name: 'key_menu_down', type: 'integer', defaultValue: 80 }),
  Object.freeze({ name: 'key_menu_left', type: 'integer', defaultValue: 75 }),
  Object.freeze({ name: 'key_menu_right', type: 'integer', defaultValue: 77 }),
  Object.freeze({ name: 'key_menu_back', type: 'integer', defaultValue: 14 }),
  Object.freeze({ name: 'key_menu_forward', type: 'integer', defaultValue: 28 }),
  Object.freeze({ name: 'key_menu_confirm', type: 'integer', defaultValue: 21 }),
  Object.freeze({ name: 'key_menu_abort', type: 'integer', defaultValue: 49 }),
  Object.freeze({ name: 'key_menu_help', type: 'integer', defaultValue: 59 }),
  Object.freeze({ name: 'key_menu_save', type: 'integer', defaultValue: 60 }),
  Object.freeze({ name: 'key_menu_load', type: 'integer', defaultValue: 61 }),
  Object.freeze({ name: 'key_menu_volume', type: 'integer', defaultValue: 62 }),
  Object.freeze({ name: 'key_menu_detail', type: 'integer', defaultValue: 63 }),
  Object.freeze({ name: 'key_menu_qsave', type: 'integer', defaultValue: 64 }),
  Object.freeze({ name: 'key_menu_endgame', type: 'integer', defaultValue: 65 }),
  Object.freeze({ name: 'key_menu_messages', type: 'integer', defaultValue: 66 }),
  Object.freeze({ name: 'key_menu_qload', type: 'integer', defaultValue: 67 }),
  Object.freeze({ name: 'key_menu_quit', type: 'integer', defaultValue: 68 }),
  Object.freeze({ name: 'key_menu_gamma', type: 'integer', defaultValue: 87 }),
  Object.freeze({ name: 'key_spy', type: 'integer', defaultValue: 88 }),
  Object.freeze({ name: 'key_menu_incscreen', type: 'integer', defaultValue: 13 }),
  Object.freeze({ name: 'key_menu_decscreen', type: 'integer', defaultValue: 12 }),
  Object.freeze({ name: 'key_menu_screenshot', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'key_map_toggle', type: 'integer', defaultValue: 15 }),
  Object.freeze({ name: 'key_map_north', type: 'integer', defaultValue: 72 }),
  Object.freeze({ name: 'key_map_south', type: 'integer', defaultValue: 80 }),
  Object.freeze({ name: 'key_map_east', type: 'integer', defaultValue: 77 }),
  Object.freeze({ name: 'key_map_west', type: 'integer', defaultValue: 75 }),
  Object.freeze({ name: 'key_map_zoomin', type: 'integer', defaultValue: 13 }),
  Object.freeze({ name: 'key_map_zoomout', type: 'integer', defaultValue: 12 }),
  Object.freeze({ name: 'key_map_maxzoom', type: 'integer', defaultValue: 11 }),
  Object.freeze({ name: 'key_map_follow', type: 'integer', defaultValue: 33 }),
  Object.freeze({ name: 'key_map_grid', type: 'integer', defaultValue: 34 }),
  Object.freeze({ name: 'key_map_mark', type: 'integer', defaultValue: 50 }),
  Object.freeze({ name: 'key_map_clearmark', type: 'integer', defaultValue: 46 }),
  Object.freeze({ name: 'key_weapon1', type: 'integer', defaultValue: 2 }),
  Object.freeze({ name: 'key_weapon2', type: 'integer', defaultValue: 3 }),
  Object.freeze({ name: 'key_weapon3', type: 'integer', defaultValue: 4 }),
  Object.freeze({ name: 'key_weapon4', type: 'integer', defaultValue: 5 }),
  Object.freeze({ name: 'key_weapon5', type: 'integer', defaultValue: 6 }),
  Object.freeze({ name: 'key_weapon6', type: 'integer', defaultValue: 7 }),
  Object.freeze({ name: 'key_weapon7', type: 'integer', defaultValue: 8 }),
  Object.freeze({ name: 'key_weapon8', type: 'integer', defaultValue: 9 }),
  Object.freeze({ name: 'key_prevweapon', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'key_nextweapon', type: 'integer', defaultValue: 0 }),
  Object.freeze({ name: 'key_message_refresh', type: 'integer', defaultValue: 28 }),
  Object.freeze({ name: 'key_demo_quit', type: 'integer', defaultValue: 16 }),
  Object.freeze({ name: 'key_multi_msg', type: 'integer', defaultValue: 20 }),
  Object.freeze({ name: 'key_multi_msgplayer1', type: 'integer', defaultValue: 34 }),
  Object.freeze({ name: 'key_multi_msgplayer2', type: 'integer', defaultValue: 23 }),
  Object.freeze({ name: 'key_multi_msgplayer3', type: 'integer', defaultValue: 48 }),
  Object.freeze({ name: 'key_multi_msgplayer4', type: 'integer', defaultValue: 19 }),
]);

/**
 * Strongly-typed parsed `chocolate-doom.cfg` result. Field names match
 * the wire-format keys byte-for-byte and the field types mirror the
 * Chocolate Doom C-level types (`int` → `number`, `float` → `number`,
 * `char*` → `string`).
 */
export interface VanillaExtendedCfg {
  readonly autoadjust_video_settings: number;
  readonly fullscreen: number;
  readonly aspect_ratio_correct: number;
  readonly startup_delay: number;
  readonly screen_width: number;
  readonly screen_height: number;
  readonly screen_bpp: number;
  readonly grabmouse: number;
  readonly novert: number;
  readonly mouse_acceleration: number;
  readonly mouse_threshold: number;
  readonly snd_samplerate: number;
  readonly snd_cachesize: number;
  readonly snd_maxslicetime_ms: number;
  readonly snd_musiccmd: string;
  readonly snd_dmxoption: string;
  readonly opl_io_port: number;
  readonly show_endoom: number;
  readonly png_screenshots: number;
  readonly vanilla_savegame_limit: number;
  readonly vanilla_demo_limit: number;
  readonly vanilla_keyboard_mapping: number;
  readonly video_driver: string;
  readonly window_position: string;
  readonly player_name: string;
  readonly joystick_index: number;
  readonly joystick_x_axis: number;
  readonly joystick_x_invert: number;
  readonly joystick_y_axis: number;
  readonly joystick_y_invert: number;
  readonly joystick_strafe_axis: number;
  readonly joystick_strafe_invert: number;
  readonly joystick_physical_button0: number;
  readonly joystick_physical_button1: number;
  readonly joystick_physical_button2: number;
  readonly joystick_physical_button3: number;
  readonly joystick_physical_button4: number;
  readonly joystick_physical_button5: number;
  readonly joystick_physical_button6: number;
  readonly joystick_physical_button7: number;
  readonly joystick_physical_button8: number;
  readonly joystick_physical_button9: number;
  readonly joyb_strafeleft: number;
  readonly joyb_straferight: number;
  readonly joyb_menu_activate: number;
  readonly joyb_prevweapon: number;
  readonly joyb_nextweapon: number;
  readonly mouseb_strafeleft: number;
  readonly mouseb_straferight: number;
  readonly mouseb_use: number;
  readonly mouseb_backward: number;
  readonly mouseb_prevweapon: number;
  readonly mouseb_nextweapon: number;
  readonly dclick_use: number;
  readonly use_libsamplerate: number;
  readonly libsamplerate_scale: number;
  readonly timidity_cfg_path: string;
  readonly gus_patch_path: string;
  readonly gus_ram_kb: number;
  readonly key_pause: number;
  readonly key_menu_activate: number;
  readonly key_menu_up: number;
  readonly key_menu_down: number;
  readonly key_menu_left: number;
  readonly key_menu_right: number;
  readonly key_menu_back: number;
  readonly key_menu_forward: number;
  readonly key_menu_confirm: number;
  readonly key_menu_abort: number;
  readonly key_menu_help: number;
  readonly key_menu_save: number;
  readonly key_menu_load: number;
  readonly key_menu_volume: number;
  readonly key_menu_detail: number;
  readonly key_menu_qsave: number;
  readonly key_menu_endgame: number;
  readonly key_menu_messages: number;
  readonly key_menu_qload: number;
  readonly key_menu_quit: number;
  readonly key_menu_gamma: number;
  readonly key_spy: number;
  readonly key_menu_incscreen: number;
  readonly key_menu_decscreen: number;
  readonly key_menu_screenshot: number;
  readonly key_map_toggle: number;
  readonly key_map_north: number;
  readonly key_map_south: number;
  readonly key_map_east: number;
  readonly key_map_west: number;
  readonly key_map_zoomin: number;
  readonly key_map_zoomout: number;
  readonly key_map_maxzoom: number;
  readonly key_map_follow: number;
  readonly key_map_grid: number;
  readonly key_map_mark: number;
  readonly key_map_clearmark: number;
  readonly key_weapon1: number;
  readonly key_weapon2: number;
  readonly key_weapon3: number;
  readonly key_weapon4: number;
  readonly key_weapon5: number;
  readonly key_weapon6: number;
  readonly key_weapon7: number;
  readonly key_weapon8: number;
  readonly key_prevweapon: number;
  readonly key_nextweapon: number;
  readonly key_message_refresh: number;
  readonly key_demo_quit: number;
  readonly key_multi_msg: number;
  readonly key_multi_msgplayer1: number;
  readonly key_multi_msgplayer2: number;
  readonly key_multi_msgplayer3: number;
  readonly key_multi_msgplayer4: number;
}

type MutableVanillaExtendedCfg = {
  -readonly [Key in keyof VanillaExtendedCfg]: VanillaExtendedCfg[Key];
};

const EXTENDED_DEFINITION_MAP = buildDefinitionMap(VANILLA_EXTENDED_CFG_DEFINITIONS);

function assertVanillaExtendedCfg(value: Record<string, number | string>): asserts value is MutableVanillaExtendedCfg {
  const keys = Object.keys(value);

  if (keys.length !== HOST_EXTRA_CFG_VARIABLE_COUNT) {
    throw new Error(`expected ${HOST_EXTRA_CFG_VARIABLE_COUNT} host config variables, got ${keys.length}`);
  }

  for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
    if (!Object.hasOwn(value, definition.name)) {
      throw new Error(`missing host config variable ${definition.name}`);
    }

    const parsedValue = value[definition.name];

    if (definition.type === 'string') {
      if (typeof parsedValue !== 'string') {
        throw new Error(`expected string host config variable ${definition.name}`);
      }

      continue;
    }

    if (typeof parsedValue !== 'number') {
      throw new Error(`expected numeric host config variable ${definition.name}`);
    }
  }
}

/**
 * Return a frozen {@link VanillaExtendedCfg} seeded with the Chocolate
 * Doom C-level hardcoded defaults. Matches the runtime state reached
 * when `chocolate-doom.cfg` is missing and `M_LoadDefaults` retains
 * every global's initializer value.
 */
export function createDefaultHostExtraCfg(): VanillaExtendedCfg {
  const seed: Record<string, number | string> = {};
  for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
    seed[definition.name] = definition.defaultValue;
  }
  assertVanillaExtendedCfg(seed);
  const frozenSeed: VanillaExtendedCfg = Object.freeze(seed);
  return frozenSeed;
}

/**
 * Parse raw `chocolate-doom.cfg` text into a typed
 * {@link VanillaExtendedCfg}. Missing variables fall back to the
 * hardcoded defaults from {@link VANILLA_EXTENDED_CFG_DEFINITIONS}.
 * Unknown variables in the content are silently ignored, matching
 * Chocolate Doom behavior.
 *
 * @param content - Raw UTF-8 text of a `chocolate-doom.cfg` file.
 *                  Windows (`\r\n`) and Unix (`\n`) line endings are
 *                  both accepted. Blank lines are skipped.
 */
export function parseHostExtraCfg(content: string): VanillaExtendedCfg {
  const merged: Record<string, number | string> = {};
  for (const definition of VANILLA_EXTENDED_CFG_DEFINITIONS) {
    merged[definition.name] = definition.defaultValue;
  }
  const parsed = parseConfigFileContent(content, EXTENDED_DEFINITION_MAP);
  for (const [name, value] of parsed) {
    merged[name] = value;
  }
  assertVanillaExtendedCfg(merged);
  const frozenMerged: VanillaExtendedCfg = Object.freeze(merged);
  return frozenMerged;
}
