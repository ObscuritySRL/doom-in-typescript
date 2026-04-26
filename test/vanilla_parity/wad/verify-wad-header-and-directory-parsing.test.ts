import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { WAD_HEADER_SIZE, parseWadHeader } from '../../../src/wad/header.ts';
import { DIRECTORY_ENTRY_SIZE, parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  SHAREWARE_DOOM1_WAD_ORACLE,
  WAD_IDENTIFICATION_AUDIT,
  WAD_STRUCT_DERIVED_INVARIANTS,
  WAD_STRUCT_FIELD_AUDIT,
  WAD_STRUCT_SIZE_AUDIT,
  crossCheckShareWareDoom1WadSample,
  crossCheckWadStructLayout,
} from '../../../src/assets/verify-wad-header-and-directory-parsing.ts';
import type { ShareWareDoom1WadSample, WadStructFieldAuditEntry, WadStructLayoutSnapshot } from '../../../src/assets/verify-wad-header-and-directory-parsing.ts';

const ALLOWED_HEADER_REFERENCE = new Set(['src/w_wad.h', 'src/w_wad.c']);
const ALLOWED_FIELD_NAMES = new Set(['identification', 'numlumps', 'infotableofs', 'filepos', 'size', 'name']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const RUNTIME_LAYOUT_SNAPSHOT: WadStructLayoutSnapshot = Object.freeze({
  WAD_HEADER_SIZE,
  DIRECTORY_ENTRY_SIZE,
  acceptedIdentifications: ['IWAD', 'PWAD'],
});

describe('WAD struct field audit ledger shape', () => {
  test('audits exactly six byte-level fields — three for wadinfo_t and three for filelump_t', () => {
    expect(WAD_STRUCT_FIELD_AUDIT.length).toBe(6);
    expect(WAD_STRUCT_FIELD_AUDIT.filter((entry) => entry.struct === 'wadinfo_t').length).toBe(3);
    expect(WAD_STRUCT_FIELD_AUDIT.filter((entry) => entry.struct === 'filelump_t').length).toBe(3);
  });

  test('every (struct, fieldName) pair is unique', () => {
    const keys = WAD_STRUCT_FIELD_AUDIT.map((entry) => `${entry.struct}.${entry.fieldName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every field name is in the allowed enumeration', () => {
    for (const entry of WAD_STRUCT_FIELD_AUDIT) {
      expect(ALLOWED_FIELD_NAMES.has(entry.fieldName)).toBe(true);
    }
  });

  test('every reference source file points at src/w_wad.h', () => {
    for (const entry of WAD_STRUCT_FIELD_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/w_wad.h');
    }
  });

  test('every entry carries a non-empty C declaration', () => {
    for (const entry of WAD_STRUCT_FIELD_AUDIT) {
      expect(entry.cDeclaration.length).toBeGreaterThan(0);
    }
  });

  test('every entry carries a non-empty invariant note', () => {
    for (const entry of WAD_STRUCT_FIELD_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('every char field carries endianness "n/a" and every int field carries endianness "little"', () => {
    for (const entry of WAD_STRUCT_FIELD_AUDIT) {
      if (entry.cType === 'int') {
        expect(entry.endianness).toBe('little');
      } else {
        expect(entry.endianness).toBe('n/a');
      }
    }
  });
});

describe('WAD struct field audit values', () => {
  function findField(struct: WadStructFieldAuditEntry['struct'], fieldName: WadStructFieldAuditEntry['fieldName']): WadStructFieldAuditEntry {
    const entry = WAD_STRUCT_FIELD_AUDIT.find((candidate) => candidate.struct === struct && candidate.fieldName === fieldName);
    expect(entry).toBeDefined();
    return entry!;
  }

  test('wadinfo_t.identification is a 4-byte char run at offset 0', () => {
    const field = findField('wadinfo_t', 'identification');
    expect(field.byteOffset).toBe(0);
    expect(field.byteSize).toBe(4);
    expect(field.cType).toBe('char[4]');
  });

  test('wadinfo_t.numlumps is a 4-byte little-endian int at offset 4', () => {
    const field = findField('wadinfo_t', 'numlumps');
    expect(field.byteOffset).toBe(4);
    expect(field.byteSize).toBe(4);
    expect(field.cType).toBe('int');
    expect(field.endianness).toBe('little');
  });

  test('wadinfo_t.infotableofs is a 4-byte little-endian int at offset 8', () => {
    const field = findField('wadinfo_t', 'infotableofs');
    expect(field.byteOffset).toBe(8);
    expect(field.byteSize).toBe(4);
    expect(field.cType).toBe('int');
    expect(field.endianness).toBe('little');
  });

  test('filelump_t.filepos is a 4-byte little-endian int at offset 0', () => {
    const field = findField('filelump_t', 'filepos');
    expect(field.byteOffset).toBe(0);
    expect(field.byteSize).toBe(4);
    expect(field.cType).toBe('int');
    expect(field.endianness).toBe('little');
  });

  test('filelump_t.size is a 4-byte little-endian int at offset 4', () => {
    const field = findField('filelump_t', 'size');
    expect(field.byteOffset).toBe(4);
    expect(field.byteSize).toBe(4);
    expect(field.cType).toBe('int');
    expect(field.endianness).toBe('little');
  });

  test('filelump_t.name is an 8-byte ASCII run at offset 8', () => {
    const field = findField('filelump_t', 'name');
    expect(field.byteOffset).toBe(8);
    expect(field.byteSize).toBe(8);
    expect(field.cType).toBe('char[8]');
    expect(field.endianness).toBe('n/a');
  });
});

describe('WAD struct size audit ledger', () => {
  test('audits exactly two struct sizes — wadinfo_t (12) and filelump_t (16)', () => {
    expect(WAD_STRUCT_SIZE_AUDIT.length).toBe(2);
  });

  test('WAD_HEADER_SIZE entry pins the 12-byte wadinfo_t total', () => {
    const entry = WAD_STRUCT_SIZE_AUDIT.find((candidate) => candidate.runtimeConstant === 'WAD_HEADER_SIZE');
    expect(entry).toBeDefined();
    expect(entry?.struct).toBe('wadinfo_t');
    expect(entry?.value).toBe(12);
    expect(entry?.value).toBe(WAD_HEADER_SIZE);
  });

  test('DIRECTORY_ENTRY_SIZE entry pins the 16-byte filelump_t total', () => {
    const entry = WAD_STRUCT_SIZE_AUDIT.find((candidate) => candidate.runtimeConstant === 'DIRECTORY_ENTRY_SIZE');
    expect(entry).toBeDefined();
    expect(entry?.struct).toBe('filelump_t');
    expect(entry?.value).toBe(16);
    expect(entry?.value).toBe(DIRECTORY_ENTRY_SIZE);
  });

  test('every size entry references src/w_wad.h with a non-empty C declaration', () => {
    for (const entry of WAD_STRUCT_SIZE_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/w_wad.h');
      expect(entry.cDeclaration.length).toBeGreaterThan(0);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('WAD identification audit ledger', () => {
  test('audits exactly the two valid tags IWAD and PWAD', () => {
    const tags = new Set(WAD_IDENTIFICATION_AUDIT.map((entry) => entry.tag));
    expect(tags).toEqual(new Set(['IWAD', 'PWAD']));
  });

  test('every tag references src/w_wad.c and carries a non-empty meaning and invariant', () => {
    for (const entry of WAD_IDENTIFICATION_AUDIT) {
      expect(ALLOWED_HEADER_REFERENCE.has(entry.referenceSourceFile)).toBe(true);
      expect(entry.referenceSourceFile).toBe('src/w_wad.c');
      expect(entry.meaning.length).toBeGreaterThan(0);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('WAD struct derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = WAD_STRUCT_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the seven derived invariants the cross-check enforces', () => {
    const ids = new Set(WAD_STRUCT_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'WADINFO_FIELD_OFFSETS_ARE_CONTIGUOUS',
        'WADINFO_TOTAL_BYTE_SIZE_EQUALS_TWELVE',
        'FILELUMP_FIELD_OFFSETS_ARE_CONTIGUOUS',
        'FILELUMP_TOTAL_BYTE_SIZE_EQUALS_SIXTEEN',
        'IDENTIFICATION_VALID_TAGS_ARE_IWAD_AND_PWAD',
        'INTEGER_FIELDS_ARE_LITTLE_ENDIAN',
        'NAME_FIELD_IS_EIGHT_BYTE_ASCII',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of WAD_STRUCT_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('crossCheckWadStructLayout on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckWadStructLayout(RUNTIME_LAYOUT_SNAPSHOT)).toEqual([]);
  });

  test('WAD_HEADER_SIZE === 12 holds at runtime', () => {
    expect(WAD_HEADER_SIZE).toBe(12);
  });

  test('DIRECTORY_ENTRY_SIZE === 16 holds at runtime', () => {
    expect(DIRECTORY_ENTRY_SIZE).toBe(16);
  });

  test('wadinfo_t fields are contiguous and sum to 12 bytes', () => {
    const fields = WAD_STRUCT_FIELD_AUDIT.filter((entry) => entry.struct === 'wadinfo_t');
    let cursor = 0;
    let total = 0;
    for (const field of fields) {
      expect(field.byteOffset).toBe(cursor);
      cursor += field.byteSize;
      total += field.byteSize;
    }
    expect(total).toBe(12);
  });

  test('filelump_t fields are contiguous and sum to 16 bytes', () => {
    const fields = WAD_STRUCT_FIELD_AUDIT.filter((entry) => entry.struct === 'filelump_t');
    let cursor = 0;
    let total = 0;
    for (const field of fields) {
      expect(field.byteOffset).toBe(cursor);
      cursor += field.byteSize;
      total += field.byteSize;
    }
    expect(total).toBe(16);
  });
});

describe('crossCheckWadStructLayout failure modes', () => {
  test('detects a tampered WAD_HEADER_SIZE that no longer equals 12', () => {
    const tampered: WadStructLayoutSnapshot = { ...RUNTIME_LAYOUT_SNAPSHOT, WAD_HEADER_SIZE: 16 };
    const failures = crossCheckWadStructLayout(tampered);
    expect(failures).toContain('audit:size:WAD_HEADER_SIZE:value-mismatch');
    expect(failures).toContain('derived:WADINFO_TOTAL_BYTE_SIZE_EQUALS_TWELVE');
  });

  test('detects a tampered DIRECTORY_ENTRY_SIZE that no longer equals 16', () => {
    const tampered: WadStructLayoutSnapshot = { ...RUNTIME_LAYOUT_SNAPSHOT, DIRECTORY_ENTRY_SIZE: 12 };
    const failures = crossCheckWadStructLayout(tampered);
    expect(failures).toContain('audit:size:DIRECTORY_ENTRY_SIZE:value-mismatch');
    expect(failures).toContain('derived:FILELUMP_TOTAL_BYTE_SIZE_EQUALS_SIXTEEN');
  });

  test('detects a missing IWAD identification tag', () => {
    const tampered: WadStructLayoutSnapshot = { ...RUNTIME_LAYOUT_SNAPSHOT, acceptedIdentifications: ['PWAD'] };
    const failures = crossCheckWadStructLayout(tampered);
    expect(failures).toContain('audit:identifications:IWAD:missing');
    expect(failures).toContain('derived:IDENTIFICATION_VALID_TAGS_ARE_IWAD_AND_PWAD');
  });

  test('detects an unexpected third identification tag', () => {
    const tampered: WadStructLayoutSnapshot = { ...RUNTIME_LAYOUT_SNAPSHOT, acceptedIdentifications: ['IWAD', 'PWAD', 'XWAD'] };
    const failures = crossCheckWadStructLayout(tampered);
    expect(failures).toContain('audit:identifications:unexpected:XWAD');
    expect(failures).toContain('derived:IDENTIFICATION_VALID_TAGS_ARE_IWAD_AND_PWAD');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: WadStructLayoutSnapshot = {
      WAD_HEADER_SIZE: 12,
      DIRECTORY_ENTRY_SIZE: 16,
      acceptedIdentifications: ['IWAD', 'PWAD'],
    };
    expect(crossCheckWadStructLayout(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD oracle', () => {
  test('the on-disk file matches the pinned file size, identification, and lump count', () => {
    expect(wadBuffer.length).toBe(SHAREWARE_DOOM1_WAD_ORACLE.fileSize);
    expect(liveHeader.type).toBe(SHAREWARE_DOOM1_WAD_ORACLE.identification);
    expect(liveHeader.lumpCount).toBe(SHAREWARE_DOOM1_WAD_ORACLE.lumpCount);
    expect(liveHeader.directoryOffset).toBe(SHAREWARE_DOOM1_WAD_ORACLE.directoryOffset);
  });

  test('the directory ends exactly at the end of the file', () => {
    const directoryEnd = liveHeader.directoryOffset + liveHeader.lumpCount * DIRECTORY_ENTRY_SIZE;
    expect(directoryEnd).toBe(SHAREWARE_DOOM1_WAD_ORACLE.directoryEnd);
    expect(directoryEnd).toBe(wadBuffer.length);
  });

  test('PLAYPAL is the first lump and F_END is the last lump', () => {
    expect(liveDirectory[0]?.name).toBe(SHAREWARE_DOOM1_WAD_ORACLE.firstLumpName);
    expect(liveDirectory[liveDirectory.length - 1]?.name).toBe(SHAREWARE_DOOM1_WAD_ORACLE.lastLumpName);
  });

  test('PLAYPAL is 14 palettes * 768 bytes = 10752 bytes located right after the header', () => {
    const playpal = liveDirectory[0]!;
    expect(playpal.offset).toBe(SHAREWARE_DOOM1_WAD_ORACLE.firstLumpFilePos);
    expect(playpal.size).toBe(SHAREWARE_DOOM1_WAD_ORACLE.firstLumpSize);
    expect(playpal.size).toBe(14 * 768);
  });

  test('the pinned lump count matches PRIMARY_TARGET.wadLumpCount', () => {
    expect(SHAREWARE_DOOM1_WAD_ORACLE.lumpCount).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  test('the pinned filename matches PRIMARY_TARGET.wadFilename', () => {
    expect<string>(SHAREWARE_DOOM1_WAD_ORACLE.filename).toBe(PRIMARY_TARGET.wadFilename);
  });

  test('crossCheckShareWareDoom1WadSample reports zero failures for the live on-disk parse', () => {
    const sample: ShareWareDoom1WadSample = {
      fileSize: wadBuffer.length,
      identification: liveHeader.type,
      lumpCount: liveHeader.lumpCount,
      directoryOffset: liveHeader.directoryOffset,
      firstLumpName: liveDirectory[0]!.name,
      lastLumpName: liveDirectory[liveDirectory.length - 1]!.name,
      firstLumpFilePos: liveDirectory[0]!.offset,
      firstLumpSize: liveDirectory[0]!.size,
    };
    expect(crossCheckShareWareDoom1WadSample(sample)).toEqual([]);
  });

  test('crossCheckShareWareDoom1WadSample matches the wad-map-summary.json reference manifest on lump count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { totalLumps: number; wadType: string };
    expect(manifest.totalLumps).toBe(SHAREWARE_DOOM1_WAD_ORACLE.lumpCount);
    expect(manifest.wadType).toBe(SHAREWARE_DOOM1_WAD_ORACLE.identification);
  });
});

describe('crossCheckShareWareDoom1WadSample failure modes', () => {
  function liveSample(): ShareWareDoom1WadSample {
    return {
      fileSize: wadBuffer.length,
      identification: liveHeader.type,
      lumpCount: liveHeader.lumpCount,
      directoryOffset: liveHeader.directoryOffset,
      firstLumpName: liveDirectory[0]!.name,
      lastLumpName: liveDirectory[liveDirectory.length - 1]!.name,
      firstLumpFilePos: liveDirectory[0]!.offset,
      firstLumpSize: liveDirectory[0]!.size,
    };
  }

  test('detects a wrong file size', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), fileSize: 0 };
    expect(crossCheckShareWareDoom1WadSample(tampered)).toContain('oracle:fileSize:value-mismatch');
  });

  test('detects a PWAD identification on an IWAD', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), identification: 'PWAD' };
    expect(crossCheckShareWareDoom1WadSample(tampered)).toContain('oracle:identification:value-mismatch');
  });

  test('detects a tampered lump count and reports the directoryEnd mismatch alongside it', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), lumpCount: liveSample().lumpCount + 1 };
    const failures = crossCheckShareWareDoom1WadSample(tampered);
    expect(failures).toContain('oracle:lumpCount:value-mismatch');
    expect(failures).toContain('oracle:directoryEnd:value-mismatch');
  });

  test('detects a wrong first lump name', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), firstLumpName: 'NOTPLAYP' };
    expect(crossCheckShareWareDoom1WadSample(tampered)).toContain('oracle:firstLumpName:value-mismatch');
  });

  test('detects a wrong last lump name', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), lastLumpName: 'F_START' };
    expect(crossCheckShareWareDoom1WadSample(tampered)).toContain('oracle:lastLumpName:value-mismatch');
  });

  test('detects a wrong PLAYPAL file position', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), firstLumpFilePos: 0 };
    expect(crossCheckShareWareDoom1WadSample(tampered)).toContain('oracle:firstLumpFilePos:value-mismatch');
  });

  test('detects a wrong PLAYPAL size', () => {
    const tampered: ShareWareDoom1WadSample = { ...liveSample(), firstLumpSize: 0 };
    expect(crossCheckShareWareDoom1WadSample(tampered)).toContain('oracle:firstLumpSize:value-mismatch');
  });
});

describe('verify-wad-header-and-directory-parsing step file', () => {
  test('declares the wad lane and the verify write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-001-verify-wad-header-and-directory-parsing.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/verify-wad-header-and-directory-parsing.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/verify-wad-header-and-directory-parsing.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-001-verify-wad-header-and-directory-parsing.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
