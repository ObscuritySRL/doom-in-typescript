/**
 * P_RadiusAttack and PIT_RadiusAttack from p_map.c.
 *
 * Applies explosive damage to all shootable things within range of an
 * explosion center, using Chebyshev distance with linear falloff.
 * Boss types (MT_CYBORG, MT_SPIDER) are immune. Line-of-sight is
 * required via a callback (defaults to always visible when omitted).
 *
 * @example
 * ```ts
 * import { radiusAttack } from "../src/world/radiusAttack.ts";
 * radiusAttack(missile, missile.target!, 128, mapData.blockmap, blocklinks, {
 *   checkSight: (a, b) => checkSight(a, b, mapData),
 *   damageMobj: (target, inflictor, source, dmg) => damageMobj(target, inflictor, source, dmg),
 * });
 * ```
 */

import { FRACBITS } from '../core/fixed.ts';

import { MAPBLOCKSHIFT } from '../map/blockmap.ts';
import type { Blockmap } from '../map/blockmap.ts';
import { MAXRADIUS } from '../map/mapSetup.ts';

import type { BlockThingsGrid, DamageMobjFunction } from './checkPosition.ts';
import { blockThingsIterator } from './checkPosition.ts';
import type { Mobj } from './mobj.ts';
import { MF_SHOOTABLE, MobjType } from './mobj.ts';

/** Callback matching P_CheckSight(looker, target). */
export type CheckSightFunction = (looker: Mobj, target: Mobj) => boolean;

/** Callbacks for radius attack side effects. */
export interface RadiusAttackCallbacks {
  checkSight?: CheckSightFunction;
  damageMobj?: DamageMobjFunction;
}

/**
 * Apply explosive damage to all shootable things in range.
 *
 * Matches P_RadiusAttack from Chocolate Doom's p_map.c exactly.
 * Computes blockmap bounds using `(damage + MAXRADIUS) << FRACBITS`
 * (int32 overflow intentional, matching C behavior), iterates all
 * block-things cells in range, and applies {@link pitRadiusAttack}
 * to each mobj found.
 *
 * @param spot - The center of the explosion (typically the exploding missile).
 * @param source - The originator of the attack (the player/thing that fired).
 * @param damage - Maximum damage at the center.
 * @param blockmap - The level's blockmap.
 * @param blocklinks - Per-cell mobj linked-list heads.
 * @param callbacks - Optional side-effect callbacks.
 */
export function radiusAttack(spot: Mobj, source: Mobj, damage: number, blockmap: Blockmap, blocklinks: BlockThingsGrid, callbacks?: RadiusAttackCallbacks): void {
  const dist = (damage + MAXRADIUS) << FRACBITS;

  const yh = (spot.y + dist - blockmap.originY) >> MAPBLOCKSHIFT;
  const yl = (spot.y - dist - blockmap.originY) >> MAPBLOCKSHIFT;
  const xh = (spot.x + dist - blockmap.originX) >> MAPBLOCKSHIFT;
  const xl = (spot.x - dist - blockmap.originX) >> MAPBLOCKSHIFT;

  const visit = (thing: Mobj): boolean => pitRadiusAttack(thing, spot, source, damage, callbacks);

  for (let y = yl; y <= yh; y++) {
    for (let x = xl; x <= xh; x++) {
      blockThingsIterator(x, y, blockmap, blocklinks, visit);
    }
  }
}

// ── PIT_RadiusAttack ──────────────────────────────────────────────────

/**
 * Per-thing callback for radius attack. Always returns true (never
 * stops iteration early), matching the C original.
 */
function pitRadiusAttack(thing: Mobj, bombspot: Mobj, bombsource: Mobj, bombdamage: number, callbacks?: RadiusAttackCallbacks): boolean {
  if (!(thing.flags & MF_SHOOTABLE)) return true;

  // Boss spider and cyborg take no damage from concussion.
  if (thing.type === MobjType.CYBORG || thing.type === MobjType.SPIDER) {
    return true;
  }

  // `| 0` truncates to int32 to match C signed subtraction wrap.
  const dx = Math.abs((thing.x - bombspot.x) | 0);
  const dy = Math.abs((thing.y - bombspot.y) | 0);

  let dist = dx > dy ? dx : dy;
  dist = (dist - thing.radius) >> FRACBITS;

  if (dist < 0) dist = 0;
  if (dist >= bombdamage) return true;

  if (callbacks?.checkSight?.(thing, bombspot) ?? true) {
    callbacks?.damageMobj?.(thing, bombspot, bombsource, bombdamage - dist);
  }

  return true;
}
