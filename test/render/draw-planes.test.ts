import { describe, expect, test } from 'bun:test';

import { drawPlanes } from '../../src/render/drawPlanes.ts';
import { createVisplanePool } from '../../src/render/visplanes.ts';

const SKY_FLAT_NUM = 2;

function activate(pool: ReturnType<typeof createVisplanePool>, index: number, picnum: number, minx: number, maxx: number): void {
  const plane = pool.planes[index]!;
  plane.picnum = picnum;
  plane.minx = minx;
  plane.maxx = maxx;
  if (index + 1 > pool.count) {
    pool.count = index + 1;
  }
}

describe('drawPlanes: R_DrawPlanes pool walk + dispatch', () => {
  test('no planes active → nothing rendered', () => {
    const pool = createVisplanePool();
    const calls: string[] = [];
    drawPlanes(
      pool,
      SKY_FLAT_NUM,
      () => calls.push('sky'),
      () => calls.push('regular'),
    );
    expect(calls).toEqual([]);
  });

  test('dispatches sky vs regular by picnum, in pool order, skipping minx > maxx', () => {
    const pool = createVisplanePool();
    // index 0: empty (default minx = screenWidth, maxx = -1 → minx > maxx) → skipped
    pool.count = 1;
    activate(pool, 1, 7, 10, 20); // regular flat
    activate(pool, 2, SKY_FLAT_NUM, 0, 30); // sky flat
    activate(pool, 3, 9, 5, 4); // minx > maxx → skipped despite being a real picnum

    const calls: Array<{ kind: string; picnum: number }> = [];
    drawPlanes(
      pool,
      SKY_FLAT_NUM,
      (plane) => calls.push({ kind: 'sky', picnum: plane.picnum }),
      (plane) => calls.push({ kind: 'regular', picnum: plane.picnum }),
    );

    expect(calls).toEqual([
      { kind: 'regular', picnum: 7 },
      { kind: 'sky', picnum: SKY_FLAT_NUM },
    ]);
  });

  test('only planes[0, pool.count) are visited', () => {
    const pool = createVisplanePool();
    activate(pool, 0, 5, 0, 10);
    activate(pool, 1, 6, 0, 10);
    // A third plane exists in the array but is NOT active (count stays 2).
    const beyond = pool.planes[2]!;
    beyond.picnum = 99;
    beyond.minx = 0;
    beyond.maxx = 10;
    pool.count = 2;

    const seen: number[] = [];
    const record: (plane: { picnum: number }) => void = (plane) => seen.push(plane.picnum);
    drawPlanes(pool, SKY_FLAT_NUM, record, record);
    expect(seen).toEqual([5, 6]);
  });

  test('a plane whose picnum equals skyFlatNum always takes the sky branch', () => {
    const pool = createVisplanePool();
    activate(pool, 0, SKY_FLAT_NUM, 0, 5);
    let sky = 0;
    let regular = 0;
    drawPlanes(
      pool,
      SKY_FLAT_NUM,
      () => (sky += 1),
      () => (regular += 1),
    );
    expect(sky).toBe(1);
    expect(regular).toBe(0);
  });

  test('the exact vanilla empty-plane skip is minx > maxx (minx === maxx still renders)', () => {
    const pool = createVisplanePool();
    activate(pool, 0, 4, 15, 15); // minx === maxx → NOT skipped (vanilla: only minx > maxx skips)
    const calls: string[] = [];
    drawPlanes(
      pool,
      SKY_FLAT_NUM,
      () => calls.push('sky'),
      () => calls.push('regular'),
    );
    expect(calls).toEqual(['regular']);
  });
});
