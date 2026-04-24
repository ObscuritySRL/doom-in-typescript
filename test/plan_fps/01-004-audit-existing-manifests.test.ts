import { describe, expect, test } from 'bun:test';

const expectedManifest = {
  catalogVisibleManifestDirectory: {
    authority: 'prior-art',
    fileInventory: null,
    inventoryReason: 'The selected step permits reading plan_fps/SOURCE_CATALOG.md but not enumerating reference/manifests/.',
    kind: 'directory',
    path: 'reference/manifests/',
    sourceId: 'S-FPS-008',
  },
  evidencePaths: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  factLogManifestReferences: [
    {
      factId: 'F-FPS-006',
      paths: ['plan_fps/manifests/existing-plan-classification.json'],
      visibility: 'fact-log-reference-only',
    },
    {
      factId: 'F-FPS-007',
      paths: ['plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json'],
      visibility: 'fact-log-reference-only',
    },
    {
      factId: 'F-FPS-009',
      paths: ['plan_fps/manifests/01-001-audit-existing-modules.json'],
      visibility: 'fact-log-reference-only',
    },
    {
      factId: 'F-FPS-011',
      paths: ['plan_fps/manifests/01-003-audit-existing-oracle-fixtures.json'],
      visibility: 'fact-log-reference-only',
    },
    {
      factId: 'F-FPS-012',
      paths: ['plan_fps/manifests/01-004-audit-existing-manifests.json'],
      visibility: 'current-step-fact',
    },
  ],
  launcherContext: {
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    entrypointPath: 'src/main.ts',
    helpUsageLines: ['  bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', '  bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    importedModulePaths: ['./bootstrap/cmdline.ts', './launcher/session.ts', './launcher/win32.ts', './reference/policy.ts', './reference/target.ts'],
    sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
  },
  missingOrUnseenSurfaces: [
    {
      path: 'plan_fps/manifests/',
      reason: 'The selected step may write one expected manifest under this directory but does not list the directory or prior manifest files under Read Only.',
      surface: 'generated-plan-manifest-inventory',
      value: null,
    },
    {
      path: 'reference/manifests/',
      reason: 'SOURCE_CATALOG.md exposes only the directory row S-FPS-008; the selected step does not permit enumerating that directory.',
      surface: 'prior-reference-manifest-file-inventory',
      value: null,
    },
  ],
  readOnlyPaths: ['plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'package.json', 'tsconfig.json', 'src/main.ts'],
  schemaVersion: 1,
  sourceCatalogHash: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
  stepId: '01-004',
  stepTitle: 'audit-existing-manifests',
  workspaceManifestFiles: [
    {
      dependencies: {
        '@bun-win32/core': '^1.1.1',
        '@bun-win32/gdi32': '^1.0.12',
        '@bun-win32/kernel32': '^1.0.21',
        '@bun-win32/user32': '^3.0.20',
        '@bun-win32/winmm': '^1.0.2',
      },
      description: 'Vanilla Doom parity engine built on Bun FFI and @bun-win32 bindings.',
      devDependencies: {
        '@biomejs/biome': '^2.4.13',
        '@types/bun': 'latest',
      },
      kind: 'package-json',
      name: 'doom-codex',
      path: 'package.json',
      private: true,
      scripts: {
        format: 'bun run tools/format-changed.ts',
        start: 'bun run src/main.ts',
      },
      sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
      sourceId: 'S-FPS-009',
      type: 'module',
      version: '0.0.0',
    },
    {
      compilerHighlights: {
        allowImportingTsExtensions: true,
        allowJs: true,
        lib: ['ESNext'],
        module: 'Preserve',
        moduleDetection: 'force',
        moduleResolution: 'bundler',
        noEmit: true,
        strict: true,
        target: 'ESNext',
        types: ['bun'],
      },
      include: ['src', 'test', 'tools'],
      kind: 'typescript-config',
      path: 'tsconfig.json',
      sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
      sourceId: 'S-FPS-010',
    },
  ],
};

const expectedPackageJson = {
  dependencies: {
    '@bun-win32/core': '^1.1.1',
    '@bun-win32/gdi32': '^1.0.12',
    '@bun-win32/kernel32': '^1.0.21',
    '@bun-win32/user32': '^3.0.20',
    '@bun-win32/winmm': '^1.0.2',
  },
  description: 'Vanilla Doom parity engine built on Bun FFI and @bun-win32 bindings.',
  devDependencies: {
    '@biomejs/biome': '^2.4.13',
    '@types/bun': 'latest',
  },
  name: 'doom-codex',
  private: true,
  scripts: {
    format: 'bun run tools/format-changed.ts',
    start: 'bun run src/main.ts',
  },
  type: 'module',
  version: '0.0.0',
};

const expectedTsconfigJson = {
  compilerOptions: {
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
  },
  include: ['src', 'test', 'tools'],
};

async function hashFile(filePath: string): Promise<string> {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(filePath).text()).digest('hex');
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const parsedJson: unknown = JSON.parse(await Bun.file(filePath).text());

  return parsedJson;
}

describe('01-004 audit-existing-manifests manifest', () => {
  test('locks the manifest payload exactly', async () => {
    await expect(readJsonFile('plan_fps/manifests/01-004-audit-existing-manifests.json')).resolves.toEqual(expectedManifest);
  });

  test('cross-checks source catalog rows and hashes', async () => {
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    expect(await hashFile('plan_fps/SOURCE_CATALOG.md')).toBe(expectedManifest.sourceCatalogHash);
    expect(sourceCatalog).toContain('| S-FPS-008 | prior manifests | directory | prior-art | `reference/manifests/` | Existing derived manifests, read-only for plan purposes. |');
    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` | Bun package and dependency inventory. |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` | Typecheck target for step verification. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
  });

  test('cross-checks workspace manifest files against live package and TypeScript config', async () => {
    await expect(readJsonFile('package.json')).resolves.toEqual(expectedPackageJson);
    await expect(readJsonFile('tsconfig.json')).resolves.toEqual(expectedTsconfigJson);
    await expect(hashFile('package.json')).resolves.toBe(expectedManifest.workspaceManifestFiles[0].sha256);
    await expect(hashFile('tsconfig.json')).resolves.toBe(expectedManifest.workspaceManifestFiles[1].sha256);
  });

  test('cross-checks current launcher context against src/main.ts', async () => {
    const sourceText = await Bun.file('src/main.ts').text();

    await expect(hashFile('src/main.ts')).resolves.toBe(expectedManifest.launcherContext.sha256);
    expect(sourceText).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(sourceText).toContain('const DEFAULT_SCALE = 2;');
    expect(sourceText).toContain('const DEFAULT_SKILL = 2;');

    for (const importedModulePath of expectedManifest.launcherContext.importedModulePaths) {
      expect(sourceText).toContain(`from '${importedModulePath}'`);
    }

    for (const helpUsageLine of expectedManifest.launcherContext.helpUsageLines) {
      expect(sourceText).toContain(helpUsageLine);
    }
  });

  test('records visible fact-log manifest references and the new reusable finding', async () => {
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();

    for (const factLogManifestReference of expectedManifest.factLogManifestReferences) {
      expect(factLog).toContain(factLogManifestReference.factId);

      for (const manifestPath of factLogManifestReference.paths) {
        expect(factLog).toContain(manifestPath);
      }
    }

    expect(factLog).toContain('The 01-004 read scope exposes `reference/manifests/` only as a catalog-visible prior-art directory and does not permit enumerating `reference/manifests/` or `plan_fps/manifests/`.');
  });
});
