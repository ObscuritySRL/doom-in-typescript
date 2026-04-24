/**
 * Cursor-based little-endian binary reader for Doom data formats.
 *
 * Doom WAD lumps, map data, and config structures are all stored as
 * tightly packed little-endian binary. This reader wraps a Buffer and
 * maintains a monotonically advancing cursor, providing typed reads
 * that match the exact signedness and byte width of the original C
 * struct fields.
 *
 * @example
 * ```ts
 * import { BinaryReader } from "../src/core/binaryReader.ts";
 * const reader = new BinaryReader(buffer);
 * const offset = reader.readInt32();  // signed 32-bit LE
 * const flags = reader.readUint16();  // unsigned 16-bit LE
 * const name = reader.readAscii(8);   // null-padded ASCII
 * ```
 */

/**
 * Sequential little-endian binary reader over a Buffer.
 *
 * Every `read*` method advances the internal cursor by the number of
 * bytes consumed. Out-of-bounds reads throw `RangeError`.
 *
 * @example
 * ```ts
 * const reader = new BinaryReader(Buffer.from([0x01, 0x00, 0x00, 0x00]));
 * reader.readInt32(); // 1
 * reader.remaining;   // 0
 * ```
 */
export class BinaryReader {
  #buffer: Buffer;
  #offset: number;

  /**
   * @param buffer - The backing buffer to read from.
   * @param offset - Optional starting cursor position (default 0).
   */
  constructor(buffer: Buffer, offset = 0) {
    if (offset < 0 || offset > buffer.length) {
      throw new RangeError(`Initial offset ${offset} is out of range [0, ${buffer.length}]`);
    }
    this.#buffer = buffer;
    this.#offset = offset;
  }

  /** Current cursor position in bytes from the start of the buffer. */
  get position(): number {
    return this.#offset;
  }

  /** Number of unread bytes remaining after the cursor. */
  get remaining(): number {
    return this.#buffer.length - this.#offset;
  }

  /** Total byte length of the backing buffer. */
  get length(): number {
    return this.#buffer.length;
  }

  /**
   * Read a signed 8-bit integer and advance the cursor by 1.
   *
   * @example
   * ```ts
   * reader.readInt8(); // -128 to 127
   * ```
   */
  readInt8(): number {
    this.#boundsCheck(1);
    const value = this.#buffer.readInt8(this.#offset);
    this.#offset += 1;
    return value;
  }

  /**
   * Read an unsigned 8-bit integer and advance the cursor by 1.
   *
   * @example
   * ```ts
   * reader.readUint8(); // 0 to 255
   * ```
   */
  readUint8(): number {
    this.#boundsCheck(1);
    const value = this.#buffer.readUInt8(this.#offset);
    this.#offset += 1;
    return value;
  }

  /**
   * Read a signed 16-bit little-endian integer and advance the cursor by 2.
   *
   * Used for map vertex coordinates, linedef fields, and other
   * signed 16-bit struct members in Doom binary formats.
   *
   * @example
   * ```ts
   * reader.readInt16(); // -32768 to 32767
   * ```
   */
  readInt16(): number {
    this.#boundsCheck(2);
    const value = this.#buffer.readInt16LE(this.#offset);
    this.#offset += 2;
    return value;
  }

  /**
   * Read an unsigned 16-bit little-endian integer and advance the cursor by 2.
   *
   * Used for linedef flags, texture indices, and other unsigned
   * 16-bit struct members in Doom binary formats.
   *
   * @example
   * ```ts
   * reader.readUint16(); // 0 to 65535
   * ```
   */
  readUint16(): number {
    this.#boundsCheck(2);
    const value = this.#buffer.readUInt16LE(this.#offset);
    this.#offset += 2;
    return value;
  }

  /**
   * Read a signed 32-bit little-endian integer and advance the cursor by 4.
   *
   * Used for WAD offsets, lump sizes, fixed_t values, and other
   * signed 32-bit struct members in Doom binary formats.
   *
   * @example
   * ```ts
   * reader.readInt32(); // -2147483648 to 2147483647
   * ```
   */
  readInt32(): number {
    this.#boundsCheck(4);
    const value = this.#buffer.readInt32LE(this.#offset);
    this.#offset += 4;
    return value;
  }

  /**
   * Read an unsigned 32-bit little-endian integer and advance the cursor by 4.
   *
   * Used for angle_t values, blockmap sizes, and other unsigned
   * 32-bit fields in Doom binary formats.
   *
   * @example
   * ```ts
   * reader.readUint32(); // 0 to 4294967295
   * ```
   */
  readUint32(): number {
    this.#boundsCheck(4);
    const value = this.#buffer.readUInt32LE(this.#offset);
    this.#offset += 4;
    return value;
  }

  /**
   * Read a null-padded ASCII string and advance the cursor by `byteLength`.
   *
   * Trailing null bytes are stripped. This matches the WAD lump name
   * format (8-byte field, ASCII, right-padded with `\0`).
   *
   * @param byteLength - Number of bytes to consume (not characters).
   *
   * @example
   * ```ts
   * reader.readAscii(8); // "PLAYPAL" (trailing nulls stripped)
   * ```
   */
  readAscii(byteLength: number): string {
    this.#boundsCheck(byteLength);
    const value = this.#buffer
      .subarray(this.#offset, this.#offset + byteLength)
      .toString('ascii')
      .replace(/\0+$/, '');
    this.#offset += byteLength;
    return value;
  }

  /**
   * Read `byteLength` raw bytes as a new Buffer and advance the cursor.
   *
   * The returned Buffer is a copy, not a view into the backing buffer,
   * so mutations do not affect the reader's data.
   *
   * @param byteLength - Number of bytes to read.
   *
   * @example
   * ```ts
   * const raw = reader.readBytes(4); // Buffer of 4 bytes
   * ```
   */
  readBytes(byteLength: number): Buffer {
    this.#boundsCheck(byteLength);
    const value = Buffer.from(this.#buffer.subarray(this.#offset, this.#offset + byteLength));
    this.#offset += byteLength;
    return value;
  }

  /**
   * Move the cursor to an absolute byte offset.
   *
   * @param offset - Absolute position within the buffer.
   * @throws {RangeError} If the offset is outside `[0, length]`.
   *
   * @example
   * ```ts
   * reader.seek(12); // jump to byte 12
   * ```
   */
  seek(offset: number): void {
    if (offset < 0 || offset > this.#buffer.length) {
      throw new RangeError(`Seek offset ${offset} is out of range [0, ${this.#buffer.length}]`);
    }
    this.#offset = offset;
  }

  /**
   * Advance the cursor by `byteCount` bytes without reading.
   *
   * @param byteCount - Number of bytes to skip (must be non-negative).
   * @throws {RangeError} If skipping would move past the end of the buffer.
   *
   * @example
   * ```ts
   * reader.skip(4); // skip 4 bytes of padding
   * ```
   */
  skip(byteCount: number): void {
    this.#boundsCheck(byteCount);
    this.#offset += byteCount;
  }

  #boundsCheck(byteCount: number): void {
    if (byteCount < 0) {
      throw new RangeError(`Byte count must be non-negative, got ${byteCount}`);
    }
    if (this.#offset + byteCount > this.#buffer.length) {
      throw new RangeError(`Read of ${byteCount} bytes at offset ${this.#offset} exceeds buffer length ${this.#buffer.length}`);
    }
  }
}
