import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

type RequiredRuntimeTarget = {
  command: string;
  decisionId: string;
  entryFile: string;
  manifestPath: string;
};

type WorkspaceMarker = {
  kind: string;
  path: string;
  requiredAtWorkspaceRoot: boolean;
};

type WritePolicy = {
  allowWritesOutsideWorkspaceRoot: boolean;
  appliesTo: string[];
  disallowAbsolutePathsOutsideWorkspaceRoot: boolean;
  disallowParentTraversalOutsideWorkspaceRoot: boolean;
  readOnlyReferenceRootsHandledByStepId: string;
  summary: string;
};

type WritableWorkspaceRoot = {
  absolutePath: string;
  canonicalPath: string;
  directoryName: string;
  hasTrailingSlash: boolean;
  pathSeparator: string;
  relativePathFromDriveRoot: string;
};

type WritableWorkspaceManifest = {
  controlCenterPath: string;
  decisionId: string;
  evidencePaths: string[];
  readmeOracleBoundaryLine: string;
  readmeWorkspaceBoundaryLine: string;
  requiredRuntimeTarget: RequiredRuntimeTarget;
  schemaVersion: number;
  workspaceMarkers: WorkspaceMarker[];
  workspaceRelativeWritableArtifactExamples: string[];
  writePolicy: WritePolicy;
  writableWorkspaceRoot: WritableWorkspaceRoot;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonRecord(filePath: string): Promise<JsonRecord> {
  const jsonText = await Bun.file(filePath).text();
  const parsedValue: unknown = JSON.parse(jsonText);

  assert(isJsonRecord(parsedValue), `${filePath} must contain a JSON object.`);

  return parsedValue;
}

function readStringArray(value: unknown, label: string): string[] {
  assert(Array.isArray(value), `${label} must be an array.`);

  const stringItems: string[] = [];

  for (const item of value) {
    assert(typeof item === 'string', `${label} items must be strings.`);
    stringItems.push(item);
  }

  return stringItems;
}

function readBoolean(value: unknown, label: string): boolean {
  assert(typeof value === 'boolean', `${label} must be a boolean.`);
  return value;
}

function readString(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string.`);
  return value;
}

function parseRequiredRuntimeTarget(value: unknown): RequiredRuntimeTarget {
  assert(isJsonRecord(value), 'requiredRuntimeTarget must be an object.');

  return {
    command: readString(value.command, 'requiredRuntimeTarget.command'),
    decisionId: readString(value.decisionId, 'requiredRuntimeTarget.decisionId'),
    entryFile: readString(value.entryFile, 'requiredRuntimeTarget.entryFile'),
    manifestPath: readString(value.manifestPath, 'requiredRuntimeTarget.manifestPath'),
  };
}

function parseWorkspaceMarker(value: unknown): WorkspaceMarker {
  assert(isJsonRecord(value), 'workspaceMarkers items must be objects.');

  return {
    kind: readString(value.kind, 'workspaceMarkers.kind'),
    path: readString(value.path, 'workspaceMarkers.path'),
    requiredAtWorkspaceRoot: readBoolean(value.requiredAtWorkspaceRoot, 'workspaceMarkers.requiredAtWorkspaceRoot'),
  };
}

function parseWritePolicy(value: unknown): WritePolicy {
  assert(isJsonRecord(value), 'writePolicy must be an object.');

  return {
    allowWritesOutsideWorkspaceRoot: readBoolean(value.allowWritesOutsideWorkspaceRoot, 'writePolicy.allowWritesOutsideWorkspaceRoot'),
    appliesTo: readStringArray(value.appliesTo, 'writePolicy.appliesTo'),
    disallowAbsolutePathsOutsideWorkspaceRoot: readBoolean(value.disallowAbsolutePathsOutsideWorkspaceRoot, 'writePolicy.disallowAbsolutePathsOutsideWorkspaceRoot'),
    disallowParentTraversalOutsideWorkspaceRoot: readBoolean(value.disallowParentTraversalOutsideWorkspaceRoot, 'writePolicy.disallowParentTraversalOutsideWorkspaceRoot'),
    readOnlyReferenceRootsHandledByStepId: readString(value.readOnlyReferenceRootsHandledByStepId, 'writePolicy.readOnlyReferenceRootsHandledByStepId'),
    summary: readString(value.summary, 'writePolicy.summary'),
  };
}

function parseWritableWorkspaceRoot(value: unknown): WritableWorkspaceRoot {
  assert(isJsonRecord(value), 'writableWorkspaceRoot must be an object.');

  return {
    absolutePath: readString(value.absolutePath, 'writableWorkspaceRoot.absolutePath'),
    canonicalPath: readString(value.canonicalPath, 'writableWorkspaceRoot.canonicalPath'),
    directoryName: readString(value.directoryName, 'writableWorkspaceRoot.directoryName'),
    hasTrailingSlash: readBoolean(value.hasTrailingSlash, 'writableWorkspaceRoot.hasTrailingSlash'),
    pathSeparator: readString(value.pathSeparator, 'writableWorkspaceRoot.pathSeparator'),
    relativePathFromDriveRoot: readString(value.relativePathFromDriveRoot, 'writableWorkspaceRoot.relativePathFromDriveRoot'),
  };
}

function readWorkspaceMarkers(value: unknown): WorkspaceMarker[] {
  assert(Array.isArray(value), 'workspaceMarkers must be an array.');

  const markers: WorkspaceMarker[] = [];

  for (const item of value) {
    markers.push(parseWorkspaceMarker(item));
  }

  return markers;
}

function parseManifest(value: JsonRecord): WritableWorkspaceManifest {
  const schemaVersion = value.schemaVersion;
  assert(typeof schemaVersion === 'number', 'schemaVersion must be a number.');

  return {
    controlCenterPath: readString(value.controlCenterPath, 'controlCenterPath'),
    decisionId: readString(value.decisionId, 'decisionId'),
    evidencePaths: readStringArray(value.evidencePaths, 'evidencePaths'),
    readmeOracleBoundaryLine: readString(value.readmeOracleBoundaryLine, 'readmeOracleBoundaryLine'),
    readmeWorkspaceBoundaryLine: readString(value.readmeWorkspaceBoundaryLine, 'readmeWorkspaceBoundaryLine'),
    requiredRuntimeTarget: parseRequiredRuntimeTarget(value.requiredRuntimeTarget),
    schemaVersion,
    workspaceMarkers: readWorkspaceMarkers(value.workspaceMarkers),
    workspaceRelativeWritableArtifactExamples: readStringArray(value.workspaceRelativeWritableArtifactExamples, 'workspaceRelativeWritableArtifactExamples'),
    writePolicy: parseWritePolicy(value.writePolicy),
    writableWorkspaceRoot: parseWritableWorkspaceRoot(value.writableWorkspaceRoot),
  };
}

function toForwardSlashPath(filePath: string): string {
  return filePath.replaceAll(sep, '/');
}

const testDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = toForwardSlashPath(resolve(testDirectory, '..', '..'));
const manifestPath = resolve(testDirectory, '..', '..', 'plan_fps', 'manifests', '00-007-pin-writable-workspace-boundaries.json');
const decisionLogPath = resolve(testDirectory, '..', '..', 'plan_fps', 'DECISION_LOG.md');
const packageJsonPath = resolve(testDirectory, '..', '..', 'package.json');
const readmePath = resolve(testDirectory, '..', '..', 'plan_fps', 'README.md');
const tsconfigPath = resolve(testDirectory, '..', '..', 'tsconfig.json');

const manifestRecord = await readJsonRecord(manifestPath);
const manifest = parseManifest(manifestRecord);
const packageJson = await readJsonRecord(packageJsonPath);
const readmeText = await Bun.file(readmePath).text();
const decisionLogText = await Bun.file(decisionLogPath).text();
const tsconfigJson = await readJsonRecord(tsconfigPath);

describe('00-007 pin writable workspace boundaries manifest', () => {
  test('locks schema version and decision id', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.decisionId).toBe('D-FPS-008');
  });

  test('locks the exact writable workspace root values', () => {
    expect(manifest.writableWorkspaceRoot).toEqual({
      absolutePath: 'D:/Projects/doom-in-typescript',
      canonicalPath: 'D:/Projects/doom-in-typescript',
      directoryName: 'doom-in-typescript',
      hasTrailingSlash: false,
      pathSeparator: '/',
      relativePathFromDriveRoot: 'Projects/doom-in-typescript',
    });
  });

  test('matches the live workspace root on disk', () => {
    expect(workspaceRoot).toBe(manifest.writableWorkspaceRoot.absolutePath);
    expect(workspaceRoot).toBe(manifest.writableWorkspaceRoot.canonicalPath);
    expect(statSync(workspaceRoot).isDirectory()).toBe(true);
  });

  test('locks the exact README boundary lines and requires them to remain present', () => {
    expect(manifest.readmeWorkspaceBoundaryLine).toBe('- Writable workspace root: `D:/Projects/doom-in-typescript`');
    expect(manifest.readmeOracleBoundaryLine).toBe('- Oracle artifacts must be generated under writable project paths such as `test/oracles/fixtures/` or `plan_fps/manifests/`.');
    expect(readmeText).toContain(manifest.readmeWorkspaceBoundaryLine);
    expect(readmeText).toContain(manifest.readmeOracleBoundaryLine);
  });

  test('locks the workspace markers in canonical order', () => {
    expect(manifest.workspaceMarkers).toEqual([
      {
        kind: 'package-manifest',
        path: 'package.json',
        requiredAtWorkspaceRoot: true,
      },
      {
        kind: 'typescript-config',
        path: 'tsconfig.json',
        requiredAtWorkspaceRoot: true,
      },
      {
        kind: 'active-control-center-readme',
        path: 'plan_fps/README.md',
        requiredAtWorkspaceRoot: true,
      },
    ]);
  });

  test('requires every workspace marker path to remain inside the workspace root', () => {
    for (const marker of manifest.workspaceMarkers) {
      expect(isAbsolute(marker.path)).toBe(false);
      expect(marker.path.includes('..')).toBe(false);

      const markerAbsolutePath = resolve(workspaceRoot, marker.path);
      expect(toForwardSlashPath(markerAbsolutePath).startsWith(`${workspaceRoot}/`)).toBe(true);
      expect(existsSync(markerAbsolutePath)).toBe(true);
    }
  });

  test('locks the writable artifact examples and keeps them relative', () => {
    expect(manifest.workspaceRelativeWritableArtifactExamples).toEqual(['plan_fps/manifests/', 'test/oracles/fixtures/']);

    for (const relativePath of manifest.workspaceRelativeWritableArtifactExamples) {
      expect(isAbsolute(relativePath)).toBe(false);
      expect(relativePath.includes('..')).toBe(false);
    }
  });

  test('locks the write policy flags and scope', () => {
    expect(manifest.writePolicy).toEqual({
      allowWritesOutsideWorkspaceRoot: false,
      appliesTo: ['generated-artifacts', 'plan-files', 'product-files', 'test-files', 'tool-files'],
      disallowAbsolutePathsOutsideWorkspaceRoot: true,
      disallowParentTraversalOutsideWorkspaceRoot: true,
      readOnlyReferenceRootsHandledByStepId: '00-008',
      summary: 'Write product, test, tool, plan, and generated artifacts only under the workspace root.',
    });
  });

  test('keeps the write policy scope unique and aligned with the root marker files', () => {
    expect(new Set(manifest.writePolicy.appliesTo).size).toBe(manifest.writePolicy.appliesTo.length);
    expect(packageJson.name).toBe('doom-codex');
    expect(tsconfigJson.include).toEqual(['src', 'test', 'tools']);
  });

  test('locks the required Bun runtime target contract', () => {
    expect(manifest.requiredRuntimeTarget).toEqual({
      command: 'bun run doom.ts',
      decisionId: 'D-FPS-003',
      entryFile: 'doom.ts',
      manifestPath: 'plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json',
    });
    expect(existsSync(resolve(workspaceRoot, manifest.requiredRuntimeTarget.manifestPath))).toBe(true);
  });

  test('locks the control center path and keeps it under the workspace root', () => {
    expect(manifest.controlCenterPath).toBe('plan_fps');
    expect(existsSync(resolve(workspaceRoot, manifest.controlCenterPath))).toBe(true);
  });

  test('locks evidence paths and keeps them inside the workspace root', () => {
    expect(manifest.evidencePaths).toEqual(['plan_fps/DECISION_LOG.md', 'plan_fps/README.md', 'package.json', 'tsconfig.json']);

    for (const evidencePath of manifest.evidencePaths) {
      expect(isAbsolute(evidencePath)).toBe(false);
      expect(evidencePath.includes('..')).toBe(false);
      expect(existsSync(resolve(workspaceRoot, evidencePath))).toBe(true);
    }
  });

  test('requires the root package.json and tsconfig.json to stay anchored at the workspace root', () => {
    expect(packageJson.scripts).toEqual({
      format: 'bun run tools/format-changed.ts',
      start: 'bun run src/main.ts',
    });
    expect(tsconfigJson.compilerOptions).toEqual({
      allowImportingTsExtensions: true,
      allowJs: true,
      lib: ['ESNext'],
      module: 'Preserve',
      moduleDetection: 'force',
      moduleResolution: 'bundler',
      noEmit: true,
      noFallthroughCasesInSwitch: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: false,
      noUncheckedIndexedAccess: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      target: 'ESNext',
      types: ['bun'],
      verbatimModuleSyntax: true,
    });
  });

  test('records the accepted decision text in DECISION_LOG', () => {
    expect(decisionLogText).toContain('## D-FPS-008');
    expect(decisionLogText).toContain('- status: accepted');
    expect(decisionLogText).toContain(
      '- decision: All writable product, test, tool, plan, and generated artifacts for the playable parity effort must remain under `D:/Projects/doom-in-typescript`; no Ralph-loop step may write outside that workspace root.',
    );
    expect(decisionLogText).toContain('- evidence: plan_fps/README.md, plan_fps/manifests/00-007-pin-writable-workspace-boundaries.json, package.json, tsconfig.json');
  });
});
