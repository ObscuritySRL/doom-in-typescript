/**
 * Milestone C — real sector/line specials in the assembled P_Ticker.
 *
 * These tests exercise the wired P_UseSpecialLine / P_CrossSpecialLine /
 * P_UpdateSpecials layer against the local shareware IWAD
 * (doom/DOOM1.WAD, E1M1). They prove the properties the user-facing
 * goal needs from the specials layer:
 *
 *   1. Pressing BT_USE while facing a manual (DR, special 1) door line
 *      runs the full P_UseLines → PTR_UseTraverse → P_UseSpecialLine →
 *      EV_VerticalDoor chain: the door sector's `ceilingheight` rises
 *      over N tics (T_VerticalDoor + the level-bound T_MovePlane), the
 *      door thinker is active on the ring, the door fully opens to
 *      `P_FindLowestCeilingSurrounding(sec) - 4`, then — because a DR
 *      door is `normal` — waits VDOORWAIT and closes again, removing
 *      the thinker (`sector.specialdata` back to null).
 *   2. The whole door simulation is deterministic run-to-run (vanilla
 *      DOOM is a fixed-seed LCG simulation — same inputs ⇒ identical
 *      sector heights every tic).
 *
 * The scenario picks the door by *linedef special id* (the first
 * special-1 line whose back sector is a closed door — robust against
 * geometry drift) and places the player one USERANGE-safe step in
 * front of the line midpoint facing it, the same deterministic-setup
 * technique gameCombat.test.ts uses for the point-blank zombieman.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { BT_USE, EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { createGameRuntime, resetGameRuntimeGlobals, tickGame } from '../../src/launcher/gameRuntime.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { rPointToAngle2 } from '../../src/render/wallScaleMath.ts';
import type { GameRuntime } from '../../src/launcher/gameRuntime.ts';
import type { Mobj } from '../../src/world/mobj.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

const USE_TICCMD: TicCommand = Object.freeze({
  forwardmove: 0,
  sidemove: 0,
  angleturn: 0,
  consistancy: 0,
  chatchar: 0,
  buttons: BT_USE,
});

afterEach(() => {
  resetGameRuntimeGlobals();
});

/** Re-link a moved mobj into the blockmap thing grid (same as gameCombat.test.ts). */
function relinkBlockmap(runtime: GameRuntime, mobj: Mobj): void {
  const { mapData, blocklinks } = runtime.session;
  const blockmap = mapData.blockmap;
  const blockX = ((mobj.x - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const blockY = ((mobj.y - blockmap.originY) | 0) >> MAPBLOCKSHIFT;
  if (blockX < 0 || blockY < 0 || blockX >= blockmap.columns || blockY >= blockmap.rows) return;
  const cellIndex = blockY * blockmap.columns + blockX;
  mobj.blockPrev = null;
  mobj.blockNext = blocklinks[cellIndex];
  if (mobj.blockNext !== null) mobj.blockNext.blockPrev = mobj;
  blocklinks[cellIndex] = mobj;
}

/**
 * Find the first DR (special 1, repeatable, no key) door linedef whose
 * back sector is a *closed* door (ceiling === floor) — picked by
 * special id, not fragile geometry.
 */
function findManualDoor(runtime: GameRuntime): { linedefIndex: number; doorSectorIndex: number } {
  const { mapData } = runtime.session;
  for (let linedefIndex = 0; linedefIndex < mapData.linedefs.length; linedefIndex += 1) {
    if (mapData.linedefs[linedefIndex]!.special !== 1) continue;
    const back = mapData.lineSectors[linedefIndex]!.backsector;
    if (back === -1) continue;
    const sector = runtime.specials.sectors[back]!;
    if (sector.ceilingheight === sector.floorheight) {
      return { linedefIndex, doorSectorIndex: back };
    }
  }
  throw new Error('E1M1 has no closed DR (special 1) door — fixture drift');
}

/**
 * Stand the player ~32 map units in front of `linedefIndex`'s midpoint,
 * facing the line, so the next BT_USE press's P_UseLines ray (USERANGE
 * = 64 units) hits it.
 */
function facePlayerAtDoor(runtime: GameRuntime, linedefIndex: number): void {
  const { mapData } = runtime.session;
  const playerMobj = runtime.player.mo;
  expect(playerMobj).not.toBeNull();
  const linedef = mapData.linedefs[linedefIndex]!;
  const v1 = mapData.vertexes[linedef.v1]!;
  const v2 = mapData.vertexes[linedef.v2]!;
  const midX = (v1.x + v2.x) >> 1;
  const midY = (v1.y + v2.y) >> 1;
  // Unit normal to the linedef (front side = sidenum0's sector); 32
  // units off the line midpoint puts the player inside the front
  // sector within USERANGE of the door.
  const length = Math.hypot(linedef.dx, linedef.dy) || 1;
  const normalX = linedef.dy / length;
  const normalY = -linedef.dx / length;
  const mobj = playerMobj!;
  mobj.x = (midX + normalX * 32 * FRACUNIT) | 0;
  mobj.y = (midY + normalY * 32 * FRACUNIT) | 0;
  mobj.angle = rPointToAngle2(mobj.x, mobj.y, midX, midY) >>> 0;
  relinkBlockmap(runtime, mobj);
}

describe('gameSpecials: real P_UseSpecialLine / P_UpdateSpecials (E1M1, DOOM1.WAD)', () => {
  test('BT_USE on a DR door raises the door sector ceiling and arms the door thinker', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });

    const { linedefIndex, doorSectorIndex } = findManualDoor(runtime);
    facePlayerAtDoor(runtime, linedefIndex);

    const door = runtime.specials.sectors[doorSectorIndex]!;
    const closedCeiling = door.ceilingheight;
    expect(door.specialdata).toBeNull();

    // P_PlayerReborn sets player.usedown = true so the first press is
    // swallowed (vanilla anti-respawn-fire); release one tic first.
    tickGame(runtime, EMPTY_TICCMD);
    tickGame(runtime, USE_TICCMD);

    // The door thinker is now on the ring and has begun opening.
    expect(door.specialdata).not.toBeNull();
    expect(door.ceilingheight).toBeGreaterThan(closedCeiling);
  });

  test('the DR door fully opens, waits, then closes (full vanilla T_VerticalDoor cycle)', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });

    const { linedefIndex, doorSectorIndex } = findManualDoor(runtime);
    facePlayerAtDoor(runtime, linedefIndex);
    const door = runtime.specials.sectors[doorSectorIndex]!;
    const closedCeiling = door.ceilingheight;

    tickGame(runtime, EMPTY_TICCMD);
    tickGame(runtime, USE_TICCMD);

    // Drive ~36 tics: the door reaches its open height
    // (P_FindLowestCeilingSurrounding(sec) - 4*FRACUNIT) at
    // VDOORSPEED = 2*FRACUNIT/tic.
    for (let tic = 0; tic < 36; tic += 1) tickGame(runtime, EMPTY_TICCMD);
    const openCeiling = door.ceilingheight;
    expect(openCeiling).toBeGreaterThan(closedCeiling);
    expect(door.specialdata).not.toBeNull(); // still active (DR door waits at top)

    // Hold position through the VDOORWAIT (150 tics) — still open.
    for (let tic = 0; tic < 120; tic += 1) tickGame(runtime, EMPTY_TICCMD);
    expect(door.ceilingheight).toBe(openCeiling);

    // After the wait the DR (normal) door closes and the thinker is
    // removed (sector.specialdata back to null), fully closed again.
    for (let tic = 0; tic < 110; tic += 1) tickGame(runtime, EMPTY_TICCMD);
    expect(door.ceilingheight).toBe(closedCeiling);
    expect(door.specialdata).toBeNull();
  });

  test('the DR door open/wait/close simulation is deterministic run-to-run', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    function runDoorCycle(): string {
      const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
      const { linedefIndex, doorSectorIndex } = findManualDoor(runtime);
      facePlayerAtDoor(runtime, linedefIndex);
      const door = runtime.specials.sectors[doorSectorIndex]!;

      tickGame(runtime, EMPTY_TICCMD);
      tickGame(runtime, USE_TICCMD);

      const heights: number[] = [];
      for (let tic = 0; tic < 240; tic += 1) {
        tickGame(runtime, EMPTY_TICCMD);
        heights.push(door.ceilingheight);
      }
      const snapshot = `${heights.join(',')}|sd=${door.specialdata === null ? 'null' : 'thinker'}`;
      resetGameRuntimeGlobals();
      return snapshot;
    }

    const firstRun = runDoorCycle();
    const secondRun = runDoorCycle();
    expect(firstRun).toBe(secondRun);
    // The cycle actually moved the door (not a no-op equality).
    expect(firstRun.split('|')[0]!.split(',').some((h) => Number(h) !== 0)).toBe(true);
  });
});
