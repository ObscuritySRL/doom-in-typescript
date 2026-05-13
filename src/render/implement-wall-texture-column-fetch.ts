/**
 * Vanilla DOOM 1.9 R_GetColumn wall-texture column fetch contract.
 *
 * From Chocolate Doom 2.2.1 r_data.c R_GetColumn and R_InitTextures:
 *
 *   // texturewidthmask[i] is computed in R_InitTextures:
 *   j = 1;
 *   while (j * 2 <= texture->width)
 *       j <<= 1;
 *   texturewidthmask[i] = j - 1;
 *   //
 *   // For power-of-2 widths (typical: 64, 128, 256), j ends at width,
 *   // so mask = width-1 and the column lookup wraps correctly.
 *   //
 *   // For non-power-of-2 widths (rare: e.g. 100, 192), j ends at the
 *   // largest power-of-2 <= width/2 ... actually <= width.  E.g. width=100
 *   // -> j=64 -> mask=63.  A texture column at index 70 becomes (70 & 63)
 *   // = 6, NOT a wrap to the texture's real column 70.  This is the
 *   // vanilla non-power-of-2 wrap quirk preserved by Chocolate Doom.
 *
 *   int R_GetColumn(int tex, int col)
 *   {
 *       int   lump, ofs;
 *       col &= texturewidthmask[tex];
 *       lump = texturecolumnlump[tex][col];
 *       ofs  = texturecolumnofs[tex][col];
 *       if (lump > 0)
 *           return (byte *)W_CacheLumpNum(lump, PU_CACHE) + ofs;
 *       if (!texturecomposite[tex])
 *           R_GenerateComposite(tex);
 *       return texturecomposite[tex] + ofs;
 *   }
 *
 * Notes for parity:
 *   - texturewidthmask is the largest-power-of-2-minus-1 that fits in the texture width.
 *   - Column index is ALWAYS masked with texturewidthmask, regardless of whether the
 *     width is itself a power of 2.
 *   - For non-power-of-2 textures, columns beyond the mask wrap to lower columns,
 *     producing the "vanilla wrap" visual artifact on rare textures.
 *   - Negative column indices wrap through two's-complement bitwise-AND, which is
 *     correct for vanilla but only because col is converted from a positive fixed-point
 *     offset; arbitrary negative inputs would produce undefined behavior in C.
 */

export interface TextureWidthMaskInput {
  readonly textureWidth: number;
}

export function computeVanillaTextureWidthMask(input: TextureWidthMaskInput): number {
  if (input.textureWidth <= 0) {
    throw new RangeError(`textureWidth must be positive, got ${input.textureWidth}`);
  }
  let j = 1;
  while (j * 2 <= input.textureWidth) {
    j <<= 1;
  }
  return j - 1;
}

export interface ColumnFetchInput {
  readonly textureWidthMask: number;
  readonly column: number;
}

export function fetchVanillaTextureColumnIndex(input: ColumnFetchInput): number {
  return (input.column & input.textureWidthMask) >>> 0;
}

export function vanillaTextureWidthIsPowerOfTwo(width: number): boolean {
  return width > 0 && (width & (width - 1)) === 0;
}
