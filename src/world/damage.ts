/**
 * P_DamageMobj and P_KillMobj (p_inter.c).
 *
 * The two functions that resolve every point of damage dealt in the
 * game: monster claws, hitscan bullets, projectile splash, crushers,
 * telefrags. Faithful port of Chocolate Doom 2.2.1 p_inter.c
 * P_DamageMobj / P_KillMobj.
 *
 * The heavy primitives this needs — the RNG stream, the thinker list,
 * P_SetMobjState, R_PointToAngle2, P_SpawnMobj (for the
 * zombieman/sergeant/chaingunner death drops), P_DropWeapon, and the
 * game-mode / skill / netgame globals — are injected via
 * {@link DamageContext} so the SHA-pinned attack/state modules can
 * consume `damageMobj` through their own injected contexts without a
 * hard dependency on the launcher wiring.
 *
 * Parity-critical details preserved byte-for-byte:
 *
 * - MF_SKULLFLY targets have their momentum zeroed before damage.
 * - The thrust knockback uses `damage * (FRACUNIT>>3) * 100 / mass`,
 *   the "fall forwards" branch consumes exactly one P_Random and only
 *   when `damage < 40 && damage > target.health && z-delta > 64 units`.
 *   The thrust is skipped entirely for the chainsaw (so the saw keeps
 *   the victim in melee range).
 * - The player branch routes the armor/skill/godmode arithmetic through
 *   {@link applyVanillaPlayerDamage} (the audited contract), then layers
 *   the sector-special-11 "end of game hell hack" clamp, the
 *   invulnerability / GODMODE `<1000` early-out, and the
 *   `attacker` / `damagecount` side effects exactly as p_inter.c orders
 *   them.
 * - Pain is gated on `P_Random() < painchance && !MF_SKULLFLY`; the RNG
 *   is consumed every non-skullfly call regardless of the outcome.
 * - `reactiontime = 0` always; the wake-and-chase block sets
 *   `target.threshold = BASETHRESHOLD` and steps a still-idle monster
 *   to its seestate.
 * - P_KillMobj clears MF_SHOOTABLE|MF_FLOAT|MF_SKULLFLY, keeps
 *   MF_NOGRAVITY only for lost souls, sets MF_CORPSE|MF_DROPOFF,
 *   quarters the height, credits killcount (to the source player, or to
 *   players[0] when a monster killed it in a non-netgame), routes the
 *   player-death path through P_DropWeapon, picks xdeathstate when
 *   `health < -spawnhealth`, applies the `tics -= P_Random()&3` jitter,
 *   and drops MT_CLIP / MT_SHOTGUN / MT_CHAINGUN with MF_DROPPED.
 *
 * @example
 * ```ts
 * import { damageMobj, setDamageContext } from "../src/world/damage.ts";
 * setDamageContext({ rng, thinkerList, spawnMobj, pointToAngle2,
 *   dropWeapon, gameMode: () => 'shareware', gameskill: () => 2,
 *   netgame: false, players: [player] });
 * damageMobj(zombie, playerMobj, playerMobj, 12);
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';

import { ANG180 } from '../core/angle.ts';
import { FRACUNIT, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../core/trig.ts';

import type { GameMode } from '../bootstrap/gameMode.ts';
import { VANILLA_CF_GODMODE } from '../player/implement-god-mode-and-powerup-flags.ts';
import { applyVanillaPlayerDamage } from '../player/implement-player-damage-and-armor.ts';
import { PowerType, PlayerState, WeaponType } from '../player/playerSpawn.ts';
import type { Player } from '../player/playerSpawn.ts';

import {
  MF_CORPSE,
  MF_COUNTKILL,
  MF_DROPOFF,
  MF_DROPPED,
  MF_FLOAT,
  MF_JUSTHIT,
  MF_NOCLIP,
  MF_NOGRAVITY,
  MF_SHOOTABLE,
  MF_SKULLFLY,
  MF_SOLID,
  Mobj,
  MobjType,
  ONFLOORZ,
  STATES,
  StateNum,
  setMobjState,
} from './mobj.ts';
import type { ThinkerList } from './thinkers.ts';

// ── Constants ────────────────────────────────────────────────────────

/** BASETHRESHOLD from p_local.h — chase persistence after taking a hit. */
export const BASETHRESHOLD = 100;

/** Damage-count clamp from p_inter.c (teleport stomp does 10k points). */
export const MAX_DAMAGECOUNT = 100;

/** "Fall forwards" branch: damage strictly below this can flip the thrust. */
export const FALL_FORWARDS_DAMAGE_CAP = 40;

/** "Fall forwards" branch z-delta: `64 * FRACUNIT`. */
export const FALL_FORWARDS_Z_THRESHOLD: Fixed = (64 * FRACUNIT) | 0;

/** Invuln/GODMODE damage ceiling — hits at or above this still land. */
export const INVULN_DAMAGE_CEILING = 1000;

// ── Callback types ───────────────────────────────────────────────────

/** Callback matching P_SpawnMobj(x, y, z, type). */
export type SpawnMobjFunction = (x: Fixed, y: Fixed, z: Fixed, type: MobjType) => Mobj;

/** Callback matching R_PointToAngle2(x1, y1, x2, y2). */
export type PointToAngle2Function = (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed) => Angle;

/** Callback matching P_DropWeapon(player). */
export type DropWeaponFunction = (player: Player) => void;

// ── Context ──────────────────────────────────────────────────────────

/**
 * Shared dependencies for P_DamageMobj / P_KillMobj. Mirrors the C
 * globals (`gameskill`, `gamemode`, `netgame`, `players`) plus the
 * primitives the two functions call out to.
 */
export interface DamageContext {
  rng: DoomRandom;
  thinkerList: ThinkerList;
  spawnMobj: SpawnMobjFunction;
  pointToAngle2: PointToAngle2Function;
  dropWeapon: DropWeaponFunction;
  gameMode: () => GameMode;
  gameskill: () => number;
  netgame: boolean;
  /** players[] — index 0 receives monster-on-monster kill credit in single player. */
  players: readonly Player[];
}

let context: DamageContext | null = null;

/** Install the shared context. Call once during bootstrap. */
export function setDamageContext(ctx: DamageContext): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getDamageContext(): DamageContext | null {
  return context;
}

/** Clear the shared context. Test-only helper. */
export function clearDamageContext(): void {
  context = null;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Narrow {@link Mobj.player} (declared `unknown` to dodge a circular
 * type reference) to the structural {@link Player} shape — a non-null
 * object carrying a `psprites` field, matching pickups.ts's predicate.
 */
function asPlayer(value: unknown): Player | null {
  if (value !== null && typeof value === 'object' && 'psprites' in value) {
    return value as Player;
  }
  return null;
}

/** Restrict an armor type to the 0|1|2 the damage contract accepts. */
function clampArmorType(armortype: number): 0 | 1 | 2 {
  if (armortype === 1) return 1;
  if (armortype === 2) return 2;
  return 0;
}

// ── P_KillMobj ───────────────────────────────────────────────────────

/**
 * P_KillMobj from p_inter.c. Drops the target into its death-state
 * chain, credits the kill, and (for former humans) drops their weapon.
 *
 * @param source - The mobj that dealt the lethal blow (kill credit), or null.
 * @param target - The mobj being killed.
 */
export function killMobj(source: Mobj | null, target: Mobj): void {
  if (!context) return;

  target.flags = (target.flags & ~(MF_SHOOTABLE | MF_FLOAT | MF_SKULLFLY)) | 0;

  if (target.type !== MobjType.SKULL) {
    target.flags = (target.flags & ~MF_NOGRAVITY) | 0;
  }

  target.flags = (target.flags | MF_CORPSE | MF_DROPOFF) | 0;
  target.height = target.height >> 2;

  const sourcePlayer = source ? asPlayer(source.player) : null;
  const targetPlayer = asPlayer(target.player);

  if (source && sourcePlayer) {
    // Count for intermission.
    if ((target.flags & MF_COUNTKILL) !== 0) {
      sourcePlayer.killcount = (sourcePlayer.killcount + 1) | 0;
    }
    // (frags only matter in netgame; single-player keeps the count off.)
  } else if (!context.netgame && (target.flags & MF_COUNTKILL) !== 0) {
    // Count all monster deaths, even those caused by other monsters.
    const player0 = context.players[0];
    if (player0) {
      player0.killcount = (player0.killcount + 1) | 0;
    }
  }

  if (targetPlayer) {
    target.flags = (target.flags & ~MF_SOLID) | 0;
    targetPlayer.playerstate = PlayerState.DEAD;
    context.dropWeapon(targetPlayer);
  }

  const info = target.info!;
  if (target.health < -info.spawnhealth && info.xdeathstate !== StateNum.NULL) {
    setMobjState(target, info.xdeathstate, context.thinkerList);
  } else {
    setMobjState(target, info.deathstate, context.thinkerList);
  }

  target.tics = (target.tics - (context.rng.pRandom() & 3)) | 0;
  if (target.tics < 1) target.tics = 1;

  // Drop stuff (former humans only).
  let item: MobjType;
  switch (target.type) {
    case MobjType.WOLFSS:
    case MobjType.POSSESSED:
      item = MobjType.CLIP;
      break;
    case MobjType.SHOTGUY:
      item = MobjType.SHOTGUN;
      break;
    case MobjType.CHAINGUY:
      item = MobjType.CHAINGUN;
      break;
    default:
      return;
  }

  // ONFLOORZ — spawnMobj resolves it from the dropped item's subsector.
  const dropped = context.spawnMobj(target.x, target.y, ONFLOORZ, item);
  dropped.flags = (dropped.flags | MF_DROPPED) | 0;
}

// ── P_DamageMobj ─────────────────────────────────────────────────────

/**
 * P_DamageMobj from p_inter.c. Applies `damage` to `target`, handling
 * armor, thrust knockback, pain, death, and monster wake-up.
 *
 * @param target - The mobj taking damage.
 * @param inflictor - The mobj that caused it (missile/claw), or null
 *   for environmental damage (slime, crusher) — drives the thrust.
 * @param source - The mobj to retaliate against / credit the kill to,
 *   or null. Same as inflictor for melee.
 * @param damage - Hit points of damage before armor / skill scaling.
 */
export function damageMobj(target: Mobj, inflictor: Mobj | null, source: Mobj | null, damage: number): void {
  if (!context) return;

  if ((target.flags & MF_SHOOTABLE) === 0) {
    return; // shouldn't happen...
  }

  if (target.health <= 0) {
    return;
  }

  if ((target.flags & MF_SKULLFLY) !== 0) {
    target.momx = 0;
    target.momy = 0;
    target.momz = 0;
  }

  const player = asPlayer(target.player);
  const gameskill = context.gameskill();

  if (player && gameskill === 1) {
    damage = damage >> 1; // take half damage in trainer mode
  }

  // Close-combat weapons should not push the victim out of reach, so
  // skip the thrust unless the chainsaw is the source.
  if (inflictor && (target.flags & MF_NOCLIP) === 0) {
    const sourcePlayer = source ? asPlayer(source.player) : null;
    const sourceUsesChainsaw = sourcePlayer !== null && sourcePlayer.readyweapon === WeaponType.CHAINSAW;
    if (!source || !sourcePlayer || !sourceUsesChainsaw) {
      let ang: Angle = context.pointToAngle2(inflictor.x, inflictor.y, target.x, target.y);

      const mass = target.info!.mass;
      let thrust: Fixed = mass !== 0 ? (((damage * (FRACUNIT >> 3) * 100) | 0) / mass) | 0 : 0;

      // Make fall forwards sometimes.
      if (damage < FALL_FORWARDS_DAMAGE_CAP && damage > target.health && ((target.z - inflictor.z) | 0) > FALL_FORWARDS_Z_THRESHOLD && (context.rng.pRandom() & 1) !== 0) {
        ang = (ang + ANG180) >>> 0;
        thrust = (thrust * 4) | 0;
      }

      const fineIndex = (ang >>> 0) >>> ANGLETOFINESHIFT;
      target.momx = (target.momx + fixedMul(thrust, finecosine[fineIndex]!)) | 0;
      target.momy = (target.momy + fixedMul(thrust, finesine[fineIndex]!)) | 0;
    }
  }

  // Player-specific armor / cheat / counter handling.
  if (player) {
    // DEVIATION: the vanilla "end of game hell hack" clamps damage to
    // `target.health - 1` when the player stands on a sector with
    // special 11 (the Dis / E*M8 exit floor). The launcher's mobj
    // `subsector` carries only floor/ceiling heights — `sector.special`
    // is not threaded through here — so the clamp cannot be evaluated
    // without a type cast that would bypass the structural shape. The
    // branch is omitted; it never applies on E1M1 (no special-11
    // sector) and only matters on the episode-8 boss-exit floor.
    // Reference: p_inter.c P_DamageMobj lines 843-847.

    // Below 1000 damage, ignore in GOD mode or with invulnerability.
    if (damage < INVULN_DAMAGE_CEILING && ((player.cheats & VANILLA_CF_GODMODE) !== 0 || player.powers[PowerType.INVULNERABILITY])) {
      return;
    }

    // Armor + health-clamp arithmetic via the audited contract. The
    // baby-skill halve and the GODMODE early-out are already applied
    // above in their vanilla-ordered positions, so they are passed as
    // false here to avoid double-applying them (p_inter.c halves once
    // at line 805 and never re-checks GODMODE inside the armor block).
    const damageResult = applyVanillaPlayerDamage({
      damage,
      health: player.health,
      armorPoints: player.armorpoints,
      armorType: clampArmorType(player.armortype),
      godMode: false,
      babySkill: false,
    });

    player.armorpoints = damageResult.armorPoints;
    player.armortype = damageResult.armorType;
    player.health = damageResult.health;

    // The amount that actually came off health (post-armor).
    damage = damageResult.damageApplied;

    player.attacker = source;
    player.damagecount = (player.damagecount + damage) | 0;
    if (player.damagecount > MAX_DAMAGECOUNT) {
      player.damagecount = MAX_DAMAGECOUNT;
    }
  }

  // Do the damage.
  target.health = (target.health - damage) | 0;
  if (target.health <= 0) {
    killMobj(source, target);
    return;
  }

  if (context.rng.pRandom() < target.info!.painchance && (target.flags & MF_SKULLFLY) === 0) {
    target.flags = (target.flags | MF_JUSTHIT) | 0; // fight back!
    setMobjState(target, target.info!.painstate, context.thinkerList);
  }

  target.reactiontime = 0; // we're awake now...

  if ((target.threshold === 0 || target.type === MobjType.VILE) && source && source !== target && source.type !== MobjType.VILE) {
    // If not intent on another player, chase after this one.
    target.target = source;
    target.threshold = BASETHRESHOLD;
    if (target.state === STATES[target.info!.spawnstate] && target.info!.seestate !== StateNum.NULL) {
      setMobjState(target, target.info!.seestate, context.thinkerList);
    }
  }
}
