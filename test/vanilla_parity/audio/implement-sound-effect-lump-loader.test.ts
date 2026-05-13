import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SFX_DEFAULT_SAMPLE_RATE_HZ,
  VANILLA_SFX_FORMAT_DIGITAL_PCM,
  VANILLA_SFX_HEADER_FIELDS,
  VANILLA_SFX_HEADER_SIZE_BYTES,
  VANILLA_SFX_LUMP_NAME_PREFIX,
  VANILLA_SFX_PADDING_BYTE_COUNT,
  VANILLA_SFX_PC_SPEAKER_NAME_PREFIX,
  VANILLA_SFX_SILENCE_SAMPLE_VALUE,
  vanillaSfxAudibleByteRange,
  vanillaSfxLumpNameForSoundId,
} from '../../../src/audio/implement-sound-effect-lump-loader.ts';
import { isSfxLumpName, parseSfxLump, SFX_DEFAULT_SAMPLE_RATE, SFX_FORMAT_DIGITAL, SFX_HEADER_SIZE, SFX_LUMP_PREFIX, SFX_PADDING_BYTES, SFX_SILENCE_BYTE } from '../../../src/audio/sfxLumps.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

describe('vanilla sfx lump loader pin', () => {
  test('header size is 8 bytes', () => {
    expect(VANILLA_SFX_HEADER_SIZE_BYTES).toBe(8);
    expect(VANILLA_SFX_HEADER_SIZE_BYTES).toBe(SFX_HEADER_SIZE);
  });

  test('digital PCM format tag is 0x0003', () => {
    expect(VANILLA_SFX_FORMAT_DIGITAL_PCM).toBe(3);
    expect(VANILLA_SFX_FORMAT_DIGITAL_PCM).toBe(SFX_FORMAT_DIGITAL);
  });

  test('default sample rate is 11025 Hz', () => {
    expect(VANILLA_SFX_DEFAULT_SAMPLE_RATE_HZ).toBe(11025);
    expect(VANILLA_SFX_DEFAULT_SAMPLE_RATE_HZ).toBe(SFX_DEFAULT_SAMPLE_RATE);
  });

  test('digital sfx lumps use DS prefix and PC speaker uses DP', () => {
    expect(VANILLA_SFX_LUMP_NAME_PREFIX).toBe('DS');
    expect(VANILLA_SFX_LUMP_NAME_PREFIX).toBe(SFX_LUMP_PREFIX);
    expect(VANILLA_SFX_PC_SPEAKER_NAME_PREFIX).toBe('DP');
  });

  test('header fields are laid out as format,rate,count at byte offsets 0,2,4', () => {
    expect(VANILLA_SFX_HEADER_FIELDS).toEqual([
      { name: 'format', byteOffset: 0, byteWidth: 2 },
      { name: 'sampleRate', byteOffset: 2, byteWidth: 2 },
      { name: 'sampleCount', byteOffset: 4, byteWidth: 4 },
    ]);
    const totalWidth = VANILLA_SFX_HEADER_FIELDS.reduce((sum, field) => sum + field.byteWidth, 0);
    expect(totalWidth).toBe(VANILLA_SFX_HEADER_SIZE_BYTES);
  });

  test('padding contract is 2 bytes total (one before, one after audible region)', () => {
    expect(VANILLA_SFX_PADDING_BYTE_COUNT).toBe(2);
    expect(VANILLA_SFX_PADDING_BYTE_COUNT).toBe(SFX_PADDING_BYTES);
  });

  test('DC-zero silence sample is 0x80', () => {
    expect(VANILLA_SFX_SILENCE_SAMPLE_VALUE).toBe(0x80);
    expect(VANILLA_SFX_SILENCE_SAMPLE_VALUE).toBe(SFX_SILENCE_BYTE);
  });

  test('vanillaSfxLumpNameForSoundId uppercases and prefixes with DS', () => {
    expect(vanillaSfxLumpNameForSoundId('pistol')).toBe('DSPISTOL');
    expect(vanillaSfxLumpNameForSoundId('Shotgn')).toBe('DSSHOTGN');
  });

  test('audible byte range starts at byte 1 and trims 2 padding bytes', () => {
    const range = vanillaSfxAudibleByteRange(100);
    expect(range.startByteOffset).toBe(1);
    expect(range.byteLength).toBe(98);
  });

  test('rejects sample counts below the 2-byte padding floor', () => {
    expect(() => vanillaSfxAudibleByteRange(1)).toThrow(RangeError);
  });

  test('DSPISTOL lump in DOOM1.WAD parses with vanilla format/rate', () => {
    const pistolEntry = directory.find((entry) => entry.name === 'DSPISTOL');
    expect(pistolEntry).toBeDefined();
    const lumpData = Buffer.from(wadBuffer.subarray(pistolEntry!.offset, pistolEntry!.offset + pistolEntry!.size));
    const sfx = parseSfxLump(lumpData);
    expect(sfx.format).toBe(VANILLA_SFX_FORMAT_DIGITAL_PCM);
    expect(sfx.sampleRate).toBe(VANILLA_SFX_DEFAULT_SAMPLE_RATE_HZ);
    expect(sfx.sampleCount).toBeGreaterThan(VANILLA_SFX_PADDING_BYTE_COUNT);
  });

  test('isSfxLumpName matches digital sfx names by DS prefix', () => {
    expect(isSfxLumpName('DSPISTOL')).toBe(true);
    expect(isSfxLumpName('DSSHOTGN')).toBe(true);
    expect(isSfxLumpName('DPPISTOL')).toBe(false);
    expect(isSfxLumpName('PLAYPAL')).toBe(false);
  });
});
