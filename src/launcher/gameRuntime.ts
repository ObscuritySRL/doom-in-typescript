/**
 * Live DOOM game runtime — the assembled vanilla P_Ticker.
 *
 * The launcher session (`session.ts`) spawns a fully-populated level
 * (player + every map thing + lights + psprites) and owns the
 * bit-exact `R_RenderPlayerView`, but its `advanceLauncherSession`
 * only ticks the *player*: monsters never even animate. This module
 * assembles the real Chocolate Doom 2.2.1 `p_tick.c` P_Ticker on top
 * of that session so the world actually comes alive:
 *
 *   - The monster AI brain (`p_enemy.c` A_Look / A_Chase) is wired
 *     into the shared STATES action table for the whole monster
 *     roster, so `P_RunThinkers` drives idle→see→chase exactly as
 *     vanilla does (via each state's action pointer).
 *   - The completed P_MobjThinker (P_XYMovement + P_ZMovement, the
 *     halves `mobjThinker` deliberately omits to avoid a module
 *     cycle) is injected through `setMobjMovementHook`, so every
 *     mobj — present and future (projectiles, blood, dropped items) —
 *     moves under its momentum.
 *   - `tickGame` runs the canonical per-tic order: P_PlayerThink
 *     (move + height + use + psprites) → P_RunThinkers → leveltime++.
 *
 * Combat/pain/death/specials action wiring (monster attacks, hitscan,
 * projectiles, doors/lifts) layers on in the following milestones; the
 * state machine treats their still-`null` actions as inert no-ops, so
 * monsters chase here without yet trading damage.
 *
 * @example
 * ```ts
 * const resources = await loadLauncherResources('doom/DOOM1.WAD');
 * const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
 * tickGame(runtime, EMPTY_TICCMD);
 * const framebuffer = renderGame(runtime);
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import type { TicCommand } from '../input/ticcmd.ts';
import type { ChaseContext } from '../ai/chase.ts';
import type { MonsterAttackContext } from '../ai/attacks.ts';
import type { StateTransitionContext } from '../ai/stateTransitions.ts';
import type { PlayerLike, TargetingContext } from '../ai/targeting.ts';
import type { GameMode } from '../bootstrap/gameMode.ts';
import type { HitscanContext } from '../player/hitscan.ts';
import type { Player } from '../player/playerSpawn.ts';
import type { PickupContext } from '../player/pickups.ts';
import type { ProjectileContext } from '../player/projectiles.ts';
import type { XYMovementCallbacks } from '../world/xyMovement.ts';
import type { LauncherResources, LauncherSession } from './session.ts';

import { BT_USE } from '../input/ticcmd.ts';
import { setMonsterAttackContext, wireMonsterAttackActions } from '../ai/attacks.ts';
import { chase } from '../ai/chase.ts';
import { clearStateTransitionContext, setStateTransitionContext, wirePainDeathActions } from '../ai/stateTransitions.ts';
import { checkSight, lookForPlayers } from '../ai/targeting.ts';
import { identifyGame } from '../bootstrap/gameMode.ts';
import { pointInSubsector } from '../map/nodeTraversal.ts';
import { setHitscanContext, wireHitscanActions } from '../player/hitscan.ts';
import { VANILLA_CF_GODMODE } from '../player/implement-god-mode-and-powerup-flags.ts';
import { calcHeight, movePlayer } from '../player/movement.ts';
import { clearPickupContext, setPickupContext, touchSpecialThing } from '../player/pickups.ts';
import { movePsprites, pspriteActions } from '../player/playerSpawn.ts';
import { setProjectileContext, wireProjectileActions } from '../player/projectiles.ts';
import { dropWeapon } from '../player/weaponStates.ts';
import { pCrossSpecialLine, pUseSpecialLine } from '../specials/lineTriggers.ts';
import { buildSpecialsModel } from '../specials/specialsLevel.ts';
import type { PendingLevelCompletion, SpecialsModel } from '../specials/specialsLevel.ts';
import { rPointToAngle2 } from '../render/wallScaleMath.ts';
import { computeStatusBarValues, createStatusBarState, tickStatusBar } from '../ui/statusBar.ts';
import type { StatusBarState } from '../ui/statusBar.ts';
import { createStatusBarRenderer, drawStatusBar } from '../ui/statusBarDraw.ts';
import type { StatusBarRenderer } from '../ui/statusBarDraw.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';
import { clearDamageContext, damageMobj, setDamageContext } from '../world/damage.ts';
import { makeHitscanPrimitives } from '../world/hitscanAttack.ts';
import { MF_COUNTITEM, MF_COUNTKILL, MF_SKULLFLY, MOBJINFO, Mobj, MobjType, ONCEILINGZ, ONFLOORZ, STATES, StateNum, setMobjMovementHook, setMobjState, spawnMobj } from '../world/mobj.ts';
import { radiusAttack } from '../world/radiusAttack.ts';
import { REMOVED } from '../world/thinkers.ts';
import { tryMove } from '../world/tryMove.ts';
import { useLines } from '../world/useLines.ts';
import { xyMovement } from '../world/xyMovement.ts';
import { zMovement } from '../world/zMovement.ts';
import { createLauncherSession, renderLauncherFrame } from './session.ts';

/**
 * Narrow audio surface the runtime drives.  Implemented by
 * `src/launcher/win32Audio.ts` `Win32AudioHost`; injected (not
 * hard-imported) so the runtime stays headless-testable and the
 * silent-by-default path (no host) is a plain `undefined`.
 *
 * `startSfx(origin, sfxId)` is the host side of vanilla
 * `S_StartSound`: `origin.originId` is the mobj identity used for
 * channel origin-dedup (`null` ⇒ anonymous/fullscreen, centre pan,
 * full volume); `origin.x/y` is the source world position the host
 * feeds into `S_AdjustSoundParams` against the listener it last saw
 * in {@link GameAudioBridge.pump}.
 */
export interface GameAudioBridge {
  startSfx(origin: { readonly originId: number | null; readonly x: number; readonly y: number } | null, sfxId: number): unknown;
  startMusic(mapName: string): void;
  shutdown(): void;
}

/**
 * Level intermission totals (vanilla `totalkills`/`totalitems`/
 * `totalsecret` + the g_game.c par time for this episode/map).
 */
export interface LevelTotals {
  readonly totalKills: number;
  readonly totalItems: number;
  readonly totalSecret: number;
  /** g_game.c `pars[episode][map]` seconds × TICRATE, or 0 if none. */
  readonly parTimeTics: number;
}

/** TICRATE — 35 tics per second (d_main.c). */
const TICRATE = 35;

/**
 * Vanilla g_game.c `pars[4][10]` par times in seconds.  Index 0 is
 * the unused `{0}` row; rows 1-3 are episodes 1-3 (Doom 1).  Episode
 * 1 (Knee-Deep in the Dead) is `{0,30,75,120,90,90,165,180,180,165}`
 * — index `[ep][map]`, map 1-9.  The Ultimate-DOOM episode-4 table is
 * a separate `cpars`-style array vanilla does not include here; the
 * C1 shareware target is episode 1 only, so episode 4 falls through
 * to 0 (no par shown), exactly as a missing entry would.
 */
const PARS: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([0]),
  Object.freeze([0, 30, 75, 120, 90, 90, 165, 180, 180, 165]),
  Object.freeze([0, 90, 90, 90, 120, 90, 360, 240, 170, 180]),
  Object.freeze([0, 90, 45, 90, 150, 90, 90, 165, 30, 135]),
]);

/** Parse an `E#M#` map name into 1-based episode/map, or null. */
function parseEpisodeMap(mapName: string): { episode: number; map: number } | null {
  const match = /^E(\d)M(\d)$/i.exec(mapName);
  if (match === null) return null;
  return { episode: Number(match[1]), map: Number(match[2]) };
}

/**
 * g_game.c `G_DoCompleted` par lookup: `wminfo.partime = TICRATE *
 * pars[gameepisode][gamemap]`.  Returns 0 when the episode/map has no
 * par entry (vanilla guards the table read with the episode/map
 * range; out-of-range is treated as no par for the C1 target).
 */
function parTimeTicsFor(mapName: string): number {
  const key = parseEpisodeMap(mapName);
  if (key === null) return 0;
  const row = PARS[key.episode];
  if (row === undefined) return 0;
  const seconds = row[key.map];
  if (seconds === undefined) return 0;
  return TICRATE * seconds;
}

/** Options for {@link createGameRuntime}. */
export interface GameRuntimeOptions {
  readonly mapName: string;
  readonly skill: number;
  /**
   * Live audio host.  Omit (or pass `null`) for the historical silent
   * runtime — every `startSound` context stays a no-op exactly as
   * before.  When supplied, the assembled `S_StartSound` chain is
   * threaded into all six combat contexts plus A_Chase, and the map's
   * music is started at level setup.
   */
  readonly audio?: GameAudioBridge | null;
}

/** Assembled live game runtime handle. */
export interface GameRuntime {
  /** The underlying launcher session (owns map, renderer, RNG). */
  readonly session: LauncherSession;
  /** The local player. */
  readonly player: Player;
  /** The active thinker ring (P_RunThinkers list). */
  readonly thinkerList: LauncherSession['thinkerList'];
  /** Number of game tics simulated so far (== session leveltime). */
  readonly levelTime: number;
  /**
   * The level-bound sector/line-special model (doors, floors, plats,
   * ceilings, stairs/donut, teleport, switch buttons).  Exposed so
   * tests can assert sector heights / button timers; production code
   * never touches it directly (`tickGame` drives it).
   */
  readonly specials: SpecialsModel;
  /**
   * The per-runtime vanilla status bar state (st_stuff.c face state
   * machine + key-box memory). `tickGame` advances it every tic after
   * P_PlayerThink; `renderGame` composites it over the player view.
   * Instance-scoped — no module global, so the shared Bun test worker
   * stays hermetic without a reset hook.
   */
  readonly statusBar: StatusBarState;
  /**
   * The level's intermission totals, captured at level setup exactly
   * as vanilla `P_SetupLevel` resets `totalkills/totalitems/
   * totalsecret = 0` then `P_SpawnMapThing` increments
   * `totalkills`/`totalitems` per MF_COUNTKILL/MF_COUNTITEM thing and
   * `P_SpawnSpecials` increments `totalsecret` per sector special 9.
   * `parTimeTics` is the g_game.c `pars[episode][map]` value (seconds
   * × TICRATE), or 0 for maps without a par entry.
   */
  readonly levelTotals: LevelTotals;
  /**
   * The pending level completion latched by the exit special
   * (vanilla `gameaction == ga_completed` with `secretexit`), or
   * `null` while the level is still in play.  The host reads this each
   * tic and runs the `G_DoCompleted` → intermission transition.
   */
  readonly levelComplete: PendingLevelCompletion | null;
  /**
   * Force a level completion, exactly as the boss-death `A_BossDeath`
   * tag-666 path or a direct `G_ExitLevel`/`G_SecretExitLevel` call
   * does in vanilla (the E1M8 baron death calls `G_ExitLevel()` with
   * no line special).  `secret` selects the secret-exit route.
   * Idempotent — the first completion this level wins (vanilla's
   * single `gameaction` slot).
   */
  exitLevel(secret: boolean): void;
  /** Enumerate every live mobj on the thinker list (spawn order). */
  allMobjs(): Mobj[];
  /**
   * Restore the process-global state this runtime mutated (movement
   * hook + AI codepointers). Production launches one runtime for the
   * process lifetime and never call this; the test suite does, to stay
   * hermetic across the shared Bun worker.
   */
  dispose(): void;
}

/**
 * Per-runtime status bar draw dependencies that are not part of the
 * public {@link GameRuntime} surface: the decoded-patch cache bound to
 * the IWAD and the injected `R_PointToAngle2` the face state machine's
 * attacker-pain branch needs. Keyed weakly by the runtime so it is
 * collected with it and never leaks across the shared test worker.
 */
const statusBarDeps = new WeakMap<GameRuntime, { renderer: StatusBarRenderer; pointToAngle2: (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed) => Angle }>();

const STATE_CHAIN_WALK_CAP = 64;

/**
 * Walk a state chain from `startState` following `nextstate`, assigning
 * `action` to every state visited, stopping on S_NULL, a revisit, or
 * the safety cap. Mirrors how `info.c` tags every S_*_STND frame with
 * A_Look and every S_*_RUN frame with A_Chase.
 */
function assignStateChainAction(startState: StateNum, action: ((mobj: Mobj) => void) | null): void {
  let stateIndex: number = startState;
  const visited = new Set<number>();
  for (let step = 0; step < STATE_CHAIN_WALK_CAP; step += 1) {
    if (stateIndex === StateNum.NULL || visited.has(stateIndex)) {
      return;
    }
    visited.add(stateIndex);
    const state = STATES[stateIndex];
    if (state === undefined) {
      return;
    }
    state.action = action;
    stateIndex = state.nextstate;
  }
}

/**
 * Apply `spawnAction` to every MF_COUNTKILL monster's stand-state
 * chain and `seeAction` to its see-state chain (info.c parity). Pass
 * `null` for both to restore the pristine table.
 */
function forEachRosterAiChain(spawnAction: ((mobj: Mobj) => void) | null, seeAction: ((mobj: Mobj) => void) | null): void {
  for (let mobjType = 0; mobjType < MOBJINFO.length; mobjType += 1) {
    const info = MOBJINFO[mobjType]!;
    if ((info.flags & MF_COUNTKILL) === 0) {
      continue;
    }
    assignStateChainAction(info.spawnstate, spawnAction);
    assignStateChainAction(info.seestate, seeAction);
  }
}

/**
 * Snapshot of `pspriteActions` taken in {@link wireCombat} immediately
 * before the hitscan/projectile psprite actions are installed (i.e. the
 * 55-entry table left by `session.ts`'s `wireWeaponStateActions`).
 * {@link resetGameRuntimeGlobals} restores it so the shared Bun worker's
 * `pspriteActions` count stays pristine across tests, mirroring how
 * `forEachRosterAiChain(null, null)` restores the STATES AI chains.
 */
let preCombatPspriteActions: readonly (typeof pspriteActions)[number][] | null = null;

/**
 * Restore the process-global state the live runtime mutates — the
 * P_MobjThinker movement hook, the monster AI codepointers in the
 * shared STATES table, the player-psprite action table, and every
 * injected combat/pickup/damage context — to pristine. Idempotent.
 * Vanilla wires these once per process; this exists purely for
 * test-suite isolation.
 *
 * The STATES attack/pain/death action pointers installed by
 * `wireMonsterAttackActions` / `wirePainDeathActions` are left in place:
 * they are pure functions of their injected context, and clearing the
 * contexts makes them inert (every action early-returns on a null
 * context), exactly as `forEachRosterAiChain(null, null)` neutralizes
 * the look/chase chains. `pspriteActions`, by contrast, is also size-
 * asserted by the weapon-state suite, so it is snapshotted/restored
 * verbatim rather than left wired-but-inert.
 */
export function resetGameRuntimeGlobals(): void {
  setMobjMovementHook(null);
  forEachRosterAiChain(null, null);
  clearDamageContext();
  clearStateTransitionContext();
  clearPickupContext();
  setHitscanContext(null);

  if (preCombatPspriteActions !== null) {
    pspriteActions.length = 0;
    for (const action of preCombatPspriteActions) {
      pspriteActions.push(action);
    }
    preCombatPspriteActions = null;
  }
}

/**
 * Build the geometry-based `sectors`-index resolver `checkSight` /
 * `P_LookForPlayers` need for the REJECT fast-path. The launcher keeps
 * mobj `subsector.sector` pointing at the parse-layer sectors while
 * `mapData.sectors` is a mutable clone, so a reference map is unsafe;
 * `pointInSubsector` + the P_GroupLines subsector→sector table is the
 * reference-faithful (`mobj->subsector->sector - sectors`) equivalent.
 */
function makeSectorIndexResolver(session: LauncherSession): (mobj: Mobj) => number {
  const { mapData } = session;
  return (mobj: Mobj): number => {
    const subsectorIndex = pointInSubsector(mobj.x, mobj.y, mapData.nodes);
    return mapData.subsectorSectors[subsectorIndex] ?? 0;
  };
}

/**
 * Per-runtime stable identity for the channel origin-dedup the
 * `S_StartSound` / `S_GetChannel` path needs.  Vanilla compares the
 * raw `mobj_t *` pointer; JS has no stable object id, so a WeakMap
 * assigns a small monotone integer the first time a mobj emits sound
 * (collected with the mobj — no leak across the shared test worker).
 * The player mobj gets id `1` so the host's "origin === listener"
 * self-origin centre-pan fast path lines up with the listener id
 * `tickGame` feeds the host (see {@link buildStartSound}).
 */
const PLAYER_ORIGIN_ID = 1;

/**
 * Build the live `S_StartSound(origin, sfx_id)` callback wired into
 * every combat / pickup / chase context.  Maps the origin Mobj to a
 * stable channel identity and its world x/y, then delegates to the
 * injected audio host (which owns the assembled `soundSystem` /
 * `audioParity` start path).  A `null` origin is an
 * anonymous/fullscreen sound (boss cue, pickup) — forwarded with a
 * `null` originId so the host skips spatialization, exactly as
 * vanilla `S_StartSound(NULL, sfx)` does.
 */
function buildStartSound(audio: GameAudioBridge, session: LauncherSession): (origin: Mobj | null, sfxId: number) => void {
  const originIds = new WeakMap<Mobj, number>();
  let nextOriginId = PLAYER_ORIGIN_ID + 1;
  const idFor = (mobj: Mobj): number => {
    if (mobj === session.player.mo) {
      return PLAYER_ORIGIN_ID;
    }
    let id = originIds.get(mobj);
    if (id === undefined) {
      id = nextOriginId;
      nextOriginId += 1;
      originIds.set(mobj, id);
    }
    return id;
  };
  return (origin: Mobj | null, sfxId: number): void => {
    if (origin === null) {
      audio.startSfx(null, sfxId);
      return;
    }
    audio.startSfx({ originId: idFor(origin), x: origin.x, y: origin.y }, sfxId);
  };
}

/**
 * Resolve the vanilla game mode for this IWAD (shareware / registered /
 * retail / commercial). `A_Scream` and `A_PlayerScream` branch on it,
 * and the pickup dispatch gates the megasphere / commercial-only paths
 * on it. `identifyGame` reproduces Chocolate Doom's d_iwad.c +
 * d_main.c detection from the WAD's lump table.
 */
function resolveGameMode(resources: LauncherResources): GameMode {
  const lookup = new LumpLookup(resources.directory);
  return identifyGame(resources.iwadPath, lookup).gameMode;
}

/**
 * Assemble the combat layer on top of an already-bootstrapped session:
 * build the level-bound P_AimLineAttack / P_LineAttack / P_DamageMobj
 * primitives, inject every still-`null` action context (monster
 * attacks, hitscan psprites, projectile psprites, pain/death, pickups),
 * and wire the action tables. After this runs the state machine trades
 * real damage exactly as Chocolate Doom 2.2.1 P_Ticker does.
 *
 * RNG note: every primitive shares `session.doomRandom`, so the bullet
 * trace, damage rolls, puff/blood jitter, and pain/death checks all
 * advance the one parity-critical P_Random stream in vanilla order.
 */
function wireCombat(
  session: LauncherSession,
  resources: LauncherResources,
  options: GameRuntimeOptions,
  targetingContext: TargetingContext,
  combatMoveCallbacks: XYMovementCallbacks,
  startSound: ((origin: Mobj | null, sfxId: number) => void) | null,
): void {
  const gameMode = resolveGameMode(resources);

  // P_SpawnMobj bound to this level's RNG / thinker list / skill, with
  // the launcher's per-thing subsector + floor/ceiling resolution so
  // freshly spawned puffs/blood/drops have a valid ONFLOORZ/Z.
  const spawnMobjBound = (x: Fixed, y: Fixed, z: Fixed, type: MobjType): Mobj => {
    const mobj = spawnMobj(x, y, z, type, session.doomRandom, session.thinkerList, options.skill);
    refreshSpawnedMobjSector(mobj, session, z);
    return mobj;
  };

  const pointToAngle2 = (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed): Angle => rPointToAngle2(x1, y1, x2, y2) >>> 0;

  const tryMoveBound = (mobj: Mobj, x: Fixed, y: Fixed): boolean => tryMove(mobj, x, y, session.mapData, session.blocklinks, combatMoveCallbacks).moved;

  const radiusAttackBound = (spot: Mobj, source: Mobj | null, damage: number): void => {
    radiusAttack(spot, source ?? spot, damage, session.mapData.blockmap, session.blocklinks, {
      checkSight: (looker: Mobj, target: Mobj): boolean => checkSight(looker, target, targetingContext),
      damageMobj,
    });
  };

  // P_DamageMobj / P_KillMobj.
  setDamageContext({
    rng: session.doomRandom,
    thinkerList: session.thinkerList,
    spawnMobj: spawnMobjBound,
    pointToAngle2,
    dropWeapon,
    gameMode: () => gameMode,
    gameskill: () => options.skill,
    netgame: false,
    players: [session.player],
  });

  // P_AimLineAttack / P_LineAttack (+ P_SpawnPuff / P_SpawnBlood).
  const { aimLineAttack, lineAttack } = makeHitscanPrimitives({
    mapData: session.mapData,
    blocklinks: session.blocklinks,
    rng: session.doomRandom,
    thinkerList: session.thinkerList,
    spawnMobj: spawnMobjBound,
    damageMobj,
  });

  const hitscanContext: HitscanContext = {
    rng: session.doomRandom,
    thinkerList: session.thinkerList,
    lineAttack,
    aimLineAttack,
    pointToAngle2,
    startSound,
  };
  setHitscanContext(hitscanContext);

  const projectileContext: ProjectileContext = {
    rng: session.doomRandom,
    thinkerList: session.thinkerList,
    aimLineAttack,
    spawnMobj: spawnMobjBound,
    tryMove: tryMoveBound,
    damageMobj,
    startSound,
  };
  setProjectileContext(projectileContext);

  const monsterAttackContext: MonsterAttackContext = {
    rng: session.doomRandom,
    thinkerList: session.thinkerList,
    targetingContext,
    spawnMobj: spawnMobjBound,
    tryMove: tryMoveBound,
    damageMobj,
    lineAttack,
    aimLineAttack,
    radiusAttack: (spot: Mobj, source: Mobj, damage: number): void => radiusAttackBound(spot, source, damage),
    pointToAngle2,
    startSound,
    // A_Tracer gates on `(gametic & 3) === 0`; the launcher's vanilla
    // game-tic counter is `session.levelTime` (incremented once per
    // P_Ticker after P_RunThinkers, exactly as vanilla gametic).
    gametic: (): number => session.levelTime,
  };
  setMonsterAttackContext(monsterAttackContext);

  const stateTransitionContext: StateTransitionContext = {
    rng: session.doomRandom,
    startSound,
    radiusAttack: radiusAttackBound,
    gameMode: () => gameMode,
  };
  setStateTransitionContext(stateTransitionContext);

  const pickupContext: PickupContext = {
    gameMode,
    gameskill: options.skill,
    netgame: false,
    deathmatch: 0,
    isConsolePlayer: true,
    thinkerList: session.thinkerList,
    startSound,
  };
  setPickupContext(pickupContext);

  // Snapshot the weapon-state-only pspriteActions table (the 55 entries
  // session.ts's wireWeaponStateActions installed) before the hitscan /
  // projectile fire actions extend it, so resetGameRuntimeGlobals can
  // restore it for the shared Bun test worker. Captured ONCE per
  // reset cycle: a second createGameRuntime before a reset (e.g. the
  // determinism tests build two runtimes) must not re-snapshot the
  // already-combat-extended 66-entry table as the pristine baseline.
  // The combat wiring is idempotent (same slots), so the first
  // capture's 55-entry baseline stays valid until the next reset.
  if (preCombatPspriteActions === null) {
    preCombatPspriteActions = pspriteActions.slice();
  }

  wireMonsterAttackActions();
  wireHitscanActions();
  wireProjectileActions();
  wirePainDeathActions();
}

/**
 * Give a freshly spawned mobj (puff, blood, dropped item, projectile) a
 * valid subsector + floor/ceiling, mirroring the launcher's
 * `refreshThingSector` so P_ZMovement and the ONFLOORZ resolution in
 * P_SpawnMobj behave. P_SpawnMobj already resolved z if subsector was
 * null at spawn time; re-resolve now that we can place it, and re-apply
 * ONFLOORZ/ONCEILINGZ if the caller used a sentinel.
 */
function refreshSpawnedMobjSector(mobj: Mobj, session: LauncherSession, requestedZ: Fixed): void {
  const subsectorIndex = pointInSubsector(mobj.x, mobj.y, session.mapData.nodes);
  const sectorIndex = session.mapData.subsectorSectors[subsectorIndex] ?? 0;
  const sector = session.mapData.sectors[sectorIndex]!;

  mobj.subsector = {
    sector: {
      ceilingheight: sector.ceilingheight,
      floorheight: sector.floorheight,
    },
  };
  mobj.floorz = sector.floorheight;
  mobj.ceilingz = sector.ceilingheight;

  if (requestedZ === ONFLOORZ) {
    mobj.z = sector.floorheight;
  } else if (requestedZ === ONCEILINGZ) {
    mobj.z = (sector.ceilingheight - (mobj.info?.height ?? 0)) | 0;
  }
}

/**
 * Create and bootstrap a live game runtime: spawn the level, install
 * the completed P_MobjThinker movement hook, and wire the monster
 * look/chase AI into the shared STATES table bound to this runtime's
 * map/RNG/player.
 */
export function createGameRuntime(resources: LauncherResources, options: GameRuntimeOptions): GameRuntime {
  const session = createLauncherSession(resources, { mapName: options.mapName, skill: options.skill });

  // Vanilla `S_StartSound(origin, sfx_id)`.  `null` when no audio host
  // was supplied (historical silent runtime — every consuming context
  // treats a null startSound as inert).  When wired, the origin Mobj
  // is mapped to a stable identity for channel origin-dedup and its
  // world x/y is forwarded so the host's S_AdjustSoundParams pans /
  // attenuates remote sounds against the live listener (player.mo).
  // Built once and shared by the six combat contexts, A_Chase, and the
  // weapon-state psprite actions so every sound site is the one
  // observable path to the mixer.
  const startSound: ((origin: Mobj | null, sfxId: number) => void) | null = options.audio == null ? null : buildStartSound(options.audio, session);

  // p_pspr.c weapon fire / saw-idle sounds (`session.ts` left this
  // null until the audio milestone). The psprite actions read it from
  // the session-owned WeaponStateContext every tic.
  session.weaponStateContext.startSound = startSound;

  const targetingContext: TargetingContext = {
    mapData: session.mapData,
    getSectorIndex: makeSectorIndexResolver(session),
  };
  const players: readonly PlayerLike[] = [session.player];
  const playeringame: readonly boolean[] = [true];

  // P_SpawnSpecials sector/line layer: T_MovePlane + the neighbor
  // lookups bound to this level's mutable sectors (the renderer
  // re-reads them per frame, so doors/lifts visibly move), the
  // ActivePlats/ActiveCeilings registries, the switch button list,
  // and the assembled P_UseSpecialLine / P_CrossSpecialLine dispatch
  // bridge. Instance-scoped (no module globals) so the shared Bun
  // test worker stays hermetic without a reset hook.
  const gameMode = resolveGameMode(resources);
  const specials = buildSpecialsModel(
    session.mapData,
    session.mutableSectors,
    session.thinkerList,
    session.doomRandom,
    session.blocklinks,
    () => session.levelTime,
    () => session.player,
    gameMode,
  );

  // P_UseSpecialLine bridge for P_UseLines (player Use press) and the
  // chase-AI door-open path. `pUseSpecialLine` consumes the runtime
  // trigger line (one-shot `special = 0` clears persist on it). The
  // useLines variant ignores the boolean; the chase variant returns
  // it (vanilla `P_UseSpecialLine` return == "a door opened").
  const useSpecialLine = (linedefIndex: number, side: number, thing: Mobj): boolean => {
    if (!specials.isLineArmed(linedefIndex)) return false;
    const line = specials.triggerLineFor(linedefIndex, thing);
    return pUseSpecialLine(thing, line, side, specials.callbacks);
  };

  // P_CrossSpecialLine bridge threaded through P_XYMovement →
  // P_TryMove spechit (walkover triggers: W1/WR floors, lifts,
  // teleports). `oldside` is the side the thing crossed FROM (vanilla
  // `P_CrossSpecialLine(linenum, oldside, thing)`).
  const crossSpecialLine = (linedefIndex: number, oldside: number, thing: Mobj): void => {
    if (!specials.isLineArmed(linedefIndex)) return;
    const line = specials.triggerLineFor(linedefIndex, thing);
    pCrossSpecialLine(line, oldside, thing, specials.callbacks);
  };

  const chaseContext: ChaseContext = {
    rng: session.doomRandom,
    mapData: session.mapData,
    blocklinks: session.blocklinks,
    thinkerList: session.thinkerList,
    targetingContext,
    players,
    playeringame,
    gameskill: options.skill,
    fastparm: false,
    netgame: false,
    // p_enemy.c P_Move: a blocked monster walks its spechit list and
    // calls P_UseSpecialLine(actor, ld, 0) to open doors it bumps.
    useSpecialLine: (actor: Mobj, linedefIndex: number, lineSide: number): boolean => useSpecialLine(linedefIndex, lineSide, actor),
    // p_enemy.c A_Chase: emits the monster's active sound while
    // pursuing (P_Random < 3 gate) through this same S_StartSound path.
    ...(startSound === null ? {} : { startSound }),
  };

  // Combat side-effect callbacks threaded through P_XYMovement →
  // P_TryMove → P_CheckPosition → PIT_CheckThing: `damageMobj` lets
  // skull-flies and projectiles deal their collision damage,
  // `touchSpecial` lets the MF_PICKUP player vacuum up items it walks
  // over (P_TouchSpecialThing), and `rng`/`thinkerList` drive the
  // PIT_CheckThing skullfly/missile damage rolls. Built before the
  // movement hook so every mobj's move runs the full vanilla path.
  const combatMoveCallbacks: XYMovementCallbacks = {
    damageMobj,
    touchSpecial: (special: Mobj, toucher: Mobj): void => {
      touchSpecialThing(special, toucher);
    },
    // P_TryMove spechit → P_CrossSpecialLine: walkover line triggers
    // (W1/WR floors, plats, teleports) fire as any mobj crosses them.
    crossSpecialLine,
    rng: session.doomRandom,
    thinkerList: session.thinkerList,
  };

  // Completed P_MobjThinker movement half (p_mobj.c order): momentum
  // move, then z move; bail if the mobj was removed mid-move.
  setMobjMovementHook((mobj: Mobj): boolean => {
    if (mobj.momx !== 0 || mobj.momy !== 0 || (mobj.flags & MF_SKULLFLY) !== 0) {
      xyMovement(mobj, session.mapData, session.blocklinks, session.thinkerList, session.doomRandom, '', combatMoveCallbacks);
      if (mobj.action === REMOVED) {
        return false;
      }
    }
    if (mobj.z !== mobj.floorz || mobj.momz !== 0) {
      zMovement(mobj, session.doomRandom, session.thinkerList);
      if (mobj.action === REMOVED) {
        return false;
      }
    }
    return true;
  });

  // p_enemy.c A_Look (the no-soundtarget path; sound propagation lands
  // with the audio milestone). Sets threshold, acquires a player via
  // P_LookForPlayers, then enters the monster's seestate.
  const aLook = (actor: Mobj): void => {
    actor.threshold = 0;
    if (!lookForPlayers(actor, false, players, playeringame, targetingContext)) {
      return;
    }
    if (actor.info !== null) {
      setMobjState(actor, actor.info.seestate, session.thinkerList);
    }
  };
  // p_enemy.c A_Chase — the full pursue/attack-decision brain.
  const aChase = (actor: Mobj): void => {
    chase(actor, chaseContext);
  };

  // Wire A_Look onto every monster stand-state chain and A_Chase onto
  // every monster see-state chain (info.c parity), for the whole
  // MF_COUNTKILL roster (shareware uses a subset; extra wiring is inert).
  forEachRosterAiChain(aLook, aChase);

  wireCombat(session, resources, options, targetingContext, combatMoveCallbacks, startSound);

  // s_sound.c S_Start: vanilla starts the level's music (S_ChangeMusic
  // with the map's D_E#M# lump) at P_SetupLevel time. The host maps
  // E1M1 → D_E1M1 (music number 1) and loops it.
  if (options.audio != null) {
    options.audio.startMusic(options.mapName);
  }

  // ST_Start / ST_initData — vanilla creates the status bar state at
  // level setup from the freshly spawned player (snapshots weaponowned
  // so the first bonus pickup does not spurious-evil-grin). The decoded
  // patch cache binds to this IWAD; both are instance-scoped.
  const statusBar = createStatusBarState(session.player);
  const statusBarRenderer = createStatusBarRenderer(new LumpLookup(resources.directory), resources.wadBuffer);
  const statusBarPointToAngle2 = (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed): Angle => rPointToAngle2(x1, y1, x2, y2) >>> 0;

  // P_SetupLevel resets totalkills/totalitems/totalsecret = 0; the
  // map-thing spawn loop then increments totalkills per MF_COUNTKILL
  // thing and totalitems per MF_COUNTITEM thing, and P_SpawnSpecials
  // increments totalsecret per sector special 9. The session already
  // ran the (skill/single-player-filtered, vanilla-faithful) spawn
  // loop, so counting the just-spawned mobj flags here is the exact
  // equivalent. Captured ONCE at level setup before any tic mutates
  // the secret-sector specials or kills a monster.
  let totalKills = 0;
  let totalItems = 0;
  session.thinkerList.forEach((thinker) => {
    if (!(thinker instanceof Mobj) || thinker === session.player.mo) return;
    if ((thinker.flags & MF_COUNTKILL) !== 0) totalKills += 1;
    if ((thinker.flags & MF_COUNTITEM) !== 0) totalItems += 1;
  });
  let totalSecret = 0;
  for (const sector of session.mapData.sectors) {
    if (sector.special === 9) totalSecret += 1;
  }
  const levelTotals: LevelTotals = Object.freeze({
    totalKills,
    totalItems,
    totalSecret,
    parTimeTics: parTimeTicsFor(session.mapName),
  });

  // The boss-death (`A_BossDeath` tag-666) path calls `G_ExitLevel()`
  // with NO line special, so it cannot route through the specials
  // dispatcher's exit callbacks. A runtime-owned latch covers that
  // case; `levelComplete` reports whichever fired first (the specials
  // exit-switch/line OR this explicit one) with the same vanilla
  // "first gameaction wins" idempotence.
  let explicitCompletion: PendingLevelCompletion | null = null;

  const runtime: GameRuntime = {
    session,
    get player(): Player {
      return session.player;
    },
    get thinkerList(): LauncherSession['thinkerList'] {
      return session.thinkerList;
    },
    get levelTime(): number {
      return session.levelTime;
    },
    specials,
    statusBar,
    levelTotals,
    get levelComplete(): PendingLevelCompletion | null {
      return specials.levelComplete ?? explicitCompletion;
    },
    exitLevel(secret: boolean): void {
      if (specials.levelComplete !== null || explicitCompletion !== null) return;
      explicitCompletion = { secret };
    },
    allMobjs(): Mobj[] {
      const mobjs: Mobj[] = [];
      session.thinkerList.forEach((thinker) => {
        if (thinker instanceof Mobj) {
          mobjs.push(thinker);
        }
      });
      return mobjs;
    },
    dispose(): void {
      // Stop music + close the waveOut device first so the FFI handle
      // never leaks across the shared Bun test worker (or the
      // production process lifetime), then restore the process-global
      // movement-hook / AI-codepointer state. Audio shutdown is
      // idempotent and never throws.
      if (options.audio != null) {
        try {
          options.audio.shutdown();
        } catch {
          // A device-close failure must not stop global-state reset.
        }
      }
      resetGameRuntimeGlobals();
    },
  };

  statusBarDeps.set(runtime, { renderer: statusBarRenderer, pointToAngle2: statusBarPointToAngle2 });

  return runtime;
}

/**
 * Advance the simulation by one 35 Hz game tic — the assembled
 * `p_tick.c` P_Ticker: P_PlayerThink (the subset wired so far: move,
 * height, use, psprites) → P_RunThinkers (every mobj through the
 * completed P_MobjThinker) → leveltime++.
 */
export function tickGame(runtime: GameRuntime, cmd: TicCommand): void {
  const session = runtime.session;
  const player = session.player;
  player.cmd = cmd;

  if (player.mo !== null) {
    const playerMobj = player.mo;
    let onground = false;
    if (playerMobj.reactiontime > 0) {
      playerMobj.reactiontime -= 1;
    } else {
      onground = movePlayer(player);
    }
    calcHeight(player, session.levelTime, onground && playerMobj.z <= playerMobj.floorz);

    if ((cmd.buttons & BT_USE) !== 0) {
      if (!player.usedown) {
        // P_UseLines → PTR_UseTraverse → P_UseSpecialLine: open the
        // door / flip the switch / start the lift the player faces.
        useLines(playerMobj, session.mapData, {
          useSpecialLine: (linedefIndex: number, side: 0 | 1, thing: Mobj): void => {
            const specials = runtime.specials;
            if (!specials.isLineArmed(linedefIndex)) return;
            const line = specials.triggerLineFor(linedefIndex, thing);
            pUseSpecialLine(thing, line, side, specials.callbacks);
          },
        });
        player.usedown = true;
      }
    } else {
      player.usedown = false;
    }
  }

  session.weaponStateContext.leveltime = session.levelTime;
  movePsprites(player);

  // P_RunThinkers — drives every mobj's action (state machine + the
  // injected movement half) plus the sector-special thinkers the
  // door/floor/plat/ceiling spawners added to this same ring.
  session.thinkerList.run();

  // p_tick.c P_Ticker order: P_RunThinkers → P_UpdateSpecials. The
  // animated-flat/texture half of P_UpdateSpecials is already a pure
  // function of `leveltime` inside the assembled renderer (it cycles
  // flattranslation per frame), so only the button/switch-cooldown
  // timer half runs here — decrement every active button's btimer
  // and snap its texture back when it expires.
  runtime.specials.updateSpecials();

  // G_Ticker order: P_Ticker → ST_Ticker. Advance the status bar face
  // state machine + key-box memory now that this tic's damage/attacker/
  // pickup state is settled (monster attacks ran inside P_RunThinkers).
  // `st_randomnumber` is an M_Random() sample (menu stream) in vanilla,
  // so face cycling never desyncs the P_Random demo stream.
  const deps = statusBarDeps.get(runtime);
  if (deps !== undefined) {
    tickStatusBar(runtime.statusBar, {
      player,
      godMode: (player.cheats & VANILLA_CF_GODMODE) !== 0,
      randomNumber: session.doomRandom.mRandom(),
      pointToAngle2: deps.pointToAngle2,
    });
  }

  session.levelTime += 1;
}

/**
 * Render the current player view, then composite the vanilla status bar
 * over its bottom 32 rows (ST_Y..199) — `D_Display`'s `R_RenderPlayerView`
 * followed by `ST_Drawer`. The automap view (`session.showAutomap`) keeps
 * the status bar too, matching vanilla `D_Display` (AM_Drawer then
 * ST_Drawer both draw). Returns the same `session.framebuffer` the
 * assembled renderer wrote, now with the HUD on it.
 */
export function renderGame(runtime: GameRuntime): Uint8Array {
  const framebuffer = renderLauncherFrame(runtime.session);

  const deps = statusBarDeps.get(runtime);
  if (deps === undefined || runtime.session.player.mo === null) {
    return framebuffer;
  }

  // ST_drawWidgets reads a fresh value snapshot every frame
  // (computeStatusBarValues is pure — no state mutation). Single
  // player, status bar always on (no fullscreen-HUD toggle yet),
  // console player 0.
  const values = computeStatusBarValues({
    state: runtime.statusBar,
    player: runtime.session.player,
    deathmatch: false,
    statusBarOn: true,
    consolePlayer: 0,
  });
  drawStatusBar(framebuffer, deps.renderer, values);

  return framebuffer;
}
