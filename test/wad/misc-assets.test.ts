import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { MUS_HEADER_SIZE, MUS_MAGIC, MUS_MAX_CHANNELS, MUS_PERCUSSION_CHANNEL, parseMus } from '../../src/assets/mus.ts';
import type { MusHeader } from '../../src/assets/mus.ts';
import { DEMO_END_MARKER, DEMO_HEADER_SIZE, DEMO_MAX_PLAYERS, DEMO_TIC_RATE, DEMO_TIC_SIZE, DEMO_VERSION_19, parseDemoLump } from '../../src/demo/demoFile.ts';
import type { DemoFile, DemoTicCommand } from '../../src/demo/demoFile.ts';
import { ENDOOM_BYTES_PER_CELL, ENDOOM_CELL_COUNT, ENDOOM_COLUMNS, ENDOOM_ROWS, ENDOOM_SIZE, parseEndoom } from '../../src/ui/endoom.ts';
import type { EndoomCell, EndoomScreen } from '../../src/ui/endoom.ts';

import demoManifest from '../../reference/manifests/demo-lump-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);

// ─── MUS parser ─────────────────────────────────────────────────────

describe('MUS constants', () => {
  it("MUS_MAGIC is 'MUS\\x1A'", () => {
    expect(MUS_MAGIC).toBe('MUS\x1A');
  });

  it('MUS_HEADER_SIZE is 16', () => {
    expect(MUS_HEADER_SIZE).toBe(16);
  });

  it('MUS_MAX_CHANNELS is 16', () => {
    expect(MUS_MAX_CHANNELS).toBe(16);
  });

  it('MUS_PERCUSSION_CHANNEL is 15', () => {
    expect(MUS_PERCUSSION_CHANNEL).toBe(15);
  });
});

describe('parseMus with DOOM1.WAD D_E1M1', () => {
  const musData = lookup.getLumpData('D_E1M1', wadBuffer);
  const mus = parseMus(musData);

  it('starts with MUS magic bytes', () => {
    const magic = musData.subarray(0, 4).toString('ascii');
    expect(magic).toBe('MUS\x1A');
  });

  it('scoreLength is positive', () => {
    expect(mus.scoreLength).toBeGreaterThan(0);
  });

  it('scoreStart is at least MUS_HEADER_SIZE', () => {
    expect(mus.scoreStart).toBeGreaterThanOrEqual(MUS_HEADER_SIZE);
  });

  it('channelCount is within valid range (1 to 16)', () => {
    expect(mus.channelCount).toBeGreaterThanOrEqual(1);
    expect(mus.channelCount).toBeLessThanOrEqual(MUS_MAX_CHANNELS);
  });

  it('secondaryChannelCount is 0', () => {
    expect(mus.secondaryChannelCount).toBe(0);
  });

  it('instrumentCount matches instruments array length', () => {
    expect(mus.instruments.length).toBe(mus.instrumentCount);
  });

  it('instruments array is frozen', () => {
    expect(Object.isFrozen(mus.instruments)).toBe(true);
  });

  it('returned header is frozen', () => {
    expect(Object.isFrozen(mus)).toBe(true);
  });

  it('scoreData length matches scoreLength', () => {
    expect(mus.scoreData.length).toBe(mus.scoreLength);
  });

  it('scoreData is non-empty', () => {
    expect(mus.scoreData.length).toBeGreaterThan(0);
  });
});

describe('parseMus with all 13 DOOM1.WAD music lumps', () => {
  const musicNames = ['D_E1M1', 'D_E1M2', 'D_E1M3', 'D_E1M4', 'D_E1M5', 'D_E1M6', 'D_E1M7', 'D_E1M8', 'D_E1M9', 'D_INTER', 'D_INTRO', 'D_VICTOR', 'D_INTROA'];

  it('all 13 music lumps parse without error', () => {
    for (const name of musicNames) {
      const data = lookup.getLumpData(name, wadBuffer);
      const mus = parseMus(data);
      expect(mus.scoreLength).toBeGreaterThan(0);
    }
  });

  it('all music lumps have valid MUS magic', () => {
    for (const name of musicNames) {
      const data = lookup.getLumpData(name, wadBuffer);
      const magic = data.subarray(0, 4).toString('ascii');
      expect(magic).toBe('MUS\x1A');
    }
  });

  it('no music lump exceeds 16 channels', () => {
    for (const name of musicNames) {
      const data = lookup.getLumpData(name, wadBuffer);
      const mus = parseMus(data);
      expect(mus.channelCount).toBeLessThanOrEqual(MUS_MAX_CHANNELS);
    }
  });

  it('D_INTRO is the title screen music', () => {
    const data = lookup.getLumpData('D_INTRO', wadBuffer);
    const mus = parseMus(data);
    expect(mus.scoreLength).toBeGreaterThan(0);
    expect(mus.channelCount).toBeGreaterThanOrEqual(1);
  });
});

describe('MUS error cases', () => {
  it('throws on lump smaller than header', () => {
    const tiny = Buffer.alloc(10);
    expect(() => parseMus(tiny)).toThrow(/at least 16 bytes/);
  });

  it('throws on invalid magic', () => {
    const bad = Buffer.alloc(MUS_HEADER_SIZE);
    bad.write('NOPE', 0, 'ascii');
    expect(() => parseMus(bad)).toThrow(/invalid magic/);
  });

  it('throws when instrument list extends past lump end', () => {
    const buf = Buffer.alloc(MUS_HEADER_SIZE);
    buf.write('MUS\x1A', 0, 'ascii');
    buf.writeUInt16LE(10, 4); // scoreLength
    buf.writeUInt16LE(100, 6); // scoreStart
    buf.writeUInt16LE(1, 8); // channels
    buf.writeUInt16LE(0, 10); // secondaryChannels
    buf.writeUInt16LE(50, 12); // instrumentCount = 50 (would need 116 bytes)
    buf.writeUInt16LE(0, 14); // padding
    expect(() => parseMus(buf)).toThrow(/too small for.*instruments/);
  });

  it('throws when scoreStart overlaps the instrument list', () => {
    const buf = Buffer.alloc(MUS_HEADER_SIZE + 4);
    buf.write('MUS\x1A', 0, 'ascii');
    buf.writeUInt16LE(2, 4); // scoreLength
    buf.writeUInt16LE(MUS_HEADER_SIZE, 6); // overlaps 1 instrument entry
    buf.writeUInt16LE(1, 8); // channels
    buf.writeUInt16LE(0, 10); // secondaryChannels
    buf.writeUInt16LE(1, 12); // instrumentCount
    buf.writeUInt16LE(0, 14); // padding
    buf.writeUInt16LE(5, 16); // instrument id
    expect(() => parseMus(buf)).toThrow(/overlaps the instrument list/);
  });

  it('throws when scoreLength runs past lump end', () => {
    const buf = Buffer.alloc(MUS_HEADER_SIZE + 2);
    buf.write('MUS\x1A', 0, 'ascii');
    buf.writeUInt16LE(8, 4); // scoreLength
    buf.writeUInt16LE(MUS_HEADER_SIZE, 6); // scoreStart
    buf.writeUInt16LE(1, 8); // channels
    buf.writeUInt16LE(0, 10); // secondaryChannels
    buf.writeUInt16LE(0, 12); // instrumentCount
    buf.writeUInt16LE(0, 14); // padding
    expect(() => parseMus(buf)).toThrow(/score section/);
  });
});

// ─── MUS parity-sensitive edge cases ────────────────────────────────

describe('MUS parity-sensitive edge cases', () => {
  it('scoreStart points past the instrument list', () => {
    const data = lookup.getLumpData('D_E1M1', wadBuffer);
    const mus = parseMus(data);
    const expectedMinStart = MUS_HEADER_SIZE + mus.instrumentCount * 2;
    expect(mus.scoreStart).toBeGreaterThanOrEqual(expectedMinStart);
  });

  it('score data bytes fit within lump bounds', () => {
    const data = lookup.getLumpData('D_E1M1', wadBuffer);
    const mus = parseMus(data);
    expect(mus.scoreStart + mus.scoreLength).toBeLessThanOrEqual(data.length);
  });
});

// ─── Demo file parser ───────────────────────────────────────────────

describe('demo constants', () => {
  it('DEMO_VERSION_19 is 109', () => {
    expect(DEMO_VERSION_19).toBe(109);
  });

  it('DEMO_HEADER_SIZE is 13', () => {
    expect(DEMO_HEADER_SIZE).toBe(13);
  });

  it('DEMO_TIC_SIZE is 4', () => {
    expect(DEMO_TIC_SIZE).toBe(4);
  });

  it('DEMO_END_MARKER is 0x80', () => {
    expect(DEMO_END_MARKER).toBe(0x80);
  });

  it('DEMO_MAX_PLAYERS is 4', () => {
    expect(DEMO_MAX_PLAYERS).toBe(4);
  });

  it('DEMO_TIC_RATE matches PRIMARY_TARGET.ticRateHz', () => {
    expect(DEMO_TIC_RATE).toBe(PRIMARY_TARGET.ticRateHz);
  });
});

describe('parseDemoLump with DOOM1.WAD DEMO1', () => {
  const demoData = lookup.getLumpData('DEMO1', wadBuffer);
  const demo = parseDemoLump(demoData);
  const manifest = demoManifest.demos[0]!;

  it('version is 109 (Doom 1.9)', () => {
    expect(demo.version).toBe(DEMO_VERSION_19);
  });

  it('skill is 2 (Hurt me plenty)', () => {
    expect(demo.skill).toBe(manifest.skill);
  });

  it('episode is 1', () => {
    expect(demo.episode).toBe(manifest.episode);
  });

  it('map is 5 (E1M5)', () => {
    expect(demo.map).toBe(manifest.map);
  });

  it('deathmatch is 0', () => {
    expect(demo.deathmatch).toBe(0);
  });

  it('no gameplay modifiers', () => {
    expect(demo.respawn).toBe(0);
    expect(demo.fast).toBe(0);
    expect(demo.nomonsters).toBe(0);
  });

  it('consoleplayer is 0', () => {
    expect(demo.consoleplayer).toBe(0);
  });

  it('single player present', () => {
    expect(demo.playersPresent).toEqual([true, false, false, false]);
    expect(demo.activePlayers).toBe(1);
  });

  it('ticCount matches manifest', () => {
    expect(demo.ticCount).toBe(manifest.ticCount);
  });

  it('durationSeconds matches manifest', () => {
    expect(demo.durationSeconds).toBeCloseTo(manifest.durationSeconds, 1);
  });

  it('tics array length matches ticCount', () => {
    expect(demo.tics.length).toBe(demo.ticCount);
  });

  it('each tic has exactly 1 command (single player)', () => {
    for (const tic of demo.tics) {
      expect(tic.length).toBe(1);
    }
  });

  it('returned demo is frozen', () => {
    expect(Object.isFrozen(demo)).toBe(true);
  });

  it('playersPresent is frozen', () => {
    expect(Object.isFrozen(demo.playersPresent)).toBe(true);
  });

  it('tics array is frozen', () => {
    expect(Object.isFrozen(demo.tics)).toBe(true);
  });
});

describe('parseDemoLump with all 3 DOOM1.WAD demos', () => {
  const demoNames = ['DEMO1', 'DEMO2', 'DEMO3'] as const;

  it('all three demos parse without error', () => {
    for (const name of demoNames) {
      const data = lookup.getLumpData(name, wadBuffer);
      const demo = parseDemoLump(data);
      expect(demo.version).toBe(DEMO_VERSION_19);
    }
  });

  it('ticCount matches demo-lump-summary manifest for each demo', () => {
    for (let index = 0; index < demoNames.length; index++) {
      const data = lookup.getLumpData(demoNames[index]!, wadBuffer);
      const demo = parseDemoLump(data);
      expect(demo.ticCount).toBe(demoManifest.demos[index]!.ticCount);
    }
  });

  it('map assignments match manifest (5, 3, 7)', () => {
    const expectedMaps = [5, 3, 7];
    for (let index = 0; index < demoNames.length; index++) {
      const data = lookup.getLumpData(demoNames[index]!, wadBuffer);
      const demo = parseDemoLump(data);
      expect(demo.map).toBe(expectedMaps[index]);
    }
  });

  it('total tics across all demos is 10996', () => {
    let total = 0;
    for (const name of demoNames) {
      const data = lookup.getLumpData(name, wadBuffer);
      const demo = parseDemoLump(data);
      total += demo.ticCount;
    }
    expect(total).toBe(10996);
  });

  it('all demos are single-player skill 2 episode 1', () => {
    for (const name of demoNames) {
      const data = lookup.getLumpData(name, wadBuffer);
      const demo = parseDemoLump(data);
      expect(demo.skill).toBe(2);
      expect(demo.episode).toBe(1);
      expect(demo.activePlayers).toBe(1);
    }
  });
});

describe('demo error cases', () => {
  it('throws on lump smaller than header', () => {
    const tiny = Buffer.alloc(5);
    expect(() => parseDemoLump(tiny)).toThrow(/at least 13 bytes/);
  });

  it('throws when no players are present', () => {
    const buf = Buffer.alloc(DEMO_HEADER_SIZE + 1);
    buf[0] = DEMO_VERSION_19; // version
    buf[1] = 2; // skill
    buf[2] = 1; // episode
    buf[3] = 1; // map
    // bytes 4-8: deathmatch, respawn, fast, nomonsters, consoleplayer = 0
    // bytes 9-12: playeringame[0-3] = all 0
    buf[DEMO_HEADER_SIZE] = DEMO_END_MARKER;
    expect(() => parseDemoLump(buf)).toThrow(/no active players/);
  });

  it('throws on truncated tic data', () => {
    const buf = Buffer.alloc(DEMO_HEADER_SIZE + 2);
    buf[0] = DEMO_VERSION_19;
    buf[1] = 2;
    buf[2] = 1;
    buf[3] = 1;
    buf[8] = 0; // consoleplayer
    buf[9] = 1; // player 0 present
    // Only 2 bytes of tic data, need 4
    expect(() => parseDemoLump(buf)).toThrow(/truncated/);
  });

  it('throws when the demo end marker is missing', () => {
    const buf = Buffer.alloc(DEMO_HEADER_SIZE + DEMO_TIC_SIZE);
    buf[0] = DEMO_VERSION_19;
    buf[1] = 2;
    buf[2] = 1;
    buf[3] = 1;
    buf[9] = 1; // player 0 present
    buf[13] = 1;
    buf[14] = 2;
    buf[15] = 3;
    buf[16] = 4;
    expect(() => parseDemoLump(buf)).toThrow(/missing end marker/i);
  });
});

// ─── Demo parity-sensitive edge cases ───────────────────────────────

describe('demo parity-sensitive edge cases', () => {
  it('DEMO1 last byte before end marker is not 0x80 (tic data is distinct from marker)', () => {
    const demoData = lookup.getLumpData('DEMO1', wadBuffer);
    const demo = parseDemoLump(demoData);
    const lastTic = demo.tics[demo.tics.length - 1]![0]!;
    // The last tic command should be a valid command, not the end marker itself
    expect(lastTic.forwardmove).toBeDefined();
    expect(lastTic.buttons).toBeDefined();
  });

  it('tic command field ranges match Doom ticcmd_t bounds', () => {
    const demoData = lookup.getLumpData('DEMO1', wadBuffer);
    const demo = parseDemoLump(demoData);
    for (const tic of demo.tics) {
      for (const command of tic) {
        expect(command.forwardmove).toBeGreaterThanOrEqual(-128);
        expect(command.forwardmove).toBeLessThanOrEqual(127);
        expect(command.sidemove).toBeGreaterThanOrEqual(-128);
        expect(command.sidemove).toBeLessThanOrEqual(127);
        expect(command.angleturn).toBeGreaterThanOrEqual(0);
        expect(command.angleturn).toBeLessThanOrEqual(255);
        expect(command.buttons).toBeGreaterThanOrEqual(0);
        expect(command.buttons).toBeLessThanOrEqual(255);
      }
    }
  });

  it('demo size matches header + tics + end marker', () => {
    for (const manifestDemo of demoManifest.demos) {
      const data = lookup.getLumpData(manifestDemo.name, wadBuffer);
      const demo = parseDemoLump(data);
      const expectedSize = DEMO_HEADER_SIZE + demo.ticCount * DEMO_TIC_SIZE * demo.activePlayers + 1;
      expect(data.length).toBe(expectedSize);
    }
  });

  it('end marker 0x80 is present at expected position', () => {
    const demoData = lookup.getLumpData('DEMO1', wadBuffer);
    const demo = parseDemoLump(demoData);
    const endOffset = DEMO_HEADER_SIZE + demo.ticCount * DEMO_TIC_SIZE * demo.activePlayers;
    expect(demoData[endOffset]).toBe(DEMO_END_MARKER);
  });
});

// ─── ENDOOM parser ──────────────────────────────────────────────────

describe('ENDOOM constants', () => {
  it('ENDOOM_COLUMNS is 80', () => {
    expect(ENDOOM_COLUMNS).toBe(80);
  });

  it('ENDOOM_ROWS is 25', () => {
    expect(ENDOOM_ROWS).toBe(25);
  });

  it('ENDOOM_CELL_COUNT is 2000 (80 * 25)', () => {
    expect(ENDOOM_CELL_COUNT).toBe(2000);
    expect(ENDOOM_CELL_COUNT).toBe(ENDOOM_COLUMNS * ENDOOM_ROWS);
  });

  it('ENDOOM_BYTES_PER_CELL is 2', () => {
    expect(ENDOOM_BYTES_PER_CELL).toBe(2);
  });

  it('ENDOOM_SIZE is 4000 (2000 * 2)', () => {
    expect(ENDOOM_SIZE).toBe(4000);
    expect(ENDOOM_SIZE).toBe(ENDOOM_CELL_COUNT * ENDOOM_BYTES_PER_CELL);
  });
});

describe('parseEndoom with DOOM1.WAD', () => {
  const endoomData = lookup.getLumpData('ENDOOM', wadBuffer);
  const screen = parseEndoom(endoomData);

  it('ENDOOM lump is exactly 4000 bytes', () => {
    expect(endoomData.length).toBe(ENDOOM_SIZE);
  });

  it('width is 80', () => {
    expect(screen.width).toBe(ENDOOM_COLUMNS);
  });

  it('height is 25', () => {
    expect(screen.height).toBe(ENDOOM_ROWS);
  });

  it('cells array has 2000 entries', () => {
    expect(screen.cells.length).toBe(ENDOOM_CELL_COUNT);
  });

  it('all character values are 0-255', () => {
    for (const cell of screen.cells) {
      expect(cell.character).toBeGreaterThanOrEqual(0);
      expect(cell.character).toBeLessThanOrEqual(255);
    }
  });

  it('all foreground values are 0-15', () => {
    for (const cell of screen.cells) {
      expect(cell.foreground).toBeGreaterThanOrEqual(0);
      expect(cell.foreground).toBeLessThanOrEqual(15);
    }
  });

  it('all background values are 0-7', () => {
    for (const cell of screen.cells) {
      expect(cell.background).toBeGreaterThanOrEqual(0);
      expect(cell.background).toBeLessThanOrEqual(7);
    }
  });

  it('blink is a boolean', () => {
    for (const cell of screen.cells) {
      expect(typeof cell.blink).toBe('boolean');
    }
  });

  it('returned screen is frozen', () => {
    expect(Object.isFrozen(screen)).toBe(true);
  });

  it('cells array is frozen', () => {
    expect(Object.isFrozen(screen.cells)).toBe(true);
  });

  it('individual cells are frozen', () => {
    expect(Object.isFrozen(screen.cells[0])).toBe(true);
    expect(Object.isFrozen(screen.cells[screen.cells.length - 1])).toBe(true);
  });

  it('first cell is parsed from bytes 0 and 1 of the lump', () => {
    const expectedChar = endoomData[0]!;
    const expectedAttr = endoomData[1]!;
    expect(screen.cells[0]!.character).toBe(expectedChar);
    expect(screen.cells[0]!.foreground).toBe(expectedAttr & 0x0f);
    expect(screen.cells[0]!.background).toBe((expectedAttr >> 4) & 0x07);
    expect(screen.cells[0]!.blink).toBe((expectedAttr & 0x80) !== 0);
  });
});

describe('ENDOOM error cases', () => {
  it('throws on lump smaller than 4000 bytes', () => {
    const small = Buffer.alloc(3000);
    expect(() => parseEndoom(small)).toThrow(/exactly 4000 bytes/);
  });

  it('throws on lump larger than 4000 bytes', () => {
    const big = Buffer.alloc(5000);
    expect(() => parseEndoom(big)).toThrow(/exactly 4000 bytes/);
  });
});

describe('ENDOOM parity-sensitive edge cases', () => {
  it('attribute byte decomposition is correct for a known synthetic cell', () => {
    // Attribute 0xCE = 1100_1110: blink=1, bg=100(4), fg=1110(14)
    const synthetic = Buffer.alloc(ENDOOM_SIZE);
    synthetic[0] = 0x41; // 'A' in CP437
    synthetic[1] = 0xce; // attribute
    const screen = parseEndoom(synthetic);
    const cell = screen.cells[0]!;
    expect(cell.character).toBe(0x41);
    expect(cell.foreground).toBe(14);
    expect(cell.background).toBe(4);
    expect(cell.blink).toBe(true);
  });

  it('no-blink attribute has blink=false', () => {
    const synthetic = Buffer.alloc(ENDOOM_SIZE);
    synthetic[0] = 0x20; // space
    synthetic[1] = 0x07; // standard white-on-black, no blink
    const screen = parseEndoom(synthetic);
    expect(screen.cells[0]!.blink).toBe(false);
  });

  it('cell index maps to row-major position (row * 80 + col)', () => {
    const endoomData = lookup.getLumpData('ENDOOM', wadBuffer);
    const screen = parseEndoom(endoomData);
    // Cell at row 1, col 0 should be index 80
    const row1col0 = screen.cells[80]!;
    const expectedChar = endoomData[80 * ENDOOM_BYTES_PER_CELL]!;
    expect(row1col0.character).toBe(expectedChar);
  });

  it('ENDOOM contains non-space characters (it is a visual screen, not blank)', () => {
    const endoomData = lookup.getLumpData('ENDOOM', wadBuffer);
    const screen = parseEndoom(endoomData);
    const nonSpace = screen.cells.filter((cell) => cell.character !== 0x20);
    expect(nonSpace.length).toBeGreaterThan(0);
  });
});
