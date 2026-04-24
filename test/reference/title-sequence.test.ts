import { describe, expect, it } from 'bun:test';

import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import demoSummary from '../../reference/manifests/demo-lump-summary.json';
import sequence from '../../reference/manifests/title-sequence.json';

const REFERENCE_WAD_PATH = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;

describe('title-sequence.json manifest', () => {
  const pages = sequence.states.filter((state) => state.type === 'page');
  const demos = sequence.states.filter((state) => state.type === 'demo');

  it('has exactly 6 states in the cycle', () => {
    expect(sequence.states).toHaveLength(6);
    expect(sequence.cycleLength).toBe(6);
  });

  it('alternates page and demo states', () => {
    for (let index = 0; index < sequence.states.length; index++) {
      const expected = index % 2 === 0 ? 'page' : 'demo';
      expect(sequence.states[index]!.type).toBe(expected);
    }
  });

  it('has sequential zero-based indices', () => {
    for (let index = 0; index < sequence.states.length; index++) {
      expect(sequence.states[index]!.index).toBe(index);
    }
  });

  it('uses shareware game mode', () => {
    expect(sequence.gameMode).toBe('shareware');
  });

  it('cross-references ticRate with PRIMARY_TARGET', () => {
    expect(sequence.ticRate).toBe(PRIMARY_TARGET.ticRateHz);
    expect(sequence.ticRate).toBe(35);
  });

  it('records TITLEPIC at index 0 with pagetic 170', () => {
    const title = sequence.states[0]!;
    expect(title.type).toBe('page');
    expect(title.lumpName).toBe('TITLEPIC');
    expect(title.durationTics).toBe(170);
  });

  it('records CREDIT at index 2 with pagetic 200', () => {
    const credit = sequence.states[2]!;
    expect(credit.type).toBe('page');
    expect(credit.lumpName).toBe('CREDIT');
    expect(credit.durationTics).toBe(200);
  });

  it('records HELP2 at index 4 for shareware (not CREDIT as in retail)', () => {
    const help = sequence.states[4]!;
    expect(help.type).toBe('page');
    expect(help.lumpName).toBe('HELP2');
    expect(help.durationTics).toBe(200);
  });

  it('records DEMO1-3 lump names in order', () => {
    expect(demos[0]!.demoLump).toBe('DEMO1');
    expect(demos[1]!.demoLump).toBe('DEMO2');
    expect(demos[2]!.demoLump).toBe('DEMO3');
  });

  it('cross-references demo maps with demo-lump-summary', () => {
    for (const demoState of demos) {
      const summaryEntry = demoSummary.demos.find((demo) => demo.name === demoState.demoLump);
      expect(summaryEntry).toBeDefined();
      expect(demoState.episode).toBe(summaryEntry!.episode);
      expect(demoState.map).toBe(summaryEntry!.map);
      expect(demoState.durationTics).toBe(summaryEntry!.ticCount);
    }
  });

  it('derives durationSeconds from durationTics / ticRate', () => {
    for (const state of sequence.states) {
      const expected = state.durationTics / sequence.ticRate;
      expect(state.durationSeconds).toBeCloseTo(expected, 10);
    }
  });

  it('sums state tics to totalCycleTics', () => {
    const sum = sequence.states.reduce((total, state) => total + state.durationTics, 0);
    expect(sum).toBe(sequence.totalCycleTics);
    expect(sum).toBe(11_566);
  });

  it('derives totalCycleSeconds from totalCycleTics / ticRate', () => {
    const expected = sequence.totalCycleTics / sequence.ticRate;
    expect(sequence.totalCycleSeconds).toBeCloseTo(expected, 10);
  });

  it('assigns explicit music only to TITLEPIC (D_INTRO)', () => {
    const explicit = sequence.states.filter((state) => state.musicChange === 'explicit');
    expect(explicit).toHaveLength(1);
    expect(explicit[0]!.lumpName).toBe('TITLEPIC');
    expect(explicit[0]!.musicLump).toBe('D_INTRO');
  });

  it('assigns level-init music to all demo states', () => {
    for (const demoState of demos) {
      expect(demoState.musicChange).toBe('level-init');
      expect(demoState.musicLump).toBeString();
      expect(demoState.musicLump!.startsWith('D_E1M')).toBe(true);
    }
  });

  it('assigns inherited music (null lump) to non-TITLEPIC pages', () => {
    const inherited = sequence.states.filter((state) => state.musicChange === 'inherited');
    expect(inherited).toHaveLength(2);
    for (const state of inherited) {
      expect(state.type).toBe('page');
      expect(state.musicLump).toBeNull();
    }
  });

  it('maps demo music lumps to correct level names', () => {
    const demoMusic = demos.map((demo) => [demo.demoLump, demo.musicLump]);
    expect(demoMusic).toEqual([
      ['DEMO1', 'D_E1M5'],
      ['DEMO2', 'D_E1M3'],
      ['DEMO3', 'D_E1M7'],
    ]);
  });

  it('references only lumps present in DOOM1.WAD', async () => {
    const wadBuffer = Buffer.from(await Bun.file(REFERENCE_WAD_PATH).arrayBuffer());
    const header = parseWadHeader(wadBuffer);
    const directory = parseWadDirectory(wadBuffer, header);
    const lumpNames = new Set(directory.map((entry) => entry.name));

    for (const state of sequence.states) {
      const displayLump = state.type === 'page' ? state.lumpName : state.demoLump;
      expect(lumpNames.has(displayLump!)).toBe(true);

      if (state.musicLump) {
        expect(lumpNames.has(state.musicLump)).toBe(true);
      }
    }
  });

  it('has 5 notes documenting behavioral context', () => {
    expect(sequence.notes.length).toBeGreaterThanOrEqual(5);
    for (const note of sequence.notes) {
      expect(note).toBeString();
      expect(note.length).toBeGreaterThan(0);
    }
  });

  it('records page graphic sizes as 320x200 full-screen (68168 bytes)', async () => {
    const wadBuffer = Buffer.from(await Bun.file(REFERENCE_WAD_PATH).arrayBuffer());
    const header = parseWadHeader(wadBuffer);
    const directory = parseWadDirectory(wadBuffer, header);

    for (const page of pages) {
      const entry = directory.find((lump) => lump.name === page.lumpName);
      expect(entry).toBeDefined();
      expect(entry!.size).toBe(68_168);
    }
  });
});
