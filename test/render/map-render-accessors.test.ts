import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';

import type { MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ML_TWOSIDED, ST_HORIZONTAL } from '../../src/map/lineSectorGeometry.ts';
import type { MapRenderTables } from '../../src/render/mapRenderAccessors.ts';
import { makeMapRenderAccessors } from '../../src/render/mapRenderAccessors.ts';

const V = (x: number, y: number): MapVertex => ({ x: x * FRACUNIT, y: y * FRACUNIT });
const vertexes: readonly MapVertex[] = [V(0, 0), V(64, 0), V(64, 64), V(0, 64)];

const sector = (floorh: number, ceilh: number, floorpic: string, ceilpic: string, light: number): MapSector => ({
  floorheight: floorh * FRACUNIT,
  ceilingheight: ceilh * FRACUNIT,
  floorpic,
  ceilingpic: ceilpic,
  lightlevel: light,
  special: 0,
  tag: 0,
});
const sectors: readonly MapSector[] = [sector(0, 128, 'FLOOR4_8', 'CEIL3_5', 160), sector(16, 96, 'FLAT5_4', 'F_SKY1', 128)];

const sd = (midtexture: string, sectorIndex: number): MapSidedef => ({ textureoffset: 0, rowoffset: 0, toptexture: '-', bottomtexture: '-', midtexture, sector: sectorIndex });
const sidedefs: readonly MapSidedef[] = [sd('STARTAN3', 0), sd('-', 0), sd('-', 1), sd('BROWN1', 1)];

const ld = (v1: number, v2: number, flags: number, sidenum0: number, sidenum1: number): MapLinedef => ({ v1, v2, dx: 0, dy: 0, flags, special: 0, tag: 0, sidenum0, sidenum1, slopetype: ST_HORIZONTAL, bbox: [0, 0, 0, 0] });
const linedefs: readonly MapLinedef[] = [
  ld(0, 1, 0, 0, -1), // ld0: one-sided
  ld(1, 2, ML_TWOSIDED, 1, 2), // ld1: two-sided
  ld(2, 3, ML_TWOSIDED, 3, -1), // ld2: glass hack (ML_TWOSIDED, opposite -1)
  ld(3, 0, ML_TWOSIDED, 0, 3), // ld3: two-sided, used by a side==1 seg
];

const seg = (v1: number, v2: number, linedef: number, side: number): MapSeg => ({ v1, v2, angle: 0, linedef, side, offset: 0 });
const segs: readonly MapSeg[] = [
  seg(0, 1, 0, 0), // seg0: one-sided
  seg(1, 2, 1, 0), // seg1: two-sided, side 0
  seg(2, 3, 2, 0), // seg2: glass hack
  seg(3, 0, 3, 1), // seg3: two-sided, side 1 (front = sidenum1, back = sidenum0)
];

const subsectors: readonly MapSubsector[] = [
  { firstseg: 0, numsegs: 2 }, // ss0: first seg = seg0 → ld0 side0 sidenum0=0 → sd0.sector=0
  { firstseg: 3, numsegs: 1 }, // ss1: first seg = seg3 → ld3 side1 sidenum1=3 → sd3.sector=1
];

const map: MapRenderTables = { subsectors, segs, linedefs, sidedefs, sectors, vertexes };

const FLAT = new Map([
  ['CEIL3_5', 10],
  ['FLOOR4_8', 11],
  ['F_SKY1', 99],
  ['FLAT5_4', 12],
]);
const TEX = new Map([
  ['STARTAN3', 5],
  ['BROWN1', 7],
  ['-', 0],
]);
const flatNumber = (name: string): number => FLAT.get(name)!;
const textureNumber = (name: string): number => TEX.get(name)!;

describe('mapRenderAccessors: P_LoadSegs / P_GroupLines render binding', () => {
  const acc = makeMapRenderAccessors(map, flatNumber, textureNumber);

  test('subsectorAt returns the parsed MapSubsector by index', () => {
    expect(acc.subsectorAt(0)).toBe(subsectors[0]!);
    expect(acc.subsectorAt(1).firstseg).toBe(3);
    expect(acc.subsectorAt(1).numsegs).toBe(1);
  });

  test('frontsectorOf resolves sub->sector (first seg → linedef side → sidedef.sector) with pics → flat numbers', () => {
    expect(acc.frontsectorOf(0)).toEqual({ ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 10, floorpic: 11, lightlevel: 160 });
    // ss1's first seg is side==1 → front sidedef = sidenum1 = sd3 → sector 1.
    expect(acc.frontsectorOf(1)).toEqual({ ceilingheight: 96 * FRACUNIT, floorheight: 16 * FRACUNIT, ceilingpic: 99, floorpic: 12, lightlevel: 128 });
  });

  test('addLineSegAt: one-sided seg → null backsector, midtexture number, vertex coords', () => {
    const s = acc.addLineSegAt(0);
    expect(s.v1).toEqual({ x: 0, y: 0 });
    expect(s.v2).toEqual({ x: 64 * FRACUNIT, y: 0 });
    expect(s.backsector).toBeNull();
    expect(s.sidedefMidtexture).toBe(5);
  });

  test('addLineSegAt: two-sided side-0 seg → backsector from the opposite sidedef sector', () => {
    const s = acc.addLineSegAt(1);
    expect(s.sidedefMidtexture).toBe(0); // '-' → 0
    expect(s.backsector).toEqual({ ceilingheight: 96 * FRACUNIT, floorheight: 16 * FRACUNIT, ceilingpic: 99, floorpic: 12, lightlevel: 128 });
  });

  test('addLineSegAt: side==1 seg uses sidenum1 as front and sidenum0 as back', () => {
    const s = acc.addLineSegAt(3);
    expect(s.v1).toEqual({ x: 0, y: 64 * FRACUNIT }); // vertex 3
    expect(s.v2).toEqual({ x: 0, y: 0 }); // vertex 0
    expect(s.sidedefMidtexture).toBe(7); // sd3 'BROWN1'
    expect(s.backsector).toEqual({ ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 10, floorpic: 11, lightlevel: 160 }); // sd0.sector = 0
  });

  test('the GetSectorAtNullAddress glass hack is a hard error (deferred parity edge)', () => {
    expect(() => acc.addLineSegAt(2)).toThrow('GetSectorAtNullAddress glass hack');
  });
});
