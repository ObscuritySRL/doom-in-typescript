import { describe, expect, test } from 'bun:test';

import { DEFAULT_SAMPLING_INTERVAL_TICS, INDIVIDUAL_COMPONENT_COUNT, STATE_HASH_COMPONENTS } from '../../../src/oracles/stateHash.ts';
import format from './define-state-snapshot-format.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-012-define-state-snapshot-format.md';
const COMPONENT_PATTERN = /^[a-z][a-z0-9]*$/;

describe('format identity and metadata', () => {
  test('declares OR-VP-STATE-FORMAT-012 oracle id, step 02-012, and oracle lane', () => {
    expect(format.id).toBe('OR-VP-STATE-FORMAT-012');
    expect(format.stepId).toBe('02-012');
    expect(format.stepTitle).toBe('Define State Snapshot Format');
    expect(format.lane).toBe('oracle');
  });

  test('points to the existing stateHash source module', () => {
    expect(format.sourceModule).toBe('src/oracles/stateHash.ts');
  });
});

describe('components match the source-level STATE_HASH_COMPONENTS', () => {
  test('JSON components equal the source-level list', () => {
    expect(format.components).toEqual([...STATE_HASH_COMPONENTS]);
  });

  test('components are ASCIIbetically sorted and unique', () => {
    expect([...format.components].sort()).toEqual([...format.components]);
    expect(new Set(format.components).size).toBe(format.components.length);
    for (const component of format.components) {
      expect(component).toMatch(COMPONENT_PATTERN);
    }
  });

  test('individual component count is one less than total component count', () => {
    expect(format.individualComponentCount).toBe(INDIVIDUAL_COMPONENT_COUNT);
    expect(format.individualComponentCount).toBe(format.components.length - 1);
    expect(format.individualComponentCount).toBe(5);
  });

  test('combined component name appears in the component list', () => {
    expect(format.components).toContain(format.combinedComponentName);
    expect(format.combinedComponentName).toBe('combined');
  });
});

describe('tic and hash invariants', () => {
  test('tic rate is 35 Hz and default sampling matches source-level DEFAULT_SAMPLING_INTERVAL_TICS', () => {
    expect(format.ticRateHz).toBe(35);
    expect(format.defaultSamplingIntervalTics).toBe(DEFAULT_SAMPLING_INTERVAL_TICS);
    expect(format.defaultSamplingIntervalTics).toBe(35);
  });

  test('hash algorithm is SHA-256 with 64 hex characters per hash', () => {
    expect(format.hashAlgorithm).toBe('SHA-256');
    expect(format.hashHexLength).toBe(64);
  });

  test('entry ordering rule pins ascending-by-tic order', () => {
    expect(format.entryOrderingRule).toBe('ascending-by-tic-number-strict');
  });

  test('combined hash derivation rule is sha256 of asciibetical concatenation', () => {
    expect(format.combinedHashDerivationRule).toContain('sha256');
    expect(format.combinedHashDerivationRule).toContain('asciibetical');
  });
});

describe('alignment with plan_vanilla_parity step 02-012', () => {
  test('step file write lock pins the format json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-state-snapshot-format.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-state-snapshot-format.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('component pattern rejects malformed names', () => {
    expect('Player').not.toMatch(COMPONENT_PATTERN);
    expect('rng_state').not.toMatch(COMPONENT_PATTERN);
    expect('1component').not.toMatch(COMPONENT_PATTERN);
  });

  test('hash length of 63 or 65 would break the 64-hex SHA-256 contract', () => {
    expect(format.hashHexLength).not.toBe(63);
    expect(format.hashHexLength).not.toBe(65);
  });
});
