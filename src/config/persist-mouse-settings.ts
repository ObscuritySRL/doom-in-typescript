/**
 * Vanilla DOOM 1.9 mouse-setting persistence contract.
 *
 * The vanilla `default.cfg` namespace exposes five mouse-related
 * variables. From Chocolate Doom 2.2.1 m_misc.c doom_defaults_list and
 * the g_game.c / i_input.c globals:
 *
 *   mouse_sensitivity   int   default 5      (g_game.c)
 *   use_mouse           int   default 1      (g_game.c)
 *   mouseb_fire         int   default 0      (i_input.c — left button)
 *   mouseb_strafe       int   default 1      (i_input.c — right button)
 *   mouseb_forward      int   default 2      (i_input.c — middle button)
 *
 * The `mouseb_*` integers encode physical mouse button indices (0-N).
 * They are NOT scan codes; the `-1` unbound sentinel that applies to
 * extended-namespace `mouseb_*` variables (mouseb_backward etc., in
 * chocolate-doom.cfg) is reserved for the extended namespace —
 * vanilla `mouseb_fire`/`_strafe`/`_forward` default to assigned
 * physical buttons so 0/1/2 are real button indices.
 *
 * Persistence format matches M_SaveDefaults: name left-padded to
 * column 30, one space separator, decimal value, single LF terminator.
 * Identical to the key-binding writer in
 * `./persist-vanilla-key-bindings.ts`.
 */

import { formatVanillaConfigLine } from './persist-vanilla-key-bindings.ts';

export const VANILLA_MOUSE_SETTING_NAMES: readonly string[] = Object.freeze(['mouse_sensitivity', 'use_mouse', 'mouseb_fire', 'mouseb_strafe', 'mouseb_forward']);

export const VANILLA_MOUSE_SETTING_DEFAULTS: ReadonlyMap<string, number> = Object.freeze(
  new Map<string, number>([
    ['mouse_sensitivity', 5],
    ['use_mouse', 1],
    ['mouseb_fire', 0],
    ['mouseb_strafe', 1],
    ['mouseb_forward', 2],
  ]),
);

export interface VanillaMouseSettings {
  readonly mouse_sensitivity: number;
  readonly use_mouse: number;
  readonly mouseb_fire: number;
  readonly mouseb_strafe: number;
  readonly mouseb_forward: number;
}

export function createDefaultVanillaMouseSettings(): VanillaMouseSettings {
  return Object.freeze({
    mouse_sensitivity: 5,
    use_mouse: 1,
    mouseb_fire: 0,
    mouseb_strafe: 1,
    mouseb_forward: 2,
  });
}

export function serializeVanillaMouseSettings(values: VanillaMouseSettings): string {
  return (
    formatVanillaConfigLine('mouse_sensitivity', values.mouse_sensitivity) +
    formatVanillaConfigLine('use_mouse', values.use_mouse) +
    formatVanillaConfigLine('mouseb_fire', values.mouseb_fire) +
    formatVanillaConfigLine('mouseb_strafe', values.mouseb_strafe) +
    formatVanillaConfigLine('mouseb_forward', values.mouseb_forward)
  );
}
