/**
 * BSP node, subsector, and seg binary lump loaders.
 *
 * Parses the three BSP-related map lumps (SEGS, SSECTORS, NODES)
 * matching the on-disk struct layouts in Chocolate Doom's doomdata.h
 * and the P_LoadSegs, P_LoadSubsectors, P_LoadNodes functions in
 * p_setup.c.
 *
 * @example
 * ```ts
 * import { parseSegs, parseSubsectors, parseNodes } from "../src/map/bspStructs.ts";
 * const segs = parseSegs(bundle.segs);
 * const subsectors = parseSubsectors(bundle.ssectors);
 * const nodes = parseNodes(bundle.nodes);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS } from '../core/fixed.ts';
import { BinaryReader } from '../core/binaryReader.ts';

/** Size of a single mapseg_t entry in the WAD binary format (bytes). */
export const MAPSEG_SIZE = 12;

/** Size of a single mapsubsector_t entry in the WAD binary format (bytes). */
export const MAPSUBSECTOR_SIZE = 4;

/** Size of a single mapnode_t entry in the WAD binary format (bytes). */
export const MAPNODE_SIZE = 28;

/** Bit flag in node children indicating a subsector leaf (bit 15). */
export const NF_SUBSECTOR = 0x8000;

/**
 * A parsed map seg matching mapseg_t from doomdata.h.
 *
 * On-disk fields are signed int16; angle is left-shifted by 16 to BAM
 * format and offset by FRACBITS to 16.16 fixed-point, matching
 * P_LoadSegs in p_setup.c.
 */
export interface MapSeg {
  /** Start vertex index. */
  readonly v1: number;
  /** End vertex index. */
  readonly v2: number;
  /** Binary Angle Measurement (signed int16 << 16). */
  readonly angle: number;
  /** Linedef index this seg belongs to. */
  readonly linedef: number;
  /** Side of the linedef (0 = front, 1 = back). */
  readonly side: number;
  /** Distance along the linedef to the start of this seg (16.16 fixed-point). */
  readonly offset: Fixed;
}

/**
 * A parsed map subsector matching mapsubsector_t from doomdata.h.
 *
 * Each subsector references a contiguous range of segs that form
 * its boundary. Fields match P_LoadSubsectors in p_setup.c.
 */
export interface MapSubsector {
  /** Number of segs in this subsector. */
  readonly numsegs: number;
  /** Index of the first seg in this subsector. */
  readonly firstseg: number;
}

/**
 * A parsed BSP node matching mapnode_t from doomdata.h.
 *
 * Partition coordinates and bounding boxes are left-shifted by
 * FRACBITS to 16.16 fixed-point. Children encode either a node
 * index or a subsector index with the NF_SUBSECTOR flag set,
 * matching P_LoadNodes in p_setup.c.
 */
export interface MapNode {
  /** Partition line X coordinate (16.16 fixed-point). */
  readonly x: Fixed;
  /** Partition line Y coordinate (16.16 fixed-point). */
  readonly y: Fixed;
  /** Partition line delta X (16.16 fixed-point). */
  readonly dx: Fixed;
  /** Partition line delta Y (16.16 fixed-point). */
  readonly dy: Fixed;
  /** Bounding boxes for right [0] and left [1] children, each [top, bottom, left, right] in fixed-point. */
  readonly bbox: readonly [readonly [Fixed, Fixed, Fixed, Fixed], readonly [Fixed, Fixed, Fixed, Fixed]];
  /** Right [0] and left [1] child indices. If NF_SUBSECTOR is set, lower 15 bits are a subsector index. */
  readonly children: readonly [number, number];
}

/**
 * Parse the SEGS lump into an array of map segs.
 *
 * Reads sequential 12-byte mapseg_t structs (six signed int16LE
 * fields each), left-shifting angle by 16 and offset by FRACBITS,
 * matching P_LoadSegs in p_setup.c.
 *
 * @param lumpData - Raw SEGS lump buffer.
 * @returns Frozen array of frozen MapSeg entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPSEG_SIZE.
 */
export function parseSegs(lumpData: Buffer): readonly MapSeg[] {
  if (lumpData.length % MAPSEG_SIZE !== 0) {
    throw new RangeError(`SEGS lump size ${lumpData.length} is not a multiple of ${MAPSEG_SIZE}`);
  }

  const count = lumpData.length / MAPSEG_SIZE;
  const reader = new BinaryReader(lumpData);
  const segs: MapSeg[] = new Array(count);

  for (let index = 0; index < count; index++) {
    segs[index] = Object.freeze({
      v1: reader.readInt16(),
      v2: reader.readInt16(),
      angle: (reader.readInt16() << 16) | 0,
      linedef: reader.readInt16(),
      side: reader.readInt16(),
      offset: (reader.readInt16() << FRACBITS) | 0,
    });
  }

  return Object.freeze(segs);
}

/**
 * Parse the SSECTORS lump into an array of map subsectors.
 *
 * Reads sequential 4-byte mapsubsector_t structs (two signed int16LE
 * fields each), matching P_LoadSubsectors in p_setup.c.
 *
 * @param lumpData - Raw SSECTORS lump buffer.
 * @returns Frozen array of frozen MapSubsector entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPSUBSECTOR_SIZE.
 */
export function parseSubsectors(lumpData: Buffer): readonly MapSubsector[] {
  if (lumpData.length % MAPSUBSECTOR_SIZE !== 0) {
    throw new RangeError(`SSECTORS lump size ${lumpData.length} is not a multiple of ${MAPSUBSECTOR_SIZE}`);
  }

  const count = lumpData.length / MAPSUBSECTOR_SIZE;
  const reader = new BinaryReader(lumpData);
  const subsectors: MapSubsector[] = new Array(count);

  for (let index = 0; index < count; index++) {
    subsectors[index] = Object.freeze({
      numsegs: reader.readInt16(),
      firstseg: reader.readInt16(),
    });
  }

  return Object.freeze(subsectors);
}

/**
 * Parse the NODES lump into an array of BSP nodes.
 *
 * Reads sequential 28-byte mapnode_t structs, left-shifting partition
 * coordinates and bounding box values by FRACBITS to 16.16 fixed-point.
 * Children are read as unsigned int16 with the NF_SUBSECTOR flag
 * preserved, matching P_LoadNodes in p_setup.c.
 *
 * @param lumpData - Raw NODES lump buffer.
 * @returns Frozen array of frozen MapNode entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPNODE_SIZE.
 */
export function parseNodes(lumpData: Buffer): readonly MapNode[] {
  if (lumpData.length % MAPNODE_SIZE !== 0) {
    throw new RangeError(`NODES lump size ${lumpData.length} is not a multiple of ${MAPNODE_SIZE}`);
  }

  const count = lumpData.length / MAPNODE_SIZE;
  const reader = new BinaryReader(lumpData);
  const nodes: MapNode[] = new Array(count);

  for (let index = 0; index < count; index++) {
    const x = (reader.readInt16() << FRACBITS) | 0;
    const y = (reader.readInt16() << FRACBITS) | 0;
    const dx = (reader.readInt16() << FRACBITS) | 0;
    const dy = (reader.readInt16() << FRACBITS) | 0;

    const rightBbox = Object.freeze([(reader.readInt16() << FRACBITS) | 0, (reader.readInt16() << FRACBITS) | 0, (reader.readInt16() << FRACBITS) | 0, (reader.readInt16() << FRACBITS) | 0] as const);

    const leftBbox = Object.freeze([(reader.readInt16() << FRACBITS) | 0, (reader.readInt16() << FRACBITS) | 0, (reader.readInt16() << FRACBITS) | 0, (reader.readInt16() << FRACBITS) | 0] as const);

    const rightChild = reader.readUint16();
    const leftChild = reader.readUint16();

    nodes[index] = Object.freeze({
      x,
      y,
      dx,
      dy,
      bbox: Object.freeze([rightBbox, leftBbox] as const),
      children: Object.freeze([rightChild, leftChild] as const),
    });
  }

  return Object.freeze(nodes);
}
