import { describe, expect, test } from 'bun:test';

type JsonObject = Record<string, unknown>;

const manifestPath = 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json';

const expectedManifest = {
  audit: {
    schemaVersion: 1,
    stepId: '01-008',
    title: 'audit-missing-launch-to-menu',
  },
  commandContracts: {
    currentPackageStart: {
      matchesTargetCommand: false,
      scriptName: 'start',
      value: 'bun run src/main.ts',
    },
    targetRuntime: {
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
      value: 'bun run doom.ts',
    },
  },
  currentLauncher: {
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    helpTextEvidence: ['  bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', '  Tab: toggle gameplay view and automap', '  The launcher now starts in the gameplay view and can switch to automap on demand.'],
    launchMode: 'gameplay-first',
    menuStartImplemented: false,
    primaryEntrypoint: 'src/main.ts',
    startupConsoleMessages: ['Launching ${session.mapName} from ${resources.iwadPath}', 'Opening gameplay window. Use Tab to switch to the automap.'],
    windowTitleTemplate: 'DOOM Codex - ${session.mapName}',
  },
  evidencePaths: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  explicitNullSurfaces: [
    {
      evidence: 'src/main.ts calls createLauncherSession and then runLauncherWindow without any allowed menu-first transition.',
      path: null,
      reason: 'No allowed file exposes a clean launch-to-menu entry path.',
      surface: 'clean-launch-menu-entry',
    },
    {
      evidence: 'src/main.ts help text states that the launcher starts in the gameplay view.',
      path: null,
      reason: 'No allowed file exposes a main-menu state as the first visible runtime state.',
      surface: 'first-visible-main-menu-state',
    },
    {
      evidence: 'src/main.ts console output says Opening gameplay window. Use Tab to switch to the automap.',
      path: null,
      reason: 'No allowed file exposes a title/menu startup route before gameplay.',
      surface: 'launch-to-menu-transition',
    },
    {
      evidence: 'src/main.ts imports launcher host modules but no menu module or menu renderer.',
      path: null,
      reason: 'No allowed file exposes a menu renderer or menu controller for clean launch.',
      surface: 'menu-render-controller',
    },
  ],
  observedTransitions: [
    {
      evidence: 'const resources = await loadLauncherResources(iwadPath);',
      from: 'iwad path resolution',
      to: 'launcher resource loading',
    },
    {
      evidence: 'const session = createLauncherSession(resources, { mapName, skill });',
      from: 'launcher resource loading',
      to: 'game session creation',
    },
    {
      evidence: 'await runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` });',
      from: 'game session creation',
      to: 'gameplay window',
    },
  ],
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  sourceCatalogEvidence: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      path: 'package.json',
      source: 'package manifest',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      path: 'tsconfig.json',
      source: 'TypeScript config',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  sourceHashes: {
    'package.json': '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    'plan_fps/SOURCE_CATALOG.md': '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
    'src/main.ts': '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    'tsconfig.json': '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
  },
  workspace: {
    packageName: 'doom-codex',
    packagePrivate: true,
    packageType: 'module',
    packageVersion: '0.0.0',
    tsconfigNoEmit: true,
    tsconfigStrict: true,
    tsconfigTypes: ['bun'],
  },
};

describe('01-008 audit missing launch to menu manifest', () => {
  test('locks the manifest exactly', async () => {
    expect(await Bun.file(manifestPath).json()).toEqual(expectedManifest);
  });

  test('cross-checks live command contracts and workspace configuration', async () => {
    const packageManifest = getJsonObject(await Bun.file('package.json').json(), 'package.json');
    const packageScripts = getJsonObject(packageManifest.scripts, 'package.json scripts');
    const tsconfig = getJsonObject(await Bun.file('tsconfig.json').json(), 'tsconfig.json');
    const compilerOptions = getJsonObject(tsconfig.compilerOptions, 'tsconfig compilerOptions');

    expect(packageManifest.name).toBe(expectedManifest.workspace.packageName);
    expect(packageManifest.private).toBe(expectedManifest.workspace.packagePrivate);
    expect(packageManifest.type).toBe(expectedManifest.workspace.packageType);
    expect(packageManifest.version).toBe(expectedManifest.workspace.packageVersion);
    expect(packageScripts.start).toBe(expectedManifest.commandContracts.currentPackageStart.value);
    expect(packageScripts.start).not.toBe(expectedManifest.commandContracts.targetRuntime.value);
    expect(compilerOptions.noEmit).toBe(expectedManifest.workspace.tsconfigNoEmit);
    expect(compilerOptions.strict).toBe(expectedManifest.workspace.tsconfigStrict);
    expect(compilerOptions.types).toEqual(expectedManifest.workspace.tsconfigTypes);
  });

  test('cross-checks the gameplay-first launch transition in src/main.ts', async () => {
    const source = await Bun.file('src/main.ts').text();

    expect(source).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(source).toContain('const DEFAULT_SCALE = 2;');
    expect(source).toContain('const DEFAULT_SKILL = 2;');
    expect(source).toContain("'  Tab: toggle gameplay view and automap',");
    expect(source).toContain("'  The launcher now starts in the gameplay view and can switch to automap on demand.',");
    expect(source).toContain('const session = createLauncherSession(resources, {');
    expect(source).toContain("console.log('Opening gameplay window. Use Tab to switch to the automap.');");
    expect(source).toContain('await runLauncherWindow(session, {');
    expect(source).toContain('title: `DOOM Codex - ${session.mapName}`,');
    expect(source).not.toContain('renderMainMenu');
    expect(source).not.toContain('launchToMenu');
  });

  test('verifies source hashes and source catalog evidence', async () => {
    expect(await createFileHash('package.json')).toBe(expectedManifest.sourceHashes['package.json']);
    expect(await createFileHash('plan_fps/SOURCE_CATALOG.md')).toBe(expectedManifest.sourceHashes['plan_fps/SOURCE_CATALOG.md']);
    expect(await createFileHash('src/main.ts')).toBe(expectedManifest.sourceHashes['src/main.ts']);
    expect(await createFileHash('tsconfig.json')).toBe(expectedManifest.sourceHashes['tsconfig.json']);

    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    for (const source of expectedManifest.sourceCatalogEvidence) {
      expect(sourceCatalog).toContain(`| ${source.id} | ${source.source} |`);
      expect(sourceCatalog).toContain(`| ${source.authority} | \`${source.path}\` |`);
    }
  });

  test('verifies explicit null surfaces and durable fact evidence', async () => {
    const explicitNullSurfaceNames = expectedManifest.explicitNullSurfaces.map((surface) => surface.surface);

    expect(explicitNullSurfaceNames).toEqual([...explicitNullSurfaceNames].sort());
    expect(expectedManifest.explicitNullSurfaces.every((surface) => surface.path === null)).toBe(true);

    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();

    expect(factLog).toContain('## F-FPS-016');
    expect(factLog).toContain('src/main.ts` creates a launcher session and calls `runLauncherWindow` directly');
    expect(factLog).toContain('no clean launch-to-menu entry or menu-first transition is exposed');
    expect(factLog).toContain('plan_fps/manifests/01-008-audit-missing-launch-to-menu.json');
  });
});

async function createFileHash(path: string): Promise<string> {
  const source = await Bun.file(path).text();

  return new Bun.CryptoHasher('sha256').update(source).digest('hex');
}

function getJsonObject(value: unknown, label: string): JsonObject {
  if (isJsonObject(value)) {
    return value;
  }

  throw new Error(`${label} must be a JSON object.`);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
