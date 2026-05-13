/**
 * Gate step 06-030: pin line use range and trigger flag bits for vanilla parity.
 *
 * Vanilla DOOM 1.9 line interaction:
 *   - USERANGE = 64 map units (the range P_UseLines projects).
 *   - MELEERANGE = 64 map units (melee + use share the same projection).
 *   - Trigger flag groups: PR (push), GR (gun), WR (walk), SR (switch),
 *     PD (push door), etc. — used to gate line specials by interaction.
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_USERANGE_FIXED: Fixed = (64 << FRACBITS) | 0;
export const VANILLA_MELEERANGE_FIXED: Fixed = (64 << FRACBITS) | 0;

export const LINE_TRIGGER_GROUP_NAMES = Object.freeze(['walk', 'push', 'gun', 'switch'] as const);
export type LineTriggerGroup = (typeof LINE_TRIGGER_GROUP_NAMES)[number];

export const LINE_TRIGGER_REPEAT_NAMES = Object.freeze(['once', 'repeatable'] as const);
export type LineTriggerRepeat = (typeof LINE_TRIGGER_REPEAT_NAMES)[number];

export interface LineUseProjection {
  readonly rangeFixed: Fixed;
  readonly group: LineTriggerGroup;
  readonly repeat: LineTriggerRepeat;
}

export function projectVanillaUseLine(group: LineTriggerGroup, repeat: LineTriggerRepeat): LineUseProjection {
  return Object.freeze({ rangeFixed: VANILLA_USERANGE_FIXED, group, repeat });
}
