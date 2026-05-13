/**
 * Vanilla DOOM 1.9 SEGS / SSECTORS / NODES / REJECT / BLOCKMAP lump parsers.
 *
 * Byte-level layouts from p_setup.c:
 *   SEGS:      12 bytes per seg (int16 v1, v2, angle, lineDefId, side, offset).
 *   SSECTORS:   4 bytes per subsector (int16 segCount, firstSeg).
 *   NODES:     28 bytes per node (int16 x, y, dx, dy; int16[8] bbox; uint16[2] children).
 *   REJECT:    bitfield, sector_count * sector_count bits, 8 bits per byte.
 *   BLOCKMAP:  header (int16 originX, originY, columns, rows) then column-major
 *              uint16 offsets then uint16 line lists terminated by 0xFFFF.
 */

export const VANILLA_SEG_BYTES = 12;
export const VANILLA_SSECTOR_BYTES = 4;
export const VANILLA_NODE_BYTES = 28;
export const VANILLA_BLOCKMAP_HEADER_BYTES = 8;
export const VANILLA_BLOCKMAP_LIST_TERMINATOR = 0xffff;
export const VANILLA_NODE_SUBSECTOR_FLAG = 0x8000;

export interface SegLump {
  readonly v1: number;
  readonly v2: number;
  readonly angle: number;
  readonly lineDefId: number;
  readonly side: number;
  readonly offset: number;
}

export interface SubsectorLump {
  readonly segCount: number;
  readonly firstSeg: number;
}

export interface NodeLump {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly boundingBoxes: readonly [readonly [number, number, number, number], readonly [number, number, number, number]];
  readonly children: readonly [number, number];
}

function signed16(byte0: number, byte1: number): number {
  const value = byte0 | (byte1 << 8);
  return value > 0x7fff ? value - 0x10000 : value;
}

function unsigned16(byte0: number, byte1: number): number {
  return byte0 | (byte1 << 8);
}

export function parseSegLump(bytes: Uint8Array): readonly SegLump[] {
  if (bytes.length % VANILLA_SEG_BYTES !== 0) {
    throw new RangeError(`SEGS lump byte length ${bytes.length} is not a multiple of ${VANILLA_SEG_BYTES}`);
  }
  const count = bytes.length / VANILLA_SEG_BYTES;
  const segs: SegLump[] = [];
  for (let segIndex = 0; segIndex < count; segIndex += 1) {
    const offset = segIndex * VANILLA_SEG_BYTES;
    segs.push(
      Object.freeze({
        v1: unsigned16(bytes[offset]!, bytes[offset + 1]!),
        v2: unsigned16(bytes[offset + 2]!, bytes[offset + 3]!),
        angle: signed16(bytes[offset + 4]!, bytes[offset + 5]!),
        lineDefId: unsigned16(bytes[offset + 6]!, bytes[offset + 7]!),
        side: unsigned16(bytes[offset + 8]!, bytes[offset + 9]!),
        offset: signed16(bytes[offset + 10]!, bytes[offset + 11]!),
      } satisfies SegLump),
    );
  }
  return Object.freeze(segs);
}

export function parseSubsectorLump(bytes: Uint8Array): readonly SubsectorLump[] {
  if (bytes.length % VANILLA_SSECTOR_BYTES !== 0) {
    throw new RangeError(`SSECTORS lump byte length ${bytes.length} is not a multiple of ${VANILLA_SSECTOR_BYTES}`);
  }
  const count = bytes.length / VANILLA_SSECTOR_BYTES;
  const subsectors: SubsectorLump[] = [];
  for (let subsectorIndex = 0; subsectorIndex < count; subsectorIndex += 1) {
    const offset = subsectorIndex * VANILLA_SSECTOR_BYTES;
    subsectors.push(
      Object.freeze({
        segCount: unsigned16(bytes[offset]!, bytes[offset + 1]!),
        firstSeg: unsigned16(bytes[offset + 2]!, bytes[offset + 3]!),
      } satisfies SubsectorLump),
    );
  }
  return Object.freeze(subsectors);
}

export function parseNodeLump(bytes: Uint8Array): readonly NodeLump[] {
  if (bytes.length % VANILLA_NODE_BYTES !== 0) {
    throw new RangeError(`NODES lump byte length ${bytes.length} is not a multiple of ${VANILLA_NODE_BYTES}`);
  }
  const count = bytes.length / VANILLA_NODE_BYTES;
  const nodes: NodeLump[] = [];
  for (let nodeIndex = 0; nodeIndex < count; nodeIndex += 1) {
    const offset = nodeIndex * VANILLA_NODE_BYTES;
    nodes.push(
      Object.freeze({
        x: signed16(bytes[offset]!, bytes[offset + 1]!),
        y: signed16(bytes[offset + 2]!, bytes[offset + 3]!),
        dx: signed16(bytes[offset + 4]!, bytes[offset + 5]!),
        dy: signed16(bytes[offset + 6]!, bytes[offset + 7]!),
        boundingBoxes: Object.freeze([
          Object.freeze([
            signed16(bytes[offset + 8]!, bytes[offset + 9]!),
            signed16(bytes[offset + 10]!, bytes[offset + 11]!),
            signed16(bytes[offset + 12]!, bytes[offset + 13]!),
            signed16(bytes[offset + 14]!, bytes[offset + 15]!),
          ] as const),
          Object.freeze([
            signed16(bytes[offset + 16]!, bytes[offset + 17]!),
            signed16(bytes[offset + 18]!, bytes[offset + 19]!),
            signed16(bytes[offset + 20]!, bytes[offset + 21]!),
            signed16(bytes[offset + 22]!, bytes[offset + 23]!),
          ] as const),
        ] as const),
        children: Object.freeze([unsigned16(bytes[offset + 24]!, bytes[offset + 25]!), unsigned16(bytes[offset + 26]!, bytes[offset + 27]!)] as const),
      } satisfies NodeLump),
    );
  }
  return Object.freeze(nodes);
}

export function isSubsectorChild(child: number): boolean {
  return (child & VANILLA_NODE_SUBSECTOR_FLAG) !== 0;
}

export function subsectorIndexFromChild(child: number): number {
  return child & ~VANILLA_NODE_SUBSECTOR_FLAG;
}
