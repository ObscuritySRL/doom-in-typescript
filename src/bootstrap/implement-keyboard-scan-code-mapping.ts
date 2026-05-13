/**
 * Vanilla Chocolate Doom 2.2.1 keyboard scan-code mapping contract.
 *
 * vanilla_keyboard_mapping = 1 in chocolate-doom.cfg routes the Win32
 * scan-code stream straight to DOOM's internal key codes without OS layout
 * translation: the byte the OS reports is the byte the game reads. Pins the
 * essential mappings from default.cfg key_* and key_menu_* values plus the
 * extended-key bit, so subsequent host wiring is verified against this list.
 */

/** Canonical Doom DOS scan codes used by default.cfg and chocolate-doom.cfg. */
export const VANILLA_KEY_SCAN_CODES = Object.freeze({
  KEY_DOWN: 80,
  KEY_ENTER: 28,
  KEY_ESCAPE: 1,
  KEY_FIRE: 29,
  KEY_LEFT: 75,
  KEY_PAUSE: 69,
  KEY_RIGHT: 77,
  KEY_SPEED: 54,
  KEY_STRAFE: 56,
  KEY_STRAFE_LEFT: 51,
  KEY_STRAFE_RIGHT: 52,
  KEY_UP: 72,
  KEY_USE: 57,
} as const);

/** Whether vanilla_keyboard_mapping = 1 bypasses OS keyboard layout translation. */
export const VANILLA_BYPASSES_OS_LAYOUT_TRANSLATION = true;

/** Mask that distinguishes extended keys (cursor keys, numpad arrows, etc.) in vanilla. */
export const VANILLA_EXTENDED_KEY_FLAG_MASK = 0x80;

/** Minimum and maximum valid scan-code values for the DOS make-code range. */
export const VANILLA_SCAN_CODE_MIN = 1;
export const VANILLA_SCAN_CODE_MAX = 127;

export type ScanCodeRangeViolation = 'below_min' | 'above_max' | 'reserved_zero';

export interface ScanCodeMappingDecision {
  readonly inRange: boolean;
  readonly violation: ScanCodeRangeViolation | null;
}

export function evaluateScanCode(scanCode: number): ScanCodeMappingDecision {
  if (scanCode === 0) {
    return Object.freeze({ inRange: false, violation: 'reserved_zero' });
  }
  if (scanCode < VANILLA_SCAN_CODE_MIN) {
    return Object.freeze({ inRange: false, violation: 'below_min' });
  }
  if (scanCode > VANILLA_SCAN_CODE_MAX) {
    return Object.freeze({ inRange: false, violation: 'above_max' });
  }
  return Object.freeze({ inRange: true, violation: null });
}
