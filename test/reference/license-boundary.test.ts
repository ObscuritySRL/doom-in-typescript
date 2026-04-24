import { describe, expect, it } from 'bun:test';

import { resolve } from 'node:path';

import { ASSET_BOUNDARIES, CODEX_WORKSPACE_PATH, REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import type { AssetBoundary, LicenseCategory, RedistributionPolicy } from '../../src/reference/policy.ts';

describe('ASSET_BOUNDARIES', () => {
  it('classifies all 8 reference bundle files', () => {
    expect(ASSET_BOUNDARIES).toHaveLength(8);
  });

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(ASSET_BOUNDARIES)).toBe(true);
    for (const boundary of ASSET_BOUNDARIES) {
      expect(Object.isFrozen(boundary)).toBe(true);
    }
  });

  it('is sorted ASCIIbetically by filename', () => {
    const filenames = ASSET_BOUNDARIES.map((boundary) => boundary.filename);
    const sorted = [...filenames].sort();
    expect(filenames).toEqual(sorted);
  });

  it('has unique filenames', () => {
    const filenames = ASSET_BOUNDARIES.map((boundary) => boundary.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('uses only valid license categories', () => {
    const validCategories: LicenseCategory[] = ['commercial-shareware', 'gpl', 'mixed', 'utility'];
    for (const boundary of ASSET_BOUNDARIES) {
      expect(validCategories).toContain(boundary.licenseCategory);
    }
  });

  it('uses only valid redistribution policies', () => {
    const validPolicies: RedistributionPolicy[] = ['forbidden', 'permitted-with-notice'];
    for (const boundary of ASSET_BOUNDARIES) {
      expect(validPolicies).toContain(boundary.redistributionPolicy);
    }
  });

  it('marks all commercial-shareware files as redistribution-forbidden', () => {
    const commercialFiles = ASSET_BOUNDARIES.filter((boundary) => boundary.licenseCategory === 'commercial-shareware');
    expect(commercialFiles.length).toBeGreaterThan(0);
    for (const file of commercialFiles) {
      expect(file.redistributionPolicy).toBe('forbidden');
    }
  });

  it('marks the shareware IWAD as commercial-shareware and redistribution-forbidden', () => {
    const wad = ASSET_BOUNDARIES.find((boundary) => boundary.filename === 'DOOM1.WAD');
    expect(wad).toBeDefined();
    expect(wad!.licenseCategory).toBe('commercial-shareware');
    expect(wad!.redistributionPolicy).toBe('forbidden');
  });

  it('classifies DOOM.EXE as mixed-license and redistribution-forbidden', () => {
    const merged = ASSET_BOUNDARIES.find((boundary) => boundary.filename === 'DOOM.EXE');
    expect(merged).toBeDefined();
    expect(merged!.licenseCategory).toBe('mixed');
    expect(merged!.redistributionPolicy).toBe('forbidden');
  });

  it('marks GPL files as permitted-with-notice', () => {
    const gplFiles = ASSET_BOUNDARIES.filter((boundary) => boundary.licenseCategory === 'gpl');
    expect(gplFiles.length).toBeGreaterThan(0);
    for (const file of gplFiles) {
      expect(file.redistributionPolicy).toBe('permitted-with-notice');
    }
  });

  it('marks utility files as permitted-with-notice', () => {
    const utilityFiles = ASSET_BOUNDARIES.filter((boundary) => boundary.licenseCategory === 'utility');
    expect(utilityFiles.length).toBeGreaterThan(0);
    for (const file of utilityFiles) {
      expect(file.redistributionPolicy).toBe('permitted-with-notice');
    }
  });

  it('marks all mixed-license files as redistribution-forbidden', () => {
    const mixedFiles = ASSET_BOUNDARIES.filter((boundary) => boundary.licenseCategory === 'mixed');
    expect(mixedFiles.length).toBeGreaterThan(0);
    for (const file of mixedFiles) {
      expect(file.redistributionPolicy).toBe('forbidden');
    }
  });

  it('represents every declared license category at least once', () => {
    const declared: LicenseCategory[] = ['commercial-shareware', 'gpl', 'mixed', 'utility'];
    const present = new Set(ASSET_BOUNDARIES.map((boundary) => boundary.licenseCategory));
    for (const category of declared) {
      expect(present.has(category)).toBe(true);
    }
  });

  it('includes a non-empty license note for every file', () => {
    for (const boundary of ASSET_BOUNDARIES) {
      expect(boundary.licenseNote.length).toBeGreaterThan(0);
    }
  });

  it('matches the file-hashes.json inventory exactly', async () => {
    const manifest = await Bun.file('reference/manifests/file-hashes.json').json();
    const manifestFilenames = (manifest.files as { filename: string }[]).map((entry) => entry.filename).sort();
    const policyFilenames = ASSET_BOUNDARIES.map((boundary) => boundary.filename).sort();
    expect(policyFilenames).toEqual(manifestFilenames);
  });

  it('satisfies the AssetBoundary interface at compile time', () => {
    const boundary: AssetBoundary = ASSET_BOUNDARIES[0]!;
    expect(boundary).toBe(ASSET_BOUNDARIES[0]);
  });
});

describe('path boundaries', () => {
  it('defines the reference bundle path under the repo-local doom directory', () => {
    expect(REFERENCE_BUNDLE_PATH).toBe(resolve(CODEX_WORKSPACE_PATH, 'doom'));
  });

  it('defines the codex workspace path as the parent of the doom directory', () => {
    expect(REFERENCE_BUNDLE_PATH.startsWith(CODEX_WORKSPACE_PATH)).toBe(true);
  });

  it('reference bundle and codex workspace are distinct directories', () => {
    expect(REFERENCE_BUNDLE_PATH).not.toBe(CODEX_WORKSPACE_PATH);
    expect(resolve(REFERENCE_BUNDLE_PATH, '..')).toBe(CODEX_WORKSPACE_PATH);
  });

  it('reference bundle path exists on disk', () => {
    const file = Bun.file(REFERENCE_BUNDLE_PATH + '\\README.md');
    expect(file.size).toBeGreaterThan(0);
  });
});
