/**
 * Vanilla Chocolate Doom 2.2.1 gameplay key mapping contract sourced from default.cfg.
 *
 * Pins each gameplay `key_*` value to its DOS scan-code default. The gameplay
 * key handler (g_game.c::G_Responder) reads these at config-load time and never
 * re-reads them during the run; subsequent host wiring must source the same defaults.
 */

/** Canonical gameplay key scan codes from default.cfg key_* defaults. */
export const VANILLA_GAMEPLAY_KEY_SCAN_CODES = Object.freeze({
  KEY_DOWN: 80,
  KEY_FIRE: 29,
  KEY_LEFT: 75,
  KEY_RIGHT: 77,
  KEY_SPEED: 54,
  KEY_STRAFE: 56,
  KEY_STRAFELEFT: 51,
  KEY_STRAFERIGHT: 52,
  KEY_UP: 72,
  KEY_USE: 57,
} as const);

/** Whether vanilla re-reads gameplay keys on level start. Vanilla: no. */
export const VANILLA_REREADS_GAMEPLAY_KEYS_ON_LEVEL_START = false;

/** Whether vanilla supports runtime rebinding of gameplay keys via the menu. Vanilla: yes. */
export const VANILLA_GAMEPLAY_KEYS_REBINDABLE_AT_RUNTIME = true;

export type GameplayKeyName = keyof typeof VANILLA_GAMEPLAY_KEY_SCAN_CODES;

export function lookupVanillaGameplayKey(keyName: GameplayKeyName): number {
  return VANILLA_GAMEPLAY_KEY_SCAN_CODES[keyName];
}
