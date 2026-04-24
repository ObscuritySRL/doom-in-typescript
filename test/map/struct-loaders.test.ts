import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle, findMapNames } from '../../src/map/mapBundle.ts';
import {
  MAPVERTEX_SIZE,
  MAPLINEDEF_SIZE,
  MAPSIDEDEF_SIZE,
  MAPSECTOR_SIZE,
  ML_BLOCKING,
  ML_BLOCKMONSTERS,
  ML_TWOSIDED,
  ML_DONTPEGTOP,
  ML_DONTPEGBOTTOM,
  ML_SECRET,
  ML_SOUNDBLOCK,
  ML_DONTDRAW,
  ML_MAPPED,
  ST_HORIZONTAL,
  ST_VERTICAL,
  ST_POSITIVE,
  ST_NEGATIVE,
  BOXTOP,
  BOXBOTTOM,
  BOXLEFT,
  BOXRIGHT,
  parseVertexes,
  parseSectors,
  parseSidedefs,
  parseLinedefs,
} from '../../src/map/lineSectorGeometry.ts';
import type { MapVertex, MapLinedef, MapSidedef, MapSector, SlopeType } from '../../src/map/lineSectorGeometry.ts';

import wadMapSummary from '../../reference/manifests/wad-map-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);
const e1m1Sectors = parseSectors(e1m1Bundle.sectors);
const e1m1Sidedefs = parseSidedefs(e1m1Bundle.sidedefs);
const e1m1Linedefs = parseLinedefs(e1m1Bundle.linedefs, e1m1Vertexes);

// ── Struct size constants ─────────────────────────────────────────────

describe('struct size constants', () => {
  it('MAPVERTEX_SIZE is 4', () => {
    expect(MAPVERTEX_SIZE).toBe(4);
  });

  it('MAPLINEDEF_SIZE is 14', () => {
    expect(MAPLINEDEF_SIZE).toBe(14);
  });

  it('MAPSIDEDEF_SIZE is 30', () => {
    expect(MAPSIDEDEF_SIZE).toBe(30);
  });

  it('MAPSECTOR_SIZE is 26', () => {
    expect(MAPSECTOR_SIZE).toBe(26);
  });
});

// ── ML_* linedef flag constants ───────────────────────────────────────

describe('ML_* flag constants', () => {
  it('ML_BLOCKING is 1', () => {
    expect(ML_BLOCKING).toBe(1);
  });

  it('ML_BLOCKMONSTERS is 2', () => {
    expect(ML_BLOCKMONSTERS).toBe(2);
  });

  it('ML_TWOSIDED is 4', () => {
    expect(ML_TWOSIDED).toBe(4);
  });

  it('ML_DONTPEGTOP is 8', () => {
    expect(ML_DONTPEGTOP).toBe(8);
  });

  it('ML_DONTPEGBOTTOM is 16', () => {
    expect(ML_DONTPEGBOTTOM).toBe(16);
  });

  it('ML_SECRET is 32', () => {
    expect(ML_SECRET).toBe(32);
  });

  it('ML_SOUNDBLOCK is 64', () => {
    expect(ML_SOUNDBLOCK).toBe(64);
  });

  it('ML_DONTDRAW is 128', () => {
    expect(ML_DONTDRAW).toBe(128);
  });

  it('ML_MAPPED is 256', () => {
    expect(ML_MAPPED).toBe(256);
  });

  it('all 9 flags are distinct powers of two', () => {
    const flags = [ML_BLOCKING, ML_BLOCKMONSTERS, ML_TWOSIDED, ML_DONTPEGTOP, ML_DONTPEGBOTTOM, ML_SECRET, ML_SOUNDBLOCK, ML_DONTDRAW, ML_MAPPED];
    const unique = new Set(flags);
    expect(unique.size).toBe(9);
    for (const flag of flags) {
      expect(flag > 0 && (flag & (flag - 1)) === 0).toBe(true);
    }
  });
});

// ── Slope type constants ──────────────────────────────────────────────

describe('slope type constants', () => {
  it('ST_HORIZONTAL is 0', () => {
    expect(ST_HORIZONTAL).toBe(0);
  });

  it('ST_VERTICAL is 1', () => {
    expect(ST_VERTICAL).toBe(1);
  });

  it('ST_POSITIVE is 2', () => {
    expect(ST_POSITIVE).toBe(2);
  });

  it('ST_NEGATIVE is 3', () => {
    expect(ST_NEGATIVE).toBe(3);
  });

  it('all four slope types are distinct', () => {
    const types = new Set([ST_HORIZONTAL, ST_VERTICAL, ST_POSITIVE, ST_NEGATIVE]);
    expect(types.size).toBe(4);
  });
});

// ── BBOX index constants ──────────────────────────────────────────────

describe('BBOX index constants', () => {
  it('indices are 0-3', () => {
    expect(BOXTOP).toBe(0);
    expect(BOXBOTTOM).toBe(1);
    expect(BOXLEFT).toBe(2);
    expect(BOXRIGHT).toBe(3);
  });
});

// ── parseVertexes with E1M1 ───────────────────────────────────────────

describe('parseVertexes with E1M1', () => {
  it('parses 467 vertexes', () => {
    expect(e1m1Vertexes.length).toBe(467);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const vertexLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'VERTEXES')!;
    expect(e1m1Vertexes.length).toBe(vertexLump.size / MAPVERTEX_SIZE);
  });

  it('all vertexes have 16.16 fixed-point coordinates', () => {
    for (const vertex of e1m1Vertexes) {
      expect(vertex.x & 0xffff).toBe(0);
      expect(vertex.y & 0xffff).toBe(0);
    }
  });

  it('first vertex has expected fixed-point values', () => {
    const first = e1m1Vertexes[0]!;
    expect(typeof first.x).toBe('number');
    expect(typeof first.y).toBe('number');
    expect(first.x & 0xffff).toBe(0);
    expect(first.y & 0xffff).toBe(0);
  });

  it('integer parts are within int16 range', () => {
    for (const vertex of e1m1Vertexes) {
      const integerX = vertex.x >> FRACBITS;
      const integerY = vertex.y >> FRACBITS;
      expect(integerX).toBeGreaterThanOrEqual(-32768);
      expect(integerX).toBeLessThanOrEqual(32767);
      expect(integerY).toBeGreaterThanOrEqual(-32768);
      expect(integerY).toBeLessThanOrEqual(32767);
    }
  });

  it('returns frozen array of frozen entries', () => {
    expect(Object.isFrozen(e1m1Vertexes)).toBe(true);
    expect(Object.isFrozen(e1m1Vertexes[0])).toBe(true);
  });

  it('accepts Uint8Array input', () => {
    const uint8 = new Uint8Array(e1m1Bundle.vertexes);
    const result = parseVertexes(Buffer.from(uint8));
    expect(result.length).toBe(467);
  });
});

// ── parseSectors with E1M1 ────────────────────────────────────────────

describe('parseSectors with E1M1', () => {
  it('parses 85 sectors', () => {
    expect(e1m1Sectors.length).toBe(85);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const sectorLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'SECTORS')!;
    expect(e1m1Sectors.length).toBe(sectorLump.size / MAPSECTOR_SIZE);
  });

  it('heights are 16.16 fixed-point', () => {
    for (const sector of e1m1Sectors) {
      expect(sector.floorheight & 0xffff).toBe(0);
      expect(sector.ceilingheight & 0xffff).toBe(0);
    }
  });

  it('ceiling is at or above floor for all sectors', () => {
    for (const sector of e1m1Sectors) {
      expect(sector.ceilingheight).toBeGreaterThanOrEqual(sector.floorheight);
    }
  });

  it('flat names are non-empty uppercase strings', () => {
    for (const sector of e1m1Sectors) {
      expect(sector.floorpic.length).toBeGreaterThan(0);
      expect(sector.floorpic).toBe(sector.floorpic.toUpperCase());
      expect(sector.ceilingpic.length).toBeGreaterThan(0);
      expect(sector.ceilingpic).toBe(sector.ceilingpic.toUpperCase());
    }
  });

  it('flat names are at most 8 characters', () => {
    for (const sector of e1m1Sectors) {
      expect(sector.floorpic.length).toBeLessThanOrEqual(8);
      expect(sector.ceilingpic.length).toBeLessThanOrEqual(8);
    }
  });

  it('lightlevel is within reasonable range', () => {
    for (const sector of e1m1Sectors) {
      expect(sector.lightlevel).toBeGreaterThanOrEqual(0);
      expect(sector.lightlevel).toBeLessThanOrEqual(255);
    }
  });

  it('tags and specials are non-negative', () => {
    for (const sector of e1m1Sectors) {
      expect(sector.tag).toBeGreaterThanOrEqual(0);
      expect(sector.special).toBeGreaterThanOrEqual(0);
    }
  });

  it('well-known flat NUKAGE3 is used', () => {
    const hasNukage = e1m1Sectors.some((s) => s.floorpic === 'NUKAGE3' || s.ceilingpic === 'NUKAGE3');
    expect(hasNukage).toBe(true);
  });

  it('returns frozen array of frozen entries', () => {
    expect(Object.isFrozen(e1m1Sectors)).toBe(true);
    expect(Object.isFrozen(e1m1Sectors[0])).toBe(true);
  });
});

// ── parseSidedefs with E1M1 ───────────────────────────────────────────

describe('parseSidedefs with E1M1', () => {
  it('parses 648 sidedefs', () => {
    expect(e1m1Sidedefs.length).toBe(648);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const sidedefLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'SIDEDEFS')!;
    expect(e1m1Sidedefs.length).toBe(sidedefLump.size / MAPSIDEDEF_SIZE);
  });

  it('texture offsets are 16.16 fixed-point', () => {
    for (const sidedef of e1m1Sidedefs) {
      expect(sidedef.textureoffset & 0xffff).toBe(0);
      expect(sidedef.rowoffset & 0xffff).toBe(0);
    }
  });

  it('texture names are uppercase at most 8 characters', () => {
    for (const sidedef of e1m1Sidedefs) {
      for (const name of [sidedef.toptexture, sidedef.bottomtexture, sidedef.midtexture]) {
        expect(name).toBe(name.toUpperCase());
        expect(name.length).toBeLessThanOrEqual(8);
      }
    }
  });

  it("'-' denotes no texture", () => {
    const hasDash = e1m1Sidedefs.some((s) => s.toptexture === '-' || s.bottomtexture === '-' || s.midtexture === '-');
    expect(hasDash).toBe(true);
  });

  it('sector indices are valid', () => {
    for (const sidedef of e1m1Sidedefs) {
      expect(sidedef.sector).toBeGreaterThanOrEqual(0);
      expect(sidedef.sector).toBeLessThan(e1m1Sectors.length);
    }
  });

  it('returns frozen array of frozen entries', () => {
    expect(Object.isFrozen(e1m1Sidedefs)).toBe(true);
    expect(Object.isFrozen(e1m1Sidedefs[0])).toBe(true);
  });
});

// ── parseLinedefs with E1M1 ───────────────────────────────────────────

describe('parseLinedefs with E1M1', () => {
  it('parses 475 linedefs', () => {
    expect(e1m1Linedefs.length).toBe(475);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const linedefLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'LINEDEFS')!;
    expect(e1m1Linedefs.length).toBe(linedefLump.size / MAPLINEDEF_SIZE);
  });

  it('vertex indices are valid', () => {
    for (const linedef of e1m1Linedefs) {
      expect(linedef.v1).toBeGreaterThanOrEqual(0);
      expect(linedef.v1).toBeLessThan(e1m1Vertexes.length);
      expect(linedef.v2).toBeGreaterThanOrEqual(0);
      expect(linedef.v2).toBeLessThan(e1m1Vertexes.length);
    }
  });

  it('dx and dy are computed from vertex positions', () => {
    for (const linedef of e1m1Linedefs) {
      const vertex1 = e1m1Vertexes[linedef.v1]!;
      const vertex2 = e1m1Vertexes[linedef.v2]!;
      expect(linedef.dx).toBe((vertex2.x - vertex1.x) | 0);
      expect(linedef.dy).toBe((vertex2.y - vertex1.y) | 0);
    }
  });

  it('front sidedef indices are non-negative', () => {
    for (const linedef of e1m1Linedefs) {
      expect(linedef.sidenum0).toBeGreaterThanOrEqual(0);
      expect(linedef.sidenum0).toBeLessThan(e1m1Sidedefs.length);
    }
  });

  it('back sidedef is -1 for one-sided lines', () => {
    const oneSided = e1m1Linedefs.filter((l) => l.sidenum1 === -1);
    expect(oneSided.length).toBeGreaterThan(0);
    for (const linedef of oneSided) {
      expect(linedef.flags & ML_TWOSIDED).toBe(0);
    }
  });

  it('two-sided lines have valid back sidedef', () => {
    const twoSided = e1m1Linedefs.filter((l) => (l.flags & ML_TWOSIDED) !== 0);
    expect(twoSided.length).toBeGreaterThan(0);
    for (const linedef of twoSided) {
      expect(linedef.sidenum1).toBeGreaterThanOrEqual(0);
      expect(linedef.sidenum1).toBeLessThan(e1m1Sidedefs.length);
    }
  });

  it('slopetype is consistent with dx/dy', () => {
    for (const linedef of e1m1Linedefs) {
      if (linedef.dx === 0) {
        expect(linedef.slopetype).toBe(ST_VERTICAL);
      } else if (linedef.dy === 0) {
        expect(linedef.slopetype).toBe(ST_HORIZONTAL);
      } else if ((linedef.dy ^ linedef.dx) >= 0) {
        expect(linedef.slopetype).toBe(ST_POSITIVE);
      } else {
        expect(linedef.slopetype).toBe(ST_NEGATIVE);
      }
    }
  });

  it('bbox is derived from vertex positions', () => {
    for (const linedef of e1m1Linedefs) {
      const vertex1 = e1m1Vertexes[linedef.v1]!;
      const vertex2 = e1m1Vertexes[linedef.v2]!;
      expect(linedef.bbox[BOXTOP]).toBe(Math.max(vertex1.y, vertex2.y));
      expect(linedef.bbox[BOXBOTTOM]).toBe(Math.min(vertex1.y, vertex2.y));
      expect(linedef.bbox[BOXLEFT]).toBe(Math.min(vertex1.x, vertex2.x));
      expect(linedef.bbox[BOXRIGHT]).toBe(Math.max(vertex1.x, vertex2.x));
    }
  });

  it('bbox left <= right and bottom <= top', () => {
    for (const linedef of e1m1Linedefs) {
      expect(linedef.bbox[BOXLEFT]).toBeLessThanOrEqual(linedef.bbox[BOXRIGHT]);
      expect(linedef.bbox[BOXBOTTOM]).toBeLessThanOrEqual(linedef.bbox[BOXTOP]);
    }
  });

  it('all four slope types are represented', () => {
    const slopeTypes = new Set(e1m1Linedefs.map((l) => l.slopetype));
    expect(slopeTypes.has(ST_HORIZONTAL)).toBe(true);
    expect(slopeTypes.has(ST_VERTICAL)).toBe(true);
    expect(slopeTypes.has(ST_POSITIVE)).toBe(true);
    expect(slopeTypes.has(ST_NEGATIVE)).toBe(true);
  });

  it('flags are within valid 9-bit range', () => {
    for (const linedef of e1m1Linedefs) {
      expect(linedef.flags).toBeGreaterThanOrEqual(0);
      expect(linedef.flags).toBeLessThanOrEqual(0x1ff);
    }
  });

  it('returns frozen array of frozen entries with frozen bbox', () => {
    expect(Object.isFrozen(e1m1Linedefs)).toBe(true);
    expect(Object.isFrozen(e1m1Linedefs[0])).toBe(true);
    expect(Object.isFrozen(e1m1Linedefs[0]!.bbox)).toBe(true);
  });
});

// ── parseVertexes/parseSectors/parseSidedefs/parseLinedefs with all 9 maps ──

describe('all 9 shareware maps parse successfully', () => {
  const mapNames = findMapNames(directory);

  it('all 9 maps parse vertexes', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const vertexes = parseVertexes(bundle.vertexes);
      expect(vertexes.length).toBeGreaterThan(0);
    }
  });

  it('all 9 maps parse sectors', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const sectors = parseSectors(bundle.sectors);
      expect(sectors.length).toBeGreaterThan(0);
    }
  });

  it('all 9 maps parse sidedefs', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const sidedefs = parseSidedefs(bundle.sidedefs);
      expect(sidedefs.length).toBeGreaterThan(0);
    }
  });

  it('all 9 maps parse linedefs with valid vertex cross-references', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const vertexes = parseVertexes(bundle.vertexes);
      const linedefs = parseLinedefs(bundle.linedefs, vertexes);
      expect(linedefs.length).toBeGreaterThan(0);
      for (const linedef of linedefs) {
        expect(linedef.v1).toBeLessThan(vertexes.length);
        expect(linedef.v2).toBeLessThan(vertexes.length);
      }
    }
  });

  it('lump sizes match wad-map-summary counts for all maps', () => {
    for (let mapIndex = 0; mapIndex < mapNames.length; mapIndex++) {
      const mapName = mapNames[mapIndex]!;
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const summary = wadMapSummary.maps[mapIndex]!;
      const vertexLump = summary.lumps.find((l: { name: string }) => l.name === 'VERTEXES')!;
      const linedefLump = summary.lumps.find((l: { name: string }) => l.name === 'LINEDEFS')!;
      const sidedefLump = summary.lumps.find((l: { name: string }) => l.name === 'SIDEDEFS')!;
      const sectorLump = summary.lumps.find((l: { name: string }) => l.name === 'SECTORS')!;
      expect(bundle.vertexes.length).toBe(vertexLump.size);
      expect(bundle.linedefs.length).toBe(linedefLump.size);
      expect(bundle.sidedefs.length).toBe(sidedefLump.size);
      expect(bundle.sectors.length).toBe(sectorLump.size);
    }
  });
});

// ── Error handling ────────────────────────────────────────────────────

describe('error handling', () => {
  it('parseVertexes rejects non-multiple-of-4 lump', () => {
    expect(() => parseVertexes(Buffer.alloc(5))).toThrow(RangeError);
  });

  it('parseSectors rejects non-multiple-of-26 lump', () => {
    expect(() => parseSectors(Buffer.alloc(27))).toThrow(RangeError);
  });

  it('parseSidedefs rejects non-multiple-of-30 lump', () => {
    expect(() => parseSidedefs(Buffer.alloc(31))).toThrow(RangeError);
  });

  it('parseLinedefs rejects non-multiple-of-14 lump', () => {
    expect(() => parseLinedefs(Buffer.alloc(15), [])).toThrow(RangeError);
  });

  it('parseLinedefs rejects a negative start vertex index', () => {
    const vertexes: readonly MapVertex[] = Object.freeze([Object.freeze({ x: 0, y: 0 })]);
    const lump = Buffer.alloc(MAPLINEDEF_SIZE);
    lump.writeInt16LE(-1, 0);
    lump.writeInt16LE(0, 2);
    lump.writeInt16LE(0, 4);
    lump.writeInt16LE(0, 6);
    lump.writeInt16LE(0, 8);
    lump.writeInt16LE(0, 10);
    lump.writeInt16LE(-1, 12);
    expect(() => parseLinedefs(lump, vertexes)).toThrow(/LINEDEFS entry 0.*start vertex -1.*VERTEXES has 1 entries/);
  });

  it('parseLinedefs rejects an end vertex index beyond the vertex array', () => {
    const vertexes: readonly MapVertex[] = Object.freeze([Object.freeze({ x: 0, y: 0 })]);
    const lump = Buffer.alloc(MAPLINEDEF_SIZE);
    lump.writeInt16LE(0, 0);
    lump.writeInt16LE(1, 2);
    lump.writeInt16LE(0, 4);
    lump.writeInt16LE(0, 6);
    lump.writeInt16LE(0, 8);
    lump.writeInt16LE(0, 10);
    lump.writeInt16LE(-1, 12);
    expect(() => parseLinedefs(lump, vertexes)).toThrow(/LINEDEFS entry 0.*end vertex 1.*VERTEXES has 1 entries/);
  });

  it('parseVertexes handles zero-length lump', () => {
    const result = parseVertexes(Buffer.alloc(0));
    expect(result.length).toBe(0);
  });

  it('parseSectors handles zero-length lump', () => {
    const result = parseSectors(Buffer.alloc(0));
    expect(result.length).toBe(0);
  });

  it('parseSidedefs handles zero-length lump', () => {
    const result = parseSidedefs(Buffer.alloc(0));
    expect(result.length).toBe(0);
  });

  it('parseLinedefs handles zero-length lump', () => {
    const result = parseLinedefs(Buffer.alloc(0), []);
    expect(result.length).toBe(0);
  });

  it('error messages include lump type and sizes', () => {
    try {
      parseVertexes(Buffer.alloc(5));
    } catch (error) {
      expect((error as Error).message).toContain('VERTEXES');
      expect((error as Error).message).toContain('5');
      expect((error as Error).message).toContain('4');
    }
  });
});

// ── Parity-sensitive edge cases ───────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('vertex coordinates use left-shift-16 matching P_LoadVertexes', () => {
    // Vertexes are loaded as int16 and shifted left by FRACBITS (16)
    // This means the fractional part of every vertex is always zero
    for (const vertex of e1m1Vertexes) {
      expect(vertex.x & 0xffff).toBe(0);
      expect(vertex.y & 0xffff).toBe(0);
    }
  });

  it('sector heights use left-shift-16 matching P_LoadSectors', () => {
    // Heights are int16 shifted left by FRACBITS
    for (const sector of e1m1Sectors) {
      expect(sector.floorheight & 0xffff).toBe(0);
      expect(sector.ceilingheight & 0xffff).toBe(0);
    }
  });

  it('sidedef offsets use left-shift-16 matching P_LoadSideDefs', () => {
    for (const sidedef of e1m1Sidedefs) {
      expect(sidedef.textureoffset & 0xffff).toBe(0);
      expect(sidedef.rowoffset & 0xffff).toBe(0);
    }
  });

  it('signed int16 fields are properly sign-extended', () => {
    // Build a synthetic vertex with negative coordinates (-1, -1)
    const negativeVertex = Buffer.alloc(MAPVERTEX_SIZE);
    negativeVertex.writeInt16LE(-1, 0);
    negativeVertex.writeInt16LE(-1, 2);
    const result = parseVertexes(negativeVertex);
    expect(result[0]!.x).toBe((-1 << FRACBITS) | 0);
    expect(result[0]!.y).toBe((-1 << FRACBITS) | 0);
    expect(result[0]!.x).toBe(-FRACUNIT);
  });

  it('sidenum1 === -1 for one-sided linedefs (not 0xFFFF)', () => {
    // The on-disk value for one-sided is 0xFFFF read as int16 = -1
    const oneSided = e1m1Linedefs.filter((l) => l.sidenum1 === -1);
    expect(oneSided.length).toBeGreaterThan(0);
  });

  it('slopetype uses XOR sign test not FixedDiv', () => {
    // Verify the optimization: (dy ^ dx) >= 0 ⟺ same sign ⟺ positive slope
    // Build a synthetic linedef where dy=1,dx=1 should give ST_POSITIVE
    const vertexes: readonly MapVertex[] = Object.freeze([Object.freeze({ x: 0, y: 0 }), Object.freeze({ x: FRACUNIT, y: FRACUNIT })]);
    const linedefBuffer = Buffer.alloc(MAPLINEDEF_SIZE);
    linedefBuffer.writeInt16LE(0, 0); // v1 = 0
    linedefBuffer.writeInt16LE(1, 2); // v2 = 1
    linedefBuffer.writeInt16LE(0, 4); // flags
    linedefBuffer.writeInt16LE(0, 6); // special
    linedefBuffer.writeInt16LE(0, 8); // tag
    linedefBuffer.writeInt16LE(0, 10); // sidenum0
    linedefBuffer.writeInt16LE(-1, 12); // sidenum1
    const result = parseLinedefs(linedefBuffer, vertexes);
    expect(result[0]!.slopetype).toBe(ST_POSITIVE);
  });

  it('bbox uses correct index ordering: [top, bottom, left, right]', () => {
    const linedef = e1m1Linedefs[0]!;
    // BOXTOP >= BOXBOTTOM and BOXRIGHT >= BOXLEFT
    expect(linedef.bbox[BOXTOP]).toBeGreaterThanOrEqual(linedef.bbox[BOXBOTTOM]);
    expect(linedef.bbox[BOXRIGHT]).toBeGreaterThanOrEqual(linedef.bbox[BOXLEFT]);
  });

  it('E1M1 has more sidedefs than linedefs (two-sided lines have two sides)', () => {
    expect(e1m1Sidedefs.length).toBeGreaterThan(e1m1Linedefs.length);
    const twoSidedCount = e1m1Linedefs.filter((l) => l.sidenum1 !== -1).length;
    expect(e1m1Sidedefs.length).toBe(e1m1Linedefs.length + twoSidedCount);
  });

  it('every sidedef sector index points to a valid sector', () => {
    for (const sidedef of e1m1Sidedefs) {
      expect(sidedef.sector).toBeGreaterThanOrEqual(0);
      expect(sidedef.sector).toBeLessThan(e1m1Sectors.length);
    }
  });

  it('E1M8 has fewest linedefs (333) and E1M6 has most (1352)', () => {
    const allMaps = findMapNames(directory);
    let fewestMap = '';
    let fewestCount = Infinity;
    let mostMap = '';
    let mostCount = 0;
    for (const mapName of allMaps) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const count = bundle.linedefs.length / MAPLINEDEF_SIZE;
      if (count < fewestCount) {
        fewestCount = count;
        fewestMap = mapName;
      }
      if (count > mostCount) {
        mostCount = count;
        mostMap = mapName;
      }
    }
    expect(fewestMap).toBe('E1M8');
    expect(fewestCount).toBe(333);
    expect(mostMap).toBe('E1M6');
    expect(mostCount).toBe(1352);
  });

  it('compile-time type satisfaction for all interfaces', () => {
    const _vertex: MapVertex = e1m1Vertexes[0]!;
    const _sector: MapSector = e1m1Sectors[0]!;
    const _sidedef: MapSidedef = e1m1Sidedefs[0]!;
    const _linedef: MapLinedef = e1m1Linedefs[0]!;
    const _slopetype: SlopeType = e1m1Linedefs[0]!.slopetype;
    expect(_vertex).toBeDefined();
    expect(_sector).toBeDefined();
    expect(_sidedef).toBeDefined();
    expect(_linedef).toBeDefined();
    expect(_slopetype).toBeDefined();
  });
});
