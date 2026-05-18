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

import { ANGLE_TURN, BT_USE, FORWARD_MOVE, SIDE_MOVE, packTicCommand } from '../input/ticcmd.ts';
import { MenuKind, createMenuState, handleMenuKey, openMenu, tickMenu } from '../ui/menus.ts';
import { createGameRuntime, renderGame, resetGameRuntimeGlobals, tickGame } from './gameRuntime.ts';

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
/** sfx_pistol (1) — menu item selected. */
const SFX_PISTOL = 1;
/** sfx_pstop (19) — cursor moved up/down. */
const SFX_PSTOP = 19;

/** The three top-level host phases. */
export type GameHostPhase = 'title' | 'menu' | 'game';

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
  runtime: GameRuntime | null;
  /**
   * Live audio host, or `null` for the silent front-end (every
   * historical caller).  When present the host starts the title music
   * (`D_INTRO`), emits the anonymous menu sfx, and threads the same
   * bridge into the spawned {@link GameRuntime} so gameplay sounds.
   */
  readonly audio: GameHostAudio | null;
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
    runtime: null,
    audio: resolvedAudio,
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
 * Advance the host by one 35 Hz tic. In gameplay this builds a vanilla
 * ticcmd from the held input (same FORWARD/SIDE/ANGLE tables and run
 * gating as the launcher session) and drives {@link tickGame}; on the
 * title/menu screens it ticks the menu skull animation.
 */
export function tickHost(host: GameHost, input: GameHostInput): void {
  if (host.phase === 'game' && host.runtime !== null) {
    const speedIndex = input.run ? 1 : 0;
    const angleTurn = input.turnLeft && !input.turnRight ? ANGLE_TURN[speedIndex]! : input.turnRight && !input.turnLeft ? -ANGLE_TURN[speedIndex]! : 0;
    const forwardMove = input.forward && !input.backward ? FORWARD_MOVE[speedIndex]! : input.backward && !input.forward ? -FORWARD_MOVE[speedIndex]! : 0;
    const sideMove = input.strafeRight && !input.strafeLeft ? SIDE_MOVE[speedIndex]! : input.strafeLeft && !input.strafeRight ? -SIDE_MOVE[speedIndex]! : 0;
    const buttons = input.use ? BT_USE : 0;
    tickGame(host.runtime, packTicCommand(forwardMove, sideMove, angleTurn, buttons, 0, 0));
    return;
  }
  tickMenu(host.menu);
}

/**
 * The composed framebuffer for the current phase. Gameplay returns the
 * bit-exact R_RenderPlayerView; title/menu return `null` (the Win32
 * shell composites those from the WAD patches).
 */
export function renderHost(host: GameHost): Uint8Array | null {
  if (host.phase === 'game' && host.runtime !== null) {
    return renderGame(host.runtime);
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
  if (host.audio !== null) {
    try {
      host.audio.shutdown();
    } catch {
      // A waveOut-close failure must not block global-state reset.
    }
  }
  resetGameRuntimeGlobals();
}
