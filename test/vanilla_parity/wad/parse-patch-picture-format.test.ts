import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  PATCH_COLUMN_END_MARKER,
  PATCH_COLUMN_OFFSET_BYTES,
  PATCH_HEADER_BYTES,
  PATCH_PICTURE_FORMAT_AUDIT,
  PATCH_PICTURE_FORMAT_DERIVED_INVARIANTS,
  POST_HEADER_BYTES,
  POST_OVERHEAD_BYTES,
  POST_TRAILING_PAD_BYTES,
  SHAREWARE_DOOM1_WAD_PATCH_ORACLE,
  crossCheckPatchPictureFormatRuntime,
  crossCheckShareWareDoom1WadPatchSample,
  parsePatchPicture,
} from '../../../src/assets/parse-patch-picture-format.ts';
import type { PatchPictureFormatAuditEntry, PatchPictureFormatRuntimeSnapshot, ShareWareDoom1WadPatchOracleEntry, ShareWareDoom1WadPatchSample } from '../../../src/assets/parse-patch-picture-format.ts';

const ALLOWED_AXIS_IDS = new Set<PatchPictureFormatAuditEntry['id']>([
  'patch-header-bytes-eight',
  'patch-header-width-int16-le',
  'patch-header-height-int16-le',
  'patch-header-leftoffset-signed-int16-le',
  'patch-header-topoffset-signed-int16-le',
  'patch-column-offset-stride-four-bytes',
  'patch-column-offset-int32-le',
  'patch-column-offset-absolute-from-lump-start',
  'patch-post-header-topdelta-byte',
  'patch-post-header-length-byte',
  'patch-post-leading-pad-byte',
  'patch-post-trailing-pad-byte',
  'patch-post-total-overhead-four-bytes',
  'patch-post-end-marker-0xff',
  'patch-draw-y-subtracts-topoffset',
  'patch-draw-x-subtracts-leftoffset',
  'patch-shareware-doom1-uses-single-topdelta-encoding',
  'patch-cache-by-name-via-w-cachelumpname',
]);
const ALLOWED_SUBJECTS = new Set<PatchPictureFormatAuditEntry['subject']>(['patch_t', 'post_t', 'V_DrawPatch', 'parsePatchPicture', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<PatchPictureFormatAuditEntry['referenceSourceFile']>(['src/doom/r_defs.h', 'src/doom/v_video.c', 'src/doom/r_data.c', 'src/doom/w_wad.c', 'src/doom/p_setup.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

interface LivePatch {
  readonly name: ShareWareDoom1WadPatchOracleEntry['name'];
  readonly directoryIndex: number;
  readonly fileOffset: number;
  readonly size: number;
  readonly lumpData: Uint8Array;
  readonly decoded: ReturnType<typeof parsePatchPicture>;
  readonly sha256: string;
}

function loadLivePatch(name: ShareWareDoom1WadPatchOracleEntry['name']): LivePatch {
  const directoryIndex = liveDirectory.findIndex((entry) => entry.name === name);
  if (directoryIndex < 0) {
    throw new Error(`patch ${name} not found in live DOOM1.WAD directory`);
  }
  const entry = liveDirectory[directoryIndex]!;
  const lumpData = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
  return Object.freeze({
    name,
    directoryIndex,
    fileOffset: entry.offset,
    size: entry.size,
    lumpData,
    decoded: parsePatchPicture(lumpData),
    sha256: createHash('sha256').update(lumpData).digest('hex'),
  });
}

const liveTitlePic = loadLivePatch('TITLEPIC');
const liveStFst00 = loadLivePatch('STFST00');
const liveAmmNum0 = loadLivePatch('AMMNUM0');
const livePatches = [liveTitlePic, liveStFst00, liveAmmNum0];

function tryThrows(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof RangeError && pattern.test(err.message);
  }
}

function buildSyntheticPatch(opts: {
  readonly width: number;
  readonly height: number;
  readonly leftOffset: number;
  readonly topOffset: number;
  readonly columns: ReadonlyArray<ReadonlyArray<{ readonly topDelta: number; readonly pixels: readonly number[] }>>;
}): Uint8Array {
  const { columns, height, leftOffset, topOffset, width } = opts;
  if (columns.length !== width) {
    throw new Error(`column count ${columns.length} does not match width ${width}`);
  }
  const columnBytes: Uint8Array[] = columns.map((posts) => {
    const total = posts.reduce((sum, post) => sum + POST_HEADER_BYTES + post.pixels.length + POST_TRAILING_PAD_BYTES, 0) + 1;
    const bytes = new Uint8Array(total);
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

const validNegativeOffsetLump = buildSyntheticPatch({ width: 1, height: 1, leftOffset: -5, topOffset: -2, columns: [[]] });
const validSimplePatch = buildSyntheticPatch({ width: 1, height: 4, leftOffset: 0, topOffset: 0, columns: [[{ topDelta: 0, pixels: [0x10, 0x11, 0x12, 0x13] }]] });

const decodedNegative = parsePatchPicture(validNegativeOffsetLump);
const decodedSimple = parsePatchPicture(validSimplePatch);

const parserRejectsBufferTooSmallForHeader = tryThrows(() => parsePatchPicture(new Uint8Array(7)), /buffer 7 bytes/);
const parserRejectsBufferTooSmallForColumnTable = (() => {
  const lump = new Uint8Array(PATCH_HEADER_BYTES + 2);
  const view = new DataView(lump.buffer);
  view.setInt16(0, 4, true);
  return tryThrows(() => parsePatchPicture(lump), /column offset table/);
})();
const parserRejectsOutOfRangeColumnOffset = (() => {
  const lump = buildSyntheticPatch({ width: 1, height: 1, leftOffset: 0, topOffset: 0, columns: [[]] });
  const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
  view.setInt32(PATCH_HEADER_BYTES, lump.length + 100, true);
  return tryThrows(() => parsePatchPicture(lump), /out of range/);
})();
const parserRejectsTruncatedPostPixelRun = (() => {
  const lump = buildSyntheticPatch({ width: 1, height: 4, leftOffset: 0, topOffset: 0, columns: [[{ topDelta: 0, pixels: [0x10, 0x11] }]] });
  const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
  const columnOffset = view.getInt32(PATCH_HEADER_BYTES, true);
  lump[columnOffset + 1] = 200;
  return tryThrows(() => parsePatchPicture(lump), /pixel run extends past buffer end/);
})();

function buildLiveRuntimeSnapshot(): PatchPictureFormatRuntimeSnapshot {
  return {
    patchHeaderBytes: PATCH_HEADER_BYTES,
    patchColumnOffsetBytes: PATCH_COLUMN_OFFSET_BYTES,
    postHeaderBytes: POST_HEADER_BYTES,
    postTrailingPadBytes: POST_TRAILING_PAD_BYTES,
    postOverheadBytes: POST_OVERHEAD_BYTES,
    patchColumnEndMarker: PATCH_COLUMN_END_MARKER,
    parserReturnsFrozenOuter: Object.isFrozen(decodedSimple),
    parserReturnsFrozenHeader: Object.isFrozen(decodedSimple.header),
    parserReturnsFrozenColumns: Object.isFrozen(decodedSimple.columns),
    everyColumnIsFrozen: decodedSimple.columns.every((col) => Object.isFrozen(col)),
    parserPreservesNegativeLeftOffset: decodedNegative.header.leftOffset === -5,
    parserPreservesNegativeTopOffset: decodedNegative.header.topOffset === -2,
    parserRejectsBufferTooSmallForHeader,
    parserRejectsBufferTooSmallForColumnTable,
    parserRejectsOutOfRangeColumnOffset,
    parserRejectsTruncatedPostPixelRun,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(p: LivePatch): ShareWareDoom1WadPatchSample {
  return {
    name: p.name,
    directoryIndex: p.directoryIndex,
    fileOffset: p.fileOffset,
    size: p.size,
    width: p.decoded.header.width,
    height: p.decoded.header.height,
    leftOffset: p.decoded.header.leftOffset,
    topOffset: p.decoded.header.topOffset,
    sha256: p.sha256,
    columnZeroPostCount: p.decoded.columns[0]!.length,
  };
}

describe('patch picture format audit ledger shape', () => {
  test('audits exactly eighteen behavioral axes', () => {
    expect(PATCH_PICTURE_FORMAT_AUDIT.length).toBe(18);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of PATCH_PICTURE_FORMAT_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = PATCH_PICTURE_FORMAT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of PATCH_PICTURE_FORMAT_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of PATCH_PICTURE_FORMAT_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of PATCH_PICTURE_FORMAT_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of PATCH_PICTURE_FORMAT_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('patch picture format derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = PATCH_PICTURE_FORMAT_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(PATCH_PICTURE_FORMAT_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'PATCH_HEADER_BYTES_EQUALS_FOUR_TIMES_INT16',
        'PATCH_COLUMN_OFFSET_BYTES_EQUALS_INT32',
        'POST_HEADER_BYTES_EQUALS_THREE',
        'POST_TRAILING_PAD_BYTES_EQUALS_ONE',
        'POST_OVERHEAD_TOTAL_EQUALS_FOUR',
        'PATCH_COLUMN_END_MARKER_EQUALS_0XFF',
        'PARSEPATCHPICTURE_RETURNS_FROZEN_HEADER_AND_COLUMNS',
        'PARSEPATCHPICTURE_HEADER_FIELDS_ARE_INT16',
        'PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_COLUMN_TABLE',
        'PARSEPATCHPICTURE_REJECTS_OUT_OF_RANGE_COLUMN_OFFSET',
        'PARSEPATCHPICTURE_REJECTS_TRUNCATED_POST_PIXEL_RUN',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of PATCH_PICTURE_FORMAT_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('PATCH_HEADER_BYTES is 8', () => {
    expect(PATCH_HEADER_BYTES).toBe(8);
  });

  test('PATCH_COLUMN_OFFSET_BYTES is 4 (one int32 LE per column)', () => {
    expect(PATCH_COLUMN_OFFSET_BYTES).toBe(4);
  });

  test('POST_HEADER_BYTES is 3 (topDelta + length + leading pad)', () => {
    expect(POST_HEADER_BYTES).toBe(3);
  });

  test('POST_TRAILING_PAD_BYTES is 1', () => {
    expect(POST_TRAILING_PAD_BYTES).toBe(1);
  });

  test('POST_OVERHEAD_BYTES === POST_HEADER_BYTES + POST_TRAILING_PAD_BYTES === 4', () => {
    expect(POST_OVERHEAD_BYTES).toBe(POST_HEADER_BYTES + POST_TRAILING_PAD_BYTES);
    expect(POST_OVERHEAD_BYTES).toBe(4);
  });

  test('PATCH_COLUMN_END_MARKER is 0xff', () => {
    expect(PATCH_COLUMN_END_MARKER).toBe(0xff);
  });
});

describe('parsePatchPicture runtime contract', () => {
  test('returns a frozen outer object, frozen header, and frozen columns array', () => {
    expect(Object.isFrozen(decodedSimple)).toBe(true);
    expect(Object.isFrozen(decodedSimple.header)).toBe(true);
    expect(Object.isFrozen(decodedSimple.columns)).toBe(true);
  });

  test('every column array is frozen', () => {
    for (const col of decodedSimple.columns) {
      expect(Object.isFrozen(col)).toBe(true);
    }
  });

  test('header.width / header.height are int16 LE values', () => {
    expect(decodedSimple.header.width).toBe(1);
    expect(decodedSimple.header.height).toBe(4);
  });

  test('header.leftOffset and header.topOffset preserve negative int16 values', () => {
    expect(decodedNegative.header.leftOffset).toBe(-5);
    expect(decodedNegative.header.topOffset).toBe(-2);
  });

  test('a single-post column exposes topDelta, length, and the pixel bytes', () => {
    const column0 = decodedSimple.columns[0]!;
    expect(column0.length).toBe(1);
    const post = column0[0]!;
    expect(post.topDelta).toBe(0);
    expect(post.length).toBe(4);
    expect(Array.from(post.pixels)).toEqual([0x10, 0x11, 0x12, 0x13]);
    expect(Object.isFrozen(post)).toBe(true);
  });

  test('an empty column (only end marker) decodes as zero posts', () => {
    expect(decodedNegative.columns[0]!.length).toBe(0);
  });

  test('post.pixels is a live view into the source buffer (no copy)', () => {
    expect(decodedSimple.columns[0]![0]!.pixels.buffer).toBe(validSimplePatch.buffer);
  });

  test('rejects a buffer smaller than the 8-byte header with a RangeError', () => {
    expect(() => parsePatchPicture(new Uint8Array(7))).toThrow(/buffer 7 bytes/);
  });

  test('rejects a buffer too small for the column-offset table with a RangeError', () => {
    const lump = new Uint8Array(PATCH_HEADER_BYTES + 2);
    const view = new DataView(lump.buffer);
    view.setInt16(0, 4, true);
    expect(() => parsePatchPicture(lump)).toThrow(/column offset table/);
  });

  test('rejects an out-of-range column offset with a RangeError', () => {
    const lump = buildSyntheticPatch({ width: 1, height: 1, leftOffset: 0, topOffset: 0, columns: [[]] });
    const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
    view.setInt32(PATCH_HEADER_BYTES, lump.length + 100, true);
    expect(() => parsePatchPicture(lump)).toThrow(/out of range/);
  });

  test('rejects a truncated post pixel run with a RangeError', () => {
    const lump = buildSyntheticPatch({ width: 1, height: 4, leftOffset: 0, topOffset: 0, columns: [[{ topDelta: 0, pixels: [0x10, 0x11] }]] });
    const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
    const columnOffset = view.getInt32(PATCH_HEADER_BYTES, true);
    lump[columnOffset + 1] = 200;
    expect(() => parsePatchPicture(lump)).toThrow(/pixel run extends past buffer end/);
  });

  test('preserves multi-post column ordering and topDelta values', () => {
    const lump = buildSyntheticPatch({
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
    const decoded = parsePatchPicture(lump);
    expect(decoded.columns[0]!.length).toBe(2);
    expect(decoded.columns[0]![0]!.topDelta).toBe(0);
    expect(Array.from(decoded.columns[0]![0]!.pixels)).toEqual([0x01, 0x02]);
    expect(decoded.columns[0]![1]!.topDelta).toBe(5);
    expect(Array.from(decoded.columns[0]![1]!.pixels)).toEqual([0x03, 0x04, 0x05]);
  });

  test('the post-overhead arithmetic exactly matches `column->length + 4`', () => {
    const lump = buildSyntheticPatch({ width: 1, height: 4, leftOffset: 0, topOffset: 0, columns: [[{ topDelta: 0, pixels: [0xa1, 0xa2] }]] });
    const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
    const columnOffset = view.getInt32(PATCH_HEADER_BYTES, true);
    const length = lump[columnOffset + 1]!;
    const nextCursor = columnOffset + POST_HEADER_BYTES + length + POST_TRAILING_PAD_BYTES;
    expect(nextCursor).toBe(columnOffset + length + 4);
    expect(lump[nextCursor]).toBe(PATCH_COLUMN_END_MARKER);
  });
});

describe('crossCheckPatchPictureFormatRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckPatchPictureFormatRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckPatchPictureFormatRuntime failure modes', () => {
  test('detects a tampered PATCH_HEADER_BYTES that breaks the four-int16 layout', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, patchHeaderBytes: 6 };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PATCH_HEADER_BYTES_EQUALS_FOUR_TIMES_INT16');
    expect(failures).toContain('audit:patch-header-bytes-eight:not-observed');
  });

  test('detects a tampered PATCH_COLUMN_OFFSET_BYTES that breaks the int32-stride table', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, patchColumnOffsetBytes: 2 };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PATCH_COLUMN_OFFSET_BYTES_EQUALS_INT32');
    expect(failures).toContain('audit:patch-column-offset-stride-four-bytes:not-observed');
  });

  test('detects a tampered POST_HEADER_BYTES that drops the leading pad', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, postHeaderBytes: 2 };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:POST_HEADER_BYTES_EQUALS_THREE');
    expect(failures).toContain('audit:patch-post-leading-pad-byte:not-observed');
  });

  test('detects a tampered POST_TRAILING_PAD_BYTES that drops the trailing pad', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, postTrailingPadBytes: 0 };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:POST_TRAILING_PAD_BYTES_EQUALS_ONE');
    expect(failures).toContain('audit:patch-post-trailing-pad-byte:not-observed');
  });

  test('detects a tampered POST_OVERHEAD_BYTES that no longer equals 4', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, postOverheadBytes: 3 };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:POST_OVERHEAD_TOTAL_EQUALS_FOUR');
    expect(failures).toContain('audit:patch-post-total-overhead-four-bytes:not-observed');
  });

  test('detects a tampered PATCH_COLUMN_END_MARKER that no longer equals 0xff', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, patchColumnEndMarker: 0xfe };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PATCH_COLUMN_END_MARKER_EQUALS_0XFF');
    expect(failures).toContain('audit:patch-post-end-marker-0xff:not-observed');
  });

  test('detects a parser that fails to freeze the outer object', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFrozenOuter: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_RETURNS_FROZEN_HEADER_AND_COLUMNS');
    expect(failures).toContain('audit:patch-cache-by-name-via-w-cachelumpname:not-observed');
  });

  test('detects a parser that strips the sign bit from leftOffset', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserPreservesNegativeLeftOffset: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_HEADER_FIELDS_ARE_INT16');
    expect(failures).toContain('audit:patch-header-leftoffset-signed-int16-le:not-observed');
  });

  test('detects a parser that strips the sign bit from topOffset', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserPreservesNegativeTopOffset: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_HEADER_FIELDS_ARE_INT16');
    expect(failures).toContain('audit:patch-header-topoffset-signed-int16-le:not-observed');
  });

  test('detects a parser that silently accepts a buffer smaller than the header', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  });

  test('detects a parser that silently accepts a buffer too small for the column-offset table', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForColumnTable: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_COLUMN_TABLE');
  });

  test('detects a parser that silently accepts an out-of-range column offset', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsOutOfRangeColumnOffset: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_REJECTS_OUT_OF_RANGE_COLUMN_OFFSET');
  });

  test('detects a parser that silently accepts a truncated post pixel run', () => {
    const tampered: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsTruncatedPostPixelRun: false };
    const failures = crossCheckPatchPictureFormatRuntime(tampered);
    expect(failures).toContain('derived:PARSEPATCHPICTURE_REJECTS_TRUNCATED_POST_PIXEL_RUN');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: PatchPictureFormatRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckPatchPictureFormatRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD patch oracle', () => {
  test('declares exactly three pinned patches: TITLEPIC, STFST00, AMMNUM0', () => {
    const names = SHAREWARE_DOOM1_WAD_PATCH_ORACLE.map((entry) => entry.name);
    expect(names).toEqual(['TITLEPIC', 'STFST00', 'AMMNUM0']);
  });

  test('TITLEPIC is at directory index 235 with size 68168 and 320x200 dimensions', () => {
    expect(liveTitlePic.directoryIndex).toBe(235);
    expect(liveTitlePic.fileOffset).toBe(1933024);
    expect(liveTitlePic.size).toBe(68168);
    expect(liveTitlePic.decoded.header.width).toBe(320);
    expect(liveTitlePic.decoded.header.height).toBe(200);
    expect(liveTitlePic.decoded.header.leftOffset).toBe(0);
    expect(liveTitlePic.decoded.header.topOffset).toBe(0);
    expect(liveTitlePic.decoded.columns.length).toBe(320);
    expect(liveTitlePic.decoded.columns[0]!.length).toBe(2);
  });

  test('STFST00 ships negative leftoffset/topoffset (sprite-style sign bit)', () => {
    expect(liveStFst00.directoryIndex).toBe(361);
    expect(liveStFst00.fileOffset).toBe(2042632);
    expect(liveStFst00.size).toBe(808);
    expect(liveStFst00.decoded.header.width).toBe(24);
    expect(liveStFst00.decoded.header.height).toBe(29);
    expect(liveStFst00.decoded.header.leftOffset).toBe(-5);
    expect(liveStFst00.decoded.header.topOffset).toBe(-2);
    expect(liveStFst00.decoded.columns.length).toBe(24);
    expect(liveStFst00.decoded.columns[0]!.length).toBe(1);
  });

  test('AMMNUM0 is a tiny 3x5 font glyph with negative leftoffset', () => {
    expect(liveAmmNum0.directoryIndex).toBe(236);
    expect(liveAmmNum0.fileOffset).toBe(2001192);
    expect(liveAmmNum0.size).toBe(48);
    expect(liveAmmNum0.decoded.header.width).toBe(3);
    expect(liveAmmNum0.decoded.header.height).toBe(5);
    expect(liveAmmNum0.decoded.header.leftOffset).toBe(-1);
    expect(liveAmmNum0.decoded.header.topOffset).toBe(0);
    expect(liveAmmNum0.decoded.columns.length).toBe(3);
    expect(liveAmmNum0.decoded.columns[0]!.length).toBe(1);
  });

  test('every pinned patch sha256 matches the live IWAD bytes', () => {
    expect(liveTitlePic.sha256).toBe('f2cfb4e8e2f80aaad1203b1209e3e0cfb83eebe8d48ab1e276a8a60907808b9c');
    expect(liveStFst00.sha256).toBe('afb4862b80030350df5ac2ce52735b250a20d367cb53a035628ce0e6330e7399');
    expect(liveAmmNum0.sha256).toBe('b9f4bf453aaefbf4cc2631e1047cf879a249bd9d3b79c265874eb49159504cca');
  });

  test('every live patch sample reports zero failures against the pinned oracle', () => {
    for (const live of livePatches) {
      const sample = buildLiveOracleSample(live);
      expect(crossCheckShareWareDoom1WadPatchSample(sample)).toEqual([]);
    }
  });

  test('matches the wad-map-summary.json reference manifest on patch count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { patch: number } };
    expect(manifest.lumpCategories.patch).toBe(165);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });
});

describe('crossCheckShareWareDoom1WadPatchSample failure modes', () => {
  const baseline = buildLiveOracleSample(liveTitlePic);

  test('detects an unknown patch name as not-found', () => {
    const tampered: ShareWareDoom1WadPatchSample = { ...baseline, name: 'UNKNOWN_PATCH' };
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:UNKNOWN_PATCH:not-found');
  });

  test('detects a wrong directory index', () => {
    const tampered: ShareWareDoom1WadPatchSample = { ...baseline, directoryIndex: 99 };
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:TITLEPIC:directoryIndex:value-mismatch');
  });

  test('detects a wrong file offset', () => {
    const tampered: ShareWareDoom1WadPatchSample = { ...baseline, fileOffset: 0 };
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:TITLEPIC:fileOffset:value-mismatch');
  });

  test('detects a wrong width', () => {
    const tampered: ShareWareDoom1WadPatchSample = { ...baseline, width: 320 + 1 };
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:TITLEPIC:width:value-mismatch');
  });

  test('detects a tampered leftOffset (sign bit dropped)', () => {
    const stfst00Sample = buildLiveOracleSample(liveStFst00);
    const tampered: ShareWareDoom1WadPatchSample = { ...stfst00Sample, leftOffset: 0xfffb }; // -5 reinterpreted as unsigned
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:STFST00:leftOffset:value-mismatch');
  });

  test('detects a wrong sha256', () => {
    const tampered: ShareWareDoom1WadPatchSample = { ...baseline, sha256: '0'.repeat(64) };
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:TITLEPIC:sha256:value-mismatch');
  });

  test('detects a tampered columnZeroPostCount', () => {
    const tampered: ShareWareDoom1WadPatchSample = { ...baseline, columnZeroPostCount: 99 };
    expect(crossCheckShareWareDoom1WadPatchSample(tampered)).toContain('oracle:TITLEPIC:columnZeroPostCount:value-mismatch');
  });

  test('reports an empty failure list for a freshly built equivalent sample', () => {
    const cloned: ShareWareDoom1WadPatchSample = { ...baseline };
    expect(crossCheckShareWareDoom1WadPatchSample(cloned)).toEqual([]);
  });
});

describe('parse-patch-picture-format step file', () => {
  test('declares the wad lane and the parse-patch-picture-format write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-006-parse-patch-picture-format.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/parse-patch-picture-format.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/parse-patch-picture-format.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-006-parse-patch-picture-format.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
