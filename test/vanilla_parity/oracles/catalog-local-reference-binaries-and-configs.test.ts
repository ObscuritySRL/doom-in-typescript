import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import catalog from './catalog-local-reference-binaries-and-configs.json';
import fileHashes from '../../../reference/manifests/file-hashes.json';
import sourceCatalog from '../../../reference/manifests/source-catalog.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-001-catalog-local-reference-binaries-and-configs.md';
const SHA256_HEX_PATTERN = /^[0-9A-F]{64}$/;
const SOURCE_CATALOG_ID_PATTERN = /^S-\d{3}$/;

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

interface SourceCatalogEntry {
  readonly authority: string;
  readonly id: string;
  readonly kind: string;
  readonly notes: string;
  readonly pathOrUrl: string;
  readonly source: string;
}

function findFileHashesEntry(filename: string): FileHashesEntry | undefined {
  return (fileHashes.files as readonly FileHashesEntry[]).find((entry) => entry.filename === filename);
}

function findSourceCatalogEntry(sourceCatalogId: string): SourceCatalogEntry | undefined {
  return (sourceCatalog.entries as readonly SourceCatalogEntry[]).find((entry) => entry.id === sourceCatalogId);
}

async function computeSha256OfFile(relativePath: string): Promise<string> {
  const fileBytes = await Bun.file(relativePath).bytes();
  return new Bun.CryptoHasher('sha256').update(fileBytes).digest('hex').toUpperCase();
}

describe('catalog identity and metadata', () => {
  test('declares OR-VP-CATALOG-001 oracle id, step 02-001, and oracle lane', () => {
    expect(catalog.id).toBe('OR-VP-CATALOG-001');
    expect(catalog.stepId).toBe('02-001');
    expect(catalog.stepTitle).toBe('Catalog Local Reference Binaries And Configs');
    expect(catalog.lane).toBe('oracle');
  });

  test('declares doom/ as the source directory and SHA-256 as the hash algorithm', () => {
    expect(catalog.sourceDirectory).toBe('doom/');
    expect(catalog.hashAlgorithm).toBe('SHA-256');
  });

  test('description is non-empty and references vanilla parity oracles', () => {
    expect(catalog.description.length).toBeGreaterThan(0);
    expect(catalog.description.toLowerCase()).toContain('vanilla');
    expect(catalog.description.toLowerCase()).toContain('oracle');
  });

  test('manifest cross-references include both file-hashes.json and source-catalog.json', () => {
    expect(catalog.manifestCrossReferences).toContain('reference/manifests/file-hashes.json');
    expect(catalog.manifestCrossReferences).toContain('reference/manifests/source-catalog.json');
  });

  test('each declared cross-reference manifest exists on disk', () => {
    for (const manifestPath of catalog.manifestCrossReferences) {
      expect(existsSync(manifestPath)).toBe(true);
      expect(statSync(manifestPath).isFile()).toBe(true);
    }
  });

  test('validRoles and validAuthorities are non-empty, ASCIIbetically sorted, and contain unique values', () => {
    expect(catalog.validRoles.length).toBeGreaterThan(0);
    expect([...catalog.validRoles].sort()).toEqual([...catalog.validRoles]);
    expect(new Set(catalog.validRoles).size).toBe(catalog.validRoles.length);

    expect(catalog.validAuthorities.length).toBeGreaterThan(0);
    expect([...catalog.validAuthorities].sort()).toEqual([...catalog.validAuthorities]);
    expect(new Set(catalog.validAuthorities).size).toBe(catalog.validAuthorities.length);
  });
});

describe('catalog entries shape', () => {
  test('contains exactly the five files listed under the step research sources', () => {
    expect(catalog.entries).toHaveLength(5);
    const filenames = (catalog.entries as readonly CatalogEntry[]).map((entry) => entry.filename).sort();
    expect(filenames).toEqual(['DOOM.EXE', 'DOOM1.WAD', 'DOOMD.EXE', 'chocolate-doom.cfg', 'default.cfg']);
  });

  test('every entry has all required fields with non-empty values', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(entry.authority.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.filename.length).toBeGreaterThan(0);
      expect(entry.relativePath.length).toBeGreaterThan(0);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.sha256.length).toBe(64);
      expect(entry.sizeBytes).toBeGreaterThan(0);
      expect(entry.sourceCatalogId.length).toBeGreaterThan(0);
    }
  });

  test('every sha256 value is uppercase hex of length 64', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(entry.sha256).toMatch(SHA256_HEX_PATTERN);
    }
  });

  test('every relativePath equals doom/<filename>', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(entry.relativePath).toBe(`doom/${entry.filename}`);
    }
  });

  test('every role is declared in validRoles', () => {
    const validRoles = new Set(catalog.validRoles);
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(validRoles.has(entry.role)).toBe(true);
    }
  });

  test('every authority is declared in validAuthorities', () => {
    const validAuthorities = new Set(catalog.validAuthorities);
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(validAuthorities.has(entry.authority)).toBe(true);
    }
  });

  test('every sourceCatalogId matches the S-### pattern', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(entry.sourceCatalogId).toMatch(SOURCE_CATALOG_ID_PATTERN);
    }
  });

  test('filenames are unique across entries', () => {
    const filenames = (catalog.entries as readonly CatalogEntry[]).map((entry) => entry.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  test('sha256 hashes are unique across entries', () => {
    const hashes = (catalog.entries as readonly CatalogEntry[]).map((entry) => entry.sha256);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  test('sourceCatalogIds are unique across entries', () => {
    const sourceCatalogIds = (catalog.entries as readonly CatalogEntry[]).map((entry) => entry.sourceCatalogId);
    expect(new Set(sourceCatalogIds).size).toBe(sourceCatalogIds.length);
  });
});

describe('cross-reference with reference/manifests/file-hashes.json', () => {
  test('every cataloged hash, size, and role matches the file-hashes manifest', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
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

describe('cross-reference with reference/manifests/source-catalog.json', () => {
  test('every sourceCatalogId resolves to an entry whose pathOrUrl ends with the cataloged filename', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      const sourceEntry = findSourceCatalogEntry(entry.sourceCatalogId);
      expect(sourceEntry).toBeDefined();
      const pathOrUrlSuffix = sourceEntry!.pathOrUrl.replace(/\\/g, '/').toLowerCase();
      expect(pathOrUrlSuffix.endsWith(`/${entry.filename.toLowerCase()}`)).toBe(true);
    }
  });

  test('every cataloged authority matches the authority declared by the corresponding source-catalog entry', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      const sourceEntry = findSourceCatalogEntry(entry.sourceCatalogId);
      expect(sourceEntry).toBeDefined();
      expect(entry.authority).toBe(sourceEntry!.authority);
    }
  });
});

describe('on-disk verification of cataloged files', () => {
  test('every cataloged file exists at the declared relative path', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(existsSync(entry.relativePath)).toBe(true);
      expect(statSync(entry.relativePath).isFile()).toBe(true);
    }
  });

  test('every cataloged file size matches the on-disk byte length', () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(statSync(entry.relativePath).size).toBe(entry.sizeBytes);
    }
  });

  test('every cataloged file SHA-256 matches the freshly computed on-disk SHA-256', async () => {
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      const actualSha256 = await computeSha256OfFile(entry.relativePath);
      expect(actualSha256).toBe(entry.sha256);
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-001', () => {
  test('step file lists every cataloged relativePath under research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    for (const entry of catalog.entries as readonly CatalogEntry[]) {
      expect(stepFileText).toContain(`- ${entry.relativePath}`);
    }
  });

  test('step file write lock pins the catalog json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/catalog-local-reference-binaries-and-configs.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/catalog-local-reference-binaries-and-configs.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('hash regex rejects strings shorter than 64 characters', () => {
    expect('A'.repeat(63)).not.toMatch(SHA256_HEX_PATTERN);
  });

  test('hash regex rejects strings longer than 64 characters', () => {
    expect('A'.repeat(65)).not.toMatch(SHA256_HEX_PATTERN);
  });

  test('hash regex rejects lowercase hex strings', () => {
    expect('a'.repeat(64)).not.toMatch(SHA256_HEX_PATTERN);
  });

  test('hash regex rejects strings with non-hex characters', () => {
    expect(`${'A'.repeat(63)}Z`).not.toMatch(SHA256_HEX_PATTERN);
  });

  test('source catalog id pattern rejects malformed ids', () => {
    expect('S-1').not.toMatch(SOURCE_CATALOG_ID_PATTERN);
    expect('S-12345').not.toMatch(SOURCE_CATALOG_ID_PATTERN);
    expect('SOURCE-001').not.toMatch(SOURCE_CATALOG_ID_PATTERN);
    expect('s-001').not.toMatch(SOURCE_CATALOG_ID_PATTERN);
  });

  test('lookup helpers return undefined for unknown identifiers', () => {
    expect(findFileHashesEntry('NOT-A-REAL-FILE.exe')).toBeUndefined();
    expect(findSourceCatalogEntry('S-999')).toBeUndefined();
  });
});
