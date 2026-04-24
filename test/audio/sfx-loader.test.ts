import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { SFX_DEFAULT_SAMPLE_RATE, SFX_FORMAT_DIGITAL, SFX_HEADER_SIZE, SFX_LUMP_PREFIX, SFX_PADDING_BYTES, SFX_SILENCE_BYTE, isSfxLumpName, parseSfxLump } from '../../src/audio/sfxLumps.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);

function makeSfxLump(format: number, sampleRate: number, sampleCount: number, fill = SFX_SILENCE_BYTE): Buffer {
  const buf = Buffer.alloc(SFX_HEADER_SIZE + sampleCount);
  buf.writeUInt16LE(format, 0);
  buf.writeUInt16LE(sampleRate, 2);
  buf.writeUInt32LE(sampleCount, 4);
  buf.fill(fill, SFX_HEADER_SIZE);
  return buf;
}

describe('SFX lump constants', () => {
  it('SFX_HEADER_SIZE is 8', () => {
    expect(SFX_HEADER_SIZE).toBe(8);
  });

  it('SFX_FORMAT_DIGITAL is 3', () => {
    expect(SFX_FORMAT_DIGITAL).toBe(3);
  });

  it('SFX_DEFAULT_SAMPLE_RATE is 11025', () => {
    expect(SFX_DEFAULT_SAMPLE_RATE).toBe(11025);
  });

  it('SFX_LUMP_PREFIX is "DS"', () => {
    expect(SFX_LUMP_PREFIX).toBe('DS');
  });

  it('SFX_PADDING_BYTES is 2', () => {
    expect(SFX_PADDING_BYTES).toBe(2);
  });

  it('SFX_SILENCE_BYTE is 0x80 (unsigned PCM midpoint)', () => {
    expect(SFX_SILENCE_BYTE).toBe(0x80);
  });
});

describe('isSfxLumpName', () => {
  it('matches DS-prefixed names', () => {
    expect(isSfxLumpName('DSPISTOL')).toBe(true);
    expect(isSfxLumpName('DSSHOTGN')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSfxLumpName('dspistol')).toBe(true);
    expect(isSfxLumpName('Dspistol')).toBe(true);
  });

  it('rejects PC-speaker DP-prefixed names', () => {
    expect(isSfxLumpName('DPPISTOL')).toBe(false);
  });

  it('rejects the bare prefix with no suffix', () => {
    expect(isSfxLumpName('DS')).toBe(false);
  });

  it('rejects unrelated lump names', () => {
    expect(isSfxLumpName('PLAYPAL')).toBe(false);
    expect(isSfxLumpName('E1M1')).toBe(false);
    expect(isSfxLumpName('DEMO1')).toBe(false);
  });
});

describe('parseSfxLump with DOOM1.WAD DSPISTOL', () => {
  const data = lookup.getLumpData('DSPISTOL', wadBuffer);
  const sfx = parseSfxLump(data);

  it('format is SFX_FORMAT_DIGITAL', () => {
    expect(sfx.format).toBe(SFX_FORMAT_DIGITAL);
  });

  it('sampleRate is 11025 Hz', () => {
    expect(sfx.sampleRate).toBe(SFX_DEFAULT_SAMPLE_RATE);
  });

  it('sampleCount matches lumpSize - header', () => {
    expect(sfx.sampleCount).toBe(data.length - SFX_HEADER_SIZE);
  });

  it('samples length matches sampleCount', () => {
    expect(sfx.samples.length).toBe(sfx.sampleCount);
  });

  it('playableSampleStart is 1 (skipping the leading pad byte)', () => {
    expect(sfx.playableSampleStart).toBe(1);
  });

  it('playableSampleCount is sampleCount - 2 padding bytes', () => {
    expect(sfx.playableSampleCount).toBe(sfx.sampleCount - SFX_PADDING_BYTES);
  });

  it('samples mirror the lump body byte-for-byte', () => {
    expect(sfx.samples.equals(data.subarray(SFX_HEADER_SIZE))).toBe(true);
  });

  it('samples buffer is a copy (mutation does not affect the lump)', () => {
    const original = data[SFX_HEADER_SIZE]!;
    sfx.samples[0] = (original ^ 0x55) & 0xff;
    expect(data[SFX_HEADER_SIZE]).toBe(original);
  });

  it('returned lump object is frozen', () => {
    expect(Object.isFrozen(sfx)).toBe(true);
  });
});

describe('parseSfxLump across every DS* lump in DOOM1.WAD', () => {
  const dsEntries = directory.filter((entry) => isSfxLumpName(entry.name));

  it('DOOM1.WAD contains 55 DS* lumps', () => {
    expect(dsEntries.length).toBe(55);
  });

  it('every DS* lump parses with format 3', () => {
    for (const entry of dsEntries) {
      const data = lookup.getLumpData(entry.name, wadBuffer);
      const sfx = parseSfxLump(data);
      expect(sfx.format).toBe(SFX_FORMAT_DIGITAL);
    }
  });

  it('header sampleCount exactly matches body length for every lump', () => {
    for (const entry of dsEntries) {
      const data = lookup.getLumpData(entry.name, wadBuffer);
      const sfx = parseSfxLump(data);
      expect(sfx.sampleCount).toBe(data.length - SFX_HEADER_SIZE);
    }
  });

  it('every DS* lump except DSITMBK is sampled at 11025 Hz', () => {
    for (const entry of dsEntries) {
      const data = lookup.getLumpData(entry.name, wadBuffer);
      const sfx = parseSfxLump(data);
      if (entry.name === 'DSITMBK') {
        expect(sfx.sampleRate).toBe(22050);
      } else {
        expect(sfx.sampleRate).toBe(SFX_DEFAULT_SAMPLE_RATE);
      }
    }
  });
});

describe('parseSfxLump parity-sensitive edge cases', () => {
  it('accepts a minimal 2-byte PCM body (pad + pad only)', () => {
    const lump = makeSfxLump(SFX_FORMAT_DIGITAL, SFX_DEFAULT_SAMPLE_RATE, SFX_PADDING_BYTES);
    const sfx = parseSfxLump(lump);
    expect(sfx.sampleCount).toBe(SFX_PADDING_BYTES);
    expect(sfx.playableSampleCount).toBe(0);
  });

  it('preserves a known byte pattern in the PCM body', () => {
    const lump = makeSfxLump(SFX_FORMAT_DIGITAL, SFX_DEFAULT_SAMPLE_RATE, 6, 0x00);
    lump[SFX_HEADER_SIZE + 0] = 0x7e;
    lump[SFX_HEADER_SIZE + 1] = 0x12;
    lump[SFX_HEADER_SIZE + 2] = 0x34;
    lump[SFX_HEADER_SIZE + 3] = 0x56;
    lump[SFX_HEADER_SIZE + 4] = 0x78;
    lump[SFX_HEADER_SIZE + 5] = 0x7e;
    const sfx = parseSfxLump(lump);
    expect(Array.from(sfx.samples)).toEqual([0x7e, 0x12, 0x34, 0x56, 0x78, 0x7e]);
    expect(sfx.playableSampleStart).toBe(1);
    expect(sfx.playableSampleCount).toBe(4);
  });

  it('accepts non-default sample rates (DSITMBK @ 22050 Hz)', () => {
    const data = lookup.getLumpData('DSITMBK', wadBuffer);
    const sfx = parseSfxLump(data);
    expect(sfx.sampleRate).toBe(22050);
    expect(sfx.format).toBe(SFX_FORMAT_DIGITAL);
  });
});

describe('parseSfxLump error cases', () => {
  it('throws when the lump is shorter than the header', () => {
    expect(() => parseSfxLump(Buffer.alloc(SFX_HEADER_SIZE - 1))).toThrow(/at least 8 bytes/);
  });

  it('throws when the format field is not 3 (PC speaker format 0)', () => {
    const lump = makeSfxLump(0, SFX_DEFAULT_SAMPLE_RATE, 4);
    expect(() => parseSfxLump(lump)).toThrow(/unsupported format 0/);
  });

  it('throws when the body is shorter than sampleCount claims', () => {
    const lump = makeSfxLump(SFX_FORMAT_DIGITAL, SFX_DEFAULT_SAMPLE_RATE, 16).subarray(0, SFX_HEADER_SIZE + 8);
    expect(() => parseSfxLump(lump)).toThrow(/body mismatch/);
  });

  it('throws when the body is longer than sampleCount claims', () => {
    const lump = Buffer.concat([makeSfxLump(SFX_FORMAT_DIGITAL, SFX_DEFAULT_SAMPLE_RATE, 4), Buffer.alloc(4)]);
    expect(() => parseSfxLump(lump)).toThrow(/body mismatch/);
  });

  it('throws when sampleCount is smaller than the padding requirement', () => {
    const lump = makeSfxLump(SFX_FORMAT_DIGITAL, SFX_DEFAULT_SAMPLE_RATE, 1);
    expect(() => parseSfxLump(lump)).toThrow(/smaller than 2 padding bytes/);
  });
});
