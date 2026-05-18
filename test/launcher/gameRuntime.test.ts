/**
 * Milestone A — real P_Ticker world simulation.
 *
 * These tests exercise the assembled live game runtime against the
 * local shareware IWAD (doom/DOOM1.WAD, E1M1). They prove the three
 * properties the user-facing goal needs from the world layer:
 *
 *   1. The monster AI brain (A_Look / A_Chase, p_enemy.c) is wired
 *      into the STATES action table for the shareware roster.
 *   2. The full simulation is deterministic run-to-run (vanilla DOOM
 *      is a fixed-seed LCG simulation — same inputs ⇒ identical state).
 *   3. Woken monsters actually pursue the player: the completed
 *      P_MobjThinker (P_XYMovement + P_ZMovement via the movement
 *      hook) plus A_Chase moves them, deterministically.
 *   4. The assembled gameplay renderer draws the player view.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { createGameRuntime, renderGame, resetGameRuntimeGlobals, tickGame } from '../../src/launcher/gameRuntime.ts';
import { MF_COUNTKILL, MF_SHOOTABLE, STATES, StateNum, setMobjState } from '../../src/world/mobj.ts';
import type { Mobj } from '../../src/world/mobj.ts';
import type { GameRuntime } from '../../src/launcher/gameRuntime.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

// The runtime mutates process-global state (the P_MobjThinker movement
// hook + monster AI codepointers in the shared STATES table). Bun runs
// every test file in one worker, so restore pristine globals after each
// test to keep the rest of the suite hermetic.
afterEach(() => {
  resetGameRuntimeGlobals();
});

function snapshotMobjs(runtime: GameRuntime): string {
  return runtime
    .allMobjs()
    .map((m: Mobj) => `${m.type}@${m.x},${m.y},${m.z},${m.angle},${STATES.indexOf(m.state!)},${m.health},${m.momx},${m.momy},${m.momz}`)
    .join('|');
}

describe('gameRuntime: real P_Ticker world simulation (E1M1, DOOM1.WAD)', () => {
  test('A_Look / A_Chase are wired into the shareware monster STATES roster', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });

    // Zombieman (MT_POSSESSED) and imp (MT_TROOP) stand states must
    // carry A_Look; their run states must carry A_Chase (info.c).
    expect(typeof STATES[StateNum.POSS_STND]!.action).toBe('function');
    expect(typeof STATES[StateNum.POSS_RUN1]!.action).toBe('function');
    expect(typeof STATES[StateNum.TROO_STND]!.action).toBe('function');
    expect(typeof STATES[StateNum.TROO_RUN1]!.action).toBe('function');
  });

  test('the E1M1 simulation is deterministic run-to-run (175 tics, no input)', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    const a = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
    for (let tic = 0; tic < 175; tic += 1) tickGame(a, EMPTY_TICCMD);
    const snapshotA = snapshotMobjs(a);

    const b = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
    for (let tic = 0; tic < 175; tic += 1) tickGame(b, EMPTY_TICCMD);
    const snapshotB = snapshotMobjs(b);

    expect(snapshotA).toBe(snapshotB);
    expect(a.levelTime).toBe(175);
    expect(a.allMobjs().length).toBeGreaterThan(1);
  });

  test('woken monsters chase the player (completed P_MobjThinker + A_Chase), deterministically', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    function runWokenChase(): number {
      const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
      const playerMobj = runtime.player.mo;
      expect(playerMobj).not.toBeNull();

      const monsters = runtime
        .allMobjs()
        .filter((m: Mobj) => m !== playerMobj && (m.flags & MF_COUNTKILL) !== 0 && (m.flags & MF_SHOOTABLE) !== 0);
      expect(monsters.length).toBeGreaterThan(0);

      const origins = monsters.map((m: Mobj) => ({ mobj: m, x: m.x, y: m.y }));
      // Wake every monster onto the player (vanilla: A_Look → seestate).
      for (const m of monsters) {
        m.target = playerMobj;
        setMobjState(m, m.info!.seestate, runtime.thinkerList);
      }
      for (let tic = 0; tic < 70; tic += 1) tickGame(runtime, EMPTY_TICCMD);

      let totalDisplacement = 0;
      for (const origin of origins) {
        totalDisplacement += Math.abs(origin.mobj.x - origin.x) + Math.abs(origin.mobj.y - origin.y);
      }
      return totalDisplacement;
    }

    const firstRun = runWokenChase();
    const secondRun = runWokenChase();

    expect(firstRun).toBeGreaterThan(0); // chase + movement hook actually moved monsters
    expect(firstRun).toBe(secondRun); // deterministic
  });

  test('renderGame draws the player view into the 320x200 framebuffer', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
    tickGame(runtime, EMPTY_TICCMD);

    const framebuffer = renderGame(runtime);
    expect(framebuffer.length).toBe(320 * 200);
    expect(framebuffer.some((pixel) => pixel !== 0)).toBe(true);
  });
});
