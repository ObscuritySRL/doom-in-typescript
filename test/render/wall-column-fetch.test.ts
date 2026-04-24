import { describe, expect, test } from 'bun:test';

import { PATCH_COLUMN_END_MARKER, PATCH_COLUMN_OFFSET_BYTES, PATCH_HEADER_BYTES, POST_HEADER_BYTES, POST_TRAILING_PAD_BYTES, decodePatch } from '../../src/render/patchDraw.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import { computeTextureWidthMask, getWallColumn, prepareWallTexture } from '../../src/render/wallColumns.ts';
import type { WallPatchPlacement } from '../../src/render/wallColumns.ts';

interface SyntheticPost {
  readonly topDelta: number;
  readonly pixels: readonly number[];
}

function buildPatchLump(params: { readonly width: number; readonly height: number; readonly columns: readonly (readonly SyntheticPost[])[] }): Uint8Array {
  const { columns, height, width } = params;
  if (columns.length !== width) {
    throw new Error(`column count ${columns.length} does not match width ${width}`);
  }
  const columnBytes: Uint8Array[] = columns.map((posts) => {
    const totalBytes = posts.reduce((sum, post) => sum + POST_HEADER_BYTES + post.pixels.length + POST_TRAILING_PAD_BYTES, 0) + 1;
    const bytes = new Uint8Array(totalBytes);
    let cursor = 0;
    for (const post of posts) {
      bytes[cursor] = post.topDelta & 0xff;
      bytes[cursor + 1] = post.pixels.length & 0xff;
      bytes[cursor + 2] = 0x00;
      for (let i = 0; i < post.pixels.length; i += 1) {
        bytes[cursor + POST_HEADER_BYTES + i] = post.pixels[i]! & 0xff;
      }
      bytes[cursor + POST_HEADER_BYTES + post.pixels.length] = 0x00;
      cursor += POST_HEADER_BYTES + post.pixels.length + POST_TRAILING_PAD_BYTES;
    }
    bytes[cursor] = PATCH_COLUMN_END_MARKER;
    return bytes;
  });

  const columnTableBytes = width * PATCH_COLUMN_OFFSET_BYTES;
  const headerBytes = PATCH_HEADER_BYTES + columnTableBytes;
  const totalBytes = headerBytes + columnBytes.reduce((sum, bytes) => sum + bytes.length, 0);
  const lump = new Uint8Array(totalBytes);
  const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);

  view.setInt16(0, width, true);
  view.setInt16(2, height, true);
  view.setInt16(4, 0, true);
  view.setInt16(6, 0, true);

  let columnStart = headerBytes;
  for (let col = 0; col < width; col += 1) {
    view.setInt32(PATCH_HEADER_BYTES + col * PATCH_COLUMN_OFFSET_BYTES, columnStart, true);
    const bytes = columnBytes[col]!;
    lump.set(bytes, columnStart);
    columnStart += bytes.length;
  }
  return lump;
}

function makeSolidPatch(width: number, height: number, columnByte: (col: number, row: number) => number): DecodedPatch {
  const columns: readonly SyntheticPost[][] = Array.from({ length: width }, (_, col) => [
    {
      topDelta: 0,
      pixels: Array.from({ length: height }, (_, row) => columnByte(col, row)),
    },
  ]);
  return decodePatch(buildPatchLump({ width, height, columns }));
}

describe('computeTextureWidthMask', () => {
  test('returns 0 for width=0', () => {
    expect(computeTextureWidthMask(0)).toBe(0);
  });

  test('returns 0 for negative width (defensive)', () => {
    expect(computeTextureWidthMask(-1)).toBe(0);
    expect(computeTextureWidthMask(-128)).toBe(0);
  });

  test('returns 0 for width=1 (j stays at 1, mask = j - 1 = 0)', () => {
    expect(computeTextureWidthMask(1)).toBe(0);
  });

  test('returns (width - 1) for power-of-2 widths', () => {
    expect(computeTextureWidthMask(2)).toBe(1);
    expect(computeTextureWidthMask(4)).toBe(3);
    expect(computeTextureWidthMask(8)).toBe(7);
    expect(computeTextureWidthMask(16)).toBe(15);
    expect(computeTextureWidthMask(32)).toBe(31);
    expect(computeTextureWidthMask(64)).toBe(63);
    expect(computeTextureWidthMask(128)).toBe(127);
    expect(computeTextureWidthMask(256)).toBe(255);
    expect(computeTextureWidthMask(512)).toBe(511);
  });

  test('returns largest-power-of-2-below mask for non-power-of-2 widths (vanilla wrap quirk)', () => {
    expect(computeTextureWidthMask(3)).toBe(1);
    expect(computeTextureWidthMask(5)).toBe(3);
    expect(computeTextureWidthMask(63)).toBe(31);
    expect(computeTextureWidthMask(65)).toBe(63);
    expect(computeTextureWidthMask(96)).toBe(63);
    expect(computeTextureWidthMask(100)).toBe(63);
    expect(computeTextureWidthMask(127)).toBe(63);
    expect(computeTextureWidthMask(192)).toBe(127);
    expect(computeTextureWidthMask(320)).toBe(255);
  });
});

describe('prepareWallTexture — input validation', () => {
  test('rejects negative width', () => {
    expect(() => prepareWallTexture('BAD', -1, 128, [])).toThrow(RangeError);
  });

  test('rejects negative height', () => {
    expect(() => prepareWallTexture('BAD', 64, -1, [])).toThrow(RangeError);
  });
  test('rejects non-integer width', () => {
    expect(() => prepareWallTexture('BAD', Number.NaN, 128, [])).toThrow(RangeError);
    expect(() => prepareWallTexture('BAD', 1.5, 128, [])).toThrow(RangeError);
  });
  test('rejects non-integer height', () => {
    expect(() => prepareWallTexture('BAD', 64, Number.NaN, [])).toThrow(RangeError);
    expect(() => prepareWallTexture('BAD', 64, 127.5, [])).toThrow(RangeError);
  });

  test('width=0 prepares with empty columns array', () => {
    const tex = prepareWallTexture('EMPTY', 0, 128, []);
    expect(tex.width).toBe(0);
    expect(tex.columns.length).toBe(0);
    expect(tex.composite.length).toBe(0);
    expect(tex.widthMask).toBe(0);
  });

  test('freezes the returned object and columns array', () => {
    const patch = makeSolidPatch(32, 128, (col) => col);
    const tex = prepareWallTexture('NAME', 32, 128, [{ originX: 0, originY: 0, patch }]);
    expect(Object.isFrozen(tex)).toBe(true);
    expect(Object.isFrozen(tex.columns)).toBe(true);
  });
});

describe('prepareWallTexture — single-patch textures (matches vanilla lump+3 shortcut)', () => {
  test('full-width single patch: every column aliases its patch post pixels', () => {
    const patch = makeSolidPatch(64, 128, (col, row) => (col * 31 + row) & 0xff);
    const tex = prepareWallTexture('STARTAN', 64, 128, [{ originX: 0, originY: 0, patch }]);
    expect(tex.widthMask).toBe(63);
    expect(tex.composite.length).toBe(0);
    for (let col = 0; col < 64; col += 1) {
      const column = getWallColumn(tex, col);
      expect(column.length).toBe(128);
      for (let row = 0; row < 128; row += 1) {
        expect(column[row]).toBe((col * 31 + row) & 0xff);
      }
    }
  });

  test('column fetch wraps via widthMask (col=128 reads column 0 when width=128)', () => {
    const patch = makeSolidPatch(128, 128, (col) => col);
    const tex = prepareWallTexture('W128', 128, 128, [{ originX: 0, originY: 0, patch }]);
    expect(getWallColumn(tex, 0)[0]).toBe(0);
    expect(getWallColumn(tex, 128)[0]).toBe(0);
    expect(getWallColumn(tex, 255)[0]).toBe(127);
    expect(getWallColumn(tex, 256)[0]).toBe(0);
  });

  test('negative col wraps via mask using JS int32 two-s-complement bitwise AND', () => {
    const patch = makeSolidPatch(64, 128, (col) => col);
    const tex = prepareWallTexture('W64', 64, 128, [{ originX: 0, originY: 0, patch }]);
    expect(tex.widthMask).toBe(63);
    expect((-1 & 63) >>> 0).toBe(63);
    expect(getWallColumn(tex, -1)[0]).toBe(63);
    expect(getWallColumn(tex, -64)[0]).toBe(0);
    expect(getWallColumn(tex, -65)[0]).toBe(63);
  });

  test('non-power-of-2 width wraps prematurely (columns past mask+1 alias earlier ones)', () => {
    const patch = makeSolidPatch(96, 128, (col) => col);
    const tex = prepareWallTexture('W96', 96, 128, [{ originX: 0, originY: 0, patch }]);
    expect(tex.widthMask).toBe(63);
    expect(getWallColumn(tex, 0)[0]).toBe(0);
    expect(getWallColumn(tex, 32)[0]).toBe(32);
    expect(getWallColumn(tex, 63)[0]).toBe(63);
    expect(getWallColumn(tex, 64)[0]).toBe(0);
    expect(getWallColumn(tex, 95)[0]).toBe(31);
    expect(getWallColumn(tex, 96)[0]).toBe(32);
  });

  test('single-patch column aliases the decoded patch post pixel buffer (reference equality)', () => {
    const patch = makeSolidPatch(16, 64, (col, row) => (col + row) & 0xff);
    const tex = prepareWallTexture('ALIAS', 16, 64, [{ originX: 0, originY: 0, patch }]);
    const column = getWallColumn(tex, 7);
    const post = patch.columns[7]![0]!;
    expect(column).toBe(post.pixels);
  });

  test('empty column (no posts) produces an empty buffer', () => {
    const patchLump = buildPatchLump({
      width: 4,
      height: 32,
      columns: [[{ topDelta: 0, pixels: [1, 1, 1, 1] }], [], [{ topDelta: 0, pixels: [2, 2, 2, 2] }], [{ topDelta: 0, pixels: [3, 3, 3, 3] }]],
    });
    const patch = decodePatch(patchLump);
    const tex = prepareWallTexture('GAP', 4, 32, [{ originX: 0, originY: 0, patch }]);
    expect(getWallColumn(tex, 0).length).toBe(4);
    expect(getWallColumn(tex, 1).length).toBe(0);
    expect(getWallColumn(tex, 2).length).toBe(4);
    expect(getWallColumn(tex, 3).length).toBe(4);
  });
});

describe('prepareWallTexture — composite textures (R_GenerateComposite)', () => {
  test('allows an exact 64 KiB composite buffer', () => {
    const background = makeSolidPatch(256, 1, () => 0xaa);
    const foreground = makeSolidPatch(256, 1, () => 0xbb);
    const tex = prepareWallTexture('BOUNDARY', 256, 256, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 0, patch: foreground },
    ]);
    expect(tex.composite.length).toBe(0x1_0000);
  });

  test('rejects composite buffers larger than vanilla 64 KiB', () => {
    const background = makeSolidPatch(257, 1, () => 0xaa);
    const foreground = makeSolidPatch(257, 1, () => 0xbb);
    expect(() =>
      prepareWallTexture('TOOBIG', 257, 256, [
        { originX: 0, originY: 0, patch: background },
        { originX: 0, originY: 0, patch: foreground },
      ]),
    ).toThrow(new RangeError('R_GenerateLookup: texture TOOBIG is >64k'));
  });

  test('two non-overlapping patches produce two single-patch halves, no composite', () => {
    const leftPatch = makeSolidPatch(64, 128, (col, row) => (0x10 + row) & 0xff);
    const rightPatch = makeSolidPatch(64, 128, (col, row) => (0x80 + row) & 0xff);
    const tex = prepareWallTexture('PAIR', 128, 128, [
      { originX: 0, originY: 0, patch: leftPatch },
      { originX: 64, originY: 0, patch: rightPatch },
    ]);
    expect(tex.composite.length).toBe(0);
    expect(tex.widthMask).toBe(127);
    expect(getWallColumn(tex, 0)[0]).toBe(0x10);
    expect(getWallColumn(tex, 63)[10]).toBe(0x10 + 10);
    expect(getWallColumn(tex, 64)[0]).toBe(0x80);
    expect(getWallColumn(tex, 127)[10]).toBe(0x80 + 10);
  });

  test('two patches fully overlapping produce composite for every column (later overwrites earlier)', () => {
    const background = makeSolidPatch(8, 16, () => 0xaa);
    const foreground = makeSolidPatch(8, 16, () => 0xbb);
    const tex = prepareWallTexture('OVER', 8, 16, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 0, patch: foreground },
    ]);
    expect(tex.composite.length).toBe(8 * 16);
    for (let col = 0; col < 8; col += 1) {
      const column = getWallColumn(tex, col);
      expect(column.length).toBe(16);
      for (let row = 0; row < 16; row += 1) {
        expect(column[row]).toBe(0xbb);
      }
    }
  });

  test('later patch with a post on only some rows leaves earlier patch visible in gap rows', () => {
    const background = makeSolidPatch(4, 32, () => 0x11);
    const foregroundLump = buildPatchLump({
      width: 4,
      height: 32,
      columns: [[{ topDelta: 8, pixels: [0x22, 0x22, 0x22, 0x22] }], [{ topDelta: 8, pixels: [0x22, 0x22, 0x22, 0x22] }], [{ topDelta: 8, pixels: [0x22, 0x22, 0x22, 0x22] }], [{ topDelta: 8, pixels: [0x22, 0x22, 0x22, 0x22] }]],
    });
    const foreground = decodePatch(foregroundLump);
    const tex = prepareWallTexture('GAP2', 4, 32, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 0, patch: foreground },
    ]);
    expect(tex.composite.length).toBe(4 * 32);
    for (let col = 0; col < 4; col += 1) {
      const column = getWallColumn(tex, col);
      for (let row = 0; row < 32; row += 1) {
        if (row >= 8 && row < 12) {
          expect(column[row]).toBe(0x22);
        } else {
          expect(column[row]).toBe(0x11);
        }
      }
    }
  });

  test('patch originY offsets posts vertically in the composite', () => {
    const background = makeSolidPatch(2, 16, () => 0x00);
    const foregroundLump = buildPatchLump({
      width: 2,
      height: 4,
      columns: [[{ topDelta: 0, pixels: [0xaa, 0xbb, 0xcc, 0xdd] }], [{ topDelta: 0, pixels: [0x11, 0x22, 0x33, 0x44] }]],
    });
    const foreground = decodePatch(foregroundLump);
    const tex = prepareWallTexture('OFFSET', 2, 16, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 5, patch: foreground },
    ]);
    const col0 = getWallColumn(tex, 0);
    expect(col0[4]).toBe(0x00);
    expect(col0[5]).toBe(0xaa);
    expect(col0[6]).toBe(0xbb);
    expect(col0[7]).toBe(0xcc);
    expect(col0[8]).toBe(0xdd);
    expect(col0[9]).toBe(0x00);
    const col1 = getWallColumn(tex, 1);
    expect(col1[5]).toBe(0x11);
    expect(col1[8]).toBe(0x44);
  });

  test('composite columns are adjacent views into the composite buffer (height bytes each)', () => {
    const a = makeSolidPatch(4, 8, () => 0x01);
    const b = makeSolidPatch(4, 8, () => 0x02);
    const tex = prepareWallTexture('BUF', 4, 8, [
      { originX: 0, originY: 0, patch: a },
      { originX: 0, originY: 0, patch: b },
    ]);
    expect(tex.composite.length).toBe(4 * 8);
    for (let col = 0; col < 4; col += 1) {
      const view = getWallColumn(tex, col);
      expect(view.length).toBe(8);
      expect(view.buffer).toBe(tex.composite.buffer);
      expect(view.byteOffset - tex.composite.byteOffset).toBe(col * 8);
    }
  });
});

describe('prepareWallTexture — patch clipping (originX past edges)', () => {
  test('patch placed at negative originX has its left columns clipped off', () => {
    const patch = makeSolidPatch(16, 8, (col) => col);
    const tex = prepareWallTexture('LEFT', 16, 8, [{ originX: -4, originY: 0, patch }]);
    expect(tex.widthMask).toBe(15);
    expect(tex.composite.length).toBe(0);
    for (let texCol = 0; texCol < 12; texCol += 1) {
      const patchCol = texCol + 4;
      expect(getWallColumn(tex, texCol)[0]).toBe(patchCol);
    }
    for (let texCol = 12; texCol < 16; texCol += 1) {
      expect(getWallColumn(tex, texCol).length).toBe(0);
    }
  });

  test('patch placed past the right edge has its right columns clipped off', () => {
    const patch = makeSolidPatch(16, 8, (col) => col);
    const tex = prepareWallTexture('RIGHT', 16, 8, [{ originX: 8, originY: 0, patch }]);
    for (let texCol = 0; texCol < 8; texCol += 1) {
      expect(getWallColumn(tex, texCol).length).toBe(0);
    }
    for (let texCol = 8; texCol < 16; texCol += 1) {
      expect(getWallColumn(tex, texCol)[0]).toBe(texCol - 8);
    }
  });

  test('patch placed entirely past the right edge does not contribute any columns', () => {
    const cover = makeSolidPatch(16, 8, () => 0xff);
    const outside = makeSolidPatch(16, 8, () => 0x11);
    const tex = prepareWallTexture('OUTSIDE', 16, 8, [
      { originX: 0, originY: 0, patch: cover },
      { originX: 100, originY: 0, patch: outside },
    ]);
    expect(tex.composite.length).toBe(0);
    for (let texCol = 0; texCol < 16; texCol += 1) {
      expect(getWallColumn(tex, texCol)[0]).toBe(0xff);
    }
  });

  test('columns with no patch coverage return an empty Uint8Array', () => {
    const patch = makeSolidPatch(4, 8, () => 0x77);
    const tex = prepareWallTexture('GAPS', 16, 8, [{ originX: 2, originY: 0, patch }]);
    expect(getWallColumn(tex, 0).length).toBe(0);
    expect(getWallColumn(tex, 1).length).toBe(0);
    expect(getWallColumn(tex, 2)[0]).toBe(0x77);
    expect(getWallColumn(tex, 5)[0]).toBe(0x77);
    expect(getWallColumn(tex, 6).length).toBe(0);
    expect(getWallColumn(tex, 15).length).toBe(0);
  });
});

describe('R_DrawColumnInCache parity quirks', () => {
  test('position + count > cacheHeight clips count to the buffer tail', () => {
    const background = makeSolidPatch(2, 16, () => 0x00);
    const tailLump = buildPatchLump({
      width: 2,
      height: 20,
      columns: [[{ topDelta: 10, pixels: [0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa] }], [{ topDelta: 10, pixels: [0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba] }]],
    });
    const tail = decodePatch(tailLump);
    const tex = prepareWallTexture('TAIL', 2, 16, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 0, patch: tail },
    ]);
    const col = getWallColumn(tex, 0);
    expect(col.length).toBe(16);
    expect(col[9]).toBe(0x00);
    expect(col[10]).toBe(0xa1);
    expect(col[15]).toBe(0xa6);
  });

  test('position < 0 reduces count but source stays at pixels[0] (vanilla R_DrawColumnInCache bug)', () => {
    const background = makeSolidPatch(1, 16, () => 0x00);
    const topLump = buildPatchLump({
      width: 1,
      height: 8,
      columns: [[{ topDelta: 0, pixels: [0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7] }]],
    });
    const top = decodePatch(topLump);
    const tex = prepareWallTexture('TOPBUG', 1, 16, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: -2, patch: top },
    ]);
    const col = getWallColumn(tex, 0);
    expect(col.length).toBe(16);
    expect(col[0]).toBe(0xa0);
    expect(col[1]).toBe(0xa1);
    expect(col[2]).toBe(0xa2);
    expect(col[3]).toBe(0xa3);
    expect(col[4]).toBe(0xa4);
    expect(col[5]).toBe(0xa5);
    expect(col[6]).toBe(0x00);
    expect(col[7]).toBe(0x00);
  });

  test('entirely off-top post (position + count <= 0) writes nothing', () => {
    const background = makeSolidPatch(1, 16, () => 0x00);
    const offLump = buildPatchLump({
      width: 1,
      height: 4,
      columns: [[{ topDelta: 0, pixels: [0xd0, 0xd1, 0xd2, 0xd3] }]],
    });
    const off = decodePatch(offLump);
    const tex = prepareWallTexture('OFFTOP', 1, 16, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: -4, patch: off },
    ]);
    const col = getWallColumn(tex, 0);
    for (let row = 0; row < 16; row += 1) {
      expect(col[row]).toBe(0x00);
    }
  });

  test('post extending past the bottom is clipped (cacheHeight guard)', () => {
    const background = makeSolidPatch(1, 4, () => 0x00);
    const longLump = buildPatchLump({
      width: 1,
      height: 16,
      columns: [[{ topDelta: 0, pixels: Array.from({ length: 16 }, (_, i) => (0x10 + i) & 0xff) }]],
    });
    const long = decodePatch(longLump);
    const tex = prepareWallTexture('LONG', 1, 4, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 0, patch: long },
    ]);
    const col = getWallColumn(tex, 0);
    expect(col.length).toBe(4);
    expect(col[0]).toBe(0x10);
    expect(col[1]).toBe(0x11);
    expect(col[2]).toBe(0x12);
    expect(col[3]).toBe(0x13);
  });

  test('multi-post column composites every post in order', () => {
    const background = makeSolidPatch(1, 16, () => 0x00);
    const multiLump = buildPatchLump({
      width: 1,
      height: 16,
      columns: [
        [
          { topDelta: 0, pixels: [0xa0, 0xa1] },
          { topDelta: 5, pixels: [0xb0, 0xb1, 0xb2] },
          { topDelta: 12, pixels: [0xc0] },
        ],
      ],
    });
    const multi = decodePatch(multiLump);
    const tex = prepareWallTexture('MULTI', 1, 16, [
      { originX: 0, originY: 0, patch: background },
      { originX: 0, originY: 0, patch: multi },
    ]);
    const col = getWallColumn(tex, 0);
    expect(col[0]).toBe(0xa0);
    expect(col[1]).toBe(0xa1);
    expect(col[2]).toBe(0x00);
    expect(col[4]).toBe(0x00);
    expect(col[5]).toBe(0xb0);
    expect(col[6]).toBe(0xb1);
    expect(col[7]).toBe(0xb2);
    expect(col[8]).toBe(0x00);
    expect(col[11]).toBe(0x00);
    expect(col[12]).toBe(0xc0);
    expect(col[13]).toBe(0x00);
    expect(col[15]).toBe(0x00);
  });
});

describe('getWallColumn reference stability', () => {
  test('repeated fetches of the same column return the same Uint8Array instance', () => {
    const patch = makeSolidPatch(8, 16, (col) => col);
    const tex = prepareWallTexture('REPEAT', 8, 16, [{ originX: 0, originY: 0, patch }]);
    const first = getWallColumn(tex, 3);
    const second = getWallColumn(tex, 3);
    const wrapped = getWallColumn(tex, 3 + 8);
    expect(second).toBe(first);
    expect(wrapped).toBe(first);
  });

  test('composite columns alias slices of the shared composite buffer', () => {
    const a = makeSolidPatch(4, 8, () => 0x01);
    const b = makeSolidPatch(4, 8, () => 0x02);
    const tex = prepareWallTexture('ALIASV', 4, 8, [
      { originX: 0, originY: 0, patch: a },
      { originX: 0, originY: 0, patch: b },
    ]);
    const col0 = getWallColumn(tex, 0);
    tex.composite[0] = 0xff;
    expect(col0[0]).toBe(0xff);
  });
});

describe('parity-sensitive integration (composite reproduces R_GenerateLookup + R_GenerateComposite)', () => {
  test('mix of single-patch and composite columns in one texture', () => {
    const broad: WallPatchPlacement = {
      originX: 0,
      originY: 0,
      patch: makeSolidPatch(16, 8, () => 0x11),
    };
    const narrowLump = buildPatchLump({
      width: 4,
      height: 8,
      columns: [
        [{ topDelta: 0, pixels: [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22] }],
        [{ topDelta: 0, pixels: [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22] }],
        [{ topDelta: 0, pixels: [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22] }],
        [{ topDelta: 0, pixels: [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22] }],
      ],
    });
    const narrow: WallPatchPlacement = {
      originX: 4,
      originY: 0,
      patch: decodePatch(narrowLump),
    };
    const tex = prepareWallTexture('MIX', 16, 8, [broad, narrow]);
    expect(tex.composite.length).toBe(4 * 8);
    for (let col = 0; col < 4; col += 1) {
      expect(getWallColumn(tex, col)[0]).toBe(0x11);
    }
    for (let col = 4; col < 8; col += 1) {
      const column = getWallColumn(tex, col);
      expect(column.length).toBe(8);
      for (let row = 0; row < 8; row += 1) {
        expect(column[row]).toBe(0x22);
      }
    }
    for (let col = 8; col < 16; col += 1) {
      expect(getWallColumn(tex, col)[0]).toBe(0x11);
    }
  });
});
