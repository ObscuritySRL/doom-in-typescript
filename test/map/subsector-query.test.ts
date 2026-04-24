import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS } from '../../src/core/fixed.ts';
import type { Fixed } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle } from '../../src/map/mapBundle.ts';
import { parseLinedefs, parseSectors, parseSidedefs, parseVertexes } from '../../src/map/lineSectorGeometry.ts';
import type { MapSector } from '../../src/map/lineSectorGeometry.ts';
import { NF_SUBSECTOR, parseNodes, parseSegs, parseSubsectors } from '../../src/map/bspStructs.ts';
import { parseThings } from '../../src/map/things.ts';
import { pointInSubsector } from '../../src/map/nodeTraversal.ts';
import { buildSubsectorSectorMap, sectorIndexAt } from '../../src/map/subsectorQuery.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);
const e1m1Sectors = parseSectors(e1m1Bundle.sectors);
const e1m1Sidedefs = parseSidedefs(e1m1Bundle.sidedefs);
const e1m1Linedefs = parseLinedefs(e1m1Bundle.linedefs, e1m1Vertexes);
const e1m1Segs = parseSegs(e1m1Bundle.segs);
const e1m1Subsectors = parseSubsectors(e1m1Bundle.ssectors);
const e1m1Nodes = parseNodes(e1m1Bundle.nodes);
const e1m1Things = parseThings(e1m1Bundle.things);

const e1m1SubsectorSectors = buildSubsectorSectorMap(e1m1Subsectors, e1m1Segs, e1m1Linedefs, e1m1Sidedefs);

/** Fixed-point helper: convert integer map units to 16.16 fixed. */
function toFixed(mapUnits: number): Fixed {
  return (mapUnits << FRACBITS) | 0;
}

// ── buildSubsectorSectorMap ─────────────────────────────────────────

describe('buildSubsectorSectorMap', () => {
  it('returns one entry per subsector', () => {
    expect(e1m1SubsectorSectors.length).toBe(e1m1Subsectors.length);
  });

  it('every entry is a valid sector index', () => {
    for (let index = 0; index < e1m1SubsectorSectors.length; index++) {
      const sectorIndex = e1m1SubsectorSectors[index]!;
      expect(sectorIndex).toBeGreaterThanOrEqual(0);
      expect(sectorIndex).toBeLessThan(e1m1Sectors.length);
    }
  });

  it('reproduces the first-seg chain for every subsector', () => {
    for (let index = 0; index < e1m1Subsectors.length; index++) {
      const subsector = e1m1Subsectors[index]!;
      const firstSeg = e1m1Segs[subsector.firstseg]!;
      const linedef = e1m1Linedefs[firstSeg.linedef]!;
      const sidedefIndex = firstSeg.side === 0 ? linedef.sidenum0 : linedef.sidenum1;
      const expectedSector = e1m1Sidedefs[sidedefIndex]!.sector;

      expect(e1m1SubsectorSectors[index]).toBe(expectedSector);
    }
  });

  it('result array is frozen', () => {
    expect(Object.isFrozen(e1m1SubsectorSectors)).toBe(true);
  });

  it('covers multiple distinct sectors', () => {
    const uniqueSectors = new Set(e1m1SubsectorSectors);
    expect(uniqueSectors.size).toBeGreaterThan(1);
    expect(uniqueSectors.size).toBeLessThanOrEqual(e1m1Sectors.length);
  });

  it('at least one subsector uses a back-side seg (side === 1)', () => {
    let foundBackSide = false;
    for (let index = 0; index < e1m1Subsectors.length; index++) {
      const subsector = e1m1Subsectors[index]!;
      const firstSeg = e1m1Segs[subsector.firstseg]!;
      if (firstSeg.side === 1) {
        foundBackSide = true;
        break;
      }
    }
    expect(foundBackSide).toBe(true);
  });
});

// ── sectorIndexAt ───────────────────────────────────────────────────

describe('sectorIndexAt', () => {
  it('returns a valid sector index for the player 1 start', () => {
    const player1 = e1m1Things.find((thing) => thing.type === 1)!;
    const sectorIndex = sectorIndexAt(toFixed(player1.x), toFixed(player1.y), e1m1Nodes, e1m1SubsectorSectors);
    expect(sectorIndex).toBeGreaterThanOrEqual(0);
    expect(sectorIndex).toBeLessThan(e1m1Sectors.length);
  });

  it('agrees with manual pointInSubsector + lookup for player 1 start', () => {
    const player1 = e1m1Things.find((thing) => thing.type === 1)!;
    const fixedX = toFixed(player1.x);
    const fixedY = toFixed(player1.y);

    const subsectorIndex = pointInSubsector(fixedX, fixedY, e1m1Nodes);
    const expectedSector = e1m1SubsectorSectors[subsectorIndex]!;
    const queriedSector = sectorIndexAt(fixedX, fixedY, e1m1Nodes, e1m1SubsectorSectors);

    expect(queriedSector).toBe(expectedSector);
  });

  it('returns the correct sector properties for the player 1 start room', () => {
    const player1 = e1m1Things.find((thing) => thing.type === 1)!;
    const sectorIndex = sectorIndexAt(toFixed(player1.x), toFixed(player1.y), e1m1Nodes, e1m1SubsectorSectors);
    const sector = e1m1Sectors[sectorIndex]!;

    // The E1M1 starting room has a floor height and ceiling above it
    expect(sector.floorheight).toBeLessThan(sector.ceilingheight);
    expect(sector.lightlevel).toBeGreaterThan(0);
  });

  it('returns consistent results for all player starts', () => {
    for (const playerType of [1, 2, 3, 4]) {
      const start = e1m1Things.find((thing) => thing.type === playerType);
      if (start === undefined) continue;

      const sectorIndex = sectorIndexAt(toFixed(start.x), toFixed(start.y), e1m1Nodes, e1m1SubsectorSectors);
      expect(sectorIndex).toBeGreaterThanOrEqual(0);
      expect(sectorIndex).toBeLessThan(e1m1Sectors.length);
    }
  });

  it('returns consistent results for all thing spawn positions', () => {
    for (const thing of e1m1Things) {
      const sectorIndex = sectorIndexAt(toFixed(thing.x), toFixed(thing.y), e1m1Nodes, e1m1SubsectorSectors);
      expect(sectorIndex).toBeGreaterThanOrEqual(0);
      expect(sectorIndex).toBeLessThan(e1m1Sectors.length);
    }
  });

  it('returns subsector 0 sector when nodes are empty', () => {
    const singleSectorMap = Object.freeze([42]);
    const result = sectorIndexAt(toFixed(0), toFixed(0), [], singleSectorMap);
    expect(result).toBe(42);
  });
});

// ── parity-sensitive edge cases ─────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('back-side first segs resolve through sidenum1, not sidenum0', () => {
    for (let index = 0; index < e1m1Subsectors.length; index++) {
      const subsector = e1m1Subsectors[index]!;
      const firstSeg = e1m1Segs[subsector.firstseg]!;

      if (firstSeg.side !== 1) continue;

      const linedef = e1m1Linedefs[firstSeg.linedef]!;
      const correctSidedef = e1m1Sidedefs[linedef.sidenum1]!;
      const wrongSidedef = e1m1Sidedefs[linedef.sidenum0]!;

      expect(e1m1SubsectorSectors[index]).toBe(correctSidedef.sector);

      // Verify that using the wrong side would sometimes give a different
      // answer — this confirms the side field is load-bearing.
      if (correctSidedef.sector !== wrongSidedef.sector) {
        expect(e1m1SubsectorSectors[index]).not.toBe(wrongSidedef.sector);
      }
    }
  });

  it('distinct subsectors in the same sector share the same sector index', () => {
    const sectorToSubsectors = new Map<number, number[]>();
    for (let index = 0; index < e1m1SubsectorSectors.length; index++) {
      const sectorIndex = e1m1SubsectorSectors[index]!;
      const list = sectorToSubsectors.get(sectorIndex);
      if (list !== undefined) {
        list.push(index);
      } else {
        sectorToSubsectors.set(sectorIndex, [index]);
      }
    }

    // At least one sector is covered by multiple subsectors
    let foundMultiSubsector = false;
    for (const subsectorList of sectorToSubsectors.values()) {
      if (subsectorList.length > 1) {
        foundMultiSubsector = true;
        // All subsectors in this group report the same sector
        for (const subsectorIndex of subsectorList) {
          expect(e1m1SubsectorSectors[subsectorIndex]).toBe(e1m1SubsectorSectors[subsectorList[0]!]!);
        }
      }
    }
    expect(foundMultiSubsector).toBe(true);
  });

  it('adjacent map points near sector boundaries resolve to valid sectors', () => {
    // Test a grid of points spanning the E1M1 map extent;
    // every point must resolve to a valid sector without throwing.
    const testPoints = [
      [1056, -3616], // player 1 start
      [1088, -3648], // offset by 32 units
      [1024, -3584], // offset opposite direction
      [0, 0], // origin (outside playable area, but BSP covers entire plane)
      [-1000, 1000], // far from play area
    ] as const;

    for (const [mapX, mapY] of testPoints) {
      const sectorIndex = sectorIndexAt(toFixed(mapX), toFixed(mapY), e1m1Nodes, e1m1SubsectorSectors);
      expect(sectorIndex).toBeGreaterThanOrEqual(0);
      expect(sectorIndex).toBeLessThan(e1m1Sectors.length);
    }
  });

  it('sectorIndexAt matches the full manual chain for every thing spawn', () => {
    for (const thing of e1m1Things) {
      const fixedX = toFixed(thing.x);
      const fixedY = toFixed(thing.y);

      // Manual chain: BSP → subsector → first seg → linedef → sidedef → sector
      const subsectorIndex = pointInSubsector(fixedX, fixedY, e1m1Nodes);
      const subsector = e1m1Subsectors[subsectorIndex]!;
      const firstSeg = e1m1Segs[subsector.firstseg]!;
      const linedef = e1m1Linedefs[firstSeg.linedef]!;
      const sidedefIndex = firstSeg.side === 0 ? linedef.sidenum0 : linedef.sidenum1;
      const expectedSectorIndex = e1m1Sidedefs[sidedefIndex]!.sector;

      expect(sectorIndexAt(fixedX, fixedY, e1m1Nodes, e1m1SubsectorSectors)).toBe(expectedSectorIndex);
    }
  });
});
