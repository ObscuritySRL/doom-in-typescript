/**
 * Interactive game host — title → menu → play control flow.
 *
 * Proves the user-facing path works headlessly: start on the title
 * screen, walk the real vanilla menu (New Game → Episode → Skill) with
 * key events, land in the chosen level, and have movement input
 * actually drive the player through the live P_Ticker — all
 * deterministically.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { KEY_ENTER, KEY_ESCAPE } from '../../src/input/keyboard.ts';
import { resetGameRuntimeGlobals } from '../../src/launcher/gameRuntime.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { EMPTY_GAME_HOST_INPUT, createGameHost, disposeGameHost, feedMenuKey, renderHost, tickHost } from '../../src/launcher/gameHost.ts';
import type { GameHost } from '../../src/launcher/gameHost.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

// The host mutates process-global runtime state (movement hook + AI
// codepointers). Bun shares one worker across files — always restore
// pristine globals after each test, even if a test threw before its
// own disposeGameHost.
afterEach(() => {
  resetGameRuntimeGlobals();
});

/** Drive title → New Game → Episode 1 → Skill, returning the in-game host. */
async function startE1M1Host(): Promise<GameHost> {
  const resources = await loadLauncherResources(IWAD_PATH);
  const host = createGameHost(resources);
  feedMenuKey(host, KEY_ESCAPE); // title -> Main menu
  feedMenuKey(host, KEY_ENTER); // New Game -> Episode
  feedMenuKey(host, KEY_ENTER); // Episode 1 -> Skill
  feedMenuKey(host, KEY_ENTER); // Skill -> start the level
  return host;
}

describe('gameHost: title → menu → play state machine (DOOM1.WAD)', () => {
  test('menu navigation boots E1M1 from the title screen', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const host = createGameHost(resources);
    expect(host.phase).toBe('title');

    feedMenuKey(host, KEY_ESCAPE);
    expect(host.phase).toBe('menu');

    feedMenuKey(host, KEY_ENTER); // New Game -> Episode
    feedMenuKey(host, KEY_ENTER); // Episode 1 selected -> Skill
    expect(host.selectedEpisode).toBe(1);

    feedMenuKey(host, KEY_ENTER); // Skill selected -> game
    expect(host.phase).toBe('game');
    expect(host.runtime).not.toBeNull();
    expect(host.runtime!.session.mapName).toBe('E1M1');

    disposeGameHost(host);
  });

  test('held forward input drives the player through the live P_Ticker, deterministically', async () => {
    function displacementAfterForwardRun(host: GameHost): number {
      const playerMobj = host.runtime!.player.mo!;
      const startX = playerMobj.x;
      const startY = playerMobj.y;
      for (let tic = 0; tic < 35; tic += 1) {
        tickHost(host, { ...EMPTY_GAME_HOST_INPUT, forward: true });
      }
      return Math.abs(playerMobj.x - startX) + Math.abs(playerMobj.y - startY);
    }

    const hostA = await startE1M1Host();
    const movedA = displacementAfterForwardRun(hostA);
    disposeGameHost(hostA);

    const hostB = await startE1M1Host();
    const movedB = displacementAfterForwardRun(hostB);
    disposeGameHost(hostB);

    expect(movedA).toBeGreaterThan(0); // the player actually advanced
    expect(movedA).toBe(movedB); // deterministic run-to-run
  });

  test('renderHost yields the gameplay framebuffer once in a level', async () => {
    const host = await startE1M1Host();
    tickHost(host, EMPTY_GAME_HOST_INPUT);

    const framebuffer = renderHost(host);
    expect(framebuffer).not.toBeNull();
    expect(framebuffer!.length).toBe(320 * 200);
    expect(framebuffer!.some((pixel) => pixel !== 0)).toBe(true);

    disposeGameHost(host);
  });
});
