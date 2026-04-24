import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';

import manifest from '../../reference/manifests/file-hashes.json';

describe('file-hashes.json manifest', () => {
  it('uses SHA-256 as the hash algorithm', () => {
    expect(manifest.algorithm).toBe('SHA-256');
  });

  it('contains exactly 8 file entries', () => {
    expect(manifest.files).toHaveLength(8);
  });

  it('has unique filenames across all entries', () => {
    const filenames = manifest.files.map((file) => file.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('stores all hashes as 64-character uppercase hex strings', () => {
    const hexPattern = /^[0-9A-F]{64}$/;
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(hexPattern);
    }
  });

  it('stores positive integer byte sizes for all entries', () => {
    for (const file of manifest.files) {
      expect(file.sizeBytes).toBeGreaterThan(0);
      expect(Number.isInteger(file.sizeBytes)).toBe(true);
    }
  });

  it('includes the three PRIMARY_TARGET reference files', () => {
    const byFilename = new Map(manifest.files.map((file) => [file.filename, file]));

    const doomExe = byFilename.get('DOOM.EXE');
    expect(doomExe).toBeDefined();
    expect(doomExe!.sha256).toBe(PRIMARY_TARGET.executableHash);

    const doomWad = byFilename.get('DOOM1.WAD');
    expect(doomWad).toBeDefined();
    expect(doomWad!.sha256).toBe(PRIMARY_TARGET.wadHash);

    const doomDos = byFilename.get('DOOMD.EXE');
    expect(doomDos).toBeDefined();
    expect(doomDos!.sha256).toBe(PRIMARY_TARGET.dosExecutableHash);
  });

  it('assigns a non-empty role to every entry', () => {
    for (const file of manifest.files) {
      expect(file.role).toBeTruthy();
      expect(typeof file.role).toBe('string');
    }
  });

  it('includes the shareware IWAD with the expected size', () => {
    const wad = manifest.files.find((file) => file.filename === 'DOOM1.WAD');
    expect(wad).toBeDefined();
    expect(wad!.sizeBytes).toBe(4_196_020);
  });

  it('rejects a tampered hash by detecting mismatch', () => {
    const tamperedHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const doomExe = manifest.files.find((file) => file.filename === 'DOOM.EXE');
    expect(doomExe).toBeDefined();
    expect(doomExe!.sha256).not.toBe(tamperedHash);
  });

  it('lists files in a consistent order (alphabetical by filename)', () => {
    const filenames = manifest.files.map((file) => file.filename);
    const sorted = [...filenames].sort();
    expect(filenames).toEqual(sorted);
  });
});
