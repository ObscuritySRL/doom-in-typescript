/**
 * P_ThingHeightClip and P_ChangeSector from p_map.c.
 *
 * Handles vertical re-clipping of mobjs when a sector's floor or ceiling
 * height changes, and applies crush logic to things that no longer fit.
 *
 * @example
 * ```ts
 * import { changeSector } from "../src/world/sectorChange.ts";
 * const nofit = changeSector(sectorIndex, true, leveltime, mapData, blocklinks, rng, thinkerList);
 * ```
 */

import type { DoomRandom } from '../core/rng.ts';

import type { GameVersion } from '../bootstrap/gameMode.ts';

import { BOXBOTTOM, BOXLEFT, BOXRIGHT, BOXTOP } from '../map/lineSectorGeometry.ts';
import type { MapData } from '../map/mapSetup.ts';

import type { BlockThingsGrid, CheckPositionCallbacks, DamageMobjFunction } from './checkPosition.ts';
import { blockThingsIterator, checkPosition } from './checkPosition.ts';
import type { Mobj } from './mobj.ts';
import { MF_DROPPED, MF_SHOOTABLE, MF_SOLID, MobjType, StateNum, removeMobj, setMobjState, spawnMobj } from './mobj.ts';
import type { ThinkerList } from './thinkers.ts';

// ── Callbacks ─────────────────────────────────────────────────────────

/** Side-effect callbacks for P_ChangeSector. */
export interface ChangeSectorCallbacks extends CheckPositionCallbacks {
  /** Called for crush damage on living shootable things. */
  damageMobj?: DamageMobjFunction;
}

// ── P_ThingHeightClip ─────────────────────────────────────────────────

/**
 * P_ThingHeightClip: re-check an mobj's vertical fit after a sector
 * floor/ceiling change.
 *
 * Calls P_CheckPosition at the thing's current (x, y) to recompute
 * floorz and ceilingz. Things standing on the floor follow it;
 * floating things are clamped down only if they exceed the new ceiling.
 *
 * @returns `true` if the thing still fits (clearance >= height),
 *          `false` if it is being crushed.
 */
export function thingHeightClip(thing: Mobj, mapData: MapData, blocklinks: BlockThingsGrid, callbacks: CheckPositionCallbacks = {}): boolean {
  const onfloor = thing.z === thing.floorz;

  const result = checkPosition(thing, thing.x, thing.y, mapData, blocklinks, callbacks);

  thing.floorz = result.floorz;
  thing.ceilingz = result.ceilingz;

  if (onfloor) {
    thing.z = thing.floorz;
  } else {
    if (thing.z + thing.height > thing.ceilingz) {
      thing.z = thing.ceilingz - thing.height;
    }
  }

  return thing.ceilingz - thing.floorz >= thing.height;
}

// ── P_ChangeSector ────────────────────────────────────────────────────

/** Crush damage applied per hit: 10 HP. */
const CRUSH_DAMAGE = 10;

/**
 * P_ChangeSector: re-clip all things in a sector after its floor or
 * ceiling height changes.
 *
 * Iterates the sector's blockmap bounding box and applies
 * PIT_ChangeSector logic to every mobj found:
 *
 * - Things that still fit are left alone.
 * - Dead bodies (health <= 0) are converted to gibs (S_GIBS), made
 *   non-solid, and have their height and radius zeroed.
 * - Dropped items (MF_DROPPED) are removed entirely.
 * - Non-shootable things are ignored (assumed to be decorative gibs).
 * - Living shootable things that do not fit set `nofit = true`.
 *   If `crunch` is true and `leveltime & 3` is zero, they take 10
 *   crush damage and a blood mobj is spawned with random momentum.
 *
 * Parity-critical details:
 * - Gibs MF_SOLID clear is version-dependent: skipped on exe_doom_1_2,
 *   applied on all later versions.
 * - Crush damage fires every 4 tics (`!(leveltime & 3)`).
 * - Blood spawns at `thing.z + thing.height / 2` (integer division).
 * - Blood momentum: `P_SubRandom() << 12` per axis.
 * - PIT_ChangeSector always returns true (never stops iteration).
 *
 * @param sectorIndex - Index into mapData.sectorGroups.
 * @param crunch - Whether active crushing is occurring (damage + blood).
 * @param leveltime - Current level tic count (for damage throttle).
 * @param mapData - The loaded map data.
 * @param blocklinks - The blockmap thing grid.
 * @param rng - The game's RNG instance.
 * @param thinkerList - The active thinker list.
 * @param gameVersion - Game version for version-dependent behavior.
 * @param callbacks - Optional side-effect callbacks.
 * @returns `true` if any living shootable thing could not fit (nofit).
 */
export function changeSector(
  sectorIndex: number,
  crunch: boolean,
  leveltime: number,
  mapData: MapData,
  blocklinks: BlockThingsGrid,
  rng: DoomRandom,
  thinkerList: ThinkerList,
  gameVersion: GameVersion = 'exe_doom_1_9',
  callbacks: ChangeSectorCallbacks = {},
): boolean {
  let nofit = false;

  const sectorGroup = mapData.sectorGroups[sectorIndex]!;
  const blockbox = sectorGroup.blockbox;

  for (let x = blockbox[BOXLEFT]; x <= blockbox[BOXRIGHT]; x++) {
    for (let y = blockbox[BOXBOTTOM]; y <= blockbox[BOXTOP]; y++) {
      blockThingsIterator(x, y, mapData.blockmap, blocklinks, (thing: Mobj): boolean => {
        // ── PIT_ChangeSector ────────────────────────────────
        if (thingHeightClip(thing, mapData, blocklinks, callbacks)) {
          return true;
        }

        // Crunch bodies to giblets.
        if (thing.health <= 0) {
          setMobjState(thing, StateNum.GIBS, thinkerList);

          if (gameVersion !== 'exe_doom_1_2') {
            thing.flags &= ~MF_SOLID;
          }
          thing.height = 0;
          thing.radius = 0;

          return true;
        }

        // Crunch dropped items.
        if (thing.flags & MF_DROPPED) {
          removeMobj(thing, thinkerList);
          return true;
        }

        if (!(thing.flags & MF_SHOOTABLE)) {
          return true;
        }

        nofit = true;

        if (crunch && !(leveltime & 3)) {
          if (callbacks.damageMobj) {
            callbacks.damageMobj(thing, null, null, CRUSH_DAMAGE);
          }

          // Spray blood in a random direction.
          const blood = spawnMobj(thing.x, thing.y, thing.z + (thing.height >> 1), MobjType.BLOOD, rng, thinkerList);

          blood.momx = rng.pSubRandom() << 12;
          blood.momy = rng.pSubRandom() << 12;
        }

        return true;
      });
    }
  }

  return nofit;
}
