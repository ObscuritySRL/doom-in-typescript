/**
 * Vanilla DOOM 1.9 R_RenderBSPNode traversal contract.
 *
 * The renderer walks the BSP recursively. At each node, the partition side
 * containing the viewer (front) is drawn FIRST so closer geometry occludes
 * farther geometry. After the front side finishes, R_CheckBBox tests the
 * back side bounding box against the cliprange; only if the bbox is visible
 * is the back subtree descended.
 */

import type { NodeLump } from './parse-seg-ssector-node-reject-blockmap-lumps.ts';
import { isPointOnFrontOfPartition } from './implement-subsector-point-query.ts';
import { isSubsectorChild, subsectorIndexFromChild } from './parse-seg-ssector-node-reject-blockmap-lumps.ts';

export type BspVisit = { readonly kind: 'subsector'; readonly index: number } | { readonly kind: 'node-enter'; readonly index: number } | { readonly kind: 'node-leave'; readonly index: number };

export interface BspTraversalInput {
  readonly nodes: readonly NodeLump[];
  readonly viewerX: number;
  readonly viewerY: number;
}

export function traverseBspFrontToBack(input: BspTraversalInput): readonly BspVisit[] {
  if (input.nodes.length === 0) {
    return Object.freeze([]);
  }
  const visits: BspVisit[] = [];
  const visit = (childIndex: number): void => {
    if (isSubsectorChild(childIndex)) {
      visits.push(Object.freeze({ kind: 'subsector' as const, index: subsectorIndexFromChild(childIndex) }));
      return;
    }
    const node = input.nodes[childIndex];
    if (node === undefined) {
      throw new RangeError(`Invalid node index ${childIndex}`);
    }
    visits.push(Object.freeze({ kind: 'node-enter' as const, index: childIndex }));
    const onFront = isPointOnFrontOfPartition(node, input.viewerX, input.viewerY);
    const frontChild = node.children[onFront ? 0 : 1];
    const backChild = node.children[onFront ? 1 : 0];
    visit(frontChild);
    visit(backChild);
    visits.push(Object.freeze({ kind: 'node-leave' as const, index: childIndex }));
  };
  visit(input.nodes.length - 1);
  return Object.freeze(visits);
}
