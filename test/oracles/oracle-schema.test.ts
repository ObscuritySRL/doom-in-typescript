import { describe, expect, it } from 'bun:test';

import { ORACLE_KINDS, ORACLE_TRUST_LEVELS } from '../../src/oracles/schema.ts';
import type { OracleArtifact, OracleKind, OracleRecord, OracleTrustLevel } from '../../src/oracles/schema.ts';

describe('OracleTrustLevel', () => {
  it('contains exactly four trust levels', () => {
    expect(ORACLE_TRUST_LEVELS).toHaveLength(4);
  });

  it('includes high, medium, low, and unverified', () => {
    expect(ORACLE_TRUST_LEVELS).toContain('high');
    expect(ORACLE_TRUST_LEVELS).toContain('medium');
    expect(ORACLE_TRUST_LEVELS).toContain('low');
    expect(ORACLE_TRUST_LEVELS).toContain('unverified');
  });

  it('is ASCIIbetically sorted', () => {
    const sorted = [...ORACLE_TRUST_LEVELS].sort();
    expect(ORACLE_TRUST_LEVELS).toEqual(sorted);
  });

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(ORACLE_TRUST_LEVELS)).toBe(true);
  });
});

describe('OracleKind', () => {
  it('contains exactly twelve kinds', () => {
    expect(ORACLE_KINDS).toHaveLength(12);
  });

  it('is ASCIIbetically sorted', () => {
    const sorted = [...ORACLE_KINDS].sort();
    expect(ORACLE_KINDS).toEqual(sorted);
  });

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(ORACLE_KINDS)).toBe(true);
  });

  it('has no duplicate entries', () => {
    const unique = new Set(ORACLE_KINDS);
    expect(unique.size).toBe(ORACLE_KINDS.length);
  });

  it('includes every Phase-02 oracle format', () => {
    const phase02Kinds: OracleKind[] = ['audio-hash', 'framebuffer-hash', 'input-script', 'manual-gate', 'music-event-log', 'run-manifest', 'state-hash'];
    for (const kind of phase02Kinds) {
      expect(ORACLE_KINDS).toContain(kind);
    }
  });

  it('includes every Phase-00 manifest kind', () => {
    const phase00Kinds: OracleKind[] = ['console-log', 'file-hash-manifest', 'package-capability-matrix', 'source-catalog', 'wad-directory-summary'];
    for (const kind of phase00Kinds) {
      expect(ORACLE_KINDS).toContain(kind);
    }
  });

  it('uses only lowercase-kebab-case strings', () => {
    const kebabPattern = /^[a-z]+(-[a-z]+)*$/;
    for (const kind of ORACLE_KINDS) {
      expect(kind).toMatch(kebabPattern);
    }
  });
});

describe('OracleRecord', () => {
  const validRecord: OracleRecord = Object.freeze({
    id: 'O-001',
    oracle: 'reference-file-hashes',
    kind: 'file-hash-manifest',
    source: 'S-001 through S-007',
    generationMethod: 'Hash the local reference files.',
    artifactPath: 'reference/manifests/file-hashes.json',
    hash: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
    consumers: ['00-002', '02-001', '17-010'],
    trustLevel: 'high',
  });

  it('accepts a well-formed record', () => {
    const record: OracleRecord = validRecord;
    expect(record.id).toBe('O-001');
    expect(record.kind).toBe('file-hash-manifest');
    expect(record.trustLevel).toBe('high');
  });

  it('allows an empty consumers array', () => {
    const record: OracleRecord = { ...validRecord, consumers: [] };
    expect(record.consumers).toHaveLength(0);
  });

  it('allows a generation marker string instead of a real hash', () => {
    const record: OracleRecord = {
      ...validRecord,
      hash: 'generated-by-step-00-002',
    };
    expect(record.hash).toBe('generated-by-step-00-002');
  });
});

describe('OracleArtifact', () => {
  it('accepts a typed payload', () => {
    interface TestPayload {
      readonly value: number;
    }
    const artifact: OracleArtifact<TestPayload> = {
      kind: 'state-hash',
      version: 1,
      generatedAt: '2026-04-12',
      sourceHash: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
      payload: { value: 42 },
    };
    expect(artifact.kind).toBe('state-hash');
    expect(artifact.version).toBe(1);
    expect(artifact.payload.value).toBe(42);
  });

  it('defaults to unknown payload when no type parameter is given', () => {
    const artifact: OracleArtifact = {
      kind: 'console-log',
      version: 1,
      generatedAt: '2026-04-12',
      sourceHash: '0000000000000000000000000000000000000000000000000000000000000000',
      payload: 'raw text content',
    };
    expect(artifact.payload).toBe('raw text content');
  });

  it('requires version to start at 1 or higher (convention check)', () => {
    const artifact: OracleArtifact = {
      kind: 'file-hash-manifest',
      version: 1,
      generatedAt: '2026-04-12',
      sourceHash: 'FF'.repeat(32),
      payload: null,
    };
    expect(artifact.version).toBeGreaterThanOrEqual(1);
  });

  it('rejects version zero by convention', () => {
    const artifact: OracleArtifact = {
      kind: 'run-manifest',
      version: 0,
      generatedAt: '2026-04-12',
      sourceHash: '00'.repeat(32),
      payload: {},
    };
    expect(artifact.version).toBeLessThan(1);
  });

  it('preserves kind discriminant for narrowing', () => {
    const artifact: OracleArtifact<string[]> = {
      kind: 'input-script',
      version: 1,
      generatedAt: '2026-04-12',
      sourceHash: 'AA'.repeat(32),
      payload: ['forward', 'fire'],
    };
    expect(ORACLE_KINDS).toContain(artifact.kind);
    expect(artifact.payload).toHaveLength(2);
  });
});
