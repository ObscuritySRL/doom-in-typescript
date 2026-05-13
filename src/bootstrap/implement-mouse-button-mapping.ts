/**
 * Vanilla Chocolate Doom 2.2.1 mouse button mapping contract.
 *
 * Pins the mouseb_* defaults from default.cfg / chocolate-doom.cfg and the
 * mouse-button to gameplay-action lookup. Button indices match the SDL
 * mouse button convention (0=left, 1=right, 2=middle, 3=extra1, 4=extra2).
 * -1 means "unbound" (not present in the polled state).
 */

/** Canonical mouse button bindings from chocolate-doom.cfg / default.cfg. */
export const VANILLA_MOUSE_BUTTON_BINDINGS = Object.freeze({
  MOUSEB_BACKWARD: -1,
  MOUSEB_FIRE: 0,
  MOUSEB_FORWARD: 2,
  MOUSEB_NEXTWEAPON: -1,
  MOUSEB_PREVWEAPON: -1,
  MOUSEB_STRAFE: 1,
  MOUSEB_STRAFELEFT: -1,
  MOUSEB_STRAFERIGHT: -1,
  MOUSEB_USE: -1,
} as const);

/** Whether mouse-button rebinding is supported at runtime. Vanilla: yes via menu. */
export const VANILLA_MOUSE_BUTTONS_REBINDABLE_AT_RUNTIME = true;

/** Sentinel value indicating an unbound mouse button. */
export const VANILLA_MOUSEB_UNBOUND = -1;

/** Valid SDL mouse button range. */
export const VANILLA_MOUSEB_MIN = 0;
export const VANILLA_MOUSEB_MAX = 4;

export type MouseButtonName = keyof typeof VANILLA_MOUSE_BUTTON_BINDINGS;

export function lookupVanillaMouseButton(buttonName: MouseButtonName): number {
  return VANILLA_MOUSE_BUTTON_BINDINGS[buttonName];
}
