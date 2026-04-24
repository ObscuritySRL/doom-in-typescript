/**
 * Boss and death special-case action functions (p_enemy.c).
 *
 * This module owns the thirteen action functions that wire boss-level
 * triggers, end-of-episode hooks, the IoS brain, and the pain
 * elemental's death lost-soul spawn into the state table:
 *
 * - {@link aKeenDie} — DOOM II MAP32 Commander Keen: A_Fall, then scan
 *   the thinker list and open tagged-666 door once every Keen is dead.
 * - {@link aPainDie} — pain elemental death: A_Fall plus three
 *   `painShootSkull` calls at angle+ANG90/ANG180/ANG270.
 * - {@link aBossDeath} — possibly trigger end-of-episode floor/door
 *   special on the last boss of the appropriate map.  The
 *   gameMode/gameVersion/gameepisode/gamemap matrix is mirrored from
 *   the C reference exactly, including the Ultimate Doom CheckBossEnd
 *   reshuffle and the "no living player" abort.
 * - {@link aHoof} — cyberdemon hoof step sfx + A_Chase.
 * - {@link aMetal} — spider mastermind / cyberdemon metal step sfx +
 *   A_Chase.
 * - {@link aBabyMetal} — arachnotron walking sfx + A_Chase.
 * - {@link aBrainAwake} — find every MT_BOSSTARGET in the level and
 *   record it; play sfx_bossit world-relative.
 * - {@link aBrainPain} — play sfx_bospn world-relative (no animation
 *   change; the brain stays in BRAIN_PAIN until tics expire).
 * - {@link aBrainScream} — fire a fan of MT_ROCKET explosions across
 *   the brain's front and play sfx_bosdth world-relative.  Each rocket
 *   advances the RNG four times in a fixed order.
 * - {@link aBrainExplode} — single-rocket version of {@link aBrainScream}
 *   used during the brain's death-loop frames; consumes four RNG calls.
 * - {@link aBrainDie} — exit the level.
 * - {@link aBrainSpit} — fire MT_SPAWNSHOT cube at the next bosstarget
 *   in round-robin order; toggles the static `easy` flag and skips on
 *   easy/very-easy skill every other call.
 * - {@link aSpawnSound} — play sfx_boscub world-relative + delegate to
 *   {@link aSpawnFly}.
 * - {@link aSpawnFly} — decrement reactiontime; on hit-zero, spawn fog
 *   at the cube's target, roll one P_Random for monster type from a
 *   weighted table, spawn the monster, run lookForPlayers/seestate,
 *   telefrag, then remove the cube.
 *
 * Parity-critical details preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - A_KeenDie scans the thinker list looking for any other live mobj
 *   of `mo.type` (i.e. another Keen).  The "any other Keen alive →
 *   abort" check uses `mo2 != mo && mo2.type === mo.type && mo2.health
 *   > 0`; same-instance comparison prevents the dying keen from
 *   counting itself.  When all are dead it opens line tag 666 with
 *   vld_open.
 * - A_PainDie fires three lost souls at fixed angle offsets
 *   (ANG90/ANG180/ANG270) using the pain elemental's CURRENT angle.
 *   No A_FaceTarget is performed first — the pain elemental's death
 *   sequence preserves its last-known orientation.
 * - A_BossDeath commercial branch runs only on map 7, only for MT_FATSO
 *   (tag 666 → lowerFloorToLowest) or MT_BABY (tag 667 → raiseToTexture).
 *   Each writes a different action and returns immediately — the
 *   exitLevel fall-through never fires in commercial.
 * - A_BossDeath non-commercial branch:
 *   - Gameversion < exe_ultimate: only on map 8; MT_BRUISER death on
 *     ep>1 is ignored (baron is a regular monster outside ep1).  Always
 *     ep1 → tag 666 lowerFloorToLowest, ep4 map6 → tag 666 vld_blazeOpen,
 *     ep4 map8 → tag 666 lowerFloorToLowest, anything else → exitLevel.
 *   - Gameversion >= exe_ultimate (ultimate Doom rework): each episode
 *     gates a specific monster type and map combination:
 *     ep1 only MT_BRUISER@map8, ep2 only MT_CYBORG@map8, ep3 only
 *     MT_SPIDER@map8, ep4 MT_CYBORG@map6 OR MT_SPIDER@map8, default
 *     map==8.  This is the well-documented uac_dead.wad behavior change.
 * - A_BossDeath requires AT LEAST ONE living player (player.health > 0
 *   AND playeringame[i]) before triggering anything.  No player alive
 *   → silent return (no exitLevel, no doors, no floors).
 * - A_BossDeath also scans the thinker list for any other live mobj of
 *   the dying boss's type.  ANY remaining living boss → silent return.
 * - A_Hoof / A_Metal / A_BabyMetal play sfx_hoof / sfx_metal / sfx_bspwlk
 *   on the actor (NOT world-relative) and then call A_Chase normally.
 *   The walking sfx are mid-step "footfalls" wired to specific RUN
 *   frames in info.c, NOT to the seestate transition.
 * - A_BrainAwake clears braintargets[] AND braintargeton at start, then
 *   walks the thinker list and pushes every MT_BOSSTARGET, capped at 32
 *   slots in the C source (vanilla overruns the array if there are
 *   more than 32 — we silently drop).  Plays sfx_bossit world-relative.
 * - A_BrainScream: x ranges from `mo.x - 196*FRACUNIT` UP TO (but not
 *   reaching) `mo.x + 320*FRACUNIT` in `8*FRACUNIT` strides.  At each
 *   step, y is `mo.y - 320*FRACUNIT`, z is `128 + P_Random()*2*FRACUNIT`,
 *   spawn MT_ROCKET, set rocket.momz to `P_Random()*512`, transition
 *   rocket to S_BRAINEXPLODE1, then jitter `tics -= P_Random()&7` with
 *   floor of 1.  Final action: sfx_bosdth world-relative.  RNG order
 *   per rocket: z, momz, jitter (3 calls), totaling 64 rockets ×3 calls
 *   = 192 P_Random for the typical brain-death animation, plus
 *   per-rocket A_BrainExplode → S_BRAINEXPLODE2 (which has no action).
 * - A_BrainExplode: same single-rocket primitive but x is
 *   `mo.x + P_SubRandom()*2048` (consuming 2 RNG before z), y is
 *   `mo.y` exactly.  Rest of pipeline matches A_BrainScream's per-rocket
 *   inner loop: z, momz, transition, jitter.  TOTAL of 5 P_Random per
 *   call (subrandom=2, z, momz, jitter).
 * - A_BrainDie calls G_ExitLevel (callback {@link BossSpecialsContext.exitLevel}).
 * - A_BrainSpit toggles a STATIC `easy` flag every call.  When
 *   `gameskill <= sk_easy` (skill 0 or 1) AND the post-toggle easy is
 *   0 (i.e. it just flipped from 1 to 0), the call early-returns.  Net
 *   effect: 50% missile rate on Easy/Very Easy.  When numbraintargets
 *   is 0 the C source crashes; we throw to surface the misconfiguration.
 * - A_BrainSpit fires a missile via P_SpawnMissile (which sets
 *   missile.target = mo as side-effect), THEN OVERRIDES
 *   `newmobj.target = targ` (so the cube tracks its bosstarget, not
 *   the brain), then sets reactiontime = `((targ.y - mo.y)/momy)/state.tics`
 *   so A_SpawnFly fires at the right tic when the cube reaches its
 *   target column.  Plays sfx_bospit world-relative.
 * - A_SpawnFly subtracts ONE from reactiontime per call.  Returns
 *   silently while still positive.  When reactiontime hits 0:
 *   - Substitute null target with a sentinel (P_SubstNullMobj — vanilla
 *     allocates a static dummy mobj at world origin); we throw on null
 *     target to flag the corruption explicitly.
 *   - Spawn MT_SPAWNFIRE at target.x/y/z, play sfx_telept on the fog.
 *   - Roll ONE P_Random and pick the spawned monster from a weighted
 *     distribution (TROOP heaviest, BRUISER lightest):
 *     r<50→TROOP, r<90→SERGEANT, r<120→SHADOWS, r<130→PAIN, r<160→HEAD,
 *     r<162→VILE, r<172→UNDEAD, r<192→BABY, r<222→FATSO, r<246→KNIGHT,
 *     else→BRUISER.
 *   - Spawn the monster, run lookForPlayers(allaround=true); on
 *     success, transition to seestate.
 *   - Telefrag any thing in the spawn cell via P_TeleportMove.
 *   - Remove the cube via P_RemoveMobj.
 *
 * @example
 * ```ts
 * import { setBossSpecialsContext, wireBossSpecialsActions } from
 *   "../src/ai/bossSpecials.ts";
 * setBossSpecialsContext({ ...callbacks });
 * wireBossSpecialsActions();
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';

import type { GameMode } from '../bootstrap/gameMode.ts';

import type { Mobj } from '../world/mobj.ts';
import { MF_SOLID, MobjType, STATES, StateNum } from '../world/mobj.ts';
import type { ThinkerList, ThinkerNode } from '../world/thinkers.ts';
import { mobjThinker } from '../world/mobj.ts';

import type { PlayerLike } from './targeting.ts';

// ── SFX IDs (sounds.h sfxenum_t indices) ────────────────────────────

/** sfx_telept — teleport fog sound used by A_SpawnFly. */
export const SFX_TELEPT = 35;

/** sfx_bspwlk — arachnotron walk sound used by A_BabyMetal. */
export const SFX_BSPWLK = 79;

/** sfx_hoof — cyberdemon hoof sound used by A_Hoof. */
export const SFX_HOOF = 84;

/** sfx_metal — spider/cyber metal step sound used by A_Metal. */
export const SFX_METAL = 85;

/** sfx_bospit — IoS brain spit sound used by A_BrainSpit. */
export const SFX_BOSPIT = 94;

/** sfx_boscub — travelling cube sound used by A_SpawnSound. */
export const SFX_BOSCUB = 95;

/** sfx_bossit — IoS brain awake sound used by A_BrainAwake. */
export const SFX_BOSSIT = 96;

/** sfx_bospn — IoS brain pain sound used by A_BrainPain. */
export const SFX_BOSPN = 97;

/** sfx_bosdth — IoS brain death sound used by A_BrainScream. */
export const SFX_BOSDTH = 98;

// ── Linedef-tag constants ───────────────────────────────────────────

/** Tag opened when the last Commander Keen dies. */
export const KEEN_DIE_DOOR_TAG = 666;

/** Tag lowered when the last Mancubus dies on commercial map 7. */
export const BOSS_DEATH_FATSO_TAG = 666;

/** Tag raised when the last Arachnotron dies on commercial map 7. */
export const BOSS_DEATH_BABY_TAG = 667;

/** Tag lowered/opened on non-commercial boss-death triggers. */
export const BOSS_DEATH_TAG = 666;

// ── Brain-target table ──────────────────────────────────────────────

/** Maximum number of MT_BOSSTARGET spots A_BrainAwake records. */
export const MAX_BRAIN_TARGETS = 32;

// ── Brain rocket geometry ───────────────────────────────────────────

/** A_BrainScream x-loop start offset: `-196 * FRACUNIT` from brain.x. */
export const BRAIN_SCREAM_X_START: Fixed = (-196 * FRACUNIT) | 0;

/** A_BrainScream x-loop end offset: `+320 * FRACUNIT` from brain.x. */
export const BRAIN_SCREAM_X_END: Fixed = (320 * FRACUNIT) | 0;

/** A_BrainScream x-step: `8 * FRACUNIT` per rocket. */
export const BRAIN_SCREAM_X_STEP: Fixed = (8 * FRACUNIT) | 0;

/** A_BrainScream y offset: `-320 * FRACUNIT` from brain.y (constant). */
export const BRAIN_SCREAM_Y_OFFSET: Fixed = (-320 * FRACUNIT) | 0;

/** A_BrainExplode x scatter: `P_SubRandom() * 2048`. */
export const BRAIN_EXPLODE_X_SCATTER = 2048;

/** Brain rocket base z: `128` (NOT in fixed-point). */
export const BRAIN_ROCKET_Z_BASE = 128;

/** Brain rocket z RNG multiplier: `* 2 * FRACUNIT`. */
export const BRAIN_ROCKET_Z_RAND_MUL: Fixed = (2 * FRACUNIT) | 0;

/** Brain rocket momz multiplier: `* 512`. */
export const BRAIN_ROCKET_MOMZ_MUL = 512;

/** Brain rocket tic jitter mask: `& 7`. */
export const BRAIN_ROCKET_TIC_JITTER_MASK = 7;

// ── Pain elemental death ────────────────────────────────────────────

/** ANG90 = 0x4000_0000; A_PainDie fires a skull at +90°. */
export const ANG90: Angle = 0x4000_0000;

/** ANG180 = 0x8000_0000; A_PainDie fires a skull at +180°. */
export const ANG180: Angle = 0x8000_0000;

/** ANG270 = 0xC000_0000; A_PainDie fires a skull at +270°. */
export const ANG270: Angle = 0xc000_0000;

// ── Brain-spit gating ───────────────────────────────────────────────

/** sk_easy = 1.  A_BrainSpit halves missile rate at this skill or below. */
export const SK_EASY = 1;

// ── Door / floor type tags ──────────────────────────────────────────

/**
 * Door types passed to {@link BossSpecialsContext.doDoor}.  Mirrors
 * `vldoor_e` from p_spec.h.  Only the two values consumed by the boss
 * specials are surfaced here; the full enum is wired by the specials
 * subsystem in phase 12.
 */
export type BossDoorType = 'open' | 'blazeOpen';

/**
 * Floor types passed to {@link BossSpecialsContext.doFloor}.  Mirrors
 * `floor_e` from p_spec.h.  Only the two values consumed by the boss
 * specials are surfaced.
 */
export type BossFloorType = 'lowerFloorToLowest' | 'raiseToTexture';

// ── Callback types ──────────────────────────────────────────────────

/** Callback matching `S_StartSound(origin, sfxId)`. */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

/** Callback matching `P_SpawnMobj(x, y, z, type)`. */
export type SpawnMobjFunction = (x: Fixed, y: Fixed, z: Fixed, type: MobjType) => Mobj;

/** Callback matching `P_SpawnMissile(source, dest, type)`. */
export type SpawnMissileFunction = (source: Mobj, dest: Mobj, type: MobjType) => Mobj;

/** Callback matching `A_PainShootSkull(actor, angle)` from attacks.ts. */
export type PainShootSkullFunction = (actor: Mobj, angle: Angle) => void;

/** Callback matching `A_Chase(actor)` from chase.ts. */
export type ChaseActionFunction = (actor: Mobj) => void;

/** Callback matching `P_LookForPlayers(actor, allaround)`. */
export type LookForPlayersFunction = (actor: Mobj, allaround: boolean) => boolean;

/** Callback matching `P_TeleportMove(thing, x, y)`. */
export type TeleportMoveFunction = (thing: Mobj, x: Fixed, y: Fixed) => boolean;

/** Callback matching `P_RemoveMobj(mobj)`. */
export type RemoveMobjFunction = (mobj: Mobj) => void;

/** Callback matching `P_SetMobjState(mobj, state)`. */
export type SetMobjStateFunction = (mobj: Mobj, state: StateNum) => boolean;

/** Callback matching `EV_DoDoor` for a single tag/type pair. */
export type DoDoorFunction = (tag: number, type: BossDoorType) => boolean;

/** Callback matching `EV_DoFloor` for a single tag/type pair. */
export type DoFloorFunction = (tag: number, type: BossFloorType) => boolean;

// ── Context ─────────────────────────────────────────────────────────

/**
 * Shared dependencies for the boss / death special-case actions.
 *
 * Action callbacks ({@link painShootSkullAction}, {@link chaseAction},
 * {@link lookForPlayers}, {@link teleportMove}, {@link spawnMissile},
 * {@link doDoor}, {@link doFloor}) bridge to subsystems with their own
 * context singletons; the bootstrap layer wires them.
 *
 * Game-state accessors ({@link gameMode}, {@link isUltimateOrLater},
 * {@link gameepisode}, {@link gamemap}, {@link gameskill}) are functions
 * so callers can mutate them mid-tick (e.g. when the boss death itself
 * triggers a level transition).
 */
export interface BossSpecialsContext {
  rng: DoomRandom;
  thinkerList: ThinkerList;
  startSound: StartSoundFunction | null;
  spawnMobj: SpawnMobjFunction;

  gameMode: () => GameMode;
  isUltimateOrLater: () => boolean;
  gameepisode: () => number;
  gamemap: () => number;
  gameskill: () => number;

  players: readonly PlayerLike[];
  playeringame: readonly boolean[];

  exitLevel: () => void;
  doDoor: DoDoorFunction;
  doFloor: DoFloorFunction;

  spawnMissile: SpawnMissileFunction;
  painShootSkullAction: PainShootSkullFunction;
  chaseAction: ChaseActionFunction;
  lookForPlayers: LookForPlayersFunction;
  teleportMove: TeleportMoveFunction;
  removeMobj: RemoveMobjFunction;
  setMobjState: SetMobjStateFunction;
}

let context: BossSpecialsContext | null = null;

/** Install the shared context.  Call once during bootstrap. */
export function setBossSpecialsContext(ctx: BossSpecialsContext): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getBossSpecialsContext(): BossSpecialsContext | null {
  return context;
}

/** Clear the context (test isolation). */
export function clearBossSpecialsContext(): void {
  context = null;
}

// ── Module-level brain state ────────────────────────────────────────

/**
 * MT_BOSSTARGET spots recorded by {@link aBrainAwake}.  The brain-spit
 * round-robin reads from this slice on every fire, advancing
 * {@link braintargeton} modulo {@link numbraintargets}.  Capped at
 * {@link MAX_BRAIN_TARGETS} (vanilla overruns; we silently drop).
 */
const braintargets: (Mobj | null)[] = new Array(MAX_BRAIN_TARGETS).fill(null);

/** Number of valid entries in {@link braintargets}. */
let numbraintargets = 0;

/** Round-robin index into {@link braintargets} for {@link aBrainSpit}. */
let braintargeton = 0;

/**
 * `static int easy` from A_BrainSpit.  Persists across calls; toggles
 * 0 ↔ 1 each fire.  Module-scope rather than function-scope so tests
 * can reset it via {@link resetBrainSpitEasy}.
 */
let brainSpitEasy = 0;

/**
 * Test helper: reset the brain-target table to empty.  Production code
 * does this implicitly via {@link aBrainAwake} at level start.
 */
export function resetBrainTargets(): void {
  for (let i = 0; i < MAX_BRAIN_TARGETS; i++) braintargets[i] = null;
  numbraintargets = 0;
  braintargeton = 0;
}

/** Test helper: reset the static `easy` flag inside A_BrainSpit. */
export function resetBrainSpitEasy(): void {
  brainSpitEasy = 0;
}

/** Test helper: inspect the current brain-target table snapshot. */
export function getBrainTargets(): {
  targets: readonly (Mobj | null)[];
  count: number;
  cursor: number;
} {
  return {
    targets: braintargets.slice(0, numbraintargets),
    count: numbraintargets,
    cursor: braintargeton,
  };
}

// ── A_KeenDie ───────────────────────────────────────────────────────

/**
 * A_KeenDie from p_enemy.c: A_Fall + scan + open tagged door 666.
 *
 * Walks every live thinker whose action is `mobjThinker` and checks
 * for any other instance of `mo.type` with `health > 0`.  The
 * same-instance comparison (`mo2 !== mo`) prevents the dying Keen
 * from blocking its own door open.
 *
 * Issues `doDoor(666, "open")` only when no other live Keen remains.
 * Consumes no RNG.
 */
export function aKeenDie(mo: Mobj): void {
  if (!context) return;

  mo.flags = (mo.flags & ~MF_SOLID) | 0;

  let allDead = true;
  context.thinkerList.forEach((thinker: ThinkerNode) => {
    if (!allDead) return;
    if (thinker.action !== mobjThinker) return;
    const other = thinker as Mobj;
    if (other === mo) return;
    if (other.type !== mo.type) return;
    if (other.health > 0) {
      allDead = false;
    }
  });

  if (!allDead) return;
  context.doDoor(KEEN_DIE_DOOR_TAG, 'open');
}

// ── A_PainDie ───────────────────────────────────────────────────────

/**
 * A_PainDie from p_enemy.c: pain elemental death.
 *
 * Calls A_Fall (clear MF_SOLID) then fires three lost souls at
 * actor.angle + ANG90, +ANG180, +ANG270 via the shared painShootSkull
 * action (wired by {@link BossSpecialsContext.painShootSkullAction}).
 *
 * No A_FaceTarget is performed — the elemental's last orientation
 * sets the fan center.  Each painShootSkull call may consume RNG and
 * advance the thinker list (skull spawn + setMobjState chain).
 */
export function aPainDie(actor: Mobj): void {
  if (!context) return;

  actor.flags = (actor.flags & ~MF_SOLID) | 0;

  const baseAngle = actor.angle >>> 0;
  context.painShootSkullAction(actor, ((baseAngle + ANG90) >>> 0) as Angle);
  context.painShootSkullAction(actor, ((baseAngle + ANG180) >>> 0) as Angle);
  context.painShootSkullAction(actor, ((baseAngle + ANG270) >>> 0) as Angle);
}

// ── A_BossDeath ─────────────────────────────────────────────────────

/**
 * CheckBossEnd from p_enemy.c.  Replicates the v1.9 vs Ultimate
 * behavior switch — the same logic that broke uac_dead.wad.
 */
function checkBossEnd(motype: MobjType): boolean {
  if (!context) return false;

  if (!context.isUltimateOrLater()) {
    if (context.gamemap() !== 8) return false;
    if (motype === MobjType.BRUISER && context.gameepisode() !== 1) {
      return false;
    }
    return true;
  }

  switch (context.gameepisode()) {
    case 1:
      return context.gamemap() === 8 && motype === MobjType.BRUISER;
    case 2:
      return context.gamemap() === 8 && motype === MobjType.CYBORG;
    case 3:
      return context.gamemap() === 8 && motype === MobjType.SPIDER;
    case 4:
      return (context.gamemap() === 6 && motype === MobjType.CYBORG) || (context.gamemap() === 8 && motype === MobjType.SPIDER);
    default:
      return context.gamemap() === 8;
  }
}

/**
 * A_BossDeath from p_enemy.c: end-of-episode/map special trigger.
 *
 * Three early-exit gates run in this exact order:
 *
 * 1. Mode/version check — commercial requires map 7 + (FATSO|BABY);
 *    non-commercial defers to {@link checkBossEnd}.
 * 2. Living-player check — at least one entry of `players[i].health > 0`
 *    AND `playeringame[i]`; otherwise silent return.
 * 3. Surviving-boss check — any other live mobj of `mo.type` with
 *    `health > 0`; otherwise silent return.
 *
 * Then the action body fires the appropriate door/floor or calls
 * exitLevel.  Consumes no RNG.
 */
export function aBossDeath(mo: Mobj): void {
  if (!context) return;

  const mode = context.gameMode();
  if (mode === 'commercial') {
    if (context.gamemap() !== 7) return;
    if (mo.type !== MobjType.FATSO && mo.type !== MobjType.BABY) return;
  } else {
    if (!checkBossEnd(mo.type)) return;
  }

  let alive = false;
  for (let i = 0; i < context.players.length; i++) {
    if (context.playeringame[i] && context.players[i]!.health > 0) {
      alive = true;
      break;
    }
  }
  if (!alive) return;

  let anyOtherBossLeft = false;
  context.thinkerList.forEach((thinker: ThinkerNode) => {
    if (anyOtherBossLeft) return;
    if (thinker.action !== mobjThinker) return;
    const other = thinker as Mobj;
    if (other === mo) return;
    if (other.type !== mo.type) return;
    if (other.health > 0) anyOtherBossLeft = true;
  });
  if (anyOtherBossLeft) return;

  if (mode === 'commercial') {
    if (context.gamemap() === 7) {
      if (mo.type === MobjType.FATSO) {
        context.doFloor(BOSS_DEATH_FATSO_TAG, 'lowerFloorToLowest');
        return;
      }
      if (mo.type === MobjType.BABY) {
        context.doFloor(BOSS_DEATH_BABY_TAG, 'raiseToTexture');
        return;
      }
    }
  } else {
    switch (context.gameepisode()) {
      case 1:
        context.doFloor(BOSS_DEATH_TAG, 'lowerFloorToLowest');
        return;
      case 4:
        switch (context.gamemap()) {
          case 6:
            context.doDoor(BOSS_DEATH_TAG, 'blazeOpen');
            return;
          case 8:
            context.doFloor(BOSS_DEATH_TAG, 'lowerFloorToLowest');
            return;
        }
        break;
    }
  }

  context.exitLevel();
}

// ── A_Hoof / A_Metal / A_BabyMetal ──────────────────────────────────

/**
 * A_Hoof from p_enemy.c: cyberdemon footfall + chase.  Plays sfx_hoof
 * on the actor (NOT world-relative) before delegating to the chase
 * action.
 */
export function aHoof(mo: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(mo, SFX_HOOF);
  context.chaseAction(mo);
}

/**
 * A_Metal from p_enemy.c: spider mastermind / cyberdemon metal step
 * footfall + chase.
 */
export function aMetal(mo: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(mo, SFX_METAL);
  context.chaseAction(mo);
}

/**
 * A_BabyMetal from p_enemy.c: arachnotron walk sfx + chase.
 */
export function aBabyMetal(mo: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(mo, SFX_BSPWLK);
  context.chaseAction(mo);
}

// ── A_BrainAwake ────────────────────────────────────────────────────

/**
 * A_BrainAwake from p_enemy.c: scan thinker list for MT_BOSSTARGET
 * spots and seed {@link braintargets}; play sfx_bossit world-relative.
 *
 * Resets {@link numbraintargets} and {@link braintargeton} to 0 first.
 * Vanilla writes past index 31 if more than 32 spots exist (UB); we
 * silently drop overflow.  Consumes no RNG.
 */
export function aBrainAwake(_mo: Mobj): void {
  if (!context) return;

  numbraintargets = 0;
  braintargeton = 0;

  context.thinkerList.forEach((thinker: ThinkerNode) => {
    if (thinker.action !== mobjThinker) return;
    const m = thinker as Mobj;
    if (m.type !== MobjType.BOSSTARGET) return;
    if (numbraintargets >= MAX_BRAIN_TARGETS) return;
    braintargets[numbraintargets] = m;
    numbraintargets++;
  });

  if (context.startSound) context.startSound(null, SFX_BOSSIT);
}

// ── A_BrainPain ─────────────────────────────────────────────────────

/**
 * A_BrainPain from p_enemy.c: play sfx_bospn world-relative.  No
 * animation change (the brain stays in BRAIN_PAIN until tics expire).
 * Consumes no RNG.
 */
export function aBrainPain(_mo: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(null, SFX_BOSPN);
}

// ── A_BrainScream ───────────────────────────────────────────────────

/**
 * Spawn a single MT_ROCKET explosion for A_BrainScream/A_BrainExplode.
 *
 * Per-rocket RNG order: pRandom for z, pRandom for momz, pRandom for
 * tics jitter — three calls.  After spawn, the rocket transitions to
 * S_BRAINEXPLODE1 via setMobjState (chained tics handled by host).
 */
function spawnBrainRocket(x: Fixed, y: Fixed): void {
  if (!context) return;

  const z = (BRAIN_ROCKET_Z_BASE + context.rng.pRandom() * BRAIN_ROCKET_Z_RAND_MUL) | 0;
  const th = context.spawnMobj(x, y, z, MobjType.ROCKET);
  th.momz = (context.rng.pRandom() * BRAIN_ROCKET_MOMZ_MUL) | 0;

  context.setMobjState(th, StateNum.BRAINEXPLODE1);

  th.tics = (th.tics - (context.rng.pRandom() & BRAIN_ROCKET_TIC_JITTER_MASK)) | 0;
  if (th.tics < 1) th.tics = 1;
}

/**
 * A_BrainScream from p_enemy.c: fan rockets across the brain's front.
 *
 * Outer loop steps `x` from `mo.x + BRAIN_SCREAM_X_START` up to (but
 * not reaching) `mo.x + BRAIN_SCREAM_X_END` in BRAIN_SCREAM_X_STEP
 * strides.  At each step, y is pinned at `mo.y + BRAIN_SCREAM_Y_OFFSET`
 * and {@link spawnBrainRocket} fires.  Final action: sfx_bosdth
 * world-relative.
 *
 * For default mo at origin, the loop covers x in
 * [-196*FRACUNIT, 320*FRACUNIT) stepping by 8*FRACUNIT — 65 rockets,
 * each consuming 3 P_Random.
 */
export function aBrainScream(mo: Mobj): void {
  if (!context) return;

  const xStart = (mo.x + BRAIN_SCREAM_X_START) | 0;
  const xEnd = (mo.x + BRAIN_SCREAM_X_END) | 0;
  const y = (mo.y + BRAIN_SCREAM_Y_OFFSET) | 0;

  for (let x = xStart; x < xEnd; x += BRAIN_SCREAM_X_STEP) {
    spawnBrainRocket(x, y);
  }

  if (context.startSound) context.startSound(null, SFX_BOSDTH);
}

// ── A_BrainExplode ──────────────────────────────────────────────────

/**
 * A_BrainExplode from p_enemy.c: single-rocket primitive used during
 * the brain's death-loop frames.
 *
 * RNG order: pSubRandom (2 calls) for x scatter, then pRandom×3 for
 * z/momz/tics (via {@link spawnBrainRocket}).  Total 5 P_Random calls.
 * No final sound — the death-loop frames each call this individually.
 */
export function aBrainExplode(mo: Mobj): void {
  if (!context) return;
  const x = (mo.x + context.rng.pSubRandom() * BRAIN_EXPLODE_X_SCATTER) | 0;
  const y = mo.y;
  spawnBrainRocket(x, y);
}

// ── A_BrainDie ──────────────────────────────────────────────────────

/**
 * A_BrainDie from p_enemy.c: G_ExitLevel.  Consumes no RNG.  The
 * actual map transition is host-side; we just signal via the callback.
 */
export function aBrainDie(_mo: Mobj): void {
  if (!context) return;
  context.exitLevel();
}

// ── A_BrainSpit ─────────────────────────────────────────────────────

/**
 * A_BrainSpit from p_enemy.c: fire MT_SPAWNSHOT at the next bosstarget.
 *
 * Always toggles {@link brainSpitEasy} regardless of skill.  When
 * `gameskill <= SK_EASY` AND the post-toggle easy flag is 0, returns
 * silently — net effect: every other call fires on Easy, every call
 * fires on higher skills.
 *
 * Throws when {@link numbraintargets} is 0 (vanilla crashes here too,
 * via NULL deref on `braintargets[0]`).
 *
 * After the missile spawns with `target = mo` (P_SpawnMissile side
 * effect), this overrides `target = targ` so the cube tracks its
 * destination spot, then computes reactiontime from the y-delta and
 * the cube's momy and state.tics so A_SpawnFly fires when the cube
 * crosses the target column.
 */
export function aBrainSpit(mo: Mobj): void {
  if (!context) return;

  brainSpitEasy ^= 1;
  if (context.gameskill() <= SK_EASY && brainSpitEasy === 0) return;

  if (numbraintargets === 0) {
    throw new Error('A_BrainSpit: numbraintargets was 0 (vanilla crashes here)');
  }

  const targ = braintargets[braintargeton]!;
  braintargeton = (braintargeton + 1) % numbraintargets;

  const newmobj = context.spawnMissile(mo, targ, MobjType.SPAWNSHOT);
  newmobj.target = targ;

  const stateTics = newmobj.state?.tics ?? 1;
  const momy = newmobj.momy;
  if (momy !== 0 && stateTics !== 0) {
    newmobj.reactiontime = (((((targ.y - mo.y) | 0) / momy) | 0) / stateTics) | 0;
  } else {
    newmobj.reactiontime = 0;
  }

  if (context.startSound) context.startSound(null, SFX_BOSPIT);
}

// ── A_SpawnSound ────────────────────────────────────────────────────

/**
 * A_SpawnSound from p_enemy.c: travelling-cube sound + delegate to
 * {@link aSpawnFly}.  The cube's reactiontime countdown advances on
 * every tic via aSpawnFly; this wrapper just plays sfx_boscub on the
 * cube before delegating.
 */
export function aSpawnSound(mo: Mobj): void {
  if (!context) return;
  if (context.startSound) context.startSound(mo, SFX_BOSCUB);
  aSpawnFly(mo);
}

// ── A_SpawnFly ──────────────────────────────────────────────────────

/**
 * Pick a monster type for A_SpawnFly given a P_Random roll.
 *
 * The vanilla weighted distribution gives common low-tier monsters
 * heavy weight and arch-vile / archer the smallest slice (each just 2
 * out of 256).  The decreasing-likelihood comment in p_enemy.c is
 * misleading — TROOP/SERGEANT/SHADOWS together cover 47% of rolls.
 */
export function pickSpawnFlyType(r: number): MobjType {
  if (r < 50) return MobjType.TROOP;
  if (r < 90) return MobjType.SERGEANT;
  if (r < 120) return MobjType.SHADOWS;
  if (r < 130) return MobjType.PAIN;
  if (r < 160) return MobjType.HEAD;
  if (r < 162) return MobjType.VILE;
  if (r < 172) return MobjType.UNDEAD;
  if (r < 192) return MobjType.BABY;
  if (r < 222) return MobjType.FATSO;
  if (r < 246) return MobjType.KNIGHT;
  return MobjType.BRUISER;
}

/**
 * A_SpawnFly from p_enemy.c: travelling cube reaches its target.
 *
 * Decrements `mo.reactiontime` first; if the result is non-zero, the
 * cube is still flying and we early-return.  When reactiontime hits
 * 0:
 *
 * 1. Resolve target (P_SubstNullMobj — we throw on null).
 * 2. Spawn MT_SPAWNFIRE fog at target.x/y/z; play sfx_telept on fog.
 * 3. Roll P_Random and pick monster type via {@link pickSpawnFlyType}.
 * 4. Spawn the monster at target.x/y/z.
 * 5. lookForPlayers(allaround=true); on success → seestate.
 * 6. teleportMove the new monster (telefrag anything in the cell).
 * 7. removeMobj(mo) — destroy the cube.
 */
export function aSpawnFly(mo: Mobj): void {
  if (!context) return;

  mo.reactiontime = (mo.reactiontime - 1) | 0;
  if (mo.reactiontime !== 0) return;

  const targ = mo.target;
  if (targ === null) {
    throw new Error('A_SpawnFly: cube has no target (vanilla P_SubstNullMobj sentinel)');
  }

  const fog = context.spawnMobj(targ.x, targ.y, targ.z, MobjType.SPAWNFIRE);
  if (context.startSound) context.startSound(fog, SFX_TELEPT);

  const r = context.rng.pRandom();
  const type = pickSpawnFlyType(r);

  const newmobj = context.spawnMobj(targ.x, targ.y, targ.z, type);
  if (context.lookForPlayers(newmobj, true)) {
    const seestate = (newmobj.info?.seestate ?? StateNum.NULL) as StateNum;
    context.setMobjState(newmobj, seestate);
  }

  context.teleportMove(newmobj, newmobj.x, newmobj.y);

  context.removeMobj(mo);
}

// ── State action wiring ─────────────────────────────────────────────

/**
 * Number of STATES entries {@link wireBossSpecialsActions} installs:
 *
 * - aPainDie: 1 (PAIN_DIE5)
 * - aKeenDie: 1 (COMMKEEN11)
 * - aBossDeath: 5 (FATT_DIE10, BOSS_DIE7, SPID_DIE11, BSPI_DIE7, CYBER_DIE10)
 * - aHoof: 1 (CYBER_RUN1)
 * - aMetal: 4 (SPID_RUN1/5/9, CYBER_RUN7)
 * - aBabyMetal: 2 (BSPI_RUN1, BSPI_RUN7)
 * - aBrainAwake: 1 (BRAINEYESEE)
 * - aBrainSpit: 1 (BRAINEYE1)
 * - aBrainPain: 1 (BRAIN_PAIN)
 * - aBrainScream: 1 (BRAIN_DIE1)
 * - aBrainDie: 1 (BRAIN_DIE4)
 * - aBrainExplode: 1 (BRAINEXPLODE3)
 * - aSpawnSound: 1 (SPAWN1)
 * - aSpawnFly: 3 (SPAWN2, SPAWN3, SPAWN4)
 *
 * Total = 24.
 */
export const BOSS_SPECIALS_ACTION_COUNT = 24;

/**
 * Wire every boss/death special action into the STATES table so
 * setMobjState transitions invoke the correct behavior.  Idempotent.
 */
export function wireBossSpecialsActions(): void {
  STATES[StateNum.PAIN_DIE5]!.action = aPainDie;
  STATES[StateNum.COMMKEEN11]!.action = aKeenDie;

  STATES[StateNum.FATT_DIE10]!.action = aBossDeath;
  STATES[StateNum.BOSS_DIE7]!.action = aBossDeath;
  STATES[StateNum.SPID_DIE11]!.action = aBossDeath;
  STATES[StateNum.BSPI_DIE7]!.action = aBossDeath;
  STATES[StateNum.CYBER_DIE10]!.action = aBossDeath;

  STATES[StateNum.CYBER_RUN1]!.action = aHoof;

  STATES[StateNum.SPID_RUN1]!.action = aMetal;
  STATES[StateNum.SPID_RUN5]!.action = aMetal;
  STATES[StateNum.SPID_RUN9]!.action = aMetal;
  STATES[StateNum.CYBER_RUN7]!.action = aMetal;

  STATES[StateNum.BSPI_RUN1]!.action = aBabyMetal;
  STATES[StateNum.BSPI_RUN7]!.action = aBabyMetal;

  STATES[StateNum.BRAINEYESEE]!.action = aBrainAwake;
  STATES[StateNum.BRAINEYE1]!.action = aBrainSpit;
  STATES[StateNum.BRAIN_PAIN]!.action = aBrainPain;
  STATES[StateNum.BRAIN_DIE1]!.action = aBrainScream;
  STATES[StateNum.BRAIN_DIE4]!.action = aBrainDie;
  STATES[StateNum.BRAINEXPLODE3]!.action = aBrainExplode;

  STATES[StateNum.SPAWN1]!.action = aSpawnSound;
  STATES[StateNum.SPAWN2]!.action = aSpawnFly;
  STATES[StateNum.SPAWN3]!.action = aSpawnFly;
  STATES[StateNum.SPAWN4]!.action = aSpawnFly;
}
