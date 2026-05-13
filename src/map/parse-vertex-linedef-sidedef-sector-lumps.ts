/**
 * Vanilla DOOM 1.9 VERTEXES / LINEDEFS / SIDEDEFS / SECTORS lump parsers.
 *
 * Byte-level layouts from p_setup.c:
 *   VERTEXES: 4 bytes per vertex (int16 x, int16 y; vanilla coords are in
 *             integer map units, internally promoted to fixed_t via << FRACBITS).
 *   LINEDEFS: 14 bytes per line (int16 v1, v2; int16 flags; int16 special; int16 tag; int16 sidenum[2]).
 *   SIDEDEFS: 30 bytes per side (int16 textureoffset; int16 rowoffset; 8-byte toptexture; 8-byte bottomtexture; 8-byte midtexture; int16 sector).
 *   SECTORS:  26 bytes per sector (int16 floorheight; int16 ceilingheight; 8-byte floorpic; 8-byte ceilingpic; int16 lightlevel; int16 special; int16 tag).
 */

export const VANILLA_VERTEX_BYTES = 4;
export const VANILLA_LINEDEF_BYTES = 14;
export const VANILLA_SIDEDEF_BYTES = 30;
export const VANILLA_SECTOR_BYTES = 26;
export const VANILLA_TEXTURE_NAME_BYTES = 8;

export interface VertexLump {
  readonly x: number;
  readonly y: number;
}

export interface LineDefLump {
  readonly v1: number;
  readonly v2: number;
  readonly flags: number;
  readonly special: number;
  readonly tag: number;
  readonly sidenum: readonly [number, number];
}

export interface SideDefLump {
  readonly textureOffset: number;
  readonly rowOffset: number;
  readonly topTexture: string;
  readonly bottomTexture: string;
  readonly midTexture: string;
  readonly sector: number;
}

export interface SectorLump {
  readonly floorHeight: number;
  readonly ceilingHeight: number;
  readonly floorPic: string;
  readonly ceilingPic: string;
  readonly lightLevel: number;
  readonly special: number;
  readonly tag: number;
}

function signed16(byte0: number, byte1: number): number {
  const value = byte0 | (byte1 << 8);
  return value > 0x7fff ? value - 0x10000 : value;
}

function unsigned16(byte0: number, byte1: number): number {
  return byte0 | (byte1 << 8);
}

function readTextureName(bytes: Uint8Array, offset: number): string {
  let length = 0;
  while (length < VANILLA_TEXTURE_NAME_BYTES && bytes[offset + length] !== 0) {
    length += 1;
  }
  let result = '';
  for (let charIndex = 0; charIndex < length; charIndex += 1) {
    result += String.fromCharCode(bytes[offset + charIndex]!);
  }
  return result.toUpperCase();
}

export function parseVertexLump(bytes: Uint8Array): readonly VertexLump[] {
  if (bytes.length % VANILLA_VERTEX_BYTES !== 0) {
    throw new RangeError(`VERTEXES lump byte length ${bytes.length} is not a multiple of ${VANILLA_VERTEX_BYTES}`);
  }
  const count = bytes.length / VANILLA_VERTEX_BYTES;
  const vertexes: VertexLump[] = [];
  for (let vertexIndex = 0; vertexIndex < count; vertexIndex += 1) {
    const offset = vertexIndex * VANILLA_VERTEX_BYTES;
    vertexes.push(
      Object.freeze({
        x: signed16(bytes[offset]!, bytes[offset + 1]!),
        y: signed16(bytes[offset + 2]!, bytes[offset + 3]!),
      } satisfies VertexLump),
    );
  }
  return Object.freeze(vertexes);
}

export function parseLineDefLump(bytes: Uint8Array): readonly LineDefLump[] {
  if (bytes.length % VANILLA_LINEDEF_BYTES !== 0) {
    throw new RangeError(`LINEDEFS lump byte length ${bytes.length} is not a multiple of ${VANILLA_LINEDEF_BYTES}`);
  }
  const count = bytes.length / VANILLA_LINEDEF_BYTES;
  const lineDefs: LineDefLump[] = [];
  for (let lineIndex = 0; lineIndex < count; lineIndex += 1) {
    const offset = lineIndex * VANILLA_LINEDEF_BYTES;
    lineDefs.push(
      Object.freeze({
        v1: unsigned16(bytes[offset]!, bytes[offset + 1]!),
        v2: unsigned16(bytes[offset + 2]!, bytes[offset + 3]!),
        flags: unsigned16(bytes[offset + 4]!, bytes[offset + 5]!),
        special: unsigned16(bytes[offset + 6]!, bytes[offset + 7]!),
        tag: unsigned16(bytes[offset + 8]!, bytes[offset + 9]!),
        sidenum: Object.freeze([signed16(bytes[offset + 10]!, bytes[offset + 11]!), signed16(bytes[offset + 12]!, bytes[offset + 13]!)] as const),
      } satisfies LineDefLump),
    );
  }
  return Object.freeze(lineDefs);
}

export function parseSideDefLump(bytes: Uint8Array): readonly SideDefLump[] {
  if (bytes.length % VANILLA_SIDEDEF_BYTES !== 0) {
    throw new RangeError(`SIDEDEFS lump byte length ${bytes.length} is not a multiple of ${VANILLA_SIDEDEF_BYTES}`);
  }
  const count = bytes.length / VANILLA_SIDEDEF_BYTES;
  const sideDefs: SideDefLump[] = [];
  for (let sideIndex = 0; sideIndex < count; sideIndex += 1) {
    const offset = sideIndex * VANILLA_SIDEDEF_BYTES;
    sideDefs.push(
      Object.freeze({
        textureOffset: signed16(bytes[offset]!, bytes[offset + 1]!),
        rowOffset: signed16(bytes[offset + 2]!, bytes[offset + 3]!),
        topTexture: readTextureName(bytes, offset + 4),
        bottomTexture: readTextureName(bytes, offset + 12),
        midTexture: readTextureName(bytes, offset + 20),
        sector: unsigned16(bytes[offset + 28]!, bytes[offset + 29]!),
      } satisfies SideDefLump),
    );
  }
  return Object.freeze(sideDefs);
}

export function parseSectorLump(bytes: Uint8Array): readonly SectorLump[] {
  if (bytes.length % VANILLA_SECTOR_BYTES !== 0) {
    throw new RangeError(`SECTORS lump byte length ${bytes.length} is not a multiple of ${VANILLA_SECTOR_BYTES}`);
  }
  const count = bytes.length / VANILLA_SECTOR_BYTES;
  const sectors: SectorLump[] = [];
  for (let sectorIndex = 0; sectorIndex < count; sectorIndex += 1) {
    const offset = sectorIndex * VANILLA_SECTOR_BYTES;
    sectors.push(
      Object.freeze({
        floorHeight: signed16(bytes[offset]!, bytes[offset + 1]!),
        ceilingHeight: signed16(bytes[offset + 2]!, bytes[offset + 3]!),
        floorPic: readTextureName(bytes, offset + 4),
        ceilingPic: readTextureName(bytes, offset + 12),
        lightLevel: unsigned16(bytes[offset + 20]!, bytes[offset + 21]!),
        special: unsigned16(bytes[offset + 22]!, bytes[offset + 23]!),
        tag: unsigned16(bytes[offset + 24]!, bytes[offset + 25]!),
      } satisfies SectorLump),
    );
  }
  return Object.freeze(sectors);
}
