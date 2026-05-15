/**
 * Vanilla DOOM 1.9 settings-menu → config wiring facade.
 *
 * Plan_final step `12-002` (lane: save-config-demo) connects the
 * Options / Sound / Screen settings menus to the vanilla config
 * persistence: sound, screen (including the messages toggle),
 * mouse, key-binding, chat-macro, and compatibility (extended host
 * cfg) settings.
 *
 * The read-only `src/config/*` persistence modules and
 * `src/ui/menus.ts` (the `MenuAction` settings vocabulary pinned by
 * `07-003`) already implement the per-piece behavior and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest binding each settings category to its
 * vanilla cfg variables.
 *
 * Six parity invariants this step pins:
 *
 *   1. Sound settings persist `sfx_volume` / `music_volume` clamped
 *      to `[VANILLA_SOUND_VOLUME_MIN, VANILLA_SOUND_VOLUME_MAX]` =
 *      `[0, 15]` plus the nine `snd_*` device/port variables, with
 *      device ids `VANILLA_SOUND_DEVICE_NONE` (0) … `_AWE32` (9).
 *   2. Screen settings persist `show_messages`, `screenblocks`
 *      (3…11), `detaillevel` (0 high / 1 low), and `usegamma`
 *      (0…4, 5 levels) — the messages toggle lives here.
 *   3. Mouse settings persist the five vanilla mouse cfg variables.
 *   4. Key bindings persist DOS scan codes for the ten vanilla
 *      action keys, formatted in the 30-column vanilla layout.
 *   5. Chat macros are exactly ten slots `chatmacro0…9`.
 *   6. Compatibility settings live in the extended host cfg
 *      (`HOST_EXTRA_CFG_VARIABLE_COUNT` variables), separate from
 *      the 43-variable vanilla default.cfg.
 *
 * @example
 * ```ts
 * import { createDefaultVanillaSoundSettings, serializeVanillaSoundSettings, VANILLA_SETTINGS_CONFIG_INVARIANTS } from './wireSettingsMenusToConfig.ts';
 * serializeVanillaSoundSettings(createDefaultVanillaSoundSettings()).length > 0; // true
 * VANILLA_SETTINGS_CONFIG_INVARIANTS.length;                                     // 6
 * ```
 */

export {
  VANILLA_SOUND_DEVICE_ADLIB,
  VANILLA_SOUND_DEVICE_AWE32,
  VANILLA_SOUND_DEVICE_GENMIDI,
  VANILLA_SOUND_DEVICE_GUS,
  VANILLA_SOUND_DEVICE_NONE,
  VANILLA_SOUND_DEVICE_PAS,
  VANILLA_SOUND_DEVICE_PCSPEAKER,
  VANILLA_SOUND_DEVICE_SOUNDBLASTER,
  VANILLA_SOUND_DEVICE_SOUNDCANVAS,
  VANILLA_SOUND_DEVICE_WAVEBLASTER,
  VANILLA_SOUND_SETTING_NAMES,
  VANILLA_SOUND_VOLUME_MAX,
  VANILLA_SOUND_VOLUME_MIN,
  createDefaultVanillaSoundSettings,
  serializeVanillaSoundSettings,
} from '../config/persist-sound-settings.ts';
export type { VanillaSoundSettings } from '../config/persist-sound-settings.ts';
export {
  VANILLA_DETAIL_HIGH,
  VANILLA_DETAIL_LOW,
  VANILLA_GAMMA_LEVEL_COUNT,
  VANILLA_GAMMA_MAX,
  VANILLA_GAMMA_MIN,
  VANILLA_SCREENBLOCKS_MAX,
  VANILLA_SCREENBLOCKS_MIN,
  VANILLA_SCREEN_SETTING_NAMES,
  createDefaultVanillaScreenSettings,
  serializeVanillaScreenSettings,
} from '../config/persist-screen-settings.ts';
export type { VanillaScreenSettings } from '../config/persist-screen-settings.ts';
export { VANILLA_MOUSE_SETTING_DEFAULTS, VANILLA_MOUSE_SETTING_NAMES, createDefaultVanillaMouseSettings, serializeVanillaMouseSettings } from '../config/persist-mouse-settings.ts';
export type { VanillaMouseSettings } from '../config/persist-mouse-settings.ts';
export {
  VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS,
  VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH,
  VANILLA_KEY_BINDING_NAMES,
  createDefaultVanillaKeyBindings,
  formatVanillaConfigLine,
  serializeVanillaKeyBindings,
} from '../config/persist-vanilla-key-bindings.ts';
export type { VanillaKeyBindingValues } from '../config/persist-vanilla-key-bindings.ts';
export { VANILLA_CHAT_MACRO_COUNT, VANILLA_CHAT_MACRO_DEFAULTS, VANILLA_CHAT_MACRO_NAMES, createDefaultVanillaChatMacros, formatVanillaChatMacroLine, serializeVanillaChatMacros } from '../config/persist-chat-macros.ts';
export type { VanillaChatMacros } from '../config/persist-chat-macros.ts';
export { HOST_EXTRA_CFG_VARIABLE_COUNT, createDefaultHostExtraCfg, parseHostExtraCfg } from '../config/hostConfig.ts';
export type { VanillaExtendedCfg } from '../config/hostConfig.ts';
export type { MenuAction } from '../ui/menus.ts';

/**
 * One pinned settings-menu / config parity invariant.
 */
export interface VanillaSettingsConfigInvariant {
  readonly id:
    | 'CHAT_MACROS_ARE_TEN_SLOTS_0_THROUGH_9'
    | 'COMPATIBILITY_SETTINGS_LIVE_IN_THE_EXTENDED_HOST_CFG'
    | 'KEY_BINDINGS_PERSIST_DOS_SCANCODES'
    | 'MOUSE_SETTINGS_MAP_TO_FIVE_VANILLA_MOUSE_VARIABLES'
    | 'SCREEN_SETTINGS_INCLUDE_MESSAGES_BLOCKS_DETAIL_GAMMA'
    | 'SOUND_SETTINGS_CLAMP_VOLUMES_0_15_WITH_DEVICE_IDS';
  readonly rule: string;
}

/**
 * Frozen manifest of the six settings-menu / config parity
 * invariants this step pins.  A later step that drives these
 * settings from the live menu input must preserve all six.
 */
export const VANILLA_SETTINGS_CONFIG_INVARIANTS: readonly VanillaSettingsConfigInvariant[] = Object.freeze([
  Object.freeze({
    id: 'CHAT_MACROS_ARE_TEN_SLOTS_0_THROUGH_9',
    rule: 'VANILLA_CHAT_MACRO_COUNT = 10; VANILLA_CHAT_MACRO_NAMES is the frozen ordered set chatmacro0..chatmacro9 with the vanilla default macro strings.',
  } satisfies VanillaSettingsConfigInvariant),
  Object.freeze({
    id: 'COMPATIBILITY_SETTINGS_LIVE_IN_THE_EXTENDED_HOST_CFG',
    rule: 'Compatibility / non-vanilla-default settings persist in the extended host cfg (HOST_EXTRA_CFG_VARIABLE_COUNT variables via createDefaultHostExtraCfg / parseHostExtraCfg), separate from the 43-variable vanilla default.cfg.',
  } satisfies VanillaSettingsConfigInvariant),
  Object.freeze({
    id: 'KEY_BINDINGS_PERSIST_DOS_SCANCODES',
    rule: 'The ten vanilla action keys (VANILLA_KEY_BINDING_NAMES) persist DOS scan codes (VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS) formatted in the VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH = 30 vanilla config layout.',
  } satisfies VanillaSettingsConfigInvariant),
  Object.freeze({
    id: 'MOUSE_SETTINGS_MAP_TO_FIVE_VANILLA_MOUSE_VARIABLES',
    rule: 'Mouse settings persist exactly the five vanilla mouse cfg variables (VANILLA_MOUSE_SETTING_NAMES) with their VANILLA_MOUSE_SETTING_DEFAULTS.',
  } satisfies VanillaSettingsConfigInvariant),
  Object.freeze({
    id: 'SCREEN_SETTINGS_INCLUDE_MESSAGES_BLOCKS_DETAIL_GAMMA',
    rule: 'Screen settings persist show_messages (the messages toggle), screenblocks (VANILLA_SCREENBLOCKS_MIN 3 .. MAX 11), detaillevel (VANILLA_DETAIL_HIGH 0 / LOW 1), and usegamma (VANILLA_GAMMA_MIN 0 .. MAX 4, VANILLA_GAMMA_LEVEL_COUNT 5).',
  } satisfies VanillaSettingsConfigInvariant),
  Object.freeze({
    id: 'SOUND_SETTINGS_CLAMP_VOLUMES_0_15_WITH_DEVICE_IDS',
    rule: 'Sound settings persist sfx_volume / music_volume clamped to [VANILLA_SOUND_VOLUME_MIN 0, VANILLA_SOUND_VOLUME_MAX 15] plus the snd_* device/port variables, device ids VANILLA_SOUND_DEVICE_NONE 0 .. VANILLA_SOUND_DEVICE_AWE32 9.',
  } satisfies VanillaSettingsConfigInvariant),
]);
