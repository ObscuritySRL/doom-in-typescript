import { describe, expect, test } from 'bun:test';

import { PATCH_COLUMN_END_MARKER, PATCH_COLUMN_OFFSET_BYTES, PATCH_HEADER_BYTES, POST_HEADER_BYTES, POST_TRAILING_PAD_BYTES, decodePatch, drawPatch } from '../../src/render/patchDraw.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';

const CANARY = 0xaa;

function makeFramebuffer(): Uint8Array {
  return new Uint8Array(SCREENWIDTH * SCREENHEIGHT).fill(CANARY);
}

interface SyntheticPost {
  readonly topDelta: number;
  readonly pixels: readonly number[];
}

function buildPatchLump(params: { readonly width: number; readonly height: number; readonly leftOffset: number; readonly topOffset: number; readonly columns: readonly (readonly SyntheticPost[])[] }): Uint8Array {
  const { columns, height, leftOffset, topOffset, width } = params;
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
  view.setInt16(4, leftOffset, true);
  view.setInt16(6, topOffset, true);

  let columnStart = headerBytes;
  for (let col = 0; col < width; col += 1) {
    view.setInt32(PATCH_HEADER_BYTES + col * PATCH_COLUMN_OFFSET_BYTES, columnStart, true);
    const bytes = columnBytes[col]!;
    lump.set(bytes, columnStart);
    columnStart += bytes.length;
  }
  return lump;
}

describe('patchDraw constants', () => {
  test('PATCH_HEADER_BYTES is vanilla 8 (width + height + leftOffset + topOffset)', () => {
    expect(PATCH_HEADER_BYTES).toBe(8);
  });

  test('PATCH_COLUMN_OFFSET_BYTES is 4 (int32 LE per column)', () => {
    expect(PATCH_COLUMN_OFFSET_BYTES).toBe(4);
  });

  test('PATCH_COLUMN_END_MARKER is 0xff (vanilla column terminator)', () => {
    expect(PATCH_COLUMN_END_MARKER).toBe(0xff);
  });

  test('POST_HEADER_BYTES is 3 (topDelta + length + leading pad)', () => {
    expect(POST_HEADER_BYTES).toBe(3);
  });

  test('POST_TRAILING_PAD_BYTES is 1 (trailing pad after pixel run)', () => {
    expect(POST_TRAILING_PAD_BYTES).toBe(1);
  });
});

describe('decodePatch header', () => {
  test('reads width, height, leftOffset, topOffset as little-endian int16', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 2,
      leftOffset: 3,
      topOffset: 4,
      columns: [[]],
    });
    const patch = decodePatch(lump);
    expect(patch.header.width).toBe(1);
    expect(patch.header.height).toBe(2);
    expect(patch.header.leftOffset).toBe(3);
    expect(patch.header.topOffset).toBe(4);
  });

  test('leftOffset and topOffset are signed (negative values round-trip)', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 1,
      leftOffset: -5,
      topOffset: -7,
      columns: [[]],
    });
    const patch = decodePatch(lump);
    expect(patch.header.leftOffset).toBe(-5);
    expect(patch.header.topOffset).toBe(-7);
  });

  test('throws RangeError when buffer is smaller than the header', () => {
    const lump = new Uint8Array(7);
    expect(() => decodePatch(lump)).toThrow(RangeError);
  });

  test('throws RangeError when buffer cannot hold the column-offset table', () => {
    const lump = new Uint8Array(PATCH_HEADER_BYTES + 2);
    const view = new DataView(lump.buffer);
    view.setInt16(0, 4, true);
    expect(() => decodePatch(lump)).toThrow(RangeError);
  });
});

describe('decodePatch column and post parsing', () => {
  test('empty column (only end marker) decodes as zero posts', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 1,
      leftOffset: 0,
      topOffset: 0,
      columns: [[]],
    });
    const patch = decodePatch(lump);
    expect(patch.columns.length).toBe(1);
    expect(patch.columns[0]!.length).toBe(0);
  });

  test('single-post column exposes topDelta, length, and pixel bytes', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 4,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x10, 0x11, 0x12, 0x13] }]],
    });
    const patch = decodePatch(lump);
    expect(patch.columns[0]!.length).toBe(1);
    const post = patch.columns[0]![0]!;
    expect(post.topDelta).toBe(0);
    expect(post.length).toBe(4);
    expect(Array.from(post.pixels)).toEqual([0x10, 0x11, 0x12, 0x13]);
  });

  test('multiple posts per column preserve order and topDelta values', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 10,
      leftOffset: 0,
      topOffset: 0,
      columns: [
        [
          { topDelta: 0, pixels: [0x01, 0x02] },
          { topDelta: 5, pixels: [0x03, 0x04, 0x05] },
        ],
      ],
    });
    const patch = decodePatch(lump);
    const posts = patch.columns[0]!;
    expect(posts.length).toBe(2);
    expect(posts[0]!.topDelta).toBe(0);
    expect(Array.from(posts[0]!.pixels)).toEqual([0x01, 0x02]);
    expect(posts[1]!.topDelta).toBe(5);
    expect(Array.from(posts[1]!.pixels)).toEqual([0x03, 0x04, 0x05]);
  });

  test('columns are independently indexed via columnOffsets table (not sequential)', () => {
    const lump = buildPatchLump({
      width: 3,
      height: 2,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0xaa] }], [], [{ topDelta: 1, pixels: [0xbb, 0xcc] }]],
    });
    const patch = decodePatch(lump);
    expect(patch.columns.length).toBe(3);
    expect(patch.columns[0]!.length).toBe(1);
    expect(patch.columns[0]![0]!.pixels[0]).toBe(0xaa);
    expect(patch.columns[1]!.length).toBe(0);
    expect(patch.columns[2]!.length).toBe(1);
    expect(patch.columns[2]![0]!.topDelta).toBe(1);
    expect(Array.from(patch.columns[2]![0]!.pixels)).toEqual([0xbb, 0xcc]);
  });

  test('decoded patch is frozen at every level', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 1,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x42] }]],
    });
    const patch = decodePatch(lump);
    expect(Object.isFrozen(patch)).toBe(true);
    expect(Object.isFrozen(patch.header)).toBe(true);
    expect(Object.isFrozen(patch.columns)).toBe(true);
    expect(Object.isFrozen(patch.columns[0])).toBe(true);
    expect(Object.isFrozen(patch.columns[0]![0])).toBe(true);
  });

  test('throws RangeError when a column offset points past the buffer', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 1,
      leftOffset: 0,
      topOffset: 0,
      columns: [[]],
    });
    const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
    view.setInt32(PATCH_HEADER_BYTES, lump.length + 100, true);
    expect(() => decodePatch(lump)).toThrow(RangeError);
  });

  test('throws RangeError when a post pixel run extends past the buffer', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 4,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x10, 0x11] }]],
    });
    const columnOffset = new DataView(lump.buffer, lump.byteOffset, lump.byteLength).getInt32(PATCH_HEADER_BYTES, true);
    lump[columnOffset + 1] = 200;
    expect(() => decodePatch(lump)).toThrow(RangeError);
  });
});

describe('drawPatch writes in-bounds pixels to the framebuffer', () => {
  test('single-post single-column patch writes one column of pixels', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 4,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x11, 0x22, 0x33, 0x44] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 10, 20, framebuffer);
    expect(framebuffer[20 * SCREENWIDTH + 10]).toBe(0x11);
    expect(framebuffer[21 * SCREENWIDTH + 10]).toBe(0x22);
    expect(framebuffer[22 * SCREENWIDTH + 10]).toBe(0x33);
    expect(framebuffer[23 * SCREENWIDTH + 10]).toBe(0x44);
    expect(framebuffer[24 * SCREENWIDTH + 10]).toBe(CANARY);
    expect(framebuffer[20 * SCREENWIDTH + 9]).toBe(CANARY);
    expect(framebuffer[20 * SCREENWIDTH + 11]).toBe(CANARY);
  });

  test('multi-column patch writes consecutive columns at screenX, screenX+1, ...', () => {
    const lump = buildPatchLump({
      width: 3,
      height: 1,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x10] }], [{ topDelta: 0, pixels: [0x20] }], [{ topDelta: 0, pixels: [0x30] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 50, 80, framebuffer);
    expect(framebuffer[80 * SCREENWIDTH + 50]).toBe(0x10);
    expect(framebuffer[80 * SCREENWIDTH + 51]).toBe(0x20);
    expect(framebuffer[80 * SCREENWIDTH + 52]).toBe(0x30);
    expect(framebuffer[80 * SCREENWIDTH + 49]).toBe(CANARY);
    expect(framebuffer[80 * SCREENWIDTH + 53]).toBe(CANARY);
  });

  test('leftOffset subtracts from x (sprite-centered origin)', () => {
    const lump = buildPatchLump({
      width: 3,
      height: 1,
      leftOffset: 1,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0xa0] }], [{ topDelta: 0, pixels: [0xa1] }], [{ topDelta: 0, pixels: [0xa2] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 10, 0, framebuffer);
    expect(framebuffer[0 * SCREENWIDTH + 9]).toBe(0xa0);
    expect(framebuffer[0 * SCREENWIDTH + 10]).toBe(0xa1);
    expect(framebuffer[0 * SCREENWIDTH + 11]).toBe(0xa2);
  });

  test('topOffset subtracts from y (sprite-centered origin)', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 3,
      leftOffset: 0,
      topOffset: 2,
      columns: [[{ topDelta: 0, pixels: [0xb0, 0xb1, 0xb2] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 0, 10, framebuffer);
    expect(framebuffer[8 * SCREENWIDTH + 0]).toBe(0xb0);
    expect(framebuffer[9 * SCREENWIDTH + 0]).toBe(0xb1);
    expect(framebuffer[10 * SCREENWIDTH + 0]).toBe(0xb2);
  });

  test('post.topDelta shifts the post down inside the patch', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 6,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 3, pixels: [0xc0, 0xc1, 0xc2] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 0, 10, framebuffer);
    expect(framebuffer[10 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[11 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[12 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[13 * SCREENWIDTH + 0]).toBe(0xc0);
    expect(framebuffer[14 * SCREENWIDTH + 0]).toBe(0xc1);
    expect(framebuffer[15 * SCREENWIDTH + 0]).toBe(0xc2);
  });
});

describe('drawPatch parity quirk: gaps between posts leave framebuffer bytes untouched', () => {
  test('two posts with a gap leave the gap rows at their canary value', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 8,
      leftOffset: 0,
      topOffset: 0,
      columns: [
        [
          { topDelta: 0, pixels: [0x01, 0x02] },
          { topDelta: 5, pixels: [0x03, 0x04] },
        ],
      ],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 0, 10, framebuffer);
    expect(framebuffer[10 * SCREENWIDTH + 0]).toBe(0x01);
    expect(framebuffer[11 * SCREENWIDTH + 0]).toBe(0x02);
    expect(framebuffer[12 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[13 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[14 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[15 * SCREENWIDTH + 0]).toBe(0x03);
    expect(framebuffer[16 * SCREENWIDTH + 0]).toBe(0x04);
  });

  test('empty column (only end marker) leaves its entire column untouched', () => {
    const lump = buildPatchLump({
      width: 3,
      height: 2,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x11, 0x12] }], [], [{ topDelta: 0, pixels: [0x13, 0x14] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 100, 50, framebuffer);
    expect(framebuffer[50 * SCREENWIDTH + 100]).toBe(0x11);
    expect(framebuffer[51 * SCREENWIDTH + 100]).toBe(0x12);
    expect(framebuffer[50 * SCREENWIDTH + 101]).toBe(CANARY);
    expect(framebuffer[51 * SCREENWIDTH + 101]).toBe(CANARY);
    expect(framebuffer[50 * SCREENWIDTH + 102]).toBe(0x13);
    expect(framebuffer[51 * SCREENWIDTH + 102]).toBe(0x14);
  });
});

describe('drawPatch clips out-of-bounds columns and rows', () => {
  test('negative screen column is skipped (leftOffset > x)', () => {
    const lump = buildPatchLump({
      width: 3,
      height: 1,
      leftOffset: 2,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0xd0] }], [{ topDelta: 0, pixels: [0xd1] }], [{ topDelta: 0, pixels: [0xd2] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 1, 0, framebuffer);
    expect(framebuffer[0]).toBe(0xd1);
    expect(framebuffer[1]).toBe(0xd2);
    for (let i = 2; i < SCREENWIDTH; i += 1) {
      expect(framebuffer[i]).toBe(CANARY);
    }
  });

  test('column past screenWidth is skipped without wrapping to the next row', () => {
    const lump = buildPatchLump({
      width: 4,
      height: 1,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0xe0] }], [{ topDelta: 0, pixels: [0xe1] }], [{ topDelta: 0, pixels: [0xe2] }], [{ topDelta: 0, pixels: [0xe3] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, SCREENWIDTH - 2, 5, framebuffer);
    expect(framebuffer[5 * SCREENWIDTH + (SCREENWIDTH - 2)]).toBe(0xe0);
    expect(framebuffer[5 * SCREENWIDTH + (SCREENWIDTH - 1)]).toBe(0xe1);
    expect(framebuffer[6 * SCREENWIDTH + 0]).toBe(CANARY);
    expect(framebuffer[6 * SCREENWIDTH + 1]).toBe(CANARY);
  });

  test('negative screen row is skipped without wrapping up', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 4,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0xf0, 0xf1, 0xf2, 0xf3] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 5, -2, framebuffer);
    expect(framebuffer[0 * SCREENWIDTH + 5]).toBe(0xf2);
    expect(framebuffer[1 * SCREENWIDTH + 5]).toBe(0xf3);
    expect(framebuffer[2 * SCREENWIDTH + 5]).toBe(CANARY);
  });

  test('row past screenHeight is skipped without wrapping (no row-stride aliasing)', () => {
    const lump = buildPatchLump({
      width: 1,
      height: 4,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x91, 0x92, 0x93, 0x94] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, 5, SCREENHEIGHT - 2, framebuffer);
    expect(framebuffer[(SCREENHEIGHT - 2) * SCREENWIDTH + 5]).toBe(0x91);
    expect(framebuffer[(SCREENHEIGHT - 1) * SCREENWIDTH + 5]).toBe(0x92);
    expect(framebuffer[0 * SCREENWIDTH + 5]).toBe(CANARY);
  });

  test('fully off-screen patch leaves the framebuffer entirely at the canary value', () => {
    const lump = buildPatchLump({
      width: 2,
      height: 2,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0xaa, 0xbb] }], [{ topDelta: 0, pixels: [0xcc, 0xdd] }]],
    });
    const patch = decodePatch(lump);
    const framebuffer = makeFramebuffer();
    drawPatch(patch, -100, -100, framebuffer);
    for (let i = 0; i < framebuffer.length; i += 1) {
      expect(framebuffer[i]).toBe(CANARY);
    }
  });

  test('custom screenWidth / screenHeight are honored for row stride and vertical clip', () => {
    const customWidth = 12;
    const customHeight = 5;
    const framebuffer = new Uint8Array(customWidth * customHeight).fill(CANARY);
    const lump = buildPatchLump({
      width: 2,
      height: 3,
      leftOffset: 0,
      topOffset: 0,
      columns: [[{ topDelta: 0, pixels: [0x01, 0x02, 0x03] }], [{ topDelta: 0, pixels: [0x04, 0x05, 0x06] }]],
    });
    const patch = decodePatch(lump);
    drawPatch(patch, 2, 1, framebuffer, customWidth, customHeight);
    expect(framebuffer[1 * customWidth + 2]).toBe(0x01);
    expect(framebuffer[2 * customWidth + 2]).toBe(0x02);
    expect(framebuffer[3 * customWidth + 2]).toBe(0x03);
    expect(framebuffer[1 * customWidth + 3]).toBe(0x04);
    expect(framebuffer[2 * customWidth + 3]).toBe(0x05);
    expect(framebuffer[3 * customWidth + 3]).toBe(0x06);
  });
});
