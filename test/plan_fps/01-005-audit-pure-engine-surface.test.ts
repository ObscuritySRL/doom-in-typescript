import { describe, expect, test } from 'bun:test';

const expectedManifest = {
  auditScope: {
    allowedReadOnlyPaths: ['plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'package.json', 'tsconfig.json', 'src/main.ts'],
    catalogAuthority: 'plan_fps/SOURCE_CATALOG.md',
    limitation: 'This audit can classify only the pure-engine surface visible from src/main.ts and the source catalog; broader src/ enumeration is outside the selected step read scope.',
    selectedSourceEntry: 'src/main.ts',
  },
  commandContracts: {
    currentLauncherCommand: 'bun run src/main.ts',
    currentPackageScript: {
      name: 'start',
      value: 'bun run src/main.ts',
    },
    finalRuntimeCommand: 'bun run doom.ts',
    runtime: 'bun',
  },
  currentLauncher: {
    defaultIwadExpression: '`${REFERENCE_BUNDLE_PATH}\\\\${PRIMARY_TARGET.wadFilename}`',
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    directImports: [
      {
        classification: 'bootstrap-command-line',
        importedNames: ['CommandLine'],
        path: 'src/bootstrap/cmdline.ts',
        sourceSpecifier: './bootstrap/cmdline.ts',
      },
      {
        classification: 'launcher-session',
        importedNames: ['createLauncherSession', 'loadLauncherResources'],
        path: 'src/launcher/session.ts',
        sourceSpecifier: './launcher/session.ts',
      },
      {
        classification: 'win32-host-presentation',
        importedNames: ['runLauncherWindow'],
        path: 'src/launcher/win32.ts',
        sourceSpecifier: './launcher/win32.ts',
      },
      {
        classification: 'reference-policy',
        importedNames: ['REFERENCE_BUNDLE_PATH'],
        path: 'src/reference/policy.ts',
        sourceSpecifier: './reference/policy.ts',
      },
      {
        classification: 'reference-target',
        importedNames: ['PRIMARY_TARGET'],
        path: 'src/reference/target.ts',
        sourceSpecifier: './reference/target.ts',
      },
    ],
    entryPoint: 'src/main.ts',
    helpTextStatesGameplayViewLaunch: true,
    launchesWindowHost: true,
  },
  evidencePaths: ['plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'package.json', 'tsconfig.json', 'src/main.ts'],
  explicitNullSurfaces: [
    {
      evidence: 'The selected step does not allow enumerating src/ beyond src/main.ts.',
      reason: 'No full source-tree read scope is available for this audit.',
      surface: 'broadPureEngineModuleInventory',
      value: null,
    },
    {
      evidence: 'src/main.ts imports launcher, bootstrap, Win32 host, and reference modules only.',
      reason: 'No deterministic tick API is directly exposed by the current launcher entry.',
      surface: 'deterministicTickApi',
      value: null,
    },
    {
      evidence: 'SOURCE_CATALOG.md lists src/main.ts as the current launcher entry, not a pure engine entry.',
      reason: 'No catalog-visible pure engine entry point is available in this step read scope.',
      surface: 'pureEngineEntrypoint',
      value: null,
    },
    {
      evidence: 'src/main.ts wires launcher resources and a window session but no save-state serialization API.',
      reason: 'Save-state serialization is not visible from the current launcher surface.',
      surface: 'saveStateSerializationApi',
      value: null,
    },
    {
      evidence: 'src/main.ts calls runLauncherWindow, which is host presentation, not a side-effect-free renderer API.',
      reason: 'Renderer purity cannot be audited without reading renderer-owned modules.',
      surface: 'sideEffectFreeRendererApi',
      value: null,
    },
    {
      evidence: 'src/main.ts contains no state-hash export, import, or command contract.',
      reason: 'No simulation state hashing API is visible from the current launcher entry.',
      surface: 'simulationStateHashApi',
      value: null,
    },
  ],
  packageJson: {
    name: 'doom-codex',
    private: true,
    scripts: {
      format: 'bun run tools/format-changed.ts',
      start: 'bun run src/main.ts',
    },
    type: 'module',
    version: '0.0.0',
  },
  pureEngineSurface: {
    directPureEngineImportCount: 0,
    directPureEngineImportsFromCurrentLauncher: [],
    explicitNullSurfaceCount: 6,
    visibleBoundary: {
      classification: 'launcher-only-visible',
      reason: 'src/main.ts currently exposes launch, argument parsing, resource loading, and Win32 window presentation; it does not expose a direct pure-engine API in this step read scope.',
    },
  },
  schemaVersion: 1,
  sourceCatalog: {
    hashSha256: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
    pureEngineRowsVisible: [],
    relevantRows: [
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
  },
  srcMain: {
    hashSha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    path: 'src/main.ts',
    usesBunArgv: true,
    usesBunFile: true,
    usesProcessExit: true,
  },
  stepId: '01-005',
  stepTitle: 'audit-pure-engine-surface',
  tsconfigJson: {
    compilerOptionsTypes: ['bun'],
    include: ['src', 'test', 'tools'],
    module: 'Preserve',
    noEmit: true,
    strict: true,
  },
};

const MANIFEST_PATH = 'plan_fps/manifests/01-005-audit-pure-engine-surface.json';

describe('01-005 audit pure engine surface manifest', () => {
  test('locks the exact manifest payload', async () => {
    const manifest = await Bun.file(MANIFEST_PATH).json();

    expect(manifest).toEqual(expectedManifest);
  });

  test('cross-checks live file hashes and Bun command contracts', async () => {
    const manifest = expectRecord(await Bun.file(MANIFEST_PATH).json(), 'manifest');
    const commandContracts = getRecord(manifest, 'commandContracts');
    const packageJson = expectRecord(await Bun.file('package.json').json(), 'package.json');
    const scripts = getRecord(packageJson, 'scripts');
    const srcMain = getRecord(manifest, 'srcMain');
    const sourceCatalog = getRecord(manifest, 'sourceCatalog');
    const tsconfigJson = expectRecord(await Bun.file('tsconfig.json').json(), 'tsconfig.json');
    const compilerOptions = getRecord(tsconfigJson, 'compilerOptions');

    expect(commandContracts.currentLauncherCommand).toBe('bun run src/main.ts');
    expect(commandContracts.finalRuntimeCommand).toBe('bun run doom.ts');
    expect(commandContracts.runtime).toBe('bun');
    expect(scripts.start).toBe(commandContracts.currentLauncherCommand);
    expect(srcMain.hashSha256).toBe(await hashFile('src/main.ts'));
    expect(sourceCatalog.hashSha256).toBe(await hashFile('plan_fps/SOURCE_CATALOG.md'));
    expect(compilerOptions.noEmit).toBe(true);
    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.types).toEqual(['bun']);
  });

  test('cross-checks current launcher imports and defaults', async () => {
    const srcMainText = await Bun.file('src/main.ts').text();
    const importSpecifiers = srcMainText
      .split('\n')
      .filter((line) => line.startsWith('import '))
      .map((line) => {
        const match = line.match(/from '([^']+)';/);

        if (match === null) {
          throw new Error(`Could not parse import line: ${line}`);
        }

        return match[1];
      });
    const expectedImportSpecifiers = expectedManifest.currentLauncher.directImports.map((directImport) => directImport.sourceSpecifier);

    expect(importSpecifiers).toEqual(expectedImportSpecifiers);
    expect(srcMainText).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(srcMainText).toContain('const DEFAULT_SCALE = 2;');
    expect(srcMainText).toContain('const DEFAULT_SKILL = 2;');
    expect(srcMainText).toContain('const commandLine = new CommandLine(Bun.argv);');
    expect(srcMainText).toContain('const localIwad = Bun.file(DEFAULT_LOCAL_IWAD_PATH);');
    expect(srcMainText).toContain('process.exit(1);');
    expect(srcMainText).toContain('The launcher now starts in the gameplay view and can switch to automap on demand.');
    expect(srcMainText).toContain('await runLauncherWindow(session, {');
  });

  test('verifies catalog evidence and explicit null pure-engine surfaces', async () => {
    const manifest = expectRecord(await Bun.file(MANIFEST_PATH).json(), 'manifest');
    const explicitNullSurfaces = getArray(manifest, 'explicitNullSurfaces');
    const pureEngineSurface = getRecord(manifest, 'pureEngineSurface');
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();
    const surfaceNames = explicitNullSurfaces.map((surface) => getString(expectRecord(surface, 'surface'), 'surface'));

    expect(pureEngineSurface.directPureEngineImportCount).toBe(0);
    expect(pureEngineSurface.directPureEngineImportsFromCurrentLauncher).toEqual([]);
    expect(pureEngineSurface.explicitNullSurfaceCount).toBe(explicitNullSurfaces.length);
    expect(surfaceNames).toEqual(['broadPureEngineModuleInventory', 'deterministicTickApi', 'pureEngineEntrypoint', 'saveStateSerializationApi', 'sideEffectFreeRendererApi', 'simulationStateHashApi']);
    expect(surfaceNames).toEqual([...surfaceNames].sort());
    expect(new Set(surfaceNames).size).toBe(surfaceNames.length);

    for (const surface of explicitNullSurfaces) {
      const surfaceRecord = expectRecord(surface, 'explicitNullSurfaces[]');
      expect(surfaceRecord.value).toBeNull();
      expect(typeof surfaceRecord.evidence).toBe('string');
      expect(typeof surfaceRecord.reason).toBe('string');
      expect((surfaceRecord.evidence as string).length).toBeGreaterThan(0);
      expect((surfaceRecord.reason as string).length).toBeGreaterThan(0);
    }

    for (const row of expectedManifest.sourceCatalog.relevantRows) {
      expect(sourceCatalog).toContain(`| ${row.id} | ${row.source} | ${row.kind} | ${row.authority} | \`${row.path}\` |`);
    }
  });

  test('records the durable fact for the read-scope limitation', async () => {
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();

    expect(factLog).toContain('## F-FPS-013');
    expect(factLog).toContain('`src/main.ts` exposes no direct pure-engine entry point or deterministic engine API');
    expect(factLog).toContain('broader pure-engine inventory remains outside the 01-005 read scope');
  });
});

async function hashFile(path: string): Promise<string> {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(path).bytes()).digest('hex');
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }

  return value;
}

function getRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return expectRecord(record[key], key);
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
