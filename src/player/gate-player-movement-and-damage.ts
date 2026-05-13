/**
 * Gate step 07-032: aggregate vanilla DOOM 1.9 player movement and damage
 * primitives into a single re-export so regressions surface here.
 *
 * Wraps the constants pinned by 07-004 (movement speeds), 07-005 (bob),
 * 07-006 (thrust + friction), 07-007 (damage + armor), 07-009 (cheat flags).
 */

import { VANILLA_ANGLE_TURN, VANILLA_FORWARD_MOVE, VANILLA_MAX_PLAYER_MOVE, VANILLA_PLAYER_THRUST_SCALE, VANILLA_SIDE_MOVE, VANILLA_SLOW_TURN_TICS } from './implement-forward-side-and-turn-movement.ts';
import { VANILLA_BOB_RIGHT_SHIFT, VANILLA_MAXBOB } from './implement-bob-and-viewheight-semantics.ts';
import { VANILLA_ANGLETOFINESHIFT, VANILLA_PLAYER_FRICTION, VANILLA_PLAYER_STOPSPEED } from './implement-player-thrust-and-friction.ts';
import { VANILLA_ARMOR_TYPE_BLUE, VANILLA_ARMOR_TYPE_GREEN, VANILLA_ARMOR_TYPE_NONE, VANILLA_SKILL_BABY } from './implement-player-damage-and-armor.ts';
import { VANILLA_CF_GODMODE, VANILLA_CF_NOCLIP, VANILLA_CF_NOMOMENTUM } from './implement-god-mode-and-powerup-flags.ts';

export const PLAYER_MOVEMENT_AND_DAMAGE_GATE = Object.freeze({
  forwardMove: VANILLA_FORWARD_MOVE,
  sideMove: VANILLA_SIDE_MOVE,
  angleTurn: VANILLA_ANGLE_TURN,
  slowTurnTics: VANILLA_SLOW_TURN_TICS,
  maxPlayerMove: VANILLA_MAX_PLAYER_MOVE,
  playerThrustScale: VANILLA_PLAYER_THRUST_SCALE,
  maxBobFixed: VANILLA_MAXBOB,
  bobRightShift: VANILLA_BOB_RIGHT_SHIFT,
  playerFrictionFixed: VANILLA_PLAYER_FRICTION,
  playerStopSpeedFixed: VANILLA_PLAYER_STOPSPEED,
  angleToFineShift: VANILLA_ANGLETOFINESHIFT,
  armorTypeNone: VANILLA_ARMOR_TYPE_NONE,
  armorTypeGreen: VANILLA_ARMOR_TYPE_GREEN,
  armorTypeBlue: VANILLA_ARMOR_TYPE_BLUE,
  babySkill: VANILLA_SKILL_BABY,
  cheatGodMode: VANILLA_CF_GODMODE,
  cheatNoclip: VANILLA_CF_NOCLIP,
  cheatNoMomentum: VANILLA_CF_NOMOMENTUM,
} as const);

export type PlayerMovementAndDamageGate = typeof PLAYER_MOVEMENT_AND_DAMAGE_GATE;
