import { describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_EXCLUDED_FILES, SANDBOX_REQUIRED_FILES } from '../../src/oracles/referenceSandbox.ts';
import type { ExcludedFileEntry, SandboxFileEntry, SandboxFileRole, SandboxPolicy } from '../../src/oracles/referenceSandbox.ts';
import { ASSET_BOUNDARIES, CODEX_WORKSPACE_PATH, REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

import fileHashes from '../../reference/manifests/file-hashes.json';

describe('SANDBOX_REQUIRED_FILES', () => {
  test('contains exactly 4 files', () => {
    expect(SANDBOX_REQUIRED_FILES).toHaveLength(4);
  });

  test('filenames are in ASCIIbetical order', () => {
    const names = SANDBOX_REQUIRED_FILES.map((entry) => entry.filename);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  test('every entry has non-empty filename, hash, positive size, and valid role', () => {
    const validRoles: readonly SandboxFileRole[] = ['config', 'executable', 'iwad'];
    for (const entry of SANDBOX_REQUIRED_FILES) {
      expect(entry.filename.length).toBeGreaterThan(0);
      expect(entry.expectedHash.length).toBe(64);
      expect(entry.expectedSize).toBeGreaterThan(0);
      expect(validRoles).toContain(entry.role);
      expect(typeof entry.mutableDuringRun).toBe('boolean');
    }
  });

  test('hashes are uppercase hex strings', () => {
    for (const entry of SANDBOX_REQUIRED_FILES) {
      expect(entry.expectedHash).toMatch(/^[0-9A-F]{64}$/);
    }
  });

  test('executable hash matches PRIMARY_TARGET', () => {
    const executable = SANDBOX_REQUIRED_FILES.find((entry) => entry.role === 'executable');
    expect(executable).toBeDefined();
    expect(executable!.expectedHash).toBe(PRIMARY_TARGET.executableHash);
  });

  test('IWAD hash matches PRIMARY_TARGET', () => {
    const iwad = SANDBOX_REQUIRED_FILES.find((entry) => entry.role === 'iwad');
    expect(iwad).toBeDefined();
    expect(iwad!.expectedHash).toBe(PRIMARY_TARGET.wadHash);
  });

  test('hashes and sizes cross-reference with file-hashes.json manifest', () => {
    for (const entry of SANDBOX_REQUIRED_FILES) {
      const manifestEntry = fileHashes.files.find((file: { filename: string }) => file.filename === entry.filename);
      expect(manifestEntry).toBeDefined();
      expect(entry.expectedHash).toBe(manifestEntry!.sha256);
      expect(entry.expectedSize).toBe(manifestEntry!.sizeBytes);
    }
  });

  test('only config files are mutable during run', () => {
    for (const entry of SANDBOX_REQUIRED_FILES) {
      if (entry.role === 'config') {
        expect(entry.mutableDuringRun).toBe(true);
      } else {
        expect(entry.mutableDuringRun).toBe(false);
      }
    }
  });

  test('contains exactly one executable, one IWAD, and two configs', () => {
    const byRole = (role: SandboxFileRole) => SANDBOX_REQUIRED_FILES.filter((entry) => entry.role === role);
    expect(byRole('executable')).toHaveLength(1);
    expect(byRole('iwad')).toHaveLength(1);
    expect(byRole('config')).toHaveLength(2);
  });

  test('filenames are unique', () => {
    const names = SANDBOX_REQUIRED_FILES.map((entry) => entry.filename);
    expect(new Set(names).size).toBe(names.length);
  });

  test('array is frozen', () => {
    expect(Object.isFrozen(SANDBOX_REQUIRED_FILES)).toBe(true);
    for (const entry of SANDBOX_REQUIRED_FILES) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});

describe('SANDBOX_EXCLUDED_FILES', () => {
  test('contains exactly 4 files', () => {
    expect(SANDBOX_EXCLUDED_FILES).toHaveLength(4);
  });

  test('filenames are in ASCIIbetical order', () => {
    const names = SANDBOX_EXCLUDED_FILES.map((entry) => entry.filename);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  test('every entry has non-empty filename and reason', () => {
    for (const entry of SANDBOX_EXCLUDED_FILES) {
      expect(entry.filename.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  test('filenames are unique', () => {
    const names = SANDBOX_EXCLUDED_FILES.map((entry) => entry.filename);
    expect(new Set(names).size).toBe(names.length);
  });

  test('array is frozen', () => {
    expect(Object.isFrozen(SANDBOX_EXCLUDED_FILES)).toBe(true);
    for (const entry of SANDBOX_EXCLUDED_FILES) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});

describe('required + excluded = full bundle', () => {
  test('union of required and excluded covers all 8 reference bundle files', () => {
    const requiredNames = SANDBOX_REQUIRED_FILES.map((entry) => entry.filename);
    const excludedNames = SANDBOX_EXCLUDED_FILES.map((entry) => entry.filename);
    const allSandboxNames = [...requiredNames, ...excludedNames].sort();
    const manifestNames = fileHashes.files.map((file: { filename: string }) => file.filename).sort();
    expect(allSandboxNames).toEqual(manifestNames);
  });

  test('no overlap between required and excluded', () => {
    const requiredNames = new Set(SANDBOX_REQUIRED_FILES.map((entry) => entry.filename));
    for (const excluded of SANDBOX_EXCLUDED_FILES) {
      expect(requiredNames.has(excluded.filename)).toBe(false);
    }
  });

  test('all required files exist in ASSET_BOUNDARIES', () => {
    const boundaryNames = new Set(ASSET_BOUNDARIES.map((boundary) => boundary.filename));
    for (const entry of SANDBOX_REQUIRED_FILES) {
      expect(boundaryNames.has(entry.filename)).toBe(true);
    }
  });
});

describe('REFERENCE_SANDBOX_POLICY', () => {
  test('sourcePath matches REFERENCE_BUNDLE_PATH', () => {
    expect(REFERENCE_SANDBOX_POLICY.sourcePath).toBe(REFERENCE_BUNDLE_PATH);
  });

  test('workspaceRoot matches the current codex workspace', () => {
    expect(REFERENCE_SANDBOX_POLICY.workspaceRoot).toBe(CODEX_WORKSPACE_PATH);
  });

  test('sandboxParent is a dotfile directory', () => {
    expect(REFERENCE_SANDBOX_POLICY.sandboxParent).toMatch(/^\./);
  });

  test('sandboxPrefix is non-empty', () => {
    expect(REFERENCE_SANDBOX_POLICY.sandboxPrefix.length).toBeGreaterThan(0);
  });

  test('verifyHashesAfterCopy is enabled', () => {
    expect(REFERENCE_SANDBOX_POLICY.verifyHashesAfterCopy).toBe(true);
  });

  test('cleanupAfterRun is enabled', () => {
    expect(REFERENCE_SANDBOX_POLICY.cleanupAfterRun).toBe(true);
  });

  test('copyConfigsAsMutable is enabled', () => {
    expect(REFERENCE_SANDBOX_POLICY.copyConfigsAsMutable).toBe(true);
  });

  test('requiredFiles references the shared SANDBOX_REQUIRED_FILES array', () => {
    expect(REFERENCE_SANDBOX_POLICY.requiredFiles).toBe(SANDBOX_REQUIRED_FILES);
  });

  test('excludedFiles references the shared SANDBOX_EXCLUDED_FILES array', () => {
    expect(REFERENCE_SANDBOX_POLICY.excludedFiles).toBe(SANDBOX_EXCLUDED_FILES);
  });

  test('policy object is frozen', () => {
    expect(Object.isFrozen(REFERENCE_SANDBOX_POLICY)).toBe(true);
  });

  test('sandbox path never overlaps with source path (D-006)', () => {
    const sandboxRoot = `${REFERENCE_SANDBOX_POLICY.workspaceRoot}\\${REFERENCE_SANDBOX_POLICY.sandboxParent}`;
    expect(sandboxRoot.startsWith(REFERENCE_SANDBOX_POLICY.sourcePath)).toBe(false);
    expect(REFERENCE_SANDBOX_POLICY.sourcePath.startsWith(sandboxRoot)).toBe(false);
  });
});

describe('compile-time interface satisfaction', () => {
  test('SandboxFileEntry interface is well-formed', () => {
    const entry: SandboxFileEntry = {
      filename: 'test.bin',
      expectedHash: 'A'.repeat(64),
      expectedSize: 100,
      role: 'executable',
      mutableDuringRun: false,
    };
    expect(entry.filename).toBe('test.bin');
  });

  test('ExcludedFileEntry interface is well-formed', () => {
    const entry: ExcludedFileEntry = {
      filename: 'test.bin',
      reason: 'not needed',
    };
    expect(entry.filename).toBe('test.bin');
  });

  test('SandboxPolicy interface is well-formed', () => {
    const policy: SandboxPolicy = {
      sourcePath: 'C:\\src',
      sandboxPrefix: 'test-',
      sandboxParent: '.test',
      workspaceRoot: 'C:\\ws',
      requiredFiles: [],
      excludedFiles: [],
      verifyHashesAfterCopy: false,
      cleanupAfterRun: false,
      copyConfigsAsMutable: false,
    };
    expect(policy.sourcePath).toBe('C:\\src');
  });
});
