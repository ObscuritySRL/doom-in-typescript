import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle, findMapNames } from '../../src/map/mapBundle.ts';
import { parseLinedefs, parseVertexes } from '../../src/map/lineSectorGeometry.ts';
import { MAPBLOCKSHIFT, MAPBLOCKSIZE, parseBlockmap } from '../../src/map/blockmap.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import { blockLinesIterator, createValidCount, incrementValidCount, worldToBlockX, worldToBlockY } from '../../src/map/blockmapIter.ts';
import type { ValidCount } from '../../src/map/blockmapIter.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Blockmap = parseBlockmap(e1m1Bundle.blockmap);
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);
const e1m1Linedefs = parseLinedefs(e1m1Bundle.linedefs, e1m1Vertexes);

describe('createValidCount', () => {
  it('initialises current to 0', () => {
    const validCount = createValidCount(10);
    expect(validCount.current).toBe(0);
  });

  it('creates stamps array of the requested size', () => {
    const validCount = createValidCount(100);
    expect(validCount.stamps.length).toBe(100);
  });

  it('all stamps are initially 0', () => {
    const validCount = createValidCount(50);
    for (let index = 0; index < 50; index++) {
      expect(validCount.stamps[index]).toBe(0);
    }
  });

  it('stamps array is Int32Array', () => {
    const validCount = createValidCount(10);
    expect(validCount.stamps).toBeInstanceOf(Int32Array);
  });
});

describe('incrementValidCount', () => {
  it('advances current by 1', () => {
    const validCount = createValidCount(10);
    incrementValidCount(validCount);
    expect(validCount.current).toBe(1);
  });

  it('advances monotonically over multiple calls', () => {
    const validCount = createValidCount(10);
    for (let step = 1; step <= 5; step++) {
      incrementValidCount(validCount);
      expect(validCount.current).toBe(step);
    }
  });

  it('wraps at int32 boundary to match C int validcount semantics', () => {
    const validCount = createValidCount(10);
    validCount.current = 0x7fffffff;
    incrementValidCount(validCount);
    expect(validCount.current).toBe(-0x80000000);
  });
});

describe('worldToBlockX / worldToBlockY', () => {
  it('origin maps to block (0, 0)', () => {
    expect(worldToBlockX(e1m1Blockmap.originX, e1m1Blockmap)).toBe(0);
    expect(worldToBlockY(e1m1Blockmap.originY, e1m1Blockmap)).toBe(0);
  });

  it('one MAPBLOCKSIZE past origin maps to block 1', () => {
    const originMapX = e1m1Blockmap.originX >> FRACBITS;
    const testX = ((originMapX + MAPBLOCKSIZE) << FRACBITS) | 0;
    expect(worldToBlockX(testX, e1m1Blockmap)).toBe(1);
  });

  it('MAPBLOCKSHIFT converts fixed-point delta to block index in one shift', () => {
    const originMapY = e1m1Blockmap.originY >> FRACBITS;
    const testY = ((originMapY + MAPBLOCKSIZE * 3) << FRACBITS) | 0;
    expect(worldToBlockY(testY, e1m1Blockmap)).toBe(3);
  });

  it('coordinate just before next block boundary stays in current block', () => {
    const originMapX = e1m1Blockmap.originX >> FRACBITS;
    const justBefore = ((originMapX + MAPBLOCKSIZE - 1) << FRACBITS) | 0;
    expect(worldToBlockX(justBefore, e1m1Blockmap)).toBe(0);
  });

  it('negative world coordinates produce negative block indices', () => {
    const farLeft = (((e1m1Blockmap.originX >> FRACBITS) - MAPBLOCKSIZE) << FRACBITS) | 0;
    expect(worldToBlockX(farLeft, e1m1Blockmap)).toBe(-1);
  });
});

describe('blockLinesIterator', () => {
  it('out-of-bounds returns true without calling callback', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);
    let called = false;
    const callback = () => {
      called = true;
      return true;
    };
    expect(blockLinesIterator(-1, 0, e1m1Blockmap, validCount, callback)).toBe(true);
    expect(blockLinesIterator(0, -1, e1m1Blockmap, validCount, callback)).toBe(true);
    expect(blockLinesIterator(e1m1Blockmap.columns, 0, e1m1Blockmap, validCount, callback)).toBe(true);
    expect(blockLinesIterator(0, e1m1Blockmap.rows, e1m1Blockmap, validCount, callback)).toBe(true);
    expect(called).toBe(false);
  });

  it('iterates linedefs for a valid cell', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);
    const visited: number[] = [];
    const result = blockLinesIterator(0, 0, e1m1Blockmap, validCount, (index) => {
      visited.push(index);
      return true;
    });
    expect(result).toBe(true);
    // Every E1M1 block list begins with the leading 0 entry (followed by
    // a -1 terminator at minimum), so the first pass through cell (0, 0)
    // must visit at least linedef 0.
    expect(visited.length).toBeGreaterThan(0);
    expect(visited[0]).toBe(0);
  });

  it('callback returning false stops iteration and returns false', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);

    // Find a cell with multiple linedefs
    let targetX = -1;
    let targetY = -1;
    for (let by = 0; by < e1m1Blockmap.rows && targetX === -1; by++) {
      for (let bx = 0; bx < e1m1Blockmap.columns; bx++) {
        const count = countCellLinedefs(e1m1Blockmap, bx, by);
        if (count >= 3) {
          targetX = bx;
          targetY = by;
          break;
        }
      }
    }
    expect(targetX).toBeGreaterThanOrEqual(0);

    let callCount = 0;
    const result = blockLinesIterator(targetX, targetY, e1m1Blockmap, validCount, () => {
      callCount++;
      return callCount < 2; // stop after second call
    });
    expect(result).toBe(false);
    expect(callCount).toBe(2);
  });

  it('all visited linedef indices are within bounds', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);
    const visited: number[] = [];
    // Iterate a known-populated cell near the map center
    const centerX = Math.floor(e1m1Blockmap.columns / 2);
    const centerY = Math.floor(e1m1Blockmap.rows / 2);
    blockLinesIterator(centerX, centerY, e1m1Blockmap, validCount, (index) => {
      visited.push(index);
      return true;
    });
    for (const index of visited) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(e1m1Linedefs.length);
    }
  });

  it('iteration order matches on-disk lump order within a cell', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);
    const visited: number[] = [];

    // Pick cell (0, 0)
    blockLinesIterator(0, 0, e1m1Blockmap, validCount, (index) => {
      visited.push(index);
      return true;
    });

    // Manually read the block list from the lump for cell (0, 0)
    const cellIndex = 0;
    const wordOffset = e1m1Blockmap.offsets[cellIndex]!;
    const lump = e1m1Blockmap.lumpData;
    const expected: number[] = [];
    let cursor = wordOffset * 2;
    while (cursor + 2 <= lump.length) {
      const value = lump.readInt16LE(cursor);
      cursor += 2;
      if (value === -1) break;
      expected.push(value);
    }

    expect(visited).toEqual(expected);
  });
});

describe('validcount deduplication', () => {
  it('same linedef in two cells is visited only once per generation', () => {
    // Find two adjacent cells that share at least one linedef
    const validCount = createValidCount(e1m1Linedefs.length);

    let sharedLinedef = -1;
    let cellAx = -1;
    let cellAy = -1;
    let cellBx = -1;
    let cellBy = -1;

    outer: for (let by = 0; by < e1m1Blockmap.rows; by++) {
      for (let bx = 0; bx < e1m1Blockmap.columns - 1; bx++) {
        const linesA = collectCellLinedefs(e1m1Blockmap, bx, by);
        const linesB = collectCellLinedefs(e1m1Blockmap, bx + 1, by);
        const setB = new Set(linesB);
        for (const lineIndex of linesA) {
          if (setB.has(lineIndex)) {
            sharedLinedef = lineIndex;
            cellAx = bx;
            cellAy = by;
            cellBx = bx + 1;
            cellBy = by;
            break outer;
          }
        }
      }
    }

    // E1M1 has many linedefs crossing cell boundaries, so we should find one
    expect(sharedLinedef).toBeGreaterThanOrEqual(0);

    incrementValidCount(validCount);

    let visitCountA = 0;
    blockLinesIterator(cellAx, cellAy, e1m1Blockmap, validCount, (index) => {
      if (index === sharedLinedef) visitCountA++;
      return true;
    });
    expect(visitCountA).toBe(1);

    let visitCountB = 0;
    blockLinesIterator(cellBx, cellBy, e1m1Blockmap, validCount, (index) => {
      if (index === sharedLinedef) visitCountB++;
      return true;
    });
    // Should be 0 — already stamped by cell A
    expect(visitCountB).toBe(0);
  });

  it('new generation allows the same linedef to be visited again', () => {
    const validCount = createValidCount(e1m1Linedefs.length);

    // Pick a cell with at least one linedef
    const testX = Math.floor(e1m1Blockmap.columns / 2);
    const testY = Math.floor(e1m1Blockmap.rows / 2);

    incrementValidCount(validCount);
    const firstPass: number[] = [];
    blockLinesIterator(testX, testY, e1m1Blockmap, validCount, (index) => {
      firstPass.push(index);
      return true;
    });

    // Second pass with same generation — should get nothing (all stamped)
    const secondPass: number[] = [];
    blockLinesIterator(testX, testY, e1m1Blockmap, validCount, (index) => {
      secondPass.push(index);
      return true;
    });
    expect(secondPass.length).toBe(0);

    // Third pass with new generation — should get the same results
    incrementValidCount(validCount);
    const thirdPass: number[] = [];
    blockLinesIterator(testX, testY, e1m1Blockmap, validCount, (index) => {
      thirdPass.push(index);
      return true;
    });
    expect(thirdPass).toEqual(firstPass);
  });
});

describe('parity-sensitive: leading zero entry', () => {
  it('linedef 0 is visited when present in a block list', () => {
    // Every E1M1 block list starts with a 0 entry per the blockmap format.
    // P_BlockLinesIterator processes this entry as linedef index 0.
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);

    // Cell (0, 0) — its block list starts with 0 per WAD convention
    const lump = e1m1Blockmap.lumpData;
    const wordOffset = e1m1Blockmap.offsets[0]!;
    const firstEntry = lump.readInt16LE(wordOffset * 2);
    expect(firstEntry).toBe(0);

    let visitedZero = false;
    blockLinesIterator(0, 0, e1m1Blockmap, validCount, (index) => {
      if (index === 0) visitedZero = true;
      return true;
    });
    expect(visitedZero).toBe(true);
  });

  it('linedef 0 is visited exactly once across multiple cells', () => {
    const validCount = createValidCount(e1m1Linedefs.length);
    incrementValidCount(validCount);

    let zeroVisitCount = 0;
    // Iterate every cell in the map
    for (let by = 0; by < e1m1Blockmap.rows; by++) {
      for (let bx = 0; bx < e1m1Blockmap.columns; bx++) {
        blockLinesIterator(bx, by, e1m1Blockmap, validCount, (index) => {
          if (index === 0) zeroVisitCount++;
          return true;
        });
      }
    }
    // With validcount, linedef 0 should be visited exactly once
    expect(zeroVisitCount).toBe(1);
  });
});

describe('parity-sensitive: cell index is row-major', () => {
  it('cell (x, y) maps to offset index y * columns + x', () => {
    const validCount = createValidCount(e1m1Linedefs.length);

    // Compare results from blockLinesIterator with manual lump read
    // for a cell not at (0,0)
    const testX = 2;
    const testY = 3;
    const manualCellIndex = testY * e1m1Blockmap.columns + testX;
    const wordOffset = e1m1Blockmap.offsets[manualCellIndex]!;

    const manual: number[] = [];
    const lump = e1m1Blockmap.lumpData;
    let cursor = wordOffset * 2;
    while (cursor + 2 <= lump.length) {
      const value = lump.readInt16LE(cursor);
      cursor += 2;
      if (value === -1) break;
      manual.push(value);
    }

    incrementValidCount(validCount);
    const iterated: number[] = [];
    blockLinesIterator(testX, testY, e1m1Blockmap, validCount, (index) => {
      iterated.push(index);
      return true;
    });

    expect(iterated).toEqual(manual);
  });
});

describe('all 9 maps: full-map iteration covers all linedefs', () => {
  const mapNames = findMapNames(directory);

  it('iterating every cell visits every linedef at least once', () => {
    for (const name of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const blockmap = parseBlockmap(bundle.blockmap);
      const vertexes = parseVertexes(bundle.vertexes);
      const linedefs = parseLinedefs(bundle.linedefs, vertexes);
      const validCount = createValidCount(linedefs.length);
      incrementValidCount(validCount);

      const visited = new Set<number>();
      for (let by = 0; by < blockmap.rows; by++) {
        for (let bx = 0; bx < blockmap.columns; bx++) {
          blockLinesIterator(bx, by, blockmap, validCount, (index) => {
            visited.add(index);
            return true;
          });
        }
      }

      // Every linedef should be reachable via the blockmap
      for (let index = 0; index < linedefs.length; index++) {
        expect(visited.has(index)).toBe(true);
      }
    }
  });
});

// ── Helpers ────────────────────────────────────────────────────────────

/** Read all linedef indices from a cell's block list (raw, no dedup). */
function collectCellLinedefs(blockmap: Blockmap, blockX: number, blockY: number): number[] {
  const cellIndex = blockY * blockmap.columns + blockX;
  const wordOffset = blockmap.offsets[cellIndex]!;
  const lump = blockmap.lumpData;
  const result: number[] = [];
  let cursor = wordOffset * 2;
  while (cursor + 2 <= lump.length) {
    const value = lump.readInt16LE(cursor);
    cursor += 2;
    if (value === -1) break;
    result.push(value);
  }
  return result;
}

/** Count linedefs in a cell's block list (raw, no dedup). */
function countCellLinedefs(blockmap: Blockmap, blockX: number, blockY: number): number {
  return collectCellLinedefs(blockmap, blockX, blockY).length;
}
