/**
 * Milestone — the vanilla status bar is composited over gameplay.
 *
 * `bun run doom.ts -iwad doom/DOOM1.WAD` plays but looked wrong because
 * `renderGame` only returned `R_RenderPlayerView` with no `ST_Drawer`.
 * These tests prove the assembled runtime now draws the vanilla status
 * bar (st_stuff.c ST_Drawer / ST_drawWidgets) into the bottom 32 rows
 * of the player-view framebuffer:
 *
 *   (a) After a few tics, `renderGame`'s bottom 32 rows (y 168..199 —
 *       ST_Y..ST_Y+ST_HEIGHT-1) are non-empty (the opaque STBAR plus
 *       the widgets were composited), whereas a fresh blank frame's
 *       bottom rows are all zero.
 *   (b) The big-red health-digit region changes once the player takes
 *       damage — driven exactly like gameCombat.test.ts: a real
 *       on-map zombieman relocated point-blank in front of the frozen
 *       player and woken so its A_PosAttack reduces player.health,
 *       which the face/percent widgets must reflect.
 *   (c) The full composited frame is deterministic run-to-run (vanilla
 *       DOOM is a fixed-seed LCG simulation — same inputs ⇒ identical
 *       pixels), including the M_Random-driven face cycle.
 *
 * Assertions are robust: non-empty / changed / identical, never
 * hard-coded pixel values (palette + patch art are IWAD data).
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { ANGLETOFINESHIFT, FINEMASK, finecosine, finesine } from '../../src/core/trig.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { createGameRuntime, renderGame, resetGameRuntimeGlobals, tickGame } from '../../src/launcher/gameRuntime.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { MobjType, setMobjState } from '../../src/world/mobj.ts';
import type { Mobj } from '../../src/world/mobj.ts';
import type { GameRuntime } from '../../src/launcher/gameRuntime.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
// st_stuff.c: ST_Y = SCREENHEIGHT - ST_HEIGHT = 168, ST_HEIGHT = 32.
const ST_Y = 168;
const ST_HEIGHT = 32;
// st_lib.c: the big-red health % widget — anchor ST_HEALTHX=90,
// ST_NUMBER_Y=171, tall digits 14px, drawn right-justified to the
// left of the anchor. Sample a generous box around it.
const HEALTH_REGION = Object.freeze({ x0: 40, x1: 95, y0: 169, y1: 188 });

afterEach(() => {
  resetGameRuntimeGlobals();
});

/** Hash the inclusive [y0, y1) × [x0, x1) framebuffer box (FNV-1a). */
function hashRegion(framebuffer: Uint8Array, x0: number, x1: number, y0: number, y1: number): number {
  let hash = 0x811c9dc5;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      hash ^= framebuffer[y * SCREEN_WIDTH + x]!;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

/** Whole-frame hash for run-to-run determinism. */
function hashFrame(framebuffer: Uint8Array): number {
  return hashRegion(framebuffer, 0, SCREEN_WIDTH, 0, SCREEN_HEIGHT);
}

/**
 * Re-link a mobj into the blockmap thing grid after it has been moved
 * (P_UnsetThingPosition / P_SetThingPosition). Verbatim from
 * gameCombat.test.ts — the hitscan trace walks `blocklinks`, so a mobj
 * relocated by field assignment is invisible to combat until relinked.
 */
function relinkToBlockmap(runtime: GameRuntime, thing: Mobj): void {
  const { blockmap } = runtime.session.mapData;
  const grid = runtime.session.blocklinks;

  if (thing.blockPrev !== null) {
    thing.blockPrev.blockNext = thing.blockNext;
  } else {
    for (let cell = 0; cell < grid.length; cell += 1) {
      if (grid[cell] === thing) {
        grid[cell] = thing.blockNext;
        break;
      }
    }
  }
  if (thing.blockNext !== null) {
    thing.blockNext.blockPrev = thing.blockPrev;
  }
  thing.blockPrev = null;
  thing.blockNext = null;

  const blockX = ((thing.x - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const blockY = ((thing.y - blockmap.originY) | 0) >> MAPBLOCKSHIFT;
  if (blockX < 0 || blockY < 0 || blockX >= blockmap.columns || blockY >= blockmap.rows) {
    return;
  }

  const cellIndex = blockY * blockmap.columns + blockX;
  thing.blockNext = grid[cellIndex] ?? null;
  if (thing.blockNext !== null) {
    thing.blockNext.blockPrev = thing;
  }
  grid[cellIndex] = thing;
}

/**
 * Spawn-and-wake a real on-map zombieman point-blank in front of the
 * player so its A_PosAttack draws player blood. Verbatim technique from
 * gameCombat.test.ts (placeWokenZombieAhead).
 */
function placeWokenZombieAhead(runtime: GameRuntime, distanceUnits: number): Mobj {
  const playerMobj = runtime.player.mo!;
  const zombie = runtime.allMobjs().find((m: Mobj) => m.type === MobjType.POSSESSED);
  if (zombie === undefined) {
    throw new Error('E1M1 should contain at least one zombieman (MT_POSSESSED)');
  }

  const fineAngle = (playerMobj.angle >>> ANGLETOFINESHIFT) & FINEMASK;
  zombie.x = (playerMobj.x + distanceUnits * finecosine[fineAngle]!) | 0;
  zombie.y = (playerMobj.y + distanceUnits * finesine[fineAngle]!) | 0;
  zombie.z = playerMobj.z;
  zombie.floorz = playerMobj.floorz;
  zombie.ceilingz = playerMobj.ceilingz;
  zombie.subsector = playerMobj.subsector;
  zombie.target = playerMobj;
  zombie.momx = 0;
  zombie.momy = 0;
  zombie.momz = 0;

  relinkToBlockmap(runtime, zombie);
  setMobjState(zombie, zombie.info!.seestate, runtime.thinkerList);

  return zombie;
}

describe('gameHud: vanilla status bar composited over gameplay (E1M1, DOOM1.WAD)', () => {
  test('renderGame fills the bottom 32 rows with the status bar (a blank frame would be 0)', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });

    for (let tic = 0; tic < 8; tic += 1) {
      tickGame(runtime, EMPTY_TICCMD);
    }

    const framebuffer = renderGame(runtime);
    expect(framebuffer.length).toBe(SCREEN_WIDTH * SCREEN_HEIGHT);

    // The status bar rows: every one of the 32 rows must carry pixels
    // (STBAR is an opaque full-width strip), and a meaningful fraction
    // of the area must be non-zero.
    let nonZero = 0;
    for (let y = ST_Y; y < ST_Y + ST_HEIGHT; y += 1) {
      let rowNonZero = false;
      for (let x = 0; x < SCREEN_WIDTH; x += 1) {
        if (framebuffer[y * SCREEN_WIDTH + x]! !== 0) {
          rowNonZero = true;
          nonZero += 1;
        }
      }
      expect(rowNonZero).toBe(true);
    }
    // Opaque STBAR ⇒ the vast majority of the 320×32 strip is painted.
    expect(nonZero).toBeGreaterThan(SCREEN_WIDTH * ST_HEIGHT * 0.5);

    // A fresh blank frame's bottom rows are all zero (sanity contrast).
    const blank = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    let blankNonZero = 0;
    for (let y = ST_Y; y < ST_Y + ST_HEIGHT; y += 1) {
      for (let x = 0; x < SCREEN_WIDTH; x += 1) {
        if (blank[y * SCREEN_WIDTH + x]! !== 0) blankNonZero += 1;
      }
    }
    expect(blankNonZero).toBe(0);
  });

  test('the health-digit region changes after the player takes damage', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
    const player = runtime.player;
    const playerMobj = player.mo!;

    // Settle the weapon raise + a couple status-bar tics, capture the
    // 100%-health digit region.
    for (let tic = 0; tic < 6; tic += 1) {
      tickGame(runtime, EMPTY_TICCMD);
    }
    const healthBefore = player.health;
    expect(healthBefore).toBe(100);
    const regionBefore = hashRegion(renderGame(runtime), HEALTH_REGION.x0, HEALTH_REGION.x1, HEALTH_REGION.y0, HEALTH_REGION.y1);

    // Wake a point-blank zombieman so its A_PosAttack reduces health
    // (gameCombat technique). Re-anchor the player each tic so movement
    // is not what changes the readout and LOS is kept.
    const zombie = placeWokenZombieAhead(runtime, 160);
    zombie.health = 1_000_000;
    zombie.reactiontime = 0;

    for (let tic = 0; tic < 210; tic += 1) {
      playerMobj.momx = 0;
      playerMobj.momy = 0;
      tickGame(runtime, EMPTY_TICCMD);
      if (player.health < healthBefore) break;
    }

    expect(player.health).toBeLessThan(healthBefore);
    expect(player.attacker).toBe(zombie);

    const regionAfter = hashRegion(renderGame(runtime), HEALTH_REGION.x0, HEALTH_REGION.x1, HEALTH_REGION.y0, HEALTH_REGION.y1);
    expect(regionAfter).not.toBe(regionBefore);
  });

  test('the full composited frame is deterministic run-to-run', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    function runFrame(): number {
      const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
      for (let tic = 0; tic < 40; tic += 1) {
        tickGame(runtime, EMPTY_TICCMD);
      }
      const hash = hashFrame(renderGame(runtime));
      resetGameRuntimeGlobals();
      return hash;
    }

    const firstRun = runFrame();
    const secondRun = runFrame();

    expect(firstRun).toBe(secondRun);
  });
});
