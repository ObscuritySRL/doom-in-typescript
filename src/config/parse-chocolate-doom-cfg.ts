/**
 * Chocolate Doom 2.2.1 `chocolate-doom.cfg` extended-config parser contract.
 *
 * From m_config.c M_LoadDefaults and the extra_defaults_list defined in
 * chocolate-doom.c plus the C-level globals seeded in i_video.c (screen
 * presentation), i_sound.c (snd_samplerate, opl_io_port, dmx), m_misc.c
 * (vanilla_*_limit toggles), i_input.c / i_joystick.c (mouseb_* /
 * joyb_* / joystick_*), and m_menu.c (key_menu_*).
 *
 * Parity-critical details:
 *   - 113 variables total in the extended namespace, disjoint from the
 *     43 vanilla `default.cfg` variables. The pair are intentionally
 *     non-overlapping per F-022 / F-065 — same-named entries between
 *     the two files would indicate a port that has corrupted the
 *     Chocolate Doom configuration split.
 *   - Floats use trailing-zero decimal format
 *     (`mouse_acceleration 2.000000`, `libsamplerate_scale 0.650000`).
 *     `parseFloat` accepts both compact and padded forms.
 *   - Hex integers carry the `0x` prefix (`opl_io_port 0x388` → 904).
 *   - The `-1` sentinel encodes "unbound" for `mouseb_*`, `joyb_*`,
 *     `joystick_index`, and joystick-axis assignments. `key_*` uses
 *     `0` for unbound to leave `-1` free for the same disconnected-axis
 *     semantics.
 *   - String variables (`player_name`, `video_driver`, `window_position`,
 *     `snd_musiccmd`, `snd_dmxoption`, `timidity_cfg_path`,
 *     `gus_patch_path`, `chatmacro*`) are surrounded by literal double
 *     quotes which the generic parser strips; no escape processing is
 *     performed.
 *   - `M_LoadDefaultCollection` silently ignores unknown variables.
 *     Chocolate Doom 3.x and source-port forks that add extra fields
 *     here drop them on load.
 */

import { createDefaultHostExtraCfg, HOST_EXTRA_CFG_VARIABLE_COUNT, parseHostExtraCfg, VANILLA_EXTENDED_CFG_DEFINITIONS, type VanillaExtendedCfg } from './hostConfig.ts';

export type VanillaExtendedCfgValues = VanillaExtendedCfg;

export const VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_COUNT = HOST_EXTRA_CFG_VARIABLE_COUNT;

export const VANILLA_CHOCOLATE_DOOM_CFG_FILENAME = 'chocolate-doom.cfg';

export const VANILLA_CHOCOLATE_DOOM_CFG_VARIABLE_NAMES: readonly string[] = Object.freeze(VANILLA_EXTENDED_CFG_DEFINITIONS.map((definition) => definition.name));

export function parseVanillaChocolateDoomCfg(content: string): VanillaExtendedCfg {
  return parseHostExtraCfg(content);
}

export function createVanillaChocolateDoomCfgWithHardcodedDefaults(): VanillaExtendedCfg {
  return createDefaultHostExtraCfg();
}
