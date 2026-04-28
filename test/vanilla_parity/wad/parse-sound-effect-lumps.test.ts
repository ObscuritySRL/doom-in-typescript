import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  SFX_DEFAULT_SAMPLE_RATE_HZ,
  SFX_DIGITAL_FORMAT_VALUE,
  SFX_FORMAT_FIELD_BYTES,
  SFX_FORMAT_FIELD_OFFSET,
  SFX_HEADER_BYTES,
  SFX_LUMP_NAME_FIELD_BYTES,
  SFX_LUMP_NAME_PREFIX,
  SFX_LUMP_NAME_PREFIX_LENGTH,
  SFX_PCM_MIDPOINT_BYTE,
  SFX_SAMPLE_COUNT_FIELD_BYTES,
  SFX_SAMPLE_COUNT_FIELD_OFFSET,
  SFX_SAMPLE_RATE_FIELD_BYTES,
  SFX_SAMPLE_RATE_FIELD_OFFSET,
  SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE,
  SOUND_EFFECT_LUMP_AUDIT,
  SOUND_EFFECT_LUMP_DERIVED_INVARIANTS,
  crossCheckShareWareDoom1WadSoundEffectLumpSample,
  crossCheckSoundEffectLumpRuntime,
  isSoundEffectLumpName,
  parseSoundEffectLumpHeader,
  soundEffectLumpDataSize,
} from '../../../src/assets/parse-sound-effect-lumps.ts';
import type { ShareWareDoom1WadSoundEffectLumpSample, SoundEffectLumpAuditEntry, SoundEffectLumpRuntimeSnapshot } from '../../../src/assets/parse-sound-effect-lumps.ts';

const ALLOWED_AXIS_IDS = new Set<SoundEffectLumpAuditEntry['id']>([
  'sound-effect-lump-name-prefix-ds',
  'sound-effect-lump-name-formed-via-sprintf-ds-percent-s',
  'sound-effect-lump-name-lookup-via-w-getnumforname',
  'sound-effect-lump-header-bytes-eight',
  'sound-effect-lump-header-format-field-offset-zero',
  'sound-effect-lump-header-format-field-uint16-le',
  'sound-effect-lump-header-format-magic-three',
  'sound-effect-lump-header-sample-rate-field-offset-two',
  'sound-effect-lump-header-sample-rate-field-uint16-le',
  'sound-effect-lump-header-sample-count-field-offset-four',
  'sound-effect-lump-header-sample-count-field-uint32-le',
  'sound-effect-lump-total-size-formula-header-plus-sample-count',
  'sound-effect-lump-lumplen-less-than-eight-rejected',
  'sound-effect-lump-pcm-midpoint-byte-128',
  'sound-effect-lump-no-marker-range',
  'sound-effect-lump-shareware-doom1-fifty-five-effects',
]);
const ALLOWED_SUBJECTS = new Set<SoundEffectLumpAuditEntry['subject']>(['DS-lump', 'getsfx', 'I_GetSfxLumpNum', 'CacheSFX', 'parseSoundEffectLumpHeader', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<SoundEffectLumpAuditEntry['referenceSourceFile']>(['linuxdoom-1.10/i_sound.c', 'src/i_sdlsound.c', 'src/i_sound.c', 'src/w_wad.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveDsEntries = liveDirectory.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.name.length >= 3 && entry.name.startsWith('DS'));

function buildValidLumpBytes({ format = SFX_DIGITAL_FORMAT_VALUE, sampleRate = 11025, sampleCount = 4 }: { format?: number; sampleRate?: number; sampleCount?: number } = {}): Buffer {
  const buffer = Buffer.alloc(SFX_HEADER_BYTES + sampleCount);
  buffer.writeUint16LE(format, SFX_FORMAT_FIELD_OFFSET);
  buffer.writeUint16LE(sampleRate, SFX_SAMPLE_RATE_FIELD_OFFSET);
  buffer.writeUint32LE(sampleCount, SFX_SAMPLE_COUNT_FIELD_OFFSET);
  for (let i = 0; i < sampleCount; i += 1) {
    buffer[SFX_HEADER_BYTES + i] = SFX_PCM_MIDPOINT_BYTE;
  }
  return buffer;
}

function tryThrows(thunk: () => unknown): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof Error;
  }
}

const validLump = buildValidLumpBytes({ sampleCount: 16 });
const parsedValidHeader = parseSoundEffectLumpHeader(validLump);

const tooSmallBuffer = Buffer.alloc(SFX_HEADER_BYTES - 1);
const formatTwoBuffer = buildValidLumpBytes();
formatTwoBuffer.writeUint16LE(2, SFX_FORMAT_FIELD_OFFSET);
const truncatedBodyBuffer = (() => {
  const buffer = buildValidLumpBytes({ sampleCount: 16 });
  return buffer.subarray(0, buffer.length - 1);
})();

const parserRejectsBufferTooSmallForHeader = tryThrows(() => parseSoundEffectLumpHeader(tooSmallBuffer));
const parserRejectsNonDigitalFormat = tryThrows(() => parseSoundEffectLumpHeader(formatTwoBuffer));
const parserRejectsBodyLengthMismatch = tryThrows(() => parseSoundEffectLumpHeader(truncatedBodyBuffer));

const dataSizeProbes = [0, 1, 2, 8, 100, 5661, 18592];
const soundEffectLumpDataSizeFormulaHolds = dataSizeProbes.every((probe) => soundEffectLumpDataSize(probe) === SFX_HEADER_BYTES + probe);

function buildLiveRuntimeSnapshot(): SoundEffectLumpRuntimeSnapshot {
  return {
    sfxLumpNamePrefix: SFX_LUMP_NAME_PREFIX,
    sfxLumpNamePrefixLength: SFX_LUMP_NAME_PREFIX_LENGTH,
    sfxLumpNameFieldBytes: SFX_LUMP_NAME_FIELD_BYTES,
    sfxHeaderBytes: SFX_HEADER_BYTES,
    sfxFormatFieldOffset: SFX_FORMAT_FIELD_OFFSET,
    sfxFormatFieldBytes: SFX_FORMAT_FIELD_BYTES,
    sfxDigitalFormatValue: SFX_DIGITAL_FORMAT_VALUE,
    sfxSampleRateFieldOffset: SFX_SAMPLE_RATE_FIELD_OFFSET,
    sfxSampleRateFieldBytes: SFX_SAMPLE_RATE_FIELD_BYTES,
    sfxSampleCountFieldOffset: SFX_SAMPLE_COUNT_FIELD_OFFSET,
    sfxSampleCountFieldBytes: SFX_SAMPLE_COUNT_FIELD_BYTES,
    sfxDefaultSampleRateHz: SFX_DEFAULT_SAMPLE_RATE_HZ,
    sfxPcmMidpointByte: SFX_PCM_MIDPOINT_BYTE,
    soundEffectLumpDataSizeFormulaHolds,
    parserReturnsFrozenHeader: Object.isFrozen(parsedValidHeader),
    parserRejectsBufferTooSmallForHeader,
    parserRejectsNonDigitalFormat,
    parserRejectsBodyLengthMismatch,
    isSoundEffectLumpNameAcceptsDsPrefix: isSoundEffectLumpName('DSPISTOL'),
    isSoundEffectLumpNameRejectsDpPrefix: isSoundEffectLumpName('DPPISTOL') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadSoundEffectLumpSample {
  const pinnedSoundEffects = SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects.map((oracleEntry) => {
    const liveEntry = liveDsEntries.find(({ entry }) => entry.name === oracleEntry.name);
    if (!liveEntry) {
      throw new Error(`pinned sound effect ${oracleEntry.name} not found in live IWAD`);
    }
    const directoryEntry = liveEntry.entry;
    const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
    const header = parseSoundEffectLumpHeader(lump);
    return {
      name: directoryEntry.name,
      directoryIndex: liveEntry.index,
      fileOffset: directoryEntry.offset,
      size: directoryEntry.size,
      format: header.format,
      sampleRate: header.sampleRate,
      sampleCount: header.sampleCount,
      sha256: createHash('sha256').update(lump).digest('hex'),
    };
  });
  return {
    dsLumpCount: liveDsEntries.length,
    firstDsLumpIndex: liveDsEntries[0]!.index,
    lastDsLumpIndex: liveDsEntries[liveDsEntries.length - 1]!.index,
    pinnedSoundEffects,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('sound effect lump audit ledger shape', () => {
  test('audits exactly sixteen behavioral axes', () => {
    expect(SOUND_EFFECT_LUMP_AUDIT.length).toBe(16);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of SOUND_EFFECT_LUMP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = SOUND_EFFECT_LUMP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of SOUND_EFFECT_LUMP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of SOUND_EFFECT_LUMP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of SOUND_EFFECT_LUMP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of SOUND_EFFECT_LUMP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the prefix-ds axis cites the upstream lowercase sprintf format string', () => {
    const entry = SOUND_EFFECT_LUMP_AUDIT.find((e) => e.id === 'sound-effect-lump-name-prefix-ds');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('"ds%s"'))).toBe(true);
  });

  test('the format-magic-three axis cites the upstream 0x03 0x00 magic check', () => {
    const entry = SOUND_EFFECT_LUMP_AUDIT.find((e) => e.id === 'sound-effect-lump-header-format-magic-three');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('0x03') && line.includes('0x00'))).toBe(true);
  });

  test('the pcm-midpoint-byte-128 axis cites the upstream paddedsfx[i] = 128 fill', () => {
    const entry = SOUND_EFFECT_LUMP_AUDIT.find((e) => e.id === 'sound-effect-lump-pcm-midpoint-byte-128');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('paddedsfx[i] = 128'))).toBe(true);
  });

  test('the sample-rate-uint16-le axis cites the upstream (data[3] << 8) | data[2] composition', () => {
    const entry = SOUND_EFFECT_LUMP_AUDIT.find((e) => e.id === 'sound-effect-lump-header-sample-rate-field-uint16-le');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('data[3]') && line.includes('data[2]'))).toBe(true);
  });

  test('the sample-count-uint32-le axis cites the upstream four-byte LE composition', () => {
    const entry = SOUND_EFFECT_LUMP_AUDIT.find((e) => e.id === 'sound-effect-lump-header-sample-count-field-uint32-le');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('data[7]') && line.includes('data[6]') && line.includes('data[5]') && line.includes('data[4]'))).toBe(true);
  });

  test('the shareware-fifty-five-effects axis names the shareware DOOM1.WAD file', () => {
    const entry = SOUND_EFFECT_LUMP_AUDIT.find((e) => e.id === 'sound-effect-lump-shareware-doom1-fifty-five-effects');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('shareware-doom1.wad');
    expect(entry!.invariant.includes('55')).toBe(true);
  });
});

describe('sound effect lump derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = SOUND_EFFECT_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(SOUND_EFFECT_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'SFX_LUMP_NAME_PREFIX_EQUALS_DS',
        'SFX_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO',
        'SFX_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT',
        'SFX_HEADER_BYTES_EQUALS_EIGHT',
        'SFX_FORMAT_FIELD_OFFSET_EQUALS_ZERO',
        'SFX_FORMAT_FIELD_BYTES_EQUALS_TWO',
        'SFX_DIGITAL_FORMAT_VALUE_EQUALS_THREE',
        'SFX_SAMPLE_RATE_FIELD_OFFSET_EQUALS_TWO',
        'SFX_SAMPLE_RATE_FIELD_BYTES_EQUALS_TWO',
        'SFX_SAMPLE_COUNT_FIELD_OFFSET_EQUALS_FOUR',
        'SFX_SAMPLE_COUNT_FIELD_BYTES_EQUALS_FOUR',
        'SFX_DEFAULT_SAMPLE_RATE_HZ_EQUALS_11025',
        'SFX_PCM_MIDPOINT_BYTE_EQUALS_128',
        'SFX_LUMP_TOTAL_SIZE_FORMULA_EQUALS_HEADER_PLUS_SAMPLE_COUNT',
        'PARSE_SOUND_EFFECT_LUMP_HEADER_RETURNS_FROZEN_HEADER',
        'PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_NON_DIGITAL_FORMAT',
        'PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BODY_LENGTH_MISMATCH',
        'IS_SOUND_EFFECT_LUMP_NAME_REQUIRES_DS_PREFIX',
        'IS_SOUND_EFFECT_LUMP_NAME_REJECTS_DP_PC_SPEAKER_PREFIX',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of SOUND_EFFECT_LUMP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('SFX_LUMP_NAME_PREFIX is the uppercase "DS" string', () => {
    expect(SFX_LUMP_NAME_PREFIX).toBe('DS');
  });

  test('SFX_LUMP_NAME_PREFIX_LENGTH equals 2 (matches lowercase "ds" literal in sprintf)', () => {
    expect(SFX_LUMP_NAME_PREFIX_LENGTH).toBe(2);
    expect(SFX_LUMP_NAME_PREFIX_LENGTH).toBe(SFX_LUMP_NAME_PREFIX.length);
  });

  test('SFX_LUMP_NAME_FIELD_BYTES equals 8 (matches WAD directory name field)', () => {
    expect(SFX_LUMP_NAME_FIELD_BYTES).toBe(8);
  });

  test('SFX_HEADER_BYTES equals 8', () => {
    expect(SFX_HEADER_BYTES).toBe(8);
  });

  test('SFX_FORMAT_FIELD_OFFSET equals 0', () => {
    expect(SFX_FORMAT_FIELD_OFFSET).toBe(0);
  });

  test('SFX_FORMAT_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(SFX_FORMAT_FIELD_BYTES).toBe(2);
  });

  test('SFX_DIGITAL_FORMAT_VALUE equals 3 (DMX digital PCM magic)', () => {
    expect(SFX_DIGITAL_FORMAT_VALUE).toBe(3);
  });

  test('SFX_SAMPLE_RATE_FIELD_OFFSET equals 2', () => {
    expect(SFX_SAMPLE_RATE_FIELD_OFFSET).toBe(2);
  });

  test('SFX_SAMPLE_RATE_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(SFX_SAMPLE_RATE_FIELD_BYTES).toBe(2);
  });

  test('SFX_SAMPLE_COUNT_FIELD_OFFSET equals 4', () => {
    expect(SFX_SAMPLE_COUNT_FIELD_OFFSET).toBe(4);
  });

  test('SFX_SAMPLE_COUNT_FIELD_BYTES equals 4 (uint32-LE)', () => {
    expect(SFX_SAMPLE_COUNT_FIELD_BYTES).toBe(4);
  });

  test('SFX_DEFAULT_SAMPLE_RATE_HZ equals 11025', () => {
    expect(SFX_DEFAULT_SAMPLE_RATE_HZ).toBe(11025);
  });

  test('SFX_PCM_MIDPOINT_BYTE equals 0x80 (128, the unsigned 8-bit PCM DC zero)', () => {
    expect(SFX_PCM_MIDPOINT_BYTE).toBe(0x80);
    expect(SFX_PCM_MIDPOINT_BYTE).toBe(128);
  });

  test('the field offsets cover the 8-byte header without gaps', () => {
    expect(SFX_FORMAT_FIELD_OFFSET + SFX_FORMAT_FIELD_BYTES).toBe(SFX_SAMPLE_RATE_FIELD_OFFSET);
    expect(SFX_SAMPLE_RATE_FIELD_OFFSET + SFX_SAMPLE_RATE_FIELD_BYTES).toBe(SFX_SAMPLE_COUNT_FIELD_OFFSET);
    expect(SFX_SAMPLE_COUNT_FIELD_OFFSET + SFX_SAMPLE_COUNT_FIELD_BYTES).toBe(SFX_HEADER_BYTES);
  });
});

describe('soundEffectLumpDataSize runtime contract', () => {
  test('returns SFX_HEADER_BYTES + sampleCount for non-negative integers', () => {
    expect(soundEffectLumpDataSize(0)).toBe(8);
    expect(soundEffectLumpDataSize(1)).toBe(9);
    expect(soundEffectLumpDataSize(5661)).toBe(5669);
    expect(soundEffectLumpDataSize(18592)).toBe(18600);
  });

  test('throws RangeError on a negative count', () => {
    expect(() => soundEffectLumpDataSize(-1)).toThrow(RangeError);
  });

  test('throws RangeError on a non-integer count', () => {
    expect(() => soundEffectLumpDataSize(1.5)).toThrow(RangeError);
  });
});

describe('parseSoundEffectLumpHeader runtime contract', () => {
  test('returns a frozen header on a valid synthesised lump', () => {
    const lump = buildValidLumpBytes({ sampleRate: 11025, sampleCount: 4 });
    const header = parseSoundEffectLumpHeader(lump);
    expect(Object.isFrozen(header)).toBe(true);
    expect(header.format).toBe(3);
    expect(header.sampleRate).toBe(11025);
    expect(header.sampleCount).toBe(4);
  });

  test('reads the sample rate as little-endian uint16', () => {
    const lump = buildValidLumpBytes({ sampleRate: 22050, sampleCount: 2 });
    const header = parseSoundEffectLumpHeader(lump);
    expect(header.sampleRate).toBe(22050);
  });

  test('reads the sample count as little-endian uint32', () => {
    const lump = buildValidLumpBytes({ sampleCount: 0x010203 });
    const header = parseSoundEffectLumpHeader(lump);
    expect(header.sampleCount).toBe(0x010203);
  });

  test('throws RangeError on a buffer too small for the header', () => {
    expect(() => parseSoundEffectLumpHeader(Buffer.alloc(7))).toThrow(RangeError);
  });

  test('throws RangeError on a non-digital format value', () => {
    const buffer = buildValidLumpBytes();
    buffer.writeUint16LE(2, SFX_FORMAT_FIELD_OFFSET);
    expect(() => parseSoundEffectLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError on a body length mismatch', () => {
    const buffer = buildValidLumpBytes({ sampleCount: 16 });
    expect(() => parseSoundEffectLumpHeader(buffer.subarray(0, buffer.length - 1))).toThrow(RangeError);
  });

  test('throws RangeError on a body length larger than declared', () => {
    const buffer = buildValidLumpBytes({ sampleCount: 4 });
    const oversize = Buffer.concat([buffer, Buffer.from([SFX_PCM_MIDPOINT_BYTE])]);
    expect(() => parseSoundEffectLumpHeader(oversize)).toThrow(RangeError);
  });

  test('accepts both Buffer and Uint8Array inputs', () => {
    const buffer = buildValidLumpBytes({ sampleCount: 8 });
    const headerFromBuffer = parseSoundEffectLumpHeader(buffer);
    const u8 = new Uint8Array(buffer);
    const headerFromU8 = parseSoundEffectLumpHeader(u8);
    expect(headerFromBuffer).toEqual(headerFromU8);
  });
});

describe('isSoundEffectLumpName runtime contract', () => {
  test('accepts the uppercase DS prefix used by the WAD directory', () => {
    expect(isSoundEffectLumpName('DSPISTOL')).toBe(true);
    expect(isSoundEffectLumpName('DSGETPOW')).toBe(true);
    expect(isSoundEffectLumpName('DSITMBK')).toBe(true);
  });

  test('accepts the lowercase ds prefix that vanilla source uses literally', () => {
    expect(isSoundEffectLumpName('dspistol')).toBe(true);
  });

  test('rejects the PC-speaker DP prefix sibling', () => {
    expect(isSoundEffectLumpName('DPPISTOL')).toBe(false);
    expect(isSoundEffectLumpName('DPGETPOW')).toBe(false);
  });

  test('rejects a name that is exactly the prefix length', () => {
    expect(isSoundEffectLumpName('DS')).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(isSoundEffectLumpName('')).toBe(false);
  });

  test('rejects a non-DS prefix', () => {
    expect(isSoundEffectLumpName('PLAYPAL')).toBe(false);
    expect(isSoundEffectLumpName('PNAMES')).toBe(false);
    expect(isSoundEffectLumpName('S_START')).toBe(false);
  });
});

describe('crossCheckSoundEffectLumpRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckSoundEffectLumpRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckSoundEffectLumpRuntime failure modes', () => {
  test('detects a tampered SFX_LUMP_NAME_PREFIX that no longer equals "DS"', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxLumpNamePrefix: 'XX' };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_LUMP_NAME_PREFIX_EQUALS_DS');
    expect(failures).toContain('audit:sound-effect-lump-name-prefix-ds:not-observed');
  });

  test('detects a tampered SFX_LUMP_NAME_PREFIX_LENGTH', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxLumpNamePrefixLength: 3 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO');
    expect(failures).toContain('audit:sound-effect-lump-name-formed-via-sprintf-ds-percent-s:not-observed');
  });

  test('detects a tampered SFX_LUMP_NAME_FIELD_BYTES', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxLumpNameFieldBytes: 16 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT');
  });

  test('detects a tampered SFX_HEADER_BYTES', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxHeaderBytes: 16 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_HEADER_BYTES_EQUALS_EIGHT');
    expect(failures).toContain('audit:sound-effect-lump-header-bytes-eight:not-observed');
  });

  test('detects a tampered SFX_FORMAT_FIELD_OFFSET', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxFormatFieldOffset: 4 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_FORMAT_FIELD_OFFSET_EQUALS_ZERO');
    expect(failures).toContain('audit:sound-effect-lump-header-format-field-offset-zero:not-observed');
  });

  test('detects a tampered SFX_FORMAT_FIELD_BYTES', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxFormatFieldBytes: 1 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_FORMAT_FIELD_BYTES_EQUALS_TWO');
    expect(failures).toContain('audit:sound-effect-lump-header-format-field-uint16-le:not-observed');
  });

  test('detects a tampered SFX_DIGITAL_FORMAT_VALUE', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxDigitalFormatValue: 1 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_DIGITAL_FORMAT_VALUE_EQUALS_THREE');
    expect(failures).toContain('audit:sound-effect-lump-header-format-magic-three:not-observed');
  });

  test('detects a tampered SFX_SAMPLE_RATE_FIELD_OFFSET', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxSampleRateFieldOffset: 4 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_SAMPLE_RATE_FIELD_OFFSET_EQUALS_TWO');
    expect(failures).toContain('audit:sound-effect-lump-header-sample-rate-field-offset-two:not-observed');
  });

  test('detects a tampered SFX_SAMPLE_RATE_FIELD_BYTES', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxSampleRateFieldBytes: 4 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_SAMPLE_RATE_FIELD_BYTES_EQUALS_TWO');
    expect(failures).toContain('audit:sound-effect-lump-header-sample-rate-field-uint16-le:not-observed');
  });

  test('detects a tampered SFX_SAMPLE_COUNT_FIELD_OFFSET', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxSampleCountFieldOffset: 6 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_SAMPLE_COUNT_FIELD_OFFSET_EQUALS_FOUR');
    expect(failures).toContain('audit:sound-effect-lump-header-sample-count-field-offset-four:not-observed');
  });

  test('detects a tampered SFX_SAMPLE_COUNT_FIELD_BYTES', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxSampleCountFieldBytes: 8 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_SAMPLE_COUNT_FIELD_BYTES_EQUALS_FOUR');
    expect(failures).toContain('audit:sound-effect-lump-header-sample-count-field-uint32-le:not-observed');
  });

  test('detects a tampered SFX_DEFAULT_SAMPLE_RATE_HZ', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxDefaultSampleRateHz: 44100 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_DEFAULT_SAMPLE_RATE_HZ_EQUALS_11025');
  });

  test('detects a tampered SFX_PCM_MIDPOINT_BYTE', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, sfxPcmMidpointByte: 0 };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_PCM_MIDPOINT_BYTE_EQUALS_128');
    expect(failures).toContain('audit:sound-effect-lump-pcm-midpoint-byte-128:not-observed');
  });

  test('detects a tampered soundEffectLumpDataSize formula', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, soundEffectLumpDataSizeFormulaHolds: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:SFX_LUMP_TOTAL_SIZE_FORMULA_EQUALS_HEADER_PLUS_SAMPLE_COUNT');
    expect(failures).toContain('audit:sound-effect-lump-total-size-formula-header-plus-sample-count:not-observed');
  });

  test('detects a parser that fails to freeze the returned header', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFrozenHeader: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_RETURNS_FROZEN_HEADER');
  });

  test('detects a parser that silently accepts a too-small buffer', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
    expect(failures).toContain('audit:sound-effect-lump-lumplen-less-than-eight-rejected:not-observed');
  });

  test('detects a parser that silently accepts a non-digital format', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsNonDigitalFormat: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_NON_DIGITAL_FORMAT');
  });

  test('detects a parser that silently accepts a body length mismatch', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBodyLengthMismatch: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BODY_LENGTH_MISMATCH');
  });

  test('detects an isSoundEffectLumpName that no longer accepts the DS prefix', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, isSoundEffectLumpNameAcceptsDsPrefix: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:IS_SOUND_EFFECT_LUMP_NAME_REQUIRES_DS_PREFIX');
    expect(failures).toContain('audit:sound-effect-lump-name-lookup-via-w-getnumforname:not-observed');
  });

  test('detects an isSoundEffectLumpName that classifies DP lumps as DS', () => {
    const tampered: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, isSoundEffectLumpNameRejectsDpPrefix: false };
    const failures = crossCheckSoundEffectLumpRuntime(tampered);
    expect(failures).toContain('derived:IS_SOUND_EFFECT_LUMP_NAME_REJECTS_DP_PC_SPEAKER_PREFIX');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: SoundEffectLumpRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckSoundEffectLumpRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD digital sound effect oracle', () => {
  test('declares the seven pinned sound effects (DSPISTOL, DSPLPAIN, DSITEMUP, DSPOSIT1, DSBAREXP, DSITMBK, DSGETPOW)', () => {
    const names = SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects.map((entry) => entry.name);
    expect(names).toEqual(['DSPISTOL', 'DSPLPAIN', 'DSITEMUP', 'DSPOSIT1', 'DSBAREXP', 'DSITMBK', 'DSGETPOW']);
  });

  test('every pinned sound effect carries the digital DMX format magic (3)', () => {
    for (const oracleSfx of SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects) {
      expect(oracleSfx.format).toBe(SFX_DIGITAL_FORMAT_VALUE);
    }
  });

  test('DSITMBK is pinned at the unique 22050 Hz outlier sample rate', () => {
    const dsitmbk = SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects.find((entry) => entry.name === 'DSITMBK');
    expect(dsitmbk).toBeDefined();
    expect(dsitmbk!.sampleRate).toBe(22050);
  });

  test('every other pinned sound effect runs at the default 11025 Hz sample rate', () => {
    for (const oracleSfx of SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects) {
      if (oracleSfx.name !== 'DSITMBK') {
        expect(oracleSfx.sampleRate).toBe(SFX_DEFAULT_SAMPLE_RATE_HZ);
      }
    }
  });

  test('every pinned sound effect satisfies size === 8 + sampleCount', () => {
    for (const oracleSfx of SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects) {
      expect(oracleSfx.size).toBe(SFX_HEADER_BYTES + oracleSfx.sampleCount);
    }
  });

  test('every pinned sound effect sha256 matches the live IWAD bytes byte-for-byte', () => {
    for (const oracleSfx of SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects) {
      const directoryEntry = liveDirectory[oracleSfx.directoryIndex]!;
      expect(directoryEntry.name).toBe(oracleSfx.name);
      expect(directoryEntry.size).toBe(oracleSfx.size);
      expect(directoryEntry.offset).toBe(oracleSfx.fileOffset);
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const sha256 = createHash('sha256').update(lump).digest('hex');
      expect(sha256).toBe(oracleSfx.sha256);
    }
  });

  test('every pinned sound effect parses through parseSoundEffectLumpHeader and matches the oracle header fields', () => {
    for (const oracleSfx of SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects) {
      const directoryEntry = liveDirectory[oracleSfx.directoryIndex]!;
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const header = parseSoundEffectLumpHeader(lump);
      expect(header.format).toBe(oracleSfx.format);
      expect(header.sampleRate).toBe(oracleSfx.sampleRate);
      expect(header.sampleCount).toBe(oracleSfx.sampleCount);
    }
  });

  test('the live IWAD reports 55 DS lumps spanning directory indices 110..218', () => {
    expect(liveOracleSample.dsLumpCount).toBe(SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.dsLumpCount);
    expect(liveOracleSample.firstDsLumpIndex).toBe(SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.firstDsLumpIndex);
    expect(liveOracleSample.lastDsLumpIndex).toBe(SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.lastDsLumpIndex);
  });

  test('every live sound effect sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on sound-effect lump count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { 'sound-effect': number } };
    expect(manifest.lumpCategories['sound-effect']).toBe(55);
    expect(manifest.lumpCategories['sound-effect']).toBe(SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.dsLumpCount);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });

  test('the live IWAD has no S_START / S_END marker around the DS lumps (sound effects live without a marker range)', () => {
    const dsRange = liveDirectory.slice(SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.firstDsLumpIndex, SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.lastDsLumpIndex + 1);
    for (const entry of dsRange) {
      if (entry.name.startsWith('DS')) {
        continue;
      }
      expect(entry.name === 'S_START' || entry.name === 'S_END').toBe(false);
    }
  });
});

describe('crossCheckShareWareDoom1WadSoundEffectLumpSample failure modes', () => {
  test('detects a wrong dsLumpCount', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = { ...liveOracleSample, dsLumpCount: 999 };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:dsLumpCount:value-mismatch');
  });

  test('detects a wrong firstDsLumpIndex', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = { ...liveOracleSample, firstDsLumpIndex: 0 };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:firstDsLumpIndex:value-mismatch');
  });

  test('detects a wrong lastDsLumpIndex', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = { ...liveOracleSample, lastDsLumpIndex: 0 };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:lastDsLumpIndex:value-mismatch');
  });

  test('detects a missing pinned sound effect', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = {
      ...liveOracleSample,
      pinnedSoundEffects: liveOracleSample.pinnedSoundEffects.filter((entry) => entry.name !== 'DSPISTOL'),
    };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:sfx:DSPISTOL:not-found');
  });

  test('detects a wrong sampleRate on a pinned sound effect', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = {
      ...liveOracleSample,
      pinnedSoundEffects: liveOracleSample.pinnedSoundEffects.map((entry) => (entry.name === 'DSITMBK' ? { ...entry, sampleRate: 11025 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:sfx:DSITMBK:sampleRate:value-mismatch');
  });

  test('detects a wrong sha256 on a pinned sound effect', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = {
      ...liveOracleSample,
      pinnedSoundEffects: liveOracleSample.pinnedSoundEffects.map((entry) => (entry.name === 'DSGETPOW' ? { ...entry, sha256: '0'.repeat(64) } : entry)),
    };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:sfx:DSGETPOW:sha256:value-mismatch');
  });

  test('detects a wrong sampleCount on a pinned sound effect', () => {
    const tampered: ShareWareDoom1WadSoundEffectLumpSample = {
      ...liveOracleSample,
      pinnedSoundEffects: liveOracleSample.pinnedSoundEffects.map((entry) => (entry.name === 'DSPLPAIN' ? { ...entry, sampleCount: 0 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadSoundEffectLumpSample(tampered)).toContain('oracle:sfx:DSPLPAIN:sampleCount:value-mismatch');
  });
});

describe('shareware DOOM1.WAD digital sound effect inventory matches the runtime parser', () => {
  test('every DS lump in directory order parses via parseSoundEffectLumpHeader without throwing', () => {
    for (const { entry } of liveDsEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(() => parseSoundEffectLumpHeader(lump)).not.toThrow();
    }
  });

  test('every DS lump declares the digital DMX format magic (3)', () => {
    for (const { entry } of liveDsEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseSoundEffectLumpHeader(lump);
      expect(header.format).toBe(SFX_DIGITAL_FORMAT_VALUE);
    }
  });

  test('every DS lump body length matches header sampleCount + 8', () => {
    for (const { entry } of liveDsEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseSoundEffectLumpHeader(lump);
      expect(entry.size).toBe(SFX_HEADER_BYTES + header.sampleCount);
    }
  });

  test('exactly one DS lump runs at 22050 Hz (DSITMBK); every other DS lump runs at 11025 Hz', () => {
    const sampleRates = liveDsEntries.map(({ entry }) => {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      return { name: entry.name, sampleRate: parseSoundEffectLumpHeader(lump).sampleRate };
    });
    const at22050 = sampleRates.filter((s) => s.sampleRate === 22050);
    const at11025 = sampleRates.filter((s) => s.sampleRate === 11025);
    expect(at22050.length).toBe(1);
    expect(at22050[0]!.name).toBe('DSITMBK');
    expect(at11025.length).toBe(54);
    expect(at22050.length + at11025.length).toBe(55);
  });

  test('every DS lump name matches the isSoundEffectLumpName predicate', () => {
    for (const { entry } of liveDsEntries) {
      expect(isSoundEffectLumpName(entry.name)).toBe(true);
    }
  });

  test('every DP (PC speaker) lump name does NOT match isSoundEffectLumpName', () => {
    const dpEntries = liveDirectory.filter((entry) => entry.name.length >= 3 && entry.name.startsWith('DP'));
    for (const entry of dpEntries) {
      expect(isSoundEffectLumpName(entry.name)).toBe(false);
    }
  });
});

describe('05-012 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-012-parse-sound-effect-lumps.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/parse-sound-effect-lumps.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/parse-sound-effect-lumps.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
    expect(stepFileText.includes('r_data.c')).toBe(true);
    expect(stepFileText.includes('w_wad.c')).toBe(true);
    expect(stepFileText.includes('p_setup.c')).toBe(true);
  });
});
