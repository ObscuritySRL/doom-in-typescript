import { describe, expect, test } from 'bun:test';

const repositoryRootUrl = new URL('../../', import.meta.url);

const expectedManifest = {
  auditScope: {
    evidencePaths: ['package.json', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
    sourceCatalogIds: ['S-FPS-009', 'S-FPS-010', 'S-FPS-011'],
    sourceLimitation: 'This audit is limited to the current launcher module surface exposed by src/main.ts and workspace metadata listed in the step read-only section.',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    helpUsage: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    sourceTextSha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
  },
  generatedDate: '2026-04-24',
  missingSurfaces: [
    {
      actualPath: null,
      currentPath: 'src/main.ts',
      evidence: 'package.json scripts.start is bun run src/main.ts while the playable parity runtime target is bun run doom.ts.',
      requiredPath: 'doom.ts',
      surface: 'root-doom-ts-command-contract',
    },
    {
      actualPath: null,
      currentPath: 'src/main.ts',
      evidence: 'src/main.ts creates a launcher session and calls runLauncherWindow directly; it imports no title, menu, or attract-loop module.',
      requiredPath: null,
      surface: 'title-menu-startup-flow',
    },
  ],
  moduleEntries: [
    {
      path: 'src/bootstrap/cmdline.ts',
      status: 'present-imported',
      surface: 'command-line parsing',
      symbols: ['CommandLine'],
      usedBy: ['src/main.ts'],
    },
    {
      path: 'src/launcher/session.ts',
      status: 'present-imported',
      surface: 'launcher resource loading and session creation',
      symbols: ['createLauncherSession', 'loadLauncherResources'],
      usedBy: ['src/main.ts'],
    },
    {
      path: 'src/launcher/win32.ts',
      status: 'present-imported',
      surface: 'Win32 launcher window',
      symbols: ['runLauncherWindow'],
      usedBy: ['src/main.ts'],
    },
    {
      path: 'src/main.ts',
      status: 'present-entrypoint',
      surface: 'current launcher entrypoint',
      symbols: ['DEFAULT_LOCAL_IWAD_PATH', 'DEFAULT_MAP_NAME', 'DEFAULT_SCALE', 'DEFAULT_SKILL', 'HELP_TEXT', 'main', 'parseIntegerParameter', 'resolveDefaultIwadPath'],
      usedBy: ['package.json scripts.start'],
    },
    {
      path: 'src/reference/policy.ts',
      status: 'present-imported',
      surface: 'reference bundle path policy',
      symbols: ['REFERENCE_BUNDLE_PATH'],
      usedBy: ['src/main.ts'],
    },
    {
      path: 'src/reference/target.ts',
      status: 'present-imported',
      surface: 'primary reference target metadata',
      symbols: ['PRIMARY_TARGET'],
      usedBy: ['src/main.ts'],
    },
  ],
  schemaVersion: 1,
  stepId: '01-001',
  stepTitle: 'audit-existing-modules',
  workspace: {
    formatScript: 'bun run tools/format-changed.ts',
    packageName: 'doom-codex',
    packagePrivate: true,
    packageType: 'module',
    runtimeTarget: 'bun run doom.ts',
    startScript: 'bun run src/main.ts',
    tsconfigInclude: ['src', 'test', 'tools'],
    tsconfigNoEmit: true,
    tsconfigTypes: ['bun'],
  },
};

function sha256(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(text);
  return hasher.digest('hex');
}

function isAsciiSortedAscending(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || previous >= current) {
      return false;
    }
  }
  return true;
}

describe('01-001 audit-existing-modules manifest', () => {
  test('locks the exact machine-readable audit manifest', async () => {
    const manifest: unknown = await Bun.file(new URL('plan_fps/manifests/01-001-audit-existing-modules.json', repositoryRootUrl)).json();

    expect(manifest).toEqual(expectedManifest);
  });

  test('cross-checks the current launcher entrypoint against src/main.ts', async () => {
    const sourceText = await Bun.file(new URL('src/main.ts', repositoryRootUrl)).text();

    expect(expectedManifest.currentEntrypoint.sourceTextSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256(sourceText)).toBe(expectedManifest.currentEntrypoint.sourceTextSha256);
    expect(sourceText).toContain("import { CommandLine } from './bootstrap/cmdline.ts';");
    expect(sourceText).toContain("import { createLauncherSession, loadLauncherResources } from './launcher/session.ts';");
    expect(sourceText).toContain("import { runLauncherWindow } from './launcher/win32.ts';");
    expect(sourceText).toContain("import { REFERENCE_BUNDLE_PATH } from './reference/policy.ts';");
    expect(sourceText).toContain("import { PRIMARY_TARGET } from './reference/target.ts';");
    expect(sourceText).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(sourceText).toContain('const DEFAULT_SCALE = 2;');
    expect(sourceText).toContain('const DEFAULT_SKILL = 2;');
    expect(sourceText).toContain('The launcher now starts in the gameplay view and can switch to automap on demand.');

    for (const helpUsageLine of expectedManifest.currentEntrypoint.helpUsage) {
      expect(sourceText).toContain(helpUsageLine);
    }
  });

  test('cross-checks package and TypeScript workspace facts', async () => {
    const packageJson: unknown = await Bun.file(new URL('package.json', repositoryRootUrl)).json();
    const tsconfigJson: unknown = await Bun.file(new URL('tsconfig.json', repositoryRootUrl)).json();

    expect(packageJson).toMatchObject({
      name: expectedManifest.workspace.packageName,
      private: expectedManifest.workspace.packagePrivate,
      scripts: {
        format: expectedManifest.workspace.formatScript,
        start: expectedManifest.workspace.startScript,
      },
      type: expectedManifest.workspace.packageType,
    });
    expect(tsconfigJson).toMatchObject({
      compilerOptions: {
        noEmit: expectedManifest.workspace.tsconfigNoEmit,
        types: expectedManifest.workspace.tsconfigTypes,
      },
      include: expectedManifest.workspace.tsconfigInclude,
    });
  });

  test('cross-checks the source catalog authorities used by the audit', async () => {
    const sourceCatalog = await Bun.file(new URL('plan_fps/SOURCE_CATALOG.md', repositoryRootUrl)).text();

    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` |');
  });

  test('keeps module and missing-surface entries sorted with explicit nulls', () => {
    expect(expectedManifest.moduleEntries.map((entry) => entry.path)).toEqual(['src/bootstrap/cmdline.ts', 'src/launcher/session.ts', 'src/launcher/win32.ts', 'src/main.ts', 'src/reference/policy.ts', 'src/reference/target.ts']);
    expect(expectedManifest.missingSurfaces.map((entry) => entry.surface)).toEqual(['root-doom-ts-command-contract', 'title-menu-startup-flow']);
    expect(expectedManifest.missingSurfaces.map((entry) => entry.actualPath)).toEqual([null, null]);

    expect(isAsciiSortedAscending(expectedManifest.moduleEntries.map((entry) => entry.path))).toBe(true);
    expect(isAsciiSortedAscending(expectedManifest.missingSurfaces.map((entry) => entry.surface))).toBe(true);
    expect(isAsciiSortedAscending(expectedManifest.auditScope.evidencePaths)).toBe(true);
    expect(isAsciiSortedAscending(expectedManifest.auditScope.sourceCatalogIds)).toBe(true);
    for (const moduleEntry of expectedManifest.moduleEntries) {
      expect(isAsciiSortedAscending(moduleEntry.symbols)).toBe(true);
    }
  });

  test('verifies every recorded evidence path and module path resolves to an existing file', async () => {
    for (const evidencePath of expectedManifest.auditScope.evidencePaths) {
      expect(await Bun.file(new URL(evidencePath, repositoryRootUrl)).exists()).toBe(true);
    }
    for (const moduleEntry of expectedManifest.moduleEntries) {
      expect(await Bun.file(new URL(moduleEntry.path, repositoryRootUrl)).exists()).toBe(true);
    }
  });
});
