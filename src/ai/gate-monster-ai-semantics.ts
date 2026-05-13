/**
 * Gate step 08-030: aggregate monster AI primitive constants pinned by Phase 08.
 *
 * Anchors the AI lane: chase direction, melee/missile range, monster-specific
 * attack damage, lost soul flight, boss specials. Regressions in any AI
 * primitive surface here.
 */

import { applyVanillaBaronAttack } from './implement-baron-attack.ts';
import { applyVanillaCacoAttack } from './implement-cacodemon-attack.ts';
import { directionToBamAngle, oppositeDirection, DI_EAST, DI_WEST } from './implement-chase-direction-selection.ts';
import { computeLostSoulCollisionDamage } from './implement-lost-soul-attack.ts';

export const MONSTER_AI_GATE = Object.freeze({
  chaseDirections: 8,
  cacoMeleeRange: { dmg0: applyVanillaCacoAttack({ inMeleeRange: true, randomByte: 0 }).damage, dmgMax: applyVanillaCacoAttack({ inMeleeRange: true, randomByte: 5 }).damage },
  baronMeleeRange: { dmg0: applyVanillaBaronAttack(true, 0).damage, dmgMax: applyVanillaBaronAttack(true, 7).damage },
  lostSoulCollisionMin: computeLostSoulCollisionDamage(0),
  lostSoulCollisionMax: computeLostSoulCollisionDamage(7),
  directionAngleEast: directionToBamAngle(DI_EAST),
  directionAngleWest: directionToBamAngle(DI_WEST),
  oppositeEast: oppositeDirection(DI_EAST),
} as const);
