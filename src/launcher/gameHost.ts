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
import type { GameRuntime } from './gameRuntime.ts';
import type { MenuState } from '../ui/menus.ts';

import { ANGLE_TURN, BT_USE, FORWARD_MOVE, SIDE_MOVE, packTicCommand } from '../input/ticcmd.ts';
import { MenuKind, createMenuState, handleMenuKey, openMenu, tickMenu } from '../ui/menus.ts';
import { createGameRuntime, renderGame, resetGameRuntimeGlobals, tickGame } from './gameRuntime.ts';

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
}

/**
 * Create a host parked on the title screen. No level is loaded until
 * the player walks the menu through to a skill selection.
 */
export function createGameHost(resources: LauncherResources): GameHost {
  return {
    resources,
    phase: 'title',
    menu: createMenuState(),
    selectedEpisode: 1,
    runtime: null,
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
    return;
  }

  const action = handleMenuKey(host.menu, doomKey);
  switch (action.kind) {
    case 'selectEpisode':
      host.selectedEpisode = action.episode;
      openMenu(host.menu, MenuKind.Skill);
      return;
    case 'selectSkill': {
      const gameskill = Math.max(1, action.skill);
      host.runtime = createGameRuntime(host.resources, {
        mapName: `E${host.selectedEpisode}M1`,
        skill: gameskill,
      });
      host.menu.active = false;
      host.phase = 'game';
      return;
    }
    default:
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

/** Restore process-global runtime state (test-suite isolation). */
export function disposeGameHost(host: GameHost): void {
  host.runtime = null;
  resetGameRuntimeGlobals();
}
