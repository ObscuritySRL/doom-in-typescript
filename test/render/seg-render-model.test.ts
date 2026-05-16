import { describe, expect, test } from 'bun:test';

import type { MapSeg } from '../../src/map/bspStructs.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ML_TWOSIDED, ST_HORIZONTAL } from '../../src/map/lineSectorGeometry.ts';
import type { SegRenderScene } from '../../src/render/segRenderModel.ts';
import { buildStoreWallRangeSeg, segRenderModel } from '../../src/render/segRenderModel.ts';

const flatNumber = (name: string): number => (name === '' ? 0 : (name.charCodeAt(0) << 8) + (name.charCodeAt(name.length - 1) | 0));
const textureNumber = (name: string): number => (name === '' || name === '-' ? 0 : name.length * 100 + name.charCodeAt(0));

function vertex(x: number, y: number): MapVertex {
  return { x, y };
}

function sector(floorheight: number, ceilingheight: number, floorpic: string, ceilingpic: string, lightlevel: number): MapSector {
  return { floorheight, ceilingheight, floorpic, ceilingpic, lightlevel, special: 0, tag: 0 };
}

function sidedef(sectorIndex: number, midtexture = '', toptexture = '', bottomtexture = '', textureoffset = 0, rowoffset = 0): MapSidedef {
  return { textureoffset, rowoffset, toptexture, bottomtexture, midtexture, sector: sectorIndex };
}

function linedef(flags: number, sidenum0: number, sidenum1: number): MapLinedef {
  return { v1: 0, v2: 1, dx: 0, dy: 0, flags, special: 0, tag: 0, sidenum0, sidenum1, slopetype: ST_HORIZONTAL, bbox: [0, 0, 0, 0] };
}

function seg(v1: number, v2: number, angle: number, linedefIndex: number, side: number, offset: number): MapSeg {
  return { v1, v2, angle, linedef: linedefIndex, side, offset };
}

// Independent structural re-transcription of p_setup.c P_LoadSegs
// front/back/sidedef resolution (different control flow than the module).
function expectedResolution(scene: SegRenderScene, segIndex: number): { frontSectorIndex: number; backSectorIndex: number | null; nullAddress: boolean; sidedefIndex: number } {
  const s = scene.segs[segIndex]!;
  const ld = scene.linedefs[s.linedef]!;
  const sidenum = [ld.sidenum0, ld.sidenum1];
  const frontSidedefIndex = sidenum[s.side]!;
  const frontSectorIndex = scene.sidedefs[frontSidedefIndex]!.sector;
  if ((ld.flags & ML_TWOSIDED) === 0) {
    return { frontSectorIndex, backSectorIndex: null, nullAddress: false, sidedefIndex: frontSidedefIndex };
  }
  const backSidenum = sidenum[s.side ^ 1]!;
  if (backSidenum < 0 || backSidenum >= scene.sidedefs.length) {
    return { frontSectorIndex, backSectorIndex: null, nullAddress: true, sidedefIndex: frontSidedefIndex };
  }
  return { frontSectorIndex, backSectorIndex: scene.sidedefs[backSidenum]!.sector, nullAddress: false, sidedefIndex: frontSidedefIndex };
}

const SCENE: SegRenderScene = {
  vertexes: [vertex(0, 0), vertex(64 << 16, 0), vertex(0, 64 << 16), vertex(128 << 16, 64 << 16)],
  sectors: [sector(0, 128 << 16, 'FLOOR4_8', 'CEIL3_5', 160), sector(16 << 16, 96 << 16, 'NUKAGE1', 'F_SKY1', 96), sector(0, 64 << 16, 'FLAT5_5', 'FLAT5_5', 255)],
  sidedefs: [sidedef(0, 'STARTAN3'), sidedef(1, '', 'BROWN1', 'STEP1'), sidedef(2, '-'), sidedef(0, 'SUPPORT2')],
  linedefs: [
    linedef(0, 0, -1), // one-sided
    linedef(ML_TWOSIDED, 0, 1), // two-sided
    linedef(ML_TWOSIDED, 2, -1), // two-sided but back sidenum out of range (glass hack)
  ],
  segs: [seg(0, 1, 0x2000_0000, 0, 0, 0), seg(1, 3, 0x4000_0000, 1, 0, 32 << 16), seg(3, 2, 0x8000_0000, 1, 1, 16 << 16), seg(2, 0, 0xc000_0000, 2, 0, 0)],
};

describe('segRenderModel: P_LoadSegs front/back/sidedef resolution', () => {
  test('one-sided seg → backsector null, front from sidenum[side]', () => {
    const model = segRenderModel(SCENE, 0, flatNumber, textureNumber);
    expect(model.backsector).toBeNull();
    expect(model.backsectorIsNullAddress).toBe(false);
    expect(model.frontsector.floorpic).toBe(flatNumber('FLOOR4_8'));
    expect(model.frontsector.ceilingpic).toBe(flatNumber('CEIL3_5'));
    expect(model.frontsector.lightlevel).toBe(160);
    expect(model.sidedef.midtexture).toBe(textureNumber('STARTAN3'));
    expect(model.addLineSeg.sidedefMidtexture).toBe(textureNumber('STARTAN3'));
    expect(model.curlineAngle).toBe(0x2000_0000);
  });

  test('two-sided seg side 0 → front=sidenum0 sector, back=sidenum1 sector', () => {
    const model = segRenderModel(SCENE, 1, flatNumber, textureNumber);
    expect(model.frontsector.floorpic).toBe(flatNumber('FLOOR4_8')); // sidedef 0 → sector 0
    expect(model.backsector).not.toBeNull();
    expect(model.backsector!.ceilingpic).toBe(flatNumber('F_SKY1')); // sidedef 1 → sector 1
    expect(model.backsector!.floorheight).toBe(16 << 16);
    // li->sidedef = &sides[ldef->sidenum[side]] → the FRONT sidedef (sidenum0=0 → STARTAN3).
    expect(model.sidedef.midtexture).toBe(textureNumber('STARTAN3'));
    expect(model.sidedef.toptexture).toBe(0); // sidedef 0 top '' → 0
    expect(model.addLineSeg.sidedefMidtexture).toBe(textureNumber('STARTAN3'));
    expect(model.addLineSeg.backsector).toBe(model.backsector);
  });

  test('two-sided seg side 1 → front/back swap via sidenum[side^1]', () => {
    const model = segRenderModel(SCENE, 2, flatNumber, textureNumber);
    // side=1 → front = sidenum1 (sidedef 1 → sector 1), back = sidenum0 (sidedef 0 → sector 0)
    expect(model.frontsector.ceilingpic).toBe(flatNumber('F_SKY1'));
    expect(model.backsector!.floorpic).toBe(flatNumber('FLOOR4_8'));
    expect(model.sidedef.midtexture).toBe(0); // sidedef 1 mid '' → 0
  });

  test('two-sided with out-of-range back sidenum → zeroed null-address sector + flag', () => {
    const model = segRenderModel(SCENE, 3, flatNumber, textureNumber);
    expect(model.backsectorIsNullAddress).toBe(true);
    expect(model.backsector).toEqual({ ceilingheight: 0, floorheight: 0, ceilingpic: 0, floorpic: 0, lightlevel: 0 });
    expect(model.frontsector.floorpic).toBe(flatNumber('FLAT5_5'));
    expect(model.sidedef.midtexture).toBe(0); // '-' → 0
  });

  test('buildStoreWallRangeSeg threads screen range + rwAngle1 and carries resolved seg fields', () => {
    const model = segRenderModel(SCENE, 1, flatNumber, textureNumber);
    const swr = buildStoreWallRangeSeg(model, 12, 47, 0xdead_0000 >>> 0);
    expect(swr.start).toBe(12);
    expect(swr.stop).toBe(47);
    expect(swr.rwAngle1).toBe(0xdead_0000 >>> 0);
    expect(swr.curlineAngle).toBe(0x4000_0000);
    expect(swr.curlineOffset).toBe(32 << 16);
    expect(swr.linedefFlags).toBe(ML_TWOSIDED);
    expect(swr.sidedef).toBe(model.sidedef);
    expect(swr.frontsector).toBe(model.frontsector);
    expect(swr.backsector).toBe(model.backsector);
    expect(swr.v1).toEqual({ x: 64 << 16, y: 0 });
  });
});

describe('segRenderModel: structurally-independent P_LoadSegs battery', () => {
  test('500-iteration deterministic-LCG random scene matches the independent re-transcription', () => {
    let lcg = 0x1357_9bdf >>> 0;
    const next = (bound: number): number => {
      lcg = (Math.imul(lcg, 1_664_525) + 1_013_904_223) >>> 0;
      return lcg % bound;
    };
    const flatNames = ['', 'FLOOR4_8', 'NUKAGE1', 'F_SKY1', 'FLAT5_5', 'CEIL3_5'];
    const texNames = ['', '-', 'STARTAN3', 'BROWN1', 'SUPPORT2', 'STEP1'];

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const sectorCount = 1 + next(4);
      const sectors: MapSector[] = [];
      for (let s = 0; s < sectorCount; s += 1) {
        sectors.push(sector(next(256) << 16, (next(256) + 256) << 16, flatNames[next(flatNames.length)]!, flatNames[next(flatNames.length)]!, next(256)));
      }
      const sidedefCount = 1 + next(5);
      const sidedefs: MapSidedef[] = [];
      for (let sd = 0; sd < sidedefCount; sd += 1) {
        sidedefs.push(sidedef(next(sectorCount), texNames[next(texNames.length)]!, texNames[next(texNames.length)]!, texNames[next(texNames.length)]!, next(64) << 16, next(64) << 16));
      }
      const twoSided = next(2) === 1;
      const flags = twoSided ? ML_TWOSIDED : 0;
      const side = next(2);
      // Real maps always have a valid FRONT sidenum (sidenum[side]); only
      // the BACK (sidenum[side^1]) can be -1/out-of-range (glass hack).
      const frontSidenum = next(sidedefCount);
      const backSidenum = next(3) === 0 ? -1 : next(sidedefCount + 2);
      const sidenum0 = side === 0 ? frontSidenum : backSidenum;
      const sidenum1 = side === 0 ? backSidenum : frontSidenum;
      const linedefs: MapLinedef[] = [linedef(flags, sidenum0, sidenum1)];
      const vertexes: MapVertex[] = [vertex(next(512) << 16, next(512) << 16), vertex(next(512) << 16, next(512) << 16)];
      const scene: SegRenderScene = { vertexes, sectors, sidedefs, linedefs, segs: [seg(0, 1, next(0xffff) << 16, 0, side, next(64) << 16)] };

      const model = segRenderModel(scene, 0, flatNumber, textureNumber);
      const expected = expectedResolution(scene, 0);

      const expectedFront = sectors[expected.frontSectorIndex]!;
      expect(model.frontsector).toEqual({
        ceilingheight: expectedFront.ceilingheight,
        floorheight: expectedFront.floorheight,
        ceilingpic: flatNumber(expectedFront.ceilingpic),
        floorpic: flatNumber(expectedFront.floorpic),
        lightlevel: expectedFront.lightlevel,
      });
      expect(model.backsectorIsNullAddress).toBe(expected.nullAddress);
      if (expected.backSectorIndex === null && !expected.nullAddress) {
        expect(model.backsector).toBeNull();
      } else if (expected.nullAddress) {
        expect(model.backsector).toEqual({ ceilingheight: 0, floorheight: 0, ceilingpic: 0, floorpic: 0, lightlevel: 0 });
      } else {
        expect(model.backsector!.floorheight).toBe(sectors[expected.backSectorIndex!]!.floorheight);
        expect(model.backsector!.ceilingpic).toBe(flatNumber(sectors[expected.backSectorIndex!]!.ceilingpic));
      }
      expect(model.sidedef.bottomtexture).toBe(textureNumber(sidedefs[expected.sidedefIndex]!.bottomtexture));
      expect(model.curlineAngle).toBe(scene.segs[0]!.angle >>> 0);
      expect(model.curlineOffset).toBe(scene.segs[0]!.offset);
    }
  });
});
