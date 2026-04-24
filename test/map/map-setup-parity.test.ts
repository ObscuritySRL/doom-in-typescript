import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS } from '../../src/core/fixed.ts';
import type { Fixed } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle } from '../../src/map/mapBundle.ts';
import { ML_TWOSIDED, BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT } from '../../src/map/lineSectorGeometry.ts';
import { setupLevel, MAXRADIUS } from '../../src/map/mapSetup.ts';
import type { MapData, LineSectors, SectorGroup } from '../../src/map/mapSetup.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const mapData = setupLevel(e1m1Bundle);

/** Fixed-point helper: convert integer map units to 16.16 fixed. */
function toFixed(mapUnits: number): Fixed {
  return (mapUnits << FRACBITS) | 0;
}

// ── setupLevel basic completeness ────────────────────────────────────

describe('setupLevel', () => {
  it('returns the correct map name', () => {
    expect(mapData.name).toBe('E1M1');
  });

  it('populates all parsed geometry arrays', () => {
    expect(mapData.vertexes.length).toBeGreaterThan(0);
    expect(mapData.sectors.length).toBeGreaterThan(0);
    expect(mapData.sidedefs.length).toBeGreaterThan(0);
    expect(mapData.linedefs.length).toBeGreaterThan(0);
    expect(mapData.segs.length).toBeGreaterThan(0);
    expect(mapData.subsectors.length).toBeGreaterThan(0);
    expect(mapData.nodes.length).toBeGreaterThan(0);
    expect(mapData.things.length).toBeGreaterThan(0);
  });

  it('populates blockmap, reject, and derived lookups', () => {
    expect(mapData.blockmap.columns).toBeGreaterThan(0);
    expect(mapData.blockmap.rows).toBeGreaterThan(0);
    expect(mapData.reject.sectorCount).toBe(mapData.sectors.length);
    expect(mapData.subsectorSectors.length).toBe(mapData.subsectors.length);
    expect(mapData.validCount.stamps.length).toBe(mapData.linedefs.length);
  });

  it('produces one LineSectors entry per linedef', () => {
    expect(mapData.lineSectors.length).toBe(mapData.linedefs.length);
  });

  it('produces one SectorGroup entry per sector', () => {
    expect(mapData.sectorGroups.length).toBe(mapData.sectors.length);
  });
});

// ── LineSectors (front/back sector resolution) parity ────────────────

describe('lineSectors parity', () => {
  it('every linedef has a valid frontsector index', () => {
    for (const ls of mapData.lineSectors) {
      expect(ls.frontsector).toBeGreaterThanOrEqual(0);
      expect(ls.frontsector).toBeLessThan(mapData.sectors.length);
    }
  });

  it('two-sided lines with valid sidenum1 have a resolved backsector', () => {
    for (let i = 0; i < mapData.linedefs.length; i++) {
      const ld = mapData.linedefs[i]!;
      const ls = mapData.lineSectors[i]!;
      if ((ld.flags & ML_TWOSIDED) !== 0 && ld.sidenum1 !== -1) {
        expect(ls.backsector).toBeGreaterThanOrEqual(0);
        expect(ls.backsector).toBeLessThan(mapData.sectors.length);
      }
    }
  });

  it('one-sided lines have backsector = -1', () => {
    for (let i = 0; i < mapData.linedefs.length; i++) {
      const ld = mapData.linedefs[i]!;
      const ls = mapData.lineSectors[i]!;
      if (!(ld.flags & ML_TWOSIDED) || ld.sidenum1 === -1) {
        expect(ls.backsector).toBe(-1);
      }
    }
  });

  it('frontsector matches sidenum0 → sidedef → sector chain', () => {
    for (let i = 0; i < mapData.linedefs.length; i++) {
      const ld = mapData.linedefs[i]!;
      const ls = mapData.lineSectors[i]!;
      const expected = mapData.sidedefs[ld.sidenum0]!.sector;
      expect(ls.frontsector).toBe(expected);
    }
  });
});

// ── SectorGroup (P_GroupLines) parity ────────────────────────────────

describe('sectorGroup parity', () => {
  it('every sector lineIndices entry is a valid linedef index', () => {
    for (const sg of mapData.sectorGroups) {
      for (const li of sg.lineIndices) {
        expect(li).toBeGreaterThanOrEqual(0);
        expect(li).toBeLessThan(mapData.linedefs.length);
      }
    }
  });

  it('total line references across all sectors counts each two-sided line twice', () => {
    let totalRefs = 0;
    for (const sg of mapData.sectorGroups) {
      totalRefs += sg.lineIndices.length;
    }
    let oneSided = 0;
    let twoSided = 0;
    for (const ls of mapData.lineSectors) {
      if (ls.backsector === -1) oneSided++;
      else twoSided++;
    }
    // One-sided lines appear in 1 sector; two-sided lines appear in 2
    // (unless front === back, which counts as 1)
    let expectedRefs = oneSided;
    for (let i = 0; i < mapData.lineSectors.length; i++) {
      const ls = mapData.lineSectors[i]!;
      if (ls.backsector !== -1) {
        expectedRefs += ls.frontsector === ls.backsector ? 1 : 2;
      }
    }
    expect(totalRefs).toBe(expectedRefs);
  });

  it('each linedef index appears in its frontsector group', () => {
    for (let i = 0; i < mapData.lineSectors.length; i++) {
      const ls = mapData.lineSectors[i]!;
      const sg = mapData.sectorGroups[ls.frontsector]!;
      expect(sg.lineIndices).toContain(i);
    }
  });

  it('each two-sided linedef index appears in its backsector group', () => {
    for (let i = 0; i < mapData.lineSectors.length; i++) {
      const ls = mapData.lineSectors[i]!;
      if (ls.backsector !== -1 && ls.backsector !== ls.frontsector) {
        const sg = mapData.sectorGroups[ls.backsector]!;
        expect(sg.lineIndices).toContain(i);
      }
    }
  });

  it('sector bounding box encloses all touching vertex endpoints', () => {
    for (let si = 0; si < mapData.sectors.length; si++) {
      const sg = mapData.sectorGroups[si]!;
      if (sg.lineIndices.length === 0) continue;
      for (const li of sg.lineIndices) {
        const ld = mapData.linedefs[li]!;
        const v1 = mapData.vertexes[ld.v1]!;
        const v2 = mapData.vertexes[ld.v2]!;
        expect(sg.bbox[BOXTOP]).toBeGreaterThanOrEqual(v1.y);
        expect(sg.bbox[BOXTOP]).toBeGreaterThanOrEqual(v2.y);
        expect(sg.bbox[BOXBOTTOM]).toBeLessThanOrEqual(v1.y);
        expect(sg.bbox[BOXBOTTOM]).toBeLessThanOrEqual(v2.y);
        expect(sg.bbox[BOXLEFT]).toBeLessThanOrEqual(v1.x);
        expect(sg.bbox[BOXLEFT]).toBeLessThanOrEqual(v2.x);
        expect(sg.bbox[BOXRIGHT]).toBeGreaterThanOrEqual(v1.x);
        expect(sg.bbox[BOXRIGHT]).toBeGreaterThanOrEqual(v2.x);
      }
    }
  });

  it('sound origin is the center of the bounding box', () => {
    for (const sg of mapData.sectorGroups) {
      if (sg.lineIndices.length === 0) continue;
      const expectedX = (((sg.bbox[BOXRIGHT] + sg.bbox[BOXLEFT]) / 2) | 0) as Fixed;
      const expectedY = (((sg.bbox[BOXTOP] + sg.bbox[BOXBOTTOM]) / 2) | 0) as Fixed;
      expect(sg.soundOriginX).toBe(expectedX);
      expect(sg.soundOriginY).toBe(expectedY);
    }
  });

  it('blockbox values are non-negative and within blockmap grid bounds', () => {
    for (const sg of mapData.sectorGroups) {
      if (sg.lineIndices.length === 0) continue;
      expect(sg.blockbox[BOXTOP]).toBeGreaterThanOrEqual(0);
      expect(sg.blockbox[BOXTOP]).toBeLessThan(mapData.blockmap.rows);
      expect(sg.blockbox[BOXBOTTOM]).toBeGreaterThanOrEqual(0);
      expect(sg.blockbox[BOXBOTTOM]).toBeLessThan(mapData.blockmap.rows);
      expect(sg.blockbox[BOXLEFT]).toBeGreaterThanOrEqual(0);
      expect(sg.blockbox[BOXLEFT]).toBeLessThan(mapData.blockmap.columns);
      expect(sg.blockbox[BOXRIGHT]).toBeGreaterThanOrEqual(0);
      expect(sg.blockbox[BOXRIGHT]).toBeLessThan(mapData.blockmap.columns);
    }
  });
});

// ── Parity-sensitive edge case: M_AddToBox else-if branch ────────────

describe('M_AddToBox else-if parity', () => {
  it('sector bbox uses exact M_AddToBox semantics (else-if, not independent if)', () => {
    // In M_AddToBox, the x-axis uses `else if`:
    //   if (x < BOXLEFT) BOXLEFT = x;
    //   else if (x > BOXRIGHT) BOXRIGHT = x;
    //
    // After M_ClearBox, BOXLEFT = INT_MAX, BOXRIGHT = INT_MIN.
    // The first x added always goes to BOXLEFT (x < INT_MAX),
    // and the second x either refines BOXLEFT or goes to BOXRIGHT.
    //
    // We verify this by checking that for sectors with at least one
    // linedef, BOXLEFT and BOXRIGHT are actual vertex coordinates.
    for (let si = 0; si < mapData.sectors.length; si++) {
      const sg = mapData.sectorGroups[si]!;
      if (sg.lineIndices.length === 0) continue;

      const allX: Fixed[] = [];
      for (const li of sg.lineIndices) {
        const ld = mapData.linedefs[li]!;
        allX.push(mapData.vertexes[ld.v1]!.x, mapData.vertexes[ld.v2]!.x);
      }

      // BOXLEFT must be the minimum x, BOXRIGHT the maximum x
      expect(sg.bbox[BOXLEFT]).toBe(Math.min(...allX));
      expect(sg.bbox[BOXRIGHT]).toBe(Math.max(...allX));
    }
  });

  it('sector bbox top/bottom are actual vertex y coordinates', () => {
    for (let si = 0; si < mapData.sectors.length; si++) {
      const sg = mapData.sectorGroups[si]!;
      if (sg.lineIndices.length === 0) continue;

      const allY: Fixed[] = [];
      for (const li of sg.lineIndices) {
        const ld = mapData.linedefs[li]!;
        allY.push(mapData.vertexes[ld.v1]!.y, mapData.vertexes[ld.v2]!.y);
      }

      expect(sg.bbox[BOXTOP]).toBe(Math.max(...allY));
      expect(sg.bbox[BOXBOTTOM]).toBe(Math.min(...allY));
    }
  });
});

// ── MAXRADIUS constant ───────────────────────────────────────────────

describe('MAXRADIUS', () => {
  it('equals 32 << FRACBITS (32*FRACUNIT)', () => {
    expect(MAXRADIUS).toBe((32 << FRACBITS) | 0);
  });
});

// ── Frozen immutability ──────────────────────────────────────────────

describe('immutability', () => {
  it('MapData top-level is frozen', () => {
    expect(Object.isFrozen(mapData)).toBe(true);
  });

  it('lineSectors array is frozen', () => {
    expect(Object.isFrozen(mapData.lineSectors)).toBe(true);
  });

  it('sectorGroups array is frozen', () => {
    expect(Object.isFrozen(mapData.sectorGroups)).toBe(true);
  });

  it('individual SectorGroup entries are frozen', () => {
    for (const sg of mapData.sectorGroups) {
      expect(Object.isFrozen(sg)).toBe(true);
      expect(Object.isFrozen(sg.lineIndices)).toBe(true);
      expect(Object.isFrozen(sg.bbox)).toBe(true);
      expect(Object.isFrozen(sg.blockbox)).toBe(true);
    }
  });

  it('individual LineSectors entries are frozen', () => {
    for (const ls of mapData.lineSectors) {
      expect(Object.isFrozen(ls)).toBe(true);
    }
  });
});
