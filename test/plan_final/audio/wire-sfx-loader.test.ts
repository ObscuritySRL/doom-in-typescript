import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SFX_DEFAULT_SAMPLE_RATE, SFX_FORMAT_DIGITAL, SFX_HEADER_SIZE, SFX_PADDING_BYTES } from '../../../src/audio/sfxLumps.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import { SfxLoaderError, buildSfxLoader } from '../../../src/vanilla/sfxLoader.ts';
import type { SfxLoader, SfxLumpReader } from '../../../src/vanilla/sfxLoader.ts';
import type { SoundAndMusicAssetCatalog } from '../../../src/vanilla/soundAndMusicAssets.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const SFX_LOADER_RELATIVE_PATH = 'src/vanilla/sfxLoader.ts';
const SFX_LOADER_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, SFX_LOADER_RELATIVE_PATH);

function buildDmxSfxBytes(sampleRate: number, sampleCount: number, fill: number): Buffer {
  const totalLength = SFX_HEADER_SIZE + sampleCount;
  const buffer = Buffer.alloc(totalLength);
  buffer.writeUInt16LE(SFX_FORMAT_DIGITAL, 0);
  buffer.writeUInt16LE(sampleRate, 2);
  buffer.writeUInt32LE(sampleCount, 4);
  for (let pcmOffset = SFX_HEADER_SIZE; pcmOffset < totalLength; pcmOffset += 1) {
    buffer.writeUInt8(fill & 0xff, pcmOffset);
  }
  return buffer;
}

function buildDmxSfxBytesWithFormat(formatValue: number, sampleCount: number): Buffer {
  const totalLength = SFX_HEADER_SIZE + sampleCount;
  const buffer = Buffer.alloc(totalLength);
  buffer.writeUInt16LE(formatValue, 0);
  buffer.writeUInt16LE(SFX_DEFAULT_SAMPLE_RATE, 2);
  buffer.writeUInt32LE(sampleCount, 4);
  return buffer;
}

function entry(name: string, size: number): DirectoryEntry {
  return Object.freeze({ name, offset: 0, size });
}

function buildCatalog(sfxLumps: { name: string; entry: DirectoryEntry }[]): SoundAndMusicAssetCatalog {
  return Object.freeze({
    musLumps: Object.freeze([]),
    sfxLumps: Object.freeze(
      sfxLumps.map((item, index) =>
        Object.freeze({
          directoryEntry: item.entry,
          directoryIndex: index,
          name: item.name,
        }),
      ),
    ),
  });
}

function buildReader(payloads: Record<string, Buffer>): SfxLumpReader {
  return Object.freeze({
    readSfxLumpBytes: (entry: DirectoryEntry): Buffer => {
      const payload = payloads[entry.name];
      if (payload === undefined) throw new Error(`no payload for ${entry.name}`);
      return payload;
    },
  });
}

describe('plan_final audio: wire-sfx-loader', () => {
  test('src/vanilla/sfxLoader.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(SFX_LOADER_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(SFX_LOADER_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/sfxLoader.ts cites plan_final step 11-001 in a top-of-file comment', () => {
    const fileText = readFileSync(SFX_LOADER_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('11-001');
    expect(fileText).toContain('buildSfxLoader');
  });

  test('src/vanilla/sfxLoader.ts imports the read-only parseSfxLump from src/audio/sfxLumps.ts without modifying it', () => {
    const fileText = readFileSync(SFX_LOADER_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../audio/sfxLumps.ts'");
    expect(fileText).toContain('parseSfxLump');
  });

  test('buildSfxLoader returns a frozen result with frozen sfxLumps array and a Map of names', () => {
    const bytes = buildDmxSfxBytes(SFX_DEFAULT_SAMPLE_RATE, 100, 0x80);
    const catalog = buildCatalog([{ name: 'DSPISTOL', entry: entry('DSPISTOL', bytes.length) }]);
    const loader: SfxLoader = buildSfxLoader(catalog, buildReader({ DSPISTOL: bytes }));
    expect(Object.isFrozen(loader)).toBe(true);
    expect(Object.isFrozen(loader.sfxLumps)).toBe(true);
    expect(loader.sfxLumpsByName).toBeInstanceOf(Map);
    expect(loader.sfxLumpsByName.size).toBe(1);
  });

  test('buildSfxLoader decodes each catalog SFX entry via parseSfxLump and indexes by name', () => {
    const pistolBytes = buildDmxSfxBytes(SFX_DEFAULT_SAMPLE_RATE, 100, 0x80);
    const itembkBytes = buildDmxSfxBytes(22050, 200, 0x80);
    const catalog = buildCatalog([
      { name: 'DSPISTOL', entry: entry('DSPISTOL', pistolBytes.length) },
      { name: 'DSITMBK', entry: entry('DSITMBK', itembkBytes.length) },
    ]);
    const loader = buildSfxLoader(catalog, buildReader({ DSPISTOL: pistolBytes, DSITMBK: itembkBytes }));
    expect(loader.sfxLumps.length).toBe(2);
    expect(loader.sfxLumpsByName.get('DSPISTOL')?.sampleRate).toBe(SFX_DEFAULT_SAMPLE_RATE);
    expect(loader.sfxLumpsByName.get('DSITMBK')?.sampleRate).toBe(22050);
    expect(loader.sfxLumpsByName.get('DSPISTOL')?.sampleCount).toBe(100);
    expect(loader.sfxLumpsByName.get('DSPISTOL')?.playableSampleCount).toBe(100 - SFX_PADDING_BYTES);
  });

  test('buildSfxLoader preserves the catalog directory order in sfxLumps', () => {
    const bytesA = buildDmxSfxBytes(SFX_DEFAULT_SAMPLE_RATE, 100, 0x80);
    const bytesB = buildDmxSfxBytes(SFX_DEFAULT_SAMPLE_RATE, 50, 0x80);
    const catalog = buildCatalog([
      { name: 'DSPISTOL', entry: entry('DSPISTOL', bytesA.length) },
      { name: 'DSSHOTGN', entry: entry('DSSHOTGN', bytesB.length) },
    ]);
    const loader = buildSfxLoader(catalog, buildReader({ DSPISTOL: bytesA, DSSHOTGN: bytesB }));
    expect(loader.sfxLumps.map((record) => record.name)).toEqual(['DSPISTOL', 'DSSHOTGN']);
  });

  test('buildSfxLoader records the directoryIndex from the catalog for each entry', () => {
    const bytes = buildDmxSfxBytes(SFX_DEFAULT_SAMPLE_RATE, 100, 0x80);
    const catalog = buildCatalog([{ name: 'DSPISTOL', entry: entry('DSPISTOL', bytes.length) }]);
    const loader = buildSfxLoader(catalog, buildReader({ DSPISTOL: bytes }));
    expect(loader.sfxLumps[0]!.directoryIndex).toBe(0);
  });

  test('buildSfxLoader returns empty maps when the catalog has no SFX entries', () => {
    const catalog = buildCatalog([]);
    const loader = buildSfxLoader(catalog, buildReader({}));
    expect(loader.sfxLumps.length).toBe(0);
    expect(loader.sfxLumpsByName.size).toBe(0);
  });

  test('buildSfxLoader throws SfxLoaderError reason sfx-lump-header-too-short when the lump body is below SFX_HEADER_SIZE', () => {
    const tooShort = Buffer.alloc(SFX_HEADER_SIZE - 1);
    const catalog = buildCatalog([{ name: 'DSPISTOL', entry: entry('DSPISTOL', tooShort.length) }]);
    let caughtError: unknown;
    try {
      buildSfxLoader(catalog, buildReader({ DSPISTOL: tooShort }));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(SfxLoaderError);
    expect((caughtError as SfxLoaderError).reason).toBe('sfx-lump-header-too-short');
    expect((caughtError as SfxLoaderError).lumpName).toBe('DSPISTOL');
  });

  test('buildSfxLoader throws SfxLoaderError reason sfx-lump-non-digital-format when format is not SFX_FORMAT_DIGITAL', () => {
    const nonDigital = buildDmxSfxBytesWithFormat(0xff, 100);
    const catalog = buildCatalog([{ name: 'DSGARBO', entry: entry('DSGARBO', nonDigital.length) }]);
    let caughtError: unknown;
    try {
      buildSfxLoader(catalog, buildReader({ DSGARBO: nonDigital }));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(SfxLoaderError);
    expect((caughtError as SfxLoaderError).reason).toBe('sfx-lump-non-digital-format');
  });

  test('buildSfxLoader throws SfxLoaderError reason sfx-lump-body-mismatch when the body length disagrees with the header', () => {
    const header = Buffer.alloc(SFX_HEADER_SIZE);
    header.writeUInt16LE(SFX_FORMAT_DIGITAL, 0);
    header.writeUInt16LE(SFX_DEFAULT_SAMPLE_RATE, 2);
    header.writeUInt32LE(100, 4);
    const truncated = Buffer.concat([header, Buffer.alloc(50)]);
    const catalog = buildCatalog([{ name: 'DSTRUNC', entry: entry('DSTRUNC', truncated.length) }]);
    let caughtError: unknown;
    try {
      buildSfxLoader(catalog, buildReader({ DSTRUNC: truncated }));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(SfxLoaderError);
    expect((caughtError as SfxLoaderError).reason).toBe('sfx-lump-body-mismatch');
  });
});
