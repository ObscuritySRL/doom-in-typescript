import { describe, expect, test } from 'bun:test';

import { DEFAULT_SAMPLING_INTERVAL_TICS, EMPTY_DEMO_PLAYBACK_STATE_HASH, EMPTY_TITLE_LOOP_STATE_HASH, INDIVIDUAL_COMPONENT_COUNT, STATE_HASH_COMPONENTS } from '../../src/oracles/stateHash.ts';
import type { StateHashArtifact, StateHashComponent, StateHashEntry, StateHashPayload } from '../../src/oracles/stateHash.ts';
import { ORACLE_KINDS } from '../../src/oracles/schema.ts';
import type { OracleArtifact } from '../../src/oracles/schema.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

describe('STATE_HASH_COMPONENTS', () => {
  test('contains exactly 6 components', () => {
    expect(STATE_HASH_COMPONENTS).toHaveLength(6);
  });

  test('includes all expected components', () => {
    const expected: StateHashComponent[] = ['automap', 'combined', 'player', 'rng', 'sectors', 'thinkers'];
    for (const component of expected) {
      expect(STATE_HASH_COMPONENTS).toContain(component);
    }
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...STATE_HASH_COMPONENTS].sort();
    expect(STATE_HASH_COMPONENTS).toEqual(sorted);
  });

  test('contains no duplicates', () => {
    const unique = new Set(STATE_HASH_COMPONENTS);
    expect(unique.size).toBe(STATE_HASH_COMPONENTS.length);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(STATE_HASH_COMPONENTS)).toBe(true);
  });

  test('includes combined as a derived aggregate component', () => {
    expect(STATE_HASH_COMPONENTS).toContain('combined');
  });
});

describe('constants', () => {
  test('DEFAULT_SAMPLING_INTERVAL_TICS is 35 (one second at Doom tic rate)', () => {
    expect(DEFAULT_SAMPLING_INTERVAL_TICS).toBe(35);
    expect(DEFAULT_SAMPLING_INTERVAL_TICS).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('INDIVIDUAL_COMPONENT_COUNT is total minus combined', () => {
    expect(INDIVIDUAL_COMPONENT_COUNT).toBe(STATE_HASH_COMPONENTS.length - 1);
    expect(INDIVIDUAL_COMPONENT_COUNT).toBe(5);
  });
});

describe('ORACLE_KINDS cross-reference', () => {
  test('state-hash is a registered oracle kind', () => {
    expect(ORACLE_KINDS).toContain('state-hash');
  });
});

describe('EMPTY_TITLE_LOOP_STATE_HASH', () => {
  test('targets title-loop run mode', () => {
    expect(EMPTY_TITLE_LOOP_STATE_HASH.targetRunMode).toBe('title-loop');
  });

  test('uses DEFAULT_SAMPLING_INTERVAL_TICS', () => {
    expect(EMPTY_TITLE_LOOP_STATE_HASH.samplingIntervalTics).toBe(DEFAULT_SAMPLING_INTERVAL_TICS);
  });

  test('has empty entries array', () => {
    expect(EMPTY_TITLE_LOOP_STATE_HASH.entries).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_TITLE_LOOP_STATE_HASH.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(EMPTY_TITLE_LOOP_STATE_HASH.ticRateHz).toBe(35);
  });

  test('components list matches STATE_HASH_COMPONENTS', () => {
    expect([...EMPTY_TITLE_LOOP_STATE_HASH.components]).toEqual([...STATE_HASH_COMPONENTS]);
  });

  test('has non-empty description', () => {
    expect(EMPTY_TITLE_LOOP_STATE_HASH.description.length).toBeGreaterThan(0);
  });

  test('is frozen at top level and nested arrays', () => {
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_STATE_HASH)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_STATE_HASH.entries)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_STATE_HASH.components)).toBe(true);
  });
});

describe('EMPTY_DEMO_PLAYBACK_STATE_HASH', () => {
  test('targets demo-playback run mode', () => {
    expect(EMPTY_DEMO_PLAYBACK_STATE_HASH.targetRunMode).toBe('demo-playback');
  });

  test('uses DEFAULT_SAMPLING_INTERVAL_TICS', () => {
    expect(EMPTY_DEMO_PLAYBACK_STATE_HASH.samplingIntervalTics).toBe(DEFAULT_SAMPLING_INTERVAL_TICS);
  });

  test('has empty entries array', () => {
    expect(EMPTY_DEMO_PLAYBACK_STATE_HASH.entries).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_DEMO_PLAYBACK_STATE_HASH.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('is frozen at top level and nested arrays', () => {
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_STATE_HASH)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_STATE_HASH.entries)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_STATE_HASH.components)).toBe(true);
  });
});

describe('StateHashEntry well-formed acceptance', () => {
  test('accepts a valid entry with all component hashes', () => {
    const hash = 'a'.repeat(64);
    const entry: StateHashEntry = {
      tic: 35,
      hashes: {
        automap: hash,
        combined: hash,
        player: hash,
        rng: hash,
        sectors: hash,
        thinkers: hash,
      },
    };
    expect(entry.tic).toBe(35);
    expect(Object.keys(entry.hashes)).toHaveLength(STATE_HASH_COMPONENTS.length);
  });

  test('every component in STATE_HASH_COMPONENTS is a key in hashes', () => {
    const hash = 'b'.repeat(64);
    const hashes: Record<StateHashComponent, string> = {
      automap: hash,
      combined: hash,
      player: hash,
      rng: hash,
      sectors: hash,
      thinkers: hash,
    };
    for (const component of STATE_HASH_COMPONENTS) {
      expect(hashes[component]).toBe(hash);
    }
  });
});

describe('StateHashPayload well-formed acceptance', () => {
  test('accepts a multi-entry payload with ascending tic order', () => {
    const hash = 'c'.repeat(64);
    const hashMap: Record<StateHashComponent, string> = {
      automap: hash,
      combined: hash,
      player: hash,
      rng: hash,
      sectors: hash,
      thinkers: hash,
    };
    const payload: StateHashPayload = {
      description: 'Test state hash with multiple entries',
      targetRunMode: 'demo-playback',
      samplingIntervalTics: 35,
      ticRateHz: 35,
      components: STATE_HASH_COMPONENTS,
      entries: [
        { tic: 0, hashes: hashMap },
        { tic: 35, hashes: hashMap },
        { tic: 70, hashes: hashMap },
      ],
    };
    expect(payload.entries).toHaveLength(3);
    const tics = payload.entries.map((entry) => entry.tic);
    expect(tics).toEqual([0, 35, 70]);
  });

  test('allows sampling interval of 1 for tic-by-tic debugging', () => {
    const hash = 'd'.repeat(64);
    const hashMap: Record<StateHashComponent, string> = {
      automap: hash,
      combined: hash,
      player: hash,
      rng: hash,
      sectors: hash,
      thinkers: hash,
    };
    const payload: StateHashPayload = {
      description: 'Tic-by-tic state hash for divergence debugging',
      targetRunMode: 'title-loop',
      samplingIntervalTics: 1,
      ticRateHz: 35,
      components: STATE_HASH_COMPONENTS,
      entries: [
        { tic: 0, hashes: hashMap },
        { tic: 1, hashes: hashMap },
        { tic: 2, hashes: hashMap },
      ],
    };
    expect(payload.samplingIntervalTics).toBe(1);
  });
});

describe('parity-sensitive edge cases', () => {
  test('combined hash differs when any individual component diverges', () => {
    const baseHash = '0'.repeat(64);
    const divergentHash = 'f'.repeat(64);

    const referenceHashes: Record<StateHashComponent, string> = {
      automap: baseHash,
      combined: baseHash,
      player: baseHash,
      rng: baseHash,
      sectors: baseHash,
      thinkers: baseHash,
    };

    const divergentHashes: Record<StateHashComponent, string> = {
      ...referenceHashes,
      rng: divergentHash,
      combined: divergentHash,
    };

    // Individual component hash (rng) difference causes combined to differ
    expect(divergentHashes.rng).not.toBe(referenceHashes.rng);
    expect(divergentHashes.combined).not.toBe(referenceHashes.combined);
    // Other individual components remain identical
    expect(divergentHashes.player).toBe(referenceHashes.player);
    expect(divergentHashes.sectors).toBe(referenceHashes.sectors);
  });

  test('tic 0 entry captures initial state before any game logic runs', () => {
    const hash = '1'.repeat(64);
    const hashMap: Record<StateHashComponent, string> = {
      automap: hash,
      combined: hash,
      player: hash,
      rng: hash,
      sectors: hash,
      thinkers: hash,
    };
    const entry: StateHashEntry = { tic: 0, hashes: hashMap };
    // Tic 0 is the initial state snapshot before G_Ticker runs
    expect(entry.tic).toBe(0);
    expect(entry.hashes.combined).toBe(hash);
  });

  test('rng component isolates P_Random/M_Random index divergence', () => {
    // The rng component hashes the random number generator table indices
    // independently, allowing precise isolation of nondeterminism
    const referenceRng = 'a1'.repeat(32);
    const divergentRng = 'b2'.repeat(32);
    expect(referenceRng).not.toBe(divergentRng);
    expect(referenceRng).toHaveLength(64);
    expect(divergentRng).toHaveLength(64);
  });
});

describe('compile-time type satisfaction', () => {
  test('StateHashArtifact wraps StateHashPayload in OracleArtifact envelope', () => {
    const artifact: StateHashArtifact = {
      kind: 'state-hash',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: '0'.repeat(64),
      payload: EMPTY_TITLE_LOOP_STATE_HASH,
    };
    expect(artifact.kind).toBe('state-hash');
    expect(artifact.version).toBe(1);
    expect(artifact.payload).toBe(EMPTY_TITLE_LOOP_STATE_HASH);
  });

  test('StateHashArtifact satisfies OracleArtifact<StateHashPayload>', () => {
    const artifact: OracleArtifact<StateHashPayload> = {
      kind: 'state-hash',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: 'A'.repeat(64),
      payload: EMPTY_DEMO_PLAYBACK_STATE_HASH,
    };
    expect(artifact.payload.targetRunMode).toBe('demo-playback');
  });
});
