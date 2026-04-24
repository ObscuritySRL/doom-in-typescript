import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { FUZZ_COLORMAP_INDEX, FUZZ_COLORMAP_OFFSET, FUZZ_OFFSETS, FUZZ_TABLE_SIZE, getFuzzPos, rDrawFuzzColumn, resetFuzzPos, setFuzzPos } from '../../src/render/fuzz.ts';
import type { FuzzColumnJob } from '../../src/render/fuzz.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';

const VIEW_WIDTH = 16;
const VIEW_HEIGHT = 16;
const CANARY = 0xaa;
const PRE_FILL = 0x40;

function makeColormaps(): Uint8Array {
  const colormaps = new Uint8Array(32 * 256);
  for (let ramp = 0; ramp < 32; ramp += 1) {
    for (let i = 0; i < 256; i += 1) {
      colormaps[ramp * 256 + i] = ((ramp << 4) | (i & 0x0f)) & 0xff;
    }
  }
  return colormaps;
}

function makeFramebuffer(width: number = VIEW_WIDTH, height: number = VIEW_HEIGHT, fill: number = PRE_FILL): Uint8Array {
  return new Uint8Array(width * height).fill(fill);
}

function makeJob(overrides: Partial<FuzzColumnJob> = {}): FuzzColumnJob {
  return {
    x: 0,
    yl: 1,
    yh: VIEW_HEIGHT - 2,
    viewHeight: VIEW_HEIGHT,
    colormaps: makeColormaps(),
    ...overrides,
  };
}

beforeEach(() => {
  resetFuzzPos();
});

afterEach(() => {
  resetFuzzPos();
});

describe('fuzz constants', () => {
  test('FUZZ_TABLE_SIZE is vanilla 50 (#define FUZZTABLE 50)', () => {
    expect(FUZZ_TABLE_SIZE).toBe(50);
  });

  test('FUZZ_COLORMAP_INDEX is 6 (mid-brightness ramp in COLORMAP lump)', () => {
    expect(FUZZ_COLORMAP_INDEX).toBe(6);
  });

  test('FUZZ_COLORMAP_OFFSET is 6 * 256 = 1536', () => {
    expect(FUZZ_COLORMAP_OFFSET).toBe(6 * 256);
    expect(FUZZ_COLORMAP_OFFSET).toBe(1536);
  });
});

describe('FUZZ_OFFSETS table', () => {
  test('has exactly FUZZ_TABLE_SIZE entries', () => {
    expect(FUZZ_OFFSETS.length).toBe(FUZZ_TABLE_SIZE);
  });

  test('every entry is either +1 or -1', () => {
    for (const v of FUZZ_OFFSETS) {
      expect(v === 1 || v === -1).toBe(true);
    }
  });

  test('matches vanilla fuzzoffset[] sign sequence byte-for-byte', () => {
    const expected = [+1, -1, +1, -1, +1, +1, -1, +1, +1, -1, +1, +1, +1, -1, +1, +1, +1, -1, -1, -1, -1, +1, -1, -1, +1, +1, +1, +1, -1, +1, -1, +1, +1, -1, -1, +1, +1, -1, -1, -1, -1, +1, +1, +1, +1, -1, +1, +1, -1, +1];
    expect(expected.length).toBe(FUZZ_TABLE_SIZE);
    for (let i = 0; i < FUZZ_TABLE_SIZE; i += 1) {
      expect(FUZZ_OFFSETS[i]).toBe(expected[i]!);
    }
  });

  test('is frozen — attempting mutation throws in strict mode', () => {
    expect(() => {
      (FUZZ_OFFSETS as number[])[0] = 99;
    }).toThrow();
  });
});

describe('fuzzPos counter accessors', () => {
  test('getFuzzPos returns 0 after resetFuzzPos', () => {
    resetFuzzPos();
    expect(getFuzzPos()).toBe(0);
  });

  test('setFuzzPos pins the counter to a given value', () => {
    setFuzzPos(17);
    expect(getFuzzPos()).toBe(17);
  });

  test('setFuzzPos rejects negative values', () => {
    expect(() => setFuzzPos(-1)).toThrow(RangeError);
  });

  test('setFuzzPos rejects FUZZ_TABLE_SIZE and above', () => {
    expect(() => setFuzzPos(FUZZ_TABLE_SIZE)).toThrow(RangeError);
    expect(() => setFuzzPos(FUZZ_TABLE_SIZE + 1)).toThrow(RangeError);
  });

  test('setFuzzPos rejects non-integer values', () => {
    expect(() => setFuzzPos(1.5)).toThrow(RangeError);
    expect(() => setFuzzPos(Number.NaN)).toThrow(RangeError);
  });
});

describe('border adjustment', () => {
  test('yl === 0 is clamped up to 1 (never reads row -1)', () => {
    const fb = makeFramebuffer();
    for (let i = 0; i < VIEW_WIDTH; i += 1) {
      fb[i] = CANARY;
    }
    rDrawFuzzColumn(makeJob({ x: 0, yl: 0, yh: 0, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    expect(fb[0]).toBe(CANARY);
    expect(getFuzzPos()).toBe(0);
  });

  test('yh === viewHeight - 1 is clamped down to viewHeight - 2', () => {
    const fb = makeFramebuffer();
    const lastRowStart = (VIEW_HEIGHT - 1) * VIEW_WIDTH;
    for (let i = 0; i < VIEW_WIDTH; i += 1) {
      fb[lastRowStart + i] = CANARY;
    }
    rDrawFuzzColumn(makeJob({ x: 0, yl: VIEW_HEIGHT - 1, yh: VIEW_HEIGHT - 1, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    expect(fb[lastRowStart]).toBe(CANARY);
    expect(getFuzzPos()).toBe(0);
  });

  test('both bounds clamp in the same call: yl=0 yh=viewHeight-1 paints rows [1, viewHeight-2]', () => {
    const fb = makeFramebuffer();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 0, yh: VIEW_HEIGHT - 1, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    expect(fb[0 * VIEW_WIDTH + 0]).toBe(PRE_FILL);
    expect(fb[(VIEW_HEIGHT - 1) * VIEW_WIDTH + 0]).toBe(PRE_FILL);
    expect(fb[1 * VIEW_WIDTH + 0]).not.toBe(PRE_FILL);
    expect(fb[(VIEW_HEIGHT - 2) * VIEW_WIDTH + 0]).not.toBe(PRE_FILL);
    expect(getFuzzPos()).toBe(VIEW_HEIGHT - 2);
  });
});

describe('early-exit semantics', () => {
  test('yh < yl leaves framebuffer untouched and fuzzPos unchanged', () => {
    const fb = makeFramebuffer();
    const before = fb.slice();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 5, yh: 4, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    for (let i = 0; i < fb.length; i += 1) {
      expect(fb[i]).toBe(before[i]!);
    }
    expect(getFuzzPos()).toBe(0);
  });

  test('yh === yl writes exactly one row and advances fuzzPos by 1', () => {
    const fb = makeFramebuffer();
    rDrawFuzzColumn(makeJob({ x: 3, yl: 4, yh: 4, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    expect(fb[4 * VIEW_WIDTH + 3]).not.toBe(PRE_FILL);
    expect(getFuzzPos()).toBe(1);
  });

  test('border-clamped empty range (viewHeight=2, yl=1, yh=0 after clamp) early-exits without advancing counter', () => {
    const fb = makeFramebuffer();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 0, yh: 1, viewHeight: 2 }), fb, VIEW_WIDTH);
    expect(getFuzzPos()).toBe(0);
  });
});

describe('pixel sampling uses dest ± screenWidth', () => {
  test('positive offset (+1) samples the row BELOW dest', () => {
    resetFuzzPos();
    setFuzzPos(0);
    expect(FUZZ_OFFSETS[0]).toBe(+1);
    const fb = makeFramebuffer();
    const colormaps = makeColormaps();
    const belowRow = 6;
    const drawRow = 5;
    const drawCol = 2;
    fb[belowRow * VIEW_WIDTH + drawCol] = 0x07;
    rDrawFuzzColumn({ x: drawCol, yl: drawRow, yh: drawRow, viewHeight: VIEW_HEIGHT, colormaps }, fb, VIEW_WIDTH);
    expect(fb[drawRow * VIEW_WIDTH + drawCol]).toBe(colormaps[FUZZ_COLORMAP_OFFSET + 0x07]!);
  });

  test('negative offset (-1) samples the row ABOVE dest', () => {
    resetFuzzPos();
    setFuzzPos(1);
    expect(FUZZ_OFFSETS[1]).toBe(-1);
    const fb = makeFramebuffer();
    const colormaps = makeColormaps();
    const aboveRow = 4;
    const drawRow = 5;
    const drawCol = 3;
    fb[aboveRow * VIEW_WIDTH + drawCol] = 0x09;
    rDrawFuzzColumn({ x: drawCol, yl: drawRow, yh: drawRow, viewHeight: VIEW_HEIGHT, colormaps }, fb, VIEW_WIDTH);
    expect(fb[drawRow * VIEW_WIDTH + drawCol]).toBe(colormaps[FUZZ_COLORMAP_OFFSET + 0x09]!);
  });

  test('writes are routed through colormap row 6 (FUZZ_COLORMAP_OFFSET)', () => {
    resetFuzzPos();
    const fb = makeFramebuffer();
    const colormaps = new Uint8Array(32 * 256);
    colormaps[FUZZ_COLORMAP_OFFSET + PRE_FILL] = 0xfe;
    rDrawFuzzColumn(makeJob({ x: 0, yl: 5, yh: 5, viewHeight: VIEW_HEIGHT, colormaps }), fb, VIEW_WIDTH);
    expect(fb[5 * VIEW_WIDTH + 0]).toBe(0xfe);
  });

  test('columns outside x are untouched', () => {
    const fb = makeFramebuffer();
    rDrawFuzzColumn(makeJob({ x: 5, yl: 3, yh: 7, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    for (let row = 0; row < VIEW_HEIGHT; row += 1) {
      for (let col = 0; col < VIEW_WIDTH; col += 1) {
        if (col !== 5 || row < 3 || row > 7) {
          expect(fb[row * VIEW_WIDTH + col]).toBe(PRE_FILL);
        }
      }
    }
  });

  test('rows outside [yl, yh] are untouched', () => {
    const fb = makeFramebuffer();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 3, yh: 7, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    for (let row = 0; row < 3; row += 1) {
      expect(fb[row * VIEW_WIDTH + 0]).toBe(PRE_FILL);
    }
    for (let row = 8; row < VIEW_HEIGHT; row += 1) {
      expect(fb[row * VIEW_WIDTH + 0]).toBe(PRE_FILL);
    }
  });
});

describe('fuzzPos advancement', () => {
  test('advances by one per row painted', () => {
    resetFuzzPos();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 3, yh: 7, viewHeight: VIEW_HEIGHT }), makeFramebuffer(), VIEW_WIDTH);
    expect(getFuzzPos()).toBe(5);
  });

  test('does not advance when yh < yl', () => {
    setFuzzPos(12);
    rDrawFuzzColumn(makeJob({ x: 0, yl: 10, yh: 9, viewHeight: VIEW_HEIGHT }), makeFramebuffer(), VIEW_WIDTH);
    expect(getFuzzPos()).toBe(12);
  });

  test('persists across calls (second call continues from end of first)', () => {
    const fb = makeFramebuffer();
    resetFuzzPos();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 3, yh: 5, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    expect(getFuzzPos()).toBe(3);
    rDrawFuzzColumn(makeJob({ x: 1, yl: 3, yh: 6, viewHeight: VIEW_HEIGHT }), fb, VIEW_WIDTH);
    expect(getFuzzPos()).toBe(7);
  });

  test('wraps to 0 after the FUZZ_TABLE_SIZE-th advance', () => {
    setFuzzPos(FUZZ_TABLE_SIZE - 1);
    rDrawFuzzColumn(makeJob({ x: 0, yl: 3, yh: 3, viewHeight: VIEW_HEIGHT }), makeFramebuffer(), VIEW_WIDTH);
    expect(getFuzzPos()).toBe(0);
  });

  test('wraps multiple times over a long paint (≥ 2 × FUZZ_TABLE_SIZE rows)', () => {
    const tallViewHeight = 2 * FUZZ_TABLE_SIZE + 4;
    const fb = makeFramebuffer(VIEW_WIDTH, tallViewHeight);
    resetFuzzPos();
    rDrawFuzzColumn({ x: 0, yl: 1, yh: tallViewHeight - 2, viewHeight: tallViewHeight, colormaps: makeColormaps() }, fb, VIEW_WIDTH);
    const rowsPainted = tallViewHeight - 2;
    expect(getFuzzPos()).toBe(rowsPainted % FUZZ_TABLE_SIZE);
  });
});

describe('colormap routing', () => {
  test('source palette index 0 is mapped via colormap[FUZZ_COLORMAP_OFFSET + 0]', () => {
    resetFuzzPos();
    setFuzzPos(0);
    const colormaps = new Uint8Array(32 * 256);
    colormaps[FUZZ_COLORMAP_OFFSET + 0] = 0x55;
    const fb = makeFramebuffer(VIEW_WIDTH, VIEW_HEIGHT, 0);
    rDrawFuzzColumn({ x: 0, yl: 5, yh: 5, viewHeight: VIEW_HEIGHT, colormaps }, fb, VIEW_WIDTH);
    expect(fb[5 * VIEW_WIDTH + 0]).toBe(0x55);
  });

  test('source palette index 255 is mapped via colormap[FUZZ_COLORMAP_OFFSET + 255]', () => {
    resetFuzzPos();
    setFuzzPos(0);
    const colormaps = new Uint8Array(32 * 256);
    colormaps[FUZZ_COLORMAP_OFFSET + 255] = 0x88;
    const fb = makeFramebuffer(VIEW_WIDTH, VIEW_HEIGHT, 0);
    fb[6 * VIEW_WIDTH + 0] = 0xff;
    rDrawFuzzColumn({ x: 0, yl: 5, yh: 5, viewHeight: VIEW_HEIGHT, colormaps }, fb, VIEW_WIDTH);
    expect(fb[5 * VIEW_WIDTH + 0]).toBe(0x88);
  });

  test('different colormap lumps produce different output for the same source index', () => {
    resetFuzzPos();
    setFuzzPos(0);
    const cm1 = new Uint8Array(32 * 256);
    const cm2 = new Uint8Array(32 * 256);
    cm1[FUZZ_COLORMAP_OFFSET + PRE_FILL] = 0x11;
    cm2[FUZZ_COLORMAP_OFFSET + PRE_FILL] = 0x22;
    const fb1 = makeFramebuffer();
    const fb2 = makeFramebuffer();
    rDrawFuzzColumn(makeJob({ x: 0, yl: 5, yh: 5, viewHeight: VIEW_HEIGHT, colormaps: cm1 }), fb1, VIEW_WIDTH);
    resetFuzzPos();
    setFuzzPos(0);
    rDrawFuzzColumn(makeJob({ x: 0, yl: 5, yh: 5, viewHeight: VIEW_HEIGHT, colormaps: cm2 }), fb2, VIEW_WIDTH);
    expect(fb1[5 * VIEW_WIDTH + 0]).toBe(0x11);
    expect(fb2[5 * VIEW_WIDTH + 0]).toBe(0x22);
  });
});

describe('screenWidth parameter', () => {
  test('defaults to SCREENWIDTH when omitted', () => {
    resetFuzzPos();
    const fb = new Uint8Array(SCREENWIDTH * SCREENHEIGHT).fill(PRE_FILL);
    const colormaps = makeColormaps();
    rDrawFuzzColumn({ x: 10, yl: 5, yh: 5, viewHeight: SCREENHEIGHT, colormaps }, fb);
    expect(fb[5 * SCREENWIDTH + 10]).not.toBe(PRE_FILL);
  });

  test('custom screenWidth routes dest and the ±1-row sample via that stride', () => {
    resetFuzzPos();
    setFuzzPos(0);
    const customWidth = 8;
    const customHeight = 8;
    const fb = new Uint8Array(customWidth * customHeight).fill(PRE_FILL);
    const colormaps = new Uint8Array(32 * 256);
    colormaps[FUZZ_COLORMAP_OFFSET + 0x33] = 0xc4;
    fb[5 * customWidth + 2] = 0x33;
    rDrawFuzzColumn({ x: 2, yl: 4, yh: 4, viewHeight: customHeight, colormaps }, fb, customWidth);
    expect(fb[4 * customWidth + 2]).toBe(0xc4);
  });
});

describe('determinism across sequences', () => {
  test('same starting fuzzPos + identical inputs produces identical output', () => {
    const jobArgs = { x: 3, yl: 2, yh: 12, viewHeight: VIEW_HEIGHT } as const;
    const fb1 = makeFramebuffer();
    const fb2 = makeFramebuffer();
    resetFuzzPos();
    rDrawFuzzColumn(makeJob(jobArgs), fb1, VIEW_WIDTH);
    resetFuzzPos();
    rDrawFuzzColumn(makeJob(jobArgs), fb2, VIEW_WIDTH);
    for (let i = 0; i < fb1.length; i += 1) {
      expect(fb1[i]).toBe(fb2[i]!);
    }
  });

  test('different starting fuzzPos produces different column output (counter is load-bearing)', () => {
    const jobArgs = { x: 3, yl: 2, yh: 12, viewHeight: VIEW_HEIGHT } as const;
    const fb1 = makeFramebuffer();
    const fb2 = makeFramebuffer();
    for (let row = 0; row < VIEW_HEIGHT; row += 1) {
      for (let col = 0; col < VIEW_WIDTH; col += 1) {
        const value = (row * 7 + col * 3) & 0xff;
        fb1[row * VIEW_WIDTH + col] = value;
        fb2[row * VIEW_WIDTH + col] = value;
      }
    }
    setFuzzPos(0);
    rDrawFuzzColumn(makeJob(jobArgs), fb1, VIEW_WIDTH);
    setFuzzPos(7);
    rDrawFuzzColumn(makeJob(jobArgs), fb2, VIEW_WIDTH);
    let differences = 0;
    for (let i = 0; i < fb1.length; i += 1) {
      if (fb1[i] !== fb2[i]) {
        differences += 1;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });
});
