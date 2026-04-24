import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS, FRACUNIT, FIXED_MAX, fixedMul } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle } from '../../src/map/mapBundle.ts';
import { parseLinedefs, parseVertexes } from '../../src/map/lineSectorGeometry.ts';
import { MAPBLOCKSHIFT, parseBlockmap } from '../../src/map/blockmap.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Divline, Intercept } from '../../src/map/intercepts.ts';
import { MAXINTERCEPTS, MAX_TRAVERSE_CELLS, PT_ADDLINES, PT_ADDTHINGS, PT_EARLYOUT, interceptVector, pathTraverse, pointOnDivlineSide } from '../../src/map/intercepts.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);
const e1m1Linedefs = parseLinedefs(e1m1Bundle.linedefs, e1m1Vertexes);
const e1m1Blockmap = parseBlockmap(e1m1Bundle.blockmap);

describe('constants', () => {
  it('PT_ADDLINES is 1', () => {
    expect(PT_ADDLINES).toBe(1);
  });

  it('PT_ADDTHINGS is 2', () => {
    expect(PT_ADDTHINGS).toBe(2);
  });

  it('PT_EARLYOUT is 4', () => {
    expect(PT_EARLYOUT).toBe(4);
  });

  it('MAXINTERCEPTS is 128', () => {
    expect(MAXINTERCEPTS).toBe(128);
  });

  it('MAX_TRAVERSE_CELLS is 64', () => {
    expect(MAX_TRAVERSE_CELLS).toBe(64);
  });

  it('flags are distinct powers of two', () => {
    expect(PT_ADDLINES & PT_ADDTHINGS).toBe(0);
    expect(PT_ADDLINES & PT_EARLYOUT).toBe(0);
    expect(PT_ADDTHINGS & PT_EARLYOUT).toBe(0);
  });
});

describe('interceptVector', () => {
  it('returns 0 for parallel horizontal lines', () => {
    const v1: Divline = { x: 0, y: 0, dx: FRACUNIT, dy: 0 };
    const v2: Divline = { x: 0, y: FRACUNIT, dx: FRACUNIT, dy: 0 };
    expect(interceptVector(v2, v1)).toBe(0);
  });

  it('returns 0 for identical lines (collinear)', () => {
    const v1: Divline = { x: 0, y: 0, dx: FRACUNIT, dy: FRACUNIT };
    const v2: Divline = { x: 0, y: 0, dx: FRACUNIT, dy: FRACUNIT };
    expect(interceptVector(v2, v1)).toBe(0);
  });

  it('computes FRACUNIT/2 for perpendicular midpoint crossing', () => {
    // Horizontal trace 10 units, vertical line crossing at x=5
    const v2: Divline = {
      x: 0,
      y: 0,
      dx: (10 << FRACBITS) | 0,
      dy: 0,
    };
    const v1: Divline = {
      x: (5 << FRACBITS) | 0,
      y: -(5 << FRACBITS) | 0,
      dx: 0,
      dy: (10 << FRACBITS) | 0,
    };
    expect(interceptVector(v2, v1)).toBe(FRACUNIT >> 1);
  });

  it('returns near-zero frac when crossing is near v2 origin', () => {
    // Trace going right, line crossing just past the origin
    const v2: Divline = {
      x: 0,
      y: 0,
      dx: (100 << FRACBITS) | 0,
      dy: 0,
    };
    const v1: Divline = {
      x: (1 << FRACBITS) | 0,
      y: -(10 << FRACBITS) | 0,
      dx: 0,
      dy: (20 << FRACBITS) | 0,
    };
    const frac = interceptVector(v2, v1);
    expect(frac).toBeGreaterThan(0);
    expect(frac).toBeLessThan(FRACUNIT >> 2);
  });

  it('uses >> 8 shift producing non-zero denominator for small values', () => {
    // Values small enough that >> 16 would zero out but >> 8 preserves
    const v2: Divline = {
      x: 0,
      y: 0,
      dx: (1 << FRACBITS) | 0,
      dy: 0,
    };
    const v1: Divline = {
      x: (1 << (FRACBITS - 1)) | 0,
      y: -((1 << FRACBITS) | 0),
      dx: 0,
      dy: (2 << FRACBITS) | 0,
    };
    // Should produce a valid crossing fraction
    const frac = interceptVector(v2, v1);
    expect(frac).toBe(FRACUNIT >> 1);
  });
});

describe('pointOnDivlineSide', () => {
  it('vertical upward line: right side is 0', () => {
    const line: Divline = { x: 0, y: 0, dx: 0, dy: FRACUNIT };
    expect(pointOnDivlineSide(FRACUNIT, 0, line)).toBe(0);
  });

  it('vertical upward line: left side is 1', () => {
    const line: Divline = { x: 0, y: 0, dx: 0, dy: FRACUNIT };
    expect(pointOnDivlineSide(-FRACUNIT, 0, line)).toBe(1);
  });

  it('horizontal rightward line: above is 1 (left side)', () => {
    const line: Divline = { x: 0, y: 0, dx: FRACUNIT, dy: 0 };
    expect(pointOnDivlineSide(0, FRACUNIT, line)).toBe(1);
  });

  it('horizontal rightward line: below is 0 (right side)', () => {
    const line: Divline = { x: 0, y: 0, dx: FRACUNIT, dy: 0 };
    expect(pointOnDivlineSide(0, -FRACUNIT, line)).toBe(0);
  });

  it('diagonal line: point above line is 1 (left side)', () => {
    const line: Divline = {
      x: 0,
      y: 0,
      dx: (100 << FRACBITS) | 0,
      dy: (50 << FRACBITS) | 0,
    };
    // At x=50, line is at y=25; point at y=50 is above → left side → 1
    expect(pointOnDivlineSide((50 << FRACBITS) | 0, (50 << FRACBITS) | 0, line)).toBe(1);
  });

  it('diagonal line: point below line is 0 (right side)', () => {
    const line: Divline = {
      x: 0,
      y: 0,
      dx: (100 << FRACBITS) | 0,
      dy: (50 << FRACBITS) | 0,
    };
    // At x=50, line is at y=25; point at y=0 is below → right side → 0
    expect(pointOnDivlineSide((50 << FRACBITS) | 0, 0, line)).toBe(0);
  });

  it('uses >> 8 shift in FixedMul fallback (not >> FRACBITS)', () => {
    // Exercise the FixedMul path with values where >> 8 gives
    // different intermediate products than >> FRACBITS would.
    // Both operands to FixedMul are shifted by 8, preserving more bits.
    const line: Divline = {
      x: 0,
      y: 0,
      dx: (37 << FRACBITS) | 0,
      dy: (73 << FRACBITS) | 0,
    };
    const testX = (40 << FRACBITS) | 0;
    const testY = (20 << FRACBITS) | 0;
    // Manually verify: dy >> 8 = 73*256, dx >> 8 = 40*256-ish
    // The result should be deterministic and side 1 (point is below the line slope)
    const side = pointOnDivlineSide(testX, testY, line);
    // Cross product: dy*(x-0) vs (y-0)*dx = 73*40 vs 20*37 = 2920 vs 740 → right < left → side 0
    expect(side).toBe(0);
  });
});

describe('pathTraverse', () => {
  it('collects line intercepts for a trace across E1M1', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    const collected: Intercept[] = [];

    pathTraverse((1056 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1280 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      collected.push({ ...intercept });
      return true;
    });

    expect(collected.length).toBeGreaterThan(0);
  });

  it('delivers intercepts in ascending frac order', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    const fracs: number[] = [];

    pathTraverse((800 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1400 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      fracs.push(intercept.frac);
      return true;
    });

    for (let index = 1; index < fracs.length; index++) {
      expect(fracs[index]).toBeGreaterThanOrEqual(fracs[index - 1]!);
    }
  });

  it('all intercepts have isLine true', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    let visited = 0;

    pathTraverse((1056 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1280 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      visited++;
      expect(intercept.isLine).toBe(true);
      return true;
    });

    expect(visited).toBeGreaterThan(0);
  });

  it('all intercepts have valid linedef indices', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    let visited = 0;

    pathTraverse((1056 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1280 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      visited++;
      expect(intercept.lineIndex).toBeGreaterThanOrEqual(0);
      expect(intercept.lineIndex).toBeLessThan(e1m1Linedefs.length);
      return true;
    });

    expect(visited).toBeGreaterThan(0);
  });

  it('intercept fracs are non-negative', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    let visited = 0;

    pathTraverse((800 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1400 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      visited++;
      expect(intercept.frac).toBeGreaterThanOrEqual(0);
      return true;
    });

    expect(visited).toBeGreaterThan(0);
  });

  it('intercept fracs do not exceed FRACUNIT (traverseIntercepts bound)', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    let visited = 0;

    pathTraverse((1056 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1280 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      visited++;
      expect(intercept.frac).toBeLessThanOrEqual(FRACUNIT);
      return true;
    });

    expect(visited).toBeGreaterThan(0);
  });

  it('returns true when all intercepts processed', () => {
    const validCount = createValidCount(e1m1Linedefs.length);

    const result = pathTraverse((1000 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1200 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, () => true);

    expect(result).toBe(true);
  });

  it('returns false when callback stops traversal', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    let callbackCount = 0;

    const result = pathTraverse((800 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1400 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, () => {
      callbackCount++;
      return false;
    });

    expect(callbackCount).toBeGreaterThan(0);
    expect(result).toBe(false);
    expect(callbackCount).toBe(1);
  });

  it('out-of-bounds trace produces no intercepts', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    let callbackCount = 0;

    const result = pathTraverse((-10000 << FRACBITS) | 0, (-10000 << FRACBITS) | 0, (-9999 << FRACBITS) | 0, (-10000 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, () => {
      callbackCount++;
      return true;
    });

    expect(result).toBe(true);
    expect(callbackCount).toBe(0);
  });

  it('provides frozen trace divline to callback', () => {
    // Use the same trace as "delivers intercepts in ascending frac order"
    // which is known to produce intercepts.
    const validCount = createValidCount(e1m1Linedefs.length);
    let receivedTrace: Divline | undefined;

    pathTraverse((800 << FRACBITS) | 0, (-3616 << FRACBITS) | 0, (1400 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (_intercept, trace) => {
      receivedTrace = trace;
      return true;
    });

    expect(receivedTrace).toBeDefined();
    expect(Object.isFrozen(receivedTrace!)).toBe(true);
    expect(typeof receivedTrace!.x).toBe('number');
    expect(typeof receivedTrace!.dx).toBe('number');
  });

  it('nudges start point off block boundaries', () => {
    // Pick a start that is (a) inside the playable area so the trace
    // crosses real lines, and (b) exactly on a block boundary so the
    // FRACUNIT nudge must fire. Blockmap cells are 128 map units; the
    // offset from the blockmap origin snaps to a multiple of 128<<16.
    const blockSize = (1 << MAPBLOCKSHIFT) >>> 0;
    // E1M1 blockmap origin is (-776, -4872). Cell (14,10) → map (1016,-3592),
    // which sits inside the playable area near player 1 start.
    const originSnapX = (e1m1Blockmap.originX + 14 * blockSize) | 0;
    const originSnapY = (e1m1Blockmap.originY + 10 * blockSize) | 0;
    expect((originSnapX - e1m1Blockmap.originX) & (blockSize - 1)).toBe(0);
    expect((originSnapY - e1m1Blockmap.originY) & (blockSize - 1)).toBe(0);

    const validCount = createValidCount(e1m1Linedefs.length);
    let receivedTrace: Divline | undefined;

    pathTraverse(originSnapX, originSnapY, (1400 << FRACBITS) | 0, (-3200 << FRACBITS) | 0, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (_intercept, trace) => {
      receivedTrace = trace;
      return false;
    });

    expect(receivedTrace).toBeDefined();
    expect(receivedTrace!.x).toBe((originSnapX + FRACUNIT) | 0);
    expect(receivedTrace!.y).toBe((originSnapY + FRACUNIT) | 0);
  });

  it('PT_EARLYOUT stops traversal on a one-sided line within FRACUNIT', () => {
    // Find a one-sided linedef and aim a trace at its midpoint.
    // PT_EARLYOUT + frac<FRACUNIT + sidenum1===-1 → addLineIntercept
    // returns false, which propagates as pathTraverse returning false.
    let oneSidedIndex = -1;
    for (let index = 0; index < e1m1Linedefs.length; index++) {
      const linedef = e1m1Linedefs[index]!;
      if (linedef.sidenum1 === -1 && (linedef.dx !== 0 || linedef.dy !== 0)) {
        oneSidedIndex = index;
        break;
      }
    }
    expect(oneSidedIndex).toBeGreaterThanOrEqual(0);

    const linedef = e1m1Linedefs[oneSidedIndex]!;
    const v1 = e1m1Vertexes[linedef.v1]!;
    const v2 = e1m1Vertexes[linedef.v2]!;
    const midX = ((v1.x + v2.x) / 2) | 0;
    const midY = ((v1.y + v2.y) / 2) | 0;

    // Trace from just off the midpoint perpendicularly across.
    const length = Math.sqrt((linedef.dx / FRACUNIT) ** 2 + (linedef.dy / FRACUNIT) ** 2);
    const offset = 32 << FRACBITS;
    const perpX = ((-linedef.dy / FRACUNIT / length) * offset) | 0;
    const perpY = ((linedef.dx / FRACUNIT / length) * offset) | 0;

    const startX = (midX + perpX) | 0;
    const startY = (midY + perpY) | 0;
    const endX = (midX - perpX) | 0;
    const endY = (midY - perpY) | 0;

    const validCount = createValidCount(e1m1Linedefs.length);
    let callbackCount = 0;

    const result = pathTraverse(startX, startY, endX, endY, PT_ADDLINES | PT_EARLYOUT, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, () => {
      callbackCount++;
      return true;
    });

    // Early-out aborts BEFORE the callback is invoked — so the callback
    // never runs, and pathTraverse returns false.
    expect(result).toBe(false);
    expect(callbackCount).toBe(0);
  });

  it('finds a specific linedef when trace crosses it perpendicularly', () => {
    // Pick a linedef with non-zero dx and dy to ensure perpendicular crossing
    let targetIndex = -1;
    for (let index = 0; index < e1m1Linedefs.length; index++) {
      const linedef = e1m1Linedefs[index]!;
      if (linedef.dx !== 0 && linedef.dy !== 0) {
        targetIndex = index;
        break;
      }
    }
    expect(targetIndex).toBeGreaterThanOrEqual(0);

    const linedef = e1m1Linedefs[targetIndex]!;
    const v1 = e1m1Vertexes[linedef.v1]!;
    const v2 = e1m1Vertexes[linedef.v2]!;

    // Midpoint of linedef
    const midX = ((v1.x + v2.x) / 2) | 0;
    const midY = ((v1.y + v2.y) / 2) | 0;

    // Perpendicular direction: rotate (dx, dy) by 90 degrees
    // Normalize to 64 map units offset each side
    const offset = 64 << FRACBITS;
    const length = Math.sqrt((linedef.dx / FRACUNIT) ** 2 + (linedef.dy / FRACUNIT) ** 2);
    const normPerpX = ((-linedef.dy / FRACUNIT / length) * offset) | 0;
    const normPerpY = ((linedef.dx / FRACUNIT / length) * offset) | 0;

    const startX = (midX + normPerpX) | 0;
    const startY = (midY + normPerpY) | 0;
    const endX = (midX - normPerpX) | 0;
    const endY = (midY - normPerpY) | 0;

    const validCount = createValidCount(e1m1Linedefs.length);
    const foundIndices: number[] = [];

    pathTraverse(startX, startY, endX, endY, PT_ADDLINES, e1m1Blockmap, e1m1Linedefs, e1m1Vertexes, validCount, (intercept) => {
      foundIndices.push(intercept.lineIndex);
      return true;
    });

    expect(foundIndices).toContain(targetIndex);
  });
});

describe('parity: >> 8 shift in interceptVector', () => {
  it('produces exact FRACUNIT/2 for symmetric perpendicular crossing', () => {
    // Hand-verified with >> 8 arithmetic:
    // den = FixedMul((10<<16)>>8, 10<<16) - 0 = FixedMul(2560, 655360) = 25600
    // num = FixedMul((5<<16)>>8, 10<<16) + 0 = FixedMul(1280, 655360) = 12800
    // frac = FixedDiv(12800, 25600) = 32768 = FRACUNIT/2
    const trace: Divline = {
      x: 0,
      y: 0,
      dx: (10 << FRACBITS) | 0,
      dy: 0,
    };
    const lineDiv: Divline = {
      x: (5 << FRACBITS) | 0,
      y: -(5 << FRACBITS) | 0,
      dx: 0,
      dy: (10 << FRACBITS) | 0,
    };
    expect(interceptVector(trace, lineDiv)).toBe(FRACUNIT >> 1);
  });

  it('pointOnDivlineSide sign-bit quick-reject matches FixedMul path', () => {
    // Case where the sign-bit XOR triggers: point clearly on one side
    const line: Divline = {
      x: 0,
      y: 0,
      dx: (100 << FRACBITS) | 0,
      dy: (100 << FRACBITS) | 0,
    };
    // Point (50, -50): dx positive, dy negative → mixed signs → quick-reject
    // Point is to the RIGHT of the NE diagonal → front side → 0
    const side = pointOnDivlineSide((50 << FRACBITS) | 0, -(50 << FRACBITS) | 0, line);
    expect(side).toBe(0);
  });
});
