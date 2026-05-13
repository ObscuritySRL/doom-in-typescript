/**
 * Vanilla DOOM 1.9 blockmap things linking contract (P_SetThingPosition / P_UnsetThingPosition).
 *
 * Each thing belongs to at most one blockmap cell at a time. P_SetThingPosition
 * inserts the thing at the head of `blocklinks[cellIndex]`, and P_UnsetThingPosition
 * removes it by stitching the doubly-linked list. The cell is the result of
 * pointToBlockmapCell (06-007). Things outside the blockmap have no link.
 */

import type { BlockmapHeader } from './implement-blockmap-coordinate-conversion.ts';
import { VANILLA_BLOCKMAP_OUT_OF_RANGE, blockmapCellLinearIndex, pointToBlockmapCell } from './implement-blockmap-coordinate-conversion.ts';

export interface BlockLinkedThing {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface BlockLinkSet {
  readonly cellIndex: number;
  readonly memberIds: readonly number[];
}

export function computeBlockLinkSet(header: BlockmapHeader, things: readonly BlockLinkedThing[]): readonly BlockLinkSet[] {
  const cellToMembers = new Map<number, number[]>();
  for (const thing of things) {
    const cell = pointToBlockmapCell(header, thing.x, thing.y);
    const cellIndex = cell.inRange ? blockmapCellLinearIndex(header, cell.column, cell.row) : VANILLA_BLOCKMAP_OUT_OF_RANGE;
    if (cellIndex === VANILLA_BLOCKMAP_OUT_OF_RANGE) {
      continue;
    }
    const members = cellToMembers.get(cellIndex) ?? [];
    members.push(thing.id);
    cellToMembers.set(cellIndex, members);
  }
  const result: BlockLinkSet[] = [];
  for (const [cellIndex, memberIds] of [...cellToMembers.entries()].sort((leftEntry, rightEntry) => leftEntry[0] - rightEntry[0])) {
    result.push(Object.freeze({ cellIndex, memberIds: Object.freeze([...memberIds]) }));
  }
  return Object.freeze(result);
}
