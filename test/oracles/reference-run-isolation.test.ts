import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { IMMUTABLE_FILE_COUNT, MUTABLE_FILE_COUNT, REQUIRED_FILE_COUNT, createSandbox, probeIsolation } from '../../tools/reference/isolationProbe.ts';
import type { ConfigIsolationResult, FileHashResult, IsolationProbeResult } from '../../tools/reference/isolationProbe.ts';
import { REFERENCE_SANDBOX_POLICY, SANDBOX_EXCLUDED_FILES, SANDBOX_REQUIRED_FILES } from '../../src/oracles/referenceSandbox.ts';
import { REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';

describe('isolation probe constants', () => {
  test('REQUIRED_FILE_COUNT is 4', () => {
    expect(REQUIRED_FILE_COUNT).toBe(4);
  });

  test('MUTABLE_FILE_COUNT is 2 (config files)', () => {
    expect(MUTABLE_FILE_COUNT).toBe(2);
  });

  test('IMMUTABLE_FILE_COUNT is 2 (executable and IWAD)', () => {
    expect(IMMUTABLE_FILE_COUNT).toBe(2);
  });

  test('mutable + immutable equals required', () => {
    expect(MUTABLE_FILE_COUNT + IMMUTABLE_FILE_COUNT).toBe(REQUIRED_FILE_COUNT);
  });
});

describe('sandbox creation', () => {
  test('createSandbox produces a directory with exactly 4 files', async () => {
    const sandboxPath = await createSandbox();
    try {
      const entries = await readdir(sandboxPath);
      expect(entries).toHaveLength(REQUIRED_FILE_COUNT);
    } finally {
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });

  test('createSandbox copies all required filenames', async () => {
    const sandboxPath = await createSandbox();
    try {
      const entries = await readdir(sandboxPath);
      const expectedNames = SANDBOX_REQUIRED_FILES.map((entry) => entry.filename);
      for (const name of expectedNames) {
        expect(entries).toContain(name);
      }
    } finally {
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });

  test('sandbox directory is inside the current workspace', async () => {
    const sandboxPath = await createSandbox();
    try {
      expect(sandboxPath.startsWith(REFERENCE_SANDBOX_POLICY.workspaceRoot)).toBe(true);
    } finally {
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });

  test('sandbox directory is NOT inside the reference bundle', async () => {
    const sandboxPath = await createSandbox();
    try {
      expect(sandboxPath.startsWith(REFERENCE_SANDBOX_POLICY.sourcePath)).toBe(false);
    } finally {
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });

  test('sandbox directory name starts with the configured prefix', async () => {
    const sandboxPath = await createSandbox();
    try {
      const dirName = sandboxPath.split(/[/\\]/).pop()!;
      expect(dirName.startsWith(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
    } finally {
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });

  test('excluded files are not present in the sandbox', async () => {
    const sandboxPath = await createSandbox();
    try {
      for (const excluded of SANDBOX_EXCLUDED_FILES) {
        const excludedPath = join(sandboxPath, excluded.filename);
        expect(existsSync(excludedPath)).toBe(false);
      }
    } finally {
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });
});

describe('full isolation probe', () => {
  let result: IsolationProbeResult;

  test('probeIsolation completes successfully', async () => {
    result = await probeIsolation();
    expect(result).toBeDefined();
  });

  test('sandbox was created', () => {
    expect(result.sandboxCreated).toBe(true);
  });

  test('all 4 files were copied', () => {
    expect(result.filesCopied).toBe(REQUIRED_FILE_COUNT);
  });

  test('all SHA-256 hashes match expected values', () => {
    expect(result.allHashesMatch).toBe(true);
  });

  test('every file hash result reports match=true', () => {
    expect(result.fileResults).toHaveLength(REQUIRED_FILE_COUNT);
    for (const fileResult of result.fileResults) {
      expect(fileResult.match).toBe(true);
    }
  });

  test('all file sizes match expected values', () => {
    expect(result.allSizesMatch).toBe(true);
  });

  test('every file size result reports sizeMatch=true', () => {
    for (const fileResult of result.fileResults) {
      expect(fileResult.sizeMatch).toBe(true);
    }
  });

  test('hash strings are 64-character uppercase hex', () => {
    const hexPattern = /^[0-9A-F]{64}$/;
    for (const fileResult of result.fileResults) {
      expect(hexPattern.test(fileResult.actualHash)).toBe(true);
      expect(hexPattern.test(fileResult.expectedHash)).toBe(true);
    }
  });

  test('config isolation was verified for mutable files', () => {
    expect(result.configIsolationResults).toHaveLength(MUTABLE_FILE_COUNT);
  });

  test('all config files are true copies (not links)', () => {
    expect(result.allConfigsIsolated).toBe(true);
    for (const configResult of result.configIsolationResults) {
      expect(configResult.isTrueCopy).toBe(true);
    }
  });

  test('source bundle files remain unmodified after probe', () => {
    expect(result.sourceUnmodified).toBe(true);
  });

  test('sandbox was cleaned up after the probe', () => {
    expect(result.cleanedUp).toBe(true);
  });

  test('sandbox directory no longer exists after cleanup', () => {
    expect(existsSync(result.sandboxPath)).toBe(false);
  });
});

describe('file hash cross-references', () => {
  let result: IsolationProbeResult;

  test('probe result is available', async () => {
    result = await probeIsolation();
    expect(result).toBeDefined();
  });

  test('DOOM.EXE hash matches SANDBOX_REQUIRED_FILES entry', () => {
    const doomExe = result.fileResults.find((fileResult) => fileResult.filename === 'DOOM.EXE');
    expect(doomExe).toBeDefined();
    const policyEntry = SANDBOX_REQUIRED_FILES.find((entry) => entry.filename === 'DOOM.EXE');
    expect(doomExe!.actualHash).toBe(policyEntry!.expectedHash);
  });

  test('DOOM1.WAD hash matches SANDBOX_REQUIRED_FILES entry', () => {
    const doom1Wad = result.fileResults.find((fileResult) => fileResult.filename === 'DOOM1.WAD');
    expect(doom1Wad).toBeDefined();
    const policyEntry = SANDBOX_REQUIRED_FILES.find((entry) => entry.filename === 'DOOM1.WAD');
    expect(doom1Wad!.actualHash).toBe(policyEntry!.expectedHash);
  });

  test('executable filename matches REFERENCE_RUN_MANIFEST', () => {
    const executable = result.fileResults.find((fileResult) => fileResult.filename === REFERENCE_RUN_MANIFEST.executableFilename);
    expect(executable).toBeDefined();
    expect(executable!.match).toBe(true);
  });

  test('IWAD filename matches REFERENCE_RUN_MANIFEST', () => {
    const iwad = result.fileResults.find((fileResult) => fileResult.filename === REFERENCE_RUN_MANIFEST.iwadFilename);
    expect(iwad).toBeDefined();
    expect(iwad!.match).toBe(true);
  });
});

describe('parity-sensitive edge cases', () => {
  test('config files are mutable but executable and IWAD are immutable', () => {
    const mutableFiles = SANDBOX_REQUIRED_FILES.filter((entry) => entry.mutableDuringRun);
    const immutableFiles = SANDBOX_REQUIRED_FILES.filter((entry) => !entry.mutableDuringRun);

    expect(mutableFiles.map((entry) => entry.filename).sort()).toEqual(['chocolate-doom.cfg', 'default.cfg']);
    expect(immutableFiles.map((entry) => entry.filename).sort()).toEqual(['DOOM.EXE', 'DOOM1.WAD']);
  });

  test('sandbox path and source path share no common directory prefix beyond drive root', () => {
    const sandboxParent = join(REFERENCE_SANDBOX_POLICY.workspaceRoot, REFERENCE_SANDBOX_POLICY.sandboxParent);
    expect(sandboxParent.startsWith(REFERENCE_SANDBOX_POLICY.sourcePath)).toBe(false);
    expect(REFERENCE_SANDBOX_POLICY.sourcePath.startsWith(sandboxParent)).toBe(false);
  });

  test('two sandboxes created in sequence get different paths', async () => {
    const sandbox1 = await createSandbox();
    const sandbox2 = await createSandbox();
    try {
      expect(sandbox1).not.toBe(sandbox2);
    } finally {
      await rm(sandbox1, { recursive: true, force: true });
      await rm(sandbox2, { recursive: true, force: true });
    }
  });
});

describe('compile-time type satisfaction', () => {
  test('FileHashResult interface is satisfied by probe result entries', async () => {
    const probeResult = await probeIsolation();
    const fileResult: FileHashResult = probeResult.fileResults[0];
    expect(fileResult.filename).toBeTypeOf('string');
    expect(fileResult.expectedHash).toBeTypeOf('string');
    expect(fileResult.actualHash).toBeTypeOf('string');
    expect(fileResult.match).toBeTypeOf('boolean');
    expect(fileResult.actualSize).toBeTypeOf('number');
    expect(fileResult.expectedSize).toBeTypeOf('number');
    expect(fileResult.sizeMatch).toBeTypeOf('boolean');
  });

  test('ConfigIsolationResult interface is satisfied by probe result entries', async () => {
    const probeResult = await probeIsolation();
    const configResult: ConfigIsolationResult = probeResult.configIsolationResults[0];
    expect(configResult.filename).toBeTypeOf('string');
    expect(configResult.isTrueCopy).toBeTypeOf('boolean');
  });

  test('IsolationProbeResult interface is satisfied by probeIsolation return', async () => {
    const probeResult: IsolationProbeResult = await probeIsolation();
    expect(probeResult.sandboxPath).toBeTypeOf('string');
    expect(probeResult.sandboxCreated).toBeTypeOf('boolean');
    expect(Array.isArray(probeResult.fileResults)).toBe(true);
    expect(probeResult.allHashesMatch).toBeTypeOf('boolean');
    expect(probeResult.allSizesMatch).toBeTypeOf('boolean');
    expect(Array.isArray(probeResult.configIsolationResults)).toBe(true);
    expect(probeResult.allConfigsIsolated).toBeTypeOf('boolean');
    expect(probeResult.cleanedUp).toBeTypeOf('boolean');
    expect(probeResult.filesCopied).toBeTypeOf('number');
    expect(probeResult.sourceUnmodified).toBeTypeOf('boolean');
  });
});
