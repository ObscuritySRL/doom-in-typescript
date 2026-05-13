import { describe, expect, test } from 'bun:test';

import { VANILLA_STATE_HASH_ALGORITHM, VANILLA_STATE_HASH_COMBINED_NAME, VANILLA_STATE_HASH_COMPONENTS_FROM_02_012, VANILLA_STATE_HASH_HOOK_INSERTION_PHASE, validatePerTicStateHashCollection } from '../../../src/core/add-determinism-state-hash-hook.ts';

const VALID_HASH = 'a'.repeat(64);

describe('vanilla state-hash hook contract', () => {
  test('insertion phase is after P_Ticker and before D_Display', () => {
    expect(VANILLA_STATE_HASH_HOOK_INSERTION_PHASE).toBe('after_p_ticker_before_d_display');
  });

  test('components match the 02-012 canonical list (5 individual + combined)', () => {
    expect(VANILLA_STATE_HASH_COMPONENTS_FROM_02_012).toEqual(['automap', 'player', 'rng', 'sectors', 'thinkers']);
    expect(VANILLA_STATE_HASH_COMBINED_NAME).toBe('combined');
  });

  test('hash algorithm is SHA-256', () => {
    expect(VANILLA_STATE_HASH_ALGORITHM).toBe('SHA-256');
  });
});

describe('validatePerTicStateHashCollection', () => {
  test('accepts a canonical collection with valid SHA-256 hex hashes', () => {
    const violations = validatePerTicStateHashCollection({
      tic: 0,
      automap: VALID_HASH,
      player: VALID_HASH,
      rng: VALID_HASH,
      sectors: VALID_HASH,
      thinkers: VALID_HASH,
      combined: VALID_HASH,
    });
    expect(violations).toEqual([]);
  });

  test('flags invalid_tic on negative or non-integer tic', () => {
    const violations = validatePerTicStateHashCollection({
      tic: -1,
      automap: VALID_HASH,
      player: VALID_HASH,
      rng: VALID_HASH,
      sectors: VALID_HASH,
      thinkers: VALID_HASH,
      combined: VALID_HASH,
    });
    expect(violations).toContain('invalid_tic');
  });

  test('flags missing_component_hash on empty component hash', () => {
    const violations = validatePerTicStateHashCollection({
      tic: 0,
      automap: '',
      player: VALID_HASH,
      rng: VALID_HASH,
      sectors: VALID_HASH,
      thinkers: VALID_HASH,
      combined: VALID_HASH,
    });
    expect(violations).toContain('missing_component_hash');
  });

  test('flags malformed_hash on non-hex or wrong-length hash', () => {
    const violations = validatePerTicStateHashCollection({
      tic: 0,
      automap: 'xyz',
      player: VALID_HASH,
      rng: VALID_HASH,
      sectors: VALID_HASH,
      thinkers: VALID_HASH,
      combined: VALID_HASH,
    });
    expect(violations).toContain('malformed_hash');
  });
});
