/**
 * Interactive game host — the title → menu → play state machine.
 *
 * This is the headless "brain" that turns the assembled world
 * simulation ({@link createGameRuntime}/{@link tickGame}) into the
 * thing a player actually drives: it starts on the title screen, opens
 * and navigates the real vanilla menu tree (`src/ui/menus.ts`:
 * New Game → Episode → Skill, arrow-key driven), and on skill select
 * spins up the chosen `E#M#` level and routes live movement input
 * (forward/back, turn, strafe, run, use) into the P_Ticker.
 *
 * Pixel compositing for the title/menu screens is deliberately left to
 * the Win32 shell (it reuses the existing patch-draw helpers); this
 * module owns only the deterministic, headless-testable control flow
 * plus the gameplay framebuffer via {@link renderGame}.
 *
 * Skill mapping matches the proven smoke-host/acceptance path: the menu
 * skill item index is normalized with `max(1, index)` (so the third
 * item, "Hurt Me Plenty", is gameskill 2), not reinvented.
 *
 * @example
 * ```ts
 * const resources = await loadLauncherResources('doom/DOOM1.WAD');
 * const host = createGameHost(resources);
 * feedMenuKey(host, KEY_ESCAPE); // title -> Main menu
 * feedMenuKey(host, KEY_ENTER);  // New Game -> Episode
 * feedMenuKey(host, KEY_ENTER);  // Episode 1 -> Skill
 * feedMenuKey(host, KEY_ENTER);  // Skill -> start E1M1
 * tickHost(host, { ...EMPTY_GAME_HOST_INPUT, forward: true });
 * const framebuffer = renderHost(host); // gameplay view
 * ```
 */

import type { LauncherResources } from './session.ts';
import type { GameRuntime, GameAudioBridge } from './gameRuntime.ts';
import type { MenuState } from '../ui/menus.ts';
import type { FinaleState } from '../ui/finale.ts';
import type { IntermissionPlayerResult, IntermissionRound, IntermissionState } from '../ui/intermission.ts';

import { ANGLE_TURN, BT_USE, FORWARD_MOVE, SIDE_MOVE, packTicCommand } from '../input/ticcmd.ts';
import { MenuKind, createMenuState, handleMenuKey, openMenu, tickMenu } from '../ui/menus.ts';
import { createFinaleState, startFinale, tickFinale } from '../ui/finale.ts';
import { beginIntermission, createIntermissionState, tickIntermission } from '../ui/intermission.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { createGameRuntime, renderGame, resetGameRuntimeGlobals, tickGame } from './gameRuntime.ts';
import { FrontEndCompositor } from './gameFrontEndCompositor.ts';

/**
 * Audio surface the host drives for the front-end (title/menu).  The
 * gameplay runtime needs the broader {@link GameAudioBridge}; the host
 * additionally pumps the mixer, pauses music, and emits the anonymous
 * menu sfx (m_menu.c routes them through `S_StartSound(NULL, sfx)`).
 */
export interface GameHostAudio extends GameAudioBridge {
  pause(): void;
  resume(): void;
}

/** sfx_swtchn (23) — menu opened / submenu entered (m_menu.c). */
const SFX_SWTCHN = 23;
/** sfx_pistol (1) — menu item selected / intermission ticker. */
const SFX_PISTOL = 1;
/** sfx_pstop (19) — cursor moved up/down. */
const SFX_PSTOP = 19;
/** sfx_barexp (75) — intermission count-up finished (wi_stuff.c). */
const SFX_BAREXP = 75;
/** sfx_sgcock (16) — intermission accept → ShowNextLoc (wi_stuff.c). */
const SFX_SGCOCK = 16;

/**
 * The host phases.  `title`/`menu`/`game` are the front-end + play
 * states; `intermission` (wi_stuff.c GS_INTERMISSION) and `finale`
 * (f_finale.c GS_FINALE) are the end-of-level / end-of-episode
 * states wired here so the player can play THROUGH an episode.
 */
export type GameHostPhase = 'title' | 'menu' | 'game' | 'intermission' | 'finale';

/**
 * g_game.c `G_DoCompleted` next-map selection for Doom 1.  The
 * shareware target is episode 1 (E1M1..E1M9, E1M9 = the secret
 * level).  Transcribed faithfully from g_game.c:
 *
 *   - A secret exit on any map → the episode secret level (map 9).
 *   - E1M9 (the secret level) normal exit → E1M4
 *     (`if (gamemap == 9) gamemap = 4;` for episode 1, the
 *     `wminfo.next` fix-ups in `G_DoCompleted`).
 *   - E1M8 normal exit → the episode is over: `F_StartFinale`
 *     (`if (gamemap == 8) gameaction = ga_victory`).
 *   - Any other normal exit → the next sequential map (`gamemap+1`).
 *
 * Returns the next `E#M#` name, or `null` when the exit ends the
 * episode (caller routes to the finale).
 */
function nextMapName(episode: number, map: number, secret: boolean): string | null {
  if (secret) {
    // G_SecretExitLevel: episode secret level is map 9 (Doom 1).
    return `E${episode}M9`;
  }
  if (map === 9) {
    // g_game.c: the secret level returns to map 4 for episode 1.
    return `E${episode}M4`;
  }
  if (map === 8) {
    // E#M8 normal exit ends the episode → finale.
    return null;
  }
  return `E${episode}M${map + 1}`;
}

/** Parse an `E#M#` map name into 1-based episode/map (or null). */
function parseMap(mapName: string): { episode: number; map: number } | null {
  const match = /^E(\d)M(\d)$/i.exec(mapName);
  if (match === null) return null;
  return { episode: Number(match[1]), map: Number(match[2]) };
}

/** High-level held-input snapshot for one game tic. */
export interface GameHostInput {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly turnLeft: boolean;
  readonly turnRight: boolean;
  readonly strafeLeft: boolean;
  readonly strafeRight: boolean;
  readonly run: boolean;
  readonly use: boolean;
}

/** Frozen all-false input (no keys held). */
export const EMPTY_GAME_HOST_INPUT: GameHostInput = Object.freeze({
  forward: false,
  backward: false,
  turnLeft: false,
  turnRight: false,
  strafeLeft: false,
  strafeRight: false,
  run: false,
  use: false,
});

/** Live interactive host handle. */
export interface GameHost {
  readonly resources: LauncherResources;
  phase: GameHostPhase;
  readonly menu: MenuState;
  selectedEpisode: number;
  /**
   * The skill the current game was started at (`G_InitNew` `gameskill`).
   * Vanilla carries `gameskill` across `G_DoWorldDone`, so the next
   * map in the episode spawns at the same difficulty.  Defaults to 2
   * (Hurt Me Plenty) until a skill is chosen / a map booted directly.
   */
  lastSkill: number;
  runtime: GameRuntime | null;
  /**
   * Live audio host, or `null` for the silent front-end (every
   * historical caller).  When present the host starts the title music
   * (`D_INTRO`), emits the anonymous menu sfx, and threads the same
   * bridge into the spawned {@link GameRuntime} so gameplay sounds.
   */
  readonly audio: GameHostAudio | null;
  /**
   * The wi_stuff.c single-player intermission state.  Non-null only
   * while `phase === 'intermission'` (cleared back to `null` when the
   * next map / finale starts).  Exposed so the test suite can assert
   * the captured stats / round without reaching into the compositor.
   */
  intermission: IntermissionState | null;
  /**
   * The f_finale.c finale state.  Non-null only while
   * `phase === 'finale'`.
   */
  finale: FinaleState | null;
  /**
   * The map the intermission is travelling TO (the `G_DoCompleted`
   * `wminfo.next`).  `null` means the exit ended the episode (the
   * intermission's ShowNextLoc → finale).  Internal to the phase
   * machine; surfaced for deterministic-flow assertions.
   */
  pendingNextMap: string | null;
  /** The intermission/finale pixel compositor (lazy, IWAD-bound). */
  readonly frontEnd: FrontEndCompositor;
  /** Scratch 320x200 indexed frame the front-end phases composite into. */
  readonly frontEndFramebuffer: Uint8Array;
}

/**
 * Create a host parked on the title screen. No level is loaded until
 * the player walks the menu through to a skill selection.
 *
 * `audio` is optional: omit it for the historical silent host (tests,
 * headless control-flow checks); pass a {@link GameHostAudio} (the
 * Win32 waveOut host) to make `bun run doom.ts` audible.  The title
 * music starts immediately so the front-end is not silent either.
 */
export function createGameHost(resources: LauncherResources, audio?: GameHostAudio | null): GameHost {
  const resolvedAudio = audio ?? null;
  if (resolvedAudio !== null) {
    // s_sound.c title-screen music: D_INTRO (the OPL device gets
    // D_INTROA substituted by musicSystem.resolveMusicNumber). The
    // host maps the synthetic 'TITLE' selection to the intro track.
    resolvedAudio.startMusic('TITLE');
  }
  return {
    resources,
    phase: 'title',
    menu: createMenuState(),
    selectedEpisode: 1,
    lastSkill: 2,
    runtime: null,
    audio: resolvedAudio,
    intermission: null,
    finale: null,
    pendingNextMap: null,
    frontEnd: new FrontEndCompositor(resources),
    frontEndFramebuffer: new Uint8Array(SCREENWIDTH * SCREENHEIGHT),
  };
}

/**
 * Feed one discrete menu/title key-down (a `doomkeys.h` code, e.g.
 * `KEY_ENTER`, `KEY_DOWNARROW`). On the title screen any key opens the
 * Main menu (vanilla front-end). In the menu the key is routed to the
 * real `handleMenuKey`; an Episode pick advances to the Skill menu and
 * a Skill pick boots the chosen `E{episode}M1` level into gameplay.
 */
export function feedMenuKey(host: GameHost, doomKey: number): void {
  if (host.phase === 'game') {
    // In-game menu / pause is a later milestone; ignore for now.
    return;
  }

  if (host.phase === 'title') {
    host.phase = 'menu';
    openMenu(host.menu, MenuKind.Main);
    // m_menu.c M_StartControlPanel: opening the menu plays sfx_swtchn.
    host.audio?.startSfx(null, SFX_SWTCHN);
    return;
  }

  const cursorBefore = host.menu.itemOn;
  const action = handleMenuKey(host.menu, doomKey);
  switch (action.kind) {
    case 'selectEpisode':
      host.selectedEpisode = action.episode;
      openMenu(host.menu, MenuKind.Skill);
      // M_NewGame → episode pick advances to a submenu: sfx_pistol
      // (the item-selected cue) then sfx_swtchn (submenu entered).
      host.audio?.startSfx(null, SFX_PISTOL);
      host.audio?.startSfx(null, SFX_SWTCHN);
      return;
    case 'selectSkill': {
      const gameskill = Math.max(1, action.skill);
      host.lastSkill = gameskill;
      // s_sound.c S_Start at level setup stops the menu/title music
      // and starts the map music; createGameRuntime threads the same
      // audio bridge so monsters/weapons/specials sound in-game.
      host.audio?.startSfx(null, SFX_PISTOL);
      host.runtime = createGameRuntime(host.resources, {
        mapName: `E${host.selectedEpisode}M1`,
        skill: gameskill,
        audio: host.audio,
      });
      host.menu.active = false;
      host.phase = 'game';
      return;
    }
    default:
      // m_menu.c M_Responder up/down: a cursor row change plays
      // sfx_pstop (cursor-move). Detected by the itemOn delta since
      // the read-only menu module emits no sound event.
      if (host.menu.itemOn !== cursorBefore) {
        host.audio?.startSfx(null, SFX_PSTOP);
      }
      return;
  }
}

/**
 * Force the active level to complete, exactly as a direct
 * `G_ExitLevel()` / `G_SecretExitLevel()` call does in vanilla (the
 * E1M8 boss-death path, or a test driving the exit deterministically).
 * The exit special / switch already routes through
 * `runtime.specials` `gExitLevel`; this is the no-line-special
 * equivalent.  No-op outside the `game` phase or with no runtime.
 */
export function triggerHostExit(host: GameHost, secret: boolean): void {
  if (host.phase !== 'game' || host.runtime === null) return;
  host.runtime.exitLevel(secret);
}

/**
 * g_game.c `G_DoCompleted`: snapshot the finishing player's stats +
 * the level totals into a {@link IntermissionRound} /
 * {@link IntermissionPlayerResult}, pick the next map (or the episode
 * finale), `WI_Start` the intermission, and flip to the
 * `intermission` phase.  Vanilla defers this to the top of the next
 * `G_Ticker` after `gameaction == ga_completed`; the host calls it
 * from `tickHost` when `runtime.levelComplete` is set, matching that
 * one-tic deferral.
 */
function doCompleted(host: GameHost): void {
  const runtime = host.runtime;
  if (runtime === null) return;
  const completion = runtime.levelComplete;
  if (completion === null) return;

  const key = parseMap(runtime.session.mapName) ?? { episode: host.selectedEpisode, map: 1 };
  const totals = runtime.levelTotals;
  const player = runtime.player;

  const next = nextMapName(key.episode, key.map, completion.secret);
  host.pendingNextMap = next;
  // wi_stuff.c wbstartstruct: `next` is the 0-based map index; for the
  // episode-end (finale) vanilla still passes a value but the
  // ShowNextLoc screen is skipped — clamp to map 1 so the round shape
  // stays valid (beginIntermission requires nextMap >= 1).
  const nextKey = next === null ? null : parseMap(next);
  const round: IntermissionRound = {
    episode: key.episode,
    lastMap: key.map,
    nextMap: nextKey?.map ?? 1,
    maxKills: totals.totalKills,
    maxItems: totals.totalItems,
    maxSecrets: totals.totalSecret,
    parTimeTics: totals.parTimeTics,
  };
  const result: IntermissionPlayerResult = {
    killCount: player.killcount,
    itemCount: player.itemcount,
    secretCount: player.secretcount,
    timeTics: runtime.levelTime,
    inGame: true,
  };

  const state = createIntermissionState();
  beginIntermission(state, round, [result]);
  host.intermission = state;
  host.finale = null;
  host.phase = 'intermission';

  // The finishing runtime is retired — its R_RenderPlayerView is no
  // longer drawn (the intermission compositor owns the screen now).
  // Restore the process-global movement-hook / AI-codepointer state
  // it wired so the next `createGameRuntime` starts from pristine
  // globals (the shared Bun test worker stays hermetic, and
  // production avoids stacking hooks). The audio device is NOT closed
  // here: vanilla `S_Start` only stops the current music — the same
  // device carries the intermission cue and the next map's music
  // (closing it permanently, as `runtime.dispose()` would, is wrong
  // for map progression).
  resetGameRuntimeGlobals();
  host.runtime = null;
}

/**
 * Advance the intermission one tic (wi_stuff.c `WI_Ticker`).  The
 * player's use/attack is the single-player accelerate input; on
 * `worldDone` the host either boots the next map (`G_DoWorldDone`) or
 * — when the exit ended the episode — starts the finale
 * (`F_StartFinale`).
 */
function tickIntermissionPhase(host: GameHost, input: GameHostInput): void {
  const state = host.intermission;
  if (state === null) return;
  const result = tickIntermission(state, [{ attack: false, use: input.use }]);

  if (host.audio !== null) {
    if (result.music !== null) {
      // mus_inter — the Doom 1 intermission track (D_INTER).
      host.audio.startMusic('INTERMISSION');
    }
    for (const sound of result.sounds) {
      const sfx = sound === 'pistol' ? SFX_PISTOL : sound === 'barexp' ? SFX_BAREXP : SFX_SGCOCK;
      host.audio.startSfx(null, sfx);
    }
  }

  if (!result.worldDone) return;

  host.intermission = null;
  const next = host.pendingNextMap;
  host.pendingNextMap = null;

  if (next === null) {
    // g_game.c `gameaction = ga_victory` → F_StartFinale: E#M8
    // normal exit ends the episode with the finale text screen.
    const finale = createFinaleState();
    const start = startFinale(finale, { episode: host.selectedEpisode });
    host.finale = finale;
    host.phase = 'finale';
    if (host.audio !== null) {
      // F_StartFinale: S_ChangeMusic(mus_victor, true).
      host.audio.startMusic(start.music === 'mus_bunny' ? 'BUNNY' : 'VICTORY');
    }
    return;
  }

  // G_DoWorldDone: load the next map into a fresh runtime.
  host.runtime = createGameRuntime(host.resources, {
    mapName: next,
    skill: host.lastSkill,
    audio: host.audio,
  });
  host.phase = 'game';
}

/**
 * Advance the finale one tic (f_finale.c `F_Ticker`).  On the Doom 1
 * shareware target the only outcome is the automatic TEXT → ARTSCREEN
 * transition; there is no responder, so the screen holds.  When the
 * finale signals `worldDone` (commercial skip — never on shareware)
 * the host returns to the title attract loop.
 */
function tickFinalePhase(host: GameHost, input: GameHostInput): void {
  const state = host.finale;
  if (state === null) return;
  const result = tickFinale(state, {
    anyButtonPressed: input.use || input.forward || input.backward || input.turnLeft || input.turnRight,
    gameMode: 'shareware',
    mapNumber: 8,
  });
  if (host.audio !== null && result.music !== null) {
    host.audio.startMusic(result.music === 'mus_bunny' ? 'BUNNY' : 'VICTORY');
  }
  if (result.worldDone) {
    // d_main.c D_StartTitle: back to the attract loop. Shareware
    // never hits this (no Doom 1 finale responder); kept for parity.
    host.finale = null;
    host.phase = 'title';
    host.menu.active = false;
    if (host.audio !== null) host.audio.startMusic('TITLE');
  }
}

/**
 * Advance the host by one 35 Hz tic. In gameplay this builds a vanilla
 * ticcmd from the held input (same FORWARD/SIDE/ANGLE tables and run
 * gating as the launcher session) and drives {@link tickGame}; on the
 * title/menu screens it ticks the menu skull animation; on the
 * intermission/finale it advances those state machines and performs
 * the `G_DoCompleted` / `G_DoWorldDone` / `F_StartFinale` transitions.
 */
export function tickHost(host: GameHost, input: GameHostInput): void {
  if (host.phase === 'game' && host.runtime !== null) {
    const speedIndex = input.run ? 1 : 0;
    const angleTurn = input.turnLeft && !input.turnRight ? ANGLE_TURN[speedIndex]! : input.turnRight && !input.turnLeft ? -ANGLE_TURN[speedIndex]! : 0;
    const forwardMove = input.forward && !input.backward ? FORWARD_MOVE[speedIndex]! : input.backward && !input.forward ? -FORWARD_MOVE[speedIndex]! : 0;
    const sideMove = input.strafeRight && !input.strafeLeft ? SIDE_MOVE[speedIndex]! : input.strafeLeft && !input.strafeRight ? -SIDE_MOVE[speedIndex]! : 0;
    const buttons = input.use ? BT_USE : 0;
    tickGame(host.runtime, packTicCommand(forwardMove, sideMove, angleTurn, buttons, 0, 0));

    // G_Ticker: a level marked complete (the exit special set
    // `gameaction = ga_completed`) runs `G_DoCompleted` at the top of
    // the NEXT tic. Mirror that one-tic deferral here.
    if (host.runtime !== null && host.runtime.levelComplete !== null) {
      doCompleted(host);
    }
    return;
  }

  if (host.phase === 'intermission') {
    tickIntermissionPhase(host, input);
    return;
  }

  if (host.phase === 'finale') {
    tickFinalePhase(host, input);
    return;
  }

  tickMenu(host.menu);
}

/**
 * The composed framebuffer for the current phase. Gameplay returns the
 * bit-exact R_RenderPlayerView; the intermission/finale return their
 * composited 320x200 frame (the Win32 shell blits any non-null frame
 * directly and only menu-composites when this is `null`); title/menu
 * return `null` (the shell composites those from the WAD patches).
 */
export function renderHost(host: GameHost): Uint8Array | null {
  if (host.phase === 'game' && host.runtime !== null) {
    return renderGame(host.runtime);
  }
  if (host.phase === 'intermission' && host.intermission !== null) {
    host.frontEnd.composeIntermission(host.intermission, host.frontEndFramebuffer);
    return host.frontEndFramebuffer;
  }
  if (host.phase === 'finale' && host.finale !== null) {
    host.frontEnd.composeFinale(host.finale, host.frontEndFramebuffer);
    return host.frontEndFramebuffer;
  }
  return null;
}

/**
 * Restore process-global runtime state and release the audio device
 * (test-suite isolation + clean process exit).  Audio shutdown is
 * idempotent and never throws, so calling this after the runtime
 * already disposed (or with no audio at all) is safe.
 */
export function disposeGameHost(host: GameHost): void {
  host.runtime = null;
  host.intermission = null;
  host.finale = null;
  host.pendingNextMap = null;
  if (host.audio !== null) {
    try {
      host.audio.shutdown();
    } catch {
      // A waveOut-close failure must not block global-state reset.
    }
  }
  resetGameRuntimeGlobals();
}
