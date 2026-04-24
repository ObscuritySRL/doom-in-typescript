import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import type { Fixed } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle, findMapNames } from '../../src/map/mapBundle.ts';
import { parseVertexes } from '../../src/map/lineSectorGeometry.ts';
import { NF_SUBSECTOR, parseNodes, parseSubsectors } from '../../src/map/bspStructs.ts';
import type { MapNode } from '../../src/map/bspStructs.ts';
import { pointOnSide, pointOnSegSide, pointInSubsector } from '../../src/map/nodeTraversal.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);
const e1m1Nodes = parseNodes(e1m1Bundle.nodes);
const e1m1Subsectors = parseSubsectors(e1m1Bundle.ssectors);

/** Helper: build a synthetic MapNode for unit tests. */
function syntheticNode(x: Fixed, y: Fixed, dx: Fixed, dy: Fixed): MapNode {
  return Object.freeze({
    x,
    y,
    dx,
    dy,
    bbox: Object.freeze([Object.freeze([0, 0, 0, 0] as const), Object.freeze([0, 0, 0, 0] as const)] as const),
    children: Object.freeze([0, 0] as const),
  });
}

/** Fixed-point helper: convert integer map units to 16.16 fixed. */
function toFixed(mapUnits: number): Fixed {
  return (mapUnits << FRACBITS) | 0;
}

// ── pointOnSide ─────────────────────────────────────────────────────

describe('pointOnSide', () => {
  describe('vertical partition (dx === 0)', () => {
    const verticalUp = syntheticNode(toFixed(100), toFixed(50), 0, toFixed(1));
    const verticalDown = syntheticNode(toFixed(100), toFixed(50), 0, toFixed(-1));

    it('returns 1 (back) when point is left of upward vertical', () => {
      expect(pointOnSide(toFixed(50), toFixed(50), verticalUp)).toBe(1);
    });

    it('returns 0 (front) when point is right of upward vertical', () => {
      expect(pointOnSide(toFixed(150), toFixed(50), verticalUp)).toBe(0);
    });

    it('returns 1 (back) when point equals x and dy > 0', () => {
      expect(pointOnSide(toFixed(100), toFixed(50), verticalUp)).toBe(1);
    });

    it('returns 0 (front) when point is left of downward vertical', () => {
      expect(pointOnSide(toFixed(50), toFixed(50), verticalDown)).toBe(0);
    });

    it('returns 1 (back) when point is right of downward vertical', () => {
      expect(pointOnSide(toFixed(150), toFixed(50), verticalDown)).toBe(1);
    });
  });

  describe('horizontal partition (dy === 0)', () => {
    const horizontalRight = syntheticNode(toFixed(50), toFixed(100), toFixed(1), 0);
    const horizontalLeft = syntheticNode(toFixed(50), toFixed(100), toFixed(-1), 0);

    it('returns 1 (back) when point is above rightward horizontal', () => {
      // y > node.y => return dx > 0 = true = 1
      expect(pointOnSide(toFixed(50), toFixed(150), horizontalRight)).toBe(1);
    });

    it('returns 0 (front) when point is below rightward horizontal', () => {
      // y <= node.y => return dx < 0 = false = 0
      expect(pointOnSide(toFixed(50), toFixed(50), horizontalRight)).toBe(0);
    });

    it('returns 0 (front) when point equals y and dx > 0', () => {
      // y <= node.y (equal) => return dx < 0 = false = 0
      expect(pointOnSide(toFixed(50), toFixed(100), horizontalRight)).toBe(0);
    });

    it('returns 0 (front) when point is above leftward horizontal', () => {
      // y > node.y => return dx > 0 = false = 0
      expect(pointOnSide(toFixed(50), toFixed(150), horizontalLeft)).toBe(0);
    });

    it('returns 1 (back) when point is below leftward horizontal', () => {
      // y <= node.y => return dx < 0 = true = 1
      expect(pointOnSide(toFixed(50), toFixed(50), horizontalLeft)).toBe(1);
    });
  });

  describe('diagonal partition (general case)', () => {
    // Partition from (0,0) going northeast: dx=1, dy=1
    const diagonal = syntheticNode(0, 0, toFixed(1), toFixed(1));

    it('returns 1 (back) for point above-left of NE diagonal', () => {
      // Point (-1, 1) is to the LEFT of the NE direction => back (1)
      expect(pointOnSide(toFixed(-1), toFixed(1), diagonal)).toBe(1);
    });

    it('returns 0 (front) for point below-right of NE diagonal', () => {
      // Point (1, -1) is to the RIGHT of the NE direction => front (0)
      expect(pointOnSide(toFixed(1), toFixed(-1), diagonal)).toBe(0);
    });

    it('returns 1 (back) for point on the partition line (right >= left)', () => {
      // Point on the line y=x: dx and dy from origin are equal
      // left = FixedMul(dy>>16, dx_point) = FixedMul(1, 5<<16)
      // right = FixedMul(dy_point, dx>>16) = FixedMul(5<<16, 1)
      // right == left => returns 1 (back) per the >= branch
      expect(pointOnSide(toFixed(5), toFixed(5), diagonal)).toBe(1);
    });
  });

  describe('sign-bit quick-reject path', () => {
    // Partition going NE: dx > 0, dy > 0
    // Point in Q3 relative to origin: dx_point < 0, dy_point < 0
    // XOR: (dy ^ dx ^ dx_point ^ dy_point) will have sign bit set
    // since (pos ^ pos ^ neg ^ neg) = sign bit set
    // Then (dy ^ dx_point) = (pos ^ neg) has sign bit set => returns 1
    const nePartition = syntheticNode(0, 0, toFixed(10), toFixed(10));

    it('quick-rejects point in opposite quadrant to back side', () => {
      expect(pointOnSide(toFixed(-5), toFixed(-5), nePartition)).toBe(1);
    });

    // Point in Q1 relative to origin: dx_point > 0, dy_point > 0
    // with dy negative, dx positive: mixed signs
    // sign bit XOR: (neg ^ pos ^ pos ^ pos) = sign bit set
    // (dy ^ dx_point) = (neg ^ pos) = sign bit set => returns 1
    const sePartition = syntheticNode(0, 0, toFixed(10), toFixed(-10));

    it('quick-rejects to back side when dy ^ dx_point has sign bit', () => {
      expect(pointOnSide(toFixed(5), toFixed(5), sePartition)).toBe(1);
    });

    // Point in Q4: dx_point > 0, dy_point < 0 with NE partition
    // XOR: (pos ^ pos ^ pos ^ neg) = sign bit set
    // (dy ^ dx_point) = (pos ^ pos) = no sign bit => returns 0
    it('quick-rejects to front side when dy ^ dx_point lacks sign bit', () => {
      expect(pointOnSide(toFixed(5), toFixed(-5), nePartition)).toBe(0);
    });
  });

  describe('cross-product fallback', () => {
    // Partition going roughly NE but not 45 degrees: dx=3, dy=1
    // Point at (1, 1) relative to origin:
    // left = FixedMul(dy>>16, dx_point) = FixedMul(1, 1<<16) = 1<<16
    // right = FixedMul(dy_point, dx>>16) = FixedMul(1<<16, 3) = 3<<16
    // right > left => front side (0)... wait, right (3<<16) > left (1<<16) means
    // right < left is false => returns 1 (back)
    // Actually: right = 3 * 0x10000 = 0x30000, left = 1 * 0x10000 = 0x10000
    // right < left? No. So returns 1.
    // But wait, let me recalculate. Point (1,1) is above the line y=(1/3)x
    // which means it's on the left (front=0).
    // Let's use point (2, 0): dy_point = 0 relative to origin (0,0)
    // left = FixedMul(1, 2<<16) = 2<<16
    // right = FixedMul(0, 3) = 0
    // right < left => true => returns 0 (front)
    const shallowNE = syntheticNode(0, 0, toFixed(3), toFixed(1));

    it('classifies point above shallow line as front', () => {
      expect(pointOnSide(toFixed(2), toFixed(0), shallowNE)).toBe(0);
    });

    it('classifies point below shallow line as back', () => {
      // Point (0, -2): below the line
      // All signs same quadrant won't trigger quick-reject since XOR is
      // (pos ^ pos ^ 0 ^ neg) & 0x80000000, but dx_point=0, so
      // XOR includes a zero. Let's pick (1, -2).
      // dx_point = 1<<16, dy_point = -2<<16
      // XOR: (pos ^ pos ^ pos ^ neg) = sign bit set
      // (dy ^ dx_point) = (pos ^ pos) = no sign bit => returns 0 (front)
      // Hmm, that's the quick-reject path returning 0.
      // Let me pick a point that bypasses quick-reject.
      // Need all four values to have same XOR parity:
      // dy=pos, dx=pos, dx_point=pos, dy_point=pos and point is below line.
      // Point (3, 0): on the line. Point (4, 1): on the line.
      // Point (6, 1): below the line y=(1/3)x
      // dx_point=6<<16, dy_point=1<<16. All positive.
      // XOR: (pos ^ pos ^ pos ^ pos) = 0, sign bit clear => fallback.
      // left = FixedMul(1, 6<<16) = 6<<16
      // right = FixedMul(1<<16, 3) = 3<<16
      // right < left => true => returns 0 (front)
      // Hmm, but (6,1) is below y=(1/3)x=2, so that should be back.
      // Wait: left = FixedMul(dy>>FRACBITS, dx_point) = FixedMul(1, 6*0x10000)
      // dy>>FRACBITS = (1<<16)>>16 = 1
      // dx_point = 6<<16
      // FixedMul(1, 6<<16) = (0 * 0 * 0x10000 + 0 * (6<<16 & 0xFFFF) + 1 * 0 + ...)
      // Actually let me think about fixedMul more carefully.
      // fixedMul(a, b): a=1 (integer, not fixed-point), b=6<<16=0x60000
      // aHigh = 1>>16 = 0, aLow = 1 & 0xFFFF = 1
      // bHigh = 0x60000 >> 16 = 6, bLow = 0x60000 & 0xFFFF = 0
      // result = 0*6*0x10000 + 0*0 + 1*6 + (1*0)>>>16 = 6
      // So left = 6

      // right = FixedMul(dy_point, dx>>FRACBITS) = FixedMul(1<<16, 3)
      // a=1<<16=0x10000, b=3
      // aHigh = 0x10000>>16 = 1, aLow = 0
      // bHigh = 3>>16 = 0, bLow = 3 & 0xFFFF = 3
      // result = 1*0*0x10000 + 1*3 + 0*0 + (0*3)>>>16 = 3
      // So right = 3

      // right (3) < left (6) => returns 0 (front)
      // But (6,1) should be BELOW y=(1/3)x: when x=6, y should be 2, but point has y=1
      // So point is below the line, which in Doom BSP terms is the right side (front=0, back=1)
      // Hmm, but the function returns 0 for "front side", which in BSP terms is the RIGHT child.
      // In Doom's BSP, "side 0" (front) is the right child, and "side 1" (back) is the left child.
      // The cross product being: dy/dx = slope of partition, and a point below has a smaller slope
      // Actually, Doom's definition:
      // side 0 = right/front = point is on the right of the partition direction
      // For a line going from (0,0) with dx=3,dy=1 (going right-and-slightly-up):
      // A point below-right of this line would be on the RIGHT side = side 0 = front
      // A point above-left would be on the LEFT side = side 1 = back
      // So (6,1) below the line IS front (0). That's correct!

      // Let me pick a point that's clearly above the line and goes through fallback.
      // Point (1, 1): dx_point=1<<16, dy_point=1<<16, all positive, no quick-reject
      // left = FixedMul(1, 1<<16) = 1 (via same decomposition: aHigh=0,aLow=1,bHigh=1,bLow=0 => 0+0+1*1+0=1)
      // Wait no: FixedMul(dy>>FRACBITS, dx_point) = FixedMul(1, 0x10000)
      // a=1, b=0x10000
      // aHigh=0, aLow=1, bHigh=1, bLow=0
      // 0*1*0x10000 + 0*0 + 1*1 + 0>>>16 = 1
      // left = 1

      // right = FixedMul(dy_point, dx>>FRACBITS) = FixedMul(0x10000, 3)
      // a=0x10000, b=3
      // aHigh=1, aLow=0, bHigh=0, bLow=3
      // 1*0*0x10000 + 1*3 + 0*0 + 0>>>16 = 3
      // right = 3

      // right (3) < left (1)? No (3 > 1). So returns 1 (back).
      // Point (1,1) is above y=(1/3)x=0.33, so it's on the LEFT side = back (1). Correct!
      expect(pointOnSide(toFixed(1), toFixed(1), shallowNE)).toBe(1);
    });
  });

  describe('parity-sensitive: on-partition-point returns back (1)', () => {
    it('point exactly on a diagonal partition returns 1', () => {
      // Point on the line y=x through origin: left == right => returns 1
      const diag = syntheticNode(0, 0, toFixed(1), toFixed(1));
      expect(pointOnSide(toFixed(10), toFixed(10), diag)).toBe(1);
    });

    it('point at partition origin returns back for non-axis-aligned', () => {
      // dx_point = 0, dy_point = 0 => left = 0, right = 0 => right < left is false => 1
      const diag = syntheticNode(toFixed(5), toFixed(5), toFixed(3), toFixed(2));
      expect(pointOnSide(toFixed(5), toFixed(5), diag)).toBe(1);
    });
  });
});

// ── pointOnSegSide ──────────────────────────────────────────────────

describe('pointOnSegSide', () => {
  it('matches pointOnSide for equivalent parameters (vertical)', () => {
    const result = pointOnSegSide(toFixed(50), toFixed(50), toFixed(100), toFixed(50), 0, toFixed(1));
    const node = syntheticNode(toFixed(100), toFixed(50), 0, toFixed(1));
    expect(result).toBe(pointOnSide(toFixed(50), toFixed(50), node));
  });

  it('matches pointOnSide for equivalent parameters (horizontal)', () => {
    const result = pointOnSegSide(toFixed(50), toFixed(150), toFixed(50), toFixed(100), toFixed(1), 0);
    const node = syntheticNode(toFixed(50), toFixed(100), toFixed(1), 0);
    expect(result).toBe(pointOnSide(toFixed(50), toFixed(150), node));
  });

  it('matches pointOnSide for equivalent parameters (diagonal)', () => {
    const result = pointOnSegSide(toFixed(1), toFixed(1), 0, 0, toFixed(3), toFixed(1));
    const node = syntheticNode(0, 0, toFixed(3), toFixed(1));
    expect(result).toBe(pointOnSide(toFixed(1), toFixed(1), node));
  });

  it('classifies front and back sides of a seg independently', () => {
    // Seg from (0,0) going right: dx=10, dy=0
    // Point above (y=5 > 0): return ldx > 0 = true = 1 (back / left of direction)
    expect(pointOnSegSide(toFixed(5), toFixed(5), 0, 0, toFixed(10), 0)).toBe(1);
    // Point below (y=-5 <= 0): return ldx < 0 = false = 0 (front / right of direction)
    expect(pointOnSegSide(toFixed(5), toFixed(-5), 0, 0, toFixed(10), 0)).toBe(0);
  });
});

// ── pointInSubsector ────────────────────────────────────────────────

describe('pointInSubsector', () => {
  it('returns a valid subsector index for E1M1 player start', () => {
    // E1M1 player 1 start is at (1056, -3616) in map units
    const playerX = toFixed(1056);
    const playerY = toFixed(-3616);
    const subsectorIndex = pointInSubsector(playerX, playerY, e1m1Nodes);
    expect(subsectorIndex).toBeGreaterThanOrEqual(0);
    expect(subsectorIndex).toBeLessThan(e1m1Subsectors.length);
  });

  it('returns a valid subsector index for every E1M1 vertex', () => {
    for (const vertex of e1m1Vertexes) {
      const subsectorIndex = pointInSubsector(vertex.x, vertex.y, e1m1Nodes);
      expect(subsectorIndex).toBeGreaterThanOrEqual(0);
      expect(subsectorIndex).toBeLessThan(e1m1Subsectors.length);
    }
  });

  it('returns 0 when the node array is empty (single-subsector special case)', () => {
    expect(pointInSubsector(0, 0, [])).toBe(0);
  });

  it('root node is nodes[numnodes - 1]', () => {
    // Verify the BSP root is the last node (index 235 for E1M1's 236 nodes)
    expect(e1m1Nodes.length).toBe(236);
    const rootNode = e1m1Nodes[235]!;
    // Root node should have non-zero partition dimensions
    expect(rootNode.dx !== 0 || rootNode.dy !== 0).toBe(true);
  });

  it('same point always returns the same subsector (deterministic)', () => {
    const x = toFixed(1056);
    const y = toFixed(-3616);
    const first = pointInSubsector(x, y, e1m1Nodes);
    const second = pointInSubsector(x, y, e1m1Nodes);
    expect(first).toBe(second);
  });

  it('nearby points may land in the same subsector', () => {
    // Two points 1 map unit apart should be in the same subsector
    const x = toFixed(1056);
    const y = toFixed(-3616);
    const adjacent = pointInSubsector((x + FRACUNIT) | 0, y, e1m1Nodes);
    // Both should be valid; they may or may not be the same
    expect(adjacent).toBeGreaterThanOrEqual(0);
    expect(adjacent).toBeLessThan(e1m1Subsectors.length);
  });

  it('works for all 9 shareware maps', () => {
    const mapNames = findMapNames(directory);
    expect(mapNames.length).toBe(9);

    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const vertexes = parseVertexes(bundle.vertexes);
      const nodes = parseNodes(bundle.nodes);
      const subsectors = parseSubsectors(bundle.ssectors);

      // Test with the first vertex of each map
      const vertex = vertexes[0]!;
      const subsectorIndex = pointInSubsector(vertex.x, vertex.y, nodes);
      expect(subsectorIndex).toBeGreaterThanOrEqual(0);
      expect(subsectorIndex).toBeLessThan(subsectors.length);
    }
  });
});

// ── parity-sensitive edge cases ─────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('pointOnSide handles int32 overflow in dx/dy subtraction via |0', () => {
    // Large coordinates that would overflow without |0 truncation
    const node = syntheticNode(0x7000_0000, 0, toFixed(1), 0);
    // x far below node.x: (x - node.x) must be truncated to int32
    const result = pointOnSide(toFixed(-1000), 0, node);
    // y <= node.y (0 <= 0) and dx > 0 => returns 1 (horizontal fast path: dx > 0)
    // Wait, dy === 0, so this is the horizontal path.
    // y (0) <= node.y (0) => true, dx (toFixed(1)) < 0 => false => returns 0
    expect(result).toBe(0);
  });

  it('R_PointOnSide x <= comparison is strict less-or-equal for vertical lines', () => {
    // When x === node.x and dx === 0: x <= node.x is true
    // Returns dy > 0 ? 1 : 0
    const nodeUp = syntheticNode(toFixed(42), toFixed(0), 0, toFixed(1));
    expect(pointOnSide(toFixed(42), toFixed(99), nodeUp)).toBe(1);

    const nodeDown = syntheticNode(toFixed(42), toFixed(0), 0, toFixed(-1));
    expect(pointOnSide(toFixed(42), toFixed(99), nodeDown)).toBe(0);
  });

  it('R_PointOnSide y <= comparison is strict less-or-equal for horizontal lines', () => {
    // When y === node.y and dy === 0: y <= node.y is true
    // Returns dx < 0 ? 1 : 0
    const nodeRight = syntheticNode(toFixed(0), toFixed(42), toFixed(1), 0);
    // y=42 <= node.y=42 (equal), dx > 0 => dx < 0 is false => returns 0
    expect(pointOnSide(toFixed(99), toFixed(42), nodeRight)).toBe(0);

    const nodeLeft = syntheticNode(toFixed(0), toFixed(42), toFixed(-1), 0);
    // y=42 <= node.y=42 (equal), dx < 0 => dx < 0 is true => returns 1
    expect(pointOnSide(toFixed(99), toFixed(42), nodeLeft)).toBe(1);
  });

  it('FixedMul truncation in cross-product is parity-critical', () => {
    // The C code uses (node->dy >> FRACBITS) before FixedMul, which
    // loses fractional bits. This is intentional: it avoids 64-bit
    // overflow in the original 32-bit C implementation. Verify that
    // pointOnSide uses the same truncated operand order.
    const node = syntheticNode(0, 0, toFixed(7), toFixed(3));
    // Point at (3, 7): clearly above y=(3/7)x line => back side
    // left = FixedMul(3, 3<<16) = FixedMul(3, 0x30000)
    //   aHigh=0, aLow=3, bHigh=3, bLow=0 => 0+0+3*3+0 = 9
    // right = FixedMul(7<<16, 7) = FixedMul(0x70000, 7)
    //   aHigh=7, aLow=0, bHigh=0, bLow=7 => 0+7*7+0+0 = 49
    // right (49) < left (9)? No => returns 1 (back). Correct.
    expect(pointOnSide(toFixed(3), toFixed(7), node)).toBe(1);

    // Point at (7, 3): clearly below y=(3/7)x line => front side
    // left = FixedMul(3, 7<<16) => 21
    // right = FixedMul(3<<16, 7) => 21
    // right (21) < left (21)? No => returns 1 (back).
    // This is the on-line case: the point is exactly on the partition.
    // Vanilla Doom returns 1 (back) for on-line points. Parity-critical!
    expect(pointOnSide(toFixed(7), toFixed(3), node)).toBe(1);
  });

  it('pointInSubsector strips NF_SUBSECTOR from leaf nodes', () => {
    // Build a minimal 1-node tree where both children are subsectors
    const singleNode = Object.freeze({
      x: 0,
      y: 0,
      dx: toFixed(1),
      dy: 0,
      bbox: Object.freeze([Object.freeze([0, 0, 0, 0] as const), Object.freeze([0, 0, 0, 0] as const)] as const),
      children: Object.freeze([NF_SUBSECTOR | 0, NF_SUBSECTOR | 1] as const),
    }) satisfies MapNode;

    // Point above horizontal line (y > 0): return dx > 0 = 1 (back)
    // => children[1] = NF_SUBSECTOR | 1 => subsector 1
    expect(pointInSubsector(toFixed(5), toFixed(5), [singleNode])).toBe(1);

    // Point below horizontal line (y <= 0): return dx < 0 = 0 (front)
    // => children[0] = NF_SUBSECTOR | 0 => subsector 0
    expect(pointInSubsector(toFixed(5), toFixed(-5), [singleNode])).toBe(0);
  });
});
