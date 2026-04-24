import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { COLUMN_HEIGHT_MASK, FLAT_DIMENSION, FLAT_SIZE, FLAT_X_MASK, FLAT_Y_MASK, FLAT_Y_SHIFT, rDrawColumn, rDrawSpan } from '../../src/render/drawPrimitives.ts';
import type { ColumnDrawJob, SpanDrawJob } from '../../src/render/drawPrimitives.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';

const CANARY = 0xaa;
const IDENTITY_COLORMAP = Uint8Array.from({ length: 256 }, (_, i) => i);

function makeFramebuffer(): Uint8Array {
  return new Uint8Array(SCREENWIDTH * SCREENHEIGHT).fill(CANARY);
}

function makeColumnJob(overrides: Partial<ColumnDrawJob> = {}): ColumnDrawJob {
  return {
    x: 0,
    yl: 0,
    yh: 0,
    textureMid: 0,
    iscale: FRACUNIT,
    centerY: 0,
    source: new Uint8Array(128),
    colormap: IDENTITY_COLORMAP,
    ...overrides,
  };
}

function makeSpanJob(overrides: Partial<SpanDrawJob> = {}): SpanDrawJob {
  return {
    x1: 0,
    x2: 0,
    y: 0,
    xFrac: 0,
    yFrac: 0,
    xStep: FRACUNIT,
    yStep: 0,
    source: new Uint8Array(FLAT_SIZE),
    colormap: IDENTITY_COLORMAP,
    ...overrides,
  };
}

describe('drawPrimitives constants', () => {
  test('COLUMN_HEIGHT_MASK is vanilla 127 (wall-texture column wraps at 128)', () => {
    expect(COLUMN_HEIGHT_MASK).toBe(127);
  });

  test('FLAT_DIMENSION is vanilla 64 (flat tile is 64x64 bytes)', () => {
    expect(FLAT_DIMENSION).toBe(64);
  });

  test('FLAT_SIZE is 4096 (64 * 64)', () => {
    expect(FLAT_SIZE).toBe(4096);
    expect(FLAT_SIZE).toBe(FLAT_DIMENSION * FLAT_DIMENSION);
  });

  test('FLAT_Y_SHIFT is FRACBITS - 6 = 10', () => {
    expect(FLAT_Y_SHIFT).toBe(FRACBITS - 6);
    expect(FLAT_Y_SHIFT).toBe(10);
  });

  test('FLAT_Y_MASK is 63 * 64 = 4032 (row-stride bits 6..11)', () => {
    expect(FLAT_Y_MASK).toBe(4032);
    expect(FLAT_Y_MASK).toBe((FLAT_DIMENSION - 1) * FLAT_DIMENSION);
  });

  test('FLAT_X_MASK is 63 (column bits 0..5)', () => {
    expect(FLAT_X_MASK).toBe(63);
    expect(FLAT_X_MASK).toBe(FLAT_DIMENSION - 1);
  });

  test('FLAT_Y_MASK and FLAT_X_MASK partition the bottom 12 bits without overlap', () => {
    expect(FLAT_Y_MASK & FLAT_X_MASK).toBe(0);
    expect(FLAT_Y_MASK | FLAT_X_MASK).toBe(FLAT_SIZE - 1);
  });
});

describe('rDrawColumn early-exit (vanilla count < 0 guard)', () => {
  test('yh < yl writes nothing into the framebuffer', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(128).fill(0x42);
    rDrawColumn(makeColumnJob({ x: 10, yl: 20, yh: 19, source }), fb);
    for (let i = 0; i < fb.length; i += 1) {
      expect(fb[i]).toBe(CANARY);
    }
  });

  test('yh === yl writes exactly one pixel (vanilla count === 0 single-row case)', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(128).fill(0x7f);
    rDrawColumn(makeColumnJob({ x: 5, yl: 0, yh: 0, source }), fb);
    expect(fb[5]).toBe(0x7f);
    expect(fb[SCREENWIDTH + 5]).toBe(CANARY);
  });
});

describe('rDrawColumn writes exactly yh - yl + 1 pixels at the correct stride', () => {
  test('identity step (iscale = FRACUNIT, textureMid = 0, centerY = 0) reads source[0..N]', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(128);
    for (let i = 0; i < source.length; i += 1) {
      source[i] = i & 0xff;
    }
    rDrawColumn(
      makeColumnJob({
        x: 0,
        yl: 0,
        yh: 3,
        iscale: FRACUNIT,
        textureMid: 0,
        centerY: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(0);
    expect(fb[SCREENWIDTH]).toBe(1);
    expect(fb[SCREENWIDTH * 2]).toBe(2);
    expect(fb[SCREENWIDTH * 3]).toBe(3);
    expect(fb[SCREENWIDTH * 4]).toBe(CANARY);
  });

  test('writes into the correct column (other columns untouched)', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(128).fill(0x33);
    rDrawColumn(makeColumnJob({ x: 100, yl: 10, yh: 14, source }), fb);
    for (let y = 0; y < SCREENHEIGHT; y += 1) {
      for (let x = 0; x < SCREENWIDTH; x += 1) {
        const expected = x === 100 && y >= 10 && y <= 14 ? 0x33 : CANARY;
        expect(fb[y * SCREENWIDTH + x]).toBe(expected);
      }
    }
  });

  test('per-row stride is exactly screenWidth bytes', () => {
    const fb = new Uint8Array(10 * 4).fill(CANARY);
    const source = new Uint8Array(128).fill(0x11);
    rDrawColumn(makeColumnJob({ x: 3, yl: 1, yh: 2, source }), fb, 10);
    expect(fb[1 * 10 + 3]).toBe(0x11);
    expect(fb[2 * 10 + 3]).toBe(0x11);
    expect(fb[0 * 10 + 3]).toBe(CANARY);
    expect(fb[3 * 10 + 3]).toBe(CANARY);
  });

  test('colormap is applied to every source byte', () => {
    const fb = makeFramebuffer();
    const source = Uint8Array.from({ length: 128 }, (_, i) => i);
    const colormap = Uint8Array.from({ length: 256 }, (_, i) => 255 - i);
    rDrawColumn(makeColumnJob({ x: 0, yl: 0, yh: 3, source, colormap }), fb);
    expect(fb[0]).toBe(255);
    expect(fb[SCREENWIDTH]).toBe(254);
    expect(fb[SCREENWIDTH * 2]).toBe(253);
    expect(fb[SCREENWIDTH * 3]).toBe(252);
  });
});

describe('rDrawColumn texturemid and iscale arithmetic', () => {
  test('textureMid = 2 * FRACUNIT at yl=centerY starts at source[2]', () => {
    const fb = makeFramebuffer();
    const source = Uint8Array.from({ length: 128 }, (_, i) => i);
    rDrawColumn(
      makeColumnJob({
        x: 0,
        yl: 5,
        yh: 7,
        centerY: 5,
        textureMid: 2 * FRACUNIT,
        iscale: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[5 * SCREENWIDTH]).toBe(2);
    expect(fb[6 * SCREENWIDTH]).toBe(3);
    expect(fb[7 * SCREENWIDTH]).toBe(4);
  });

  test('yl below centerY subtracts (centerY - yl) * iscale from texturemid', () => {
    const fb = makeFramebuffer();
    const source = Uint8Array.from({ length: 128 }, (_, i) => i);
    rDrawColumn(
      makeColumnJob({
        x: 0,
        yl: 3,
        yh: 5,
        centerY: 5,
        textureMid: 5 * FRACUNIT,
        iscale: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[3 * SCREENWIDTH]).toBe(3);
    expect(fb[4 * SCREENWIDTH]).toBe(4);
    expect(fb[5 * SCREENWIDTH]).toBe(5);
  });

  test('fractional iscale less than FRACUNIT advances slowly through source', () => {
    const fb = makeFramebuffer();
    const source = Uint8Array.from({ length: 128 }, (_, i) => i);
    const halfStep = FRACUNIT >> 1;
    rDrawColumn(
      makeColumnJob({
        x: 0,
        yl: 0,
        yh: 5,
        centerY: 0,
        textureMid: 0,
        iscale: halfStep,
        source,
      }),
      fb,
    );
    expect(fb[0 * SCREENWIDTH]).toBe(0);
    expect(fb[1 * SCREENWIDTH]).toBe(0);
    expect(fb[2 * SCREENWIDTH]).toBe(1);
    expect(fb[3 * SCREENWIDTH]).toBe(1);
    expect(fb[4 * SCREENWIDTH]).toBe(2);
    expect(fb[5 * SCREENWIDTH]).toBe(2);
  });
});

describe('rDrawColumn parity quirk: source index wraps modulo 128', () => {
  test('(frac >> FRACBITS) & 127 wraps past row 127 back to row 0', () => {
    const fb = makeFramebuffer();
    const source = Uint8Array.from({ length: 128 }, (_, i) => i);
    rDrawColumn(
      makeColumnJob({
        x: 0,
        yl: 126,
        yh: 129,
        centerY: 126,
        textureMid: 126 * FRACUNIT,
        iscale: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[126 * SCREENWIDTH]).toBe(126);
    expect(fb[127 * SCREENWIDTH]).toBe(127);
    expect(fb[128 * SCREENWIDTH]).toBe(0);
    expect(fb[129 * SCREENWIDTH]).toBe(1);
  });

  test('negative texture V wraps via signed right shift and then mask', () => {
    const fb = makeFramebuffer();
    const source = Uint8Array.from({ length: 128 }, (_, i) => i);
    rDrawColumn(
      makeColumnJob({
        x: 0,
        yl: 0,
        yh: 1,
        centerY: 0,
        textureMid: -FRACUNIT,
        iscale: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(127);
    expect(fb[SCREENWIDTH]).toBe(0);
  });
});

describe('rDrawSpan writes exactly x2 - x1 + 1 pixels at the correct stride', () => {
  test('single-pixel span (x1 === x2) writes one pixel at (x1, y)', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE).fill(0x55);
    rDrawSpan(makeSpanJob({ x1: 40, x2: 40, y: 7, source }), fb);
    expect(fb[7 * SCREENWIDTH + 40]).toBe(0x55);
    expect(fb[7 * SCREENWIDTH + 39]).toBe(CANARY);
    expect(fb[7 * SCREENWIDTH + 41]).toBe(CANARY);
  });

  test('multi-pixel span writes x2 - x1 + 1 consecutive framebuffer bytes', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let i = 0; i < source.length; i += 1) {
      source[i] = i & 0xff;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 3,
        y: 0,
        xFrac: 0,
        yFrac: 0,
        xStep: FRACUNIT,
        yStep: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(0);
    expect(fb[1]).toBe(1);
    expect(fb[2]).toBe(2);
    expect(fb[3]).toBe(3);
    expect(fb[4]).toBe(CANARY);
  });

  test('writes into the correct row (other rows untouched)', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE).fill(0x66);
    rDrawSpan(makeSpanJob({ x1: 10, x2: 12, y: 50, source }), fb);
    for (let y = 0; y < SCREENHEIGHT; y += 1) {
      for (let x = 0; x < SCREENWIDTH; x += 1) {
        const expected = y === 50 && x >= 10 && x <= 12 ? 0x66 : CANARY;
        expect(fb[y * SCREENWIDTH + x]).toBe(expected);
      }
    }
  });

  test('per-row stride is exactly screenWidth bytes', () => {
    const fb = new Uint8Array(6 * 4).fill(CANARY);
    const source = new Uint8Array(FLAT_SIZE).fill(0x22);
    rDrawSpan(makeSpanJob({ x1: 1, x2: 4, y: 2, source }), fb, 6);
    expect(fb[2 * 6 + 1]).toBe(0x22);
    expect(fb[2 * 6 + 2]).toBe(0x22);
    expect(fb[2 * 6 + 3]).toBe(0x22);
    expect(fb[2 * 6 + 4]).toBe(0x22);
    expect(fb[2 * 6 + 0]).toBe(CANARY);
    expect(fb[2 * 6 + 5]).toBe(CANARY);
  });

  test('colormap is applied to every source byte', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let i = 0; i < source.length; i += 1) {
      source[i] = i & 0xff;
    }
    const colormap = Uint8Array.from({ length: 256 }, (_, i) => 255 - i);
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 2,
        y: 0,
        xFrac: 0,
        yFrac: 0,
        xStep: FRACUNIT,
        yStep: 0,
        source,
        colormap,
      }),
      fb,
    );
    expect(fb[0]).toBe(255);
    expect(fb[1]).toBe(254);
    expect(fb[2]).toBe(253);
  });
});

describe('rDrawSpan spot arithmetic ((yFrac >> 10) & 4032) + ((xFrac >> 16) & 63)', () => {
  test('xStep = FRACUNIT with yFrac = 0 walks row 0 of the flat', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let i = 0; i < FLAT_DIMENSION; i += 1) {
      source[i] = i;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 4,
        y: 0,
        xFrac: 0,
        yFrac: 0,
        xStep: FRACUNIT,
        yStep: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(0);
    expect(fb[1]).toBe(1);
    expect(fb[2]).toBe(2);
    expect(fb[3]).toBe(3);
    expect(fb[4]).toBe(4);
  });

  test('yStep = FRACUNIT with xFrac = 0 walks column 0 of the flat (jumps by 64 per step)', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let row = 0; row < FLAT_DIMENSION; row += 1) {
      source[row * FLAT_DIMENSION] = row;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 3,
        y: 0,
        xFrac: 0,
        yFrac: 0,
        xStep: 0,
        yStep: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(0);
    expect(fb[1]).toBe(1);
    expect(fb[2]).toBe(2);
    expect(fb[3]).toBe(3);
  });

  test('xStep and yStep combined sample a diagonal of the flat', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let row = 0; row < FLAT_DIMENSION; row += 1) {
      for (let col = 0; col < FLAT_DIMENSION; col += 1) {
        source[row * FLAT_DIMENSION + col] = ((row + col) & 0xff) ^ 0x5a;
      }
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 3,
        y: 0,
        xFrac: 0,
        yFrac: 0,
        xStep: FRACUNIT,
        yStep: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(0x5a);
    expect(fb[1]).toBe((2 & 0xff) ^ 0x5a);
    expect(fb[2]).toBe((4 & 0xff) ^ 0x5a);
    expect(fb[3]).toBe((6 & 0xff) ^ 0x5a);
  });
});

describe('rDrawSpan parity quirk: spot wraps modulo 64 in both axes', () => {
  test('xFrac past the 64th column wraps modulo 64 via & 63', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let col = 0; col < FLAT_DIMENSION; col += 1) {
      source[col] = col;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 2,
        y: 0,
        xFrac: 63 * FRACUNIT,
        yFrac: 0,
        xStep: FRACUNIT,
        yStep: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(63);
    expect(fb[1]).toBe(0);
    expect(fb[2]).toBe(1);
  });

  test('yFrac past the 64th row wraps modulo 64 via & 4032 mask', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let row = 0; row < FLAT_DIMENSION; row += 1) {
      source[row * FLAT_DIMENSION] = row;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 2,
        y: 0,
        xFrac: 0,
        yFrac: 63 * FRACUNIT,
        xStep: 0,
        yStep: FRACUNIT,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(63);
    expect(fb[1]).toBe(0);
    expect(fb[2]).toBe(1);
  });

  test('negative xFrac wraps via signed right shift then & 63', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let col = 0; col < FLAT_DIMENSION; col += 1) {
      source[col] = col;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 0,
        y: 0,
        xFrac: -FRACUNIT,
        yFrac: 0,
        xStep: 0,
        yStep: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(63);
  });

  test('negative yFrac wraps via signed right shift then & 4032 mask', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    for (let row = 0; row < FLAT_DIMENSION; row += 1) {
      source[row * FLAT_DIMENSION] = row;
    }
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 0,
        y: 0,
        xFrac: 0,
        yFrac: -FRACUNIT,
        xStep: 0,
        yStep: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(63);
  });

  test('spot index stays within FLAT_SIZE for extreme positive yFrac', () => {
    const fb = makeFramebuffer();
    const source = new Uint8Array(FLAT_SIZE);
    source[FLAT_SIZE - 1] = 0x99;
    rDrawSpan(
      makeSpanJob({
        x1: 0,
        x2: 0,
        y: 0,
        xFrac: 63 * FRACUNIT,
        yFrac: 63 * FRACUNIT,
        xStep: 0,
        yStep: 0,
        source,
      }),
      fb,
    );
    expect(fb[0]).toBe(0x99);
  });
});
