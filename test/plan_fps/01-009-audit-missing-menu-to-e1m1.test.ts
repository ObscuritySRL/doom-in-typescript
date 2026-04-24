import { describe, expect, test } from 'bun:test';

const FACT_LOG_PATH = 'plan_fps/FACT_LOG.md';
const MANIFEST_PATH = 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json';
const PACKAGE_JSON_PATH = 'package.json';
const SOURCE_CATALOG_PATH = 'plan_fps/SOURCE_CATALOG.md';
const SRC_MAIN_TS_PATH = 'src/main.ts';
const TSCONFIG_JSON_PATH = 'tsconfig.json';

const EXPECTED_MANIFEST = {
  commandContracts: {
    currentPackageStart: {
      command: 'bun run src/main.ts',
      path: PACKAGE_JSON_PATH,
      scriptName: 'start',
    },
    targetRuntime: {
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      implementedInReadScope: false,
    },
  },
  currentLauncherSurface: {
    defaults: {
      mapName: 'E1M1',
      scale: 2,
      skill: 2,
    },
    observedSurfaces: [
      {
        evidence: "const DEFAULT_MAP_NAME = 'E1M1';",
        path: SRC_MAIN_TS_PATH,
        surfaceId: 'default-map-e1m1',
      },
      {
        evidence: 'const session = createLauncherSession(resources, { mapName, skill });',
        path: SRC_MAIN_TS_PATH,
        surfaceId: 'direct-gameplay-session',
      },
      {
        evidence: 'The launcher now starts in the gameplay view and can switch to automap on demand.',
        path: SRC_MAIN_TS_PATH,
        surfaceId: 'gameplay-first-help',
      },
      {
        evidence: 'Opening gameplay window. Use Tab to switch to the automap.',
        path: SRC_MAIN_TS_PATH,
        surfaceId: 'gameplay-window-console',
      },
      {
        evidence: 'Tab: toggle gameplay view and automap',
        path: SRC_MAIN_TS_PATH,
        surfaceId: 'tab-automap-toggle',
      },
    ],
    transitions: [
      {
        evidence: 'const commandLine = new CommandLine(Bun.argv);',
        from: 'Bun.argv',
        ordinal: 1,
        path: SRC_MAIN_TS_PATH,
        to: 'CommandLine',
      },
      {
        evidence: "const iwadPath = commandLine.getParameter('--iwad') ?? (await resolveDefaultIwadPath());",
        from: 'CommandLine',
        ordinal: 2,
        path: SRC_MAIN_TS_PATH,
        to: 'IWAD path resolution',
      },
      {
        evidence: 'const resources = await loadLauncherResources(iwadPath);',
        from: 'IWAD path resolution',
        ordinal: 3,
        path: SRC_MAIN_TS_PATH,
        to: 'launcher resources',
      },
      {
        evidence: 'const session = createLauncherSession(resources, { mapName, skill });',
        from: 'launcher resources',
        ordinal: 4,
        path: SRC_MAIN_TS_PATH,
        to: 'gameplay session',
      },
      {
        evidence: 'await runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` });',
        from: 'gameplay session',
        ordinal: 5,
        path: SRC_MAIN_TS_PATH,
        to: 'gameplay window',
      },
    ],
  },
  evidencePaths: [PACKAGE_JSON_PATH, FACT_LOG_PATH, SOURCE_CATALOG_PATH, SRC_MAIN_TS_PATH, TSCONFIG_JSON_PATH],
  explicitNullSurfaces: [
    {
      evidence: 'The allowed launch surface creates a gameplay session directly; no menu command path is exposed.',
      expectedPath: null,
      reason: 'No current path in the allowed files routes New Game -> episode -> skill -> E1M1 start.',
      surfaceId: 'e1m1-start-menu-command',
    },
    {
      evidence: 'The allowed read scope exposes no episode-select menu implementation or call site.',
      expectedPath: null,
      reason: 'Episode selection is required for the vanilla menu-to-E1M1 route but is absent from the visible launch surface.',
      surfaceId: 'episode-menu-route',
    },
    {
      evidence: 'The allowed read scope exposes no menu controller module or menu event handler.',
      expectedPath: null,
      reason: "No menu controller surface is visible from the selected step's exact read scope.",
      surfaceId: 'menu-controller-surface',
    },
    {
      evidence: 'The allowed read scope exposes no menu renderer or title/menu first frame surface.',
      expectedPath: null,
      reason: "No menu render surface is visible from the selected step's exact read scope.",
      surfaceId: 'menu-render-surface',
    },
    {
      evidence: 'src/main.ts transitions from launcher resources to createLauncherSession and runLauncherWindow without a menu state.',
      expectedPath: null,
      reason: 'No menu-state transition into E1M1 is visible before gameplay session creation.',
      surfaceId: 'menu-to-e1m1-transition',
    },
    {
      evidence: 'The target command is bun run doom.ts, but the visible current package start script is bun run src/main.ts.',
      expectedPath: null,
      reason: 'The root command contract that should own the final launch path is not implemented in this read scope.',
      surfaceId: 'root-doom-entrypoint-menu-path',
    },
    {
      evidence: 'The allowed read scope exposes no skill-select menu implementation or call site.',
      expectedPath: null,
      reason: 'Skill selection is required for the vanilla menu-to-E1M1 route but is absent from the visible launch surface.',
      surfaceId: 'skill-menu-route',
    },
  ],
  generatedAt: '2026-04-24',
  readScope: [PACKAGE_JSON_PATH, FACT_LOG_PATH, SOURCE_CATALOG_PATH, SRC_MAIN_TS_PATH, TSCONFIG_JSON_PATH],
  schemaVersion: 1,
  sourceCatalogEvidence: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      path: PACKAGE_JSON_PATH,
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      path: TSCONFIG_JSON_PATH,
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: SRC_MAIN_TS_PATH,
    },
  ],
  stepId: '01-009',
  stepTitle: 'audit-missing-menu-to-e1m1',
  workspace: {
    packageJson: {
      dependencies: ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'],
      description: 'Vanilla Doom parity engine built on Bun FFI and @bun-win32 bindings.',
      devDependencies: ['@biomejs/biome', '@types/bun'],
      name: 'doom-codex',
      path: PACKAGE_JSON_PATH,
      private: true,
      scripts: {
        format: 'bun run tools/format-changed.ts',
        start: 'bun run src/main.ts',
      },
      sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
      type: 'module',
      version: '0.0.0',
    },
    srcMainTs: {
      defaultMapName: 'E1M1',
      defaultScale: 2,
      defaultSkill: 2,
      path: SRC_MAIN_TS_PATH,
      sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    },
    tsconfigJson: {
      include: ['src', 'test', 'tools'],
      path: TSCONFIG_JSON_PATH,
      sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
      strict: true,
      types: ['bun'],
    },
  },
};

describe('01-009 audit missing menu to E1M1 manifest', () => {
  test('locks the manifest schema and exact audit record', async () => {
    const manifest = await readJson<typeof EXPECTED_MANIFEST>(MANIFEST_PATH);

    expect(manifest).toEqual(EXPECTED_MANIFEST);
  });

  test('cross-checks live package and tsconfig command contracts', async () => {
    const packageJson = await readJson<{
      dependencies: Record<string, string>;
      description: string;
      devDependencies: Record<string, string>;
      name: string;
      private: boolean;
      scripts: Record<string, string>;
      type: string;
      version: string;
    }>(PACKAGE_JSON_PATH);
    const tsconfigJson = await readJson<{
      compilerOptions: {
        strict: boolean;
        types: string[];
      };
      include: string[];
    }>(TSCONFIG_JSON_PATH);

    expect(packageJson.name).toBe(EXPECTED_MANIFEST.workspace.packageJson.name);
    expect(packageJson.description).toBe(EXPECTED_MANIFEST.workspace.packageJson.description);
    expect(Object.keys(packageJson.dependencies).sort()).toEqual(EXPECTED_MANIFEST.workspace.packageJson.dependencies);
    expect(Object.keys(packageJson.devDependencies).sort()).toEqual(EXPECTED_MANIFEST.workspace.packageJson.devDependencies);
    expect(packageJson.private).toBe(EXPECTED_MANIFEST.workspace.packageJson.private);
    expect(packageJson.scripts).toEqual(EXPECTED_MANIFEST.workspace.packageJson.scripts);
    expect(packageJson.type).toBe(EXPECTED_MANIFEST.workspace.packageJson.type);
    expect(packageJson.version).toBe(EXPECTED_MANIFEST.workspace.packageJson.version);
    expect(tsconfigJson.compilerOptions.strict).toBe(EXPECTED_MANIFEST.workspace.tsconfigJson.strict);
    expect(tsconfigJson.compilerOptions.types).toEqual(EXPECTED_MANIFEST.workspace.tsconfigJson.types);
    expect(tsconfigJson.include).toEqual(EXPECTED_MANIFEST.workspace.tsconfigJson.include);
  });

  test('cross-checks source hashes against the audited files', async () => {
    expect(await sha256(PACKAGE_JSON_PATH)).toBe(EXPECTED_MANIFEST.workspace.packageJson.sha256);
    expect(await sha256(SRC_MAIN_TS_PATH)).toBe(EXPECTED_MANIFEST.workspace.srcMainTs.sha256);
    expect(await sha256(TSCONFIG_JSON_PATH)).toBe(EXPECTED_MANIFEST.workspace.tsconfigJson.sha256);
  });

  test('locks the gameplay-first transition visible in src/main.ts', async () => {
    const source = await Bun.file(SRC_MAIN_TS_PATH).text();
    const sessionIndex = source.indexOf('const session = createLauncherSession(resources, {');
    const windowIndex = source.indexOf('await runLauncherWindow(session, {');

    expect(source).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(source).toContain('const DEFAULT_SCALE = 2;');
    expect(source).toContain('const DEFAULT_SKILL = 2;');
    expect(source).toContain('The launcher now starts in the gameplay view and can switch to automap on demand.');
    expect(source).toContain("console.log('Opening gameplay window. Use Tab to switch to the automap.');");
    expect(source).toContain('title: `DOOM Codex - ${session.mapName}`');
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(windowIndex).toBeGreaterThan(sessionIndex);
  });

  test('verifies source catalog and fact log evidence', async () => {
    const factLog = await Bun.file(FACT_LOG_PATH).text();
    const sourceCatalog = await Bun.file(SOURCE_CATALOG_PATH).text();

    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` | Bun package and dependency inventory. |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` | Typecheck target for step verification. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
    expect(factLog).toContain('## F-FPS-017');
    expect(factLog).toContain('no menu-to-E1M1 route is exposed');
    expect(factLog).toContain('plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json');
  });
});

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await Bun.file(path).text()) as T;
}

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(await Bun.file(path).arrayBuffer());

  return hasher.digest('hex');
}
