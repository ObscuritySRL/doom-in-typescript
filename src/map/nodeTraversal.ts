/**
 * BSP point-on-side and node traversal functions.
 *
 * Implements R_PointOnSide, R_PointOnSegSide, and R_PointInSubsector
 * from Chocolate Doom's r_main.c, reproducing the exact classification
 * logic including axis-aligned fast paths, sign-bit quick-reject, and
 * FixedMul cross-product fallback.
 *
 * @example
 * ```ts
 * import { pointOnSide, pointInSubsector } from "../src/map/nodeTraversal.ts";
 * const side = pointOnSide(playerX, playerY, nodes[rootNode]);
 * const subsectorIndex = pointInSubsector(playerX, playerY, nodes);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, fixedMul } from '../core/fixed.ts';
import type { MapNode } from './bspStructs.ts';
import { NF_SUBSECTOR } from './bspStructs.ts';

/**
 * Determine which side of a BSP partition line a point falls on.
 *
 * Reproduces R_PointOnSide from Chocolate Doom's r_main.c exactly:
 *
 * 1. If the partition is vertical (dx === 0), the result depends on
 *    whether x <= node.x, inverted by the sign of dy.
 * 2. If the partition is horizontal (dy === 0), the result depends on
 *    whether y <= node.y, inverted by the sign of dx.
 * 3. A sign-bit XOR test quickly classifies many cases without
 *    multiplication.
 * 4. Fallback: cross-product via FixedMul of truncated operands.
 *
 * @param x - Point X in 16.16 fixed-point.
 * @param y - Point Y in 16.16 fixed-point.
 * @param node - BSP node whose partition line to test against.
 * @returns 0 for front (right) side, 1 for back (left) side.
 */
export function pointOnSide(x: Fixed, y: Fixed, node: MapNode): 0 | 1 {
  if (node.dx === 0) {
    if (x <= node.x) {
      return node.dy > 0 ? 1 : 0;
    }
    return node.dy < 0 ? 1 : 0;
  }

  if (node.dy === 0) {
    if (y <= node.y) {
      return node.dx < 0 ? 1 : 0;
    }
    return node.dx > 0 ? 1 : 0;
  }

  const dx = (x - node.x) | 0;
  const dy = (y - node.y) | 0;

  // Sign-bit quick-reject: if the four-way XOR has the sign bit set,
  // then the signs are mixed and we can decide immediately.
  if (((node.dy ^ node.dx ^ dx ^ dy) & 0x80000000) !== 0) {
    if (((node.dy ^ dx) & 0x80000000) !== 0) {
      return 1;
    }
    return 0;
  }

  const left = fixedMul(node.dy >> FRACBITS, dx);
  const right = fixedMul(dy, node.dx >> FRACBITS);

  if (right < left) {
    return 0;
  }
  return 1;
}

/**
 * Determine which side of a seg a point falls on.
 *
 * Reproduces R_PointOnSegSide from Chocolate Doom's r_main.c exactly.
 * Same algorithm as pointOnSide but parameterized by a line defined
 * by origin (lx, ly) and delta (ldx, ldy) rather than a MapNode.
 *
 * @param x - Point X in 16.16 fixed-point.
 * @param y - Point Y in 16.16 fixed-point.
 * @param lx - Line origin X in 16.16 fixed-point.
 * @param ly - Line origin Y in 16.16 fixed-point.
 * @param ldx - Line delta X in 16.16 fixed-point.
 * @param ldy - Line delta Y in 16.16 fixed-point.
 * @returns 0 for front (right) side, 1 for back (left) side.
 */
export function pointOnSegSide(x: Fixed, y: Fixed, lx: Fixed, ly: Fixed, ldx: Fixed, ldy: Fixed): 0 | 1 {
  if (ldx === 0) {
    if (x <= lx) {
      return ldy > 0 ? 1 : 0;
    }
    return ldy < 0 ? 1 : 0;
  }

  if (ldy === 0) {
    if (y <= ly) {
      return ldx < 0 ? 1 : 0;
    }
    return ldx > 0 ? 1 : 0;
  }

  const dx = (x - lx) | 0;
  const dy = (y - ly) | 0;

  if (((ldy ^ ldx ^ dx ^ dy) & 0x80000000) !== 0) {
    if (((ldy ^ dx) & 0x80000000) !== 0) {
      return 1;
    }
    return 0;
  }

  const left = fixedMul(ldy >> FRACBITS, dx);
  const right = fixedMul(dy, ldx >> FRACBITS);

  if (right < left) {
    return 0;
  }
  return 1;
}

/**
 * Find the subsector index containing a given point by walking the
 * BSP tree.
 *
 * Reproduces R_PointInSubsector from Chocolate Doom's r_main.c.
 * Starts at the root node (numnodes - 1) and descends by calling
 * pointOnSide at each internal node until a leaf (subsector) is
 * reached, indicated by the NF_SUBSECTOR flag in the child index.
 *
 * @param x - Point X in 16.16 fixed-point.
 * @param y - Point Y in 16.16 fixed-point.
 * @param nodes - Parsed BSP node array.
 * @returns Subsector index (with NF_SUBSECTOR flag stripped).
 */
export function pointInSubsector(x: Fixed, y: Fixed, nodes: readonly MapNode[]): number {
  if (nodes.length === 0) {
    return 0;
  }

  let nodeNumber = nodes.length - 1;

  while ((nodeNumber & NF_SUBSECTOR) === 0) {
    const node = nodes[nodeNumber]!;
    const side = pointOnSide(x, y, node);
    nodeNumber = node.children[side];
  }

  return nodeNumber & ~NF_SUBSECTOR;
}
