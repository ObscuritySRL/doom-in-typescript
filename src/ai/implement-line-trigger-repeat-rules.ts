/**
 * Vanilla DOOM 1.9 line trigger repeat rules from p_spec.c.
 *
 * Line special numbers determine trigger type and repeatability. Each special:
 *   - Trigger group: W (walk), S (switch), G (gun), P (push)
 *   - Repeatability: 1 (once-only) or R (repeatable)
 *
 * Naming convention: W1 = walk-once, WR = walk-repeat, S1 = switch-once, SR =
 * switch-repeat, G1 = gun-once, GR = gun-repeat. After successful activation,
 * special # is zeroed for "1"-type (P_ChangeSwitchTexture handles texture flip
 * for switches; for walk lines, line.special = 0).
 *
 * Locked-door lines are gated by player.cards[]/skull[]; certain special #s
 * require specific keys (line 26/27/28 = blue, red, yellow keycard; 32/33/34
 * = blue/red/yellow skull).
 */

export type LineTriggerGroup = 'walk' | 'switch' | 'gun' | 'push';
export type LineTriggerRepeat = 'once' | 'repeat';

export interface LineTriggerType {
  readonly group: LineTriggerGroup;
  readonly repeat: LineTriggerRepeat;
}

export const VANILLA_LINE_TRIGGER_KEY_BLUE_CARD = 26;
export const VANILLA_LINE_TRIGGER_KEY_RED_CARD = 28;
export const VANILLA_LINE_TRIGGER_KEY_YELLOW_CARD = 27;
export const VANILLA_LINE_TRIGGER_KEY_BLUE_SKULL = 32;
export const VANILLA_LINE_TRIGGER_KEY_RED_SKULL = 33;
export const VANILLA_LINE_TRIGGER_KEY_YELLOW_SKULL = 34;

/** Returns the trigger type for a vanilla line special by interpretation. */
export function classifyLineTriggerType(group: LineTriggerGroup, repeat: LineTriggerRepeat): LineTriggerType {
  return Object.freeze({ group, repeat });
}

/** Resets the line special to 0 for once-only walk triggers, leaving switches/repeats untouched. */
export function shouldClearLineSpecialAfterFire(group: LineTriggerGroup, repeat: LineTriggerRepeat): boolean {
  if (repeat === 'repeat') {
    return false;
  }
  return group === 'walk' || group === 'gun';
}
