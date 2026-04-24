import { describe, expect, test } from 'bun:test';

const expectedManifest = {
  commandContracts: {
    currentPackageScript: {
      entryFile: 'src/main.ts',
      packageScriptName: 'start',
      packageScriptValue: 'bun run src/main.ts',
      runnableCommand: 'bun run start',
    },
    targetRuntime: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  explicitNullSurfaces: [
    {
      path: null,
      reason: 'Within the 01-013 read scope, no allowed source exposes live load-game deserialization, restoration, or post-load state handling.',
      surface: 'live-load-game-roundtrip',
    },
    {
      path: null,
      reason: 'Within the 01-013 read scope, no allowed source exposes live save-game serialization, Bun write behavior, or save confirmation handling.',
      surface: 'live-save-game-roundtrip',
    },
    {
      path: null,
      reason: 'Within the 01-013 read scope, no allowed source exposes a load-game menu, load slot selector, or menu route for loading a saved game.',
      surface: 'load-game-menu-ui',
    },
    {
      path: null,
      reason: 'Within the 01-013 read scope, no allowed source exposes save description text entry, editing, validation, or display.',
      surface: 'save-description-entry',
    },
    {
      path: null,
      reason: 'Within the 01-013 read scope, no allowed source exposes a save-file path policy or local save directory contract.',
      surface: 'save-file-path-policy',
    },
    {
      path: null,
      reason: 'Within the 01-013 read scope, no allowed source exposes a save-game menu, save slot selector, save prompt, or menu route for saving the live game.',
      surface: 'save-slot-menu-ui',
    },
  ],
  observedSurfaces: [
    {
      evidence: 'The help text documents `Tab: toggle gameplay view and automap`, not a save/load route.',
      path: 'src/main.ts',
      surface: 'automap-toggle-help',
    },
    {
      evidence: 'The help text lists movement, running, automap, zoom, follow, and quit controls; it exposes no save or load control.',
      path: 'src/main.ts',
      surface: 'gameplay-control-help',
    },
    {
      evidence: 'The help note says `The launcher now starts in the gameplay view and can switch to automap on demand.`',
      path: 'src/main.ts',
      surface: 'gameplay-first-launch',
    },
    {
      evidence: 'The current launcher calls `const resources = await loadLauncherResources(iwadPath);` before optional map listing.',
      path: 'src/main.ts',
      surface: 'iwad-resource-loading',
    },
    {
      evidence: 'The current launcher calls `const session = createLauncherSession(resources, { mapName, skill, });` after parsing map, scale, and skill.',
      path: 'src/main.ts',
      surface: 'launcher-session-creation',
    },
    {
      evidence: 'The current launcher calls `await runLauncherWindow(session, { scale, title: ... });` after creating the gameplay session.',
      path: 'src/main.ts',
      surface: 'window-launch-call',
    },
  ],
  packageJson: {
    hashSha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    name: 'doom-codex',
    path: 'package.json',
    scripts: {
      format: 'bun run tools/format-changed.ts',
      start: 'bun run src/main.ts',
    },
  },
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  schemaVersion: 1,
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
    'package.json': {
      hashSha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
      path: 'package.json',
    },
    'plan_fps/SOURCE_CATALOG.md': {
      hashSha256: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
      path: 'plan_fps/SOURCE_CATALOG.md',
    },
    'src/main.ts': {
      hashSha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
      path: 'src/main.ts',
    },
    'tsconfig.json': {
      hashSha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
      path: 'tsconfig.json',
    },
  },
  step: {
    id: '01-013',
    prerequisites: ['01-012'],
    title: 'audit-missing-save-load-ui',
  },
  tsconfig: {
    compilerOptions: {
      module: 'Preserve',
      noEmit: true,
      strict: true,
      types: ['bun'],
    },
    hashSha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
    include: ['src', 'test', 'tools'],
    path: 'tsconfig.json',
  },
} satisfies Record<string, unknown>;

describe('01-013 audit missing save/load UI manifest', () => {
  test('locks the exact manifest schema and values', async () => {
    expect(await readJsonRecord('plan_fps/manifests/01-013-audit-missing-save-load-ui.json')).toEqual(expectedManifest);
  });

  test('cross-checks live package and TypeScript command contracts', async () => {
    const packageJson = await readJsonRecord('package.json');
    const packageScripts = requireRecord(packageJson.scripts, 'package.json scripts');
    const typeScriptConfig = await readJsonRecord('tsconfig.json');
    const compilerOptions = requireRecord(typeScriptConfig.compilerOptions, 'tsconfig compilerOptions');

    expect(packageJson.name).toBe('doom-codex');
    expect(packageScripts.format).toBe('bun run tools/format-changed.ts');
    expect(packageScripts.start).toBe('bun run src/main.ts');
    expect(typeScriptConfig.include).toEqual(['src', 'test', 'tools']);
    expect(compilerOptions.module).toBe('Preserve');
    expect(compilerOptions.noEmit).toBe(true);
    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.types).toEqual(['bun']);
  });

  test('recomputes the source hashes locked by the manifest', async () => {
    expect(await sha256Hex('package.json')).toBe('9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe');
    expect(await sha256Hex('plan_fps/SOURCE_CATALOG.md')).toBe('7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c');
    expect(await sha256Hex('src/main.ts')).toBe('019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44');
    expect(await sha256Hex('tsconfig.json')).toBe('49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62');
  });

  test('verifies the visible launcher transition and missing save/load UI evidence', async () => {
    const launcherSource = await Bun.file('src/main.ts').text();

    expect(launcherSource).toContain('const resources = await loadLauncherResources(iwadPath);');
    expect(launcherSource).toContain('const session = createLauncherSession(resources, {');
    expect(launcherSource).toContain('await runLauncherWindow(session, {');
    expect(launcherSource.indexOf('const resources = await loadLauncherResources(iwadPath);')).toBeLessThan(launcherSource.indexOf('const session = createLauncherSession(resources, {'));
    expect(launcherSource.indexOf('const session = createLauncherSession(resources, {')).toBeLessThan(launcherSource.indexOf('await runLauncherWindow(session, {'));
    expect(launcherSource).toContain('  Tab: toggle gameplay view and automap');
    expect(launcherSource).toContain('  Esc: quit');
    expect(launcherSource).not.toContain('save-game');
    expect(launcherSource).not.toContain('save slot');
    expect(launcherSource).not.toContain('--save');
    expect(launcherSource).not.toContain('--load');
  });

  test('verifies sorted explicit nulls, source catalog evidence, and durable fact text', async () => {
    const manifest = await readJsonRecord('plan_fps/manifests/01-013-audit-missing-save-load-ui.json');
    const explicitNullSurfaces = requireArray(manifest.explicitNullSurfaces, 'explicitNullSurfaces');
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();

    expect(explicitNullSurfaces.map((surfaceRecord) => requireString(requireRecord(surfaceRecord, 'explicitNullSurfaces entry').surface, 'explicit null surface'))).toEqual([
      'live-load-game-roundtrip',
      'live-save-game-roundtrip',
      'load-game-menu-ui',
      'save-description-entry',
      'save-file-path-policy',
      'save-slot-menu-ui',
    ]);
    for (const surfaceRecord of explicitNullSurfaces) {
      expect(requireRecord(surfaceRecord, 'explicitNullSurfaces entry').path).toBeNull();
    }
    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` |');
    expect(factLog).toContain('## F-FPS-021');
    expect(factLog).toContain(
      'Within the 01-013 read scope, `src/main.ts` exposes gameplay-first launch and delegates to `runLauncherWindow`, but no save/load menu route, save slot UI, load slot UI, save description entry, save path policy, or live save/load roundtrip surface is exposed.',
    );
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }

  return value;
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value;
}

function requireString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string.`);
  }

  return value;
}

async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await Bun.file(path).text());

  return requireRecord(parsed, path);
}

async function sha256Hex(path: string): Promise<string> {
  const fileBytes = await Bun.file(path).arrayBuffer();
  const hashBytes = await crypto.subtle.digest('SHA-256', fileBytes);

  return Array.from(new Uint8Array(hashBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
