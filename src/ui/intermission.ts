/**
 * Single-player intermission stats state machine (wi_stuff.c).
 *
 * Implements the pure-logic half of vanilla DOOM's end-of-level
 * "stats" screen: the top-level phase machine (StatCount →
 * ShowNextLoc → NoState), the single-player count-up ladder through
 * sp_state 1..10 (initial pause → kills → pause → items → pause →
 * secrets → pause → time/par → pause → final wait-for-input), the
 * per-player attack/use edge-detect that sets the `acceleratestage`
 * flag, the "you are here" pointer blink on the ShowNextLoc screen,
 * and the `cnt` countdown on NoState that ends the intermission.
 *
 * Parity invariants preserved byte-for-byte from Chocolate Doom 2.2.1
 * wi_stuff.c:
 *
 *  - `sp_state` starts at 1 (initial pause).  Odd states (1/3/5/7/9)
 *    are pause stages that decrement `cnt_pause` from TICRATE=35 down
 *    to 0 then `sp_state++` and reload `cnt_pause = TICRATE`.  Even
 *    states 2/4/6/8 tick their respective count-up by a fixed
 *    per-frame delta until the target is met, then play `sfx_barexp`
 *    and `sp_state++`.  State 10 waits for the user to press attack
 *    or use; on accept it plays `sfx_sgcock` and calls
 *    `WI_initShowNextLoc`.
 *  - The kills / items / secrets count increments by 2 per tic and is
 *    the integer percentage `(scored * 100) / max`.  `max == 0` is a
 *    vanilla divide-by-zero hazard we guard against by substituting
 *    100 (a fully-clean level with 0 items returns 100% — matches
 *    vanilla's sentinel behavior of "impossible to count lower than
 *    complete").
 *  - Time ticks by 3 per tic toward `stime / TICRATE` seconds.  Par
 *    ticks by 3 per tic toward `partime / TICRATE` seconds.  Both
 *    advance in the SAME sp_state=8 branch; the state advances ONLY
 *    when BOTH have reached their targets (vanilla's nested `if`
 *    structure: par reaches target first OR same tic → `sp_state++`
 *    gates on time >= target).
 *  - The `sfx_pistol` ticker sound plays on tics where
 *    `(bcnt & 3) === 0` during any even sp_state.  `bcnt` starts at 0
 *    and pre-increments at the top of every tick, so the pistol
 *    plays on tics 4, 8, 12, ... (the first tick after
 *    `beginIntermission` has `bcnt === 1`).
 *  - `acceleratestage` is the one-shot edge-detect flag.  Every tic
 *    we walk all players and for each `playerInGame` check the
 *    rising edge of `BT_ATTACK` AND `BT_USE` independently (either
 *    one firing sets the flag).  Once set, the flag is consumed by
 *    the SAME tick's sp_state / phase handler — either to skip a
 *    count-up to its final value (StatCount sp_state 1..9), to fire
 *    the final sgcock transition (sp_state 10), to close the
 *    ShowNextLoc screen early, or to early-terminate NoState.
 *  - `WI_initShowNextLoc` arms `cnt = 4 * TICRATE = 140` tics.  The
 *    pointer blink is `(cnt & 31) < 20` per vanilla — on for ~20 of
 *    every 32 tics, off for ~12.  Acceleration during ShowNextLoc
 *    immediately transitions to NoState.
 *  - `WI_initNoState` arms `cnt = 10` tics (NOT TICRATE — vanilla
 *    literally writes `cnt = 10`).  Each tick pre-decrements; when
 *    `cnt` reaches 0 the intermission completes (vanilla calls
 *    `G_WorldDone`; this port surfaces `worldDone: true` in the
 *    tick result).
 *  - The NoState phase decrements `cnt` via `!--cnt` so the tic on
 *    which `cnt` reaches zero IS the completion tic.  Starting from
 *    `cnt = 10`, the loop fires `cnt-- = 9, 8, ..., 1, 0` over 10
 *    tics and `worldDone` fires on the 10th.
 *  - The `checkForAccelerate` per-player attackdown/usedown latches
 *    are STORED IN the intermission state (not re-read from the
 *    player_t) so the edge-detect survives across ticks without
 *    mutating gameplay state.  Vanilla writes `player->attackdown`
 *    directly on the player_t, but that field is only read by the
 *    intermission itself and this port keeps the concern local.
 *  - `beginIntermission` resets `bcnt`, `cnt`, `cnt_pause`, `sp_state`,
 *    all count-ups, and all per-player latches.  It does NOT clear
 *    the ambient sound/music — the caller owns that boundary via the
 *    returned `musicCue` on the first tick.
 *
 * Net-game / deathmatch paths are out of scope for the C1 shareware
 * target (wi_stuff.c's `WI_updateNetgameStats` / `WI_updateDeath-
 * matchStats` are never called when `netgame === false` and
 * `deathmatch === 0`).  The `MAXPLAYERS = 4` array capacity is still
 * present in state so a future net-game step can plug in without
 * refactoring.
 *
 * @example
 * ```ts
 * import {
 *   createIntermissionState,
 *   beginIntermission,
 *   tickIntermission,
 *   IntermissionPhase,
 * } from "../src/ui/intermission.ts";
 *
 * const state = createIntermissionState();
 * beginIntermission(state, {
 *   episode: 1, lastMap: 1, nextMap: 2,
 *   maxKills: 20, maxItems: 10, maxSecrets: 3, parTimeTics: 30 * 35,
 * }, [{ killCount: 20, itemCount: 10, secretCount: 3, timeTics: 42 * 35, inGame: true }]);
 *
 * // Each tick: feed the per-player buttons, observe sounds + worldDone.
 * const result = tickIntermission(state, [{ attack: false, use: false }]);
 * ```
 */

// ── Tic-based durations (TICRATE = 35) ───────────────────────────────

/** TICRATE: 35 tics per second.  All timing below is in tics. */
export const TICRATE = 35;

/** Pause duration between count-up stages (`cnt_pause` reloads to this). */
export const WI_SP_PAUSE_TICS = TICRATE;

/** Multiplier for `WI_SHOW_NEXT_LOC_TICS` (4 seconds). */
export const WI_SHOW_NEXT_LOC_SECONDS = 4;

/** Duration of the `ShowNextLoc` "Entering ..." screen before auto-advance. */
export const WI_SHOW_NEXT_LOC_TICS = WI_SHOW_NEXT_LOC_SECONDS * TICRATE;

/** Duration of the `NoState` final delay before `worldDone` fires. */
export const WI_NO_STATE_TICS = 10;

// ── sp_state phase values (wi_stuff.c) ───────────────────────────────

/** Initial pause before kills count-up (odd → pause handler). */
export const SP_STATE_INITIAL_PAUSE = 1;

/** Kills percentage count-up (even → count-up handler). */
export const SP_STATE_KILLS = 2;

/** Pause after kills. */
export const SP_STATE_PAUSE_AFTER_KILLS = 3;

/** Items percentage count-up. */
export const SP_STATE_ITEMS = 4;

/** Pause after items. */
export const SP_STATE_PAUSE_AFTER_ITEMS = 5;

/** Secrets percentage count-up. */
export const SP_STATE_SECRETS = 6;

/** Pause after secrets. */
export const SP_STATE_PAUSE_AFTER_SECRETS = 7;

/** Time + par count-up (both advance in this single branch). */
export const SP_STATE_TIME_AND_PAR = 8;

/** Pause after time/par. */
export const SP_STATE_PAUSE_AFTER_TIME = 9;

/** Final wait-for-input; acceleration transitions to `ShowNextLoc`. */
export const SP_STATE_FINAL = 10;

// ── Count-up deltas (wi_stuff.c per-tic increments) ──────────────────

/** Kills percentage increment per tic during `SP_STATE_KILLS`. */
export const SP_KILLS_DELTA = 2;

/** Items percentage increment per tic during `SP_STATE_ITEMS`. */
export const SP_ITEMS_DELTA = 2;

/** Secrets percentage increment per tic during `SP_STATE_SECRETS`. */
export const SP_SECRETS_DELTA = 2;

/** Time/par seconds increment per tic during `SP_STATE_TIME_AND_PAR`. */
export const SP_TIME_DELTA = 3;

/** Max percentage value any count-up can reach. */
export const WI_MAX_PERCENT = 100;

// ── Timing of the periodic pistol ticker sound ───────────────────────

/**
 * Bitmask for `(bcnt & mask) === 0` pistol-sound gate (vanilla `bcnt & 3`).
 * The pistol sound plays every 4 tics during even sp_state count-ups.
 */
export const WI_PISTOL_BCNT_MASK = 3;

// ── ShowNextLoc pointer blink timing ─────────────────────────────────

/** Cycle length of the "you are here" pointer blink (cnt & mask). */
export const WI_POINTER_BLINK_CYCLE = 32;

/** Threshold within the cycle where the pointer is visible (`(cnt & 31) < 20`). */
export const WI_POINTER_BLINK_ON_THRESHOLD = 20;

// ── Player capacity ──────────────────────────────────────────────────

/** Vanilla DOOM's `MAXPLAYERS` constant. */
export const MAXPLAYERS = 4;

// ── Phases (the top-level `state` variable in wi_stuff.c) ────────────

/**
 * Top-level intermission phase.  Values chosen to match the vanilla
 * `stateenum_t`: `NoState = -1`, `StatCount = 0`, `ShowNextLoc = 1`.
 */
export enum IntermissionPhase {
  NoState = -1,
  StatCount = 0,
  ShowNextLoc = 1,
}

// ── Sound effect identifiers ─────────────────────────────────────────

/**
 * Sound-effect identifier strings emitted by `tickIntermission`.  The
 * caller maps these to `sfx_*` lumps via the sound manager; this
 * module has no knowledge of actual audio playback.
 */
export type IntermissionSoundId = 'pistol' | 'barexp' | 'sgcock';

/**
 * Music cue emitted on the first tick of an intermission (vanilla
 * `bcnt == 1` branch).  `mus_inter` for the Doom 1 intermission music
 * lump; commercial-mode `mus_dm2int` is not emitted because the C1
 * shareware target is Doom 1 exclusively.
 */
export type IntermissionMusicCue = 'mus_inter';

// ── Input + Round data ───────────────────────────────────────────────

/**
 * Per-player input latch read each tick.  Mirrors `ticcmd_t.buttons`
 * bits `BT_ATTACK` and `BT_USE` for the accelerate edge-detect.
 */
export interface IntermissionPlayerInput {
  readonly attack: boolean;
  readonly use: boolean;
}

/**
 * Per-player end-of-level results fed into `beginIntermission`.  Maps
 * directly to `wbplayerstruct_t`: `skills` = `killCount`, `sitems` =
 * `itemCount`, `ssecret` = `secretCount`, `stime` = `timeTics`,
 * `in` = `inGame`.  `frags` is present for future net-game extension
 * but unused by the single-player path.
 */
export interface IntermissionPlayerResult {
  readonly killCount: number;
  readonly itemCount: number;
  readonly secretCount: number;
  readonly timeTics: number;
  readonly inGame: boolean;
  readonly frags?: readonly number[];
}

/**
 * Per-round info shared by all players.  Maps to `wbstartstruct_t`:
 * `episode`, `last` = `lastMap`, `next` = `nextMap`, `maxkills` /
 * `maxitems` / `maxsecret`, `partime` = `parTimeTics`.
 */
export interface IntermissionRound {
  readonly episode: number;
  readonly lastMap: number;
  readonly nextMap: number;
  readonly maxKills: number;
  readonly maxItems: number;
  readonly maxSecrets: number;
  readonly parTimeTics: number;
}

// ── State ────────────────────────────────────────────────────────────

/**
 * Intermission state machine.  Fields map 1:1 to `wi_stuff.c` statics:
 *
 *  - `phase`            ← `state` (StatCount / ShowNextLoc / NoState)
 *  - `spState`          ← `sp_state` (1..10)
 *  - `cntKills`         ← `cnt_kills[me]` integer percentage
 *  - `cntItems`         ← `cnt_items[me]`
 *  - `cntSecrets`       ← `cnt_secret[me]`
 *  - `cntTime`          ← `cnt_time` seconds
 *  - `cntPar`           ← `cnt_par` seconds
 *  - `cntPause`         ← `cnt_pause`
 *  - `cnt`              ← `cnt` (ShowNextLoc / NoState shared timer)
 *  - `bcnt`             ← `bcnt` (tics since `WI_Start`)
 *  - `acceleratestage`  ← `acceleratestage`
 *  - `pointerOn`        ← `snl_pointeron` (ShowNextLoc blink)
 *  - `attackDownLatched`← per-player `player->attackdown`
 *  - `useDownLatched`   ← per-player `player->usedown`
 *  - `playerResults`    ← `plrs[]` captured at `beginIntermission`
 *  - `playerInGame`     ← `playeringame[]` captured at `beginIntermission`
 *  - `round`            ← `*wbs` captured at `beginIntermission`
 *  - `active`           ← `true` between `beginIntermission` and the
 *                        tick that flips `worldDone` (purely for
 *                        caller sanity; vanilla has no equivalent).
 */
export interface IntermissionState {
  phase: IntermissionPhase;
  spState: number;
  cntKills: number;
  cntItems: number;
  cntSecrets: number;
  cntTime: number;
  cntPar: number;
  cntPause: number;
  cnt: number;
  bcnt: number;
  acceleratestage: boolean;
  pointerOn: boolean;
  attackDownLatched: boolean[];
  useDownLatched: boolean[];
  playerResults: IntermissionPlayerResult[];
  playerInGame: boolean[];
  round: IntermissionRound | null;
  active: boolean;
}

/**
 * Result of a single `tickIntermission` call.  Sounds are emitted in
 * vanilla firing order (pistol first if both pistol and barexp would
 * fire on the same tick — matches wi_stuff.c's `if (!(bcnt&3))
 * S_StartSound` call BEFORE the per-state `S_StartSound(sfx_barexp)`).
 */
export interface IntermissionTickResult {
  readonly sounds: readonly IntermissionSoundId[];
  readonly music: IntermissionMusicCue | null;
  readonly worldDone: boolean;
}

// ── State factory ────────────────────────────────────────────────────

/**
 * Create a fresh intermission state with every field at its
 * `WI_initVariables` default.  The state is `active = false` until a
 * call to {@link beginIntermission} seeds it with a round and player
 * results.
 */
export function createIntermissionState(): IntermissionState {
  return {
    phase: IntermissionPhase.StatCount,
    spState: SP_STATE_INITIAL_PAUSE,
    cntKills: -1,
    cntItems: -1,
    cntSecrets: -1,
    cntTime: -1,
    cntPar: -1,
    cntPause: WI_SP_PAUSE_TICS,
    cnt: 0,
    bcnt: 0,
    acceleratestage: false,
    pointerOn: false,
    attackDownLatched: new Array(MAXPLAYERS).fill(false),
    useDownLatched: new Array(MAXPLAYERS).fill(false),
    playerResults: [],
    playerInGame: new Array(MAXPLAYERS).fill(false),
    round: null,
    active: false,
  };
}

// ── Round entry ──────────────────────────────────────────────────────

/**
 * Begin a new intermission.  Mirrors `WI_Start` → `WI_initVariables` →
 * `WI_initSP` (the single-player path).  `results.length` must be ≤
 * MAXPLAYERS; any slot not supplied is treated as `inGame = false`.
 *
 * Throws `RangeError` when:
 *  - `round.episode` is not a positive integer
 *  - `round.lastMap` or `round.nextMap` is not a positive integer
 *  - any `maxKills` / `maxItems` / `maxSecrets` / `parTimeTics` is negative
 *  - `results.length > MAXPLAYERS`
 */
export function beginIntermission(state: IntermissionState, round: IntermissionRound, results: readonly IntermissionPlayerResult[]): void {
  if (!Number.isInteger(round.episode) || round.episode < 1) {
    throw new RangeError(`beginIntermission: episode must be a positive integer, got ${round.episode}`);
  }
  if (!Number.isInteger(round.lastMap) || round.lastMap < 1) {
    throw new RangeError(`beginIntermission: lastMap must be a positive integer, got ${round.lastMap}`);
  }
  if (!Number.isInteger(round.nextMap) || round.nextMap < 1) {
    throw new RangeError(`beginIntermission: nextMap must be a positive integer, got ${round.nextMap}`);
  }
  if (round.maxKills < 0 || round.maxItems < 0 || round.maxSecrets < 0 || round.parTimeTics < 0) {
    throw new RangeError(`beginIntermission: max counts and parTimeTics must be non-negative`);
  }
  if (results.length > MAXPLAYERS) {
    throw new RangeError(`beginIntermission: at most ${MAXPLAYERS} players, got ${results.length}`);
  }

  state.phase = IntermissionPhase.StatCount;
  state.spState = SP_STATE_INITIAL_PAUSE;
  state.cntKills = -1;
  state.cntItems = -1;
  state.cntSecrets = -1;
  state.cntTime = -1;
  state.cntPar = -1;
  state.cntPause = WI_SP_PAUSE_TICS;
  state.cnt = 0;
  state.bcnt = 0;
  state.acceleratestage = false;
  state.pointerOn = false;
  state.attackDownLatched = new Array(MAXPLAYERS).fill(false);
  state.useDownLatched = new Array(MAXPLAYERS).fill(false);
  state.playerResults = results.slice();
  state.playerInGame = new Array(MAXPLAYERS).fill(false);
  for (let i = 0; i < results.length; i++) {
    state.playerInGame[i] = results[i]!.inGame;
  }
  state.round = round;
  state.active = true;
}

// ── Accelerate edge-detect (WI_checkForAccelerate) ───────────────────

/**
 * Walk the per-player input latch and set `acceleratestage` when any
 * player transitions BT_ATTACK or BT_USE from released to pressed.
 * The per-player `attackDownLatched` / `useDownLatched` arrays track
 * the held-button state across tics so a held button fires exactly
 * once.  Players with `playerInGame[i] === false` are skipped.
 *
 * `inputs.length` may be any value ≤ MAXPLAYERS; missing players are
 * treated as `attack: false, use: false`.
 */
export function checkForAccelerate(state: IntermissionState, inputs: readonly IntermissionPlayerInput[]): void {
  for (let i = 0; i < MAXPLAYERS; i++) {
    if (!state.playerInGame[i]) continue;
    const input = i < inputs.length ? inputs[i] : undefined;
    const attack = input?.attack ?? false;
    const use = input?.use ?? false;

    if (attack) {
      if (!state.attackDownLatched[i]) state.acceleratestage = true;
      state.attackDownLatched[i] = true;
    } else {
      state.attackDownLatched[i] = false;
    }

    if (use) {
      if (!state.useDownLatched[i]) state.acceleratestage = true;
      state.useDownLatched[i] = true;
    } else {
      state.useDownLatched[i] = false;
    }
  }
}

// ── Percentage helpers ───────────────────────────────────────────────

/**
 * Compute the integer percentage `(scored * 100) / max`, safely
 * handling `max === 0` by returning `WI_MAX_PERCENT`.  Vanilla
 * divides by `maxkills` directly — a level with 0 monsters would
 * divide by zero in wi_stuff.c; this port substitutes the "full
 * clean" value so a zero-population map displays 100% instead of
 * NaN.  Matches the CHOCOLATE_DOOM patched behavior under
 * `HAS_ZERO_MAX_TOTAL`.
 */
function percentOrFull(scored: number, max: number): number {
  if (max <= 0) return WI_MAX_PERCENT;
  return Math.trunc((scored * 100) / max);
}

// ── Phase transitions ────────────────────────────────────────────────

/** Arm `ShowNextLoc` (wi_stuff.c `WI_initShowNextLoc`). */
function initShowNextLoc(state: IntermissionState): void {
  state.phase = IntermissionPhase.ShowNextLoc;
  state.acceleratestage = false;
  state.cnt = WI_SHOW_NEXT_LOC_TICS;
  state.pointerOn = false;
}

/** Arm `NoState` (wi_stuff.c `WI_initNoState`). */
function initNoState(state: IntermissionState): void {
  state.phase = IntermissionPhase.NoState;
  state.acceleratestage = false;
  state.cnt = WI_NO_STATE_TICS;
}

// ── Per-phase tick handlers ──────────────────────────────────────────

function updateStats(state: IntermissionState, sounds: IntermissionSoundId[]): void {
  const round = state.round;
  if (round === null) return;
  const plr = state.playerResults[0];
  if (plr === undefined) return;

  const targetKills = percentOrFull(plr.killCount, round.maxKills);
  const targetItems = percentOrFull(plr.itemCount, round.maxItems);
  const targetSecrets = percentOrFull(plr.secretCount, round.maxSecrets);
  const targetTime = Math.trunc(plr.timeTics / TICRATE);
  const targetPar = Math.trunc(round.parTimeTics / TICRATE);

  if (state.acceleratestage && state.spState !== SP_STATE_FINAL) {
    state.acceleratestage = false;
    state.cntKills = targetKills;
    state.cntItems = targetItems;
    state.cntSecrets = targetSecrets;
    state.cntTime = targetTime;
    state.cntPar = targetPar;
    sounds.push('barexp');
    state.spState = SP_STATE_FINAL;
    return;
  }

  if (state.spState === SP_STATE_KILLS) {
    state.cntKills += SP_KILLS_DELTA;
    if ((state.bcnt & WI_PISTOL_BCNT_MASK) === 0) sounds.push('pistol');
    if (state.cntKills >= targetKills) {
      state.cntKills = targetKills;
      sounds.push('barexp');
      state.spState++;
    }
    return;
  }

  if (state.spState === SP_STATE_ITEMS) {
    state.cntItems += SP_ITEMS_DELTA;
    if ((state.bcnt & WI_PISTOL_BCNT_MASK) === 0) sounds.push('pistol');
    if (state.cntItems >= targetItems) {
      state.cntItems = targetItems;
      sounds.push('barexp');
      state.spState++;
    }
    return;
  }

  if (state.spState === SP_STATE_SECRETS) {
    state.cntSecrets += SP_SECRETS_DELTA;
    if ((state.bcnt & WI_PISTOL_BCNT_MASK) === 0) sounds.push('pistol');
    if (state.cntSecrets >= targetSecrets) {
      state.cntSecrets = targetSecrets;
      sounds.push('barexp');
      state.spState++;
    }
    return;
  }

  if (state.spState === SP_STATE_TIME_AND_PAR) {
    if ((state.bcnt & WI_PISTOL_BCNT_MASK) === 0) sounds.push('pistol');

    state.cntTime += SP_TIME_DELTA;
    if (state.cntTime >= targetTime) state.cntTime = targetTime;

    state.cntPar += SP_TIME_DELTA;
    if (state.cntPar >= targetPar) {
      state.cntPar = targetPar;
      if (state.cntTime >= targetTime) {
        sounds.push('barexp');
        state.spState++;
      }
    }
    return;
  }

  if (state.spState === SP_STATE_FINAL) {
    if (state.acceleratestage) {
      sounds.push('sgcock');
      initShowNextLoc(state);
    }
    return;
  }

  if ((state.spState & 1) === 1) {
    state.cntPause--;
    if (state.cntPause === 0) {
      state.spState++;
      state.cntPause = WI_SP_PAUSE_TICS;
    }
  }
}

function updateShowNextLoc(state: IntermissionState): boolean {
  state.cnt--;
  if (state.cnt === 0 || state.acceleratestage) {
    initNoState(state);
    return false;
  }
  state.pointerOn = (state.cnt & (WI_POINTER_BLINK_CYCLE - 1)) < WI_POINTER_BLINK_ON_THRESHOLD;
  return false;
}

function updateNoState(state: IntermissionState): boolean {
  state.cnt--;
  if (state.cnt === 0) {
    state.active = false;
    return true;
  }
  return false;
}

// ── Public tick entrypoint ───────────────────────────────────────────

/**
 * Advance the intermission one tic.  Mirrors `WI_Ticker`:
 *
 *  1. Pre-increment `bcnt`.
 *  2. On `bcnt === 1`, emit the `mus_inter` music cue.
 *  3. Run `checkForAccelerate` against the supplied per-player inputs.
 *  4. Dispatch to the current phase's handler:
 *     - `StatCount` → `updateStats` (the sp_state 1..10 ladder)
 *     - `ShowNextLoc` → `updateShowNextLoc` (cnt countdown + blink)
 *     - `NoState` → `updateNoState` (final 10-tic fade)
 *
 * Returns the sounds emitted this tick (in vanilla firing order), the
 * first-tick music cue if applicable, and `worldDone = true` on the
 * tic that `NoState`'s `cnt` reaches zero.  No-ops with all-default
 * fields when `state.active === false` (no round armed).
 */
export function tickIntermission(state: IntermissionState, inputs: readonly IntermissionPlayerInput[]): IntermissionTickResult {
  const sounds: IntermissionSoundId[] = [];
  let music: IntermissionMusicCue | null = null;
  let worldDone = false;

  if (!state.active) {
    return { sounds, music, worldDone };
  }

  state.bcnt++;
  if (state.bcnt === 1) {
    music = 'mus_inter';
  }

  checkForAccelerate(state, inputs);

  switch (state.phase) {
    case IntermissionPhase.StatCount:
      updateStats(state, sounds);
      break;
    case IntermissionPhase.ShowNextLoc:
      updateShowNextLoc(state);
      break;
    case IntermissionPhase.NoState:
      worldDone = updateNoState(state);
      break;
  }

  return { sounds, music, worldDone };
}
