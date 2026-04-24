import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle } from '../../src/map/mapBundle.ts';
import { MAPTHING_SIZE, MTF_AMBUSH, MTF_EASY, MTF_HARD, MTF_NORMAL, MTF_NOT_SINGLE, parseThings } from '../../src/map/things.ts';
import type { MapThing } from '../../src/map/things.ts';

import wadMapSummary from '../../reference/manifests/wad-map-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Things = parseThings(e1m1Bundle.things);

describe('MAPTHING_SIZE constant', () => {
  it('equals 10', () => {
    expect(MAPTHING_SIZE).toBe(10);
  });
});

describe('MTF flag constants', () => {
  it('MTF_EASY is 1', () => {
    expect(MTF_EASY).toBe(1);
  });

  it('MTF_NORMAL is 2', () => {
    expect(MTF_NORMAL).toBe(2);
  });

  it('MTF_HARD is 4', () => {
    expect(MTF_HARD).toBe(4);
  });

  it('MTF_AMBUSH is 8', () => {
    expect(MTF_AMBUSH).toBe(8);
  });

  it('MTF_NOT_SINGLE is 16', () => {
    expect(MTF_NOT_SINGLE).toBe(16);
  });

  it('flags are distinct powers of two', () => {
    const flags = [MTF_EASY, MTF_NORMAL, MTF_HARD, MTF_AMBUSH, MTF_NOT_SINGLE];
    for (const flag of flags) {
      expect(flag & (flag - 1)).toBe(0);
    }
    const combined = flags.reduce((a, b) => a | b, 0);
    expect(combined).toBe(0x1f);
  });
});

describe('parseThings with E1M1', () => {
  it('returns 138 things (1380 / 10)', () => {
    expect(e1m1Things.length).toBe(138);
  });

  it('count matches wad-map-summary.json', () => {
    const e1m1Summary = wadMapSummary.maps.find((m: { name: string }) => m.name === 'E1M1')!;
    const thingsLump = e1m1Summary.lumps.find((l: { name: string }) => l.name === 'THINGS')!;
    expect(e1m1Things.length).toBe(thingsLump.size / MAPTHING_SIZE);
  });

  it('first entry is the player 1 start', () => {
    const first = e1m1Things[0]!;
    expect(first.type).toBe(1);
    expect(first.x).toBe(1056);
    expect(first.y).toBe(-3616);
    expect(first.angle).toBe(90);
    expect(first.options).toBe(MTF_EASY | MTF_NORMAL | MTF_HARD);
  });

  it('contains exactly one player 1 start', () => {
    const player1Starts = e1m1Things.filter((t) => t.type === 1);
    expect(player1Starts.length).toBe(1);
  });

  it('contains all four player starts', () => {
    for (const playerType of [1, 2, 3, 4]) {
      const starts = e1m1Things.filter((t) => t.type === playerType);
      expect(starts.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains deathmatch starts (type 11)', () => {
    const deathmatchStarts = e1m1Things.filter((t) => t.type === 11);
    expect(deathmatchStarts.length).toBeGreaterThan(0);
  });

  it('has 30 unique thing types', () => {
    const types = new Set(e1m1Things.map((t) => t.type));
    expect(types.size).toBe(30);
  });

  it('all thing types are non-negative', () => {
    for (const thing of e1m1Things) {
      expect(thing.type).toBeGreaterThanOrEqual(0);
    }
  });

  it('x and y are within signed 16-bit range', () => {
    for (const thing of e1m1Things) {
      expect(thing.x).toBeGreaterThanOrEqual(-0x8000);
      expect(thing.x).toBeLessThanOrEqual(0x7fff);
      expect(thing.y).toBeGreaterThanOrEqual(-0x8000);
      expect(thing.y).toBeLessThanOrEqual(0x7fff);
    }
  });

  it('angles are valid degree values', () => {
    for (const thing of e1m1Things) {
      expect(thing.angle).toBeGreaterThanOrEqual(0);
      expect(thing.angle).toBeLessThan(360);
    }
  });

  it('options use only the defined MTF bits', () => {
    const allFlags = MTF_EASY | MTF_NORMAL | MTF_HARD | MTF_AMBUSH | MTF_NOT_SINGLE;
    for (const thing of e1m1Things) {
      expect(thing.options & ~allFlags).toBe(0);
    }
  });

  it('has 14 multiplayer-only things', () => {
    const multiplayerOnly = e1m1Things.filter((t) => (t.options & MTF_NOT_SINGLE) !== 0);
    expect(multiplayerOnly.length).toBe(14);
  });

  it('result array is frozen', () => {
    expect(Object.isFrozen(e1m1Things)).toBe(true);
  });

  it('individual entries are frozen', () => {
    for (const thing of e1m1Things) {
      expect(Object.isFrozen(thing)).toBe(true);
    }
  });

  it('last entry has expected values', () => {
    const last = e1m1Things[e1m1Things.length - 1]!;
    expect(last.x).toBe(3648);
    expect(last.y).toBe(-3840);
    expect(last.angle).toBe(0);
    expect(last.type).toBe(2015);
    expect(last.options).toBe(MTF_EASY | MTF_NORMAL | MTF_HARD);
  });
});

describe('parseThings with all 9 maps', () => {
  const mapNames = ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'] as const;

  it('every map parses without error', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const things = parseThings(bundle.things);
      expect(things.length).toBeGreaterThan(0);
    }
  });

  it('thing counts match wad-map-summary.json sizes', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const things = parseThings(bundle.things);
      const summary = wadMapSummary.maps.find((m: { name: string }) => m.name === mapName)!;
      const thingsLump = summary.lumps.find((l: { name: string }) => l.name === 'THINGS')!;
      expect(things.length).toBe(thingsLump.size / MAPTHING_SIZE);
    }
  });

  it('every map has exactly one player 1 start', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const things = parseThings(bundle.things);
      const player1 = things.filter((t) => t.type === 1);
      expect(player1.length).toBe(1);
    }
  });

  it('E1M8 has the fewest things (126)', () => {
    const bundle = parseMapBundle(directory, wadBuffer, 'E1M8');
    const things = parseThings(bundle.things);
    expect(things.length).toBe(126);

    for (const mapName of mapNames) {
      if (mapName === 'E1M8') continue;
      const otherBundle = parseMapBundle(directory, wadBuffer, mapName);
      const otherThings = parseThings(otherBundle.things);
      expect(otherThings.length).toBeGreaterThan(126);
    }
  });

  it('E1M6 has the most things (463)', () => {
    const bundle = parseMapBundle(directory, wadBuffer, 'E1M6');
    const things = parseThings(bundle.things);
    expect(things.length).toBe(463);
  });

  it('total things across all maps is 2511', () => {
    let total = 0;
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const things = parseThings(bundle.things);
      total += things.length;
    }
    expect(total).toBe(2511);
  });
});

describe('error handling', () => {
  it('throws RangeError on non-multiple-of-10 size', () => {
    const badBuffer = Buffer.alloc(13);
    expect(() => parseThings(badBuffer)).toThrow(RangeError);
  });

  it('error message includes the bad size', () => {
    const badBuffer = Buffer.alloc(7);
    expect(() => parseThings(badBuffer)).toThrow('7');
  });

  it('returns empty frozen array for zero-length buffer', () => {
    const empty = parseThings(Buffer.alloc(0));
    expect(empty.length).toBe(0);
    expect(Object.isFrozen(empty)).toBe(true);
  });

  it('accepts Uint8Array input via Buffer.from', () => {
    const raw = new Uint8Array(MAPTHING_SIZE);
    raw[0] = 0x20;
    raw[1] = 0x04;
    const things = parseThings(Buffer.from(raw));
    expect(things.length).toBe(1);
    expect(things[0]!.x).toBe(0x0420);
  });
});

describe('parity-sensitive edge cases', () => {
  it('all five fields are signed int16 (matching C short)', () => {
    const buf = Buffer.alloc(MAPTHING_SIZE);
    buf.writeInt16LE(-100, 0);
    buf.writeInt16LE(-200, 2);
    buf.writeInt16LE(270, 4);
    buf.writeInt16LE(3001, 6);
    buf.writeInt16LE(7, 8);
    const things = parseThings(buf);
    expect(things[0]!.x).toBe(-100);
    expect(things[0]!.y).toBe(-200);
    expect(things[0]!.angle).toBe(270);
    expect(things[0]!.type).toBe(3001);
    expect(things[0]!.options).toBe(7);
  });

  it('E1M1 has negative y on all things', () => {
    const negativeY = e1m1Things.filter((t) => t.y < 0);
    expect(negativeY.length).toBe(e1m1Things.length);
  });

  it('E1M1 has 6 things with negative x', () => {
    const negativeX = e1m1Things.filter((t) => t.x < 0);
    expect(negativeX.length).toBe(6);
  });

  it('E1M8 player 1 start has negative coordinates', () => {
    const bundle = parseMapBundle(directory, wadBuffer, 'E1M8');
    const things = parseThings(bundle.things);
    const player1 = things.find((t) => t.type === 1)!;
    expect(player1.x).toBe(-128);
    expect(player1.y).toBe(-224);
  });

  it('player starts have all-skill flags (options = 7)', () => {
    const playerStarts = e1m1Things.filter((t) => t.type >= 1 && t.type <= 4);
    for (const start of playerStarts) {
      expect(start.options & (MTF_EASY | MTF_NORMAL | MTF_HARD)).toBe(MTF_EASY | MTF_NORMAL | MTF_HARD);
    }
  });

  it('deathmatch starts have all-skill flags like player starts', () => {
    const deathmatch = e1m1Things.filter((t) => t.type === 11);
    expect(deathmatch.length).toBe(5);
    for (const dm of deathmatch) {
      expect(dm.options & (MTF_EASY | MTF_NORMAL | MTF_HARD)).toBe(MTF_EASY | MTF_NORMAL | MTF_HARD);
    }
  });

  it('no thing types are negative across any map', () => {
    const mapNames = ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'];
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const things = parseThings(bundle.things);
      for (const thing of things) {
        expect(thing.type).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('MAPTHING_SIZE matches 5 int16 fields', () => {
    expect(MAPTHING_SIZE).toBe(5 * 2);
  });

  it('compile-time MapThing interface has all five fields', () => {
    const thing: MapThing = {
      x: 0,
      y: 0,
      angle: 0,
      type: 0,
      options: 0,
    };
    expect(Object.keys(thing).length).toBe(5);
  });
});
