import { describe, expect, it } from 'bun:test';

import { BinaryReader } from '../../src/core/binaryReader.ts';

describe('BinaryReader', () => {
  describe('constructor', () => {
    it('starts at offset 0 by default', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      expect(reader.position).toBe(0);
    });

    it('accepts an explicit starting offset', () => {
      const reader = new BinaryReader(Buffer.alloc(8), 4);
      expect(reader.position).toBe(4);
      expect(reader.remaining).toBe(4);
    });

    it('allows starting at the end of the buffer', () => {
      const reader = new BinaryReader(Buffer.alloc(4), 4);
      expect(reader.remaining).toBe(0);
    });

    it('throws RangeError for negative initial offset', () => {
      expect(() => new BinaryReader(Buffer.alloc(4), -1)).toThrow(RangeError);
    });

    it('throws RangeError for initial offset past buffer end', () => {
      expect(() => new BinaryReader(Buffer.alloc(4), 5)).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('length returns the total buffer size', () => {
      const reader = new BinaryReader(Buffer.alloc(16));
      expect(reader.length).toBe(16);
    });

    it('remaining decreases as bytes are read', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      expect(reader.remaining).toBe(8);
      reader.readInt32();
      expect(reader.remaining).toBe(4);
    });
  });

  describe('readInt8', () => {
    it('reads a positive signed byte', () => {
      const reader = new BinaryReader(Buffer.from([0x7f]));
      expect(reader.readInt8()).toBe(127);
    });

    it("reads a negative signed byte (two's complement)", () => {
      const reader = new BinaryReader(Buffer.from([0x80]));
      expect(reader.readInt8()).toBe(-128);
    });

    it('advances the cursor by 1', () => {
      const reader = new BinaryReader(Buffer.from([0x01, 0x02]));
      reader.readInt8();
      expect(reader.position).toBe(1);
    });

    it('throws RangeError at end of buffer', () => {
      const reader = new BinaryReader(Buffer.alloc(0));
      expect(() => reader.readInt8()).toThrow(RangeError);
    });
  });

  describe('readUint8', () => {
    it('reads an unsigned byte', () => {
      const reader = new BinaryReader(Buffer.from([0xff]));
      expect(reader.readUint8()).toBe(255);
    });

    it('reads zero', () => {
      const reader = new BinaryReader(Buffer.from([0x00]));
      expect(reader.readUint8()).toBe(0);
    });

    it('advances the cursor by 1', () => {
      const reader = new BinaryReader(Buffer.from([0xab, 0xcd]));
      reader.readUint8();
      expect(reader.position).toBe(1);
    });
  });

  describe('readInt16', () => {
    it('reads a positive 16-bit little-endian value', () => {
      const buffer = Buffer.alloc(2);
      buffer.writeInt16LE(12345, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt16()).toBe(12345);
    });

    it('reads a negative 16-bit little-endian value', () => {
      const buffer = Buffer.alloc(2);
      buffer.writeInt16LE(-32768, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt16()).toBe(-32768);
    });

    it('reads little-endian byte order (low byte first)', () => {
      // 0x0100 in LE is [0x00, 0x01] = 256
      const reader = new BinaryReader(Buffer.from([0x00, 0x01]));
      expect(reader.readInt16()).toBe(256);
    });

    it('advances the cursor by 2', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      reader.readInt16();
      expect(reader.position).toBe(2);
    });

    it('throws RangeError when only 1 byte remains', () => {
      const reader = new BinaryReader(Buffer.alloc(1));
      expect(() => reader.readInt16()).toThrow(RangeError);
    });
  });

  describe('readUint16', () => {
    it('reads an unsigned 16-bit value', () => {
      const buffer = Buffer.alloc(2);
      buffer.writeUInt16LE(0xffff, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readUint16()).toBe(65535);
    });

    it('reads zero', () => {
      const reader = new BinaryReader(Buffer.alloc(2));
      expect(reader.readUint16()).toBe(0);
    });

    it('advances the cursor by 2', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      reader.readUint16();
      expect(reader.position).toBe(2);
    });
  });

  describe('readInt32', () => {
    it('reads a positive 32-bit little-endian value', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeInt32LE(0x7fff_ffff, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt32()).toBe(0x7fff_ffff);
    });

    it('reads a negative 32-bit little-endian value', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeInt32LE(-0x8000_0000, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt32()).toBe(-0x8000_0000);
    });

    it('reads little-endian byte order', () => {
      // 0x04030201 in LE is [0x01, 0x02, 0x03, 0x04]
      const reader = new BinaryReader(Buffer.from([0x01, 0x02, 0x03, 0x04]));
      expect(reader.readInt32()).toBe(0x04030201);
    });

    it('advances the cursor by 4', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      reader.readInt32();
      expect(reader.position).toBe(4);
    });

    it('throws RangeError when only 3 bytes remain', () => {
      const reader = new BinaryReader(Buffer.alloc(3));
      expect(() => reader.readInt32()).toThrow(RangeError);
    });
  });

  describe('readUint32', () => {
    it('reads an unsigned 32-bit value', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32LE(0xffff_ffff, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readUint32()).toBe(0xffff_ffff);
    });

    it('reads zero', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      expect(reader.readUint32()).toBe(0);
    });

    it('advances the cursor by 4', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      reader.readUint32();
      expect(reader.position).toBe(4);
    });
  });

  describe('readAscii', () => {
    it('reads a null-padded ASCII string', () => {
      const buffer = Buffer.from('PLAYPAL\0', 'ascii');
      const reader = new BinaryReader(buffer);
      expect(reader.readAscii(8)).toBe('PLAYPAL');
    });

    it('strips trailing nulls only', () => {
      const buffer = Buffer.alloc(8);
      buffer.write('E1M1', 'ascii');
      const reader = new BinaryReader(buffer);
      expect(reader.readAscii(8)).toBe('E1M1');
    });

    it('returns full string when no trailing nulls', () => {
      const buffer = Buffer.from('ABCDEFGH', 'ascii');
      const reader = new BinaryReader(buffer);
      expect(reader.readAscii(8)).toBe('ABCDEFGH');
    });

    it('returns empty string for all-null field', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      expect(reader.readAscii(8)).toBe('');
    });

    it('advances the cursor by the requested byte length', () => {
      const reader = new BinaryReader(Buffer.alloc(16));
      reader.readAscii(8);
      expect(reader.position).toBe(8);
    });

    it('throws RangeError when buffer is too short', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      expect(() => reader.readAscii(8)).toThrow(RangeError);
    });

    it('throws RangeError for negative byteLength (no cursor rewind)', () => {
      const reader = new BinaryReader(Buffer.alloc(8), 4);
      expect(() => reader.readAscii(-1)).toThrow(RangeError);
      expect(reader.position).toBe(4);
    });

    it('returns empty string and leaves cursor untouched for byteLength=0', () => {
      const reader = new BinaryReader(Buffer.alloc(8), 4);
      expect(reader.readAscii(0)).toBe('');
      expect(reader.position).toBe(4);
    });
  });

  describe('readBytes', () => {
    it('returns a copy of the requested bytes', () => {
      const source = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(source);
      const result = reader.readBytes(4);
      expect(result).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04]));
    });

    it('returned buffer is independent of the source', () => {
      const source = Buffer.from([0xaa, 0xbb]);
      const reader = new BinaryReader(source);
      const result = reader.readBytes(2);
      result[0] = 0x00;
      expect(source[0]).toBe(0xaa);
    });

    it('advances the cursor by byteLength', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      reader.readBytes(3);
      expect(reader.position).toBe(3);
    });

    it('throws RangeError when not enough bytes remain', () => {
      const reader = new BinaryReader(Buffer.alloc(2));
      expect(() => reader.readBytes(4)).toThrow(RangeError);
    });

    it('throws RangeError for negative byteLength (no cursor rewind)', () => {
      const reader = new BinaryReader(Buffer.alloc(8), 4);
      expect(() => reader.readBytes(-1)).toThrow(RangeError);
      expect(reader.position).toBe(4);
    });

    it('returns an empty buffer and leaves cursor untouched for byteLength=0', () => {
      const reader = new BinaryReader(Buffer.alloc(8), 4);
      const result = reader.readBytes(0);
      expect(result.length).toBe(0);
      expect(reader.position).toBe(4);
    });
  });

  describe('seek', () => {
    it('moves the cursor to an absolute position', () => {
      const reader = new BinaryReader(Buffer.alloc(16));
      reader.seek(8);
      expect(reader.position).toBe(8);
    });

    it('allows seeking to position 0', () => {
      const reader = new BinaryReader(Buffer.alloc(8), 4);
      reader.seek(0);
      expect(reader.position).toBe(0);
    });

    it('allows seeking to the end of the buffer', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      reader.seek(8);
      expect(reader.remaining).toBe(0);
    });

    it('throws RangeError for negative offset', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      expect(() => reader.seek(-1)).toThrow(RangeError);
    });

    it('throws RangeError for offset past buffer end', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      expect(() => reader.seek(9)).toThrow(RangeError);
    });
  });

  describe('skip', () => {
    it('advances the cursor by the given count', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      reader.skip(3);
      expect(reader.position).toBe(3);
    });

    it('allows skipping zero bytes', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      reader.skip(0);
      expect(reader.position).toBe(0);
    });

    it('allows skipping to the exact end', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      reader.skip(4);
      expect(reader.remaining).toBe(0);
    });

    it('throws RangeError for negative count', () => {
      const reader = new BinaryReader(Buffer.alloc(8));
      expect(() => reader.skip(-1)).toThrow(RangeError);
    });

    it('throws RangeError when skipping past end', () => {
      const reader = new BinaryReader(Buffer.alloc(4));
      expect(() => reader.skip(5)).toThrow(RangeError);
    });
  });

  describe('sequential multi-type reads', () => {
    it('reads a WAD header-like struct sequentially', () => {
      // Simulates parsing a 12-byte WAD header:
      // 4-byte ASCII type, 4-byte int32 lump count, 4-byte int32 directory offset
      const buffer = Buffer.alloc(12);
      buffer.write('IWAD', 0, 'ascii');
      buffer.writeInt32LE(1264, 4);
      buffer.writeInt32LE(4175796, 8);
      const reader = new BinaryReader(buffer);
      expect(reader.readAscii(4)).toBe('IWAD');
      expect(reader.readInt32()).toBe(1264);
      expect(reader.readInt32()).toBe(4175796);
      expect(reader.remaining).toBe(0);
    });

    it('reads a directory entry-like struct sequentially', () => {
      // Simulates a 16-byte WAD directory entry:
      // 4-byte int32 offset, 4-byte int32 size, 8-byte ASCII name
      const buffer = Buffer.alloc(16);
      buffer.writeInt32LE(0x00000c, 0);
      buffer.writeInt32LE(10752, 4);
      buffer.write('PLAYPAL\0', 8, 'ascii');
      const reader = new BinaryReader(buffer);
      expect(reader.readInt32()).toBe(0x00000c);
      expect(reader.readInt32()).toBe(10752);
      expect(reader.readAscii(8)).toBe('PLAYPAL');
      expect(reader.remaining).toBe(0);
    });

    it('reads a map vertex struct sequentially (two signed 16-bit values)', () => {
      // Doom vertex: int16 x, int16 y
      const buffer = Buffer.alloc(4);
      buffer.writeInt16LE(-1472, 0);
      buffer.writeInt16LE(3168, 2);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt16()).toBe(-1472);
      expect(reader.readInt16()).toBe(3168);
      expect(reader.remaining).toBe(0);
    });
  });

  describe('parity edge cases', () => {
    it('signed 16-bit 0xFFFF reads as -1, not 65535', () => {
      const reader = new BinaryReader(Buffer.from([0xff, 0xff]));
      expect(reader.readInt16()).toBe(-1);
    });

    it('unsigned 16-bit 0xFFFF reads as 65535, not -1', () => {
      const reader = new BinaryReader(Buffer.from([0xff, 0xff]));
      expect(reader.readUint16()).toBe(65535);
    });

    it('signed 32-bit 0xFFFFFFFF reads as -1', () => {
      const reader = new BinaryReader(Buffer.from([0xff, 0xff, 0xff, 0xff]));
      expect(reader.readInt32()).toBe(-1);
    });

    it('unsigned 32-bit 0xFFFFFFFF reads as 4294967295', () => {
      const reader = new BinaryReader(Buffer.from([0xff, 0xff, 0xff, 0xff]));
      expect(reader.readUint32()).toBe(4294967295);
    });

    it('signed 8-bit 0xFF reads as -1, not 255', () => {
      const reader = new BinaryReader(Buffer.from([0xff]));
      expect(reader.readInt8()).toBe(-1);
    });

    it('seek then read produces correct value at non-zero offset', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeInt32LE(42, 4);
      const reader = new BinaryReader(buffer);
      reader.seek(4);
      expect(reader.readInt32()).toBe(42);
    });
  });
});
