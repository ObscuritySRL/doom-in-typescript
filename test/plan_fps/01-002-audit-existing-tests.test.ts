import { describe, expect, test } from 'bun:test';

const EXPECTED_MANIFEST = {
  auditedScope: {
    allowedReadOnlyFiles: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
    existingTestDirectoryEnumeration: null,
    limitation:
      'The selected step does not permit opening existing test files or enumerating test directories; this manifest records only test surfaces exposed by the allowed files and uses explicit nulls for surfaces not visible in that scope.',
  },
  commandContracts: {
    focusedTestCommand: 'bun test test/plan_fps/01-002-audit-existing-tests.test.ts',
    formatCommand: 'bun run format',
    fullTestCommand: 'bun test',
    runtimeTargetCommand: 'bun run doom.ts',
    startCommand: 'bun run src/main.ts',
    typecheckCommand: 'bun x tsc --noEmit --project tsconfig.json',
  },
  evidencePaths: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  factDependencies: ['F-FPS-005', 'F-FPS-009', 'F-FPS-010'],
  missingTestSurfaces: [
    {
      evidence: 'src/main.ts HELP_TEXT states the launcher starts in gameplay view and can switch to automap.',
      id: 'clean-launch-to-menu-test',
      path: null,
      reason: 'No clean-launch title or menu startup surface is exposed by the current launcher entrypoint.',
      status: 'not-present-in-visible-launcher-surface',
    },
    {
      evidence: 'FACT_LOG.md F-FPS-005 records that the playable parity target still requires a root-level doom.ts command contract.',
      id: 'direct-root-doom-ts-launch-test',
      path: null,
      reason: 'The current package start command targets src/main.ts, not the final root doom.ts command.',
      status: 'not-present-in-visible-command-surface',
    },
    {
      evidence: 'tsconfig.json includes the test root but the selected step read scope does not permit test file enumeration.',
      id: 'existing-test-file-inventory',
      path: null,
      reason: "Existing test files cannot be opened or enumerated within this step's Read Only boundary.",
      status: 'not-visible-in-selected-read-scope',
    },
    {
      evidence: 'src/main.ts defaults directly to E1M1 gameplay resources through DEFAULT_MAP_NAME.',
      id: 'menu-to-e1m1-test',
      path: null,
      reason: 'No visible title/menu route to E1M1 is exposed by the current launcher entrypoint.',
      status: 'not-present-in-visible-launcher-surface',
    },
  ],
  packageJson: {
    description: 'Vanilla Doom parity engine built on Bun FFI and @bun-win32 bindings.',
    hashSha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    hasTestScript: false,
    private: true,
    scripts: {
      format: 'bun run tools/format-changed.ts',
      start: 'bun run src/main.ts',
    },
    testScript: null,
    type: 'module',
  },
  schemaVersion: 1,
  sourceCatalogAuthorities: [
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
  stepId: '01-002',
  stepTitle: 'audit-existing-tests',
  testExecution: {
    configuredRunner: 'bun:test',
    fullSuiteCommand: 'bun test',
    packageScriptTestCommand: null,
    testFilesIncludeRoot: 'test',
  },
  tsconfig: {
    hashSha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
    include: ['src', 'test', 'tools'],
    noEmit: true,
    strict: true,
    types: ['bun'],
  },
  visibleTestSurfaces: [
    {
      command: 'bun test',
      evidence: 'The step verification contract and Bun-only repository rules use bun test as the test runner.',
      id: 'bun-test-runner',
      path: null,
      status: 'configured-command',
    },
    {
      command: 'bun test test/plan_fps/01-002-audit-existing-tests.test.ts',
      evidence: "This step's Test Files section names the focused audit test.",
      id: 'focused-audit-test',
      path: 'test/plan_fps/01-002-audit-existing-tests.test.ts',
      status: 'step-owned-test',
    },
    {
      command: null,
      evidence: 'tsconfig.json includes the test root.',
      id: 'test-include-root',
      path: 'test',
      status: 'configured-include-root',
    },
  ],
};

describe('01-002 audit-existing-tests manifest', () => {
  test('locks the exact audit manifest payload', async () => {
    const manifest: unknown = await Bun.file('plan_fps/manifests/01-002-audit-existing-tests.json').json();

    expect(manifest).toEqual(EXPECTED_MANIFEST);
  });

  test('cross-checks live package and TypeScript test configuration', async () => {
    const packageJson = await readJsonObject('package.json');
    const scripts = getRecordProperty(packageJson, 'scripts');
    const tsconfig = await readJsonObject('tsconfig.json');
    const compilerOptions = getRecordProperty(tsconfig, 'compilerOptions');

    expect(getStringProperty(packageJson, 'description')).toBe(EXPECTED_MANIFEST.packageJson.description);
    expect(await sha256File('package.json')).toBe(EXPECTED_MANIFEST.packageJson.hashSha256);
    expect(getBooleanProperty(packageJson, 'private')).toBe(EXPECTED_MANIFEST.packageJson.private);
    expect(getStringProperty(packageJson, 'type')).toBe(EXPECTED_MANIFEST.packageJson.type);
    expect(scripts).toEqual(EXPECTED_MANIFEST.packageJson.scripts);
    expect(Object.hasOwn(scripts, 'test')).toBe(false);
    expect(await sha256File('tsconfig.json')).toBe(EXPECTED_MANIFEST.tsconfig.hashSha256);
    expect(getArrayProperty(tsconfig, 'include')).toEqual(EXPECTED_MANIFEST.tsconfig.include);
    expect(getBooleanProperty(compilerOptions, 'noEmit')).toBe(EXPECTED_MANIFEST.tsconfig.noEmit);
    expect(getBooleanProperty(compilerOptions, 'strict')).toBe(EXPECTED_MANIFEST.tsconfig.strict);
    expect(getArrayProperty(compilerOptions, 'types')).toEqual(EXPECTED_MANIFEST.tsconfig.types);
  });

  test('cross-checks visible launcher facts that constrain missing test surfaces', async () => {
    const mainSource = await Bun.file('src/main.ts').text();

    expect(await sha256File('src/main.ts')).toBe('019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44');
    expect(mainSource).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(mainSource).toContain('The launcher now starts in the gameplay view and can switch to automap on demand.');
    expect(mainSource).toContain('Opening gameplay window. Use Tab to switch to the automap.');
  });

  test('verifies evidence sources and catalog authorities', async () => {
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    for (const evidencePath of EXPECTED_MANIFEST.evidencePaths) {
      expect(await Bun.file(evidencePath).exists()).toBe(true);
    }

    expect(factLog).toContain('F-FPS-005');
    expect(factLog).toContain('The current package script launches `src/main.ts`');
    expect(factLog).toContain('F-FPS-009');
    expect(factLog).toContain('F-FPS-010');
    expect(factLog).toContain('`tsconfig.json` includes the `test` root');
    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` |');
  });
});

function getArrayProperty(object: Record<string, unknown>, key: string): unknown[] {
  const value = object[key];

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }

  return value;
}

function getBooleanProperty(object: Record<string, unknown>, key: string): boolean {
  const value = object[key];

  if (typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean.`);
  }

  return value;
}

function getRecordProperty(object: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = object[key];

  if (!isRecord(value)) {
    throw new Error(`${key} must be an object.`);
  }

  return value;
}

function getStringProperty(object: Record<string, unknown>, key: string): string {
  const value = object[key];

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const value: unknown = await Bun.file(path).json();

  if (!isRecord(value)) {
    throw new Error(`${path} must contain a JSON object.`);
  }

  return value;
}

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(await Bun.file(path).bytes());

  return hasher.digest('hex');
}
