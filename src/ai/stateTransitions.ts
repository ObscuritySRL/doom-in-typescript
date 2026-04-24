/**
 * Pain / death / fall / explode action functions (p_enemy.c).
 *
 * These six actions own the state-table transitions that fire when a
 * monster takes damage, dies, settles into a corpse, or explodes:
 *
 * - {@link aPain} plays the monster's `painsound` and nothing else.  It
 *   sits at every painstate's second frame ({@link wirePainDeathActions}).
 * - {@link aScream} plays the deathsound, with two RNG-driven cycling
 *   tables for pods (sfx_podth1..3) and former humans (sfx_bgdth1..2),
 *   and routes the sound through `null` (world-relative) for the spider
 *   mastermind and cyberdemon so distance attenuation does not muffle
 *   their last roar.
 * - {@link aXScream} plays the universal gib sound `sfx_slop` regardless
 *   of monster type.
 * - {@link aPlayerScream} plays the player death sound, swapping in
 *   `sfx_pdiehi` only on commercial WADs when health drops below -50
 *   (i.e. an over-gibbed corpse from a high-damage hit).
 * - {@link aFall} clears `MF_SOLID` so other actors can step on the
 *   corpse.  The MF_CORPSE flag itself is set by P_KillMobj earlier; this
 *   action only removes the blocking bit.
 * - {@link aExplode} fans 128 damage out via P_RadiusAttack from the
 *   thingy.target as the source — used by MT_ROCKET deathstate
 *   (S_EXPLODE1) and MT_BARREL deathstate (S_BEXP4).
 *
 * The "raise" half of the step title refers to the raisestate state
 * chains (POSS_RAISE1..POSS_RAISE4 etc.) that resurrected corpses walk
 * back through to their spawnstate.  Those states have no action
 * pointers themselves — the resurrection driver (A_VileChase, scheduled
 * for a later step) sets the corpse's state to `info.raisestate`,
 * restores `info.flags`/`info.spawnhealth`, and lets P_MobjThinker
 * advance the raise frames normally.
 *
 * Parity-critical details preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - A_Scream's pod and bg cycling consume exactly one P_Random per call;
 *   every other deathsound consumes zero RNG.
 * - A_Scream routes through `S_StartSound(NULL, ...)` (world-relative)
 *   only for MT_SPIDER and MT_CYBORG; every other type uses the actor as
 *   the sound origin.
 * - A_PlayerScream's strict `health < -50` check (not `<=`) means a hit
 *   that lands the player at exactly -50 still uses sfx_pldeth.  The
 *   high-pain sound is reserved for `< -50`.
 * - A_PlayerScream's commercial gate uses `gameMode === "commercial"`,
 *   so DOOM/DOOM2 retail/registered/shareware always fall back to
 *   sfx_pldeth regardless of damage.
 * - A_Fall is `flags &= ~MF_SOLID` only.  It does not touch MF_CORPSE,
 *   MF_SHOOTABLE, MF_NOGRAVITY, or any other bit — those mutations live
 *   in P_KillMobj.
 * - A_Explode passes `thingy.target` straight through as the source
 *   parameter; if the target is null (a barrel that detonated without
 *   ever being damaged) the source is null.  P_DamageMobj accepts a
 *   null source (no kill credit assigned).
 *
 * @example
 * ```ts
 * import {
 *   setStateTransitionContext,
 *   wirePainDeathActions,
 * } from "../src/ai/stateTransitions.ts";
 * setStateTransitionContext({
 *   rng,
 *   startSound,
 *   radiusAttack: (spot, source, damage) =>
 *     radiusAttack(spot, source!, damage, blockmap, blocklinks, callbacks),
 *   gameMode: () => "commercial",
 * });
 * wirePainDeathActions();
 * ```
 */

import type { DoomRandom } from '../core/rng.ts';

import type { GameMode } from '../bootstrap/gameMode.ts';

import type { Mobj } from '../world/mobj.ts';
import { MF_SOLID, MobjType, STATES, StateNum } from '../world/mobj.ts';

// ── Sound IDs (sounds.h sfxenum_t indices) ──────────────────────────

/** sfx_slop — universal gib sound used by A_XScream. */
export const SFX_SLOP = 31;

/** sfx_pldeth — default player death sound. */
export const SFX_PLDETH = 54;

/** sfx_pdiehi — high-pain player death sound used on commercial gibs. */
export const SFX_PDIEHI = 55;

/** sfx_podth1 — first of three pod death sounds cycled by A_Scream. */
export const SFX_PODTH1 = 56;

/** sfx_podth2 — second pod death sound. */
export const SFX_PODTH2 = 57;

/** sfx_podth3 — third pod death sound. */
export const SFX_PODTH3 = 58;

/** sfx_bgdth1 — first of two former-human death sounds cycled by A_Scream. */
export const SFX_BGDTH1 = 59;

/** sfx_bgdth2 — second former-human death sound. */
export const SFX_BGDTH2 = 60;

// ── Action constants ─────────────────────────────────────────────────

/** A_Explode radius damage (`P_RadiusAttack(thingy, target, 128)`). */
export const EXPLODE_DAMAGE = 128;

/**
 * A_PlayerScream gib threshold (strict `<`).  Health below this on a
 * commercial WAD swaps sfx_pldeth for sfx_pdiehi.
 */
export const PLAYER_SCREAM_GIB_HEALTH = -50;

// ── Callback types ──────────────────────────────────────────────────

/** Callback matching S_StartSound(origin, sfxId). */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

/**
 * Callback matching P_RadiusAttack(spot, source, damage).  The source
 * argument is nullable to mirror vanilla, where a barrel that has never
 * been damaged carries `target == NULL` and forwards that null straight
 * through to P_DamageMobj.
 */
export type RadiusAttackCallback = (spot: Mobj, source: Mobj | null, damage: number) => void;

// ── Context ─────────────────────────────────────────────────────────

/**
 * Shared dependencies for the pain/death/fall/explode actions.  Pulled
 * from the same primitives as {@link import("./attacks.ts").MonsterAttackContext}
 * but kept module-local so this file can be imported without forcing a
 * full attack-system wiring.
 */
export interface StateTransitionContext {
  rng: DoomRandom;
  startSound: StartSoundFunction | null;
  radiusAttack: RadiusAttackCallback;
  gameMode: () => GameMode;
}

let context: StateTransitionContext | null = null;

/** Install the shared context.  Call once during bootstrap. */
export function setStateTransitionContext(ctx: StateTransitionContext): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getStateTransitionContext(): StateTransitionContext | null {
  return context;
}

/** Clear the context (test isolation). */
export function clearStateTransitionContext(): void {
  context = null;
}

// ── A_Pain ──────────────────────────────────────────────────────────

/**
 * A_Pain from p_enemy.c.  Plays the monster's painsound; consumes no
 * RNG and does not transition state.  A null `info` or zero painsound
 * silently no-ops.
 */
export function aPain(actor: Mobj): void {
  if (!context) return;
  const painsound = actor.info?.painsound ?? 0;
  if (painsound === 0) return;
  if (context.startSound) {
    context.startSound(actor, painsound);
  }
}

// ── A_Scream ────────────────────────────────────────────────────────

/**
 * A_Scream from p_enemy.c.  Plays the monster's deathsound with two
 * special-case cycling tables and a world-relative origin override for
 * boss types.
 *
 * - `deathsound === 0` → silent (no RNG).
 * - `deathsound ∈ {sfx_podth1, sfx_podth2, sfx_podth3}` → consumes one
 *   P_Random and plays sfx_podth1 + (roll % 3).
 * - `deathsound ∈ {sfx_bgdth1, sfx_bgdth2}` → consumes one P_Random and
 *   plays sfx_bgdth1 + (roll % 2).
 * - Any other deathsound is played verbatim (no RNG).
 *
 * MT_SPIDER and MT_CYBORG route the sound through origin = null so it
 * is not attenuated by distance — the boss roar is meant to be heard
 * across the entire level.  Every other type uses the actor as origin.
 */
export function aScream(actor: Mobj): void {
  if (!context) return;
  const deathsound = actor.info?.deathsound ?? 0;
  if (deathsound === 0) return;

  let sound: number;
  if (deathsound === SFX_PODTH1 || deathsound === SFX_PODTH2 || deathsound === SFX_PODTH3) {
    sound = SFX_PODTH1 + (context.rng.pRandom() % 3);
  } else if (deathsound === SFX_BGDTH1 || deathsound === SFX_BGDTH2) {
    sound = SFX_BGDTH1 + (context.rng.pRandom() % 2);
  } else {
    sound = deathsound;
  }

  if (!context.startSound) return;

  if (actor.type === MobjType.SPIDER || actor.type === MobjType.CYBORG) {
    context.startSound(null, sound);
  } else {
    context.startSound(actor, sound);
  }
}

// ── A_XScream ───────────────────────────────────────────────────────

/**
 * A_XScream from p_enemy.c.  Plays the universal gib sound `sfx_slop`
 * on the actor.  Consumes no RNG; does not vary by monster type.
 */
export function aXScream(actor: Mobj): void {
  if (!context) return;
  if (context.startSound) {
    context.startSound(actor, SFX_SLOP);
  }
}

// ── A_PlayerScream ──────────────────────────────────────────────────

/**
 * A_PlayerScream from p_enemy.c.  Plays sfx_pldeth, escalated to
 * sfx_pdiehi only when both:
 *
 * 1. Game mode is `commercial` (DOOM 2 / Plutonia / TNT).
 * 2. `mo.health < -50` (strict `<`, not `<=`).
 *
 * The strict comparison means a corpse that lands at exactly -50 health
 * still uses sfx_pldeth — the high-pain death is reserved for clearly
 * over-killed bodies.  Consumes no RNG.
 */
export function aPlayerScream(mo: Mobj): void {
  if (!context) return;
  let sound = SFX_PLDETH;
  if (context.gameMode() === 'commercial' && mo.health < PLAYER_SCREAM_GIB_HEALTH) {
    sound = SFX_PDIEHI;
  }
  if (context.startSound) {
    context.startSound(mo, sound);
  }
}

// ── A_Fall ──────────────────────────────────────────────────────────

/**
 * A_Fall from p_enemy.c.  Clears the actor's `MF_SOLID` bit so other
 * actors can step over the corpse.  All other flag bits — MF_CORPSE,
 * MF_SHOOTABLE, MF_NOGRAVITY, MF_DROPOFF, MF_TRANSLATION etc. — are
 * left untouched.  P_KillMobj already cleared MF_SHOOTABLE and set
 * MF_CORPSE before this state runs.
 *
 * Idempotent: calling A_Fall on a corpse that already lost MF_SOLID is
 * a no-op.
 */
export function aFall(actor: Mobj): void {
  actor.flags = (actor.flags & ~MF_SOLID) | 0;
}

// ── A_Explode ───────────────────────────────────────────────────────

/**
 * A_Explode from p_enemy.c.  Calls `P_RadiusAttack(thingy, thingy.target,
 * EXPLODE_DAMAGE)` with damage 128 — the universal rocket / barrel
 * splash payload.
 *
 * `thingy.target` is forwarded straight through as the splash source.
 * For MT_ROCKET this is the firing player (so kill credit propagates
 * back to them); for MT_BARREL this is whoever last damaged the barrel
 * (or null if the barrel exploded without ever being shot, in which
 * case kill credit is unassigned).
 */
export function aExplode(thingy: Mobj): void {
  if (!context) return;
  context.radiusAttack(thingy, thingy.target, EXPLODE_DAMAGE);
}

// ── State action wiring ─────────────────────────────────────────────

/**
 * Number of STATES entries {@link wirePainDeathActions} installs
 * actions into.  Each block below is a per-monster sub-count followed
 * by the running total.
 *
 * - A_Pain: 19 (one painstate-2 per monster type that bothers to flinch)
 * - A_Scream: 19 (one death-chain frame per monster type with deathsound)
 * - A_XScream: 6 (only types with an extreme-death xdeathstate chain)
 * - A_Fall: 22 (ordinary death AND extreme death need to drop solid)
 * - A_Explode: 2 (rocket explosion, barrel explosion)
 * - A_PlayerScream: 1 (PLAY_DIE2)
 *
 * Total = 69.
 */
export const PAIN_DEATH_ACTION_COUNT = 69;

/**
 * Wire every pain/death/fall/explode action into the STATES table so
 * setMobjState transitions invoke the correct behavior.
 *
 * Must be called once during bootstrap (after info.c-equivalent state
 * tables are loaded).  Idempotent — calling twice just reassigns the
 * same action pointers.
 *
 * The state→action mapping is a literal port of Chocolate Doom 2.2.1
 * info.c:
 *
 * - Each monster's painstate is a 1-tic "shudder" frame followed by a
 *   2-tic frame that calls A_Pain.  We wire only the second.
 * - Each monster's deathstate is a chain that runs A_Scream early
 *   (frame 2 or 3) and A_Fall late (when the corpse settles).
 * - Extreme-death (xdeathstate) chains run A_XScream on frame 2 and
 *   A_Fall on frame 3.
 * - MT_ROCKET deathstate chain runs A_Explode on the bright orange
 *   "EXPLODE1" frame; MT_BARREL deathstate chain runs A_Explode on the
 *   "BEXP4" barrel-of-fun frame.
 */
export function wirePainDeathActions(): void {
  // Player (MT_PLAYER).
  STATES[StateNum.PLAY_PAIN2]!.action = aPain;
  STATES[StateNum.PLAY_DIE2]!.action = aPlayerScream;
  STATES[StateNum.PLAY_DIE3]!.action = aFall;
  STATES[StateNum.PLAY_XDIE2]!.action = aXScream;
  STATES[StateNum.PLAY_XDIE3]!.action = aFall;

  // Zombieman (MT_POSSESSED).
  STATES[StateNum.POSS_PAIN2]!.action = aPain;
  STATES[StateNum.POSS_DIE2]!.action = aScream;
  STATES[StateNum.POSS_DIE3]!.action = aFall;
  STATES[StateNum.POSS_XDIE2]!.action = aXScream;
  STATES[StateNum.POSS_XDIE3]!.action = aFall;

  // Shotgun sergeant (MT_SHOTGUY).
  STATES[StateNum.SPOS_PAIN2]!.action = aPain;
  STATES[StateNum.SPOS_DIE2]!.action = aScream;
  STATES[StateNum.SPOS_DIE3]!.action = aFall;
  STATES[StateNum.SPOS_XDIE2]!.action = aXScream;
  STATES[StateNum.SPOS_XDIE3]!.action = aFall;

  // Archvile (MT_VILE).  No xdeath chain.
  STATES[StateNum.VILE_PAIN2]!.action = aPain;
  STATES[StateNum.VILE_DIE2]!.action = aScream;
  STATES[StateNum.VILE_DIE3]!.action = aFall;

  // Revenant (MT_UNDEAD).  Scream on DIE3, Fall on DIE4 (one tic later
  // than other monsters because the skeleton's collapse animation is
  // longer).  No xdeath chain.
  STATES[StateNum.SKEL_PAIN2]!.action = aPain;
  STATES[StateNum.SKEL_DIE3]!.action = aScream;
  STATES[StateNum.SKEL_DIE4]!.action = aFall;

  // Mancubus (MT_FATSO).  No xdeath chain.
  STATES[StateNum.FATT_PAIN2]!.action = aPain;
  STATES[StateNum.FATT_DIE2]!.action = aScream;
  STATES[StateNum.FATT_DIE3]!.action = aFall;

  // Heavy-weapon dude (MT_CHAINGUY).
  STATES[StateNum.CPOS_PAIN2]!.action = aPain;
  STATES[StateNum.CPOS_DIE2]!.action = aScream;
  STATES[StateNum.CPOS_DIE3]!.action = aFall;
  STATES[StateNum.CPOS_XDIE2]!.action = aXScream;
  STATES[StateNum.CPOS_XDIE3]!.action = aFall;

  // Imp (MT_TROOP).  Fall is on XDIE4 not XDIE3 (longer xdeath chain).
  STATES[StateNum.TROO_PAIN2]!.action = aPain;
  STATES[StateNum.TROO_DIE2]!.action = aScream;
  STATES[StateNum.TROO_XDIE2]!.action = aXScream;
  STATES[StateNum.TROO_XDIE4]!.action = aFall;

  // Demon / spectre (MT_SERGEANT).  Fall is on DIE4 (longer collapse).
  // No xdeath chain.
  STATES[StateNum.SARG_PAIN2]!.action = aPain;
  STATES[StateNum.SARG_DIE2]!.action = aScream;
  STATES[StateNum.SARG_DIE4]!.action = aFall;

  // Cacodemon (MT_HEAD).  Fall on DIE5.  No xdeath chain.
  STATES[StateNum.HEAD_PAIN2]!.action = aPain;
  STATES[StateNum.HEAD_DIE2]!.action = aScream;
  STATES[StateNum.HEAD_DIE5]!.action = aFall;

  // Baron of hell (MT_BRUISER).  Fall on DIE4.  No xdeath chain.
  STATES[StateNum.BOSS_PAIN2]!.action = aPain;
  STATES[StateNum.BOSS_DIE2]!.action = aScream;
  STATES[StateNum.BOSS_DIE4]!.action = aFall;

  // Hell knight (MT_KNIGHT).
  STATES[StateNum.BOS2_PAIN2]!.action = aPain;
  STATES[StateNum.BOS2_DIE2]!.action = aScream;
  STATES[StateNum.BOS2_DIE4]!.action = aFall;

  // Lost soul (MT_SKULL).
  STATES[StateNum.SKULL_PAIN2]!.action = aPain;
  STATES[StateNum.SKULL_DIE2]!.action = aScream;
  STATES[StateNum.SKULL_DIE4]!.action = aFall;

  // Spider mastermind (MT_SPIDER).  Scream on DIE1, Fall on DIE2 — the
  // spider has no separate "stagger" frame between flinch and collapse.
  STATES[StateNum.SPID_PAIN2]!.action = aPain;
  STATES[StateNum.SPID_DIE1]!.action = aScream;
  STATES[StateNum.SPID_DIE2]!.action = aFall;

  // Arachnotron (MT_BABY).  Same compressed scream/fall as the spider.
  STATES[StateNum.BSPI_PAIN2]!.action = aPain;
  STATES[StateNum.BSPI_DIE1]!.action = aScream;
  STATES[StateNum.BSPI_DIE2]!.action = aFall;

  // Cyberdemon (MT_CYBORG).  Pain is at CYBER_PAIN (no PAIN2 — single
  // frame).  Fall on DIE6.
  STATES[StateNum.CYBER_PAIN]!.action = aPain;
  STATES[StateNum.CYBER_DIE2]!.action = aScream;
  STATES[StateNum.CYBER_DIE6]!.action = aFall;

  // Pain elemental (MT_PAIN).  No A_Fall — DIE5 calls A_PainDie which
  // owns the corpse settle plus lost-soul spawn (deferred to step
  // 11-008).  We wire only the pain-and-scream half here.
  STATES[StateNum.PAIN_PAIN2]!.action = aPain;
  STATES[StateNum.PAIN_DIE2]!.action = aScream;

  // Wolfenstein SS (MT_WOLFSS).
  STATES[StateNum.SSWV_PAIN2]!.action = aPain;
  STATES[StateNum.SSWV_DIE2]!.action = aScream;
  STATES[StateNum.SSWV_DIE3]!.action = aFall;
  STATES[StateNum.SSWV_XDIE2]!.action = aXScream;
  STATES[StateNum.SSWV_XDIE3]!.action = aFall;

  // Commander Keen (MT_KEEN).  Death scream is shared with monsters but
  // the death-finish hook (A_KeenDie) is in step 11-008.
  STATES[StateNum.COMMKEEN3]!.action = aScream;
  STATES[StateNum.KEENPAIN2]!.action = aPain;

  // MT_ROCKET deathstate explosion (S_EXPLODE1).
  STATES[StateNum.EXPLODE1]!.action = aExplode;

  // MT_BARREL deathstate explosion (S_BEXP4).
  STATES[StateNum.BEXP2]!.action = aScream;
  STATES[StateNum.BEXP4]!.action = aExplode;
}
