import { describe, expect, test } from 'bun:test';

interface CommandContract {
  entryFile: string;
  helpUsageLines?: string[];
  packageScript?: string;
  packageScriptCommand?: string;
  runtimeCommand?: string;
}

interface ExplicitNullSurface {
  evidencePaths: string[];
  path: null;
  reason: string;
  surface: string;
}

interface JsonPackage {
  dependencies: Record<string, string>;
  description: string;
  devDependencies: Record<string, string>;
  name: string;
  private: boolean;
  scripts: Record<string, string>;
  type: string;
  version: string;
}

interface JsonTypeScriptConfig {
  compilerOptions: {
    noEmit: boolean;
    strict: boolean;
    types: string[];
  };
  include: string[];
}

interface ObservedLaunchSurface {
  evidence: string;
  path: string;
  surface: string;
}

interface SideBySideReplayManifest {
  commandContracts: {
    currentLauncher: CommandContract;
    targetPlayable: CommandContract;
  };
  currentWorkspace: {
    packageJson: JsonPackage;
    tsconfigJson: JsonTypeScriptConfig;
  };
  explicitNullSurfaces: ExplicitNullSurface[];
  observedLaunchSurfaces: ObservedLaunchSurface[];
  rationale: string;
  schemaVersion: number;
  sourceCatalogEvidence: SourceCatalogEvidence[];
  sourceHashes: SourceHash[];
  stepId: string;
  stepTitle: string;
  targetReplayContract: {
    acceptanceMode: string;
    currentVisibility: string;
    requiredCommand: string;
  };
}

interface SourceCatalogEvidence {
  authority: string;
  id: string;
  path: string;
  source: string;
}

interface SourceHash {
  path: string;
  sha256: string;
  sizeBytes: number;
}

const expectedManifest = {
  commandContracts: {
    currentLauncher: {
      entryFile: 'src/main.ts',
      helpUsageLines: ['  bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', '  bun run start -- [--iwad <path-to-iwad>] --list-maps'],
      packageScript: 'start',
      packageScriptCommand: 'bun run src/main.ts',
    },
    targetPlayable: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  currentWorkspace: {
    packageJson: {
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
    },
    tsconfigJson: {
      compilerOptions: {
        noEmit: true,
        strict: true,
        types: ['bun'],
      },
      include: ['src', 'test', 'tools'],
    },
  },
  explicitNullSurfaces: [
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No audio hash comparison surface is exposed in the allowed launch-surface files.',
      surface: 'audio-hash-comparison',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No paired reference and implementation process runner is exposed in the allowed launch-surface files.',
      surface: 'dual-process-reference-and-implementation-runner',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No final side-by-side replay report surface is exposed in the allowed launch-surface files.',
      surface: 'final-side-by-side-report',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No framebuffer hash comparison surface is exposed in the allowed launch-surface files.',
      surface: 'framebuffer-hash-comparison',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No input trace replay loader is exposed in the allowed launch-surface files.',
      surface: 'input-trace-replay-loader',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No reference oracle replay capture surface is exposed in the allowed launch-surface files.',
      surface: 'reference-oracle-replay-capture',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No side-by-side replay command is exposed by package scripts or the current launcher entry.',
      surface: 'side-by-side-replay-command',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No state hash comparison surface is exposed in the allowed launch-surface files.',
      surface: 'state-hash-comparison',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No synchronized tic stepper for side-by-side replay is exposed in the allowed launch-surface files.',
      surface: 'synchronized-tic-stepper',
    },
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No paired video window or frame presentation comparator is exposed in the allowed launch-surface files.',
      surface: 'video-window-pairing',
    },
  ],
  observedLaunchSurfaces: [
    {
      evidence: 'const commandLine = new CommandLine(Bun.argv);',
      path: 'src/main.ts',
      surface: 'bun-argv-command-line',
    },
    {
      evidence: "const DEFAULT_MAP_NAME = 'E1M1';",
      path: 'src/main.ts',
      surface: 'default-gameplay-map',
    },
    {
      evidence: "console.log('Opening gameplay window. Use Tab to switch to the automap.');",
      path: 'src/main.ts',
      surface: 'gameplay-first-console-message',
    },
    {
      evidence: '  The launcher now starts in the gameplay view and can switch to automap on demand.',
      path: 'src/main.ts',
      surface: 'gameplay-first-help-note',
    },
    {
      evidence: 'const session = createLauncherSession(resources, {',
      path: 'src/main.ts',
      surface: 'launcher-session-creation',
    },
    {
      evidence: 'await runLauncherWindow(session, {',
      path: 'src/main.ts',
      surface: 'launcher-window-entry',
    },
    {
      evidence: "if (commandLine.parameterExists('--list-maps')) {",
      path: 'src/main.ts',
      surface: 'list-maps-early-return',
    },
  ],
  rationale:
    'The allowed 01-015 read scope exposes a gameplay-first Bun launcher, list-maps path, and Win32 window delegation, but no side-by-side replay command, synchronized replay runner, input trace loader, reference capture bridge, or frame/state/audio comparison report.',
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
  sourceHashes: [
    {
      path: 'package.json',
      sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
      sizeBytes: 569,
    },
    {
      path: 'src/main.ts',
      sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
      sizeBytes: 3239,
    },
    {
      path: 'tsconfig.json',
      sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
      sizeBytes: 645,
    },
  ],
  stepId: '01-015',
  stepTitle: 'audit-missing-side-by-side-replay',
  targetReplayContract: {
    acceptanceMode: 'side-by-side-verifiable replay parity',
    currentVisibility: 'missing in allowed launch-surface files',
    requiredCommand: 'bun run doom.ts',
  },
} satisfies SideBySideReplayManifest;

const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';

async function readJsonFile<T>(path: string): Promise<T> {
  const parsedValue: T = JSON.parse(await Bun.file(path).text());
  return parsedValue;
}

async function sha256Hex(path: string): Promise<string> {
  const fileBytes = await Bun.file(path).arrayBuffer();
  const hashBytes = await crypto.subtle.digest('SHA-256', fileBytes);

  return Array.from(new Uint8Array(hashBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('01-015 audit-missing-side-by-side-replay manifest', () => {
  test('locks the manifest as an exact machine-readable audit artifact', async () => {
    const manifest = await readJsonFile<SideBySideReplayManifest>(manifestPath);

    expect(manifest).toEqual(expectedManifest);
  });

  test('cross-checks live command contracts and workspace settings', async () => {
    const packageJson = await readJsonFile<JsonPackage>('package.json');
    const typeScriptConfig = await readJsonFile<JsonTypeScriptConfig>('tsconfig.json');

    expect(packageJson).toEqual(expectedManifest.currentWorkspace.packageJson);
    expect(typeScriptConfig.compilerOptions.noEmit).toBe(expectedManifest.currentWorkspace.tsconfigJson.compilerOptions.noEmit);
    expect(typeScriptConfig.compilerOptions.strict).toBe(expectedManifest.currentWorkspace.tsconfigJson.compilerOptions.strict);
    expect(typeScriptConfig.compilerOptions.types).toEqual(expectedManifest.currentWorkspace.tsconfigJson.compilerOptions.types);
    expect(typeScriptConfig.include).toEqual(expectedManifest.currentWorkspace.tsconfigJson.include);
    expect(packageJson.scripts.start).toBe(expectedManifest.commandContracts.currentLauncher.packageScriptCommand);
    expect(expectedManifest.commandContracts.targetPlayable.runtimeCommand).toBe('bun run doom.ts');
  });

  test('recomputes source hashes with Bun file reads', async () => {
    for (const sourceHash of expectedManifest.sourceHashes) {
      const fileBytes = await Bun.file(sourceHash.path).arrayBuffer();

      expect(await sha256Hex(sourceHash.path)).toBe(sourceHash.sha256);
      expect(fileBytes.byteLength).toBe(sourceHash.sizeBytes);
    }
  });

  test('verifies the visible launcher transition and replay-surface absence evidence', async () => {
    const mainSource = await Bun.file('src/main.ts').text();

    for (const observedLaunchSurface of expectedManifest.observedLaunchSurfaces) {
      expect(mainSource).toContain(observedLaunchSurface.evidence);
    }

    expect(mainSource.indexOf("if (commandLine.parameterExists('--list-maps')) {")).toBeLessThan(mainSource.indexOf('const session = createLauncherSession(resources, {'));
    expect(mainSource.indexOf('const session = createLauncherSession(resources, {')).toBeLessThan(mainSource.indexOf('await runLauncherWindow(session, {'));
    expect(mainSource).not.toContain('side-by-side');
    expect(mainSource).not.toContain('replay');
    expect(mainSource).not.toContain('hash comparison');
  });

  test('keeps missing side-by-side replay surfaces explicit and sorted', async () => {
    const manifest = await readJsonFile<SideBySideReplayManifest>(manifestPath);
    const surfaces = manifest.explicitNullSurfaces.map((explicitNullSurface) => explicitNullSurface.surface);
    const sortedSurfaces = [...surfaces].sort();

    expect(surfaces).toEqual(sortedSurfaces);
    expect(new Set(surfaces).size).toBe(surfaces.length);
    expect(manifest.explicitNullSurfaces.length).toBe(expectedManifest.explicitNullSurfaces.length);

    for (const explicitNullSurface of manifest.explicitNullSurfaces) {
      expect(explicitNullSurface.path).toBeNull();
      expect(explicitNullSurface.evidencePaths).toEqual(['package.json', 'tsconfig.json', 'src/main.ts']);
      expect(explicitNullSurface.reason).toContain('No ');
    }
  });

  test('locks the help usage lines verbatim against the live launcher source', async () => {
    const mainSource = await Bun.file('src/main.ts').text();
    const { helpUsageLines } = expectedManifest.commandContracts.currentLauncher;

    expect(helpUsageLines).toBeDefined();
    expect((helpUsageLines ?? []).length).toBeGreaterThan(0);

    for (const helpUsageLine of helpUsageLines ?? []) {
      expect(mainSource).toContain(helpUsageLine);
    }
  });

  test('keeps the target replay contract aligned with the playable runtime command', async () => {
    const manifest = await readJsonFile<SideBySideReplayManifest>(manifestPath);
    const targetRuntimeCommand = manifest.commandContracts.targetPlayable.runtimeCommand;

    expect(typeof targetRuntimeCommand).toBe('string');
    expect(manifest.targetReplayContract.requiredCommand).toBe(targetRuntimeCommand ?? '');
    expect(manifest.targetReplayContract.requiredCommand).toBe(expectedManifest.targetReplayContract.requiredCommand);
    expect(manifest.commandContracts.targetPlayable.entryFile).toBe('doom.ts');
    expect(manifest.commandContracts.currentLauncher.entryFile).toBe('src/main.ts');
    expect(manifest.observedLaunchSurfaces.length).toBe(expectedManifest.observedLaunchSurfaces.length);
  });

  test('verifies source-catalog and fact-log evidence', async () => {
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    for (const sourceCatalogEvidence of expectedManifest.sourceCatalogEvidence) {
      expect(sourceCatalog).toContain(sourceCatalogEvidence.id);
      expect(sourceCatalog).toContain(`\`${sourceCatalogEvidence.path}\``);
      expect(sourceCatalog).toContain(sourceCatalogEvidence.source);
    }

    expect(factLog).toContain('## F-FPS-023');
    expect(factLog).toContain('no side-by-side replay command');
    expect(factLog).toContain('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json');
  });
});
