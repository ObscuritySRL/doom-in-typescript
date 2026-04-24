/**
 * Binary buffer assertion helpers for doom_codex test harness.
 *
 * Provides typed comparison primitives for verifying binary data
 * at exact byte offsets, with parity-oriented diagnostics. All
 * multi-byte reads use little-endian byte order per Doom convention.
 *
 * @example
 * ```ts
 * import { expectBufferEqual, expectLittleEndianU32 } from "./binaryAssert.ts";
 * expectBufferEqual(actual, expected);
 * expectLittleEndianU32(buffer, 0, 0x44415749); // "IWAD" magic
 * ```
 */

import { expect } from 'bun:test';

/**
 * Asserts two buffers have identical length and byte content.
 * On mismatch, reports the first differing byte offset and values.
 *
 * @param actual - The buffer under test.
 * @param expected - The reference buffer.
 *
 * @example
 * ```ts
 * expectBufferEqual(Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3]));
 * ```
 */
export function expectBufferEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.byteLength).toBe(expected.byteLength);
  for (let index = 0; index < expected.byteLength; index++) {
    if (actual[index] !== expected[index]) {
      throw new Error(`Buffer mismatch at offset 0x${index.toString(16).padStart(4, '0')}: ` + `actual=0x${actual[index]!.toString(16).padStart(2, '0')} ` + `expected=0x${expected[index]!.toString(16).padStart(2, '0')}`);
    }
  }
}

/**
 * Asserts a contiguous subrange of a buffer matches the expected bytes.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset into the buffer.
 * @param expected - Expected byte sequence at that offset.
 *
 * @example
 * ```ts
 * expectBufferSliceEqual(Buffer.from([0, 1, 2, 3]), 1, Buffer.from([1, 2]));
 * ```
 */
export function expectBufferSliceEqual(buffer: Uint8Array, offset: number, expected: Uint8Array): void {
  if (offset < 0 || offset + expected.byteLength > buffer.byteLength) {
    throw new RangeError(`Slice [0x${offset.toString(16)}, 0x${(offset + expected.byteLength).toString(16)}) ` + `exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  const slice = buffer.subarray(offset, offset + expected.byteLength);
  expectBufferEqual(slice, expected);
}

/**
 * Asserts the buffer has exactly the given byte length.
 *
 * @param buffer - The buffer under test.
 * @param expectedSize - Expected byte length.
 *
 * @example
 * ```ts
 * expectBufferSize(Buffer.alloc(12), 12);
 * ```
 */
export function expectBufferSize(buffer: Uint8Array, expectedSize: number): void {
  expect(buffer.byteLength).toBe(expectedSize);
}

/**
 * Asserts a null-padded ASCII string at the given offset matches
 * the expected value. Trailing null bytes within the field width
 * are stripped before comparison, matching WAD lump name semantics.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset of the ASCII field.
 * @param fieldWidth - Total field width in bytes (including padding).
 * @param expected - Expected string value (without null padding).
 *
 * @example
 * ```ts
 * const buffer = Buffer.from("IWAD\0\0\0\0", "ascii");
 * expectAsciiString(buffer, 0, 8, "IWAD");
 * ```
 */
export function expectAsciiString(buffer: Uint8Array, offset: number, fieldWidth: number, expected: string): void {
  if (offset < 0 || offset + fieldWidth > buffer.byteLength) {
    throw new RangeError(`ASCII field [0x${offset.toString(16)}, 0x${(offset + fieldWidth).toString(16)}) ` + `exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  let end = offset + fieldWidth;
  while (end > offset && buffer[end - 1] === 0) {
    end--;
  }
  const actual = Buffer.from(buffer.buffer, buffer.byteOffset + offset, end - offset).toString('ascii');
  expect(actual).toBe(expected);
}

/**
 * Asserts that the bytes at the given offset match a magic byte sequence.
 * This is a thin convenience wrapper over {@link expectBufferSliceEqual}
 * for readability in header validation tests.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset of the magic field.
 * @param magic - Expected magic bytes.
 *
 * @example
 * ```ts
 * expectMagic(wadBuffer, 0, Buffer.from("IWAD", "ascii"));
 * ```
 */
export function expectMagic(buffer: Uint8Array, offset: number, magic: Uint8Array): void {
  expectBufferSliceEqual(buffer, offset, magic);
}

/**
 * Reads an unsigned 16-bit little-endian integer at the given offset
 * and asserts it equals the expected value.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset.
 * @param expected - Expected uint16 value.
 *
 * @example
 * ```ts
 * expectLittleEndianU16(buffer, 0, 0x0003); // DMX format tag
 * ```
 */
export function expectLittleEndianU16(buffer: Uint8Array, offset: number, expected: number): void {
  if (offset < 0 || offset + 2 > buffer.byteLength) {
    throw new RangeError(`u16 read at 0x${offset.toString(16)} exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 2);
  const actual = view.getUint16(0, true);
  expect(actual).toBe(expected);
}

/**
 * Reads a signed 16-bit little-endian integer at the given offset
 * and asserts it equals the expected value.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset.
 * @param expected - Expected int16 value.
 *
 * @example
 * ```ts
 * expectLittleEndianI16(buffer, 0, -1); // sign extension check
 * ```
 */
export function expectLittleEndianI16(buffer: Uint8Array, offset: number, expected: number): void {
  if (offset < 0 || offset + 2 > buffer.byteLength) {
    throw new RangeError(`i16 read at 0x${offset.toString(16)} exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 2);
  const actual = view.getInt16(0, true);
  expect(actual).toBe(expected);
}

/**
 * Reads an unsigned 32-bit little-endian integer at the given offset
 * and asserts it equals the expected value.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset.
 * @param expected - Expected uint32 value.
 *
 * @example
 * ```ts
 * expectLittleEndianU32(buffer, 4, 1264); // DOOM1.WAD lump count
 * ```
 */
export function expectLittleEndianU32(buffer: Uint8Array, offset: number, expected: number): void {
  if (offset < 0 || offset + 4 > buffer.byteLength) {
    throw new RangeError(`u32 read at 0x${offset.toString(16)} exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  const actual = view.getUint32(0, true);
  expect(actual).toBe(expected);
}

/**
 * Reads a signed 32-bit little-endian integer at the given offset
 * and asserts it equals the expected value.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset.
 * @param expected - Expected int32 value.
 *
 * @example
 * ```ts
 * expectLittleEndianI32(buffer, 0, -32768); // signed coordinate
 * ```
 */
export function expectLittleEndianI32(buffer: Uint8Array, offset: number, expected: number): void {
  if (offset < 0 || offset + 4 > buffer.byteLength) {
    throw new RangeError(`i32 read at 0x${offset.toString(16)} exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  const actual = view.getInt32(0, true);
  expect(actual).toBe(expected);
}

/**
 * Reads an unsigned 8-bit integer at the given offset and asserts
 * it equals the expected value.
 *
 * @param buffer - The source buffer.
 * @param offset - Byte offset.
 * @param expected - Expected uint8 value (0-255).
 *
 * @example
 * ```ts
 * expectU8(buffer, 12, 0x80); // demo end marker
 * ```
 */
export function expectU8(buffer: Uint8Array, offset: number, expected: number): void {
  if (offset < 0 || offset >= buffer.byteLength) {
    throw new RangeError(`u8 read at 0x${offset.toString(16)} exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  expect(buffer[offset]).toBe(expected);
}

/**
 * Asserts that all bytes in the given range are zero. Useful for
 * verifying padding fields or cleared memory regions.
 *
 * @param buffer - The source buffer.
 * @param offset - Start byte offset.
 * @param length - Number of bytes to check.
 *
 * @example
 * ```ts
 * expectZeroFilled(buffer, 4, 8); // 8 zero-padding bytes at offset 4
 * ```
 */
export function expectZeroFilled(buffer: Uint8Array, offset: number, length: number): void {
  if (offset < 0 || offset + length > buffer.byteLength) {
    throw new RangeError(`Zero-fill check [0x${offset.toString(16)}, 0x${(offset + length).toString(16)}) ` + `exceeds buffer length 0x${buffer.byteLength.toString(16)}`);
  }
  for (let index = offset; index < offset + length; index++) {
    if (buffer[index] !== 0) {
      throw new Error(`Expected zero at offset 0x${index.toString(16).padStart(4, '0')}, ` + `got 0x${buffer[index]!.toString(16).padStart(2, '0')}`);
    }
  }
}
