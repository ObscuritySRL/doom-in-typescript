import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle, findMapNames } from '../../src/map/mapBundle.ts';
import { parseVertexes, parseLinedefs } from '../../src/map/lineSectorGeometry.ts';
import { MAPSEG_SIZE, MAPSUBSECTOR_SIZE, MAPNODE_SIZE, NF_SUBSECTOR, parseSegs, parseSubsectors, parseNodes } from '../../src/map/bspStructs.ts';
import type { MapNode, MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';

import wadMapSummary from '../../reference/manifests/wad-map-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);
const e1m1Linedefs = parseLinedefs(e1m1Bundle.linedefs, e1m1Vertexes);
const e1m1Segs = parseSegs(e1m1Bundle.segs);
const e1m1Subsectors = parseSubsectors(e1m1Bundle.ssectors);
const e1m1Nodes = parseNodes(e1m1Bundle.nodes);

describe('struct size constants', () => {
  it('MAPSEG_SIZE is 12', () => {
    expect(MAPSEG_SIZE).toBe(12);
  });

  it('MAPSUBSECTOR_SIZE is 4', () => {
    expect(MAPSUBSECTOR_SIZE).toBe(4);
  });

  it('MAPNODE_SIZE is 28', () => {
    expect(MAPNODE_SIZE).toBe(28);
  });
});

describe('NF_SUBSECTOR constant', () => {
  it('NF_SUBSECTOR is 0x8000', () => {
    expect(NF_SUBSECTOR).toBe(0x8000);
  });

  it('NF_SUBSECTOR is bit 15', () => {
    expect(NF_SUBSECTOR).toBe(1 << 15);
  });
});

describe('parseSegs with E1M1', () => {
  it('parses 732 segs', () => {
    expect(e1m1Segs.length).toBe(732);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const segLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'SEGS')!;
    expect(e1m1Segs.length).toBe(segLump.size / MAPSEG_SIZE);
  });

  it('vertex indices are within range', () => {
    for (const seg of e1m1Segs) {
      expect(seg.v1).toBeGreaterThanOrEqual(0);
      expect(seg.v1).toBeLessThan(e1m1Vertexes.length);
      expect(seg.v2).toBeGreaterThanOrEqual(0);
      expect(seg.v2).toBeLessThan(e1m1Vertexes.length);
    }
  });

  it('linedef indices are within range', () => {
    for (const seg of e1m1Segs) {
      expect(seg.linedef).toBeGreaterThanOrEqual(0);
      expect(seg.linedef).toBeLessThan(e1m1Linedefs.length);
    }
  });

  it('side is 0 or 1', () => {
    for (const seg of e1m1Segs) {
      expect(seg.side === 0 || seg.side === 1).toBe(true);
    }
  });

  it('angle lower 16 bits are zero (BAM left-shifted from int16)', () => {
    for (const seg of e1m1Segs) {
      expect(seg.angle & 0xffff).toBe(0);
    }
  });

  it('offset is 16.16 fixed-point (lower 16 bits zero)', () => {
    for (const seg of e1m1Segs) {
      expect(seg.offset & 0xffff).toBe(0);
    }
  });

  it('returns frozen array of frozen entries', () => {
    expect(Object.isFrozen(e1m1Segs)).toBe(true);
    expect(Object.isFrozen(e1m1Segs[0])).toBe(true);
  });
});

describe('parseSubsectors with E1M1', () => {
  it('parses 237 subsectors', () => {
    expect(e1m1Subsectors.length).toBe(237);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const ssectorLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'SSECTORS')!;
    expect(e1m1Subsectors.length).toBe(ssectorLump.size / MAPSUBSECTOR_SIZE);
  });

  it('all subsectors have at least one seg', () => {
    for (const subsector of e1m1Subsectors) {
      expect(subsector.numsegs).toBeGreaterThanOrEqual(1);
    }
  });

  it('firstseg is non-negative', () => {
    for (const subsector of e1m1Subsectors) {
      expect(subsector.firstseg).toBeGreaterThanOrEqual(0);
    }
  });

  it('all seg ranges are within bounds', () => {
    for (const subsector of e1m1Subsectors) {
      expect(subsector.firstseg + subsector.numsegs).toBeLessThanOrEqual(e1m1Segs.length);
    }
  });

  it('total segs across all subsectors equals seg count', () => {
    let totalSegs = 0;
    for (const subsector of e1m1Subsectors) {
      totalSegs += subsector.numsegs;
    }
    expect(totalSegs).toBe(e1m1Segs.length);
  });

  it('returns frozen array of frozen entries', () => {
    expect(Object.isFrozen(e1m1Subsectors)).toBe(true);
    expect(Object.isFrozen(e1m1Subsectors[0])).toBe(true);
  });
});

describe('parseNodes with E1M1', () => {
  it('parses 236 nodes', () => {
    expect(e1m1Nodes.length).toBe(236);
  });

  it('count matches wad-map-summary cross-reference', () => {
    const e1m1Summary = wadMapSummary.maps[0]!;
    const nodeLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'NODES')!;
    expect(e1m1Nodes.length).toBe(nodeLump.size / MAPNODE_SIZE);
  });

  it('node count equals subsector count minus one (BSP tree invariant)', () => {
    expect(e1m1Nodes.length).toBe(e1m1Subsectors.length - 1);
  });

  it('partition coordinates are 16.16 fixed-point', () => {
    for (const node of e1m1Nodes) {
      expect(node.x & 0xffff).toBe(0);
      expect(node.y & 0xffff).toBe(0);
      expect(node.dx & 0xffff).toBe(0);
      expect(node.dy & 0xffff).toBe(0);
    }
  });

  it('bounding box values are 16.16 fixed-point', () => {
    for (const node of e1m1Nodes) {
      for (let side = 0; side < 2; side++) {
        for (let edge = 0; edge < 4; edge++) {
          expect(node.bbox[side]![edge]! & 0xffff).toBe(0);
        }
      }
    }
  });

  it('children are valid node or subsector references', () => {
    for (const node of e1m1Nodes) {
      for (let side = 0; side < 2; side++) {
        const child = node.children[side]!;
        if (child & NF_SUBSECTOR) {
          const subsectorIndex = child & ~NF_SUBSECTOR;
          expect(subsectorIndex).toBeLessThan(e1m1Subsectors.length);
        } else {
          expect(child).toBeLessThan(e1m1Nodes.length);
        }
      }
    }
  });

  it('bbox has two children each with four edges', () => {
    for (const node of e1m1Nodes) {
      expect(node.bbox.length).toBe(2);
      expect(node.bbox[0]!.length).toBe(4);
      expect(node.bbox[1]!.length).toBe(4);
    }
  });

  it('children tuple has two entries', () => {
    for (const node of e1m1Nodes) {
      expect(node.children.length).toBe(2);
    }
  });

  it('at least some children reference subsectors', () => {
    let subsectorCount = 0;
    for (const node of e1m1Nodes) {
      for (let side = 0; side < 2; side++) {
        if (node.children[side]! & NF_SUBSECTOR) {
          subsectorCount++;
        }
      }
    }
    expect(subsectorCount).toBeGreaterThan(0);
  });

  it('returns frozen array with frozen entries, children, and bboxes', () => {
    expect(Object.isFrozen(e1m1Nodes)).toBe(true);
    const firstNode = e1m1Nodes[0]!;
    expect(Object.isFrozen(firstNode)).toBe(true);
    expect(Object.isFrozen(firstNode.bbox)).toBe(true);
    expect(Object.isFrozen(firstNode.bbox[0])).toBe(true);
    expect(Object.isFrozen(firstNode.bbox[1])).toBe(true);
    expect(Object.isFrozen(firstNode.children)).toBe(true);
  });
});

describe('all 9 shareware maps', () => {
  const mapNames = findMapNames(directory);

  it('all maps parse segs, subsectors, and nodes without error', () => {
    for (const name of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const segs = parseSegs(bundle.segs);
      const subsectors = parseSubsectors(bundle.ssectors);
      const nodes = parseNodes(bundle.nodes);
      expect(segs.length).toBeGreaterThan(0);
      expect(subsectors.length).toBeGreaterThan(0);
      expect(nodes.length).toBeGreaterThan(0);
    }
  });

  it('BSP tree invariant holds for all maps (nodes = subsectors - 1)', () => {
    for (const name of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const subsectors = parseSubsectors(bundle.ssectors);
      const nodes = parseNodes(bundle.nodes);
      expect(nodes.length).toBe(subsectors.length - 1);
    }
  });
});

describe('error handling', () => {
  it('parseSegs rejects non-multiple-of-12 buffer', () => {
    expect(() => parseSegs(Buffer.alloc(13))).toThrow(RangeError);
  });

  it('parseSubsectors rejects non-multiple-of-4 buffer', () => {
    expect(() => parseSubsectors(Buffer.alloc(5))).toThrow(RangeError);
  });

  it('parseNodes rejects non-multiple-of-28 buffer', () => {
    expect(() => parseNodes(Buffer.alloc(29))).toThrow(RangeError);
  });

  it('parseSegs accepts empty buffer', () => {
    expect(parseSegs(Buffer.alloc(0)).length).toBe(0);
  });

  it('parseSubsectors accepts empty buffer', () => {
    expect(parseSubsectors(Buffer.alloc(0)).length).toBe(0);
  });

  it('parseNodes accepts empty buffer', () => {
    expect(parseNodes(Buffer.alloc(0)).length).toBe(0);
  });
});

describe('parity-sensitive edge cases', () => {
  it('NF_SUBSECTOR masking extracts correct subsector index', () => {
    const encoded = NF_SUBSECTOR | 5;
    expect(encoded & NF_SUBSECTOR).toBe(NF_SUBSECTOR);
    expect(encoded & ~NF_SUBSECTOR).toBe(5);
  });

  it('seg angle sign extension produces correct BAM for southward direction', () => {
    const buffer = Buffer.alloc(MAPSEG_SIZE);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(1, 2);
    buffer.writeInt16LE(-0x4000, 4);
    buffer.writeInt16LE(0, 6);
    buffer.writeInt16LE(0, 8);
    buffer.writeInt16LE(0, 10);
    const [seg] = parseSegs(buffer);
    expect(seg!.angle).toBe((-0x4000 << 16) | 0);
    expect(seg!.angle & 0xffff).toBe(0);
  });

  it('seg offset sign extension preserves negative fixed-point offset', () => {
    const buffer = Buffer.alloc(MAPSEG_SIZE);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(1, 2);
    buffer.writeInt16LE(0, 4);
    buffer.writeInt16LE(0, 6);
    buffer.writeInt16LE(0, 8);
    buffer.writeInt16LE(-10, 10);
    const [seg] = parseSegs(buffer);
    expect(seg!.offset).toBe((-10 << FRACBITS) | 0);
    expect(seg!.offset).toBeLessThan(0);
  });

  it('node bbox top >= bottom and right >= left for all E1M1 nodes', () => {
    for (const node of e1m1Nodes) {
      for (let side = 0; side < 2; side++) {
        expect(node.bbox[side]![0]!).toBeGreaterThanOrEqual(node.bbox[side]![1]!);
        expect(node.bbox[side]![3]!).toBeGreaterThanOrEqual(node.bbox[side]![2]!);
      }
    }
  });
});
