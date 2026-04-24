import { describe, expect, it } from 'bun:test';

import catalog from '../../reference/manifests/source-catalog.json';

const VALID_KINDS: readonly string[] = ['doc', 'doc-set', 'file', 'repo', 'source'];

const VALID_AUTHORITIES: readonly string[] = ['community-secondary', 'local-primary', 'local-primary-binary', 'local-primary-data', 'local-secondary', 'local-secondary-binary', 'upstream-secondary'];

describe('source-catalog.json', () => {
  it('contains exactly 43 entries', () => {
    expect(catalog.entries).toHaveLength(43);
  });

  it('has unique IDs across all entries', () => {
    const ids = catalog.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses sequential S-NNN IDs starting at S-001', () => {
    const idPattern = /^S-\d{3}$/;
    for (let index = 0; index < catalog.entries.length; index++) {
      const entry = catalog.entries[index]!;
      expect(entry.id).toMatch(idPattern);
      const expectedNumber = String(index + 1).padStart(3, '0');
      expect(entry.id).toBe(`S-${expectedNumber}`);
    }
  });

  it('assigns a non-empty source name to every entry', () => {
    for (const entry of catalog.entries) {
      expect(entry.source).toBeTruthy();
      expect(typeof entry.source).toBe('string');
    }
  });

  it('uses only valid kind values', () => {
    for (const entry of catalog.entries) {
      expect(VALID_KINDS).toContain(entry.kind);
    }
  });

  it('uses only valid authority values', () => {
    for (const entry of catalog.entries) {
      expect(VALID_AUTHORITIES).toContain(entry.authority);
    }
  });

  it('assigns a non-empty pathOrUrl to every entry', () => {
    for (const entry of catalog.entries) {
      expect(entry.pathOrUrl).toBeTruthy();
      expect(typeof entry.pathOrUrl).toBe('string');
    }
  });

  it('assigns a non-empty notes string to every entry', () => {
    for (const entry of catalog.entries) {
      expect(entry.notes).toBeTruthy();
      expect(typeof entry.notes).toBe('string');
    }
  });

  it('has local-file entries pointing to the universal-doom bundle', () => {
    const localFileEntries = catalog.entries.filter((entry) => entry.kind === 'file');
    expect(localFileEntries.length).toBeGreaterThan(0);
    for (const entry of localFileEntries) {
      expect(entry.pathOrUrl).toContain('universal-doom');
    }
  });

  it('has upstream-secondary entries using HTTPS URLs', () => {
    const upstreamEntries = catalog.entries.filter((entry) => entry.authority === 'upstream-secondary');
    expect(upstreamEntries.length).toBeGreaterThan(0);
    for (const entry of upstreamEntries) {
      expect(entry.pathOrUrl.startsWith('https://')).toBe(true);
    }
  });

  it('has community-secondary entries using HTTPS URLs', () => {
    const communityEntries = catalog.entries.filter((entry) => entry.authority === 'community-secondary');
    expect(communityEntries.length).toBeGreaterThan(0);
    for (const entry of communityEntries) {
      expect(entry.pathOrUrl.startsWith('https://')).toBe(true);
    }
  });

  it('ranks local sources before upstream and community in authority hierarchy', () => {
    const localEntries = catalog.entries.filter((entry) => entry.authority.startsWith('local-'));
    const upstreamEntries = catalog.entries.filter((entry) => entry.authority === 'upstream-secondary');
    const communityEntries = catalog.entries.filter((entry) => entry.authority === 'community-secondary');

    expect(localEntries.length).toBeGreaterThan(0);
    expect(upstreamEntries.length).toBeGreaterThan(0);
    expect(communityEntries.length).toBeGreaterThan(0);

    const lastLocalIndex = Math.max(...localEntries.map((entry) => catalog.entries.indexOf(entry)));
    const firstUpstreamIndex = Math.min(...upstreamEntries.map((entry) => catalog.entries.indexOf(entry)));
    const firstCommunityIndex = Math.min(...communityEntries.map((entry) => catalog.entries.indexOf(entry)));

    expect(lastLocalIndex).toBeLessThan(firstUpstreamIndex);
    expect(firstUpstreamIndex).toBeLessThan(firstCommunityIndex);
  });

  it('includes the shareware IWAD as a local-primary-data entry', () => {
    const iwadEntry = catalog.entries.find((entry) => entry.authority === 'local-primary-data');
    expect(iwadEntry).toBeDefined();
    expect(iwadEntry!.pathOrUrl).toContain('DOOM1.WAD');
  });

  it('includes the DOS executable as a local-primary-binary entry', () => {
    const dosEntry = catalog.entries.find((entry) => entry.authority === 'local-primary-binary');
    expect(dosEntry).toBeDefined();
    expect(dosEntry!.pathOrUrl).toContain('DOOMD.EXE');
  });
});
