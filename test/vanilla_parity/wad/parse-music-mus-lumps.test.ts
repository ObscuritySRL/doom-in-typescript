import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  MUSIC_LUMP_NAME_FIELD_BYTES,
  MUSIC_LUMP_NAME_PREFIX,
  MUSIC_LUMP_NAME_PREFIX_LENGTH,
  MUSIC_MUS_LUMP_AUDIT,
  MUSIC_MUS_LUMP_DERIVED_INVARIANTS,
  MUS_C_STRUCT_HEADER_BYTES,
  MUS_DUMMY_FIELD_BYTES,
  MUS_DUMMY_FIELD_OFFSET,
  MUS_INSTRUMENT_COUNT_FIELD_BYTES,
  MUS_INSTRUMENT_COUNT_FIELD_OFFSET,
  MUS_INSTRUMENT_ENTRY_BYTES,
  MUS_MAGIC_BYTES,
  MUS_MAGIC_FIELD_BYTES,
  MUS_MAGIC_FIELD_OFFSET,
  MUS_ON_DISK_HEADER_BYTES,
  MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES,
  MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET,
  MUS_SCORE_LENGTH_FIELD_BYTES,
  MUS_SCORE_LENGTH_FIELD_OFFSET,
  MUS_SCORE_START_FIELD_BYTES,
  MUS_SCORE_START_FIELD_OFFSET,
  MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES,
  MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET,
  SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE,
  crossCheckMusicMusLumpRuntime,
  crossCheckShareWareDoom1WadMusicMusLumpSample,
  isMusicMusLumpName,
  musicMusLumpScoreStartOffset,
  parseMusicMusLumpHeader,
} from '../../../src/assets/parse-music-mus-lumps.ts';
import type { MusicMusLumpAuditEntry, MusicMusLumpRuntimeSnapshot, ShareWareDoom1WadMusicMusLumpSample } from '../../../src/assets/parse-music-mus-lumps.ts';

const ALLOWED_AXIS_IDS = new Set<MusicMusLumpAuditEntry['id']>([
  'music-lump-name-prefix-d-underscore',
  'music-lump-name-formed-via-sprintf-d-underscore-percent-s',
  'music-lump-name-lookup-via-w-getnumforname',
  'music-lump-c-struct-bytes-fourteen',
  'music-lump-on-disk-header-bytes-sixteen',
  'music-lump-magic-field-offset-zero',
  'music-lump-magic-field-bytes-four',
  'music-lump-magic-bytes-mus-eof',
  'music-lump-score-length-field-offset-four-uint16-le',
  'music-lump-score-start-field-offset-six-uint16-le',
  'music-lump-primary-channel-count-field-offset-eight-uint16-le',
  'music-lump-secondary-channel-count-field-offset-ten-uint16-le',
  'music-lump-instrument-count-field-offset-twelve-uint16-le',
  'music-lump-dummy-field-offset-fourteen-uint16-le',
  'music-lump-instrument-list-uint16-le-entries',
  'music-lump-score-data-located-by-score-start',
  'music-lump-no-marker-range',
  'music-lump-shareware-doom1-thirteen-musics',
]);
const ALLOWED_SUBJECTS = new Set<MusicMusLumpAuditEntry['subject']>(['D_-lump', 'S_ChangeMusic', 'mus2mid.c-musheader', 'parseMusicMusLumpHeader', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<MusicMusLumpAuditEntry['referenceSourceFile']>(['linuxdoom-1.10/s_sound.c', 'src/mus2mid.c', 'src/i_sdlmusic.c', 'shareware/DOOM1.WAD']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveDEntries = liveDirectory.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.name.length >= 3 && entry.name.startsWith('D_'));

function buildValidLumpBytes({
  scoreLength = 16,
  primaryChannelCount = 3,
  secondaryChannelCount = 0,
  instrumentCount = 4,
  magic = MUS_MAGIC_BYTES,
}: {
  scoreLength?: number;
  primaryChannelCount?: number;
  secondaryChannelCount?: number;
  instrumentCount?: number;
  magic?: readonly number[];
} = {}): Buffer {
  const scoreStart = MUS_ON_DISK_HEADER_BYTES + instrumentCount * MUS_INSTRUMENT_ENTRY_BYTES;
  const buffer = Buffer.alloc(scoreStart + scoreLength);
  for (let index = 0; index < MUS_MAGIC_FIELD_BYTES; index += 1) {
    buffer[MUS_MAGIC_FIELD_OFFSET + index] = magic[index] ?? 0;
  }
  buffer.writeUint16LE(scoreLength, MUS_SCORE_LENGTH_FIELD_OFFSET);
  buffer.writeUint16LE(scoreStart, MUS_SCORE_START_FIELD_OFFSET);
  buffer.writeUint16LE(primaryChannelCount, MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET);
  buffer.writeUint16LE(secondaryChannelCount, MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET);
  buffer.writeUint16LE(instrumentCount, MUS_INSTRUMENT_COUNT_FIELD_OFFSET);
  buffer.writeUint16LE(0, MUS_DUMMY_FIELD_OFFSET);
  for (let index = 0; index < instrumentCount; index += 1) {
    buffer.writeUint16LE(index + 1, MUS_ON_DISK_HEADER_BYTES + index * MUS_INSTRUMENT_ENTRY_BYTES);
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

const validLump = buildValidLumpBytes({ scoreLength: 16, instrumentCount: 4 });
const parsedValidHeader = parseMusicMusLumpHeader(validLump);

const tooSmallBuffer = Buffer.alloc(MUS_ON_DISK_HEADER_BYTES - 1);
const badMagicBuffer = (() => {
  const buffer = buildValidLumpBytes();
  buffer[0] = 0x00;
  return buffer;
})();
const overlapBuffer = (() => {
  const buffer = buildValidLumpBytes({ instrumentCount: 4 });
  buffer.writeUint16LE(20, MUS_SCORE_START_FIELD_OFFSET);
  return buffer;
})();
const scoreOutOfBoundsBuffer = (() => {
  const buffer = buildValidLumpBytes({ instrumentCount: 4 });
  buffer.writeUint16LE(buffer.length, MUS_SCORE_LENGTH_FIELD_OFFSET);
  return buffer;
})();

const parserRejectsBufferTooSmallForHeader = tryThrows(() => parseMusicMusLumpHeader(tooSmallBuffer));
const parserRejectsBadMagic = tryThrows(() => parseMusicMusLumpHeader(badMagicBuffer));
const parserRejectsInstrumentListOverlap = tryThrows(() => parseMusicMusLumpHeader(overlapBuffer));
const parserRejectsScoreOutOfBounds = tryThrows(() => parseMusicMusLumpHeader(scoreOutOfBoundsBuffer));

function buildLiveRuntimeSnapshot(): MusicMusLumpRuntimeSnapshot {
  const magicMatches = MUS_MAGIC_BYTES.length === 4 && MUS_MAGIC_BYTES[0] === 0x4d && MUS_MAGIC_BYTES[1] === 0x55 && MUS_MAGIC_BYTES[2] === 0x53 && MUS_MAGIC_BYTES[3] === 0x1a;
  return {
    musicLumpNamePrefix: MUSIC_LUMP_NAME_PREFIX,
    musicLumpNamePrefixLength: MUSIC_LUMP_NAME_PREFIX_LENGTH,
    musicLumpNameFieldBytes: MUSIC_LUMP_NAME_FIELD_BYTES,
    musCStructHeaderBytes: MUS_C_STRUCT_HEADER_BYTES,
    musOnDiskHeaderBytes: MUS_ON_DISK_HEADER_BYTES,
    musMagicFieldOffset: MUS_MAGIC_FIELD_OFFSET,
    musMagicFieldBytes: MUS_MAGIC_FIELD_BYTES,
    musMagicBytesEqualMUSEof: magicMatches,
    musScoreLengthFieldOffset: MUS_SCORE_LENGTH_FIELD_OFFSET,
    musScoreLengthFieldBytes: MUS_SCORE_LENGTH_FIELD_BYTES,
    musScoreStartFieldOffset: MUS_SCORE_START_FIELD_OFFSET,
    musScoreStartFieldBytes: MUS_SCORE_START_FIELD_BYTES,
    musPrimaryChannelCountFieldOffset: MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET,
    musPrimaryChannelCountFieldBytes: MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES,
    musSecondaryChannelCountFieldOffset: MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET,
    musSecondaryChannelCountFieldBytes: MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES,
    musInstrumentCountFieldOffset: MUS_INSTRUMENT_COUNT_FIELD_OFFSET,
    musInstrumentCountFieldBytes: MUS_INSTRUMENT_COUNT_FIELD_BYTES,
    musDummyFieldOffset: MUS_DUMMY_FIELD_OFFSET,
    musDummyFieldBytes: MUS_DUMMY_FIELD_BYTES,
    musInstrumentEntryBytes: MUS_INSTRUMENT_ENTRY_BYTES,
    parserReturnsFrozenHeader: Object.isFrozen(parsedValidHeader) && Object.isFrozen(parsedValidHeader.instruments),
    parserRejectsBufferTooSmallForHeader,
    parserRejectsBadMagic,
    parserRejectsInstrumentListOverlap,
    parserRejectsScoreOutOfBounds,
    isMusicMusLumpNameAcceptsDUnderscorePrefix: isMusicMusLumpName('D_E1M1'),
    isMusicMusLumpNameRejectsDsPrefix: isMusicMusLumpName('DSPISTOL') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadMusicMusLumpSample {
  const pinnedMusicLumps = SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps.map((oracleEntry) => {
    const liveEntry = liveDEntries.find(({ entry }) => entry.name === oracleEntry.name);
    if (!liveEntry) {
      throw new Error(`pinned music lump ${oracleEntry.name} not found in live IWAD`);
    }
    const directoryEntry = liveEntry.entry;
    const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
    const header = parseMusicMusLumpHeader(lump);
    return {
      name: directoryEntry.name,
      directoryIndex: liveEntry.index,
      fileOffset: directoryEntry.offset,
      size: directoryEntry.size,
      scoreLength: header.scoreLength,
      scoreStart: header.scoreStart,
      primaryChannelCount: header.primaryChannelCount,
      secondaryChannelCount: header.secondaryChannelCount,
      instrumentCount: header.instrumentCount,
      sha256: createHash('sha256').update(lump).digest('hex'),
    };
  });
  return {
    dLumpCount: liveDEntries.length,
    firstDLumpIndex: liveDEntries[0]!.index,
    lastDLumpIndex: liveDEntries[liveDEntries.length - 1]!.index,
    pinnedMusicLumps,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('music MUS lump audit ledger shape', () => {
  test('audits exactly eighteen behavioral axes', () => {
    expect(MUSIC_MUS_LUMP_AUDIT.length).toBe(18);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of MUSIC_MUS_LUMP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = MUSIC_MUS_LUMP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of MUSIC_MUS_LUMP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of MUSIC_MUS_LUMP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of MUSIC_MUS_LUMP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of MUSIC_MUS_LUMP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the prefix-d-underscore axis cites the upstream lowercase sprintf format string', () => {
    const entry = MUSIC_MUS_LUMP_AUDIT.find((e) => e.id === 'music-lump-name-prefix-d-underscore');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('"d_%s"'))).toBe(true);
  });

  test('the magic-bytes-mus-eof axis cites the upstream four-byte magic check', () => {
    const entry = MUSIC_MUS_LUMP_AUDIT.find((e) => e.id === 'music-lump-magic-bytes-mus-eof');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes("'M'"))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes("'U'"))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes("'S'"))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('0x1A'))).toBe(true);
  });

  test('the c-struct-bytes-fourteen axis cites the upstream musheader struct definition', () => {
    const entry = MUSIC_MUS_LUMP_AUDIT.find((e) => e.id === 'music-lump-c-struct-bytes-fourteen');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('byte id[4]'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('unsigned short scorelength'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('unsigned short instrumentcount'))).toBe(true);
  });

  test('the score-data-located-by-score-start axis cites the upstream mem_fseek to scorestart', () => {
    const entry = MUSIC_MUS_LUMP_AUDIT.find((e) => e.id === 'music-lump-score-data-located-by-score-start');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('mem_fseek') && line.includes('scorestart'))).toBe(true);
  });

  test('the shareware-thirteen-musics axis names the shareware DOOM1.WAD file', () => {
    const entry = MUSIC_MUS_LUMP_AUDIT.find((e) => e.id === 'music-lump-shareware-doom1-thirteen-musics');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('shareware-doom1.wad');
    expect(entry!.invariant.includes('13')).toBe(true);
  });
});

describe('music MUS lump derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = MUSIC_MUS_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(MUSIC_MUS_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'MUSIC_LUMP_NAME_PREFIX_EQUALS_D_UNDERSCORE',
        'MUSIC_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO',
        'MUSIC_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT',
        'MUS_C_STRUCT_HEADER_BYTES_EQUALS_FOURTEEN',
        'MUS_ON_DISK_HEADER_BYTES_EQUALS_SIXTEEN',
        'MUS_MAGIC_FIELD_OFFSET_EQUALS_ZERO',
        'MUS_MAGIC_FIELD_BYTES_EQUALS_FOUR',
        'MUS_MAGIC_BYTES_EQUAL_M_U_S_EOF',
        'MUS_SCORE_LENGTH_FIELD_OFFSET_EQUALS_FOUR',
        'MUS_SCORE_LENGTH_FIELD_BYTES_EQUALS_TWO',
        'MUS_SCORE_START_FIELD_OFFSET_EQUALS_SIX',
        'MUS_SCORE_START_FIELD_BYTES_EQUALS_TWO',
        'MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_EIGHT',
        'MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO',
        'MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_TEN',
        'MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO',
        'MUS_INSTRUMENT_COUNT_FIELD_OFFSET_EQUALS_TWELVE',
        'MUS_INSTRUMENT_COUNT_FIELD_BYTES_EQUALS_TWO',
        'MUS_DUMMY_FIELD_OFFSET_EQUALS_FOURTEEN',
        'MUS_DUMMY_FIELD_BYTES_EQUALS_TWO',
        'MUS_INSTRUMENT_ENTRY_BYTES_EQUALS_TWO',
        'PARSE_MUSIC_MUS_LUMP_HEADER_RETURNS_FROZEN_HEADER',
        'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BAD_MAGIC',
        'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_INSTRUMENT_LIST_OVERLAPS_HEADER',
        'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_SCORE_OUT_OF_BOUNDS',
        'IS_MUSIC_MUS_LUMP_NAME_REQUIRES_D_UNDERSCORE_PREFIX',
        'IS_MUSIC_MUS_LUMP_NAME_REJECTS_DS_PREFIX',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of MUSIC_MUS_LUMP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('MUSIC_LUMP_NAME_PREFIX is the uppercase "D_" string', () => {
    expect(MUSIC_LUMP_NAME_PREFIX).toBe('D_');
  });

  test('MUSIC_LUMP_NAME_PREFIX_LENGTH equals 2 (matches lowercase "d_" literal in sprintf)', () => {
    expect(MUSIC_LUMP_NAME_PREFIX_LENGTH).toBe(2);
    expect(MUSIC_LUMP_NAME_PREFIX_LENGTH).toBe(MUSIC_LUMP_NAME_PREFIX.length);
  });

  test('MUSIC_LUMP_NAME_FIELD_BYTES equals 8 (matches WAD directory name field)', () => {
    expect(MUSIC_LUMP_NAME_FIELD_BYTES).toBe(8);
  });

  test('MUS_C_STRUCT_HEADER_BYTES equals 14 (mus2mid.c struct: 4 + 5*2)', () => {
    expect(MUS_C_STRUCT_HEADER_BYTES).toBe(14);
  });

  test('MUS_ON_DISK_HEADER_BYTES equals 16 (effective on-disk header before instruments)', () => {
    expect(MUS_ON_DISK_HEADER_BYTES).toBe(16);
  });

  test('MUS_MAGIC_FIELD_OFFSET equals 0', () => {
    expect(MUS_MAGIC_FIELD_OFFSET).toBe(0);
  });

  test('MUS_MAGIC_FIELD_BYTES equals 4', () => {
    expect(MUS_MAGIC_FIELD_BYTES).toBe(4);
  });

  test('MUS_MAGIC_BYTES is the byte sequence M U S 0x1A', () => {
    expect(MUS_MAGIC_BYTES.length).toBe(4);
    expect(MUS_MAGIC_BYTES[0]).toBe(0x4d);
    expect(MUS_MAGIC_BYTES[1]).toBe(0x55);
    expect(MUS_MAGIC_BYTES[2]).toBe(0x53);
    expect(MUS_MAGIC_BYTES[3]).toBe(0x1a);
  });

  test('MUS_MAGIC_BYTES is frozen', () => {
    expect(Object.isFrozen(MUS_MAGIC_BYTES)).toBe(true);
  });

  test('MUS_SCORE_LENGTH_FIELD_OFFSET equals 4', () => {
    expect(MUS_SCORE_LENGTH_FIELD_OFFSET).toBe(4);
  });

  test('MUS_SCORE_LENGTH_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(MUS_SCORE_LENGTH_FIELD_BYTES).toBe(2);
  });

  test('MUS_SCORE_START_FIELD_OFFSET equals 6', () => {
    expect(MUS_SCORE_START_FIELD_OFFSET).toBe(6);
  });

  test('MUS_SCORE_START_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(MUS_SCORE_START_FIELD_BYTES).toBe(2);
  });

  test('MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET equals 8', () => {
    expect(MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET).toBe(8);
  });

  test('MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES).toBe(2);
  });

  test('MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET equals 10', () => {
    expect(MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET).toBe(10);
  });

  test('MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES).toBe(2);
  });

  test('MUS_INSTRUMENT_COUNT_FIELD_OFFSET equals 12', () => {
    expect(MUS_INSTRUMENT_COUNT_FIELD_OFFSET).toBe(12);
  });

  test('MUS_INSTRUMENT_COUNT_FIELD_BYTES equals 2 (uint16-LE)', () => {
    expect(MUS_INSTRUMENT_COUNT_FIELD_BYTES).toBe(2);
  });

  test('MUS_DUMMY_FIELD_OFFSET equals 14', () => {
    expect(MUS_DUMMY_FIELD_OFFSET).toBe(14);
  });

  test('MUS_DUMMY_FIELD_BYTES equals 2', () => {
    expect(MUS_DUMMY_FIELD_BYTES).toBe(2);
  });

  test('MUS_INSTRUMENT_ENTRY_BYTES equals 2 (uint16-LE per instrument)', () => {
    expect(MUS_INSTRUMENT_ENTRY_BYTES).toBe(2);
  });

  test('the C struct + dummy field add up to the on-disk header bytes', () => {
    expect(MUS_C_STRUCT_HEADER_BYTES + MUS_DUMMY_FIELD_BYTES).toBe(MUS_ON_DISK_HEADER_BYTES);
  });

  test('the field offsets cover the 14-byte C struct without gaps', () => {
    expect(MUS_MAGIC_FIELD_OFFSET + MUS_MAGIC_FIELD_BYTES).toBe(MUS_SCORE_LENGTH_FIELD_OFFSET);
    expect(MUS_SCORE_LENGTH_FIELD_OFFSET + MUS_SCORE_LENGTH_FIELD_BYTES).toBe(MUS_SCORE_START_FIELD_OFFSET);
    expect(MUS_SCORE_START_FIELD_OFFSET + MUS_SCORE_START_FIELD_BYTES).toBe(MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET);
    expect(MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET + MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES).toBe(MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET);
    expect(MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET + MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES).toBe(MUS_INSTRUMENT_COUNT_FIELD_OFFSET);
    expect(MUS_INSTRUMENT_COUNT_FIELD_OFFSET + MUS_INSTRUMENT_COUNT_FIELD_BYTES).toBe(MUS_DUMMY_FIELD_OFFSET);
    expect(MUS_DUMMY_FIELD_OFFSET + MUS_DUMMY_FIELD_BYTES).toBe(MUS_ON_DISK_HEADER_BYTES);
  });
});

describe('musicMusLumpScoreStartOffset runtime contract', () => {
  test('returns MUS_ON_DISK_HEADER_BYTES + instrumentCount * 2 for non-negative integers', () => {
    expect(musicMusLumpScoreStartOffset(0)).toBe(16);
    expect(musicMusLumpScoreStartOffset(1)).toBe(18);
    expect(musicMusLumpScoreStartOffset(4)).toBe(24);
    expect(musicMusLumpScoreStartOffset(15)).toBe(46);
    expect(musicMusLumpScoreStartOffset(21)).toBe(58);
  });

  test('throws RangeError on a negative count', () => {
    expect(() => musicMusLumpScoreStartOffset(-1)).toThrow(RangeError);
  });

  test('throws RangeError on a non-integer count', () => {
    expect(() => musicMusLumpScoreStartOffset(1.5)).toThrow(RangeError);
  });
});

describe('parseMusicMusLumpHeader runtime contract', () => {
  test('returns a frozen header on a valid synthesised lump', () => {
    const lump = buildValidLumpBytes({ scoreLength: 16, instrumentCount: 4, primaryChannelCount: 3 });
    const header = parseMusicMusLumpHeader(lump);
    expect(Object.isFrozen(header)).toBe(true);
    expect(Object.isFrozen(header.instruments)).toBe(true);
    expect(header.scoreLength).toBe(16);
    expect(header.scoreStart).toBe(24);
    expect(header.primaryChannelCount).toBe(3);
    expect(header.secondaryChannelCount).toBe(0);
    expect(header.instrumentCount).toBe(4);
    expect(header.instruments).toEqual([1, 2, 3, 4]);
  });

  test('reads the scoreLength as little-endian uint16', () => {
    const lump = buildValidLumpBytes({ scoreLength: 0x1234, instrumentCount: 2 });
    const header = parseMusicMusLumpHeader(lump);
    expect(header.scoreLength).toBe(0x1234);
  });

  test('reads the scoreStart as little-endian uint16', () => {
    const lump = buildValidLumpBytes({ instrumentCount: 7 });
    const header = parseMusicMusLumpHeader(lump);
    expect(header.scoreStart).toBe(16 + 7 * 2);
  });

  test('reads the primaryChannelCount as little-endian uint16', () => {
    const lump = buildValidLumpBytes({ primaryChannelCount: 11, instrumentCount: 1 });
    const header = parseMusicMusLumpHeader(lump);
    expect(header.primaryChannelCount).toBe(11);
  });

  test('reads the secondaryChannelCount as little-endian uint16', () => {
    const lump = buildValidLumpBytes({ secondaryChannelCount: 0, instrumentCount: 1 });
    const header = parseMusicMusLumpHeader(lump);
    expect(header.secondaryChannelCount).toBe(0);
  });

  test('reads the instrumentCount as little-endian uint16', () => {
    const lump = buildValidLumpBytes({ instrumentCount: 21 });
    const header = parseMusicMusLumpHeader(lump);
    expect(header.instrumentCount).toBe(21);
    expect(header.instruments.length).toBe(21);
  });

  test('throws RangeError on a buffer too small for the header', () => {
    expect(() => parseMusicMusLumpHeader(Buffer.alloc(15))).toThrow(RangeError);
  });

  test('throws RangeError on a mismatched magic byte 0', () => {
    const buffer = buildValidLumpBytes();
    buffer[0] = 0x00;
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError on a mismatched magic byte 1', () => {
    const buffer = buildValidLumpBytes();
    buffer[1] = 0x00;
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError on a mismatched magic byte 2', () => {
    const buffer = buildValidLumpBytes();
    buffer[2] = 0x00;
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError on a mismatched magic byte 3 (the 0x1A EOF marker)', () => {
    const buffer = buildValidLumpBytes();
    buffer[3] = 0x00;
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError when scoreStart overlaps the instrument list', () => {
    const buffer = buildValidLumpBytes({ instrumentCount: 4 });
    buffer.writeUint16LE(20, MUS_SCORE_START_FIELD_OFFSET);
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError when scoreStart + scoreLength exceeds the lump size', () => {
    const buffer = buildValidLumpBytes({ instrumentCount: 4 });
    buffer.writeUint16LE(buffer.length, MUS_SCORE_LENGTH_FIELD_OFFSET);
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });

  test('accepts both Buffer and Uint8Array inputs', () => {
    const buffer = buildValidLumpBytes({ instrumentCount: 4 });
    const headerFromBuffer = parseMusicMusLumpHeader(buffer);
    const u8 = new Uint8Array(buffer);
    const headerFromU8 = parseMusicMusLumpHeader(u8);
    expect(headerFromBuffer.scoreLength).toBe(headerFromU8.scoreLength);
    expect(headerFromBuffer.scoreStart).toBe(headerFromU8.scoreStart);
    expect(headerFromBuffer.primaryChannelCount).toBe(headerFromU8.primaryChannelCount);
    expect(headerFromBuffer.secondaryChannelCount).toBe(headerFromU8.secondaryChannelCount);
    expect(headerFromBuffer.instrumentCount).toBe(headerFromU8.instrumentCount);
    expect([...headerFromBuffer.instruments]).toEqual([...headerFromU8.instruments]);
  });

  test('throws RangeError when buffer is large enough for the header but not for the declared instrument list', () => {
    const buffer = buildValidLumpBytes({ instrumentCount: 4, scoreLength: 0 });
    buffer.writeUint16LE(50, MUS_INSTRUMENT_COUNT_FIELD_OFFSET);
    expect(() => parseMusicMusLumpHeader(buffer)).toThrow(RangeError);
  });
});

describe('isMusicMusLumpName runtime contract', () => {
  test('accepts the uppercase D_ prefix used by the WAD directory', () => {
    expect(isMusicMusLumpName('D_E1M1')).toBe(true);
    expect(isMusicMusLumpName('D_INTRO')).toBe(true);
    expect(isMusicMusLumpName('D_INTROA')).toBe(true);
    expect(isMusicMusLumpName('D_VICTOR')).toBe(true);
  });

  test('accepts the lowercase d_ prefix that vanilla source uses literally', () => {
    expect(isMusicMusLumpName('d_e1m1')).toBe(true);
  });

  test('rejects the DS digital sound effect prefix sibling', () => {
    expect(isMusicMusLumpName('DSPISTOL')).toBe(false);
    expect(isMusicMusLumpName('DSGETPOW')).toBe(false);
  });

  test('rejects the DP PC speaker prefix sibling', () => {
    expect(isMusicMusLumpName('DPPISTOL')).toBe(false);
  });

  test('rejects a name that is exactly the prefix length', () => {
    expect(isMusicMusLumpName('D_')).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(isMusicMusLumpName('')).toBe(false);
  });

  test('rejects a non-D_ prefix', () => {
    expect(isMusicMusLumpName('PLAYPAL')).toBe(false);
    expect(isMusicMusLumpName('PNAMES')).toBe(false);
    expect(isMusicMusLumpName('S_START')).toBe(false);
  });
});

describe('crossCheckMusicMusLumpRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckMusicMusLumpRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckMusicMusLumpRuntime failure modes', () => {
  test('detects a tampered MUSIC_LUMP_NAME_PREFIX that no longer equals "D_"', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musicLumpNamePrefix: 'XX' };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUSIC_LUMP_NAME_PREFIX_EQUALS_D_UNDERSCORE');
    expect(failures).toContain('audit:music-lump-name-prefix-d-underscore:not-observed');
  });

  test('detects a tampered MUSIC_LUMP_NAME_PREFIX_LENGTH', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musicLumpNamePrefixLength: 3 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUSIC_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO');
    expect(failures).toContain('audit:music-lump-name-formed-via-sprintf-d-underscore-percent-s:not-observed');
  });

  test('detects a tampered MUSIC_LUMP_NAME_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musicLumpNameFieldBytes: 16 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUSIC_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT');
  });

  test('detects a tampered MUS_C_STRUCT_HEADER_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musCStructHeaderBytes: 16 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_C_STRUCT_HEADER_BYTES_EQUALS_FOURTEEN');
    expect(failures).toContain('audit:music-lump-c-struct-bytes-fourteen:not-observed');
  });

  test('detects a tampered MUS_ON_DISK_HEADER_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musOnDiskHeaderBytes: 14 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_ON_DISK_HEADER_BYTES_EQUALS_SIXTEEN');
    expect(failures).toContain('audit:music-lump-on-disk-header-bytes-sixteen:not-observed');
  });

  test('detects a tampered MUS_MAGIC_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musMagicFieldOffset: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_MAGIC_FIELD_OFFSET_EQUALS_ZERO');
    expect(failures).toContain('audit:music-lump-magic-field-offset-zero:not-observed');
  });

  test('detects a tampered MUS_MAGIC_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musMagicFieldBytes: 8 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_MAGIC_FIELD_BYTES_EQUALS_FOUR');
    expect(failures).toContain('audit:music-lump-magic-field-bytes-four:not-observed');
  });

  test('detects a tampered MUS_MAGIC_BYTES that no longer matches MUS+0x1a', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musMagicBytesEqualMUSEof: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_MAGIC_BYTES_EQUAL_M_U_S_EOF');
    expect(failures).toContain('audit:music-lump-magic-bytes-mus-eof:not-observed');
  });

  test('detects a tampered MUS_SCORE_LENGTH_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musScoreLengthFieldOffset: 6 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_SCORE_LENGTH_FIELD_OFFSET_EQUALS_FOUR');
    expect(failures).toContain('audit:music-lump-score-length-field-offset-four-uint16-le:not-observed');
  });

  test('detects a tampered MUS_SCORE_LENGTH_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musScoreLengthFieldBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_SCORE_LENGTH_FIELD_BYTES_EQUALS_TWO');
  });

  test('detects a tampered MUS_SCORE_START_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musScoreStartFieldOffset: 8 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_SCORE_START_FIELD_OFFSET_EQUALS_SIX');
    expect(failures).toContain('audit:music-lump-score-start-field-offset-six-uint16-le:not-observed');
  });

  test('detects a tampered MUS_SCORE_START_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musScoreStartFieldBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_SCORE_START_FIELD_BYTES_EQUALS_TWO');
  });

  test('detects a tampered MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musPrimaryChannelCountFieldOffset: 10 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_EIGHT');
    expect(failures).toContain('audit:music-lump-primary-channel-count-field-offset-eight-uint16-le:not-observed');
  });

  test('detects a tampered MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musPrimaryChannelCountFieldBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO');
  });

  test('detects a tampered MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musSecondaryChannelCountFieldOffset: 12 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_TEN');
    expect(failures).toContain('audit:music-lump-secondary-channel-count-field-offset-ten-uint16-le:not-observed');
  });

  test('detects a tampered MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musSecondaryChannelCountFieldBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO');
  });

  test('detects a tampered MUS_INSTRUMENT_COUNT_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musInstrumentCountFieldOffset: 14 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_INSTRUMENT_COUNT_FIELD_OFFSET_EQUALS_TWELVE');
    expect(failures).toContain('audit:music-lump-instrument-count-field-offset-twelve-uint16-le:not-observed');
  });

  test('detects a tampered MUS_INSTRUMENT_COUNT_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musInstrumentCountFieldBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_INSTRUMENT_COUNT_FIELD_BYTES_EQUALS_TWO');
  });

  test('detects a tampered MUS_DUMMY_FIELD_OFFSET', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musDummyFieldOffset: 16 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_DUMMY_FIELD_OFFSET_EQUALS_FOURTEEN');
    expect(failures).toContain('audit:music-lump-dummy-field-offset-fourteen-uint16-le:not-observed');
  });

  test('detects a tampered MUS_DUMMY_FIELD_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musDummyFieldBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_DUMMY_FIELD_BYTES_EQUALS_TWO');
  });

  test('detects a tampered MUS_INSTRUMENT_ENTRY_BYTES', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, musInstrumentEntryBytes: 4 };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:MUS_INSTRUMENT_ENTRY_BYTES_EQUALS_TWO');
    expect(failures).toContain('audit:music-lump-instrument-list-uint16-le-entries:not-observed');
  });

  test('detects a parser that fails to freeze the returned header', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFrozenHeader: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_MUSIC_MUS_LUMP_HEADER_RETURNS_FROZEN_HEADER');
  });

  test('detects a parser that silently accepts a too-small buffer', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  });

  test('detects a parser that silently accepts a bad magic', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBadMagic: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BAD_MAGIC');
    expect(failures).toContain('audit:music-lump-magic-bytes-mus-eof:not-observed');
  });

  test('detects a parser that silently accepts an instrument-list overlap', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsInstrumentListOverlap: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_INSTRUMENT_LIST_OVERLAPS_HEADER');
  });

  test('detects a parser that silently accepts a score region exceeding the lump', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsScoreOutOfBounds: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_SCORE_OUT_OF_BOUNDS');
    expect(failures).toContain('audit:music-lump-score-data-located-by-score-start:not-observed');
  });

  test('detects an isMusicMusLumpName that no longer accepts the D_ prefix', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, isMusicMusLumpNameAcceptsDUnderscorePrefix: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:IS_MUSIC_MUS_LUMP_NAME_REQUIRES_D_UNDERSCORE_PREFIX');
    expect(failures).toContain('audit:music-lump-name-lookup-via-w-getnumforname:not-observed');
  });

  test('detects an isMusicMusLumpName that classifies DS lumps as music', () => {
    const tampered: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, isMusicMusLumpNameRejectsDsPrefix: false };
    const failures = crossCheckMusicMusLumpRuntime(tampered);
    expect(failures).toContain('derived:IS_MUSIC_MUS_LUMP_NAME_REJECTS_DS_PREFIX');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: MusicMusLumpRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckMusicMusLumpRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD music MUS oracle', () => {
  test('declares the six pinned music lumps (D_E1M1, D_E1M5, D_E1M8, D_INTER, D_INTRO, D_INTROA)', () => {
    const names = SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps.map((entry) => entry.name);
    expect(names).toEqual(['D_E1M1', 'D_E1M5', 'D_E1M8', 'D_INTER', 'D_INTRO', 'D_INTROA']);
  });

  test('every pinned music lump has secondaryChannelCount === 0', () => {
    for (const oracleMusic of SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps) {
      expect(oracleMusic.secondaryChannelCount).toBe(0);
    }
  });

  test('every pinned music lump satisfies scoreStart === 16 + instrumentCount * 2', () => {
    for (const oracleMusic of SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps) {
      expect(oracleMusic.scoreStart).toBe(MUS_ON_DISK_HEADER_BYTES + oracleMusic.instrumentCount * MUS_INSTRUMENT_ENTRY_BYTES);
    }
  });

  test('every pinned music lump satisfies size >= scoreStart + scoreLength', () => {
    for (const oracleMusic of SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps) {
      expect(oracleMusic.size).toBeGreaterThanOrEqual(oracleMusic.scoreStart + oracleMusic.scoreLength);
    }
  });

  test('every pinned music lump sha256 matches the live IWAD bytes byte-for-byte', () => {
    for (const oracleMusic of SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps) {
      const directoryEntry = liveDirectory[oracleMusic.directoryIndex]!;
      expect(directoryEntry.name).toBe(oracleMusic.name);
      expect(directoryEntry.size).toBe(oracleMusic.size);
      expect(directoryEntry.offset).toBe(oracleMusic.fileOffset);
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const sha256 = createHash('sha256').update(lump).digest('hex');
      expect(sha256).toBe(oracleMusic.sha256);
    }
  });

  test('every pinned music lump parses through parseMusicMusLumpHeader and matches the oracle header fields', () => {
    for (const oracleMusic of SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps) {
      const directoryEntry = liveDirectory[oracleMusic.directoryIndex]!;
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const header = parseMusicMusLumpHeader(lump);
      expect(header.scoreLength).toBe(oracleMusic.scoreLength);
      expect(header.scoreStart).toBe(oracleMusic.scoreStart);
      expect(header.primaryChannelCount).toBe(oracleMusic.primaryChannelCount);
      expect(header.secondaryChannelCount).toBe(oracleMusic.secondaryChannelCount);
      expect(header.instrumentCount).toBe(oracleMusic.instrumentCount);
      expect(header.instruments.length).toBe(oracleMusic.instrumentCount);
    }
  });

  test('the live IWAD reports 13 D_ lumps spanning directory indices 219..231', () => {
    expect(liveOracleSample.dLumpCount).toBe(SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.dLumpCount);
    expect(liveOracleSample.firstDLumpIndex).toBe(SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.firstDLumpIndex);
    expect(liveOracleSample.lastDLumpIndex).toBe(SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.lastDLumpIndex);
  });

  test('every live music sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on music lump count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { music: number } };
    expect(manifest.lumpCategories.music).toBe(13);
    expect(manifest.lumpCategories.music).toBe(SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.dLumpCount);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });

  test('the live IWAD has no marker range around the D_ lumps', () => {
    const dRange = liveDirectory.slice(SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.firstDLumpIndex, SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.lastDLumpIndex + 1);
    for (const entry of dRange) {
      if (entry.name.startsWith('D_')) {
        continue;
      }
      expect(entry.name === 'S_START' || entry.name === 'S_END' || entry.name === 'F_START' || entry.name === 'F_END' || entry.name === 'P_START' || entry.name === 'P_END').toBe(false);
    }
  });
});

describe('crossCheckShareWareDoom1WadMusicMusLumpSample failure modes', () => {
  test('detects a wrong dLumpCount', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = { ...liveOracleSample, dLumpCount: 999 };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:dLumpCount:value-mismatch');
  });

  test('detects a wrong firstDLumpIndex', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = { ...liveOracleSample, firstDLumpIndex: 0 };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:firstDLumpIndex:value-mismatch');
  });

  test('detects a wrong lastDLumpIndex', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = { ...liveOracleSample, lastDLumpIndex: 0 };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:lastDLumpIndex:value-mismatch');
  });

  test('detects a missing pinned music lump', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = {
      ...liveOracleSample,
      pinnedMusicLumps: liveOracleSample.pinnedMusicLumps.filter((entry) => entry.name !== 'D_E1M1'),
    };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:music:D_E1M1:not-found');
  });

  test('detects a wrong primaryChannelCount on a pinned music lump', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = {
      ...liveOracleSample,
      pinnedMusicLumps: liveOracleSample.pinnedMusicLumps.map((entry) => (entry.name === 'D_E1M1' ? { ...entry, primaryChannelCount: 99 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:music:D_E1M1:primaryChannelCount:value-mismatch');
  });

  test('detects a wrong sha256 on a pinned music lump', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = {
      ...liveOracleSample,
      pinnedMusicLumps: liveOracleSample.pinnedMusicLumps.map((entry) => (entry.name === 'D_INTROA' ? { ...entry, sha256: '0'.repeat(64) } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:music:D_INTROA:sha256:value-mismatch');
  });

  test('detects a wrong scoreLength on a pinned music lump', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = {
      ...liveOracleSample,
      pinnedMusicLumps: liveOracleSample.pinnedMusicLumps.map((entry) => (entry.name === 'D_E1M5' ? { ...entry, scoreLength: 0 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:music:D_E1M5:scoreLength:value-mismatch');
  });

  test('detects a wrong instrumentCount on a pinned music lump', () => {
    const tampered: ShareWareDoom1WadMusicMusLumpSample = {
      ...liveOracleSample,
      pinnedMusicLumps: liveOracleSample.pinnedMusicLumps.map((entry) => (entry.name === 'D_E1M8' ? { ...entry, instrumentCount: 0 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMusicMusLumpSample(tampered)).toContain('oracle:music:D_E1M8:instrumentCount:value-mismatch');
  });
});

describe('shareware DOOM1.WAD music MUS inventory matches the runtime parser', () => {
  test('every D_ lump in directory order parses via parseMusicMusLumpHeader without throwing', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(() => parseMusicMusLumpHeader(lump)).not.toThrow();
    }
  });

  test('every D_ lump declares the MUS+0x1A magic at bytes 0..3', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(lump[0]).toBe(0x4d);
      expect(lump[1]).toBe(0x55);
      expect(lump[2]).toBe(0x53);
      expect(lump[3]).toBe(0x1a);
    }
  });

  test('every D_ lump has scoreStart === 16 + instrumentCount * 2 (the 2-byte dummy field invariant)', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseMusicMusLumpHeader(lump);
      expect(header.scoreStart).toBe(MUS_ON_DISK_HEADER_BYTES + header.instrumentCount * MUS_INSTRUMENT_ENTRY_BYTES);
    }
  });

  test('every D_ lump has the dummy field bytes set to zero in the shareware IWAD', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(lump.readUint16LE(MUS_DUMMY_FIELD_OFFSET)).toBe(0);
    }
  });

  test('every D_ lump has secondaryChannelCount === 0', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseMusicMusLumpHeader(lump);
      expect(header.secondaryChannelCount).toBe(0);
    }
  });

  test('every D_ lump body length is at least scoreStart + scoreLength', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseMusicMusLumpHeader(lump);
      expect(entry.size).toBeGreaterThanOrEqual(header.scoreStart + header.scoreLength);
    }
  });

  test('every D_ lump primaryChannelCount fits within the 16-channel MUS limit', () => {
    for (const { entry } of liveDEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseMusicMusLumpHeader(lump);
      expect(header.primaryChannelCount).toBeGreaterThanOrEqual(0);
      expect(header.primaryChannelCount).toBeLessThanOrEqual(16);
    }
  });

  test('every D_ lump name matches the isMusicMusLumpName predicate', () => {
    for (const { entry } of liveDEntries) {
      expect(isMusicMusLumpName(entry.name)).toBe(true);
    }
  });

  test('every DS digital sound effect lump name does NOT match isMusicMusLumpName', () => {
    const dsEntries = liveDirectory.filter((entry) => entry.name.length >= 3 && entry.name.startsWith('DS'));
    for (const entry of dsEntries) {
      expect(isMusicMusLumpName(entry.name)).toBe(false);
    }
  });

  test('every DP PC speaker lump name does NOT match isMusicMusLumpName', () => {
    const dpEntries = liveDirectory.filter((entry) => entry.name.length >= 3 && entry.name.startsWith('DP'));
    for (const entry of dpEntries) {
      expect(isMusicMusLumpName(entry.name)).toBe(false);
    }
  });
});

describe('05-013 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-013-parse-music-mus-lumps.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/parse-music-mus-lumps.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/parse-music-mus-lumps.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
  });
});
