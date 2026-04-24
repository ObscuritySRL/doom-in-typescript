/**
 * DMX sound effect lump loader.
 *
 * Parses the digital sound lumps (DS* prefix) produced by the DMX sound
 * library and shipped in Doom IWADs. The on-disk layout is an 8-byte
 * little-endian header followed by unsigned 8-bit PCM samples:
 *
 * | Offset | Type      | Field        | Notes                         |
 * | ------ | --------- | ------------ | ----------------------------- |
 * | 0      | uint16LE  | format       | Always `0x0003` for DMX PCM   |
 * | 2      | uint16LE  | sampleRate   | Hz, typically `11025`         |
 * | 4      | uint32LE  | sampleCount  | Byte count of the PCM body    |
 * | 8      | uint8[N]  | samples      | Unsigned 8-bit PCM, N bytes   |
 *
 * DMX writes one duplicate "padding" sample at byte 8 and one at the
 * final byte; callers that want only the audible region use
 * `playableSampleStart` / `playableSampleCount`. Sample 128 (0x80) is
 * the DC-zero midpoint of the unsigned encoding.
 *
 * @example
 * ```ts
 * import { parseSfxLump } from "../src/audio/sfxLumps.ts";
 * const sfx = parseSfxLump(lookup.getLumpData("DSPISTOL", wad));
 * sfx.sampleRate;          // 11025
 * sfx.sampleCount;         // full body length including 2 padding bytes
 * sfx.playableSampleCount; // sampleCount - 2
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** Byte size of the DMX sound header (format + rate + count). */
export const SFX_HEADER_SIZE = 8;

/** Required `format` field value for the digital PCM DMX variant. */
export const SFX_FORMAT_DIGITAL = 3;

/** Default sample rate used by every stock Doom sfx except `DSITMBK`. */
export const SFX_DEFAULT_SAMPLE_RATE = 11025;

/** Lump-name prefix identifying digital sound effects. */
export const SFX_LUMP_PREFIX = 'DS';

/**
 * Number of duplicate padding bytes DMX writes at the start and end of
 * the PCM body. Stripping both yields the audible sample region.
 */
export const SFX_PADDING_BYTES = 2;

/** DC-zero midpoint of the unsigned 8-bit PCM encoding. */
export const SFX_SILENCE_BYTE = 0x80;

/** Parsed DMX sound lump with header fields and a view over the PCM body. */
export interface SfxLump {
  /** Raw `format` field from the header. Validated to equal `SFX_FORMAT_DIGITAL`. */
  readonly format: number;

  /** Sample rate in Hz from the header. */
  readonly sampleRate: number;

  /** Total PCM byte count as recorded in the header (includes padding). */
  readonly sampleCount: number;

  /** Unsigned 8-bit PCM samples including the leading and trailing padding bytes. */
  readonly samples: Buffer;

  /** Index within `samples` of the first audible byte (always `SFX_PADDING_BYTES / 2`). */
  readonly playableSampleStart: number;

  /** Number of audible samples (`sampleCount` minus the two padding bytes). */
  readonly playableSampleCount: number;
}

/**
 * Parse a DMX digital sound lump.
 *
 * @param lumpData - Raw bytes of a `DS*` lump from a WAD.
 * @returns Frozen {@link SfxLump} describing the header and a copied PCM body.
 * @throws {RangeError} If the lump is too small, its `format` field is not
 *   `SFX_FORMAT_DIGITAL`, or the body length disagrees with the header.
 */
export function parseSfxLump(lumpData: Buffer): Readonly<SfxLump> {
  if (lumpData.length < SFX_HEADER_SIZE) {
    throw new RangeError(`SFX lump must be at least ${SFX_HEADER_SIZE} bytes, got ${lumpData.length}`);
  }

  const reader = new BinaryReader(lumpData);
  const format = reader.readUint16();
  const sampleRate = reader.readUint16();
  const sampleCount = reader.readUint32();

  if (format !== SFX_FORMAT_DIGITAL) {
    throw new RangeError(`SFX lump has unsupported format ${format}, expected ${SFX_FORMAT_DIGITAL}`);
  }

  const expectedLength = SFX_HEADER_SIZE + sampleCount;
  if (lumpData.length !== expectedLength) {
    throw new RangeError(`SFX lump body mismatch: header claims ${sampleCount} samples (${expectedLength} bytes total), got ${lumpData.length}`);
  }

  if (sampleCount < SFX_PADDING_BYTES) {
    throw new RangeError(`SFX lump sampleCount ${sampleCount} is smaller than ${SFX_PADDING_BYTES} padding bytes`);
  }

  const samples = Buffer.from(lumpData.subarray(SFX_HEADER_SIZE, SFX_HEADER_SIZE + sampleCount));
  const playableSampleStart = SFX_PADDING_BYTES / 2;
  const playableSampleCount = sampleCount - SFX_PADDING_BYTES;

  const lump: SfxLump = {
    format,
    sampleRate,
    sampleCount,
    samples,
    playableSampleStart,
    playableSampleCount,
  };

  return Object.freeze(lump);
}

/**
 * Predicate identifying digital sound effect lumps by name.
 *
 * Matches vanilla Doom's `DS` prefix convention (case-insensitive), which
 * distinguishes digital sfx lumps from their PC-speaker `DP` siblings and
 * from demo/data lumps that happen to share short names.
 *
 * @param name - Lump name to test.
 */
export function isSfxLumpName(name: string): boolean {
  return name.length > SFX_LUMP_PREFIX.length && name.slice(0, SFX_LUMP_PREFIX.length).toUpperCase() === SFX_LUMP_PREFIX;
}
