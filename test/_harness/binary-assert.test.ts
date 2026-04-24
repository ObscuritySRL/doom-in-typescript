import { describe, expect, test } from 'bun:test';

import {
  expectAsciiString,
  expectBufferEqual,
  expectBufferSize,
  expectBufferSliceEqual,
  expectLittleEndianI16,
  expectLittleEndianI32,
  expectLittleEndianU16,
  expectLittleEndianU32,
  expectMagic,
  expectU8,
  expectZeroFilled,
} from './binaryAssert.ts';

describe('expectBufferEqual', () => {
  test('passes for identical buffers', () => {
    const buffer = Buffer.from([0x49, 0x57, 0x41, 0x44]);
    expectBufferEqual(buffer, Buffer.from([0x49, 0x57, 0x41, 0x44]));
  });

  test('passes for empty buffers', () => {
    expectBufferEqual(new Uint8Array(0), new Uint8Array(0));
  });

  test('fails on length mismatch', () => {
    expect(() => expectBufferEqual(Buffer.from([1, 2]), Buffer.from([1, 2, 3]))).toThrow();
  });

  test('fails on content mismatch with hex offset', () => {
    expect(() => expectBufferEqual(Buffer.from([1, 2, 0xff]), Buffer.from([1, 2, 0xfe]))).toThrow(/0x0002/);
  });

  test('reports actual and expected byte values', () => {
    expect(() => expectBufferEqual(Buffer.from([0xab]), Buffer.from([0xcd]))).toThrow(/0xab.*0xcd/);
  });
});

describe('expectBufferSliceEqual', () => {
  test('passes for matching subrange', () => {
    const buffer = Buffer.from([0, 1, 2, 3, 4]);
    expectBufferSliceEqual(buffer, 1, Buffer.from([1, 2, 3]));
  });

  test('passes at start of buffer', () => {
    const buffer = Buffer.from([0xaa, 0xbb]);
    expectBufferSliceEqual(buffer, 0, Buffer.from([0xaa, 0xbb]));
  });

  test('passes at end of buffer', () => {
    const buffer = Buffer.from([0, 0, 0xff]);
    expectBufferSliceEqual(buffer, 2, Buffer.from([0xff]));
  });

  test('throws RangeError for out-of-bounds offset', () => {
    const buffer = Buffer.from([1, 2]);
    expect(() => expectBufferSliceEqual(buffer, 1, Buffer.from([2, 3]))).toThrow(RangeError);
  });

  test('throws RangeError for negative offset', () => {
    expect(() => expectBufferSliceEqual(Buffer.from([1]), -1, Buffer.from([1]))).toThrow(RangeError);
  });
});

describe('expectBufferSize', () => {
  test('passes for correct size', () => {
    expectBufferSize(Buffer.alloc(12), 12);
  });

  test('passes for zero-length buffer', () => {
    expectBufferSize(new Uint8Array(0), 0);
  });

  test('fails for wrong size', () => {
    expect(() => expectBufferSize(Buffer.alloc(10), 12)).toThrow();
  });
});

describe('expectAsciiString', () => {
  test('reads null-padded string matching WAD lump names', () => {
    const buffer = Buffer.alloc(8);
    buffer.write('IWAD', 0, 'ascii');
    expectAsciiString(buffer, 0, 8, 'IWAD');
  });

  test('reads fully packed field with no trailing nulls', () => {
    const buffer = Buffer.from('LINEDEFS', 'ascii');
    expectAsciiString(buffer, 0, 8, 'LINEDEFS');
  });

  test('reads at non-zero offset', () => {
    const buffer = Buffer.alloc(16);
    buffer.write('THINGS', 4, 'ascii');
    expectAsciiString(buffer, 4, 8, 'THINGS');
  });

  test('throws RangeError for out-of-bounds field', () => {
    expect(() => expectAsciiString(Buffer.alloc(4), 2, 8, 'TEST')).toThrow(RangeError);
  });

  test('fails on content mismatch', () => {
    const buffer = Buffer.from('PWAD\0\0\0\0', 'ascii');
    expect(() => expectAsciiString(buffer, 0, 8, 'IWAD')).toThrow();
  });
});

describe('expectMagic', () => {
  test('passes for matching magic bytes', () => {
    const buffer = Buffer.from('IWAD', 'ascii');
    expectMagic(buffer, 0, Buffer.from('IWAD', 'ascii'));
  });

  test('passes for magic at non-zero offset', () => {
    const buffer = Buffer.from('\0\0MUS\x1a', 'ascii');
    expectMagic(buffer, 2, Buffer.from('MUS\x1a', 'ascii'));
  });

  test('fails for wrong magic', () => {
    const buffer = Buffer.from('PWAD', 'ascii');
    expect(() => expectMagic(buffer, 0, Buffer.from('IWAD', 'ascii'))).toThrow();
  });
});

describe('expectLittleEndianU16', () => {
  test('reads 0x0003 DMX format tag', () => {
    const buffer = Buffer.from([0x03, 0x00]);
    expectLittleEndianU16(buffer, 0, 0x0003);
  });

  test('reads max uint16', () => {
    const buffer = Buffer.from([0xff, 0xff]);
    expectLittleEndianU16(buffer, 0, 0xffff);
  });

  test('reads at non-zero offset', () => {
    const buffer = Buffer.from([0x00, 0x11, 0x25, 0x00]);
    expectLittleEndianU16(buffer, 2, 0x0025);
  });

  test('throws RangeError for truncated buffer', () => {
    expect(() => expectLittleEndianU16(Buffer.from([0x01]), 0, 1)).toThrow(RangeError);
  });

  test('fails on value mismatch', () => {
    const buffer = Buffer.from([0x03, 0x00]);
    expect(() => expectLittleEndianU16(buffer, 0, 0x0004)).toThrow();
  });
});

describe('expectLittleEndianI16', () => {
  test('reads positive value', () => {
    const buffer = Buffer.from([0x64, 0x00]);
    expectLittleEndianI16(buffer, 0, 100);
  });

  test('reads negative value via sign extension', () => {
    // -1 in two's complement LE is [0xFF, 0xFF]
    const buffer = Buffer.from([0xff, 0xff]);
    expectLittleEndianI16(buffer, 0, -1);
  });

  test('reads -32768 (minimum int16)', () => {
    const buffer = Buffer.from([0x00, 0x80]);
    expectLittleEndianI16(buffer, 0, -32_768);
  });

  test('reads 32767 (maximum int16)', () => {
    const buffer = Buffer.from([0xff, 0x7f]);
    expectLittleEndianI16(buffer, 0, 32_767);
  });

  test('throws RangeError for truncated buffer', () => {
    expect(() => expectLittleEndianI16(Buffer.from([0x01]), 0, 1)).toThrow(RangeError);
  });
});

describe('expectLittleEndianU32', () => {
  test('reads DOOM1.WAD lump count (1264)', () => {
    const buffer = Buffer.alloc(4);
    new DataView(buffer.buffer).setUint32(0, 1264, true);
    expectLittleEndianU32(buffer, 0, 1264);
  });

  test('reads max uint32', () => {
    const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    expectLittleEndianU32(buffer, 0, 0xffff_ffff);
  });

  test('reads at non-zero offset', () => {
    const buffer = Buffer.alloc(8);
    new DataView(buffer.buffer).setUint32(4, 0x3fb714, true);
    expectLittleEndianU32(buffer, 4, 0x3fb714);
  });

  test('throws RangeError for truncated buffer', () => {
    expect(() => expectLittleEndianU32(Buffer.from([0x01, 0x02, 0x03]), 0, 1)).toThrow(RangeError);
  });

  test('fails on value mismatch', () => {
    const buffer = Buffer.alloc(4);
    new DataView(buffer.buffer).setUint32(0, 100, true);
    expect(() => expectLittleEndianU32(buffer, 0, 200)).toThrow();
  });
});

describe('expectLittleEndianI32', () => {
  test('reads positive value', () => {
    const buffer = Buffer.alloc(4);
    new DataView(buffer.buffer).setInt32(0, 12_345, true);
    expectLittleEndianI32(buffer, 0, 12_345);
  });

  test('reads negative value', () => {
    const buffer = Buffer.alloc(4);
    new DataView(buffer.buffer).setInt32(0, -1, true);
    expectLittleEndianI32(buffer, 0, -1);
  });

  test('reads minimum int32', () => {
    const buffer = Buffer.alloc(4);
    new DataView(buffer.buffer).setInt32(0, -2_147_483_648, true);
    expectLittleEndianI32(buffer, 0, -2_147_483_648);
  });

  test('throws RangeError for truncated buffer', () => {
    expect(() => expectLittleEndianI32(Buffer.from([0x01, 0x02]), 0, 1)).toThrow(RangeError);
  });
});

describe('expectU8', () => {
  test('reads byte at offset 0', () => {
    expectU8(Buffer.from([0x80]), 0, 0x80);
  });

  test('reads demo end marker', () => {
    const buffer = Buffer.from([0x01, 0x02, 0x80]);
    expectU8(buffer, 2, 0x80);
  });

  test('throws RangeError for out-of-bounds', () => {
    expect(() => expectU8(Buffer.from([1]), 1, 0)).toThrow(RangeError);
  });

  test('throws RangeError for negative offset', () => {
    expect(() => expectU8(Buffer.from([1]), -1, 0)).toThrow(RangeError);
  });

  test('fails on value mismatch', () => {
    expect(() => expectU8(Buffer.from([0xaa]), 0, 0xbb)).toThrow();
  });
});

describe('expectZeroFilled', () => {
  test('passes for all-zero region', () => {
    expectZeroFilled(Buffer.alloc(8), 0, 8);
  });

  test('passes for zero subrange', () => {
    const buffer = Buffer.from([0xff, 0x00, 0x00, 0x00, 0xff]);
    expectZeroFilled(buffer, 1, 3);
  });

  test('passes for zero-length region', () => {
    expectZeroFilled(Buffer.from([0xff]), 0, 0);
  });

  test('fails for non-zero byte with hex offset', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x01, 0x00]);
    expect(() => expectZeroFilled(buffer, 0, 4)).toThrow(/0x0002/);
  });

  test('throws RangeError for out-of-bounds', () => {
    expect(() => expectZeroFilled(Buffer.alloc(2), 0, 4)).toThrow(RangeError);
  });
});

describe('parity edge case: signed vs unsigned interpretation', () => {
  test('0xFF 0xFF reads as 65535 unsigned but -1 signed (16-bit)', () => {
    const buffer = Buffer.from([0xff, 0xff]);
    expectLittleEndianU16(buffer, 0, 65_535);
    expectLittleEndianI16(buffer, 0, -1);
  });

  test('0x00 0x80 reads as 32768 unsigned but -32768 signed (16-bit)', () => {
    const buffer = Buffer.from([0x00, 0x80]);
    expectLittleEndianU16(buffer, 0, 32_768);
    expectLittleEndianI16(buffer, 0, -32_768);
  });

  test('0xFF 0xFF 0xFF 0xFF reads as 4294967295 unsigned but -1 signed (32-bit)', () => {
    const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    expectLittleEndianU32(buffer, 0, 4_294_967_295);
    expectLittleEndianI32(buffer, 0, -1);
  });

  test('WAD directory entry offset and size share the same u32 encoding', () => {
    // Simulated WAD directory entry: 4-byte offset, 4-byte size, 8-byte name
    const entry = Buffer.alloc(16);
    const view = new DataView(entry.buffer);
    view.setUint32(0, 0x3fb714, true); // offset (DOOM1.WAD directory offset)
    view.setUint32(4, 0x4f00, true); // size
    entry.write('E1M1\0\0\0\0', 8, 'ascii');

    expectLittleEndianU32(entry, 0, 0x3fb714);
    expectLittleEndianU32(entry, 4, 0x4f00);
    expectAsciiString(entry, 8, 8, 'E1M1');
  });
});

describe('parity edge case: WAD header round-trip', () => {
  test('12-byte WAD header parses correctly with all assertions', () => {
    const header = Buffer.alloc(12);
    header.write('IWAD', 0, 'ascii');
    new DataView(header.buffer).setInt32(4, 1264, true);
    new DataView(header.buffer).setInt32(8, 4_175_796, true);

    expectBufferSize(header, 12);
    expectMagic(header, 0, Buffer.from('IWAD', 'ascii'));
    expectLittleEndianI32(header, 4, 1264);
    expectLittleEndianI32(header, 8, 4_175_796);
    expectAsciiString(header, 0, 4, 'IWAD');
  });
});
