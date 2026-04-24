/**
 * TEXTUREx lump parser.
 *
 * Parses a TEXTURE1 or TEXTURE2 lump from a WAD file into an array of
 * composite texture definitions.  Each texture references one or more
 * patches from the PNAMES table by index.
 *
 * Binary layout of the lump:
 *
 * | Offset   | Size              | Field                                      |
 * | -------- | ----------------- | ------------------------------------------ |
 * | 0        | 4                 | int32LE texture count                      |
 * | 4        | count × 4         | int32LE offset directory (from lump start)  |
 * | variable | 22 + patches × 10 | per-texture definition blocks               |
 *
 * Per-texture definition (maptexture_t):
 *
 * | Offset | Size | Field                                       |
 * | ------ | ---- | ------------------------------------------- |
 * | 0      | 8    | null-padded ASCII name                      |
 * | 8      | 4    | int32LE masked (boolean flag)                |
 * | 12     | 2    | int16LE width                               |
 * | 14     | 2    | int16LE height                              |
 * | 16     | 4    | int32LE obsolete (column directory, unused)  |
 * | 20     | 2    | int16LE patchcount                          |
 * | 22     | n×10 | mappatch_t entries                           |
 *
 * Per-patch entry (mappatch_t):
 *
 * | Offset | Size | Field                        |
 * | ------ | ---- | ---------------------------- |
 * | 0      | 2    | int16LE originx              |
 * | 2      | 2    | int16LE originy              |
 * | 4      | 2    | int16LE patch (PNAMES index) |
 * | 6      | 2    | int16LE stepdir (unused)     |
 * | 8      | 2    | int16LE colormap (unused)    |
 *
 * @example
 * ```ts
 * import { parseTextureLump } from "../src/assets/texture1.ts";
 * const textures = parseTextureLump(texture1LumpData);
 * console.log(textures[0].name);                // "AASTINKY"
 * console.log(textures[0].patches[0].patchIndex); // PNAMES index
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** Byte size of the texture count field at the start of a TEXTUREx lump. */
export const TEXTURE_COUNT_SIZE = 4;

/** Byte size of each entry in the texture offset directory. */
export const TEXTURE_OFFSET_SIZE = 4;

/** Byte size of a texture definition header (before patch entries). */
export const TEXTURE_DEFINITION_HEADER_SIZE = 22;

/** Byte size of the name field within a texture definition. */
export const TEXTURE_NAME_SIZE = 8;

/** Byte size of a single patch entry within a texture definition. */
export const TEXTURE_PATCH_ENTRY_SIZE = 10;

/** A single patch reference within a composite texture definition. */
export interface TexturePatchDefinition {
  /** X offset of this patch within the texture. */
  readonly originX: number;
  /** Y offset of this patch within the texture. */
  readonly originY: number;
  /** Index into the PNAMES array identifying the patch graphic. */
  readonly patchIndex: number;
}

/** A composite texture definition from a TEXTUREx lump. */
export interface TextureDefinition {
  /** Texture name (up to 8 uppercase ASCII characters). */
  readonly name: string;
  /** Whether this texture is masked (has transparent pixels). */
  readonly masked: boolean;
  /** Width of the texture in pixels. */
  readonly width: number;
  /** Height of the texture in pixels. */
  readonly height: number;
  /** Number of patches composing this texture. */
  readonly patchCount: number;
  /** Frozen array of patch references composing this texture. */
  readonly patches: readonly TexturePatchDefinition[];
}

/**
 * Parse a TEXTUREx lump into a frozen array of texture definitions.
 *
 * Works for both TEXTURE1 and TEXTURE2 lumps as they share the same
 * binary format.  DOOM1.WAD (shareware) contains only TEXTURE1.
 *
 * @param lumpData - Raw TEXTUREx lump data.
 * @returns Frozen array of texture definitions in lump order.
 * @throws {RangeError} If the lump is truncated or contains invalid data.
 */
export function parseTextureLump(lumpData: Buffer | Uint8Array): readonly TextureDefinition[] {
  if (lumpData.length < TEXTURE_COUNT_SIZE) {
    throw new RangeError(`TEXTUREx lump must be at least ${TEXTURE_COUNT_SIZE} bytes, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer);

  const count = reader.readInt32();
  if (count < 0) {
    throw new RangeError(`TEXTUREx texture count must be non-negative, got ${count}`);
  }

  const directoryEnd = TEXTURE_COUNT_SIZE + count * TEXTURE_OFFSET_SIZE;
  if (buffer.length < directoryEnd) {
    throw new RangeError(`TEXTUREx lump too small for offset directory: needs ${directoryEnd} bytes, got ${buffer.length}`);
  }

  const offsets: number[] = new Array(count);
  for (let index = 0; index < count; index++) {
    offsets[index] = reader.readInt32();
  }

  const textures: TextureDefinition[] = new Array(count);
  for (let index = 0; index < count; index++) {
    const offset = offsets[index]!;
    if (offset < 0 || offset + TEXTURE_DEFINITION_HEADER_SIZE > buffer.length) {
      throw new RangeError(`TEXTUREx texture ${index} offset ${offset} is out of range`);
    }

    reader.seek(offset);
    const name = reader.readAscii(TEXTURE_NAME_SIZE).toUpperCase();
    const maskedValue = reader.readInt32();
    const width = reader.readInt16();
    const height = reader.readInt16();
    reader.skip(4); // obsolete columndirectory field
    const patchCount = reader.readInt16();

    if (width <= 0 || height <= 0) {
      throw new RangeError(`TEXTUREx texture "${name}" must have positive dimensions, got ${width}x${height}`);
    }

    if (patchCount < 0) {
      throw new RangeError(`TEXTUREx texture "${name}" has negative patch count ${patchCount}`);
    }

    const patchEnd = offset + TEXTURE_DEFINITION_HEADER_SIZE + patchCount * TEXTURE_PATCH_ENTRY_SIZE;
    if (patchEnd > buffer.length) {
      throw new RangeError(`TEXTUREx texture "${name}" patch data extends past lump end: ` + `needs ${patchEnd} bytes, lump is ${buffer.length} bytes`);
    }

    const patches: TexturePatchDefinition[] = new Array(patchCount);
    for (let patchSlot = 0; patchSlot < patchCount; patchSlot++) {
      const originX = reader.readInt16();
      const originY = reader.readInt16();
      const patchNameIndex = reader.readInt16();
      reader.skip(4); // stepdir + colormap (unused)

      if (patchNameIndex < 0) {
        throw new RangeError(`TEXTUREx texture "${name}" patch ${patchSlot} has negative patch index ${patchNameIndex}`);
      }

      patches[patchSlot] = {
        originX,
        originY,
        patchIndex: patchNameIndex,
      };
    }

    textures[index] = {
      name,
      masked: maskedValue !== 0,
      width,
      height,
      patchCount,
      patches: Object.freeze(patches),
    };
  }

  return Object.freeze(textures);
}
