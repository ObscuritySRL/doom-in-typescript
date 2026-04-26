import { describe, expect, test } from 'bun:test';

import {
  DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT,
  DOCUMENT_REQUIRED_LOCAL_FILES_EVIDENCE,
  DOCUMENT_REQUIRED_LOCAL_FILES_REPLAY_COMPATIBILITY,
  DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES,
  DOCUMENT_REQUIRED_LOCAL_FILES_TRANSITION,
  documentRequiredLocalFiles,
} from '../../../src/playable/bun-launch-local-distribution-boundary/documentRequiredLocalFiles.ts';

const EXPECTED_DOCUMENTATION_HASH = '7614bf08d72c2d276a3c17c85c665dd108090d05679aab8bb0e6708708d5f141';

describe('documentRequiredLocalFiles', () => {
  test('locks the Bun product command contract and required local file list', () => {
    const evidence = documentRequiredLocalFiles();

    expect(evidence).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_EVIDENCE);
    expect(evidence.commandContract).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(evidence.commandContract).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT);
    expect(evidence.documentationHash).toBe(EXPECTED_DOCUMENTATION_HASH);
    expect(evidence.requiredLocalFiles).toEqual([
      {
        category: 'dependency-lockfile',
        path: 'bun.lock',
        purpose: 'Pins Bun dependency resolution for a reproducible local install before launch.',
        requirement: 'Required for the Bun-managed local workspace that runs the product command.',
        source: 'F-FPS-007',
      },
      {
        category: 'entrypoint',
        path: 'doom.ts',
        purpose: 'Workspace-root entry file consumed by the final product command.',
        requirement: 'Required for the exact `bun run doom.ts` launch contract.',
        source: 'plan_fps/README.md',
      },
      {
        category: 'game-data',
        path: 'doom/DOOM1.WAD',
        purpose: 'Local IWAD used by the default launch path when no explicit `--iwad` is provided.',
        requirement: 'Required for default IWAD discovery and must remain a local, non-redistributed asset.',
        source: 'F-FPS-004 and src/main.ts',
      },
      {
        category: 'package-manifest',
        path: 'package.json',
        purpose: 'Declares the Bun package metadata and Win32 dependencies used by local launch.',
        requirement: 'Required for Bun install and script context around the product command.',
        source: 'package.json and plan_fps/PACKAGE_CAPABILITY_MATRIX.md',
      },
    ]);
    expect(evidence.requiredLocalFiles).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES);
  });

  test('locks the package-script transition without mutating deterministic replay state', () => {
    const evidence = documentRequiredLocalFiles();

    expect(evidence.deterministicReplayCompatibility).toEqual({
      fileContentsRead: false,
      inputStreamMutated: false,
      randomSeedMutated: false,
      simulationTicksAdvanced: false,
    });
    expect(evidence.deterministicReplayCompatibility).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_REPLAY_COMPATIBILITY);
    expect(evidence.packageCapabilitySource).toBe('plan_fps/PACKAGE_CAPABILITY_MATRIX.md');
    expect(evidence.stepIdentifier).toBe('14-002');
    expect(evidence.stepTitle).toBe('document-required-local-files');
    expect(evidence.transition).toEqual({
      currentPackageStartScript: 'bun run src/main.ts',
      productRuntimeCommand: 'bun run doom.ts',
      transitionReason: 'Document local files for the root Bun product command without reading file contents or mutating replay state.',
    });
    expect(evidence.transition).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_TRANSITION);
  });

  test('rejects commands outside the Bun product runtime path', () => {
    expect(() => documentRequiredLocalFiles('bun run src/main.ts')).toThrow('document required local files requires "bun run doom.ts"; received "bun run src/main.ts".');
    expect(() => documentRequiredLocalFiles('node doom.ts')).toThrow('document required local files requires "bun run doom.ts"; received "node doom.ts".');
  });

  test('returns a frozen evidence graph', () => {
    const evidence = documentRequiredLocalFiles();

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.commandContract)).toBe(true);
    expect(Object.isFrozen(evidence.deterministicReplayCompatibility)).toBe(true);
    expect(Object.isFrozen(evidence.requiredLocalFiles)).toBe(true);
    expect(Object.isFrozen(evidence.transition)).toBe(true);

    for (const requiredLocalFile of evidence.requiredLocalFiles) {
      expect(Object.isFrozen(requiredLocalFile)).toBe(true);
    }
  });

  test('aligns the documented current package start script with the live package.json', async () => {
    const packageJsonPath = new URL('../../../package.json', import.meta.url);
    const packageJson = (await Bun.file(packageJsonPath).json()) as { scripts?: { start?: string } };

    expect(packageJson.scripts?.start).toBe('bun run src/main.ts');
    expect(packageJson.scripts?.start).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_TRANSITION.currentPackageStartScript);
  });

  test('keeps every required local file path and category unique', () => {
    const seenPaths = new Set<string>();
    const seenCategories = new Set<string>();

    for (const requiredLocalFile of DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES) {
      expect(seenPaths.has(requiredLocalFile.path)).toBe(false);
      expect(seenCategories.has(requiredLocalFile.category)).toBe(false);
      seenPaths.add(requiredLocalFile.path);
      seenCategories.add(requiredLocalFile.category);
    }

    expect(seenPaths.size).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES.length);
    expect(seenCategories.size).toBe(DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES.length);
  });

  test('reproduces the documentation hash from the public contract inputs', () => {
    const evidence = documentRequiredLocalFiles();
    const hashInput = {
      commandContract: evidence.commandContract,
      deterministicReplayCompatibility: evidence.deterministicReplayCompatibility,
      requiredLocalFiles: evidence.requiredLocalFiles,
      transition: evidence.transition,
    };
    const recomputedHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(hashInput)).digest('hex');

    expect(recomputedHash).toBe(evidence.documentationHash);
    expect(recomputedHash).toBe(EXPECTED_DOCUMENTATION_HASH);
  });
});
