import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import catalog from './catalog-local-reference-binaries-and-configs.json';
import fileHashes from '../../../reference/manifests/file-hashes.json';
import verification from './verify-local-reference-file-hashes.json';

const SHA256_HEX_PATTERN = /^[0-9A-F]{64}$/;
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-002-verify-local-reference-file-hashes.md';

interface CatalogEntry {
  readonly authority: string;
  readonly description: string;
  readonly filename: string;
  readonly relativePath: string;
  readonly role: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly sourceCatalogId: string;
}

interface FileHashesEntry {
  readonly filename: string;
  readonly role: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

interface VerificationEntry {
  readonly description: string;
  readonly filename: string;
  readonly relativePath: string;
  readonly role: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

function findCatalogEntry(filename: string): CatalogEntry | undefined {
  return (catalog.entries as readonly CatalogEntry[]).find((entry) => entry.filename === filename);
}

function findFileHashesEntry(filename: string): FileHashesEntry | undefined {
  return (fileHashes.files as readonly FileHashesEntry[]).find((entry) => entry.filename === filename);
}

async function computeSha256OfFile(relativePath: string): Promise<string> {
  const fileBytes = await Bun.file(relativePath).bytes();
  return new Bun.CryptoHasher('sha256').update(fileBytes).digest('hex').toUpperCase();
}

describe('verification identity and metadata', () => {
  test('declares OR-VP-VERIFY-HASHES-002 oracle id, step 02-002, and oracle lane', () => {
    expect(verification.id).toBe('OR-VP-VERIFY-HASHES-002');
    expect(verification.stepId).toBe('02-002');
    expect(verification.stepTitle).toBe('Verify Local Reference File Hashes');
    expect(verification.lane).toBe('oracle');
  });

  test('declares doom/ as the source directory and SHA-256 as the hash algorithm', () => {
    expect(verification.sourceDirectory).toBe('doom/');
    expect(verification.hashAlgorithm).toBe('SHA-256');
  });

  test('manifest cross-references both the upstream reference hash manifest and the 02-001 catalog', () => {
    expect(verification.manifestCrossReferences).toContain('reference/manifests/file-hashes.json');
    expect(verification.manifestCrossReferences).toContain('test/vanilla_parity/oracles/catalog-local-reference-binaries-and-configs.json');
  });

  test('each declared cross-reference manifest exists on disk', () => {
    for (const manifestPath of verification.manifestCrossReferences) {
      expect(existsSync(manifestPath)).toBe(true);
      expect(statSync(manifestPath).isFile()).toBe(true);
    }
  });

  test('validRoles is non-empty, ASCIIbetically sorted, and contains unique values', () => {
    expect(verification.validRoles.length).toBeGreaterThan(0);
    expect([...verification.validRoles].sort()).toEqual([...verification.validRoles]);
    expect(new Set(verification.validRoles).size).toBe(verification.validRoles.length);
  });
});

describe('verification entries shape', () => {
  test('covers exactly the five files listed under the 02-002 step research sources', () => {
    expect(verification.entries).toHaveLength(5);
    const filenames = (verification.entries as readonly VerificationEntry[]).map((entry) => entry.filename).sort();
    expect(filenames).toEqual(['DOOM.EXE', 'DOOM1.WAD', 'DOOMD.EXE', 'chocolate-doom.cfg', 'default.cfg']);
  });

  test('every entry has all required fields with non-empty values', () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.filename.length).toBeGreaterThan(0);
      expect(entry.relativePath.length).toBeGreaterThan(0);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.sha256).toMatch(SHA256_HEX_PATTERN);
      expect(entry.sizeBytes).toBeGreaterThan(0);
    }
  });

  test('every relativePath equals doom/<filename>', () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      expect(entry.relativePath).toBe(`doom/${entry.filename}`);
    }
  });

  test('every role is declared in validRoles', () => {
    const validRoles = new Set(verification.validRoles);
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      expect(validRoles.has(entry.role)).toBe(true);
    }
  });

  test('filenames are unique across entries', () => {
    const filenames = (verification.entries as readonly VerificationEntry[]).map((entry) => entry.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  test('sha256 hashes are unique across entries', () => {
    const hashes = (verification.entries as readonly VerificationEntry[]).map((entry) => entry.sha256);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe('cross-reference with reference/manifests/file-hashes.json', () => {
  test('every verified hash, size, and role matches the upstream file-hashes manifest entry', () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      const manifestEntry = findFileHashesEntry(entry.filename);
      expect(manifestEntry).toBeDefined();
      expect(entry.sha256).toBe(manifestEntry!.sha256);
      expect(entry.sizeBytes).toBe(manifestEntry!.sizeBytes);
      expect(entry.role).toBe(manifestEntry!.role);
    }
  });

  test('file-hashes manifest declares SHA-256 as its hash algorithm', () => {
    expect(fileHashes.algorithm).toBe('SHA-256');
  });
});

describe('cross-reference with the 02-001 catalog', () => {
  test('every verified hash, size, and role matches the 02-001 catalog entry', () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      const catalogEntry = findCatalogEntry(entry.filename);
      expect(catalogEntry).toBeDefined();
      expect(entry.sha256).toBe(catalogEntry!.sha256);
      expect(entry.sizeBytes).toBe(catalogEntry!.sizeBytes);
      expect(entry.role).toBe(catalogEntry!.role);
      expect(entry.relativePath).toBe(catalogEntry!.relativePath);
    }
  });
});

describe('on-disk verification of pinned files', () => {
  test('every pinned file exists at the declared relative path', () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      expect(existsSync(entry.relativePath)).toBe(true);
      expect(statSync(entry.relativePath).isFile()).toBe(true);
    }
  });

  test('every pinned file size matches the on-disk byte length', () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      expect(statSync(entry.relativePath).size).toBe(entry.sizeBytes);
    }
  });

  test('every pinned file SHA-256 matches the freshly computed on-disk SHA-256', async () => {
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      const actualSha256 = await computeSha256OfFile(entry.relativePath);
      expect(actualSha256).toBe(entry.sha256);
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-002', () => {
  test('step file lists every verified relativePath under research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    for (const entry of verification.entries as readonly VerificationEntry[]) {
      expect(stepFileText).toContain(`- ${entry.relativePath}`);
    }
  });

  test('step file write lock pins the verification json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/verify-local-reference-file-hashes.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/verify-local-reference-file-hashes.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('a perturbed expected hash would not match the on-disk SHA-256', async () => {
    const reference = verification.entries[0] as VerificationEntry;
    const actualSha256 = await computeSha256OfFile(reference.relativePath);
    const perturbedHash = reference.sha256.startsWith('0') ? `1${reference.sha256.slice(1)}` : `0${reference.sha256.slice(1)}`;
    expect(actualSha256).not.toBe(perturbedHash);
    expect(actualSha256).toBe(reference.sha256);
  });

  test('a missing file would fail the existence guard', () => {
    expect(existsSync('doom/__NONEXISTENT__.bin')).toBe(false);
  });

  test('hash regex rejects malformed candidates', () => {
    expect('A'.repeat(63)).not.toMatch(SHA256_HEX_PATTERN);
    expect('A'.repeat(65)).not.toMatch(SHA256_HEX_PATTERN);
    expect('a'.repeat(64)).not.toMatch(SHA256_HEX_PATTERN);
    expect(`${'A'.repeat(63)}Z`).not.toMatch(SHA256_HEX_PATTERN);
  });

  test('lookup helpers return undefined for unknown filenames', () => {
    expect(findCatalogEntry('NOT-A-REAL-FILE.exe')).toBeUndefined();
    expect(findFileHashesEntry('NOT-A-REAL-FILE.exe')).toBeUndefined();
  });
});
