/**
 * Vanilla DOOM 1.9 blockmap coordinate conversion (P_BlockMapXYIndex).
 *
 * Blockmap cells are 128 map units wide (MAPBLOCKUNITS = 128, the blockmap
 * shift is FRACBITS+7 = 16+7 = 23 when working in fixed_t). Cell coordinates
 * are computed as (x - origin) >> MAPBLOCKSHIFT in vanilla integer units.
 * Out-of-range cells produce -1.
 */

export const VANILLA_MAPBLOCKUNITS = 128;
export const VANILLA_MAPBLOCKSHIFT_FIXED = 16 + 7;
export const VANILLA_BLOCKMAP_OUT_OF_RANGE = -1;

export interface BlockmapHeader {
  readonly originX: number;
  readonly originY: number;
  readonly columns: number;
  readonly rows: number;
}

export function pointToBlockmapCell(header: BlockmapHeader, pointX: number, pointY: number): { readonly column: number; readonly row: number; readonly inRange: boolean } {
  const column = Math.floor((pointX - header.originX) / VANILLA_MAPBLOCKUNITS);
  const row = Math.floor((pointY - header.originY) / VANILLA_MAPBLOCKUNITS);
  const inRange = column >= 0 && column < header.columns && row >= 0 && row < header.rows;
  return Object.freeze({ column, row, inRange });
}

export function blockmapCellLinearIndex(header: BlockmapHeader, column: number, row: number): number {
  if (column < 0 || column >= header.columns || row < 0 || row >= header.rows) {
    return VANILLA_BLOCKMAP_OUT_OF_RANGE;
  }
  return row * header.columns + column;
}
