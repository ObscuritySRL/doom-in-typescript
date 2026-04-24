/**
 * Hitscan weapon actions (p_pspr.c, p_map.c).
 *
 * Implements the player psprite attack functions that fire hitscan
 * weapons: A_Punch, A_Saw, A_FirePistol, A_FireShotgun, A_FireShotgun2,
 * A_FireCGun, plus the P_BulletSlope and P_GunShot helpers.
 *
 * The heavy-weight primitives P_AimLineAttack, P_LineAttack, and
 * R_PointToAngle2 are injected via {@link HitscanContext} callbacks so
 * this module can be exercised without the full raycasting subsystem
 * (intercept traversal lands in a later step).
 *
 * The module-level `bulletslope` and `linetarget` fields mirror the
 * global state set by P_BulletSlope / P_AimLineAttack in the C code so
 * subsequent P_GunShot and SSG pellet calls can reuse the cached aim.
 *
 * All behavior matches Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { setHitscanContext, wireHitscanActions } from "../src/player/hitscan.ts";
 * setHitscanContext({ rng, thinkerList, lineAttack, aimLineAttack, pointToAngle2, startSound: null });
 * wireHitscanActions();
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';
import type { Mobj } from '../world/mobj.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import type { Player, PspriteDef } from './playerSpawn.ts';

import { ANG90, ANG180 } from '../core/angle.ts';
import { FRACUNIT } from '../core/fixed.ts';
import { MF_JUSTATTACKED, STATES, StateNum, setMobjState } from '../world/mobj.ts';
import { PowerType, PsprNum, WEAPON_INFO, pspriteActions, setPsprite } from './playerSpawn.ts';

// ── Range constants ──────────────────────────────────────────────────

/** MISSILERANGE from p_local.h: `32 * 64 * FRACUNIT` (0x800_0000). */
export const MISSILERANGE: Fixed = (32 * 64 * FRACUNIT) | 0;

/** MELEERANGE from p_local.h: `64 * FRACUNIT` (0x40_0000). */
export const MELEERANGE: Fixed = (64 * FRACUNIT) | 0;

/** Autoaim search range used by P_BulletSlope: `16 * 64 * FRACUNIT` (0x400_0000). */
export const BULLET_AIM_RANGE: Fixed = (16 * 64 * FRACUNIT) | 0;

/** `1 << 26` angle nudge for the three-shot P_BulletSlope autoaim cascade. */
export const BULLET_AIM_NUDGE: Angle = 1 << 26;

// ── SFX IDs ──────────────────────────────────────────────────────────

/** sfx_pistol — fired by pistol and chaingun (sounds.h). */
export const SFX_PISTOL = 1;

/** sfx_shotgn — fired by the shotgun (sounds.h). */
export const SFX_SHOTGN = 2;

/** sfx_dshtgn — fired by the super shotgun (sounds.h). */
export const SFX_DSHTGN = 4;

/** sfx_sawful — chainsaw miss sound (plays when no target). */
export const SFX_SAWFUL = 13;

/** sfx_sawhit — chainsaw hit sound (plays when target engaged). */
export const SFX_SAWHIT = 14;

/** sfx_punch — fist hit sound (plays only when a target is struck). */
export const SFX_PUNCH = 84;

// ── Saw angle-snap constants ─────────────────────────────────────────

/** `ANG90 / 20` — saw rotation step toward a struck target. */
export const SAW_ANGLE_STEP: Angle = (ANG90 / 20) | 0;

/** `ANG90 / 21` — saw snap offset when the misalignment is large. */
export const SAW_ANGLE_SNAP: Angle = (ANG90 / 21) | 0;

// ── Callback types ───────────────────────────────────────────────────

/**
 * Result of P_AimLineAttack: the slope toward the selected target
 * (or a zero/default slope when nothing was found) and the target mobj
 * if one was hit. `target` is exposed directly because the C code
 * communicates the hit through the global `linetarget` side effect.
 */
export interface AimLineAttackResult {
  slope: Fixed;
  target: Mobj | null;
}

/** Callback matching P_LineAttack(shooter, angle, range, slope, damage). */
export type LineAttackFunction = (shooter: Mobj, angle: Angle, range: Fixed, slope: Fixed, damage: number) => void;

/** Callback matching P_AimLineAttack(shooter, angle, range). */
export type AimLineAttackFunction = (shooter: Mobj, angle: Angle, range: Fixed) => AimLineAttackResult;

/** Callback matching R_PointToAngle2(x1, y1, x2, y2). */
export type PointToAngle2Function = (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed) => Angle;

/** Callback matching S_StartSound(origin, sfxId). */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

// ── Context ──────────────────────────────────────────────────────────

/**
 * Shared dependencies required by hitscan psprite actions.
 *
 * `lineAttack`, `aimLineAttack`, and `pointToAngle2` mirror the C
 * primitives of the same name and are injected to keep this module
 * decoupled from the full intercept/raycasting subsystem.
 */
export interface HitscanContext {
  rng: DoomRandom;
  thinkerList: ThinkerList;
  lineAttack: LineAttackFunction;
  aimLineAttack: AimLineAttackFunction;
  pointToAngle2: PointToAngle2Function;
  startSound: StartSoundFunction | null;
}

let context: HitscanContext | null = null;

/** Install the shared context used by all hitscan actions. */
export function setHitscanContext(ctx: HitscanContext | null): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getHitscanContext(): HitscanContext | null {
  return context;
}

// ── Cached aim state (p_map.c globals) ───────────────────────────────

let bulletslope: Fixed = 0;
let linetarget: Mobj | null = null;

/** Current cached slope from the last P_BulletSlope / P_AimLineAttack call. */
export function getBulletSlope(): Fixed {
  return bulletslope;
}

/** Current cached target from the last P_AimLineAttack call (null if none). */
export function getLineTarget(): Mobj | null {
  return linetarget;
}

/** Reset the module-level aim cache. Test-only helper. */
export function resetHitscanAimCache(): void {
  bulletslope = 0;
  linetarget = null;
}

// ── P_BulletSlope ────────────────────────────────────────────────────

/**
 * P_BulletSlope: autoaim cascade used by pistol/shotgun/chaingun.
 *
 * Calls P_AimLineAttack with the shooter's facing first. If no target
 * is found, retries with `angle + (1<<26)` and then `angle - (1<<26)`.
 * The final slope and target from whichever call locked on populate
 * {@link bulletslope} and {@link linetarget}.
 *
 * @param mo - The shooter mobj.
 */
export function bulletSlope(mo: Mobj): void {
  if (!context) return;

  let an: Angle = mo.angle >>> 0;
  let result = context.aimLineAttack(mo, an, BULLET_AIM_RANGE);
  bulletslope = result.slope;
  linetarget = result.target;

  if (!linetarget) {
    an = (an + BULLET_AIM_NUDGE) >>> 0;
    result = context.aimLineAttack(mo, an, BULLET_AIM_RANGE);
    bulletslope = result.slope;
    linetarget = result.target;
  }
  if (!linetarget) {
    an = (an - 2 * BULLET_AIM_NUDGE) >>> 0;
    result = context.aimLineAttack(mo, an, BULLET_AIM_RANGE);
    bulletslope = result.slope;
    linetarget = result.target;
  }
}

// ── P_GunShot ────────────────────────────────────────────────────────

/**
 * P_GunShot: fire a single bullet using the cached bulletslope.
 *
 * Damage is `5 * (P_Random() % 3 + 1)` giving 5/10/15. When `accurate`
 * is false (refire active or shotgun pellet) the angle is spread by
 * `(P_Random() - P_Random()) << 18`.
 *
 * @param mo - The shooter mobj.
 * @param accurate - When true the shot uses the mobj's exact facing.
 */
export function gunShot(mo: Mobj, accurate: boolean): void {
  if (!context) return;

  const damage = 5 * ((context.rng.pRandom() % 3) + 1);
  let angle: Angle = mo.angle >>> 0;

  if (!accurate) {
    angle = (angle + (context.rng.pSubRandom() << 18)) >>> 0;
  }

  context.lineAttack(mo, angle, MISSILERANGE, bulletslope, damage);
}

// ── A_Punch ──────────────────────────────────────────────────────────

/**
 * A_Punch: fist melee attack (p_pspr.c).
 *
 * Damage base is `(P_Random() % 10 + 1) << 1`, multiplied by 10 when
 * the player holds the berserk (pw_strength) power. Angle spread is
 * `(P_Random() - P_Random()) << 18`. On hit, plays sfx_punch and
 * snaps the player mobj to face the target using R_PointToAngle2.
 */
export function aPunch(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  let damage = ((context.rng.pRandom() % 10) + 1) << 1;
  if (player.powers[PowerType.STRENGTH]) {
    damage *= 10;
  }

  const angle: Angle = ((player.mo.angle >>> 0) + (context.rng.pSubRandom() << 18)) >>> 0;

  const result = context.aimLineAttack(player.mo, angle, MELEERANGE);
  linetarget = result.target;

  context.lineAttack(player.mo, angle, MELEERANGE, result.slope, damage);

  if (linetarget) {
    if (context.startSound) {
      context.startSound(player.mo, SFX_PUNCH);
    }
    player.mo.angle = context.pointToAngle2(player.mo.x, player.mo.y, linetarget.x, linetarget.y);
  }
}

// ── A_Saw ────────────────────────────────────────────────────────────

/**
 * A_Saw: chainsaw melee attack (p_pspr.c).
 *
 * Damage is `2 * (P_Random() % 10 + 1)` (2..20) with no berserk bonus.
 * Uses `MELEERANGE + 1` so boundary hits (where the target centre sits
 * exactly at MELEERANGE) still register. On miss, plays sfx_sawful and
 * returns. On hit, plays sfx_sawhit, rotates the player toward the
 * target in {@link SAW_ANGLE_STEP} increments (with a {@link SAW_ANGLE_SNAP}
 * snap when the misalignment is large), and sets MF_JUSTATTACKED so
 * P_MobjThinker lurches the player forward next tic.
 */
export function aSaw(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  const damage = 2 * ((context.rng.pRandom() % 10) + 1);
  const angle: Angle = ((player.mo.angle >>> 0) + (context.rng.pSubRandom() << 18)) >>> 0;

  const result = context.aimLineAttack(player.mo, angle, MELEERANGE + 1);
  linetarget = result.target;

  context.lineAttack(player.mo, angle, MELEERANGE + 1, result.slope, damage);

  if (!linetarget) {
    if (context.startSound) {
      context.startSound(player.mo, SFX_SAWFUL);
    }
    return;
  }

  if (context.startSound) {
    context.startSound(player.mo, SFX_SAWHIT);
  }

  const targetAngle: Angle = context.pointToAngle2(player.mo.x, player.mo.y, linetarget.x, linetarget.y);

  const playerAngle: Angle = player.mo.angle >>> 0;
  const diff = (targetAngle - playerAngle) >>> 0;
  const negStep = (0 - SAW_ANGLE_STEP) >>> 0;

  if (diff > ANG180) {
    if (diff < negStep) {
      player.mo.angle = (targetAngle + SAW_ANGLE_SNAP) >>> 0;
    } else {
      player.mo.angle = (playerAngle - SAW_ANGLE_STEP) >>> 0;
    }
  } else {
    if (diff > SAW_ANGLE_STEP) {
      player.mo.angle = (targetAngle - SAW_ANGLE_SNAP) >>> 0;
    } else {
      player.mo.angle = (playerAngle + SAW_ANGLE_STEP) >>> 0;
    }
  }

  player.mo.flags |= MF_JUSTATTACKED;
}

// ── A_FirePistol ─────────────────────────────────────────────────────

/**
 * A_FirePistol: single bullet shot (p_pspr.c).
 *
 * Plays sfx_pistol, transitions player mobj to S_PLAY_ATK2, decrements
 * ammo by 1, advances the flash psprite to the weapon flashstate,
 * runs P_BulletSlope, then fires one P_GunShot. Accuracy is gated on
 * the player's refire counter (first shot is accurate, subsequent
 * shots spread).
 */
export function aFirePistol(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  if (context.startSound) {
    context.startSound(player.mo, SFX_PISTOL);
  }
  setMobjState(player.mo, StateNum.PLAY_ATK2, context.thinkerList);

  const weapon = WEAPON_INFO[player.readyweapon]!;
  player.ammo[weapon.ammo] = (player.ammo[weapon.ammo] - 1) | 0;

  setPsprite(player, PsprNum.FLASH, weapon.flashstate);

  bulletSlope(player.mo);
  gunShot(player.mo, !player.refire);
}

// ── A_FireShotgun ────────────────────────────────────────────────────

/**
 * A_FireShotgun: pump shotgun — 7 pellets with independent spread (p_pspr.c).
 *
 * Plays sfx_shotgn, transitions player mobj to S_PLAY_ATK2, decrements
 * ammo by 1, advances the flash psprite, runs P_BulletSlope, then
 * fires seven P_GunShot calls with `accurate=false` so each pellet
 * picks up its own `(P_Random()-P_Random())<<18` angle spread. All
 * seven pellets share the same cached bulletslope.
 */
export function aFireShotgun(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  if (context.startSound) {
    context.startSound(player.mo, SFX_SHOTGN);
  }
  setMobjState(player.mo, StateNum.PLAY_ATK2, context.thinkerList);

  const weapon = WEAPON_INFO[player.readyweapon]!;
  player.ammo[weapon.ammo] = (player.ammo[weapon.ammo] - 1) | 0;

  setPsprite(player, PsprNum.FLASH, weapon.flashstate);

  bulletSlope(player.mo);
  for (let pellet = 0; pellet < 7; pellet++) {
    gunShot(player.mo, false);
  }
}

// ── A_FireShotgun2 ───────────────────────────────────────────────────

/**
 * A_FireShotgun2: super shotgun — 20 pellets, ammo cost 2 (p_pspr.c).
 *
 * Does NOT call P_GunShot; each pellet rolls its own damage
 * (`5 * (P_Random() % 3 + 1)`), independent per-pellet angle spread
 * `(P_Random()-P_Random())<<19` (note 19, not 18), and per-pellet
 * slope jitter `bulletslope + ((P_Random()-P_Random())<<5)`. The RNG
 * order for each pellet is: damage roll first, then angle roll, then
 * slope roll — three P_Random pairs per pellet.
 */
export function aFireShotgun2(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  if (context.startSound) {
    context.startSound(player.mo, SFX_DSHTGN);
  }
  setMobjState(player.mo, StateNum.PLAY_ATK2, context.thinkerList);

  const weapon = WEAPON_INFO[player.readyweapon]!;
  player.ammo[weapon.ammo] = (player.ammo[weapon.ammo] - 2) | 0;

  setPsprite(player, PsprNum.FLASH, weapon.flashstate);

  bulletSlope(player.mo);

  const rng = context.rng;
  const lineAttack = context.lineAttack;
  const shooter = player.mo;
  const baseAngle = shooter.angle >>> 0;
  const baseSlope = bulletslope;
  for (let pellet = 0; pellet < 20; pellet++) {
    const damage = 5 * ((rng.pRandom() % 3) + 1);
    const angle: Angle = (baseAngle + (rng.pSubRandom() << 19)) >>> 0;
    const slope: Fixed = (baseSlope + (rng.pSubRandom() << 5)) | 0;
    lineAttack(shooter, angle, MISSILERANGE, slope, damage);
  }
}

// ── A_FireCGun ───────────────────────────────────────────────────────

/**
 * A_FireCGun: chaingun shot (p_pspr.c).
 *
 * Plays sfx_pistol *before* the ammo check — the sound fires even
 * when the clip is empty (parity quirk). When ammo is zero, returns
 * immediately before transitioning state or firing a bullet. Otherwise
 * transitions player mobj to S_PLAY_ATK2, decrements ammo by 1,
 * advances the flash psprite to one of two alternating frames based
 * on whether the current psprite state is S_CHAIN1 (flashstate + 0)
 * or S_CHAIN2 (flashstate + 1), runs P_BulletSlope, and fires one
 * P_GunShot with accuracy gated on refire.
 */
export function aFireCGun(player: Player, psp: PspriteDef): void {
  if (!context || !player.mo) return;

  if (context.startSound) {
    context.startSound(player.mo, SFX_PISTOL);
  }

  const weapon = WEAPON_INFO[player.readyweapon]!;
  if (!player.ammo[weapon.ammo]) {
    return;
  }

  setMobjState(player.mo, StateNum.PLAY_ATK2, context.thinkerList);
  player.ammo[weapon.ammo] = (player.ammo[weapon.ammo] - 1) | 0;

  const flashOffset = psp.state === STATES[StateNum.CHAIN2]! ? 1 : 0;
  setPsprite(player, PsprNum.FLASH, (weapon.flashstate + flashOffset) as StateNum);

  bulletSlope(player.mo);
  gunShot(player.mo, !player.refire);
}

// ── State action wiring ──────────────────────────────────────────────

/**
 * Total number of psprite actions installed by {@link wireHitscanActions}.
 *
 * A_Punch (1) + A_Saw (2) + A_FirePistol (1) + A_FireShotgun (1) +
 * A_FireShotgun2 (1) + A_FireCGun (2) = 8.
 */
export const HITSCAN_ACTION_COUNT = 8;

/**
 * Wire all hitscan psprite actions into the shared pspriteActions table.
 *
 * Must be called once before the game loop runs. Complementary to
 * wireWeaponStateActions from weaponStates.ts; both must run for the
 * full weapon state machine to be operational.
 */
export function wireHitscanActions(): void {
  pspriteActions[StateNum.PUNCH2] = aPunch;
  pspriteActions[StateNum.PISTOL2] = aFirePistol;
  pspriteActions[StateNum.SGUN2] = aFireShotgun;
  pspriteActions[StateNum.DSGUN2] = aFireShotgun2;
  pspriteActions[StateNum.CHAIN1] = aFireCGun;
  pspriteActions[StateNum.CHAIN2] = aFireCGun;
  pspriteActions[StateNum.SAW1] = aSaw;
  pspriteActions[StateNum.SAW2] = aSaw;
}
