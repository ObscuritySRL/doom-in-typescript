/**
 * Vanilla DOOM 1.9 screen-setting persistence contract.
 *
 * The vanilla `default.cfg` namespace exposes 4 screen-presentation
 * variables. From Chocolate Doom 2.2.1 m_misc.c doom_defaults_list and
 * the m_menu.c / r_main.c / am_map.c globals:
 *
 *   screenblocks     int  default 9   (r_main.c — screen size 3..11)
 *                                      3..10 windowed, 11 fullscreen-no-HUD,
 *                                      9 default = small status bar
 *   detaillevel      int  default 0   (r_main.c — 0 = high, 1 = low)
 *   show_messages    int  default 1   (m_menu.c — HUD message toggle)
 *   usegamma         int  default 0   (i_video.c — gamma index 0..4)
 *
 * Note: the modern screen presentation variables (`screen_width`,
 * `screen_height`, `screen_bpp`, `fullscreen`, `aspect_ratio_correct`,
 * `grabmouse`, `video_driver`, `window_position`) live in
 * `chocolate-doom.cfg`, NOT in this vanilla namespace. DOS DOOM had no
 * resolution choice (always 320x200 mode 13h); those variables were
 * added by Chocolate Doom for SDL host integration.
 *
 * Persistence format matches M_SaveDefaults: column-30 padded name,
 * single space, decimal value, LF terminator.
 */

import { formatVanillaConfigLine } from './persist-vanilla-key-bindings.ts';

export const VANILLA_SCREEN_SETTING_NAMES: readonly string[] = Object.freeze(['show_messages', 'screenblocks', 'detaillevel', 'usegamma']);

export const VANILLA_SCREENBLOCKS_MIN = 3;
export const VANILLA_SCREENBLOCKS_MAX = 11;
export const VANILLA_DETAIL_HIGH = 0;
export const VANILLA_DETAIL_LOW = 1;
export const VANILLA_GAMMA_LEVEL_COUNT = 5;
export const VANILLA_GAMMA_MIN = 0;
export const VANILLA_GAMMA_MAX = 4;

export const VANILLA_SCREEN_SETTING_DEFAULTS: ReadonlyMap<string, number> = Object.freeze(
  new Map<string, number>([
    ['show_messages', 1],
    ['screenblocks', 9],
    ['detaillevel', VANILLA_DETAIL_HIGH],
    ['usegamma', 0],
  ]),
);

export interface VanillaScreenSettings {
  readonly show_messages: number;
  readonly screenblocks: number;
  readonly detaillevel: number;
  readonly usegamma: number;
}

export function createDefaultVanillaScreenSettings(): VanillaScreenSettings {
  return Object.freeze({
    show_messages: 1,
    screenblocks: 9,
    detaillevel: VANILLA_DETAIL_HIGH,
    usegamma: 0,
  });
}

export function serializeVanillaScreenSettings(values: VanillaScreenSettings): string {
  return (
    formatVanillaConfigLine('show_messages', values.show_messages) +
    formatVanillaConfigLine('screenblocks', values.screenblocks) +
    formatVanillaConfigLine('detaillevel', values.detaillevel) +
    formatVanillaConfigLine('usegamma', values.usegamma)
  );
}
