/**
 * Subsector and sector query functions.
 *
 * Builds the subsector→sector lookup that Chocolate Doom computes in
 * P_GroupLines (p_setup.c) and provides a convenience query combining
 * BSP traversal with that lookup.
 *
 * @example
 * ```ts
 * import { buildSubsectorSectorMap, sectorIndexAt } from "../src/map/subsectorQuery.ts";
 * const subsectorSectors = buildSubsectorSectorMap(subsectors, segs, linedefs, sidedefs);
 * const sectorIndex = sectorIndexAt(playerX, playerY, nodes, subsectorSectors);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import type { MapNode, MapSeg, MapSubsector } from './bspStructs.ts';
import type { MapLinedef, MapSidedef } from './lineSectorGeometry.ts';
import { pointInSubsector } from './nodeTraversal.ts';

/**
 * Build a subsector-to-sector index lookup array.
 *
 * Reproduces the subsector→sector assignment from P_GroupLines in
 * Chocolate Doom's p_setup.c: each subsector's sector is the front
 * sector of its first seg, resolved through the seg→linedef→sidedef
 * chain.
 *
 * The chain for each subsector is:
 * 1. `subsector.firstseg` → seg
 * 2. `seg.linedef` → linedef
 * 3. `seg.side === 0 ? linedef.sidenum0 : linedef.sidenum1` → sidedef index
 * 4. `sidedef.sector` → sector index
 *
 * @param subsectors - Parsed SSECTORS lump.
 * @param segs - Parsed SEGS lump.
 * @param linedefs - Parsed LINEDEFS lump.
 * @param sidedefs - Parsed SIDEDEFS lump.
 * @returns Frozen array where index i is the sector index for subsector i.
 */
export function buildSubsectorSectorMap(subsectors: readonly MapSubsector[], segs: readonly MapSeg[], linedefs: readonly MapLinedef[], sidedefs: readonly MapSidedef[]): readonly number[] {
  const sectorMap: number[] = new Array(subsectors.length);

  for (let index = 0; index < subsectors.length; index++) {
    const subsector = subsectors[index]!;
    const firstSeg = segs[subsector.firstseg]!;
    const linedef = linedefs[firstSeg.linedef]!;
    const sidedefIndex = firstSeg.side === 0 ? linedef.sidenum0 : linedef.sidenum1;
    sectorMap[index] = sidedefs[sidedefIndex]!.sector;
  }

  return Object.freeze(sectorMap);
}

/**
 * Find the sector index at a given map coordinate.
 *
 * Combines BSP traversal (R_PointInSubsector) with the pre-computed
 * subsector→sector mapping to replicate the common Doom pattern:
 * `R_PointInSubsector(x, y)->sector`.
 *
 * @param x - Point X in 16.16 fixed-point.
 * @param y - Point Y in 16.16 fixed-point.
 * @param nodes - Parsed BSP node array.
 * @param subsectorSectors - Pre-computed subsector→sector lookup from buildSubsectorSectorMap.
 * @returns Sector index.
 */
export function sectorIndexAt(x: Fixed, y: Fixed, nodes: readonly MapNode[], subsectorSectors: readonly number[]): number {
  const subsectorIndex = pointInSubsector(x, y, nodes);
  return subsectorSectors[subsectorIndex]!;
}
