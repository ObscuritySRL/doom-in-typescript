import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader, WAD_HEADER_SIZE } from '../../src/wad/header.ts';
import type { WadHeader, WadType } from '../../src/wad/header.ts';
import { DIRECTORY_ENTRY_SIZE, parseWadDirectory } from '../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../src/wad/directory.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());

describe('parseWadHeader', () => {
  const header = parseWadHeader(wadBuffer);

  it('identifies DOOM1.WAD as an IWAD', () => {
    expect(header.type).toBe('IWAD');
  });

  it('reports the pinned lump count', () => {
    expect(header.lumpCount).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  it('reports a positive directory offset within file bounds', () => {
    expect(header.directoryOffset).toBeGreaterThan(0);
    expect(header.directoryOffset).toBeLessThan(wadBuffer.length);
  });

  it('parses a minimal synthetic IWAD header', () => {
    const synthetic = Buffer.alloc(WAD_HEADER_SIZE);
    synthetic.write('IWAD', 0, 'ascii');
    synthetic.writeInt32LE(0, 4);
    synthetic.writeInt32LE(12, 8);
    const result = parseWadHeader(synthetic);
    expect(result.type).toBe('IWAD');
    expect(result.lumpCount).toBe(0);
    expect(result.directoryOffset).toBe(12);
  });

  it('parses a PWAD header', () => {
    const synthetic = Buffer.alloc(WAD_HEADER_SIZE);
    synthetic.write('PWAD', 0, 'ascii');
    synthetic.writeInt32LE(5, 4);
    synthetic.writeInt32LE(12, 8);
    const result = parseWadHeader(synthetic);
    expect(result.type).toBe('PWAD');
    expect(result.lumpCount).toBe(5);
  });

  it('throws RangeError on a truncated buffer', () => {
    expect(() => parseWadHeader(Buffer.alloc(8))).toThrow(RangeError);
  });

  it('throws on an invalid identification string', () => {
    const bad = Buffer.alloc(WAD_HEADER_SIZE);
    bad.write('XWAD', 0, 'ascii');
    expect(() => parseWadHeader(bad)).toThrow(/Invalid WAD identification/);
  });

  it('throws on a negative lump count', () => {
    const bad = Buffer.alloc(WAD_HEADER_SIZE);
    bad.write('IWAD', 0, 'ascii');
    bad.writeInt32LE(-1, 4);
    bad.writeInt32LE(12, 8);
    expect(() => parseWadHeader(bad)).toThrow(/lump count must be non-negative/);
  });

  it('throws on a negative directory offset', () => {
    const bad = Buffer.alloc(WAD_HEADER_SIZE);
    bad.write('IWAD', 0, 'ascii');
    bad.writeInt32LE(0, 4);
    bad.writeInt32LE(-1, 8);
    expect(() => parseWadHeader(bad)).toThrow(/directory offset must be non-negative/);
  });

  it('exports WAD_HEADER_SIZE as 12', () => {
    expect(WAD_HEADER_SIZE).toBe(12);
  });

  it('satisfies the WadHeader interface at compile time', () => {
    const typed: WadHeader = header;
    expect(typed).toBe(header);
  });

  it('satisfies the WadType union at compile time', () => {
    const typed: WadType = header.type;
    expect(typed).toBe('IWAD');
  });
});

describe('parseWadDirectory', () => {
  const header = parseWadHeader(wadBuffer);
  const directory = parseWadDirectory(wadBuffer, header);

  it('returns exactly the pinned lump count', () => {
    expect(directory.length).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  it('returns a frozen array', () => {
    expect(Object.isFrozen(directory)).toBe(true);
  });

  it('has PLAYPAL as the first lump', () => {
    expect(directory[0]!.name).toBe('PLAYPAL');
  });

  it('has F_END as the last lump', () => {
    expect(directory[directory.length - 1]!.name).toBe('F_END');
  });

  it('strips trailing null bytes from lump names', () => {
    for (const entry of directory) {
      expect(entry.name).not.toContain('\0');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeLessThanOrEqual(8);
    }
  });

  it('has non-negative offset and size for every entry', () => {
    for (const entry of directory) {
      expect(entry.offset).toBeGreaterThanOrEqual(0);
      expect(entry.size).toBeGreaterThanOrEqual(0);
    }
  });

  it('contains marker lumps with zero size', () => {
    const markers = directory.filter((entry) => entry.name === 'F_START' || entry.name === 'F_END');
    expect(markers.length).toBeGreaterThanOrEqual(2);
    for (const marker of markers) {
      expect(marker.size).toBe(0);
    }
  });

  it('contains E1M1 map marker', () => {
    const e1m1 = directory.find((entry) => entry.name === 'E1M1');
    expect(e1m1).toBeDefined();
    expect(e1m1!.size).toBe(0);
  });

  it('contains all episode 1 map markers E1M1 through E1M9', () => {
    for (let map = 1; map <= 9; map++) {
      const name = `E1M${map}`;
      const found = directory.find((entry) => entry.name === name);
      expect(found).toBeDefined();
    }
  });

  it('has COLORMAP immediately after PLAYPAL', () => {
    expect(directory[1]!.name).toBe('COLORMAP');
  });

  it('exports DIRECTORY_ENTRY_SIZE as 16', () => {
    expect(DIRECTORY_ENTRY_SIZE).toBe(16);
  });

  it('throws RangeError when buffer is too short for directory', () => {
    const tinyHeader: WadHeader = {
      type: 'IWAD',
      lumpCount: 10,
      directoryOffset: 12,
    };
    const tinyBuffer = Buffer.alloc(WAD_HEADER_SIZE);
    expect(() => parseWadDirectory(tinyBuffer, tinyHeader)).toThrow(RangeError);
  });

  it('returns an empty frozen array for zero-lump WAD', () => {
    const emptyHeader: WadHeader = {
      type: 'IWAD',
      lumpCount: 0,
      directoryOffset: 12,
    };
    const emptyBuffer = Buffer.alloc(WAD_HEADER_SIZE);
    const result = parseWadDirectory(emptyBuffer, emptyHeader);
    expect(result.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws on a negative directory lump count', () => {
    const badHeader: WadHeader = {
      type: 'IWAD',
      lumpCount: -1,
      directoryOffset: 12,
    };
    expect(() => parseWadDirectory(Buffer.alloc(WAD_HEADER_SIZE), badHeader)).toThrow(/lump count must be non-negative/);
  });

  it('throws on a negative directory offset', () => {
    const badHeader: WadHeader = {
      type: 'IWAD',
      lumpCount: 0,
      directoryOffset: -1,
    };
    expect(() => parseWadDirectory(Buffer.alloc(WAD_HEADER_SIZE), badHeader)).toThrow(/directory offset must be non-negative/);
  });

  it('throws when a lump entry has a negative offset or size', () => {
    const singleEntryHeader: WadHeader = {
      type: 'IWAD',
      lumpCount: 1,
      directoryOffset: WAD_HEADER_SIZE,
    };

    const negativeOffsetBuffer = Buffer.alloc(WAD_HEADER_SIZE + DIRECTORY_ENTRY_SIZE);
    negativeOffsetBuffer.writeInt32LE(-1, WAD_HEADER_SIZE);
    negativeOffsetBuffer.writeInt32LE(0, WAD_HEADER_SIZE + 4);
    negativeOffsetBuffer.write('BADLUMP', WAD_HEADER_SIZE + 8, 'ascii');
    expect(() => parseWadDirectory(negativeOffsetBuffer, singleEntryHeader)).toThrow(/negative lump offset/);

    const negativeSizeBuffer = Buffer.alloc(WAD_HEADER_SIZE + DIRECTORY_ENTRY_SIZE);
    negativeSizeBuffer.writeInt32LE(0, WAD_HEADER_SIZE);
    negativeSizeBuffer.writeInt32LE(-1, WAD_HEADER_SIZE + 4);
    negativeSizeBuffer.write('BADLUMP', WAD_HEADER_SIZE + 8, 'ascii');
    expect(() => parseWadDirectory(negativeSizeBuffer, singleEntryHeader)).toThrow(/negative lump size/);
  });

  it('throws when a lump entry extends past the end of the buffer', () => {
    const singleEntryHeader: WadHeader = {
      type: 'IWAD',
      lumpCount: 1,
      directoryOffset: WAD_HEADER_SIZE,
    };
    const outOfBoundsBuffer = Buffer.alloc(WAD_HEADER_SIZE + DIRECTORY_ENTRY_SIZE);
    outOfBoundsBuffer.writeInt32LE(WAD_HEADER_SIZE, WAD_HEADER_SIZE);
    outOfBoundsBuffer.writeInt32LE(DIRECTORY_ENTRY_SIZE + 1, WAD_HEADER_SIZE + 4);
    outOfBoundsBuffer.write('BADLUMP', WAD_HEADER_SIZE + 8, 'ascii');
    expect(() => parseWadDirectory(outOfBoundsBuffer, singleEntryHeader)).toThrow(/exceeds buffer bounds/);
  });

  it('satisfies the DirectoryEntry interface at compile time', () => {
    const entry: DirectoryEntry = directory[0]!;
    expect(entry).toBe(directory[0]);
  });
});
