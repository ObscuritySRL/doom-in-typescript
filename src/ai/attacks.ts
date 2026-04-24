/**
 * Monster attack actions (p_enemy.c A_FaceTarget through A_PainAttack).
 *
 * Every missile-capable and melee-capable monster in the base roster
 * points its attack states at one of the action functions in this
 * module.  Wiring them into {@link STATES} via {@link wireMonsterAttackActions}
 * is the bridge between the state tables loaded from info.c and the
 * concrete AI behavior.
 *
 * The heavy primitives — P_SpawnMobj, P_TryMove, P_DamageMobj,
 * P_LineAttack, P_AimLineAttack, P_RadiusAttack, R_PointToAngle2 — are
 * injected via {@link MonsterAttackContext} callbacks so this module can
 * exercise attack logic without the full map/intercept subsystem.
 *
 * Parity-critical details preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - A_FaceTarget clears MF_AMBUSH on every call (not just the first),
 *   and adds `P_SubRandom() << 21` to the angle ONLY when the target
 *   has MF_SHADOW.  The RNG is consumed iff MF_SHADOW is set.
 * - A_PosAttack / A_SPosAttack / A_CPosAttack damage formula is
 *   `((P_Random() % 5) + 1) * 3` (3..15), angle spread
 *   `(P_SubRandom() << 20)`.  For A_SPosAttack, three pellets share a
 *   single `P_AimLineAttack` call but each pellet rolls its own
 *   damage+angle pair (RNG order: angle then damage).
 * - A_CPosRefire / A_SpidRefire thresholds are 40 and 10 respectively
 *   (probability of stop = 216/256 vs 246/256 of continue); both call
 *   A_FaceTarget first, then roll one P_Random.
 * - A_TroopAttack / A_HeadAttack / A_BruisAttack: melee branch always
 *   goes through the `A_FaceTarget → P_CheckMeleeRange → damage` chain,
 *   but A_BruisAttack SKIPS A_FaceTarget — the state transition already
 *   aligned the bruiser.  Melee damage: `(P_Random() % 8 + 1) * 3` for
 *   troop, `(P_Random() % 6 + 1) * 10` for head, `(P_Random() % 8 + 1) * 10`
 *   for bruiser.
 * - A_SargAttack: melee-only (no missile fallback).  Damage
 *   `((P_Random() % 10) + 1) * 4`.  1.5+ checks P_CheckMeleeRange before
 *   damaging; vanilla 1.9 is always 1.5+.
 * - A_SkelMissile: temporarily raises actor.z by `SKEL_MISSILE_Z_OFFSET`
 *   to launch the tracer above the skeleton's head, restores it after
 *   spawn, nudges the tracer forward by one momentum step, and sets
 *   `mo.tracer = actor.target` so A_Tracer can home on it.
 * - A_Tracer: only runs on `(gametic & 3) === 0` tics (once every four
 *   tics).  RNG order: P_SpawnPuff (no RNG) → spawn SMOKE →
 *   `tics -= P_Random()&3` on the smoke → direction/slope adjust (no
 *   RNG).  TRACEANGLE step is `0xc000000` (≈168.75°), momz delta
 *   ±FRACUNIT/8 per tic.
 * - A_VileTarget: preserves the vanilla `P_SpawnMobj(target.x, target.x,
 *   target.z, MT_FIRE)` typo — the y argument is `target.x`, not
 *   `target.y`.  Visually the fire still appears near the target in
 *   most cases because fog corrects its position via A_Fire each tic.
 * - A_VileAttack: damage 20 (direct), victim.momz = 1000*FRACUNIT/mass
 *   (launch velocity), then P_RadiusAttack(fire, actor, 70) for splash.
 * - FATSPREAD = ANG90/8.  A_FatAttack1: `actor.angle += FATSPREAD`,
 *   spawn #1, spawn #2 with its own angle += FATSPREAD and recomputed
 *   momx/y.  A_FatAttack2 mirrors to -FATSPREAD/-FATSPREAD*2.
 *   A_FatAttack3 spawns two at ±FATSPREAD/2 with no actor.angle change.
 * - A_SkullAttack: sets MF_SKULLFLY, plays info.attacksound, faces
 *   target, launches at SKULLSPEED, momz derived from target center
 *   height.  P_AproxDistance is the octagonal fast form.
 * - A_PainShootSkull: counts thinkers whose action is mobjThinker AND
 *   type is MT_SKULL; if count > 20 aborts (vanilla > not >=, so 21+).
 *   Prestep offset is `4*FRACUNIT + 3*(actor.radius + skull.radius)/2`.
 *   Z offset is 8*FRACUNIT.  When tryMove fails the skull takes 10000
 *   damage (always lethal).
 * - A_PainAttack: A_FaceTarget then A_PainShootSkull once with
 *   actor.angle.
 *
 * @example
 * ```ts
 * import { setMonsterAttackContext, wireMonsterAttackActions } from
 *   "../src/ai/attacks.ts";
 * setMonsterAttackContext({
 *   rng, thinkerList, targetingContext, spawnMobj, tryMove, damageMobj,
 *   lineAttack, aimLineAttack, radiusAttack, pointToAngle2, startSound,
 *   gametic: () => currentGameTic,
 * });
 * wireMonsterAttackActions();
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT, fixedMul } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../core/trig.ts';

import { MF_AMBUSH, MF_MISSILE, MF_SHADOW, MF_SKULLFLY, MobjType, STATES, StateNum, setMobjState } from '../world/mobj.ts';
import type { Mobj } from '../world/mobj.ts';
import type { ThinkerList, ThinkerNode } from '../world/thinkers.ts';
import { mobjThinker } from '../world/mobj.ts';
import { approxDistance } from '../world/zMovement.ts';

import { checkMeleeRange, checkSight } from './targeting.ts';
import type { TargetingContext } from './targeting.ts';

// ── Range constants ──────────────────────────────────────────────────

/** MISSILERANGE from p_local.h: `32 * 64 * FRACUNIT`. */
export const MISSILERANGE: Fixed = (32 * 64 * FRACUNIT) | 0;

/** MELEERANGE from p_local.h: `64 * FRACUNIT`. */
export const MELEERANGE: Fixed = (64 * FRACUNIT) | 0;

// ── Geometry constants ──────────────────────────────────────────────

/** TRACEANGLE from p_enemy.c: `0xc000000`, the revenant tracer turn step. */
export const TRACEANGLE: Angle = 0xc000000;

/** FATSPREAD from p_enemy.c: `ANG90 / 8`, the mancubus missile fan arc. */
export const FATSPREAD: Angle = (0x4000_0000 / 8) | 0;

/** SKULLSPEED from p_enemy.c: `20 * FRACUNIT`, lost-soul flight speed. */
export const SKULLSPEED: Fixed = (20 * FRACUNIT) | 0;

/** Revenant missile vertical launch offset: `16 * FRACUNIT`. */
export const SKEL_MISSILE_Z_OFFSET: Fixed = (16 * FRACUNIT) | 0;

/** A_Fire horizontal offset from tracer center: `24 * FRACUNIT`. */
export const FIRE_OFFSET: Fixed = (24 * FRACUNIT) | 0;

/** Pain elemental skull spawn z offset: `8 * FRACUNIT`. */
export const PAIN_SKULL_Z_OFFSET: Fixed = (8 * FRACUNIT) | 0;

/** Pain elemental skull base prestep distance: `4 * FRACUNIT`. */
export const PAIN_SKULL_PRESTEP_BASE: Fixed = (4 * FRACUNIT) | 0;

/** A_Tracer SMOKE upward momentum seeded per smoke puff: `FRACUNIT`. */
export const SMOKE_MOMZ: Fixed = FRACUNIT;

/** A_Tracer slope adjust step per tic: `FRACUNIT / 8`. */
export const TRACER_SLOPE_STEP: Fixed = (FRACUNIT / 8) | 0;

/** A_Tracer slope target z offset from dest: `40 * FRACUNIT`. */
export const TRACER_SLOPE_Z_OFFSET: Fixed = (40 * FRACUNIT) | 0;

// ── Damage constants ────────────────────────────────────────────────

/** A_VileAttack direct damage (scorched): `20`. */
export const VILE_ATTACK_DAMAGE = 20;

/** A_VileAttack splash radius damage cap: `70`. */
export const VILE_RADIUS_ATTACK_DAMAGE = 70;

/** A_VileAttack victim momz numerator: `1000 * FRACUNIT` (divided by mass). */
export const VILE_VICTIM_MOMZ_NUMERATOR: Fixed = (1000 * FRACUNIT) | 0;

/** A_PainShootSkull hard cap on total MT_SKULL thinkers (`> 20` aborts). */
export const MAX_SKULLS_PER_LEVEL = 20;

/** Lethal damage applied to a skull whose first tryMove is blocked. */
export const PAIN_SKULL_KILL_DAMAGE = 10000;

/** Tic jitter mask shared with P_CheckMissileSpawn / P_ExplodeMissile. */
export const MISSILE_TIC_JITTER_MASK = 3;

/** A_CPosRefire P_Random threshold: below this → keep firing. */
export const CPOS_REFIRE_THRESHOLD = 40;

/** A_SpidRefire P_Random threshold: below this → keep firing. */
export const SPID_REFIRE_THRESHOLD = 10;

/** A_Tracer fires only on tics where `(gametic & TRACER_TIC_MASK) === 0`. */
export const TRACER_TIC_MASK = 3;

// ── SFX constants ───────────────────────────────────────────────────

/** sfx_pistol (sounds.h index 1). */
export const SFX_PISTOL = 1;

/** sfx_shotgn (sounds.h index 2). */
export const SFX_SHOTGN = 2;

/** sfx_skepch (sounds.h index 53). */
export const SFX_SKEPCH = 53;

/** sfx_vilatk (sounds.h index 54). */
export const SFX_VILATK = 54;

/** sfx_claw (sounds.h index 55). */
export const SFX_CLAW = 55;

/** sfx_skeswg (sounds.h index 56). */
export const SFX_SKESWG = 56;

/** sfx_barexp (sounds.h index 82). */
export const SFX_BAREXP = 82;

/** sfx_flame (sounds.h index 91). */
export const SFX_FLAME = 91;

/** sfx_flamst (sounds.h index 92). */
export const SFX_FLAMST = 92;

/** sfx_manatk (sounds.h index 99). */
export const SFX_MANATK = 99;

// ── Callback types ──────────────────────────────────────────────────

/** Callback matching P_SpawnMobj(x, y, z, type). */
export type SpawnMobjFunction = (x: Fixed, y: Fixed, z: Fixed, type: MobjType) => Mobj;

/** Callback matching P_TryMove(thing, x, y).  Returns false when blocked. */
export type TryMoveFunction = (mobj: Mobj, x: Fixed, y: Fixed) => boolean;

/** Callback matching P_DamageMobj(target, inflictor, source, damage). */
export type DamageMobjFunction = (target: Mobj, inflictor: Mobj | null, source: Mobj | null, damage: number) => void;

/** Callback matching P_LineAttack(shooter, angle, range, slope, damage). */
export type LineAttackFunction = (shooter: Mobj, angle: Angle, range: Fixed, slope: Fixed, damage: number) => void;

/** Result of P_AimLineAttack — slope + optional locked target. */
export interface AimLineAttackResult {
  slope: Fixed;
  target: Mobj | null;
}

/** Callback matching P_AimLineAttack(shooter, angle, range). */
export type AimLineAttackFunction = (shooter: Mobj, angle: Angle, range: Fixed) => AimLineAttackResult;

/** Callback matching P_RadiusAttack(spot, source, damage). */
export type RadiusAttackFunction = (spot: Mobj, source: Mobj, damage: number) => void;

/** Callback matching R_PointToAngle2(x1, y1, x2, y2). */
export type PointToAngle2Function = (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed) => Angle;

/** Callback matching S_StartSound(origin, sfxId). */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

// ── Context ─────────────────────────────────────────────────────────

/**
 * Shared dependencies required by monster attack actions.  All fields
 * match the globals / primitives the C reference reads from.
 */
export interface MonsterAttackContext {
  rng: DoomRandom;
  thinkerList: ThinkerList;
  targetingContext: TargetingContext;
  spawnMobj: SpawnMobjFunction;
  tryMove: TryMoveFunction;
  damageMobj: DamageMobjFunction;
  lineAttack: LineAttackFunction;
  aimLineAttack: AimLineAttackFunction;
  radiusAttack: RadiusAttackFunction;
  pointToAngle2: PointToAngle2Function;
  startSound: StartSoundFunction | null;
  gametic: () => number;
}

const MISSING_MONSTER_ATTACK_CONTEXT_ERROR = 'Monster attack context not set';

function throwMissingMonsterAttackContext(): never {
  throw new Error(MISSING_MONSTER_ATTACK_CONTEXT_ERROR);
}

const MISSING_MONSTER_ATTACK_CONTEXT = {
  get aimLineAttack(): AimLineAttackFunction {
    return throwMissingMonsterAttackContext();
  },
  get damageMobj(): DamageMobjFunction {
    return throwMissingMonsterAttackContext();
  },
  gametic: () => throwMissingMonsterAttackContext(),
  get lineAttack(): LineAttackFunction {
    return throwMissingMonsterAttackContext();
  },
  get pointToAngle2(): PointToAngle2Function {
    return throwMissingMonsterAttackContext();
  },
  get radiusAttack(): RadiusAttackFunction {
    return throwMissingMonsterAttackContext();
  },
  get rng(): DoomRandom {
    return throwMissingMonsterAttackContext();
  },
  get spawnMobj(): SpawnMobjFunction {
    return throwMissingMonsterAttackContext();
  },
  get startSound(): StartSoundFunction | null {
    return throwMissingMonsterAttackContext();
  },
  get thinkerList(): ThinkerList {
    return throwMissingMonsterAttackContext();
  },
  get targetingContext(): TargetingContext {
    return throwMissingMonsterAttackContext();
  },
  get tryMove(): TryMoveFunction {
    return throwMissingMonsterAttackContext();
  },
} satisfies MonsterAttackContext;

let context: MonsterAttackContext = MISSING_MONSTER_ATTACK_CONTEXT;
let hasContext = false;

/** Install the shared context used by all monster attack actions. */
export function setMonsterAttackContext(ctx: MonsterAttackContext): void {
  context = ctx;
  hasContext = true;
}

/** Retrieve the current context (for testing inspection). */
export function getMonsterAttackContext(): MonsterAttackContext | null {
  return hasContext ? context : null;
}

// ── Internal helpers ────────────────────────────────────────────────

/**
 * P_CheckMissileSpawn: tic jitter + half-move + explode-on-block.
 *
 * Inlined rather than imported from projectiles.ts to keep monster
 * attacks decoupled from the player projectile context.
 */
function checkMissileSpawn(missile: Mobj): void {
  if (!context) return;

  missile.tics = (missile.tics - (context.rng.pRandom() & MISSILE_TIC_JITTER_MASK)) | 0;
  if (missile.tics < 1) missile.tics = 1;

  missile.x = (missile.x + (missile.momx >> 1)) | 0;
  missile.y = (missile.y + (missile.momy >> 1)) | 0;
  missile.z = (missile.z + (missile.momz >> 1)) | 0;

  if (!context.tryMove(missile, missile.x, missile.y)) {
    explodeMissile(missile);
  }
}

/**
 * P_ExplodeMissile: zero momenta, death state, jitter, clear MF_MISSILE.
 */
function explodeMissile(mobj: Mobj): void {
  if (!context) return;

  mobj.momx = 0;
  mobj.momy = 0;
  mobj.momz = 0;

  const deathstate: StateNum = (mobj.info?.deathstate ?? StateNum.NULL) as StateNum;
  setMobjState(mobj, deathstate, context.thinkerList);

  mobj.tics = (mobj.tics - (context.rng.pRandom() & MISSILE_TIC_JITTER_MASK)) | 0;
  if (mobj.tics < 1) mobj.tics = 1;

  mobj.flags = (mobj.flags & ~MF_MISSILE) | 0;

  const deathsound = mobj.info?.deathsound ?? 0;
  if (deathsound && context.startSound) {
    context.startSound(mobj, deathsound);
  }
}

/**
 * P_SpawnMissile from p_mobj.c: source→dest missile with computed
 * angle, momx/momy, momz derived from vertical delta / distance.
 *
 * Parity-critical:
 * - Spawn z is `source.z + 32*FRACUNIT`.
 * - Angle is `R_PointToAngle2(source, dest)`; if dest has MF_SHADOW the
 *   angle is nudged by `(P_SubRandom() << 20)` (one RNG pair consumed).
 * - Distance is the octagonal P_AproxDistance, then divided by
 *   `speed`; min 1 to avoid div-by-zero in the momz formula.
 * - seesound plays on the missile before checkMissileSpawn.
 */
function spawnMissile(source: Mobj, dest: Mobj, type: MobjType): Mobj {
  if (!context) {
    throw new Error('spawnMissile: monster attack context not set');
  }

  const spawnZ = (source.z + ((32 * FRACUNIT) | 0)) | 0;
  const missile = context.spawnMobj(source.x, source.y, spawnZ, type);

  const seesound = missile.info?.seesound ?? 0;
  if (seesound && context.startSound) {
    context.startSound(missile, seesound);
  }

  missile.target = source;
  let an: Angle = context.pointToAngle2(source.x, source.y, dest.x, dest.y);
  if ((dest.flags & MF_SHADOW) !== 0) {
    an = (an + (context.rng.pSubRandom() << 20)) >>> 0;
  }
  missile.angle = an;

  const fineIndex = an >>> ANGLETOFINESHIFT;
  const speed: Fixed = missile.info?.speed ?? 0;
  missile.momx = fixedMul(speed, finecosine[fineIndex]!);
  missile.momy = fixedMul(speed, finesine[fineIndex]!);

  let dist = approxDistance((dest.x - source.x) | 0, (dest.y - source.y) | 0);
  let steps = speed !== 0 ? (dist / speed) | 0 : 1;
  if (steps < 1) steps = 1;
  missile.momz = (((dest.z - source.z) | 0) / steps) | 0;

  checkMissileSpawn(missile);

  return missile;
}

/**
 * P_SpawnPuff: spawn an MT_PUFF at (x, y, z) with `tics -= P_Random()&3`
 * jitter.  Used by A_Tracer for the smoke trail; matches p_map.c.
 */
function spawnPuff(x: Fixed, y: Fixed, z: Fixed): Mobj {
  if (!context) {
    throw new Error('spawnPuff: monster attack context not set');
  }
  const puff = context.spawnMobj(x, y, z, MobjType.PUFF);
  puff.tics = (puff.tics - (context.rng.pRandom() & MISSILE_TIC_JITTER_MASK)) | 0;
  if (puff.tics < 1) puff.tics = 1;
  return puff;
}

/**
 * P_SubstNullMobj: the C reference substitutes a dummy mobj for null
 * targets so the spawnMissile call does not crash.  In TypeScript we
 * surface the null-early-return defensively; every monster state chain
 * that reaches a FatAttack has A_FaceTarget already called which would
 * have early-returned on null.
 */
function guardTarget(actor: Mobj): Mobj | null {
  return actor.target;
}

// ── A_FaceTarget ────────────────────────────────────────────────────

/**
 * A_FaceTarget from p_enemy.c.
 *
 * Clears MF_AMBUSH, snaps `actor.angle` via R_PointToAngle2, and adds
 * `P_SubRandom() << 21` jitter ONLY when the target has MF_SHADOW.  The
 * RNG is consumed iff MF_SHADOW is set (not on every call).
 */
export function aFaceTarget(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  actor.flags = (actor.flags & ~MF_AMBUSH) | 0;
  actor.angle = context.pointToAngle2(actor.x, actor.y, actor.target.x, actor.target.y);

  if ((actor.target.flags & MF_SHADOW) !== 0) {
    actor.angle = (actor.angle + (context.rng.pSubRandom() << 21)) >>> 0;
  }
}

// ── A_PosAttack ─────────────────────────────────────────────────────

/**
 * A_PosAttack from p_enemy.c: zombieman pistol shot.
 *
 * RNG order: face (possible MF_SHADOW roll) → P_AimLineAttack (map-side)
 * → P_SubRandom pair for angle spread → P_Random for damage roll.
 */
export function aPosAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  const bangle: Angle = actor.angle >>> 0;
  const aimResult = context.aimLineAttack(actor, bangle, MISSILERANGE);
  const slope: Fixed = aimResult.slope;

  if (context.startSound) {
    context.startSound(actor, SFX_PISTOL);
  }
  const angle: Angle = (bangle + (context.rng.pSubRandom() << 20)) >>> 0;
  const damage = ((context.rng.pRandom() % 5) + 1) * 3;
  context.lineAttack(actor, angle, MISSILERANGE, slope, damage);
}

// ── A_SPosAttack ────────────────────────────────────────────────────

/**
 * A_SPosAttack from p_enemy.c: sergeant shotgun — three pellets.
 *
 * RNG order per pellet: angle spread first, then damage roll.  Aim is
 * cached once via the pre-loop P_AimLineAttack.
 */
export function aSPosAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  if (context.startSound) {
    context.startSound(actor, SFX_SHOTGN);
  }
  aFaceTarget(actor);
  const bangle: Angle = actor.angle >>> 0;
  const aimResult = context.aimLineAttack(actor, bangle, MISSILERANGE);
  const slope: Fixed = aimResult.slope;

  for (let i = 0; i < 3; i++) {
    const angle: Angle = (bangle + (context.rng.pSubRandom() << 20)) >>> 0;
    const damage = ((context.rng.pRandom() % 5) + 1) * 3;
    context.lineAttack(actor, angle, MISSILERANGE, slope, damage);
  }
}

// ── A_CPosAttack ────────────────────────────────────────────────────

/**
 * A_CPosAttack from p_enemy.c: heavy-weapon dude single shot (one burst
 * tick fires one bullet; A_CPosRefire keeps the burst going).
 */
export function aCPosAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  if (context.startSound) {
    context.startSound(actor, SFX_SHOTGN);
  }
  aFaceTarget(actor);
  const bangle: Angle = actor.angle >>> 0;
  const aimResult = context.aimLineAttack(actor, bangle, MISSILERANGE);
  const slope: Fixed = aimResult.slope;

  const angle: Angle = (bangle + (context.rng.pSubRandom() << 20)) >>> 0;
  const damage = ((context.rng.pRandom() % 5) + 1) * 3;
  context.lineAttack(actor, angle, MISSILERANGE, slope, damage);
}

// ── A_CPosRefire ────────────────────────────────────────────────────

/**
 * A_CPosRefire from p_enemy.c: keep firing unless out of sight.
 *
 * Calls A_FaceTarget, then rolls `P_Random()`; if the roll is below
 * {@link CPOS_REFIRE_THRESHOLD} the actor stays in the attack state.
 * Otherwise, if target is null/dead or sight is lost, drop to seestate.
 */
export function aCPosRefire(actor: Mobj): void {
  if (!context) return;

  aFaceTarget(actor);

  if (context.rng.pRandom() < CPOS_REFIRE_THRESHOLD) return;

  if (actor.target === null || actor.target.health <= 0 || !checkSight(actor, actor.target, context.targetingContext)) {
    const seestate: StateNum = (actor.info?.seestate ?? StateNum.NULL) as StateNum;
    setMobjState(actor, seestate, context.thinkerList);
  }
}

// ── A_SpidRefire ────────────────────────────────────────────────────

/**
 * A_SpidRefire from p_enemy.c: same shape as A_CPosRefire with a lower
 * stop threshold ({@link SPID_REFIRE_THRESHOLD}) — the spider stays in
 * its chaingun burst longer than the heavy-weapon dude.
 */
export function aSpidRefire(actor: Mobj): void {
  if (!context) return;

  aFaceTarget(actor);

  if (context.rng.pRandom() < SPID_REFIRE_THRESHOLD) return;

  if (actor.target === null || actor.target.health <= 0 || !checkSight(actor, actor.target, context.targetingContext)) {
    const seestate: StateNum = (actor.info?.seestate ?? StateNum.NULL) as StateNum;
    setMobjState(actor, seestate, context.thinkerList);
  }
}

// ── A_BspiAttack ────────────────────────────────────────────────────

/** A_BspiAttack from p_enemy.c: arachnotron plasma ball. */
export function aBspiAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  spawnMissile(actor, actor.target, MobjType.ARACHPLAZ);
}

// ── A_TroopAttack ───────────────────────────────────────────────────

/**
 * A_TroopAttack from p_enemy.c: imp.  Melee if in range (3..24 damage),
 * otherwise spawn MT_TROOPSHOT.
 */
export function aTroopAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  if (checkMeleeRange(actor, context.targetingContext)) {
    if (context.startSound) context.startSound(actor, SFX_CLAW);
    const damage = ((context.rng.pRandom() % 8) + 1) * 3;
    context.damageMobj(actor.target, actor, actor, damage);
    return;
  }

  spawnMissile(actor, actor.target, MobjType.TROOPSHOT);
}

// ── A_SargAttack ────────────────────────────────────────────────────

/**
 * A_SargAttack from p_enemy.c: demon / spectre bite.
 *
 * 1.9 behavior: A_FaceTarget, check melee range (bail if out of range),
 * then `((P_Random() % 10) + 1) * 4` damage.  The 1.2 code-path
 * (P_LineAttack substitute) is not emulated — our gameversion is fixed
 * at 1.9.  The RNG is consumed ONLY when melee range holds.
 */
export function aSargAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  if (!checkMeleeRange(actor, context.targetingContext)) return;

  const damage = ((context.rng.pRandom() % 10) + 1) * 4;
  context.damageMobj(actor.target, actor, actor, damage);
}

// ── A_HeadAttack ────────────────────────────────────────────────────

/**
 * A_HeadAttack from p_enemy.c: cacodemon.  Melee deals 10..60, otherwise
 * spawn MT_HEADSHOT.
 */
export function aHeadAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  if (checkMeleeRange(actor, context.targetingContext)) {
    const damage = ((context.rng.pRandom() % 6) + 1) * 10;
    context.damageMobj(actor.target, actor, actor, damage);
    return;
  }

  spawnMissile(actor, actor.target, MobjType.HEADSHOT);
}

// ── A_CyberAttack ───────────────────────────────────────────────────

/** A_CyberAttack from p_enemy.c: cyberdemon rocket. */
export function aCyberAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  spawnMissile(actor, actor.target, MobjType.ROCKET);
}

// ── A_BruisAttack ───────────────────────────────────────────────────

/**
 * A_BruisAttack from p_enemy.c: baron / knight.
 *
 * Parity quirk: does NOT call A_FaceTarget before the melee check —
 * the state-transition angle is used as-is.  Melee: sfx_claw +
 * `((P_Random() % 8) + 1) * 10` damage.  Missile fallback:
 * MT_BRUISERSHOT (used by both BRUISER and KNIGHT — they share
 * BOSS_ATK1..3 states).
 */
export function aBruisAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  if (checkMeleeRange(actor, context.targetingContext)) {
    if (context.startSound) context.startSound(actor, SFX_CLAW);
    const damage = ((context.rng.pRandom() % 8) + 1) * 10;
    context.damageMobj(actor.target, actor, actor, damage);
    return;
  }

  spawnMissile(actor, actor.target, MobjType.BRUISERSHOT);
}

// ── A_SkelMissile ───────────────────────────────────────────────────

/**
 * A_SkelMissile from p_enemy.c: revenant tracer launch.
 *
 * Temporarily raises actor.z by {@link SKEL_MISSILE_Z_OFFSET}, spawns
 * MT_TRACER, restores actor.z, nudges the tracer forward by one step
 * of momentum so it clears the skeleton's bounding box, and sets
 * `mo.tracer = actor.target` so A_Tracer can home on it.
 */
export function aSkelMissile(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  actor.z = (actor.z + SKEL_MISSILE_Z_OFFSET) | 0;
  const mo = spawnMissile(actor, actor.target, MobjType.TRACER);
  actor.z = (actor.z - SKEL_MISSILE_Z_OFFSET) | 0;

  mo.x = (mo.x + mo.momx) | 0;
  mo.y = (mo.y + mo.momy) | 0;
  mo.tracer = actor.target;
}

// ── A_Tracer ────────────────────────────────────────────────────────

/**
 * A_Tracer from p_enemy.c: revenant tracer homing.
 *
 * Only runs when `(gametic & 3) === 0`.  Spawns a puff + smoke trail,
 * then turns toward `actor.tracer` using {@link TRACEANGLE} steps, and
 * biases momz by ±{@link TRACER_SLOPE_STEP} toward the target's centerline.
 */
export function aTracer(actor: Mobj): void {
  if (!context) return;
  if ((context.gametic() & TRACER_TIC_MASK) !== 0) return;

  spawnPuff(actor.x, actor.y, actor.z);

  const smoke = context.spawnMobj((actor.x - actor.momx) | 0, (actor.y - actor.momy) | 0, actor.z, MobjType.SMOKE);
  smoke.momz = SMOKE_MOMZ;
  smoke.tics = (smoke.tics - (context.rng.pRandom() & MISSILE_TIC_JITTER_MASK)) | 0;
  if (smoke.tics < 1) smoke.tics = 1;

  const dest = actor.tracer;
  if (dest === null || dest.health <= 0) return;

  const exact: Angle = context.pointToAngle2(actor.x, actor.y, dest.x, dest.y);
  if (exact !== actor.angle >>> 0) {
    const delta = (exact - actor.angle) >>> 0;
    if (delta > 0x80000000) {
      actor.angle = (actor.angle - TRACEANGLE) >>> 0;
      if ((exact - actor.angle) >>> 0 < 0x80000000) {
        actor.angle = exact;
      }
    } else {
      actor.angle = (actor.angle + TRACEANGLE) >>> 0;
      if ((exact - actor.angle) >>> 0 > 0x80000000) {
        actor.angle = exact;
      }
    }
  }

  const fineIndex = (actor.angle >>> 0) >>> ANGLETOFINESHIFT;
  const speed: Fixed = actor.info?.speed ?? 0;
  actor.momx = fixedMul(speed, finecosine[fineIndex]!);
  actor.momy = fixedMul(speed, finesine[fineIndex]!);

  let dist = approxDistance((dest.x - actor.x) | 0, (dest.y - actor.y) | 0);
  let steps = speed !== 0 ? (dist / speed) | 0 : 1;
  if (steps < 1) steps = 1;
  const targetZ = (dest.z + TRACER_SLOPE_Z_OFFSET) | 0;
  const slope = (((targetZ - actor.z) | 0) / steps) | 0;

  if (slope < actor.momz) {
    actor.momz = (actor.momz - TRACER_SLOPE_STEP) | 0;
  } else {
    actor.momz = (actor.momz + TRACER_SLOPE_STEP) | 0;
  }
}

// ── A_SkelWhoosh ────────────────────────────────────────────────────

/** A_SkelWhoosh from p_enemy.c: revenant melee swing sound. */
export function aSkelWhoosh(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;
  aFaceTarget(actor);
  if (context.startSound) context.startSound(actor, SFX_SKESWG);
}

// ── A_SkelFist ──────────────────────────────────────────────────────

/**
 * A_SkelFist from p_enemy.c: revenant melee hit.
 *
 * If in range, plays sfx_skepch and deals `((P_Random() % 10) + 1) * 6`
 * damage (6..60).  Misses are silent — no punch-in-air sound.
 */
export function aSkelFist(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);

  if (checkMeleeRange(actor, context.targetingContext)) {
    const damage = ((context.rng.pRandom() % 10) + 1) * 6;
    if (context.startSound) context.startSound(actor, SFX_SKEPCH);
    context.damageMobj(actor.target, actor, actor, damage);
  }
}

// ── A_VileStart ─────────────────────────────────────────────────────

/** A_VileStart from p_enemy.c: archvile attack scream. */
export function aVileStart(actor: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(actor, SFX_VILATK);
}

// ── A_Fire ──────────────────────────────────────────────────────────

/**
 * A_Fire from p_enemy.c: keep the hellfire sprite 24 units in front of
 * the target each tic.  Returns silently if the actor has no tracer
 * (vile's tracer), or if the vile lost sight — the fire freezes in
 * place until the sight returns.
 *
 * The C code unsets/resets the thing position around the mutation; we
 * mutate in place because no blockmap linking happens yet at this
 * phase.  (P_UnsetThingPosition / P_SetThingPosition are wired by the
 * blockmap integration step and will pick up these coordinates next
 * tic.)
 */
export function aFire(actor: Mobj): void {
  if (!context) return;

  const dest = actor.tracer;
  if (dest === null) return;
  const target = actor.target;
  if (target === null) return;

  if (!checkSight(target, dest, context.targetingContext)) return;

  const fineIndex = (dest.angle >>> 0) >>> ANGLETOFINESHIFT;
  actor.x = (dest.x + fixedMul(FIRE_OFFSET, finecosine[fineIndex]!)) | 0;
  actor.y = (dest.y + fixedMul(FIRE_OFFSET, finesine[fineIndex]!)) | 0;
  actor.z = dest.z;
}

// ── A_StartFire ─────────────────────────────────────────────────────

/** A_StartFire from p_enemy.c: sfx_flamst + A_Fire. */
export function aStartFire(actor: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(actor, SFX_FLAMST);
  aFire(actor);
}

// ── A_FireCrackle ───────────────────────────────────────────────────

/** A_FireCrackle from p_enemy.c: sfx_flame + A_Fire. */
export function aFireCrackle(actor: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(actor, SFX_FLAME);
  aFire(actor);
}

// ── A_VileTarget ────────────────────────────────────────────────────

/**
 * A_VileTarget from p_enemy.c: spawn the hellfire sprite on the target.
 *
 * Parity-critical vanilla bug: `P_SpawnMobj(target.x, target.x, target.z,
 * MT_FIRE)` — the y argument is `target.x`, not `target.y`.  The bug is
 * usually cosmetic because A_Fire immediately corrects position each
 * tic, but in corner-spawn scenarios it briefly places the fog at
 * (target.x, target.x).  We preserve the typo byte-for-byte.
 */
export function aVileTarget(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);

  const fog = context.spawnMobj(actor.target.x, actor.target.x, actor.target.z, MobjType.FIRE);

  actor.tracer = fog;
  fog.target = actor;
  fog.tracer = actor.target;
  aFire(fog);
}

// ── A_VileAttack ────────────────────────────────────────────────────

/**
 * A_VileAttack from p_enemy.c: archvile direct + splash damage + launch.
 *
 * RNG order: A_FaceTarget (possible MF_SHADOW roll) → CheckSight (no
 * RNG) → sfx_barexp → damageMobj 20 → victim.momz = 1000*FRACUNIT/mass
 * → radiusAttack(fire, actor, 70).  The radius attack uses the fire
 * mobj as the spot but `actor` as the damage source.
 */
export function aVileAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  aFaceTarget(actor);
  if (!checkSight(actor, actor.target, context.targetingContext)) return;

  if (context.startSound) context.startSound(actor, SFX_BAREXP);
  context.damageMobj(actor.target, actor, actor, VILE_ATTACK_DAMAGE);

  const mass = actor.target.info?.mass ?? 0;
  if (mass !== 0) {
    actor.target.momz = ((VILE_VICTIM_MOMZ_NUMERATOR / mass) | 0) as Fixed;
  }

  const fineIndex = (actor.angle >>> 0) >>> ANGLETOFINESHIFT;

  const fire = actor.tracer;
  if (fire === null) return;

  fire.x = (actor.target.x - fixedMul(FIRE_OFFSET, finecosine[fineIndex]!)) | 0;
  fire.y = (actor.target.y - fixedMul(FIRE_OFFSET, finesine[fineIndex]!)) | 0;
  context.radiusAttack(fire, actor, VILE_RADIUS_ATTACK_DAMAGE);
}

// ── A_FatRaise ──────────────────────────────────────────────────────

/** A_FatRaise from p_enemy.c: mancubus pre-fire telegraph. */
export function aFatRaise(actor: Mobj): void {
  if (!context) return;
  aFaceTarget(actor);
  if (context.startSound) context.startSound(actor, SFX_MANATK);
}

// ── A_FatAttack1 ────────────────────────────────────────────────────

/**
 * A_FatAttack1 from p_enemy.c: mancubus first fan shot.
 *
 * 1. A_FaceTarget.
 * 2. `actor.angle += FATSPREAD` (persists on the actor).
 * 3. Spawn missile #1 toward target — uses the now-rotated actor.angle
 *    to compute the firing angle via P_SpawnMissile.
 * 4. Spawn missile #2 toward target, then `mo.angle += FATSPREAD`
 *    and recompute mo.momx/y from the new angle (WITHOUT touching
 *    actor.angle).
 *
 * Net: three shots land at angles baseline+FATSPREAD (shot 1),
 * baseline+FATSPREAD (shot 2 centerline), baseline+2*FATSPREAD (shot 2
 * after its own rotation).  A_FatAttack2 fires the mirror set,
 * A_FatAttack3 fires ±FATSPREAD/2.
 */
export function aFatAttack1(actor: Mobj): void {
  if (!context) return;

  aFaceTarget(actor);

  actor.angle = (actor.angle + FATSPREAD) >>> 0;
  const target = guardTarget(actor);
  if (target === null) return;
  spawnMissile(actor, target, MobjType.FATSHOT);

  const mo = spawnMissile(actor, target, MobjType.FATSHOT);
  mo.angle = (mo.angle + FATSPREAD) >>> 0;
  const an = (mo.angle >>> 0) >>> ANGLETOFINESHIFT;
  const speed: Fixed = mo.info?.speed ?? 0;
  mo.momx = fixedMul(speed, finecosine[an]!);
  mo.momy = fixedMul(speed, finesine[an]!);
}

// ── A_FatAttack2 ────────────────────────────────────────────────────

/**
 * A_FatAttack2 from p_enemy.c: mancubus second fan shot.
 *
 * Mirrors A_FatAttack1 with -FATSPREAD and -FATSPREAD*2 on the second
 * missile's own angle.
 */
export function aFatAttack2(actor: Mobj): void {
  if (!context) return;

  aFaceTarget(actor);

  actor.angle = (actor.angle - FATSPREAD) >>> 0;
  const target = guardTarget(actor);
  if (target === null) return;
  spawnMissile(actor, target, MobjType.FATSHOT);

  const mo = spawnMissile(actor, target, MobjType.FATSHOT);
  mo.angle = (mo.angle - FATSPREAD * 2) >>> 0;
  const an = (mo.angle >>> 0) >>> ANGLETOFINESHIFT;
  const speed: Fixed = mo.info?.speed ?? 0;
  mo.momx = fixedMul(speed, finecosine[an]!);
  mo.momy = fixedMul(speed, finesine[an]!);
}

// ── A_FatAttack3 ────────────────────────────────────────────────────

/**
 * A_FatAttack3 from p_enemy.c: mancubus centerline pair (±FATSPREAD/2).
 *
 * Does NOT change actor.angle — both missiles inherit the base angle
 * and then shift their own direction after spawn.
 */
export function aFatAttack3(actor: Mobj): void {
  if (!context) return;

  aFaceTarget(actor);

  const target = guardTarget(actor);
  if (target === null) return;

  let mo = spawnMissile(actor, target, MobjType.FATSHOT);
  mo.angle = (mo.angle - FATSPREAD / 2) >>> 0;
  let an = (mo.angle >>> 0) >>> ANGLETOFINESHIFT;
  let speed: Fixed = mo.info?.speed ?? 0;
  mo.momx = fixedMul(speed, finecosine[an]!);
  mo.momy = fixedMul(speed, finesine[an]!);

  mo = spawnMissile(actor, target, MobjType.FATSHOT);
  mo.angle = (mo.angle + FATSPREAD / 2) >>> 0;
  an = (mo.angle >>> 0) >>> ANGLETOFINESHIFT;
  speed = mo.info?.speed ?? 0;
  mo.momx = fixedMul(speed, finecosine[an]!);
  mo.momy = fixedMul(speed, finesine[an]!);
}

// ── A_SkullAttack ───────────────────────────────────────────────────

/**
 * A_SkullAttack from p_enemy.c: lost soul leap.
 *
 * Sets MF_SKULLFLY, plays `info.attacksound` (sfx_sklatk=51 for MT_SKULL),
 * faces target, launches at {@link SKULLSPEED}, and sets momz from the
 * target's center (z + height/2) divided by the estimated-step distance.
 */
export function aSkullAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;

  const dest = actor.target;
  actor.flags = actor.flags | MF_SKULLFLY | 0;

  const attacksound = actor.info?.attacksound ?? 0;
  if (attacksound && context.startSound) {
    context.startSound(actor, attacksound);
  }
  aFaceTarget(actor);

  const fineIndex = (actor.angle >>> 0) >>> ANGLETOFINESHIFT;
  actor.momx = fixedMul(SKULLSPEED, finecosine[fineIndex]!);
  actor.momy = fixedMul(SKULLSPEED, finesine[fineIndex]!);

  let dist = approxDistance((dest.x - actor.x) | 0, (dest.y - actor.y) | 0);
  let steps = (dist / SKULLSPEED) | 0;
  if (steps < 1) steps = 1;
  const targetCenterZ = (dest.z + (dest.height >> 1)) | 0;
  actor.momz = (((targetCenterZ - actor.z) | 0) / steps) | 0;
}

// ── A_PainShootSkull ────────────────────────────────────────────────

/**
 * A_PainShootSkull from p_enemy.c: pain elemental spits a lost soul.
 *
 * Counts every live thinker whose `action === mobjThinker` AND whose
 * `type === MT_SKULL`; if the count exceeds {@link MAX_SKULLS_PER_LEVEL}
 * (>20, so 21+), aborts before spawning.  Prestep offset is
 * `4*FRACUNIT + 3*(actor.radius + MT_SKULL.radius)/2`.  Z offset is
 * +8*FRACUNIT.  If the newly spawned skull's first tryMove fails, it
 * takes 10000 damage (always fatal) and the function returns.  On
 * success, the skull's target is set to the pain elemental's current
 * target and A_SkullAttack launches it.
 *
 * Not exported as an action function because it takes an explicit
 * angle argument — the state table wires {@link aPainAttack} and the
 * future {@link aPainDie} (phase 11-007) to invoke it.
 */
export function painShootSkull(actor: Mobj, angle: Angle): void {
  if (!context) return;

  let count = 0;
  context.thinkerList.forEach((thinker: ThinkerNode) => {
    if (thinker.action === mobjThinker) {
      if ((thinker as Mobj).type === MobjType.SKULL) count++;
    }
  });

  if (count > MAX_SKULLS_PER_LEVEL) return;

  const fineIndex = (angle >>> 0) >>> ANGLETOFINESHIFT;

  const actorRadius = actor.info?.radius ?? 0;
  const skullRadius = 1048576 as Fixed; // MOBJINFO[MT_SKULL].radius = 16*FRACUNIT = 1048576
  const prestep = (PAIN_SKULL_PRESTEP_BASE + (((3 * (actorRadius + skullRadius)) | 0) >> 1)) | 0;

  const x = (actor.x + fixedMul(prestep, finecosine[fineIndex]!)) | 0;
  const y = (actor.y + fixedMul(prestep, finesine[fineIndex]!)) | 0;
  const z = (actor.z + PAIN_SKULL_Z_OFFSET) | 0;

  const newmobj = context.spawnMobj(x, y, z, MobjType.SKULL);

  if (!context.tryMove(newmobj, newmobj.x, newmobj.y)) {
    context.damageMobj(newmobj, actor, actor, PAIN_SKULL_KILL_DAMAGE);
    return;
  }

  newmobj.target = actor.target;
  aSkullAttack(newmobj);
}

// ── A_PainAttack ────────────────────────────────────────────────────

/** A_PainAttack from p_enemy.c: face target + spit one lost soul forward. */
export function aPainAttack(actor: Mobj): void {
  if (!context) return;
  if (actor.target === null) return;
  aFaceTarget(actor);
  painShootSkull(actor, actor.angle);
}

// ── State action wiring ─────────────────────────────────────────────

/**
 * Number of STATES entries {@link wireMonsterAttackActions} installs
 * actions into.  Matches the total count of attack states across all
 * monster types plus the fire/tracer mobj-state actions.
 *
 * Breakdown:
 * - POSS_ATK1..3 (3)
 * - SPOS_ATK1..3 (3)
 * - CPOS_ATK1..4 (4)
 * - TROO_ATK1..3 (3)
 * - SARG_ATK1..3 (3)
 * - HEAD_ATK1..3 (3)
 * - VILE_ATK1..11 (11)
 * - FIRE1..FIRE30 (30)
 * - TRACER + TRACER2 (2)
 * - SKEL_FIST1..4 (4)
 * - SKEL_MISS1..4 (4)
 * - FATT_ATK1..10 (10)
 * - BOSS_ATK1..3 (3)
 * - SKULL_ATK1..4 (4)
 * - SPID_ATK1..4 (4)
 * - BSPI_ATK1..4 (4)
 * - CYBER_ATK1..6 (6)
 * - PAIN_ATK1..4 (4)
 * Total = 105.
 */
export const MONSTER_ATTACK_ACTION_COUNT = 105;

/**
 * Wire every monster attack action into the STATES table so setMobjState
 * transitions invoke the correct behavior.
 *
 * Must be called once before the game loop runs.  Idempotent — calling
 * twice just reassigns the same action pointers.
 */
export function wireMonsterAttackActions(): void {
  // Zombieman (MT_POSSESSED).
  STATES[StateNum.POSS_ATK1]!.action = aFaceTarget;
  STATES[StateNum.POSS_ATK2]!.action = aPosAttack;
  STATES[StateNum.POSS_ATK3]!.action = aFaceTarget;

  // Shotgun sergeant (MT_SHOTGUY).
  STATES[StateNum.SPOS_ATK1]!.action = aFaceTarget;
  STATES[StateNum.SPOS_ATK2]!.action = aSPosAttack;
  STATES[StateNum.SPOS_ATK3]!.action = aFaceTarget;

  // Heavy-weapon dude (MT_CHAINGUY).
  STATES[StateNum.CPOS_ATK1]!.action = aFaceTarget;
  STATES[StateNum.CPOS_ATK2]!.action = aCPosAttack;
  STATES[StateNum.CPOS_ATK3]!.action = aCPosAttack;
  STATES[StateNum.CPOS_ATK4]!.action = aCPosRefire;

  // Imp (MT_TROOP).
  STATES[StateNum.TROO_ATK1]!.action = aFaceTarget;
  STATES[StateNum.TROO_ATK2]!.action = aFaceTarget;
  STATES[StateNum.TROO_ATK3]!.action = aTroopAttack;

  // Demon / spectre (MT_SERGEANT).
  STATES[StateNum.SARG_ATK1]!.action = aFaceTarget;
  STATES[StateNum.SARG_ATK2]!.action = aFaceTarget;
  STATES[StateNum.SARG_ATK3]!.action = aSargAttack;

  // Cacodemon (MT_HEAD).
  STATES[StateNum.HEAD_ATK1]!.action = aFaceTarget;
  STATES[StateNum.HEAD_ATK2]!.action = aFaceTarget;
  STATES[StateNum.HEAD_ATK3]!.action = aHeadAttack;

  // Archvile (MT_VILE).
  STATES[StateNum.VILE_ATK1]!.action = aVileStart;
  STATES[StateNum.VILE_ATK2]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK3]!.action = aVileTarget;
  STATES[StateNum.VILE_ATK4]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK5]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK6]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK7]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK8]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK9]!.action = aFaceTarget;
  STATES[StateNum.VILE_ATK10]!.action = aVileAttack;
  STATES[StateNum.VILE_ATK11]!.action = aFaceTarget;

  // Hellfire (MT_FIRE).  FIRE1 = A_StartFire; FIRE5/FIRE19 = A_FireCrackle;
  // FIRE30 has nextstate 0 (S_NULL) but also calls A_Fire.  Every other
  // FIRE state calls A_Fire.
  for (let s = StateNum.FIRE1; s <= StateNum.FIRE30; s++) {
    STATES[s]!.action = aFire;
  }
  STATES[StateNum.FIRE1]!.action = aStartFire;
  STATES[StateNum.FIRE5]!.action = aFireCrackle;
  STATES[StateNum.FIRE19]!.action = aFireCrackle;

  // Revenant tracer (MT_TRACER).
  STATES[StateNum.TRACER]!.action = aTracer;
  STATES[StateNum.TRACER2]!.action = aTracer;

  // Revenant (MT_UNDEAD) melee.
  STATES[StateNum.SKEL_FIST1]!.action = aFaceTarget;
  STATES[StateNum.SKEL_FIST2]!.action = aSkelWhoosh;
  STATES[StateNum.SKEL_FIST3]!.action = aFaceTarget;
  STATES[StateNum.SKEL_FIST4]!.action = aSkelFist;

  // Revenant missile launch.
  STATES[StateNum.SKEL_MISS1]!.action = aFaceTarget;
  STATES[StateNum.SKEL_MISS2]!.action = aFaceTarget;
  STATES[StateNum.SKEL_MISS3]!.action = aSkelMissile;
  STATES[StateNum.SKEL_MISS4]!.action = aFaceTarget;

  // Mancubus (MT_FATSO).
  STATES[StateNum.FATT_ATK1]!.action = aFatRaise;
  STATES[StateNum.FATT_ATK2]!.action = aFatAttack1;
  STATES[StateNum.FATT_ATK3]!.action = aFaceTarget;
  STATES[StateNum.FATT_ATK4]!.action = aFaceTarget;
  STATES[StateNum.FATT_ATK5]!.action = aFatAttack2;
  STATES[StateNum.FATT_ATK6]!.action = aFaceTarget;
  STATES[StateNum.FATT_ATK7]!.action = aFaceTarget;
  STATES[StateNum.FATT_ATK8]!.action = aFatAttack3;
  STATES[StateNum.FATT_ATK9]!.action = aFaceTarget;
  STATES[StateNum.FATT_ATK10]!.action = aFaceTarget;

  // Baron / knight (MT_BRUISER / MT_KNIGHT share BOSS_ATK states).
  STATES[StateNum.BOSS_ATK1]!.action = aFaceTarget;
  STATES[StateNum.BOSS_ATK2]!.action = aFaceTarget;
  STATES[StateNum.BOSS_ATK3]!.action = aBruisAttack;

  // Lost soul (MT_SKULL) — SKULL_ATK1 is A_FaceTarget, SKULL_ATK2 launches.
  STATES[StateNum.SKULL_ATK1]!.action = aFaceTarget;
  STATES[StateNum.SKULL_ATK2]!.action = aSkullAttack;
  // SKULL_ATK3/4 are the post-launch glide states; no action.

  // Spider mastermind (MT_SPIDER).
  STATES[StateNum.SPID_ATK1]!.action = aFaceTarget;
  STATES[StateNum.SPID_ATK2]!.action = aSPosAttack;
  STATES[StateNum.SPID_ATK3]!.action = aSPosAttack;
  STATES[StateNum.SPID_ATK4]!.action = aSpidRefire;

  // Arachnotron (MT_BABY).
  STATES[StateNum.BSPI_ATK1]!.action = aFaceTarget;
  STATES[StateNum.BSPI_ATK2]!.action = aBspiAttack;
  STATES[StateNum.BSPI_ATK3]!.action = aSpidRefire;
  STATES[StateNum.BSPI_ATK4]!.action = aSpidRefire;

  // Cyberdemon (MT_CYBORG).
  STATES[StateNum.CYBER_ATK1]!.action = aFaceTarget;
  STATES[StateNum.CYBER_ATK2]!.action = aCyberAttack;
  STATES[StateNum.CYBER_ATK3]!.action = aFaceTarget;
  STATES[StateNum.CYBER_ATK4]!.action = aCyberAttack;
  STATES[StateNum.CYBER_ATK5]!.action = aFaceTarget;
  STATES[StateNum.CYBER_ATK6]!.action = aCyberAttack;

  // Pain elemental (MT_PAIN).
  STATES[StateNum.PAIN_ATK1]!.action = aFaceTarget;
  STATES[StateNum.PAIN_ATK2]!.action = aFaceTarget;
  STATES[StateNum.PAIN_ATK3]!.action = aPainAttack;
  STATES[StateNum.PAIN_ATK4]!.action = aFaceTarget;
}
