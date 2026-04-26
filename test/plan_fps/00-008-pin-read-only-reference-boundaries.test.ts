import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

type PackageJson = {
  scripts: {
    format: string;
    start: string;
  };
};

type ReadOnlyReferenceRoot = {
  absolutePath: string;
  existsOnDisk: boolean;
  relativePath: string;
  rootId: 'doom' | 'iwad' | 'reference';
  writeAllowed: false;
};

type StepManifest = {
  decisionId: 'D-FPS-009';
  deterministicReplayCompatible: true;
  evidencePaths: string[];
  rationale: string;
  readOnlyReferenceRoots: ReadOnlyReferenceRoot[];
  readmeBoundaries: {
    noWriteLine: string;
    oracleArtifactsLine: string;
    readOnlyReferenceRootsLine: string;
  };
  runtimeTarget: 'bun run doom.ts';
  schemaVersion: 1;
  stepId: '00-008';
  stepSlug: 'pin-read-only-reference-boundaries';
  toolingScope: {
    packageJsonScripts: {
      format: 'bun run tools/format-changed.ts';
      start: 'bun run src/main.ts';
    };
    readOnlyRootsIncludedInTypeScriptInputs: false;
    tsconfigIncludes: ['src', 'test', 'tools'];
  };
  workspaceRoot: 'D:/Projects/doom-in-typescript';
  writePolicy: {
    forbidCreate: true;
    forbidDelete: true;
    forbidModify: true;
    oracleArtifactsMustStayOutsideReadOnlyRoots: true;
    readOnlyRootsAreExclusive: true;
    writableArtifactExamples: ['plan_fps/manifests', 'test/oracles/fixtures'];
  };
};

type Tsconfig = {
  include: string[];
};

const manifestPath = resolve('plan_fps/manifests/00-008-pin-read-only-reference-boundaries.json');
const decisionLogPath = resolve('plan_fps/DECISION_LOG.md');
const packageJsonPath = resolve('package.json');
const readmePath = resolve('plan_fps/README.md');
const tsconfigPath = resolve('tsconfig.json');

const decisionLogText = await Bun.file(decisionLogPath).text();
const manifest: StepManifest = await Bun.file(manifestPath).json();
const packageJson: PackageJson = await Bun.file(packageJsonPath).json();
const readmeText = await Bun.file(readmePath).text();
const tsconfig: Tsconfig = await Bun.file(tsconfigPath).json();

const expectedManifest: StepManifest = {
  schemaVersion: 1,
  stepId: '00-008',
  stepSlug: 'pin-read-only-reference-boundaries',
  decisionId: 'D-FPS-009',
  runtimeTarget: 'bun run doom.ts',
  deterministicReplayCompatible: true,
  workspaceRoot: 'D:/Projects/doom-in-typescript',
  readOnlyReferenceRoots: [
    {
      rootId: 'doom',
      relativePath: 'doom',
      absolutePath: 'D:/Projects/doom-in-typescript/doom',
      existsOnDisk: true,
      writeAllowed: false,
    },
    {
      rootId: 'iwad',
      relativePath: 'iwad',
      absolutePath: 'D:/Projects/doom-in-typescript/iwad',
      existsOnDisk: true,
      writeAllowed: false,
    },
    {
      rootId: 'reference',
      relativePath: 'reference',
      absolutePath: 'D:/Projects/doom-in-typescript/reference',
      existsOnDisk: true,
      writeAllowed: false,
    },
  ],
  writePolicy: {
    forbidCreate: true,
    forbidDelete: true,
    forbidModify: true,
    oracleArtifactsMustStayOutsideReadOnlyRoots: true,
    readOnlyRootsAreExclusive: true,
    writableArtifactExamples: ['plan_fps/manifests', 'test/oracles/fixtures'],
  },
  readmeBoundaries: {
    readOnlyReferenceRootsLine: '- Read-only reference roots: `doom/`, `iwad/`, and `reference/`',
    oracleArtifactsLine: '- Oracle artifacts must be generated under writable project paths such as `test/oracles/fixtures/` or `plan_fps/manifests/`.',
    noWriteLine: '- Do not write inside `doom/`, `iwad/`, or `reference/`.',
  },
  toolingScope: {
    packageJsonScripts: {
      format: 'bun run tools/format-changed.ts',
      start: 'bun run src/main.ts',
    },
    readOnlyRootsIncludedInTypeScriptInputs: false,
    tsconfigIncludes: ['src', 'test', 'tools'],
  },
  rationale:
    'D-FPS-008 already pins the writable workspace root to `D:/Projects/doom-in-typescript` and D-FPS-003 pins the runtime target to `bun run doom.ts`. This step narrows that workspace into three in-repo reference roots that remain readable for parity work but never writable, while oracle and manifest outputs stay under writable project paths such as `test/oracles/fixtures/` and `plan_fps/manifests/`.',
  evidencePaths: ['doom', 'iwad', 'package.json', 'plan_fps/README.md', 'reference', 'tsconfig.json'],
};

const expectedDecisionSection = `## D-FPS-009

- status: accepted
- date: 2026-04-24
- decision: The only read-only reference roots for the playable parity effort are \`D:/Projects/doom-in-typescript/doom\`, \`D:/Projects/doom-in-typescript/iwad\`, and \`D:/Projects/doom-in-typescript/reference\`; no Ralph-loop step may write inside those roots.
- rationale: D-FPS-008 already pins the writable workspace root to \`D:/Projects/doom-in-typescript\` and D-FPS-003 pins the runtime target to \`bun run doom.ts\`. This step narrows that workspace into three in-repo reference roots that remain readable for parity work but never writable, while oracle and manifest outputs stay under writable project paths such as \`test/oracles/fixtures/\` and \`plan_fps/manifests/\`.
- evidence: doom, iwad, plan_fps/README.md, plan_fps/manifests/00-008-pin-read-only-reference-boundaries.json, reference, package.json, tsconfig.json
- affected_steps: 00-008, 00-009, 02-001, 02-002, 15-001
- supersedes: none`;

function getDecisionSection(decisionText: string, decisionId: string): string {
  const sectionPattern = new RegExp(`## ${decisionId}\\n[\\s\\S]*?(?=\\n## D-FPS-|$)`);
  const sectionMatch = decisionText.match(sectionPattern);

  if (sectionMatch === null) {
    throw new Error(`Missing decision section ${decisionId}.`);
  }

  return sectionMatch[0].trim();
}

function toPosixPath(pathValue: string): string {
  return pathValue.replaceAll('\\', '/');
}

function isSamePathOrInsideRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidatePath = toPosixPath(candidatePath);
  const normalizedRootPath = toPosixPath(rootPath);

  return normalizedCandidatePath === normalizedRootPath || normalizedCandidatePath.startsWith(`${normalizedRootPath}/`);
}

describe('00-008 pin-read-only-reference-boundaries manifest', () => {
  test('locks the exact manifest contract', () => {
    expect(manifest).toEqual(expectedManifest);
  });

  test('matches the live workspace root on disk', () => {
    expect(toPosixPath(resolve('.'))).toBe(manifest.workspaceRoot);
  });

  test('keeps the read-only roots in ASCII order', () => {
    expect(manifest.readOnlyReferenceRoots.map((root) => root.rootId)).toEqual(['doom', 'iwad', 'reference']);
  });

  test('pins all three roots as existing directories inside the workspace', () => {
    for (const readOnlyReferenceRoot of manifest.readOnlyReferenceRoots) {
      expect(existsSync(readOnlyReferenceRoot.absolutePath)).toBe(true);
      expect(statSync(readOnlyReferenceRoot.absolutePath).isDirectory()).toBe(true);
      expect(toPosixPath(resolve(readOnlyReferenceRoot.relativePath))).toBe(readOnlyReferenceRoot.absolutePath);
      expect(isSamePathOrInsideRoot(readOnlyReferenceRoot.absolutePath, manifest.workspaceRoot)).toBe(true);
      expect(readOnlyReferenceRoot.writeAllowed).toBe(false);
    }
  });

  test('keeps read-only roots as direct workspace child paths', () => {
    for (const readOnlyReferenceRoot of manifest.readOnlyReferenceRoots) {
      expect(readOnlyReferenceRoot.relativePath).not.toBe('');
      expect(readOnlyReferenceRoot.relativePath).not.toContain('..');
      expect(readOnlyReferenceRoot.relativePath).not.toContain('/');
      expect(readOnlyReferenceRoot.relativePath).not.toContain('\\');
      expect(readOnlyReferenceRoot.absolutePath).toBe(`${manifest.workspaceRoot}/${readOnlyReferenceRoot.relativePath}`);
    }
  });

  test('keeps oracle outputs outside the read-only roots', () => {
    for (const writableArtifactExample of manifest.writePolicy.writableArtifactExamples) {
      const writableArtifactPath = toPosixPath(resolve(writableArtifactExample));
      expect(isSamePathOrInsideRoot(writableArtifactPath, manifest.workspaceRoot)).toBe(true);

      for (const readOnlyReferenceRoot of manifest.readOnlyReferenceRoots) {
        expect(isSamePathOrInsideRoot(writableArtifactPath, readOnlyReferenceRoot.absolutePath)).toBe(false);
      }
    }
  });

  test('pins the README boundary lines verbatim', () => {
    expect(readmeText).toContain(manifest.readmeBoundaries.readOnlyReferenceRootsLine);
    expect(readmeText).toContain(manifest.readmeBoundaries.oracleArtifactsLine);
    expect(readmeText).toContain(manifest.readmeBoundaries.noWriteLine);
  });

  test('matches the live package scripts and tsconfig include scope', () => {
    expect(packageJson.scripts).toEqual(manifest.toolingScope.packageJsonScripts);
    expect(tsconfig.include).toEqual(manifest.toolingScope.tsconfigIncludes);
    expect(tsconfig.include).not.toContain('doom');
    expect(tsconfig.include).not.toContain('iwad');
    expect(tsconfig.include).not.toContain('reference');
  });

  test('keeps package scripts away from the read-only roots', () => {
    for (const scriptValue of Object.values(packageJson.scripts)) {
      expect(scriptValue.includes('doom/')).toBe(false);
      expect(scriptValue.includes('iwad/')).toBe(false);
      expect(scriptValue.includes('reference/')).toBe(false);
    }
  });

  test('records evidence paths that all exist on disk', () => {
    for (const evidencePath of manifest.evidencePaths) {
      expect(existsSync(resolve(evidencePath))).toBe(true);
    }
  });

  test('records D-FPS-009 with the exact decision text', () => {
    expect(getDecisionSection(decisionLogText, manifest.decisionId)).toBe(expectedDecisionSection);
  });
});
