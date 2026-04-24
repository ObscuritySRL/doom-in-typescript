import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const decisionLogPath = 'D:/Projects/doom-in-typescript/plan_fps/DECISION_LOG.md';
const factLogPath = 'D:/Projects/doom-in-typescript/plan_fps/FACT_LOG.md';
const manifestPath = 'D:/Projects/doom-in-typescript/plan_fps/manifests/00-009-pin-asset-license-boundaries.json';
const packageJsonPath = 'D:/Projects/doom-in-typescript/package.json';
const readmePath = 'D:/Projects/doom-in-typescript/plan_fps/README.md';
const tsconfigPath = 'D:/Projects/doom-in-typescript/tsconfig.json';

const expectedManifest = {
  currentWorkspace: {
    packageJson: {
      path: 'D:/Projects/doom-in-typescript/package.json',
      private: true,
    },
    tsconfigJson: {
      noEmit: true,
      path: 'D:/Projects/doom-in-typescript/tsconfig.json',
    },
  },
  decisionDependencies: ['D-FPS-003', 'D-FPS-008', 'D-FPS-009'],
  decisionId: 'D-FPS-010',
  evidencePaths: [
    'D:/Projects/doom-in-typescript/doom',
    'D:/Projects/doom-in-typescript/iwad',
    'D:/Projects/doom-in-typescript/package.json',
    'D:/Projects/doom-in-typescript/plan_fps/FACT_LOG.md',
    'D:/Projects/doom-in-typescript/plan_fps/README.md',
    'D:/Projects/doom-in-typescript/reference',
    'D:/Projects/doom-in-typescript/tsconfig.json',
  ],
  factLogReferences: ['F-FPS-004', 'F-FPS-008'],
  licenseBoundary: {
    allowCommittingCopiedReferenceAssets: false,
    allowCopyingReferenceAssetBytesIntoWritableOutputs: false,
    allowLocalOracleArtifactsUnderWorkspace: true,
    allowLocalReadOnlyReferenceUse: true,
    allowPackagingReferenceAssets: false,
    allowPublishingReferenceAssets: false,
    allowWritingInsideReadOnlyReferenceRoots: false,
    allowedWritableOracleExamples: ['D:/Projects/doom-in-typescript/plan_fps/manifests/', 'D:/Projects/doom-in-typescript/test/oracles/fixtures/'],
    forbiddenActions: [
      'commit copied proprietary assets into git-tracked workspace paths',
      'copy reference asset bytes into writable product or test outputs',
      'package reference assets for redistribution',
      'publish reference assets outside the local workspace',
      'write inside the read-only reference roots',
    ],
    policySentence: 'Local DOOM binaries, WADs, configs, and other reference assets under `doom/`, `iwad/`, and `reference/` are inputs for local playable-parity development and verification only; they are not cleared for redistribution.',
  },
  localReferenceAssetInventory: [
    {
      assetId: 'chocolate-doom-config',
      category: 'reference-config',
      path: 'D:/Projects/doom-in-typescript/doom/chocolate-doom.cfg',
      redistributionAllowed: false,
    },
    {
      assetId: 'doom-debug-executable',
      category: 'reference-binary',
      path: 'D:/Projects/doom-in-typescript/doom/DOOMD.EXE',
      redistributionAllowed: false,
    },
    {
      assetId: 'shareware-iwad',
      category: 'iwad',
      path: 'D:/Projects/doom-in-typescript/doom/DOOM1.WAD',
      redistributionAllowed: false,
    },
    {
      assetId: 'vanilla-default-config',
      category: 'reference-config',
      path: 'D:/Projects/doom-in-typescript/doom/default.cfg',
      redistributionAllowed: false,
    },
    {
      assetId: 'vanilla-doom-executable',
      category: 'reference-binary',
      path: 'D:/Projects/doom-in-typescript/doom/DOOM.EXE',
      redistributionAllowed: false,
    },
  ],
  readmePolicyLine: '- Do not redistribute proprietary DOOM assets.',
  runtimeTarget: {
    bunOnly: true,
    command: 'bun run doom.ts',
    deterministicReplayCompatible: true,
  },
  schemaVersion: 1,
  stepId: '00-009',
  stepTitleSlug: 'pin-asset-license-boundaries',
  workspaceBoundaries: {
    readOnlyReferenceRoots: [
      {
        path: 'D:/Projects/doom-in-typescript/doom',
        rootId: 'doom',
      },
      {
        path: 'D:/Projects/doom-in-typescript/iwad',
        rootId: 'iwad',
      },
      {
        path: 'D:/Projects/doom-in-typescript/reference',
        rootId: 'reference',
      },
    ],
    workspaceRoot: 'D:/Projects/doom-in-typescript',
  },
} as const;

const expectedDecisionEntry = [
  '## D-FPS-010',
  '',
  '- status: accepted',
  '- date: 2026-04-24',
  '- decision: Local DOOM binaries, WADs, configs, and other reference assets under `doom/`, `iwad/`, and `reference/` are inputs for local playable-parity development and verification only; they are not cleared for redistribution.',
  '- rationale: D-FPS-008 pins the writable workspace root and D-FPS-009 pins the read-only reference roots. The README already says `Do not redistribute proprietary DOOM assets.`; this step turns that rule into an explicit local-use-only boundary so later oracle capture and packaging work cannot treat local possession of reference assets as redistribution permission.',
  '- evidence: plan_fps/FACT_LOG.md, plan_fps/README.md, plan_fps/manifests/00-009-pin-asset-license-boundaries.json, package.json, tsconfig.json',
  '- affected_steps: 00-009, 02-001, 02-002, 14-005, 15-010',
  '- supersedes: none',
].join('\n');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+$/, '');
}

function isWithinPath(candidatePath: string, parentPath: string): boolean {
  const normalizedCandidatePath = normalizePath(candidatePath);
  const normalizedParentPath = normalizePath(parentPath);
  return normalizedCandidatePath === normalizedParentPath || normalizedCandidatePath.startsWith(`${normalizedParentPath}/`);
}

function parseJsonRecord(filePath: string): Record<string, unknown> {
  const parsedValue: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isRecord(parsedValue)) {
    throw new Error(`${filePath} did not parse to an object.`);
  }
  return parsedValue;
}

function readBooleanProperty(record: Record<string, unknown>, propertyName: string): boolean {
  const propertyValue = record[propertyName];
  if (typeof propertyValue !== 'boolean') {
    throw new Error(`${propertyName} was not a boolean.`);
  }
  return propertyValue;
}

describe('00-009 pin-asset-license-boundaries manifest', () => {
  test('matches the exact governance contract', () => {
    expect(manifest).toEqual(expectedManifest);
  });

  test('keeps the runtime target Bun-only and deterministic-replay-compatible', () => {
    expect(expectedManifest.runtimeTarget).toEqual({
      bunOnly: true,
      command: 'bun run doom.ts',
      deterministicReplayCompatible: true,
    });
  });

  test('anchors every inventory file inside a declared read-only reference root', () => {
    const readOnlyReferenceRoots = expectedManifest.workspaceBoundaries.readOnlyReferenceRoots.map(({ path }) => path);

    for (const assetRecord of expectedManifest.localReferenceAssetInventory) {
      expect(existsSync(assetRecord.path)).toBeTrue();
      expect(readOnlyReferenceRoots.some((readOnlyReferenceRootPath) => isWithinPath(assetRecord.path, readOnlyReferenceRootPath))).toBeTrue();
      expect(assetRecord.redistributionAllowed).toBeFalse();
    }
  });

  test('keeps oracle examples inside the workspace and outside the read-only roots', () => {
    const { readOnlyReferenceRoots, workspaceRoot } = expectedManifest.workspaceBoundaries;

    for (const writableExamplePath of expectedManifest.licenseBoundary.allowedWritableOracleExamples) {
      expect(isWithinPath(writableExamplePath, workspaceRoot)).toBeTrue();
      expect(readOnlyReferenceRoots.some(({ path }) => isWithinPath(writableExamplePath, path))).toBeFalse();
    }
  });

  test('preserves the README redistribution line verbatim', () => {
    expect(readFileSync(readmePath, 'utf8')).toContain(expectedManifest.readmePolicyLine);
  });

  test('records the exact supporting facts', () => {
    const factLogText = readFileSync(factLogPath, 'utf8');

    expect(factLogText).toContain('## F-FPS-004');
    expect(factLogText).toContain('- fact: Local reference files include `doom/DOOM.EXE`, `doom/DOOMD.EXE`, `doom/DOOM1.WAD`, `doom/default.cfg`, and `doom/chocolate-doom.cfg`.');
    expect(factLogText).toContain('## F-FPS-008');
    expect(factLogText).toContain(
      '- fact: The repository contains three top-level in-workspace reference roots at `doom/`, `iwad/`, and `reference/`; all three currently exist as directories on disk under `D:/Projects/doom-in-typescript`.',
    );
  });

  test('matches the live package and TypeScript distribution restrictions', () => {
    const packageJsonRecord = parseJsonRecord(packageJsonPath);
    const tsconfigRecord = parseJsonRecord(tsconfigPath);
    const compilerOptions = tsconfigRecord.compilerOptions;

    if (!isRecord(compilerOptions)) {
      throw new Error('tsconfig.compilerOptions was not an object.');
    }

    expect(readBooleanProperty(packageJsonRecord, 'private')).toBe(expectedManifest.currentWorkspace.packageJson.private);
    expect(readBooleanProperty(compilerOptions, 'noEmit')).toBe(expectedManifest.currentWorkspace.tsconfigJson.noEmit);
  });

  test('requires every evidence path to exist on disk', () => {
    for (const evidencePath of expectedManifest.evidencePaths) {
      expect(existsSync(evidencePath)).toBeTrue();
    }
  });

  test('records the exact decision log entry', () => {
    expect(readFileSync(decisionLogPath, 'utf8')).toContain(expectedDecisionEntry);
  });
});
