import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

import { GOLDEN_NAMES, clearGoldenCache, goldenCacheSize, goldenPath, loadGolden } from './golden.ts';
import type { GoldenName } from './golden.ts';

afterEach(() => {
  clearGoldenCache();
});

describe('GOLDEN_NAMES registry', () => {
  test('is a frozen array', () => {
    expect(Object.isFrozen(GOLDEN_NAMES)).toBe(true);
  });

  test('contains exactly 10 entries', () => {
    expect(GOLDEN_NAMES).toHaveLength(10);
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...GOLDEN_NAMES].sort();
    expect([...GOLDEN_NAMES]).toEqual(sorted);
  });

  test('has no duplicate entries', () => {
    const unique = new Set(GOLDEN_NAMES);
    expect(unique.size).toBe(GOLDEN_NAMES.length);
  });

  test('every name is lowercase kebab-case', () => {
    for (const name of GOLDEN_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9-]+$/);
    }
  });

  test('every golden file exists on disk', () => {
    for (const name of GOLDEN_NAMES) {
      const path = goldenPath(name);
      expect(existsSync(path)).toBe(true);
    }
  });
});

describe('goldenPath', () => {
  test('returns an absolute path ending with .json', () => {
    const path = goldenPath('file-hashes');
    expect(path).toMatch(/[/\\]file-hashes\.json$/);
    expect(path).toContain('reference');
    expect(path).toContain('manifests');
  });

  test('returns distinct paths for distinct names', () => {
    const pathA = goldenPath('file-hashes');
    const pathB = goldenPath('demo-lump-summary');
    expect(pathA).not.toBe(pathB);
  });
});

describe('loadGolden', () => {
  test('loads file-hashes manifest', async () => {
    const manifest = await loadGolden('file-hashes');
    expect(manifest).toBeDefined();
    expect(typeof manifest).toBe('object');
    expect(manifest).not.toBeNull();
  });

  test('loaded manifest has expected top-level fields', async () => {
    const manifest = await loadGolden<Record<string, unknown>>('file-hashes');
    expect(manifest).toHaveProperty('algorithm');
    expect(manifest).toHaveProperty('files');
  });

  test('caches result on second call', async () => {
    const first = await loadGolden('file-hashes');
    const second = await loadGolden('file-hashes');
    expect(first).toBe(second);
  });

  test('cache size increments per distinct load', async () => {
    expect(goldenCacheSize()).toBe(0);
    await loadGolden('file-hashes');
    expect(goldenCacheSize()).toBe(1);
    await loadGolden('demo-lump-summary');
    expect(goldenCacheSize()).toBe(2);
  });

  test('clearGoldenCache resets cache size to zero', async () => {
    await loadGolden('file-hashes');
    expect(goldenCacheSize()).toBeGreaterThan(0);
    clearGoldenCache();
    expect(goldenCacheSize()).toBe(0);
  });

  test('reloads from disk after cache clear', async () => {
    const first = await loadGolden('file-hashes');
    clearGoldenCache();
    const reloaded = await loadGolden('file-hashes');
    expect(reloaded).not.toBe(first);
    expect(reloaded).toEqual(first);
  });

  test('loads every registered golden file without error', async () => {
    for (const name of GOLDEN_NAMES) {
      const result = await loadGolden(name);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    }
  });

  test('every loaded manifest has a description field', async () => {
    for (const name of GOLDEN_NAMES) {
      const manifest = await loadGolden<Record<string, unknown>>(name);
      expect(typeof manifest.description).toBe('string');
      expect((manifest.description as string).length).toBeGreaterThan(0);
    }
  });
});

describe('parity edge case: nonexistent golden file', () => {
  test('throws for a name not on disk', async () => {
    const fakeName = 'nonexistent-manifest' as GoldenName;
    await expect(loadGolden(fakeName)).rejects.toThrow('Golden file not found');
  });
});

describe('type narrowing', () => {
  test('GoldenName type narrows to string literal union', () => {
    const first: GoldenName = 'compatibility-targets';
    const last: GoldenName = 'wad-map-summary';
    expect(GOLDEN_NAMES).toContain(first);
    expect(GOLDEN_NAMES).toContain(last);
  });

  test('generic type parameter flows through loadGolden', async () => {
    interface FileHashManifest {
      algorithm: string;
      files: readonly { filename: string; sha256: string }[];
    }
    const manifest = await loadGolden<FileHashManifest>('file-hashes');
    expect(manifest.algorithm).toBe('SHA-256');
    expect(manifest.files.length).toBeGreaterThan(0);
  });
});
