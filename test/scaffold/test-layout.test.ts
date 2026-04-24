import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DIRECTORY_PHASE_MAP, PHASE_COUNT, PREEXISTING_DIRECTORIES, TEST_DIRECTORIES, TEST_DIRECTORY_COUNT } from '../_harness/index.ts';
import type { TestDirectory } from '../_harness/index.ts';

const TEST_ROOT = resolve(import.meta.dir, '..');

describe('canonical test directory list', () => {
  test('has exactly 21 directories', () => {
    expect(TEST_DIRECTORIES.length).toBe(21);
  });

  test('count constant matches array length', () => {
    expect(TEST_DIRECTORY_COUNT).toBe(TEST_DIRECTORIES.length);
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...TEST_DIRECTORIES].sort();
    expect([...TEST_DIRECTORIES]).toEqual(sorted);
  });

  test('has no duplicate entries', () => {
    const unique = new Set(TEST_DIRECTORIES);
    expect(unique.size).toBe(TEST_DIRECTORIES.length);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(TEST_DIRECTORIES)).toBe(true);
  });

  test('every entry is lowercase ASCII or underscore', () => {
    for (const directory of TEST_DIRECTORIES) {
      expect(directory).toMatch(/^[a-z_]+$/);
    }
  });

  test('_harness sorts before all lowercase entries (ASCII underscore < a)', () => {
    expect(TEST_DIRECTORIES[0]).toBe('_harness');
    expect('_'.charCodeAt(0)).toBeLessThan('a'.charCodeAt(0));
  });
});

describe('directory phase map', () => {
  test('has an entry for every canonical directory', () => {
    for (const directory of TEST_DIRECTORIES) {
      expect(DIRECTORY_PHASE_MAP).toHaveProperty(directory);
    }
  });

  test('has no extra keys beyond canonical directories', () => {
    const keys = Object.keys(DIRECTORY_PHASE_MAP);
    expect(keys.length).toBe(TEST_DIRECTORIES.length);
  });

  test('every phase number is a non-negative integer', () => {
    for (const phases of Object.values(DIRECTORY_PHASE_MAP)) {
      for (const phase of phases) {
        expect(Number.isInteger(phase)).toBe(true);
        expect(phase).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('phase arrays are ascending within each entry', () => {
    for (const phases of Object.values(DIRECTORY_PHASE_MAP)) {
      for (let index = 1; index < phases.length; index++) {
        expect(phases[index]).toBeGreaterThan(phases[index - 1]);
      }
    }
  });

  test('covers all 18 phases (00 through 17)', () => {
    const coveredPhases = new Set<number>();
    for (const phases of Object.values(DIRECTORY_PHASE_MAP)) {
      for (const phase of phases) {
        coveredPhases.add(phase);
      }
    }
    expect(coveredPhases.size).toBe(PHASE_COUNT);
    for (let phase = 0; phase < PHASE_COUNT; phase++) {
      expect(coveredPhases.has(phase)).toBe(true);
    }
  });

  test('is frozen', () => {
    expect(Object.isFrozen(DIRECTORY_PHASE_MAP)).toBe(true);
  });

  test('freezes every phase array', () => {
    for (const phases of Object.values(DIRECTORY_PHASE_MAP)) {
      expect(Object.isFrozen(phases)).toBe(true);
    }
  });

  test('multi-phase directories have at least 2 phases', () => {
    const multiPhase = Object.entries(DIRECTORY_PHASE_MAP).filter(([, phases]) => phases.length > 1);
    expect(multiPhase.length).toBeGreaterThanOrEqual(1);
    for (const [, phases] of multiPhase) {
      expect(phases.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('reference directory covers phases 0 and 1', () => {
    expect([...DIRECTORY_PHASE_MAP.reference]).toEqual([0, 1]);
  });

  test('wad directory covers phases 1 and 5', () => {
    expect([...DIRECTORY_PHASE_MAP.wad]).toEqual([1, 5]);
  });
});

describe('preexisting directories', () => {
  test('is ASCIIbetically sorted', () => {
    const sorted = [...PREEXISTING_DIRECTORIES].sort();
    expect([...PREEXISTING_DIRECTORIES]).toEqual(sorted);
  });

  test('is a subset of canonical directories', () => {
    const canonical = new Set<string>(TEST_DIRECTORIES);
    for (const directory of PREEXISTING_DIRECTORIES) {
      expect(canonical.has(directory)).toBe(true);
    }
  });

  test('is frozen', () => {
    expect(Object.isFrozen(PREEXISTING_DIRECTORIES)).toBe(true);
  });

  test('every preexisting directory exists on disk', () => {
    for (const directory of PREEXISTING_DIRECTORIES) {
      const fullPath = resolve(TEST_ROOT, directory);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  test('includes _harness (created by this step)', () => {
    expect(PREEXISTING_DIRECTORIES).toContain('_harness');
  });
});

describe('harness barrel module', () => {
  test('_harness/index.ts exists on disk', () => {
    const harnessPath = resolve(TEST_ROOT, '_harness', 'index.ts');
    expect(existsSync(harnessPath)).toBe(true);
  });

  test('exports TEST_DIRECTORIES as a readonly array', () => {
    expect(Array.isArray(TEST_DIRECTORIES)).toBe(true);
    expect(Object.isFrozen(TEST_DIRECTORIES)).toBe(true);
  });

  test('exports DIRECTORY_PHASE_MAP as a frozen record', () => {
    expect(typeof DIRECTORY_PHASE_MAP).toBe('object');
    expect(DIRECTORY_PHASE_MAP).not.toBeNull();
    expect(Object.isFrozen(DIRECTORY_PHASE_MAP)).toBe(true);
  });

  test('TestDirectory type narrows to string literal union', () => {
    const first: TestDirectory = '_harness';
    const last: TestDirectory = 'world';
    expect(TEST_DIRECTORIES).toContain(first);
    expect(TEST_DIRECTORIES).toContain(last);
  });
});

describe('parity edge cases', () => {
  test('Phase 16 spans three directories (config, demo, save)', () => {
    const phase16Directories = Object.entries(DIRECTORY_PHASE_MAP)
      .filter(([, phases]) => (phases as readonly number[]).includes(16))
      .map(([name]) => name)
      .sort();
    expect(phase16Directories).toEqual(['config', 'demo', 'save']);
  });

  test('Phase 06 spans two directories (host, input)', () => {
    const phase6Directories = Object.entries(DIRECTORY_PHASE_MAP)
      .filter(([, phases]) => (phases as readonly number[]).includes(6))
      .map(([name]) => name)
      .sort();
    expect(phase6Directories).toEqual(['host', 'input']);
  });

  test('Phase 03 spans two directories (_harness, scaffold)', () => {
    const phase3Directories = Object.entries(DIRECTORY_PHASE_MAP)
      .filter(([, phases]) => (phases as readonly number[]).includes(3))
      .map(([name]) => name)
      .sort();
    expect(phase3Directories).toEqual(['_harness', 'scaffold']);
  });

  test('no directory name contains a dot or slash', () => {
    for (const directory of TEST_DIRECTORIES) {
      expect(directory).not.toMatch(/[./\\]/);
    }
  });
});
