/**
 * Teleportation logic (p_telept.c, P_TeleportMove from p_map.c).
 *
 * {@link evTeleport} handles linedef-triggered teleportation: finding
 * the MT_TELEPORTMAN destination in a tag-matched sector, relocating
 * the thing via {@link teleportMove}, spawning fog at source and
 * destination, zeroing momentum, and freezing the player briefly.
 *
 * {@link teleportMove} handles the physical relocation: sector lookup,
 * floor/ceiling update, PIT_StompThing (telefrag), and position
 * link/unlink via callbacks.
 *
 * @example
 * ```ts
 * import { evTeleport } from "../src/world/teleport.ts";
 * const didTeleport = evTeleport(lineTag, 0, thing, mapData, blocklinks, thinkerList, rng);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';
import { ANGLETOFINESHIFT, finecosine, finesine, FINEMASK } from '../core/trig.ts';
import { MAPBLOCKSHIFT } from '../map/blockmap.ts';
import type { MapData } from '../map/mapSetup.ts';
import { MAXRADIUS } from '../map/mapSetup.ts';
import { sectorIndexAt } from '../map/subsectorQuery.ts';
import { blockThingsIterator } from './checkPosition.ts';
import type { BlockThingsGrid } from './checkPosition.ts';
import type { Mobj } from './mobj.ts';
import { MF_MISSILE, MF_SHOOTABLE, MobjType, ONFLOORZ, mobjThinker, spawnMobj } from './mobj.ts';
import type { ThinkerList, ThinkerNode } from './thinkers.ts';

/** Teleport fog offset distance (20 map units in fixed-point). */
export const TELEFOG_DELTA: Fixed = (20 * FRACUNIT) | 0;

/** Telefrag damage (10000 hit points). */
export const TELEFRAG_DAMAGE = 10_000;

/** Player freeze duration after teleporting (18 tics). */
export const TELEPORT_REACTIONTIME = 18;

// ── Callbacks ────────────────────────────────────────────────────────

/** Callback matching P_DamageMobj signature for telefrag. */
export type DamageMobjFunction = (target: Mobj, inflictor: Mobj | null, source: Mobj | null, damage: number) => void;

/** Callback for S_StartSound. */
export type StartSoundFunction = (origin: Mobj, soundId: number) => void;

/**
 * Optional callbacks for operations that depend on later-step
 * infrastructure. When absent, the corresponding side effect is
 * skipped but the core algorithm remains correct.
 */
export interface TeleportCallbacks {
  /** Unlink mobj from sector/blockmap lists. */
  unsetThingPosition?: (thing: Mobj) => void;
  /** Link mobj into sector/blockmap lists at its current position. */
  setThingPosition?: (thing: Mobj) => void;
  /** Apply telefrag damage (P_DamageMobj). */
  damageMobj?: DamageMobjFunction;
  /** Play sound effect at an entity. */
  startSound?: StartSoundFunction;
  /**
   * Whether this is the boss map (MAP30 in Doom 2). Monsters can
   * only telefrag on boss maps. Default false.
   */
  isBossMap?: boolean;
}

// ── PIT_StompThing ───────────────────────────────────────────────────

/**
 * PIT_StompThing: telefrag check for a single mobj at the teleport
 * destination.
 *
 * Matches PIT_StompThing from Chocolate Doom's p_map.c exactly:
 *
 * 1. Skip non-shootable things.
 * 2. Check bounding-box overlap (blockdist).
 * 3. Skip self.
 * 4. Monsters cannot stomp except on boss maps (MAP30).
 * 5. Apply {@link TELEFRAG_DAMAGE} via damageMobj callback.
 *
 * @param other - Candidate mobj in the blockmap cell.
 * @param thing - The mobj being teleported.
 * @param destX - Destination X in fixed-point.
 * @param destY - Destination Y in fixed-point.
 * @param callbacks - Optional damage callback and boss-map flag.
 * @returns true to continue iterating, false to abort (stomp blocked).
 */
export function pitStompThing(other: Mobj, thing: Mobj, destX: Fixed, destY: Fixed, callbacks: TeleportCallbacks = {}): boolean {
  if ((other.flags & MF_SHOOTABLE) === 0) {
    return true;
  }

  const blockdist = (other.radius + thing.radius) | 0;
  const deltaX = other.x - destX;
  const deltaY = other.y - destY;
  if ((deltaX < 0 ? -deltaX : deltaX) >= blockdist || (deltaY < 0 ? -deltaY : deltaY) >= blockdist) {
    return true;
  }

  if (other === thing) {
    return true;
  }

  // Monsters cannot stomp things except on the boss map (MAP30).
  if (thing.player === null && callbacks.isBossMap !== true) {
    return false;
  }

  callbacks.damageMobj?.(other, thing, thing, TELEFRAG_DAMAGE);
  return true;
}

// ── P_TeleportMove ───────────────────────────────────────────────────

/**
 * P_TeleportMove: unconditional positional move with telefrag.
 *
 * Unlike P_TryMove, this ignores height restrictions, line blocking,
 * and step-up limits. It stomps (telefrags) any shootable things at
 * the destination and repositions the thing.
 *
 * Matches P_TeleportMove from Chocolate Doom's p_map.c exactly:
 *
 * 1. Find the destination subsector/sector for floor/ceiling heights.
 * 2. Iterate blockmap cells (expanded by MAXRADIUS) for thing overlap
 *    via {@link pitStompThing}.
 * 3. Unlink, update position and floor/ceiling, relink.
 *
 * @param thing - The mobj being teleported.
 * @param x - Destination X in fixed-point.
 * @param y - Destination Y in fixed-point.
 * @param mapData - Parsed map data.
 * @param blocklinks - Block things grid.
 * @param callbacks - Optional position and damage callbacks.
 * @returns true if the move succeeded, false if stomping was blocked.
 *
 * @example
 * ```ts
 * import { teleportMove } from "../src/world/teleport.ts";
 * const ok = teleportMove(thing, destX, destY, mapData, blocklinks);
 * ```
 */
export function teleportMove(thing: Mobj, x: Fixed, y: Fixed, mapData: MapData, blocklinks: BlockThingsGrid, callbacks: TeleportCallbacks = {}): boolean {
  const sectorIndex = sectorIndexAt(x, y, mapData.nodes, mapData.subsectorSectors);
  const sector = mapData.sectors[sectorIndex]!;
  const tmfloorz = sector.floorheight;
  const tmceilingz = sector.ceilingheight;

  const blockmap = mapData.blockmap;
  const radius = thing.radius;
  const bboxLeft = (x - radius) | 0;
  const bboxRight = (x + radius) | 0;
  const bboxBottom = (y - radius) | 0;
  const bboxTop = (y + radius) | 0;

  const xl = ((bboxLeft - blockmap.originX - MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
  const xh = ((bboxRight - blockmap.originX + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
  const yl = ((bboxBottom - blockmap.originY - MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
  const yh = ((bboxTop - blockmap.originY + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;

  for (let bx = xl; bx <= xh; bx++) {
    for (let by = yl; by <= yh; by++) {
      if (!blockThingsIterator(bx, by, blockmap, blocklinks, (other) => pitStompThing(other, thing, x, y, callbacks))) {
        return false;
      }
    }
  }

  callbacks.unsetThingPosition?.(thing);

  thing.floorz = tmfloorz;
  thing.ceilingz = tmceilingz;
  thing.x = x;
  thing.y = y;

  callbacks.setThingPosition?.(thing);

  return true;
}

// ── EV_Teleport ──────────────────────────────────────────────────────

/**
 * EV_Teleport: line-triggered teleportation.
 *
 * Matches EV_Teleport from Chocolate Doom's p_telept.c exactly:
 *
 * 1. Reject missiles (MF_MISSILE).
 * 2. Reject back-side activation (side === 1) so players can walk
 *    out of a teleporter.
 * 3. Find the first MT_TELEPORTMAN in a sector whose tag matches
 *    the triggering linedef's tag.
 * 4. Call {@link teleportMove} to relocate with telefrag.
 * 5. Set z to floor height.
 * 6. Spawn teleport fog at source (old position) and destination
 *    (offset by 20 units along the destination's angle).
 * 7. Zero all momentum.
 * 8. Set angle to the destination marker's angle.
 * 9. Freeze the player for {@link TELEPORT_REACTIONTIME} tics.
 *
 * @param lineTag - Tag of the triggering linedef.
 * @param side - Side of the linedef crossed (0 = front, 1 = back).
 * @param thing - The mobj being teleported.
 * @param mapData - Parsed map data (sectors searched by tag).
 * @param blocklinks - Block things grid for telefrag.
 * @param thinkerList - Active thinker list (searched for MT_TELEPORTMAN).
 * @param rng - RNG instance for fog spawn.
 * @param callbacks - Optional position, damage, and sound callbacks.
 * @returns true if the teleport succeeded, false otherwise.
 *
 * @example
 * ```ts
 * import { evTeleport } from "../src/world/teleport.ts";
 * const ok = evTeleport(lineTag, 0, thing, mapData, blocklinks, thinkerList, rng);
 * ```
 */
export function evTeleport(lineTag: number, side: number, thing: Mobj, mapData: MapData, blocklinks: BlockThingsGrid, thinkerList: ThinkerList, rng: DoomRandom, callbacks: TeleportCallbacks = {}): boolean {
  if ((thing.flags & MF_MISSILE) !== 0) {
    return false;
  }

  if (side === 1) {
    return false;
  }

  const sectors = mapData.sectors;
  let found = false;

  for (let i = 0; i < sectors.length && !found; i++) {
    if (sectors[i]!.tag !== lineTag) {
      continue;
    }

    thinkerList.forEach((thinker: ThinkerNode) => {
      if (found) {
        return;
      }

      if (thinker.action !== mobjThinker) {
        return;
      }

      const destination = thinker as Mobj;

      if (destination.type !== MobjType.TELEPORTMAN) {
        return;
      }

      const destinationSector = sectorIndexAt(destination.x, destination.y, mapData.nodes, mapData.subsectorSectors);
      if (destinationSector !== i) {
        return;
      }

      const oldx = thing.x;
      const oldy = thing.y;
      const oldz = thing.z;

      if (!teleportMove(thing, destination.x, destination.y, mapData, blocklinks, callbacks)) {
        return;
      }

      // Chocolate Doom 2.2.1 (not exe_final): always set z to floorz.
      thing.z = thing.floorz;

      // Spawn teleport fog at the source position.
      spawnMobj(oldx, oldy, oldz, MobjType.TFOG, rng, thinkerList);

      // Spawn teleport fog at the destination, offset 20 units
      // along the destination marker's angle.
      const fineAngle = (destination.angle >>> ANGLETOFINESHIFT) & FINEMASK;
      const fogX = (destination.x + 20 * finecosine[fineAngle]!) | 0;
      const fogY = (destination.y + 20 * finesine[fineAngle]!) | 0;
      spawnMobj(fogX, fogY, thing.z, MobjType.TFOG, rng, thinkerList);

      // Freeze the player briefly after teleporting.
      if (thing.player !== null) {
        thing.reactiontime = TELEPORT_REACTIONTIME;
      }

      thing.angle = destination.angle;
      thing.momx = 0;
      thing.momy = 0;
      thing.momz = 0;

      found = true;
    });
  }

  return found;
}
