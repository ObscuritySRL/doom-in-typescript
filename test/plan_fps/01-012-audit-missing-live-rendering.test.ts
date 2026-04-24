import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

const MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';

const EXPECTED_MANIFEST = {
  commandContracts: {
    current: {
      entryFile: 'src/main.ts',
      scriptName: 'start',
      scriptValue: 'bun run src/main.ts',
    },
    target: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  currentWorkspace: {
    packageJson: {
      dependencyNames: ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'],
      description: 'Vanilla Doom parity engine built on Bun FFI and @bun-win32 bindings.',
      formatScript: 'bun run tools/format-changed.ts',
      name: 'doom-codex',
      startScript: 'bun run src/main.ts',
      type: 'module',
      version: '0.0.0',
    },
    tsconfigJson: {
      include: ['src', 'test', 'tools'],
      module: 'Preserve',
      noEmit: true,
      strict: true,
      types: ['bun'],
    },
  },
  explicitNullSurfaces: [
    {
      path: null,
      reason: 'No automap renderer implementation path is exposed by the 01-012 read scope; src/main.ts only documents the Tab toggle.',
      surface: 'automap-renderer-implementation',
    },
    {
      path: null,
      reason: 'No framebuffer hash capture path is exposed by the 01-012 read scope.',
      surface: 'framebuffer-hash-capture-hook',
    },
    {
      path: null,
      reason: 'No gameplay renderer invocation path is exposed by the 01-012 read scope; src/main.ts only delegates to runLauncherWindow.',
      surface: 'gameplay-renderer-invocation',
    },
    {
      path: null,
      reason: 'No live framebuffer ownership or pixel buffer path is exposed by the 01-012 read scope.',
      surface: 'live-framebuffer-surface',
    },
    {
      path: null,
      reason: 'No menu overlay composition path is exposed by the 01-012 read scope.',
      surface: 'menu-overlay-composition',
    },
    {
      path: null,
      reason: 'No palette-effect or gamma application path is exposed by the 01-012 read scope.',
      surface: 'palette-and-gamma-application',
    },
    {
      path: null,
      reason: 'No presentation blit implementation path is exposed by the 01-012 read scope.',
      surface: 'presentation-blit-implementation',
    },
    {
      path: null,
      reason: 'No status-bar renderer invocation path is exposed by the 01-012 read scope.',
      surface: 'status-bar-renderer-invocation',
    },
    {
      path: null,
      reason: 'No title-screen renderer path is exposed by the 01-012 read scope.',
      surface: 'title-screen-renderer',
    },
    {
      path: null,
      reason: 'No viewport border renderer path is exposed by the 01-012 read scope.',
      surface: 'viewport-border-renderer',
    },
    {
      path: null,
      reason: 'No wipe transition renderer path is exposed by the 01-012 read scope.',
      surface: 'wipe-transition-renderer',
    },
  ],
  observedRenderingSurfaces: [
    {
      evidenceFragment: "'  Tab: toggle gameplay view and automap',",
      path: 'src/main.ts',
      surface: 'automap-view-toggle-documentation',
    },
    {
      evidenceFragment: "'  The launcher now starts in the gameplay view and can switch to automap on demand.',",
      path: 'src/main.ts',
      surface: 'gameplay-first-render-mode-note',
    },
    {
      evidenceFragment: 'await runLauncherWindow(session, {',
      path: 'src/main.ts',
      surface: 'host-window-rendering-delegation',
    },
    {
      evidenceFragment: "const scale = parseIntegerParameter(commandLine, '--scale', DEFAULT_SCALE);",
      path: 'src/main.ts',
      surface: 'render-scale-parameter',
    },
    {
      evidenceFragment: 'title: `DOOM Codex - ${session.mapName}`,',
      path: 'src/main.ts',
      surface: 'window-title-template',
    },
  ],
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  rationale:
    'The allowed files expose gameplay-first launcher text, a scale parameter, a window title, and the handoff to runLauncherWindow. They do not expose renderer internals, framebuffer hooks, palette/gamma handling, menu composition, status bar rendering, automap rendering, title-screen rendering, wipe transitions, or presentation blit paths.',
  schemaVersion: 1,
  sourceCatalogEvidence: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      kind: 'file',
      path: 'package.json',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      kind: 'file',
      path: 'tsconfig.json',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      kind: 'file',
      path: 'src/main.ts',
    },
  ],
  sourceHashes: [
    {
      algorithm: 'sha256',
      path: 'package.json',
      sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    },
    {
      algorithm: 'sha256',
      path: 'plan_fps/SOURCE_CATALOG.md',
      sha256: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
    },
    {
      algorithm: 'sha256',
      path: 'src/main.ts',
      sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    },
    {
      algorithm: 'sha256',
      path: 'tsconfig.json',
      sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
    },
  ],
};

describe('01-012 audit missing live rendering manifest', () => {
  test('locks the manifest schema and exact audit values', async () => {
    const manifest = await readJsonObject(MANIFEST_PATH);

    expect(manifest).toEqual(EXPECTED_MANIFEST);
  });

  test('cross-checks the live package and TypeScript command contracts', async () => {
    const packageJson = await readJsonObject('package.json');
    const packageScripts = getRecord(packageJson, 'scripts');
    const packageDependencies = getRecord(packageJson, 'dependencies');
    const tsconfigJson = await readJsonObject('tsconfig.json');
    const compilerOptions = getRecord(tsconfigJson, 'compilerOptions');

    expect(getString(packageJson, 'name')).toBe(EXPECTED_MANIFEST.currentWorkspace.packageJson.name);
    expect(getString(packageJson, 'description')).toBe(EXPECTED_MANIFEST.currentWorkspace.packageJson.description);
    expect(getString(packageJson, 'type')).toBe(EXPECTED_MANIFEST.currentWorkspace.packageJson.type);
    expect(getString(packageJson, 'version')).toBe(EXPECTED_MANIFEST.currentWorkspace.packageJson.version);
    expect(getString(packageScripts, 'format')).toBe(EXPECTED_MANIFEST.currentWorkspace.packageJson.formatScript);
    expect(getString(packageScripts, 'start')).toBe(EXPECTED_MANIFEST.commandContracts.current.scriptValue);
    expect(Object.keys(packageDependencies).sort()).toEqual(EXPECTED_MANIFEST.currentWorkspace.packageJson.dependencyNames);
    expect(getString(compilerOptions, 'module')).toBe(EXPECTED_MANIFEST.currentWorkspace.tsconfigJson.module);
    expect(getBoolean(compilerOptions, 'noEmit')).toBe(EXPECTED_MANIFEST.currentWorkspace.tsconfigJson.noEmit);
    expect(getBoolean(compilerOptions, 'strict')).toBe(EXPECTED_MANIFEST.currentWorkspace.tsconfigJson.strict);
    expect(getStringArray(compilerOptions, 'types')).toEqual(EXPECTED_MANIFEST.currentWorkspace.tsconfigJson.types);
    expect(getStringArray(tsconfigJson, 'include')).toEqual(EXPECTED_MANIFEST.currentWorkspace.tsconfigJson.include);
  });

  test('cross-checks source hashes against live files', async () => {
    for (const sourceHash of EXPECTED_MANIFEST.sourceHashes) {
      expect(sourceHash.algorithm).toBe('sha256');
      expect(await hashFile(sourceHash.path)).toBe(sourceHash.sha256);
    }
  });

  test('verifies the visible launcher rendering transition and observed fragments', async () => {
    const mainSource = await Bun.file('src/main.ts').text();
    const orderedTransitionFragments = [
      'const session = createLauncherSession(resources, {',
      'console.log(`Launching ${session.mapName} from ${resources.iwadPath}`);',
      "console.log('Opening gameplay window. Use Tab to switch to the automap.');",
      'await runLauncherWindow(session, {',
      'scale,',
      'title: `DOOM Codex - ${session.mapName}`,',
    ];
    let previousFragmentIndex = -1;

    for (const transitionFragment of orderedTransitionFragments) {
      const fragmentIndex = mainSource.indexOf(transitionFragment);

      expect(fragmentIndex).toBeGreaterThan(previousFragmentIndex);
      previousFragmentIndex = fragmentIndex;
    }

    for (const observedRenderingSurface of EXPECTED_MANIFEST.observedRenderingSurfaces) {
      expect(observedRenderingSurface.path).toBe('src/main.ts');
      expect(mainSource).toContain(observedRenderingSurface.evidenceFragment);
    }
  });

  test('verifies source catalog evidence and explicit null surfaces', async () => {
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();
    const explicitNullSurfaceNames = EXPECTED_MANIFEST.explicitNullSurfaces.map((explicitNullSurface) => explicitNullSurface.surface);

    expect(explicitNullSurfaceNames).toEqual([...explicitNullSurfaceNames].sort());

    for (const sourceCatalogEvidence of EXPECTED_MANIFEST.sourceCatalogEvidence) {
      expect(sourceCatalog).toContain(`| ${sourceCatalogEvidence.id} |`);
      expect(sourceCatalog).toContain(`| ${sourceCatalogEvidence.authority} |`);
      expect(sourceCatalog).toContain(`| ${sourceCatalogEvidence.kind} |`);
      expect(sourceCatalog).toContain(`\`${sourceCatalogEvidence.path}\``);
    }

    for (const explicitNullSurface of EXPECTED_MANIFEST.explicitNullSurfaces) {
      expect(explicitNullSurface.path).toBeNull();
      expect(explicitNullSurface.reason).toContain('01-012 read scope');
    }
  });

  test('verifies the durable fact entry for the rendering audit', async () => {
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();

    expect(factLog).toContain('## F-FPS-020');
    expect(factLog).toContain('Within the 01-012 read scope');
    expect(factLog).toContain('delegation to `runLauncherWindow`');
    expect(factLog).toContain('plan_fps/manifests/01-012-audit-missing-live-rendering.json');
  });
});

async function hashFile(workspacePath: string): Promise<string> {
  const fileBytes = await Bun.file(workspacePath).arrayBuffer();
  const hash = createHash('sha256');

  hash.update(new Uint8Array(fileBytes));

  return hash.digest('hex');
}

function getBoolean(container: Record<string, unknown>, memberName: string): boolean {
  const value = container[memberName];

  if (typeof value !== 'boolean') {
    throw new Error(`${memberName} must be a boolean.`);
  }

  return value;
}

function getRecord(container: Record<string, unknown>, memberName: string): Record<string, unknown> {
  const value = container[memberName];

  if (!isRecord(value)) {
    throw new Error(`${memberName} must be an object.`);
  }

  return value;
}

function getString(container: Record<string, unknown>, memberName: string): string {
  const value = container[memberName];

  if (typeof value !== 'string') {
    throw new Error(`${memberName} must be a string.`);
  }

  return value;
}

function getStringArray(container: Record<string, unknown>, memberName: string): string[] {
  const value = container[memberName];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${memberName} must be a string array.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObject(workspacePath: string): Promise<Record<string, unknown>> {
  const parsedValue: unknown = JSON.parse(await Bun.file(workspacePath).text());

  if (!isRecord(parsedValue)) {
    throw new Error(`${workspacePath} must contain a JSON object.`);
  }

  return parsedValue;
}
