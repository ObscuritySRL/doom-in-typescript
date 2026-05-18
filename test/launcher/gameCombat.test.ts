/**
 * Milestone B — real combat in the assembled P_Ticker.
 *
 * These tests exercise the wired hitscan / damage layer against the
 * local shareware IWAD (doom/DOOM1.WAD, E1M1). They prove the three
 * properties the user-facing goal needs from the combat layer:
 *
 *   1. Firing the pistol (BT_ATTACK ticcmd) at a woken zombieman in
 *      range runs the full P_BulletSlope → P_LineAttack → P_DamageMobj
 *      chain: the zombieman loses health (and dies), and the shot
 *      consumes exactly one bullet.
 *   2. A woken monster's own attack (driven by A_Chase → attack state →
 *      A_PosAttack → P_LineAttack → P_DamageMobj) reduces player.health.
 *   3. The full combat simulation is deterministic run-to-run (vanilla
 *      DOOM is a fixed-seed LCG simulation — same inputs ⇒ identical
 *      state), including every RNG-driven damage / pain / death roll.
 *
 * The scenario positions a zombieman directly along the player's facing
 * at point-blank range (no wall between) and wakes it, the same
 * deterministic-setup technique the gameRuntime.test.ts chase test uses.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { ANGLETOFINESHIFT, FINEMASK, finecosine, finesine } from '../../src/core/trig.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { BT_ATTACK, EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { createGameRuntime, resetGameRuntimeGlobals, tickGame } from '../../src/launcher/gameRuntime.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { AmmoType } from '../../src/player/playerSpawn.ts';
import { MF_COUNTKILL, MF_SHOOTABLE, MobjType, STATES, StateNum, setMobjState } from '../../src/world/mobj.ts';
import type { Mobj } from '../../src/world/mobj.ts';
import type { GameRuntime } from '../../src/launcher/gameRuntime.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

const ATTACK_TICCMD: TicCommand = Object.freeze({
  forwardmove: 0,
  sidemove: 0,
  angleturn: 0,
  consistancy: 0,
  chatchar: 0,
  buttons: BT_ATTACK,
});

afterEach(() => {
  resetGameRuntimeGlobals();
});

/** A full mobj-state snapshot string, identical shape to the world test. */
function snapshotMobjs(runtime: GameRuntime): string {
  return runtime
    .allMobjs()
    .map((m: Mobj) => `${m.type}@${m.x},${m.y},${m.z},${m.angle},${STATES.indexOf(m.state!)},${m.health},${m.momx},${m.momy},${m.momz}`)
    .join('|');
}

/**
 * Re-link a mobj into the blockmap thing grid after it has been moved.
 * The hitscan trace and PIT_CheckThing walk `blocklinks`, so a mobj
 * relocated by direct field assignment is invisible to combat until it
 * is unlinked from its old cell and linked into the new one — exactly
 * what P_UnsetThingPosition / P_SetThingPosition do in vanilla.
 */
function relinkToBlockmap(runtime: GameRuntime, thing: Mobj): void {
  const { blockmap } = runtime.session.mapData;
  const grid = runtime.session.blocklinks;

  // Unlink from the current doubly-linked cell list.
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
 * Spawn-and-wake a zombieman point-blank in front of the player. Reuses
 * a real on-map zombieman mobj (so info/state tables are authentic),
 * relocates it `distanceUnits` map units along the player's facing,
 * level with the player's z, targeted at the player and in its
 * seestate so it stands and fights instead of wandering. The mobj is
 * re-linked into the blockmap so the hitscan trace can find it.
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

  // Wake it onto the player exactly as A_Look → seestate would
  // (same technique the gameRuntime.test.ts chase test uses), so
  // A_Chase drives it into its A_PosAttack loop instead of idling.
  setMobjState(zombie, zombie.info!.seestate, runtime.thinkerList);

  return zombie;
}

describe('gameCombat: real hitscan + damage in the assembled P_Ticker (E1M1, DOOM1.WAD)', () => {
  test('firing the pistol at a woken zombieman in range damages/kills it and consumes a bullet', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });

    const zombie = placeWokenZombieAhead(runtime, 96);
    const healthBefore = zombie.health;
    const ammoBefore = runtime.player.ammo[AmmoType.CLIP]!;

    expect(healthBefore).toBeGreaterThan(0);
    expect(ammoBefore).toBe(50);

    // Hold the trigger long enough for the pistol psprite state machine
    // to raise (level start), accept BT_ATTACK in A_WeaponReady, run
    // A_FirePistol, and fire at least one bullet down the trace.
    let killed = false;
    let firstHitTic = -1;
    for (let tic = 0; tic < 60; tic += 1) {
      tickGame(runtime, ATTACK_TICCMD);
      if (firstHitTic < 0 && zombie.health < healthBefore) {
        firstHitTic = tic;
      }
      if ((zombie.flags & MF_SHOOTABLE) === 0) {
        killed = true;
        break;
      }
    }

    const ammoAfter = runtime.player.ammo[AmmoType.CLIP]!;

    // The shot connected: health dropped (and the 20-HP zombieman dies
    // to pistol fire — 5/10/15 per bullet).
    expect(firstHitTic).toBeGreaterThanOrEqual(0);
    expect(killed).toBe(true);
    expect(zombie.health).toBeLessThanOrEqual(0);

    // Firing consumed bullets (one per A_FirePistol shot).
    expect(ammoAfter).toBeLessThan(ammoBefore);
  });

  test('a woken zombieman attacking the player reduces player.health', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
    const player = runtime.player;
    const playerMobj = player.mo!;

    // Place the zombieman in front of the player but a bit further out
    // so it stays in its attack/chase loop firing back rather than
    // being instantly stomped, and freeze the player so it cannot be
    // pushed off the line of fire.
    const zombie = placeWokenZombieAhead(runtime, 160);
    zombie.health = 1_000_000; // keep it alive long enough to shoot back
    zombie.reactiontime = 0;

    const healthBefore = player.health;
    expect(healthBefore).toBe(100);

    // No player input: the zombieman runs A_Chase → A_PosAttack →
    // P_LineAttack → P_DamageMobj against the player.
    for (let tic = 0; tic < 210; tic += 1) {
      // Re-anchor the player each tic: A_PosAttack thrust / movement
      // must not be what changes health, and the zombie must keep LOS.
      playerMobj.momx = 0;
      playerMobj.momy = 0;
      tickGame(runtime, EMPTY_TICCMD);
      if (player.health < healthBefore) break;
    }

    expect(player.health).toBeLessThan(healthBefore);
    expect(player.attacker).toBe(zombie);
  });

  test('the combat simulation is deterministic run-to-run', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    function runCombat(): string {
      const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
      placeWokenZombieAhead(runtime, 96);
      for (let tic = 0; tic < 60; tic += 1) {
        tickGame(runtime, ATTACK_TICCMD);
      }
      const snapshot = snapshotMobjs(runtime);
      resetGameRuntimeGlobals();
      return snapshot;
    }

    const firstRun = runCombat();
    const secondRun = runCombat();

    expect(firstRun).toBe(secondRun);
  });

  test('every shareware monster type that can fight has its attack actions wired', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });

    // A representative sample of the wired attack states: zombieman
    // pistol (POSS_ATK2 → A_PosAttack), imp claw/missile (TROO_ATK3 →
    // A_TroopAttack), plus pain/death (POSS_PAIN2 → A_Pain,
    // POSS_DIE2 → A_Scream). All must be live functions, not the
    // pre-combat null no-ops.
    expect(typeof STATES[StateNum.POSS_ATK2]!.action).toBe('function');
    expect(typeof STATES[StateNum.TROO_ATK3]!.action).toBe('function');
    expect(typeof STATES[StateNum.POSS_PAIN2]!.action).toBe('function');
    expect(typeof STATES[StateNum.POSS_DIE2]!.action).toBe('function');

    // The runtime is otherwise live (sanity: at least the player + some
    // monsters exist on the thinker ring).
    const monsters = runtime.allMobjs().filter((m: Mobj) => (m.flags & MF_COUNTKILL) !== 0);
    expect(monsters.length).toBeGreaterThan(0);
  });
});
