import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { STATE_HASH_COMPONENTS } from '../../../src/oracles/stateHash.ts';
import { VANILLA_INDIVIDUAL_STATE_COMPONENTS, hashStateSnapshot } from '../../../src/vanilla/wireStateSnapshotHash.ts';
import type { StateComponentBytes } from '../../../src/vanilla/wireStateSnapshotHash.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireStateSnapshotHash.ts');

function buildComponentBytes(seed: number): StateComponentBytes {
  return Object.freeze({
    automap: new Uint8Array([seed, 1]),
    player: new Uint8Array([seed, 2]),
    rng: new Uint8Array([seed, 3]),
    sectors: new Uint8Array([seed, 4]),
    thinkers: new Uint8Array([seed, 5]),
  });
}

describe('plan_final runtime: wire-state-snapshot-hash', () => {
  test('src/vanilla/wireStateSnapshotHash.ts exists, is a regular file, and cites plan_final step 04-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('04-007');
    expect(fileText).toContain('hashStateSnapshot');
    expect(fileText).toContain("from '../oracles/stateHash.ts'");
  });

  test('VANILLA_INDIVIDUAL_STATE_COMPONENTS is the canonical 5 components (STATE_HASH_COMPONENTS minus combined), frozen', () => {
    expect(VANILLA_INDIVIDUAL_STATE_COMPONENTS).toEqual(['automap', 'player', 'rng', 'sectors', 'thinkers']);
    expect(Object.isFrozen(VANILLA_INDIVIDUAL_STATE_COMPONENTS)).toBe(true);
    const sortedAll = [...STATE_HASH_COMPONENTS].map((component) => String(component)).sort();
    const sortedDerived = [...VANILLA_INDIVIDUAL_STATE_COMPONENTS, 'combined'].map((component) => String(component)).sort();
    expect(sortedAll).toEqual(sortedDerived);
  });

  test('hashStateSnapshot returns a frozen StateHashEntry whose hashes keys exactly match STATE_HASH_COMPONENTS', () => {
    const entry = hashStateSnapshot(0, buildComponentBytes(7));
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.hashes)).toBe(true);
    expect(Object.keys(entry.hashes).sort()).toEqual([...STATE_HASH_COMPONENTS].sort());
  });

  test('hashStateSnapshot preserves the supplied tic verbatim', () => {
    expect(hashStateSnapshot(0, buildComponentBytes(1)).tic).toBe(0);
    expect(hashStateSnapshot(35, buildComponentBytes(1)).tic).toBe(35);
    expect(hashStateSnapshot(1225, buildComponentBytes(1)).tic).toBe(1225);
  });

  test('every individual component hash is the SHA-256 hex of its supplied bytes', () => {
    const bytes = buildComponentBytes(9);
    const entry = hashStateSnapshot(0, bytes);
    for (const component of VANILLA_INDIVIDUAL_STATE_COMPONENTS) {
      const expectedDigest = createHash('sha256').update(bytes[component]).digest('hex');
      expect(entry.hashes[component]).toBe(expectedDigest);
    }
  });

  test('the combined hash is SHA-256 over the five individual digests concatenated in canonical order', () => {
    const bytes = buildComponentBytes(3);
    const entry = hashStateSnapshot(0, bytes);
    let combinedSource = '';
    for (const component of VANILLA_INDIVIDUAL_STATE_COMPONENTS) {
      combinedSource += createHash('sha256').update(bytes[component]).digest('hex');
    }
    const expectedCombined = createHash('sha256').update(combinedSource, 'utf8').digest('hex');
    expect(entry.hashes.combined).toBe(expectedCombined);
  });

  test('hashStateSnapshot is deterministic — same bytes produce identical hashes', () => {
    const entryA = hashStateSnapshot(35, buildComponentBytes(42));
    const entryB = hashStateSnapshot(35, buildComponentBytes(42));
    expect(entryA.hashes).toEqual(entryB.hashes);
  });

  test('hashStateSnapshot is sensitive — a single changed byte changes the combined hash', () => {
    const baseline = hashStateSnapshot(0, buildComponentBytes(1));
    const mutated = hashStateSnapshot(0, buildComponentBytes(2));
    expect(mutated.hashes.combined).not.toBe(baseline.hashes.combined);
  });

  test('every hash is a 64-hex-char SHA-256 digest', () => {
    const entry = hashStateSnapshot(0, buildComponentBytes(5));
    for (const component of STATE_HASH_COMPONENTS) {
      expect(entry.hashes[component]).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
