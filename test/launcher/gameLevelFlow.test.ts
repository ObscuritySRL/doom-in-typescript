/**
 * Milestone — vanilla level flow: exit → intermission → next map → finale.
 *
 * Before this step the live game (`gameHost` driving the assembled
 * P_Ticker) was single-level: the E1M1 exit switch flipped its texture
 * but `gExitLevel` was a no-op, so a player could never finish a level
 * or progress through Knee-Deep in the Dead.
 *
 * These tests prove the wired flow end-to-end against the local
 * shareware IWAD (doom/DOOM1.WAD):
 *
 *   (a) Triggering the E1M1 exit special (linedef special 11, the S1
 *       normal-exit switch — invoked through the same exit hook the
 *       USE/cross path drives) moves the host to the `intermission`
 *       phase with sane stats (kills/items/secrets and the level
 *       totals captured at level setup, the level time, and the
 *       episode-1 par).
 *   (b) Accelerating through the intermission (the player's
 *       use/attack as the WI_checkForAccelerate input) lands the host
 *       back in `game` on the next sequential map (E1M2).
 *   (c) The whole exit → intermission → next-map flow is deterministic
 *       run-to-run (vanilla DOOM is a fixed-seed simulation).
 *   (d) The episode-end exit (E1M8 normal exit) routes to the
 *       `finale` phase (episode-1 victory text), not a next map.
 *
 * Assertions are robust (phase transitions + next map name + stats
 * present), not pixel-exact: the intermission/finale screens are
 * composited frames but the contract under test is the control flow.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { resetGameRuntimeGlobals } from '../../src/launcher/gameRuntime.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { EMPTY_GAME_HOST_INPUT, createGameHost, disposeGameHost, renderHost, tickHost, triggerHostExit } from '../../src/launcher/gameHost.ts';
import type { GameHost } from '../../src/launcher/gameHost.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

// The host mutates process-global runtime state (movement hook + AI
// codepointers). Bun shares one worker across files — always restore
// pristine globals after each test, even if a test threw before its
// own disposeGameHost.
afterEach(() => {
  resetGameRuntimeGlobals();
});

/** Boot a host straight into the requested map at skill 2 (no menu walk). */
async function startHostInMap(mapName: string): Promise<GameHost> {
  const resources = await loadLauncherResources(IWAD_PATH);
  const host = createGameHost(resources);
  host.selectedEpisode = 1;
  host.lastSkill = 2;
  host.runtime = (await import('../../src/launcher/gameRuntime.ts')).createGameRuntime(resources, { mapName, skill: 2 });
  host.phase = 'game';
  host.menu.active = false;
  return host;
}

/** Tick the host with the player pressing USE (accelerate input). */
function tickUse(host: GameHost): void {
  tickHost(host, { ...EMPTY_GAME_HOST_INPUT, use: true });
}

/** Tick the host with no input. */
function tickIdle(host: GameHost): void {
  tickHost(host, EMPTY_GAME_HOST_INPUT);
}

/**
 * Advance the host until it leaves `intermission` (back to `game` or
 * into `finale`) by alternating use/idle so the WI accelerate
 * edge-detect fires repeatedly (a held button only fires once).
 */
function accelerateThroughIntermission(host: GameHost, cap = 2000): void {
  for (let tic = 0; tic < cap && host.phase === 'intermission'; tic += 1) {
    if (tic % 2 === 0) tickUse(host);
    else tickIdle(host);
  }
}

describe('gameLevelFlow: exit → intermission → next map → finale (DOOM1.WAD)', () => {
  test('(a) the E1M1 exit moves the host to intermission with sane stats', async () => {
    const host = await startHostInMap('E1M1');
    expect(host.phase).toBe('game');
    expect(host.runtime).not.toBeNull();

    // Settle one tic so the player exists, then trigger the level exit
    // through the same hook the exit switch/line drives.
    tickIdle(host);
    expect(host.runtime!.levelComplete).toBeNull();
    triggerHostExit(host, false);
    expect(host.runtime!.levelComplete).toEqual({ secret: false });

    // The next host tic observes the pending completion and runs
    // G_DoCompleted: capture stats, beginIntermission, phase flips.
    tickIdle(host);
    expect(host.phase).toBe('intermission');
    expect(host.intermission).not.toBeNull();

    const round = host.intermission!.round!;
    expect(round.episode).toBe(1);
    expect(round.lastMap).toBe(1);
    expect(round.nextMap).toBe(2);
    // E1M1 totals captured at level setup (probed: 6 kills, 37 items,
    // 3 secret sectors). Par for E1M1 is 30 s = 30 * 35 tics (g_game.c
    // pars[1][1]).
    expect(round.maxKills).toBe(6);
    expect(round.maxItems).toBe(37);
    expect(round.maxSecrets).toBe(3);
    expect(round.parTimeTics).toBe(30 * 35);

    const plr = host.intermission!.playerResults[0]!;
    expect(plr.killCount).toBe(0);
    expect(plr.itemCount).toBe(0);
    expect(plr.secretCount).toBe(0);
    expect(plr.timeTics).toBeGreaterThanOrEqual(0);
    expect(plr.inGame).toBe(true);

    // The intermission screen composites a non-null frame so the Win32
    // shell blits it (renderHost === null only for title/menu).
    const frame = renderHost(host);
    expect(frame).not.toBeNull();
    expect(frame!.length).toBe(320 * 200);

    disposeGameHost(host);
  });

  test('(b) accelerating through the intermission boots the next map (E1M2)', async () => {
    const host = await startHostInMap('E1M1');
    tickIdle(host);
    triggerHostExit(host, false);
    tickIdle(host);
    expect(host.phase).toBe('intermission');

    accelerateThroughIntermission(host);

    expect(host.phase).toBe('game');
    expect(host.runtime).not.toBeNull();
    expect(host.runtime!.session.mapName).toBe('E1M2');
    expect(host.runtime!.levelComplete).toBeNull();

    // The new level renders.
    tickIdle(host);
    const frame = renderHost(host);
    expect(frame).not.toBeNull();
    expect(frame!.some((pixel) => pixel !== 0)).toBe(true);

    disposeGameHost(host);
  });

  test('(c) the exit → intermission → next-map flow is deterministic', async () => {
    function flowSignature(host: GameHost): string {
      tickIdle(host);
      triggerHostExit(host, false);
      tickIdle(host);
      const round = host.intermission!.round!;
      const sig0 = `${host.phase}:${round.episode}/${round.lastMap}/${round.nextMap}/${round.maxKills}/${round.maxItems}/${round.maxSecrets}/${round.parTimeTics}`;
      accelerateThroughIntermission(host);
      return `${sig0}|${host.phase}:${host.runtime!.session.mapName}`;
    }

    const hostA = await startHostInMap('E1M1');
    const sigA = flowSignature(hostA);
    disposeGameHost(hostA);

    const hostB = await startHostInMap('E1M1');
    const sigB = flowSignature(hostB);
    disposeGameHost(hostB);

    expect(sigA).toBe(sigB);
    expect(sigA).toContain('|game:E1M2');
  });

  test('(d) the E1M8 normal exit routes to the episode-1 finale', async () => {
    const host = await startHostInMap('E1M8');
    tickIdle(host);
    triggerHostExit(host, false);
    tickIdle(host);
    expect(host.phase).toBe('intermission');
    expect(host.intermission!.round!.lastMap).toBe(8);

    accelerateThroughIntermission(host);

    // E1M8 normal exit ends Knee-Deep in the Dead: the host enters the
    // finale (episode-1 victory text over FLOOR4_8), NOT a next map.
    expect(host.phase).toBe('finale');
    expect(host.finale).not.toBeNull();
    expect(host.finale!.screen!.episode).toBe(1);

    const frame = renderHost(host);
    expect(frame).not.toBeNull();
    expect(frame!.length).toBe(320 * 200);

    disposeGameHost(host);
  });
});
