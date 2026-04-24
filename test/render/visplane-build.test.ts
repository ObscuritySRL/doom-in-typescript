import { describe, expect, test } from 'bun:test';

import { MAXVISPLANES, SCREENWIDTH } from '../../src/render/projection.ts';
import { VISPLANE_TOP_UNFILLED } from '../../src/render/renderLimits.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import { checkPlane, clearPlanes, createVisplanePool, findPlane } from '../../src/render/visplanes.ts';
import type { VisplanePool } from '../../src/render/visplanes.ts';

const SKY_FLAT = 256;
const NON_SKY_FLAT = 42;

function touchColumn(plane: Visplane, col: number, topRow: number, bottomRow: number): void {
  plane.top[col] = topRow;
  plane.bottom[col] = bottomRow;
}

describe('createVisplanePool / MAXVISPLANES', () => {
  test('allocates MAXVISPLANES empty slots with screenWidth-sized top/bottom arrays', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    expect(pool.planes.length).toBe(MAXVISPLANES);
    expect(pool.count).toBe(0);
    expect(pool.screenWidth).toBe(32);
    for (const plane of pool.planes) {
      expect(plane.top.length).toBe(32);
      expect(plane.bottom.length).toBe(32);
      expect(plane.minx).toBe(32);
      expect(plane.maxx).toBe(-1);
      expect(plane.height).toBe(0);
      expect(plane.picnum).toBe(0);
      expect(plane.lightlevel).toBe(0);
    }
  });

  test('default screenWidth equals SCREENWIDTH (320)', () => {
    const pool = createVisplanePool();
    expect(pool.screenWidth).toBe(SCREENWIDTH);
    expect(pool.planes[0]!.top.length).toBe(SCREENWIDTH);
    expect(pool.planes[0]!.bottom.length).toBe(SCREENWIDTH);
    expect(pool.planes[0]!.minx).toBe(SCREENWIDTH);
  });

  test('MAXVISPLANES matches vanilla r_plane.c 128', () => {
    expect(MAXVISPLANES).toBe(128);
  });
});

describe('clearPlanes resets the pool for a new frame', () => {
  test('count reverts to 0 after a frame of findPlane allocations', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    findPlane(pool, 1 << 16, 1, 100, SKY_FLAT);
    findPlane(pool, 2 << 16, 2, 100, SKY_FLAT);
    expect(pool.count).toBe(2);
    clearPlanes(pool);
    expect(pool.count).toBe(0);
  });

  test('cleared pool reuses slot 0 on next findPlane', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const first = findPlane(pool, 1 << 16, 1, 100, SKY_FLAT);
    clearPlanes(pool);
    const reused = findPlane(pool, 7 << 16, 5, 200, SKY_FLAT);
    expect(reused).toBe(first);
    expect(reused.height).toBe(7 << 16);
    expect(reused.picnum).toBe(5);
    expect(reused.lightlevel).toBe(200);
  });
});

describe('findPlane allocation (R_FindPlane fresh path)', () => {
  test('first call allocates slot 0 and advances count', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 128 << 16, NON_SKY_FLAT, 160, SKY_FLAT);
    expect(pool.count).toBe(1);
    expect(plane).toBe(pool.planes[0]!);
    expect(plane.height).toBe(128 << 16);
    expect(plane.picnum).toBe(NON_SKY_FLAT);
    expect(plane.lightlevel).toBe(160);
  });

  test('newly-allocated plane has minx = screenWidth and maxx = -1', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    expect(plane.minx).toBe(32);
    expect(plane.maxx).toBe(-1);
    expect(plane.minx > plane.maxx).toBe(true);
  });

  test('newly-allocated plane top array is filled with 0xff (VISPLANE_TOP_UNFILLED)', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    for (let i = 0; i < 32; i += 1) {
      expect(plane.top[i]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });

  test('newly-allocated plane overwrites stale top bytes from a previous frame', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const first = findPlane(pool, 0, 1, 100, SKY_FLAT);
    touchColumn(first, 5, 10, 20);
    touchColumn(first, 20, 11, 21);
    clearPlanes(pool);
    const next = findPlane(pool, 0, 2, 150, SKY_FLAT);
    expect(next).toBe(first);
    for (let i = 0; i < 32; i += 1) {
      expect(next.top[i]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });

  test('bottom array is NOT reset by findPlane (vanilla parity)', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const first = findPlane(pool, 0, 1, 100, SKY_FLAT);
    first.bottom[4] = 0x7e;
    first.bottom[9] = 0x3c;
    clearPlanes(pool);
    const next = findPlane(pool, 0, 2, 150, SKY_FLAT);
    expect(next).toBe(first);
    expect(next.bottom[4]).toBe(0x7e);
    expect(next.bottom[9]).toBe(0x3c);
  });
});

describe('findPlane linear scan (R_FindPlane reuse path)', () => {
  test('returns existing plane on exact (height, picnum, lightlevel) match', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const a = findPlane(pool, 64 << 16, 10, 150, SKY_FLAT);
    const b = findPlane(pool, 64 << 16, 10, 150, SKY_FLAT);
    expect(b).toBe(a);
    expect(pool.count).toBe(1);
  });

  test('allocates a new plane when height differs', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const a = findPlane(pool, 64 << 16, 10, 150, SKY_FLAT);
    const b = findPlane(pool, 128 << 16, 10, 150, SKY_FLAT);
    expect(b).not.toBe(a);
    expect(pool.count).toBe(2);
    expect(pool.planes[1]!).toBe(b);
  });

  test('allocates a new plane when picnum differs', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const a = findPlane(pool, 64 << 16, 10, 150, SKY_FLAT);
    const b = findPlane(pool, 64 << 16, 11, 150, SKY_FLAT);
    expect(b).not.toBe(a);
    expect(pool.count).toBe(2);
  });

  test('allocates a new plane when lightlevel differs', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const a = findPlane(pool, 64 << 16, 10, 150, SKY_FLAT);
    const b = findPlane(pool, 64 << 16, 10, 200, SKY_FLAT);
    expect(b).not.toBe(a);
    expect(pool.count).toBe(2);
  });

  test('scan is linear — returns first match in pool order', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const zero = findPlane(pool, 0, 1, 100, SKY_FLAT);
    findPlane(pool, 64 << 16, 2, 150, SKY_FLAT);
    findPlane(pool, 128 << 16, 3, 200, SKY_FLAT);
    const rescan = findPlane(pool, 0, 1, 100, SKY_FLAT);
    expect(rescan).toBe(zero);
    expect(pool.count).toBe(3);
  });
});

describe('findPlane sky collapse (picnum === skyFlatNum)', () => {
  test('collapses any height to 0 when picnum matches skyFlatNum', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 128 << 16, SKY_FLAT, 200, SKY_FLAT);
    expect(plane.height).toBe(0);
    expect(plane.lightlevel).toBe(0);
    expect(plane.picnum).toBe(SKY_FLAT);
  });

  test('collapses any lightlevel to 0 for sky picnums', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const a = findPlane(pool, 128 << 16, SKY_FLAT, 200, SKY_FLAT);
    const b = findPlane(pool, 64 << 16, SKY_FLAT, 150, SKY_FLAT);
    expect(b).toBe(a);
    expect(pool.count).toBe(1);
  });

  test('non-sky picnum with same numeric height and lightlevel does NOT merge into sky plane', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const sky = findPlane(pool, 0, SKY_FLAT, 0, SKY_FLAT);
    const floor = findPlane(pool, 0, NON_SKY_FLAT, 0, SKY_FLAT);
    expect(floor).not.toBe(sky);
    expect(pool.count).toBe(2);
  });
});

describe('findPlane pool overflow (vanilla I_Error parity)', () => {
  test('throws RangeError when the pool is full', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    for (let i = 0; i < MAXVISPLANES; i += 1) {
      findPlane(pool, (i + 1) << 16, i + 1, 100, SKY_FLAT);
    }
    expect(pool.count).toBe(MAXVISPLANES);
    expect(() => findPlane(pool, (MAXVISPLANES + 1) << 16, 255, 100, SKY_FLAT)).toThrow(RangeError);
  });

  test('overflow does not advance count past MAXVISPLANES', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    for (let i = 0; i < MAXVISPLANES; i += 1) {
      findPlane(pool, (i + 1) << 16, i + 1, 100, SKY_FLAT);
    }
    try {
      findPlane(pool, 99 << 16, 99, 99, SKY_FLAT);
    } catch {
      // expected
    }
    expect(pool.count).toBe(MAXVISPLANES);
  });
});

describe('checkPlane extend path (no touched columns in intersection)', () => {
  test('fresh plane (minx > maxx) extends to cover [start, stop] on first checkPlane', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    const result = checkPlane(pool, plane, 5, 15);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(15);
    expect(pool.count).toBe(1);
  });

  test('extends minx downward when start < minx and intersection is untouched', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 10, 20);
    const result = checkPlane(pool, plane, 5, 15);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(20);
  });

  test('extends maxx upward when stop > maxx and intersection is untouched', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 15);
    const result = checkPlane(pool, plane, 10, 25);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(25);
  });

  test('extends both ends when [start, stop] wraps [minx, maxx] and intersection untouched', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 10, 20);
    const result = checkPlane(pool, plane, 2, 30);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(2);
    expect(plane.maxx).toBe(30);
  });

  test('disjoint range above extends via empty-intersection quirk', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 10);
    touchColumn(plane, 5, 30, 60);
    touchColumn(plane, 10, 31, 61);
    const result = checkPlane(pool, plane, 20, 25);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(25);
    expect(pool.count).toBe(1);
  });

  test('disjoint range below extends via empty-intersection quirk', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 20, 25);
    touchColumn(plane, 20, 33, 70);
    touchColumn(plane, 25, 34, 71);
    const result = checkPlane(pool, plane, 5, 10);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(25);
    expect(pool.count).toBe(1);
  });

  test('contained range [start..stop] inside existing [minx..maxx] with untouched intersection extends (union degenerates to existing range)', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    const result = checkPlane(pool, plane, 10, 20);
    expect(result).toBe(plane);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(25);
    expect(pool.count).toBe(1);
  });
});

describe('checkPlane split path (touched column in intersection)', () => {
  test('allocates a new plane when [start..stop] overlaps a touched column', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 64 << 16, 7, 150, SKY_FLAT);
    checkPlane(pool, plane, 10, 20);
    touchColumn(plane, 15, 50, 120);
    const result = checkPlane(pool, plane, 12, 18);
    expect(result).not.toBe(plane);
    expect(pool.count).toBe(2);
    expect(pool.planes[1]!).toBe(result);
  });

  test('new plane copies height / picnum / lightlevel from the source', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 128 << 16, 9, 180, SKY_FLAT);
    checkPlane(pool, plane, 10, 20);
    touchColumn(plane, 14, 44, 88);
    const result = checkPlane(pool, plane, 12, 18);
    expect(result.height).toBe(128 << 16);
    expect(result.picnum).toBe(9);
    expect(result.lightlevel).toBe(180);
  });

  test("new plane's range is [start, stop] — NOT the union", () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 10, 33, 77);
    const result = checkPlane(pool, plane, 8, 12);
    expect(result.minx).toBe(8);
    expect(result.maxx).toBe(12);
    expect(plane.minx).toBe(5);
    expect(plane.maxx).toBe(25);
  });

  test("new plane's top array is filled with 0xff", () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 10, 33, 77);
    const result = checkPlane(pool, plane, 8, 12);
    for (let i = 0; i < 32; i += 1) {
      expect(result.top[i]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });

  test("new plane's bottom array is NOT reset (vanilla does not memset bottom)", () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 10, 33, 77);
    pool.planes[1]!.bottom[3] = 0x5a;
    pool.planes[1]!.bottom[14] = 0x77;
    const result = checkPlane(pool, plane, 8, 12);
    expect(result).toBe(pool.planes[1]!);
    expect(result.bottom[3]).toBe(0x5a);
    expect(result.bottom[14]).toBe(0x77);
  });

  test('source plane is unchanged when split branch is taken', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 10, 33, 77);
    const beforeMinX = plane.minx;
    const beforeMaxX = plane.maxx;
    const beforeTop = plane.top[10];
    checkPlane(pool, plane, 8, 12);
    expect(plane.minx).toBe(beforeMinX);
    expect(plane.maxx).toBe(beforeMaxX);
    expect(plane.top[10]).toBe(beforeTop);
  });

  test('touched column at exact boundary (top[start]) triggers split', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 8, 41, 99);
    const result = checkPlane(pool, plane, 8, 12);
    expect(result).not.toBe(plane);
    expect(result.minx).toBe(8);
    expect(result.maxx).toBe(12);
  });

  test('touched column at exact boundary (top[stop]) triggers split', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 12, 22, 55);
    const result = checkPlane(pool, plane, 8, 12);
    expect(result).not.toBe(plane);
  });
});

describe('checkPlane overflow (R_CheckPlane pool exhaustion)', () => {
  test('throws RangeError when split would allocate past MAXVISPLANES', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const base = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, base, 5, 25);
    touchColumn(base, 15, 30, 60);
    for (let i = 1; i < MAXVISPLANES; i += 1) {
      findPlane(pool, (i + 1) << 16, i + 1, 100, SKY_FLAT);
    }
    expect(pool.count).toBe(MAXVISPLANES);
    expect(() => checkPlane(pool, base, 12, 18)).toThrow(RangeError);
  });

  test('extend branch does not consume pool slots even when pool is full', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const base = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, base, 5, 10);
    for (let i = 1; i < MAXVISPLANES; i += 1) {
      findPlane(pool, (i + 1) << 16, i + 1, 100, SKY_FLAT);
    }
    expect(pool.count).toBe(MAXVISPLANES);
    const result = checkPlane(pool, base, 4, 12);
    expect(result).toBe(base);
    expect(pool.count).toBe(MAXVISPLANES);
    expect(base.minx).toBe(4);
    expect(base.maxx).toBe(12);
  });
});

describe('full-frame visplane workflow parity', () => {
  test('BSP traversal + wall render pattern produces one plane per unique (h, p, l) triple when ranges are disjoint', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const floorA = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, floorA, 0, 9);
    const floorB = findPlane(pool, 0, 2, 100, SKY_FLAT);
    checkPlane(pool, floorB, 10, 19);
    const floorC = findPlane(pool, 0, 3, 100, SKY_FLAT);
    checkPlane(pool, floorC, 20, 31);
    expect(pool.count).toBe(3);
    expect(floorA.minx).toBe(0);
    expect(floorA.maxx).toBe(9);
    expect(floorB.minx).toBe(10);
    expect(floorB.maxx).toBe(19);
    expect(floorC.minx).toBe(20);
    expect(floorC.maxx).toBe(31);
  });

  test('split reuses the (h, p, l) triple so the new plane can be found by re-calling findPlane only before it is populated', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 5, 25);
    touchColumn(plane, 15, 30, 60);
    const split = checkPlane(pool, plane, 12, 18);
    const rescan = findPlane(pool, 0, 1, 100, SKY_FLAT);
    expect(rescan).toBe(plane);
    expect(rescan).not.toBe(split);
    expect(pool.count).toBe(2);
  });

  test('multiple splits of the same source plane build a chain of cloned pool entries', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 0, 31);
    for (let col = 0; col < 32; col += 1) {
      touchColumn(plane, col, 40 + col, 80 + col);
    }
    const split1 = checkPlane(pool, plane, 0, 10);
    const split2 = checkPlane(pool, plane, 11, 20);
    const split3 = checkPlane(pool, plane, 21, 31);
    expect(split1).not.toBe(plane);
    expect(split2).not.toBe(plane);
    expect(split3).not.toBe(plane);
    expect(split1).not.toBe(split2);
    expect(split2).not.toBe(split3);
    expect(pool.count).toBe(4);
    expect(split1.height).toBe(plane.height);
    expect(split2.picnum).toBe(plane.picnum);
    expect(split3.lightlevel).toBe(plane.lightlevel);
    expect(split1.minx).toBe(0);
    expect(split1.maxx).toBe(10);
    expect(split2.minx).toBe(11);
    expect(split2.maxx).toBe(20);
    expect(split3.minx).toBe(21);
    expect(split3.maxx).toBe(31);
  });

  test('clearPlanes between frames fully resets even after splits', () => {
    const pool = createVisplanePool({ screenWidth: 32 });
    const plane = findPlane(pool, 0, 1, 100, SKY_FLAT);
    checkPlane(pool, plane, 0, 31);
    for (let col = 0; col < 32; col += 1) {
      touchColumn(plane, col, 40 + col, 80 + col);
    }
    checkPlane(pool, plane, 5, 10);
    checkPlane(pool, plane, 20, 25);
    expect(pool.count).toBe(3);
    clearPlanes(pool);
    expect(pool.count).toBe(0);
    const freshFrame = findPlane(pool, 999 << 16, 55, 220, SKY_FLAT);
    expect(freshFrame).toBe(pool.planes[0]!);
    expect(freshFrame.height).toBe(999 << 16);
    for (let i = 0; i < 32; i += 1) {
      expect(freshFrame.top[i]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });
});

describe('VisplanePool typing exports', () => {
  test('VisplanePool.planes yields Visplane references', () => {
    const pool: VisplanePool = createVisplanePool({ screenWidth: 16 });
    const plane: Visplane = pool.planes[0]!;
    expect(plane.top).toBeInstanceOf(Uint8Array);
    expect(plane.bottom).toBeInstanceOf(Uint8Array);
  });
});
