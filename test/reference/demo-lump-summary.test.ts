import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';

import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';

import summary from '../../reference/manifests/demo-lump-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);

describe('demo-lump-summary.json manifest', () => {
  it('contains exactly 3 demo lumps', () => {
    expect(summary.demos).toHaveLength(3);
  });

  it('names demos DEMO1, DEMO2, DEMO3 in order', () => {
    const names = summary.demos.map((demo) => demo.name);
    expect(names).toEqual(['DEMO1', 'DEMO2', 'DEMO3']);
  });

  it('records demo version 109 matching Doom 1.9', () => {
    expect(summary.format.demoVersion).toBe(109);
    expect(summary.format.versionLabel).toBe('Doom 1.9');
  });

  it('records 35 Hz tic rate matching PRIMARY_TARGET', () => {
    expect(summary.format.ticRate).toBe(PRIMARY_TARGET.ticRateHz);
  });

  it('records a 13-byte header and 4 bytes per tic per player', () => {
    expect(summary.format.headerSize).toBe(13);
    expect(summary.format.bytesPerTicPerPlayer).toBe(4);
  });

  it('records 0x80 (128) as the end marker', () => {
    expect(summary.format.endMarker).toBe(0x80);
  });

  it('assigns consecutive directory indices starting at 3', () => {
    for (let index = 0; index < summary.demos.length; index++) {
      expect(summary.demos[index]!.directoryIndex).toBe(3 + index);
    }
  });

  it('records all demos as single-player on skill 2 (Hurt me plenty)', () => {
    for (const demo of summary.demos) {
      expect(demo.skill).toBe(2);
      expect(demo.deathmatch).toBe(0);
      expect(demo.activePlayers).toBe(1);
      expect(demo.consoleplayer).toBe(0);
    }
  });

  it('records all demos on episode 1', () => {
    for (const demo of summary.demos) {
      expect(demo.episode).toBe(1);
    }
  });

  it('maps demos to E1M5, E1M3, E1M7 respectively', () => {
    expect(summary.demos[0]!.map).toBe(5);
    expect(summary.demos[1]!.map).toBe(3);
    expect(summary.demos[2]!.map).toBe(7);
  });

  it('has no gameplay modifiers set (respawn, fast, nomonsters)', () => {
    for (const demo of summary.demos) {
      expect(demo.respawn).toBe(0);
      expect(demo.fast).toBe(0);
      expect(demo.nomonsters).toBe(0);
    }
  });

  it('marks only player 0 as present', () => {
    for (const demo of summary.demos) {
      expect(demo.playersPresent).toEqual([true, false, false, false]);
    }
  });

  it('has positive tic counts for all demos', () => {
    for (const demo of summary.demos) {
      expect(demo.ticCount).toBeGreaterThan(0);
    }
  });

  it('derives duration from ticCount / ticRate', () => {
    for (const demo of summary.demos) {
      const expected = demo.ticCount / summary.format.ticRate;
      expect(demo.durationSeconds).toBeCloseTo(expected, 5);
    }
  });

  it('records DEMO1 as the longest demo by tic count', () => {
    const longest = summary.demos.reduce((best, demo) => (demo.ticCount > best.ticCount ? demo : best));
    expect(longest.name).toBe('DEMO1');
  });

  it('records DEMO3 as the shortest demo by tic count', () => {
    const shortest = summary.demos.reduce((best, demo) => (demo.ticCount < best.ticCount ? demo : best));
    expect(shortest.name).toBe('DEMO3');
  });

  it('has tic counts consistent with lump size, header, and end marker', () => {
    for (const demo of summary.demos) {
      const payloadBytes = demo.sizeBytes - summary.format.headerSize - 1;
      const expectedTics = payloadBytes / (summary.format.bytesPerTicPerPlayer * demo.activePlayers);
      expect(demo.ticCount).toBe(expectedTics);
    }
  });

  it('records valid uppercase hex SHA-256 hashes', () => {
    for (const demo of summary.demos) {
      expect(demo.sha256).toMatch(/^[0-9A-F]{64}$/);
    }
  });

  it('records unique SHA-256 hashes across demos', () => {
    const hashes = summary.demos.map((demo) => demo.sha256);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('records increasing WAD offsets across demos', () => {
    for (let index = 1; index < summary.demos.length; index++) {
      expect(summary.demos[index]!.offset).toBeGreaterThan(summary.demos[index - 1]!.offset);
    }
  });

  it('matches the DOOM1.WAD demo directory entries and digests exactly', () => {
    for (const demo of summary.demos) {
      const entry = lookup.getEntry(demo.directoryIndex);
      expect(entry.name).toBe(demo.name);
      expect(entry.offset).toBe(demo.offset);
      expect(entry.size).toBe(demo.sizeBytes);

      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const digest = createHash('sha256').update(lump).digest('hex').toUpperCase();
      expect(digest).toBe(demo.sha256);
    }
  });

  it('matches each demo header byte-for-byte against the manifest fields', () => {
    for (const demo of summary.demos) {
      const lump = lookup.getLumpData(demo.name, wadBuffer);
      expect(lump.length).toBe(demo.sizeBytes);
      expect(lump[0]).toBe(summary.format.demoVersion);
      expect(lump[1]).toBe(demo.skill);
      expect(lump[2]).toBe(demo.episode);
      expect(lump[3]).toBe(demo.map);
      expect(lump[4]).toBe(demo.deathmatch);
      expect(lump[5]).toBe(demo.respawn);
      expect(lump[6]).toBe(demo.fast);
      expect(lump[7]).toBe(demo.nomonsters);
      expect(lump[8]).toBe(demo.consoleplayer);
      expect(Array.from(lump.subarray(9, 13), (value) => value === 1)).toEqual(demo.playersPresent);
      expect(lump[lump.length - 1]).toBe(summary.format.endMarker);
    }
  });

  it('has total demo tics summing to 10996', () => {
    const totalTics = summary.demos.reduce((sum, demo) => sum + demo.ticCount, 0);
    expect(totalTics).toBe(5026 + 3836 + 2134);
  });
});
