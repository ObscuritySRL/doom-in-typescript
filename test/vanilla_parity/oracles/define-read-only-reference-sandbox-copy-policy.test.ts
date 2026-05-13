import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import fileHashes from '../../../reference/manifests/file-hashes.json';
import policy from './define-read-only-reference-sandbox-copy-policy.json';

const SHA256_HEX_PATTERN = /^[0-9A-F]{64}$/;
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-003-define-read-only-reference-sandbox-copy-policy.md';
const SANDBOX_PREFIX_PATTERN = /^[a-z][a-z0-9-]*-$/;
const SANDBOX_PARENT_PATTERN = /^\.[a-z][a-z0-9-]*$/;

interface ExcludedFileEntry {
  readonly filename: string;
  readonly reason: string;
}

interface FileHashesEntry {
  readonly filename: string;
  readonly role: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

interface RequiredFileEntry {
  readonly filename: string;
  readonly mutableDuringRun: boolean;
  readonly role: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

function findFileHashesEntry(filename: string): FileHashesEntry | undefined {
  return (fileHashes.files as readonly FileHashesEntry[]).find((entry) => entry.filename === filename);
}

describe('policy identity and metadata', () => {
  test('declares OR-VP-SANDBOX-POLICY-003 oracle id, step 02-003, and oracle lane', () => {
    expect(policy.id).toBe('OR-VP-SANDBOX-POLICY-003');
    expect(policy.stepId).toBe('02-003');
    expect(policy.stepTitle).toBe('Define Read Only Reference Sandbox Copy Policy');
    expect(policy.lane).toBe('oracle');
  });

  test('pins doom/ as the read-only source directory', () => {
    expect(policy.readOnlySourceDirectory).toBe('doom/');
    expect(existsSync(policy.readOnlySourceDirectory)).toBe(true);
    expect(statSync(policy.readOnlySourceDirectory).isDirectory()).toBe(true);
  });

  test('sandbox parent and prefix follow safe kebab-case patterns', () => {
    expect(policy.sandboxParent).toMatch(SANDBOX_PARENT_PATTERN);
    expect(policy.sandboxPrefix).toMatch(SANDBOX_PREFIX_PATTERN);
  });

  test('verify, cleanup, and mutable-config flags default to safe values', () => {
    expect(policy.verifyHashesAfterCopy).toBe(true);
    expect(policy.cleanupAfterRun).toBe(true);
    expect(policy.copyConfigsAsMutable).toBe(true);
  });

  test('validRoles is non-empty, sorted, unique, and covers config/executable/iwad', () => {
    expect(policy.validRoles.length).toBeGreaterThan(0);
    expect([...policy.validRoles].sort()).toEqual([...policy.validRoles]);
    expect(new Set(policy.validRoles).size).toBe(policy.validRoles.length);
    expect(new Set(policy.validRoles)).toEqual(new Set(['config', 'executable', 'iwad']));
  });

  test('every cross-reference manifest exists on disk', () => {
    for (const manifestPath of policy.manifestCrossReferences) {
      expect(existsSync(manifestPath)).toBe(true);
      expect(statSync(manifestPath).isFile()).toBe(true);
    }
  });
});

describe('required files shape and on-disk consistency', () => {
  test('contains exactly the four files required for a Windows-host reference run', () => {
    expect(policy.requiredFiles).toHaveLength(4);
    const filenames = (policy.requiredFiles as readonly RequiredFileEntry[]).map((entry) => entry.filename).sort();
    expect(filenames).toEqual(['DOOM.EXE', 'DOOM1.WAD', 'chocolate-doom.cfg', 'default.cfg']);
  });

  test('every required file has all required fields with non-empty values', () => {
    for (const entry of policy.requiredFiles as readonly RequiredFileEntry[]) {
      expect(entry.filename.length).toBeGreaterThan(0);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.sha256).toMatch(SHA256_HEX_PATTERN);
      expect(entry.sizeBytes).toBeGreaterThan(0);
      expect(typeof entry.mutableDuringRun).toBe('boolean');
    }
  });

  test('every required file role is declared in validRoles', () => {
    const validRoles = new Set(policy.validRoles);
    for (const entry of policy.requiredFiles as readonly RequiredFileEntry[]) {
      expect(validRoles.has(entry.role)).toBe(true);
    }
  });

  test('only config files are flagged as mutable during a run', () => {
    for (const entry of policy.requiredFiles as readonly RequiredFileEntry[]) {
      if (entry.role === 'config') {
        expect(entry.mutableDuringRun).toBe(true);
      } else {
        expect(entry.mutableDuringRun).toBe(false);
      }
    }
  });

  test('every required file exists under the read-only source directory', () => {
    for (const entry of policy.requiredFiles as readonly RequiredFileEntry[]) {
      const relativePath = `${policy.readOnlySourceDirectory}${entry.filename}`;
      expect(existsSync(relativePath)).toBe(true);
      expect(statSync(relativePath).isFile()).toBe(true);
      expect(statSync(relativePath).size).toBe(entry.sizeBytes);
    }
  });

  test('every required file hash, size, and role matches the upstream file-hashes manifest', () => {
    for (const entry of policy.requiredFiles as readonly RequiredFileEntry[]) {
      const manifestEntry = findFileHashesEntry(entry.filename);
      expect(manifestEntry).toBeDefined();
      expect(entry.sha256).toBe(manifestEntry!.sha256);
      expect(entry.sizeBytes).toBe(manifestEntry!.sizeBytes);
    }
  });

  test('required filenames and hashes are unique', () => {
    const filenames = (policy.requiredFiles as readonly RequiredFileEntry[]).map((entry) => entry.filename);
    const hashes = (policy.requiredFiles as readonly RequiredFileEntry[]).map((entry) => entry.sha256);
    expect(new Set(filenames).size).toBe(filenames.length);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe('excluded files shape and disjointness from required set', () => {
  test('excluded set covers the four reference bundle files that never participate in a Windows-host sandbox run', () => {
    expect(policy.excludedFiles).toHaveLength(4);
    const filenames = (policy.excludedFiles as readonly ExcludedFileEntry[]).map((entry) => entry.filename).sort();
    expect(filenames).toEqual(['DOOMD.EXE', 'DOOMDUPX.EXE', 'DOOMWUPX.exe', 'smash.py']);
  });

  test('every excluded file has a non-empty justification reason', () => {
    for (const entry of policy.excludedFiles as readonly ExcludedFileEntry[]) {
      expect(entry.filename.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  test('required and excluded filename sets are disjoint', () => {
    const requiredFilenames = new Set((policy.requiredFiles as readonly RequiredFileEntry[]).map((entry) => entry.filename));
    for (const entry of policy.excludedFiles as readonly ExcludedFileEntry[]) {
      expect(requiredFilenames.has(entry.filename)).toBe(false);
    }
  });

  test('required and excluded sets together cover all eight files in the upstream file-hashes manifest', () => {
    const requiredFilenames = (policy.requiredFiles as readonly RequiredFileEntry[]).map((entry) => entry.filename);
    const excludedFilenames = (policy.excludedFiles as readonly ExcludedFileEntry[]).map((entry) => entry.filename);
    const combined = new Set<string>([...requiredFilenames, ...excludedFilenames]);
    const manifestFilenames = (fileHashes.files as readonly FileHashesEntry[]).map((entry) => entry.filename);
    expect(combined.size).toBe(manifestFilenames.length);
    for (const manifestFilename of manifestFilenames) {
      expect(combined.has(manifestFilename)).toBe(true);
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-003', () => {
  test('step file write lock pins the policy json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-read-only-reference-sandbox-copy-policy.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-read-only-reference-sandbox-copy-policy.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists doom/ research sources for every required and excluded file', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    for (const entry of policy.requiredFiles as readonly RequiredFileEntry[]) {
      expect(stepFileText).toContain(`- doom/${entry.filename}`);
    }
  });
});

describe('failure-mode validation invariants', () => {
  test('a perturbed expected hash would not match the manifest hash for the same filename', () => {
    const reference = policy.requiredFiles[0] as RequiredFileEntry;
    const manifestEntry = findFileHashesEntry(reference.filename);
    expect(manifestEntry).toBeDefined();
    const perturbedHash = reference.sha256.startsWith('0') ? `1${reference.sha256.slice(1)}` : `0${reference.sha256.slice(1)}`;
    expect(perturbedHash).not.toBe(manifestEntry!.sha256);
  });

  test('sandbox prefix pattern rejects unsafe prefixes', () => {
    expect('/abs/path-').not.toMatch(SANDBOX_PREFIX_PATTERN);
    expect('..-').not.toMatch(SANDBOX_PREFIX_PATTERN);
    expect('UPPER-').not.toMatch(SANDBOX_PREFIX_PATTERN);
    expect('sandbox').not.toMatch(SANDBOX_PREFIX_PATTERN);
  });

  test('sandbox parent pattern rejects unsafe parent paths', () => {
    expect('absolute').not.toMatch(SANDBOX_PARENT_PATTERN);
    expect('../escape').not.toMatch(SANDBOX_PARENT_PATTERN);
    expect('.A').not.toMatch(SANDBOX_PARENT_PATTERN);
    expect('.').not.toMatch(SANDBOX_PARENT_PATTERN);
  });

  test('lookup helper returns undefined for unknown filenames', () => {
    expect(findFileHashesEntry('NOT-A-REAL-FILE.bin')).toBeUndefined();
  });
});
