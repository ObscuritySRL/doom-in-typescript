/**
 * MUS lump parser.
 *
 * Parses the MUS music format used by Doom.  MUS is a simplified MIDI-like
 * format with a 4-byte magic identifier ("MUS\x1A"), a fixed header, an
 * instrument list, and a compact score section.
 *
 * MUS uses 16 channels (0-15) with channel 15 reserved as the percussion
 * channel (mapped to MIDI channel 9 during playback).
 *
 * @example
 * ```ts
 * import { parseMus, MUS_MAGIC } from "../src/assets/mus.ts";
 * const header = parseMus(musLumpData);
 * console.log(header.scoreLength);   // byte length of the score section
 * console.log(header.channelCount);  // number of primary channels used
 * console.log(header.instruments);   // instrument numbers referenced
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** 4-byte magic identifier at the start of every MUS lump: "MUS\x1A". */
export const MUS_MAGIC = 'MUS\x1A';

/** Byte size of the fixed MUS header (magic + 6 uint16 fields = 16 bytes). */
export const MUS_HEADER_SIZE = 16;

/** Maximum number of MUS channels (0-15). */
export const MUS_MAX_CHANNELS = 16;

/** Percussion channel index (always channel 15, mapped to MIDI channel 9). */
export const MUS_PERCUSSION_CHANNEL = 15;

/** Parsed MUS lump header and instrument list. */
export interface MusHeader {
  /** Byte length of the score data section. */
  readonly scoreLength: number;

  /** Byte offset from lump start to the first score byte. */
  readonly scoreStart: number;

  /** Number of primary channels used in the composition. */
  readonly channelCount: number;

  /** Number of secondary channels (always 0 in practice). */
  readonly secondaryChannelCount: number;

  /** Number of instruments referenced by the score. */
  readonly instrumentCount: number;

  /** Frozen array of instrument numbers referenced by the score. */
  readonly instruments: readonly number[];

  /** Raw score data as a Buffer slice. */
  readonly scoreData: Buffer;
}

/**
 * Parse a MUS lump into its header, instrument list, and score data.
 *
 * @param lumpData - Raw MUS lump data.
 * @returns Frozen MusHeader with instrument list and score data.
 * @throws {RangeError} If the lump is too small or has an invalid header.
 */
export function parseMus(lumpData: Buffer): Readonly<MusHeader> {
  if (lumpData.length < MUS_HEADER_SIZE) {
    throw new RangeError(`MUS lump must be at least ${MUS_HEADER_SIZE} bytes, got ${lumpData.length}`);
  }

  const reader = new BinaryReader(lumpData);

  const magic = reader.readAscii(4);
  if (magic !== MUS_MAGIC) {
    throw new RangeError(`MUS lump has invalid magic: expected "MUS\\x1A", got ${JSON.stringify(magic)}`);
  }

  const scoreLength = reader.readUint16();
  const scoreStart = reader.readUint16();
  const channelCount = reader.readUint16();
  const secondaryChannelCount = reader.readUint16();
  const instrumentCount = reader.readUint16();

  // Skip 2 bytes of padding
  reader.skip(2);

  if (channelCount > MUS_MAX_CHANNELS) {
    throw new RangeError(`MUS channel count ${channelCount} exceeds maximum ${MUS_MAX_CHANNELS}`);
  }

  const expectedInstrumentEnd = MUS_HEADER_SIZE + instrumentCount * 2;
  if (lumpData.length < expectedInstrumentEnd) {
    throw new RangeError(`MUS lump too small for ${instrumentCount} instruments: need ${expectedInstrumentEnd} bytes, got ${lumpData.length}`);
  }

  const instruments: number[] = new Array(instrumentCount);
  for (let index = 0; index < instrumentCount; index++) {
    instruments[index] = reader.readUint16();
  }

  if (scoreStart < expectedInstrumentEnd) {
    throw new RangeError(`MUS scoreStart (${scoreStart}) overlaps the instrument list ending at byte ${expectedInstrumentEnd}`);
  }
  if (scoreStart > lumpData.length) {
    throw new RangeError(`MUS scoreStart (${scoreStart}) exceeds lump size (${lumpData.length})`);
  }
  const scoreEnd = scoreStart + scoreLength;
  if (scoreEnd > lumpData.length) {
    throw new RangeError(`MUS score section [${scoreStart}, ${scoreEnd}) exceeds lump size (${lumpData.length})`);
  }

  const scoreData = Buffer.from(lumpData.subarray(scoreStart, scoreEnd));

  const header: MusHeader = {
    scoreLength,
    scoreStart,
    channelCount,
    secondaryChannelCount,
    instrumentCount,
    instruments: Object.freeze(instruments),
    scoreData,
  };

  return Object.freeze(header);
}
