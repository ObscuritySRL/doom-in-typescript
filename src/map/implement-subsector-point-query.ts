/**
 * Vanilla DOOM 1.9 R_PointInSubsector BSP point-query contract.
 *
 * The BSP tree is walked starting at the last node (root). At each node the
 * partition line (x, y, dx, dy) determines which side (back=0, front=1) the
 * query point lies on. The child index for that side is followed; if its high
 * bit (0x8000) is set, the lower 15 bits identify a subsector and traversal
 * ends. Otherwise the descent continues at the referenced node.
 */

import type { NodeLump } from './parse-seg-ssector-node-reject-blockmap-lumps.ts';
import { VANILLA_NODE_SUBSECTOR_FLAG, isSubsectorChild, subsectorIndexFromChild } from './parse-seg-ssector-node-reject-blockmap-lumps.ts';

export interface SubsectorQueryInput {
  readonly nodes: readonly NodeLump[];
  readonly pointX: number;
  readonly pointY: number;
}

export function isPointOnFrontOfPartition(node: NodeLump, pointX: number, pointY: number): boolean {
  if (node.dx === 0) {
    if (pointX <= node.x) {
      return node.dy <= 0;
    }
    return node.dy >= 0;
  }
  if (node.dy === 0) {
    if (pointY <= node.y) {
      return node.dx >= 0;
    }
    return node.dx <= 0;
  }
  const deltaX = pointX - node.x;
  const deltaY = pointY - node.y;
  const cross = deltaX * node.dy - deltaY * node.dx;
  return cross >= 0;
}

export function queryPointSubsector(input: SubsectorQueryInput): number {
  if (input.nodes.length === 0) {
    return 0;
  }
  let childIndex = input.nodes.length - 1;
  while (!isSubsectorChild(childIndex)) {
    const node = input.nodes[childIndex];
    if (node === undefined) {
      throw new RangeError(`Invalid node index ${childIndex} during BSP descent`);
    }
    const onFront = isPointOnFrontOfPartition(node, input.pointX, input.pointY);
    childIndex = node.children[onFront ? 0 : 1];
  }
  return subsectorIndexFromChild(childIndex);
}

export { VANILLA_NODE_SUBSECTOR_FLAG };
