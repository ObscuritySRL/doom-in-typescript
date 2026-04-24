import { describe, expect, test } from 'bun:test';

const MANIFEST_PATH = 'plan_fps/manifests/01-006-audit-playable-host-surface.json';

const expectedManifest = {
  commandContracts: {
    currentLauncherCommand: 'bun run src/main.ts',
    currentPackageScript: 'bun run start',
    targetRuntimeCommand: 'bun run doom.ts',
  },
  currentLauncherHostTransition: {
    call: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    initialView: 'gameplay',
    statusMessages: ['Launching ${session.mapName} from ${resources.iwadPath}', 'Opening gameplay window. Use Tab to switch to the automap.'],
    titleTemplate: 'DOOM Codex - ${session.mapName}',
    toggleViewControl: 'Tab',
  },
  directImports: [
    {
      classification: 'bootstrap-command-line',
      importedNames: ['CommandLine'],
      modulePath: './bootstrap/cmdline.ts',
      readPermittedInThisStep: false,
      resolvedPath: 'src/bootstrap/cmdline.ts',
    },
    {
      classification: 'launcher-session',
      importedNames: ['createLauncherSession', 'loadLauncherResources'],
      modulePath: './launcher/session.ts',
      readPermittedInThisStep: false,
      resolvedPath: 'src/launcher/session.ts',
    },
    {
      classification: 'playable-window-host',
      importedNames: ['runLauncherWindow'],
      modulePath: './launcher/win32.ts',
      readPermittedInThisStep: false,
      resolvedPath: 'src/launcher/win32.ts',
    },
    {
      classification: 'reference-path-policy',
      importedNames: ['REFERENCE_BUNDLE_PATH'],
      modulePath: './reference/policy.ts',
      readPermittedInThisStep: false,
      resolvedPath: 'src/reference/policy.ts',
    },
    {
      classification: 'reference-target-policy',
      importedNames: ['PRIMARY_TARGET'],
      modulePath: './reference/target.ts',
      readPermittedInThisStep: false,
      resolvedPath: 'src/reference/target.ts',
    },
  ],
  evidencePaths: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  explicitNullSurfaces: [
    {
      reason: "No audio host API is imported or configured by src/main.ts within this step's read scope.",
      surface: 'audio-host-surface',
      value: null,
    },
    {
      reason: "No config persistence API is imported or configured by src/main.ts within this step's read scope.",
      surface: 'config-persistence-host-surface',
      value: null,
    },
    {
      reason: "The target command is bun run doom.ts, but this step's observable launcher command remains bun run src/main.ts.",
      surface: 'final-root-command-host-entrypoint',
      value: null,
    },
    {
      reason: 'The visible launcher help says the launcher starts in the gameplay view, not the title or menu flow.',
      surface: 'launch-to-menu-transition',
      value: null,
    },
    {
      reason: 'No live input host implementation can be audited because src/launcher/win32.ts is outside the read scope.',
      surface: 'live-input-host-surface',
      value: null,
    },
    {
      reason: "No save/load host API is imported or configured by src/main.ts within this step's read scope.",
      surface: 'save-load-host-surface',
      value: null,
    },
    {
      reason: "No replay or side-by-side host API is imported or configured by src/main.ts within this step's read scope.",
      surface: 'side-by-side-replay-host-surface',
      value: null,
    },
    {
      reason: "No title-loop host API is imported or configured by src/main.ts within this step's read scope.",
      surface: 'title-loop-host-surface',
      value: null,
    },
    {
      reason: 'The only visible host implementation path is imported as src/launcher/win32.ts, but that file is outside the read scope.',
      surface: 'window-host-implementation-inventory',
      value: null,
    },
  ],
  factLogEvidence: ['F-FPS-009', 'F-FPS-010', 'F-FPS-013', 'F-FPS-014'],
  playableHostSurfaces: [
    {
      evidence: 'HELP_TEXT control line: Tab: toggle gameplay view and automap',
      path: 'src/main.ts',
      status: 'observed',
      surface: 'automap-toggle',
    },
    {
      evidence: 'await runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      path: 'src/main.ts',
      status: 'observed',
      surface: 'gameplay-window-open',
    },
    {
      evidence: 'console output before runLauncherWindow announces the selected map and IWAD path',
      path: 'src/main.ts',
      status: 'observed',
      surface: 'launch-status-output',
    },
    {
      evidence: '--scale parameter falls back to DEFAULT_SCALE = 2',
      path: 'src/main.ts',
      status: 'observed',
      surface: 'scale-parameter',
    },
    {
      evidence: 'title: `DOOM Codex - ${session.mapName}`',
      path: 'src/main.ts',
      status: 'observed',
      surface: 'window-title',
    },
  ],
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  schemaVersion: 1,
  sourceCatalogRows: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      kind: 'file',
      path: 'package.json',
      source: 'package manifest',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      kind: 'file',
      path: 'tsconfig.json',
      source: 'TypeScript config',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      kind: 'file',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  sourceHashes: {
    packageJsonSha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    sourceCatalogSha256: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
    srcMainTsSha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    tsconfigJsonSha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
  },
  stepId: '01-006',
  stepTitle: 'audit-playable-host-surface',
  workspace: {
    packageJson: {
      declaredBunWin32Dependencies: ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'],
      scripts: {
        format: 'bun run tools/format-changed.ts',
        start: 'bun run src/main.ts',
      },
    },
    tsconfigJson: {
      include: ['src', 'test', 'tools'],
      moduleResolution: 'bundler',
      noEmit: true,
      strict: true,
      types: ['bun'],
    },
  },
};

describe('01-006 audit playable host surface manifest', () => {
  test('locks the exact manifest payload', async () => {
    expect(await Bun.file(MANIFEST_PATH).json()).toEqual(expectedManifest);
  });

  test('cross-checks source hashes and workspace command contracts', async () => {
    const packageJson = await Bun.file('package.json').json();
    const tsconfigJson = await Bun.file('tsconfig.json').json();

    expect(await calculateSha256('package.json')).toBe(expectedManifest.sourceHashes.packageJsonSha256);
    expect(await calculateSha256('plan_fps/SOURCE_CATALOG.md')).toBe(expectedManifest.sourceHashes.sourceCatalogSha256);
    expect(await calculateSha256('src/main.ts')).toBe(expectedManifest.sourceHashes.srcMainTsSha256);
    expect(await calculateSha256('tsconfig.json')).toBe(expectedManifest.sourceHashes.tsconfigJsonSha256);

    expect(packageJson.scripts).toEqual(expectedManifest.workspace.packageJson.scripts);
    expect(
      Object.keys(packageJson.dependencies)
        .filter((dependencyName) => dependencyName.startsWith('@bun-win32/'))
        .sort(),
    ).toEqual(expectedManifest.workspace.packageJson.declaredBunWin32Dependencies);
    expect(packageJson.scripts.start).toBe(expectedManifest.commandContracts.currentLauncherCommand);

    expect(tsconfigJson.compilerOptions.moduleResolution).toBe(expectedManifest.workspace.tsconfigJson.moduleResolution);
    expect(tsconfigJson.compilerOptions.noEmit).toBe(expectedManifest.workspace.tsconfigJson.noEmit);
    expect(tsconfigJson.compilerOptions.strict).toBe(expectedManifest.workspace.tsconfigJson.strict);
    expect(tsconfigJson.compilerOptions.types).toEqual(expectedManifest.workspace.tsconfigJson.types);
    expect(tsconfigJson.include).toEqual(expectedManifest.workspace.tsconfigJson.include);
  });

  test('verifies the current launcher host transition from src/main.ts', async () => {
    const sourceText = (await Bun.file('src/main.ts').text()).replaceAll('\r\n', '\n');

    for (const directImport of expectedManifest.directImports) {
      expect(sourceText).toContain(`from '${directImport.modulePath}';`);
    }

    expect(sourceText).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(sourceText).toContain('const DEFAULT_SCALE = 2;');
    expect(sourceText).toContain('const DEFAULT_SKILL = 2;');
    expect(sourceText).toContain('  Tab: toggle gameplay view and automap');
    expect(sourceText).toContain('The launcher now starts in the gameplay view and can switch to automap on demand.');
    expect(sourceText).toContain('Launching ${session.mapName} from ${resources.iwadPath}');
    expect(sourceText).toContain('Opening gameplay window. Use Tab to switch to the automap.');
    expect(sourceText).toContain('await runLauncherWindow(session, {\n    scale,\n    title: `DOOM Codex - ${session.mapName}`,\n  });');
  });

  test('verifies explicit nulls and source-catalog evidence', async () => {
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();
    const explicitNullSurfaceNames = expectedManifest.explicitNullSurfaces.map((surface) => surface.surface);
    const playableSurfaceNames = expectedManifest.playableHostSurfaces.map((surface) => surface.surface);

    expect([...explicitNullSurfaceNames].sort()).toEqual(explicitNullSurfaceNames);
    expect([...playableSurfaceNames].sort()).toEqual(playableSurfaceNames);

    for (const explicitNullSurface of expectedManifest.explicitNullSurfaces) {
      expect(explicitNullSurface.value).toBeNull();
    }

    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` | Bun package and dependency inventory. |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` | Typecheck target for step verification. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');

    for (const factIdentifier of expectedManifest.factLogEvidence) {
      expect(factLog).toContain(`## ${factIdentifier}`);
    }

    expect(factLog).toContain('Within the 01-006 read scope, `src/main.ts` directly transitions from loaded launcher resources to `runLauncherWindow` imported from `src/launcher/win32.ts`');
  });
});

async function calculateSha256(filePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(await Bun.file(filePath).arrayBuffer());

  return hasher.digest('hex');
}
