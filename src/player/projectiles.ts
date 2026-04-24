/**
 * Projectile weapon actions (p_pspr.c, p_mobj.c, p_map.c).
 *
 * Implements the player psprite attack functions that fire projectile
 * weapons: A_FireMissile (rocket), A_FirePlasma (plasma), A_FireBFG
 * (BFG 9000), plus the mobj-state action A_BFGSpray (40-ray BFG blast).
 * Also exposes the P_SpawnPlayerMissile, P_CheckMissileSpawn, and
 * P_ExplodeMissile primitives used by both player fire and monster
 * missile attacks.
 *
 * The heavy-weight primitives P_AimLineAttack, P_TryMove, P_DamageMobj,
 * and P_SpawnMobj are injected via {@link ProjectileContext} callbacks
 * so this module can be exercised without the full map/intercept
 * subsystem. A_BFGSpray takes a mobj argument (not a player+psp pair)
 * because it runs on the BFGLAND5 mobj state, not a psprite state.
 *
 * All behavior matches Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { setProjectileContext, wireProjectileActions } from "../src/player/projectiles.ts";
 * setProjectileContext({ rng, thinkerList, spawnMobj, tryMove, aimLineAttack, damageMobj, startSound });
 * wireProjectileActions();
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';
import type { Mobj } from '../world/mobj.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import type { Player, PspriteDef } from './playerSpawn.ts';

import { ANG90 } from '../core/angle.ts';
import { fixedMul, FRACUNIT } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../core/trig.ts';
import { MF_MISSILE, MobjType, STATES, StateNum, setMobjState } from '../world/mobj.ts';
import { PsprNum, WEAPON_INFO, pspriteActions, setPsprite } from './playerSpawn.ts';
import { BFG_CELLS_PER_SHOT } from './weapons.ts';

// ── Range and geometry constants ─────────────────────────────────────

/** Autoaim search range for P_SpawnPlayerMissile: `16 * 64 * FRACUNIT` (0x400_0000). */
export const PROJECTILE_AIM_RANGE: Fixed = (16 * 64 * FRACUNIT) | 0;

/** `1 << 26` angle nudge for the three-shot autoaim cascade (matches P_BulletSlope). */
export const PROJECTILE_AIM_NUDGE: Angle = 1 << 26;

/** Spawn-height offset above the player: `4 * 8 * FRACUNIT` (z + 32 units). */
export const MISSILE_SPAWN_Z_OFFSET: Fixed = (4 * 8 * FRACUNIT) | 0;

// ── P_CheckMissileSpawn / P_ExplodeMissile constants ─────────────────

/** `tics -= P_Random() & 3` jitter mask in P_CheckMissileSpawn and P_ExplodeMissile. */
export const MISSILE_TIC_JITTER_MASK = 3;

// ── A_FirePlasma constants ───────────────────────────────────────────

/** `flashstate + (P_Random() & 1)` mask selecting PLASMAFLASH1 or PLASMAFLASH2. */
export const PLASMA_FLASH_JITTER_MASK = 1;

// ── A_BFGSpray constants ─────────────────────────────────────────────

/** 40 spray rays per BFG impact (outer loop count in A_BFGSpray). */
export const BFG_SPRAY_RAY_COUNT = 40;

/** Half-arc `ANG90 / 2` subtracted from the centerline before stepping rays. */
export const BFG_SPRAY_HALF_ARC: Angle = (ANG90 / 2) | 0;

/** Per-ray angle step `ANG90 / 40`. */
export const BFG_SPRAY_RAY_STEP: Angle = (ANG90 / 40) | 0;

/** 15 damage rolls summed per struck target. */
export const BFG_SPRAY_DAMAGE_ROLLS = 15;

/** `(P_Random() & 7) + 1` damage per roll (range [1,8] each). */
export const BFG_SPRAY_DAMAGE_MASK = 7;

/** `target->height >> 2` Z-offset for the EXTRABFG spawn. */
export const EXTRABFG_Z_SHIFT = 2;

// ── Callback types ───────────────────────────────────────────────────

/**
 * Result of P_AimLineAttack used for projectile autoaim.
 *
 * `target` doubles as the linetarget side-effect signal used by the C
 * code: when non-null, the cascade locks on and the angle/slope used
 * for that call is the one passed to P_SpawnMobj.
 */
export interface ProjectileAimResult {
  slope: Fixed;
  target: Mobj | null;
}

/** Callback matching P_AimLineAttack(shooter, angle, range). */
export type ProjectileAimLineAttackFunction = (shooter: Mobj, angle: Angle, range: Fixed) => ProjectileAimResult;

/** Callback matching P_SpawnMobj(x, y, z, type). */
export type SpawnMobjFunction = (x: Fixed, y: Fixed, z: Fixed, type: MobjType) => Mobj;

/** Callback matching P_TryMove(thing, x, y). Returns false when blocked. */
export type TryMoveFunction = (mobj: Mobj, x: Fixed, y: Fixed) => boolean;

/** Callback matching P_DamageMobj(target, inflictor, source, damage). */
export type DamageMobjFunction = (target: Mobj, inflictor: Mobj | null, source: Mobj | null, damage: number) => void;

/** Callback matching S_StartSound(origin, sfxId). */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

// ── Context ──────────────────────────────────────────────────────────

/**
 * Shared dependencies required by projectile psprite actions.
 *
 * `aimLineAttack`, `spawnMobj`, `tryMove`, and `damageMobj` mirror the
 * C primitives of the same name and are injected to keep this module
 * decoupled from the full map/intercept subsystem.
 */
export interface ProjectileContext {
  rng: DoomRandom;
  thinkerList: ThinkerList;
  aimLineAttack: ProjectileAimLineAttackFunction;
  spawnMobj: SpawnMobjFunction;
  tryMove: TryMoveFunction;
  damageMobj: DamageMobjFunction;
  startSound: StartSoundFunction | null;
}

let context: ProjectileContext | null = null;

/** Install the shared context used by all projectile actions. */
export function setProjectileContext(ctx: ProjectileContext): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getProjectileContext(): ProjectileContext | null {
  return context;
}

// ── P_ExplodeMissile ─────────────────────────────────────────────────

/**
 * P_ExplodeMissile: zero momenta, transition to deathstate, clear MF_MISSILE.
 *
 * Matches p_mobj.c P_ExplodeMissile exactly:
 * 1. momx/momy/momz set to 0.
 * 2. P_SetMobjState(mo, info.deathstate).
 * 3. `tics -= P_Random() & 3`, clamped to >= 1 (jitter shared with
 *    P_CheckMissileSpawn).
 * 4. MF_MISSILE cleared.
 * 5. deathsound played (when non-zero) on the missile itself.
 *
 * The RNG call in step 3 is parity-critical: it advances prndindex
 * whether or not the jitter actually changes the tic value.
 *
 * @param mobj - The missile to explode.
 */
export function explodeMissile(mobj: Mobj): void {
  if (!context) return;

  mobj.momx = 0;
  mobj.momy = 0;
  mobj.momz = 0;

  const deathstate: StateNum = (mobj.info?.deathstate ?? StateNum.NULL) as StateNum;
  setMobjState(mobj, deathstate, context.thinkerList);

  mobj.tics = (mobj.tics - (context.rng.pRandom() & MISSILE_TIC_JITTER_MASK)) | 0;
  if (mobj.tics < 1) {
    mobj.tics = 1;
  }

  mobj.flags = (mobj.flags & ~MF_MISSILE) | 0;

  const deathsound = mobj.info?.deathsound ?? 0;
  if (deathsound && context.startSound) {
    context.startSound(mobj, deathsound);
  }
}

// ── P_CheckMissileSpawn ──────────────────────────────────────────────

/**
 * P_CheckMissileSpawn: half-advance the missile and verify the spawn is valid.
 *
 * Matches p_mobj.c P_CheckMissileSpawn exactly:
 * 1. `tics -= P_Random() & 3`, clamped to >= 1 (first-frame jitter).
 * 2. Advance position by half-momentum: x += momx>>1, y += momy>>1,
 *    z += momz>>1. This is load-bearing — without the advance, an
 *    immediate-wall missile would have zero velocity when exploded and
 *    angle computations on the explosion would divide by zero.
 * 3. If P_TryMove fails at the advanced position, explode the missile
 *    immediately via {@link explodeMissile}.
 *
 * @param missile - The freshly spawned missile mobj.
 */
export function checkMissileSpawn(missile: Mobj): void {
  if (!context) return;

  missile.tics = (missile.tics - (context.rng.pRandom() & MISSILE_TIC_JITTER_MASK)) | 0;
  if (missile.tics < 1) {
    missile.tics = 1;
  }

  missile.x = (missile.x + (missile.momx >> 1)) | 0;
  missile.y = (missile.y + (missile.momy >> 1)) | 0;
  missile.z = (missile.z + (missile.momz >> 1)) | 0;

  if (!context.tryMove(missile, missile.x, missile.y)) {
    explodeMissile(missile);
  }
}

// ── P_SpawnPlayerMissile ─────────────────────────────────────────────

/**
 * P_SpawnPlayerMissile: autoaim cascade + missile spawn + launch.
 *
 * Matches p_map.c P_SpawnPlayerMissile exactly:
 * 1. Aim cascade: try source->angle first. If linetarget is null, try
 *    `angle + (1<<26)`. If still null, try `angle - (1<<26)`. If all
 *    three miss, reset angle to source->angle and use slope 0.
 * 2. Spawn the missile at (source.x, source.y, source.z + 32*FRACUNIT).
 * 3. Play missile seesound (when non-zero) on the missile.
 * 4. Set target = source, angle = final aim angle.
 * 5. Compute momx/momy from speed * finecosine/finesine[angle>>19],
 *    momz from speed * slope.
 * 6. Call {@link checkMissileSpawn} to apply tic jitter and half-move.
 *
 * The three autoaim calls each consume whatever RNG / map primitives
 * P_AimLineAttack consumes; they are exposed to callers through
 * `context.aimLineAttack`.
 *
 * @param source - The shooter mobj (player mobj for A_FireX).
 * @param type - The MobjType of the projectile to spawn.
 * @returns The spawned missile mobj.
 */
export function spawnPlayerMissile(source: Mobj, type: MobjType): Mobj {
  if (!context) {
    throw new Error('spawnPlayerMissile: projectile context not set');
  }

  let an: Angle = source.angle >>> 0;
  let result = context.aimLineAttack(source, an, PROJECTILE_AIM_RANGE);
  let slope: Fixed = result.slope;

  if (!result.target) {
    an = (an + PROJECTILE_AIM_NUDGE) >>> 0;
    result = context.aimLineAttack(source, an, PROJECTILE_AIM_RANGE);
    slope = result.slope;

    if (!result.target) {
      an = (an - 2 * PROJECTILE_AIM_NUDGE) >>> 0;
      result = context.aimLineAttack(source, an, PROJECTILE_AIM_RANGE);
      slope = result.slope;
    }

    if (!result.target) {
      an = source.angle >>> 0;
      slope = 0;
    }
  }

  const x: Fixed = source.x;
  const y: Fixed = source.y;
  const z: Fixed = (source.z + MISSILE_SPAWN_Z_OFFSET) | 0;

  const missile = context.spawnMobj(x, y, z, type);

  const seesound = missile.info?.seesound ?? 0;
  if (seesound && context.startSound) {
    context.startSound(missile, seesound);
  }

  missile.target = source;
  missile.angle = an;

  const speed: Fixed = missile.info?.speed ?? 0;
  const fineIndex = an >>> ANGLETOFINESHIFT;
  missile.momx = fixedMul(speed, finecosine[fineIndex]!);
  missile.momy = fixedMul(speed, finesine[fineIndex]!);
  missile.momz = fixedMul(speed, slope);

  checkMissileSpawn(missile);

  return missile;
}

// ── A_FireMissile ────────────────────────────────────────────────────

/**
 * A_FireMissile: rocket launcher fire (p_pspr.c).
 *
 * Decrements the player's missile ammo by 1, then calls
 * P_SpawnPlayerMissile with MT_ROCKET. The seesound (sfx_rlaunc) is
 * played inside spawnPlayerMissile via the MOBJINFO seesound field.
 */
export function aFireMissile(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  const ammoType = WEAPON_INFO[player.readyweapon]!.ammo;
  player.ammo[ammoType] = ((player.ammo[ammoType] ?? 0) - 1) | 0;

  spawnPlayerMissile(player.mo, MobjType.ROCKET);
}

// ── A_FirePlasma ─────────────────────────────────────────────────────
/**
 * A_FirePlasma: plasma rifle fire (p_pspr.c).
 *
 * Decrements cell ammo by 1, advances the flash psprite to
 * `flashstate + (P_Random() & 1)` (PLASMAFLASH1 or PLASMAFLASH2 with
 * equal probability), then calls P_SpawnPlayerMissile with MT_PLASMA.
 *
 * RNG ordering is parity-critical: the flash-jitter P_Random runs
 * BEFORE the autoaim cascade inside spawnPlayerMissile.
 */
export function aFirePlasma(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  const ammoType = WEAPON_INFO[player.readyweapon]!.ammo;
  player.ammo[ammoType] = ((player.ammo[ammoType] ?? 0) - 1) | 0;

  const flashOffset = context.rng.pRandom() & PLASMA_FLASH_JITTER_MASK;
  setPsprite(player, PsprNum.FLASH, (WEAPON_INFO[player.readyweapon]!.flashstate + flashOffset) as StateNum);

  spawnPlayerMissile(player.mo, MobjType.PLASMA);
}

// ── A_FireBFG ────────────────────────────────────────────────────────

/**
 * A_FireBFG: BFG 9000 fire (p_pspr.c).
 *
 * Decrements cell ammo by {@link BFG_CELLS_PER_SHOT} (40 by default via
 * deh_bfg_cells_per_shot), then calls P_SpawnPlayerMissile with MT_BFG.
 * The BFG projectile has seesound=0 in MOBJINFO so no sound plays on
 * spawn — the pre-fire sfx_bfg charge plays via A_BFGsound on BFG1
 * (handled by a separate action).
 */
export function aFireBFG(player: Player, _psp: PspriteDef): void {
  if (!context || !player.mo) return;

  const ammoType = WEAPON_INFO[player.readyweapon]!.ammo;
  player.ammo[ammoType] = ((player.ammo[ammoType] ?? 0) - BFG_CELLS_PER_SHOT) | 0;

  spawnPlayerMissile(player.mo, MobjType.BFG);
}

// ── A_BFGSpray ───────────────────────────────────────────────────────

/**
 * A_BFGSpray: 40-ray damage spray (p_pspr.c).
 *
 * Invoked from the BFG projectile's BFGLAND5 mobj state (NOT a psprite
 * state, so the signature takes a Mobj rather than Player+PspriteDef).
 * For each of 40 rays fanning `ANG90` wide around `mo.angle`:
 *
 * 1. Compute `an = mo.angle - ANG90/2 + (ANG90/40)*i`.
 * 2. Call P_AimLineAttack(mo.target, an, 16*64*FRACUNIT).
 * 3. When no target was hit (`linetarget === null`), skip — no RNG is
 *    consumed for this ray.
 * 4. Otherwise spawn an MT_EXTRABFG at
 *    (target.x, target.y, target.z + (target.height>>2)).
 * 5. Roll damage as `sum of 15 * ((P_Random() & 7) + 1)` (range
 *    [15, 120]).
 * 6. Deal the damage via P_DamageMobj(target, mo.target, mo.target, damage).
 *
 * The parity-critical details: `mo.target` (the player who fired the
 * BFG) is used both as the aim source AND as the damage inflictor/source.
 * When `mo.target` is null the function early-returns — vanilla would
 * crash on the null deref inside P_AimLineAttack; the early-return is
 * a safety refinement with no gameplay-relevant behavioral divergence.
 */
export function aBFGSpray(mo: Mobj): void {
  if (!context || !mo.target) return;

  for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
    const an: Angle = (mo.angle - BFG_SPRAY_HALF_ARC + BFG_SPRAY_RAY_STEP * i) >>> 0;

    const result = context.aimLineAttack(mo.target, an, PROJECTILE_AIM_RANGE);
    if (!result.target) continue;

    const linetarget = result.target;
    context.spawnMobj(linetarget.x, linetarget.y, (linetarget.z + (linetarget.height >> EXTRABFG_Z_SHIFT)) | 0, MobjType.EXTRABFG);

    let damage = 0;
    for (let j = 0; j < BFG_SPRAY_DAMAGE_ROLLS; j++) {
      damage += (context.rng.pRandom() & BFG_SPRAY_DAMAGE_MASK) + 1;
    }

    context.damageMobj(linetarget, mo.target, mo.target, damage);
  }
}

// ── State action wiring ──────────────────────────────────────────────

/**
 * Total number of actions installed by {@link wireProjectileActions}.
 *
 * A_FireMissile (1 psprite) + A_FirePlasma (1 psprite) + A_FireBFG
 * (1 psprite) + A_BFGSpray (1 mobj state) = 4.
 */
export const PROJECTILE_ACTION_COUNT = 4;

/**
 * Wire all projectile actions into the pspriteActions / STATES tables.
 *
 * Three player-psprite actions install into pspriteActions:
 * - A_FireMissile → MISSILE2
 * - A_FirePlasma → PLASMA1
 * - A_FireBFG → BFG3
 *
 * One mobj-state action installs into STATES[BFGLAND5].action:
 * - A_BFGSpray (runs from the projectile impact state chain).
 *
 * Must be called once before the game loop runs. Complementary to
 * wireWeaponStateActions (weaponStates.ts) and wireHitscanActions
 * (hitscan.ts); all three must run for the full weapon state machine
 * to be operational.
 */
export function wireProjectileActions(): void {
  pspriteActions[StateNum.MISSILE2] = aFireMissile;
  pspriteActions[StateNum.PLASMA1] = aFirePlasma;
  pspriteActions[StateNum.BFG3] = aFireBFG;
  STATES[StateNum.BFGLAND5]!.action = aBFGSpray;
}
