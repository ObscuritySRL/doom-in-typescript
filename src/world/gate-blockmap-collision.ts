/**
 * Gate step 06-029: assert blockmap collision primitives are present.
 *
 * The gate captures the contract for vanilla DOOM 1.9 blockmap-driven
 * collision: P_BlockLinesIterator + P_BoxOnLineSide + validcount stamping
 * must produce consistent results against the loaded blockmap.
 *
 * This module re-exports the runtime knobs that must remain stable for
 * collision parity. A change in any constant means downstream collision
 * behavior may have drifted from vanilla and parity oracles must rerun.
 */

import { MAPBLOCKSHIFT, MAPBLOCKSIZE, MAPBTOFRAC } from '../map/blockmap.ts';
import { MAXRADIUS } from '../map/mapSetup.ts';

export const BLOCKMAP_COLLISION_GATE = Object.freeze({
  // Block grid stride in fixed-point units (128 << 16 = 128 map units).
  mapBlockSizeFixed: MAPBLOCKSIZE,
  // log2(MAPBLOCKSIZE/FRACUNIT) = 7; matches vanilla MAPBLOCKSHIFT.
  mapBlockShift: MAPBLOCKSHIFT,
  // Fractional conversion from blockmap units to fixed.
  mapBlockToFrac: MAPBTOFRAC,
  // Largest mobj radius the blockmap can resolve via standard iteration (32 map units).
  maxRadiusMapUnits: MAXRADIUS,
} as const);

export type BlockmapCollisionGate = typeof BLOCKMAP_COLLISION_GATE;
