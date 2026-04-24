/**
 * Vertex, linedef, sidedef, and sector binary lump loaders.
 *
 * Parses the four core geometry lumps from a Doom map into typed arrays
 * matching the on-disk struct layouts in Chocolate Doom's doomdata.h and
 * the P_LoadVertexes, P_LoadLineDefs, P_LoadSideDefs, P_LoadSectors
 * functions in p_setup.c.
 *
 * @example
 * ```ts
 * import { parseVertexes, parseLinedefs, parseSidedefs, parseSectors } from "../src/map/lineSectorGeometry.ts";
 * const vertexes = parseVertexes(bundle.vertexes);
 * const sectors = parseSectors(bundle.sectors);
 * const sidedefs = parseSidedefs(bundle.sidedefs);
 * const linedefs = parseLinedefs(bundle.linedefs, vertexes);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS } from '../core/fixed.ts';
import { BinaryReader } from '../core/binaryReader.ts';

// ── Struct sizes ──────────────────────────────────────────────────────

/** Size of a single mapvertex_t entry in the WAD binary format (bytes). */
export const MAPVERTEX_SIZE = 4;

/** Size of a single maplinedef_t entry in the WAD binary format (bytes). */
export const MAPLINEDEF_SIZE = 14;

/** Size of a single mapsidedef_t entry in the WAD binary format (bytes). */
export const MAPSIDEDEF_SIZE = 30;

/** Size of a single mapsector_t entry in the WAD binary format (bytes). */
export const MAPSECTOR_SIZE = 26;

// ── Linedef flags (ML_*) ─────────────────────────────────────────────

/** Solid, is an obstacle. */
export const ML_BLOCKING = 1;

/** Blocks monsters only. */
export const ML_BLOCKMONSTERS = 2;

/** Backside will not be present at all if not two-sided. */
export const ML_TWOSIDED = 4;

/** Upper texture is unpegged. */
export const ML_DONTPEGTOP = 8;

/** Lower texture is unpegged. */
export const ML_DONTPEGBOTTOM = 16;

/** In automap: don't map as two sided: IT'S A SECRET! */
export const ML_SECRET = 32;

/** Sound rendering: don't let sound cross two of these. */
export const ML_SOUNDBLOCK = 64;

/** Don't draw on the automap at all. */
export const ML_DONTDRAW = 128;

/** Set if already seen, thus drawn in automap. */
export const ML_MAPPED = 256;

// ── Slope type ────────────────────────────────────────────────────────

/** Slope classification for a linedef, derived from dx/dy. */
export type SlopeType = 0 | 1 | 2 | 3;

/** Horizontal line (dy === 0). */
export const ST_HORIZONTAL: SlopeType = 0;

/** Vertical line (dx === 0). */
export const ST_VERTICAL: SlopeType = 1;

/** Positive slope (dy/dx > 0). */
export const ST_POSITIVE: SlopeType = 2;

/** Negative slope (dy/dx < 0). */
export const ST_NEGATIVE: SlopeType = 3;

// ── BBOX indices ──────────────────────────────────────────────────────

/** Bounding box top index. */
export const BOXTOP = 0;

/** Bounding box bottom index. */
export const BOXBOTTOM = 1;

/** Bounding box left index. */
export const BOXLEFT = 2;

/** Bounding box right index. */
export const BOXRIGHT = 3;

// ── Interfaces ────────────────────────────────────────────────────────

/**
 * A parsed map vertex matching mapvertex_t from doomdata.h.
 *
 * On-disk fields are signed int16 map units; runtime fields are
 * 16.16 fixed-point (left-shifted by FRACBITS).
 */
export interface MapVertex {
  /** X position in 16.16 fixed-point. */
  readonly x: Fixed;
  /** Y position in 16.16 fixed-point. */
  readonly y: Fixed;
}

/**
 * A parsed map sector matching mapsector_t from doomdata.h.
 *
 * Heights are stored as 16.16 fixed-point. Flat names are preserved
 * as uppercase strings (not resolved to flat indices — that requires
 * a flat catalog, which is a later-step concern).
 */
export interface MapSector {
  /** Floor height in 16.16 fixed-point. */
  readonly floorheight: Fixed;
  /** Ceiling height in 16.16 fixed-point. */
  readonly ceilingheight: Fixed;
  /** Floor flat name (uppercased, null-padding stripped). */
  readonly floorpic: string;
  /** Ceiling flat name (uppercased, null-padding stripped). */
  readonly ceilingpic: string;
  /** Light level (0–255 typical). */
  readonly lightlevel: number;
  /** Sector special type. */
  readonly special: number;
  /** Sector tag for linedef triggers. */
  readonly tag: number;
}

/**
 * A parsed map sidedef matching mapsidedef_t from doomdata.h.
 *
 * Texture offsets are stored as 16.16 fixed-point. Texture names
 * are preserved as uppercase strings (not resolved to texture
 * indices — that requires a texture lookup, which is a later-step
 * concern). The sector field is an index, not a pointer.
 */
export interface MapSidedef {
  /** Texture X offset in 16.16 fixed-point. */
  readonly textureoffset: Fixed;
  /** Texture Y offset in 16.16 fixed-point. */
  readonly rowoffset: Fixed;
  /** Top texture name (uppercased, null-padding stripped). */
  readonly toptexture: string;
  /** Bottom texture name (uppercased, null-padding stripped). */
  readonly bottomtexture: string;
  /** Middle texture name (uppercased, null-padding stripped). */
  readonly midtexture: string;
  /** Sector index this sidedef faces. */
  readonly sector: number;
}

/**
 * A parsed map linedef matching maplinedef_t from doomdata.h,
 * with computed fields matching P_LoadLineDefs in p_setup.c.
 *
 * Vertex indices are resolved to vertex references. The dx, dy,
 * slopetype, and bbox fields are computed during parsing, matching
 * the canonical P_LoadLineDefs post-load processing.
 */
export interface MapLinedef {
  /** First vertex index. */
  readonly v1: number;
  /** Second vertex index. */
  readonly v2: number;
  /** Delta X: v2.x - v1.x (fixed-point). */
  readonly dx: Fixed;
  /** Delta Y: v2.y - v1.y (fixed-point). */
  readonly dy: Fixed;
  /** ML_* flags bitmask. */
  readonly flags: number;
  /** Action special type. */
  readonly special: number;
  /** Sector tag for triggered actions. */
  readonly tag: number;
  /** Front sidedef index, or -1 if none. */
  readonly sidenum0: number;
  /** Back sidedef index, or -1 if one-sided. */
  readonly sidenum1: number;
  /** Slope type derived from dx/dy. */
  readonly slopetype: SlopeType;
  /** Bounding box [top, bottom, left, right] in fixed-point. */
  readonly bbox: readonly [Fixed, Fixed, Fixed, Fixed];
}

// ── Parsers ───────────────────────────────────────────────────────────

/**
 * Parse the VERTEXES lump into an array of map vertices.
 *
 * Reads sequential 4-byte mapvertex_t structs (two signed int16LE
 * fields each), left-shifting by FRACBITS to produce 16.16
 * fixed-point values, matching P_LoadVertexes in p_setup.c.
 *
 * @param lumpData - Raw VERTEXES lump buffer.
 * @returns Frozen array of frozen MapVertex entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPVERTEX_SIZE.
 */
export function parseVertexes(lumpData: Buffer): readonly MapVertex[] {
  if (lumpData.length % MAPVERTEX_SIZE !== 0) {
    throw new RangeError(`VERTEXES lump size ${lumpData.length} is not a multiple of ${MAPVERTEX_SIZE}`);
  }

  const count = lumpData.length / MAPVERTEX_SIZE;
  const reader = new BinaryReader(lumpData);
  const vertexes: MapVertex[] = new Array(count);

  for (let index = 0; index < count; index++) {
    vertexes[index] = Object.freeze({
      x: (reader.readInt16() << FRACBITS) | 0,
      y: (reader.readInt16() << FRACBITS) | 0,
    });
  }

  return Object.freeze(vertexes);
}

/**
 * Parse the SECTORS lump into an array of map sectors.
 *
 * Reads sequential 26-byte mapsector_t structs, left-shifting
 * height fields by FRACBITS and preserving flat names as uppercase
 * strings, matching P_LoadSectors in p_setup.c.
 *
 * @param lumpData - Raw SECTORS lump buffer.
 * @returns Frozen array of frozen MapSector entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPSECTOR_SIZE.
 */
export function parseSectors(lumpData: Buffer): readonly MapSector[] {
  if (lumpData.length % MAPSECTOR_SIZE !== 0) {
    throw new RangeError(`SECTORS lump size ${lumpData.length} is not a multiple of ${MAPSECTOR_SIZE}`);
  }

  const count = lumpData.length / MAPSECTOR_SIZE;
  const reader = new BinaryReader(lumpData);
  const sectors: MapSector[] = new Array(count);

  for (let index = 0; index < count; index++) {
    sectors[index] = Object.freeze({
      floorheight: (reader.readInt16() << FRACBITS) | 0,
      ceilingheight: (reader.readInt16() << FRACBITS) | 0,
      floorpic: reader.readAscii(8).toUpperCase(),
      ceilingpic: reader.readAscii(8).toUpperCase(),
      lightlevel: reader.readInt16(),
      special: reader.readInt16(),
      tag: reader.readInt16(),
    });
  }

  return Object.freeze(sectors);
}

/**
 * Parse the SIDEDEFS lump into an array of map sidedefs.
 *
 * Reads sequential 30-byte mapsidedef_t structs, left-shifting
 * texture offset fields by FRACBITS and preserving texture names
 * as uppercase strings, matching P_LoadSideDefs in p_setup.c.
 *
 * @param lumpData - Raw SIDEDEFS lump buffer.
 * @returns Frozen array of frozen MapSidedef entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPSIDEDEF_SIZE.
 */
export function parseSidedefs(lumpData: Buffer): readonly MapSidedef[] {
  if (lumpData.length % MAPSIDEDEF_SIZE !== 0) {
    throw new RangeError(`SIDEDEFS lump size ${lumpData.length} is not a multiple of ${MAPSIDEDEF_SIZE}`);
  }

  const count = lumpData.length / MAPSIDEDEF_SIZE;
  const reader = new BinaryReader(lumpData);
  const sidedefs: MapSidedef[] = new Array(count);

  for (let index = 0; index < count; index++) {
    sidedefs[index] = Object.freeze({
      textureoffset: (reader.readInt16() << FRACBITS) | 0,
      rowoffset: (reader.readInt16() << FRACBITS) | 0,
      toptexture: reader.readAscii(8).toUpperCase(),
      bottomtexture: reader.readAscii(8).toUpperCase(),
      midtexture: reader.readAscii(8).toUpperCase(),
      sector: reader.readInt16(),
    });
  }

  return Object.freeze(sidedefs);
}

/**
 * Compute the slope type for a linedef from its delta vector.
 *
 * Matches the slopetype derivation in P_LoadLineDefs (p_setup.c).
 * Uses integer comparison on the fixed-point deltas.
 */
function computeSlopeType(dx: Fixed, dy: Fixed): SlopeType {
  if (dx === 0) {
    return ST_VERTICAL;
  }
  if (dy === 0) {
    return ST_HORIZONTAL;
  }
  // FixedDiv(dy, dx) > 0  ⟺  dy and dx have the same sign
  if ((dy ^ dx) >= 0) {
    return ST_POSITIVE;
  }
  return ST_NEGATIVE;
}

/**
 * Parse the LINEDEFS lump into an array of map linedefs.
 *
 * Reads sequential 14-byte maplinedef_t structs and computes the
 * derived fields (dx, dy, slopetype, bbox) from vertex coordinates,
 * matching P_LoadLineDefs in p_setup.c.
 *
 * @param lumpData - Raw LINEDEFS lump buffer.
 * @param vertexes - Previously parsed vertex array (from parseVertexes).
 * @returns Frozen array of frozen MapLinedef entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPLINEDEF_SIZE.
 */
export function parseLinedefs(lumpData: Buffer, vertexes: readonly MapVertex[]): readonly MapLinedef[] {
  if (lumpData.length % MAPLINEDEF_SIZE !== 0) {
    throw new RangeError(`LINEDEFS lump size ${lumpData.length} is not a multiple of ${MAPLINEDEF_SIZE}`);
  }

  const count = lumpData.length / MAPLINEDEF_SIZE;
  const reader = new BinaryReader(lumpData);
  const linedefs: MapLinedef[] = new Array(count);

  for (let index = 0; index < count; index++) {
    const v1Index = reader.readInt16();
    const v2Index = reader.readInt16();
    const flags = reader.readInt16();
    const special = reader.readInt16();
    const tag = reader.readInt16();
    const sidenum0 = reader.readInt16();
    const sidenum1 = reader.readInt16();

    if (v1Index < 0 || v1Index >= vertexes.length) {
      throw new RangeError(`LINEDEFS entry ${index} references start vertex ${v1Index}, but VERTEXES has ${vertexes.length} entries`);
    }
    if (v2Index < 0 || v2Index >= vertexes.length) {
      throw new RangeError(`LINEDEFS entry ${index} references end vertex ${v2Index}, but VERTEXES has ${vertexes.length} entries`);
    }

    const vertex1 = vertexes[v1Index]!;
    const vertex2 = vertexes[v2Index]!;
    const dx = (vertex2.x - vertex1.x) | 0;
    const dy = (vertex2.y - vertex1.y) | 0;

    linedefs[index] = Object.freeze({
      v1: v1Index,
      v2: v2Index,
      dx,
      dy,
      flags,
      special,
      tag,
      sidenum0,
      sidenum1,
      slopetype: computeSlopeType(dx, dy),
      bbox: Object.freeze([Math.max(vertex1.y, vertex2.y), Math.min(vertex1.y, vertex2.y), Math.min(vertex1.x, vertex2.x), Math.max(vertex1.x, vertex2.x)] as const),
    });
  }

  return Object.freeze(linedefs);
}
