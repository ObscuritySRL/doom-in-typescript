import { describe, expect, test } from 'bun:test';

interface ConfigPersistenceManifest {
  currentCommandContract: {
    entryFile: string;
    matchesTargetCommand: boolean;
    program: string;
    scriptName: string;
    scriptValue: string;
    subcommand: string;
  };
  currentLaunchSurface: {
    configurationFileTokensAbsent: string[];
    documentedOptions: string[];
    observedLauncherTransition: string[];
    transientDefaults: Array<
      | {
          name: string;
          sourceExpression: string;
        }
      | {
          name: string;
          value: number | string;
        }
    >;
    visibleConfigPersistenceSurface: null;
  };
  evidencePaths: string[];
  explicitNullSurfaces: Array<{
    reason: string;
    surface: string;
    visiblePath: null;
  }>;
  observedConfigAdjacentSurfaces: Array<{
    description: string;
    sourcePath: string;
    surface: string;
  }>;
  packageJson: {
    dependencies: string[];
    formatScript: string;
    name: string;
    startScript: string;
    type: string;
  };
  readScope: {
    allowedFiles: string[];
    limitation: string;
    selectedStepFile: string;
  };
  schemaVersion: number;
  sourceCatalogRows: Array<{
    authority: string;
    catalogIdentifier: string;
    path: string;
    source: string;
  }>;
  sourceHashes: Array<{
    path: string;
    sha256: string;
  }>;
  stepId: string;
  stepTitle: string;
  targetCommandContract: {
    entryFile: string;
    program: string;
    subcommand: string;
    targetCommand: string;
  };
  tsconfig: {
    include: string[];
    module: string;
    noEmit: boolean;
    strict: boolean;
    types: string[];
  };
}

interface PackageManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  name: string;
  private: boolean;
  scripts: Record<string, string>;
  type: string;
  version: string;
}

interface TypeScriptConfig {
  compilerOptions: {
    module: string;
    noEmit: boolean;
    strict: boolean;
    types: string[];
  };
  include: string[];
}

const expectedManifest: ConfigPersistenceManifest = {
  currentCommandContract: {
    entryFile: 'src/main.ts',
    matchesTargetCommand: false,
    program: 'bun',
    scriptName: 'start',
    scriptValue: 'bun run src/main.ts',
    subcommand: 'run',
  },
  currentLaunchSurface: {
    configurationFileTokensAbsent: ['chocolate-doom.cfg', 'default.cfg'],
    documentedOptions: ['--help', '--iwad', '--list-maps', '--map', '--scale', '--skill'],
    observedLauncherTransition: [
      'new CommandLine(Bun.argv)',
      "commandLine.getParameter('--iwad') ?? (await resolveDefaultIwadPath())",
      'loadLauncherResources(iwadPath)',
      'createLauncherSession(resources, {',
      'runLauncherWindow(session, {',
    ],
    transientDefaults: [
      {
        name: 'DEFAULT_LOCAL_IWAD_PATH',
        sourceExpression: '`${REFERENCE_BUNDLE_PATH}\\\\${PRIMARY_TARGET.wadFilename}`',
      },
      {
        name: 'DEFAULT_MAP_NAME',
        value: 'E1M1',
      },
      {
        name: 'DEFAULT_SCALE',
        value: 2,
      },
      {
        name: 'DEFAULT_SKILL',
        value: 2,
      },
    ],
    visibleConfigPersistenceSurface: null,
  },
  evidencePaths: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'plan_fps/steps/01-014-audit-missing-config-persistence.md', 'src/main.ts', 'tsconfig.json'],
  explicitNullSurfaces: [
    {
      reason: 'No allowed file exposes a persisted config path policy.',
      surface: 'configFilePathPolicy',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes a config file load path or parser.',
      surface: 'configFileRead',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes a config schema or typed config contract.',
      surface: 'configFileSchema',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes a config writeback path.',
      surface: 'configFileWrite',
      visiblePath: null,
    },
    {
      reason: 'No allowed file bridges default.cfg into runtime settings.',
      surface: 'defaultCfgCompatibility',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes persisted key binding settings.',
      surface: 'keyBindingPersistence',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes test isolation for user-local config.',
      surface: 'localConfigTestIsolation',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes persisted mouse settings.',
      surface: 'mouseSettingsPersistence',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes persisted screen settings.',
      surface: 'screenSettingsPersistence',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes persisted sound settings.',
      surface: 'soundSettingsPersistence',
      visiblePath: null,
    },
    {
      reason: 'No allowed file exposes persisted vanilla compatibility flags.',
      surface: 'vanillaCompatibilityFlags',
      visiblePath: null,
    },
  ],
  observedConfigAdjacentSurfaces: [
    {
      description: 'Transient command-line IWAD path override only; no persisted storage path is exposed.',
      sourcePath: 'src/main.ts',
      surface: 'cliIwadPathOverride',
    },
    {
      description: 'Transient command-line map override only; no persisted map preference is exposed.',
      sourcePath: 'src/main.ts',
      surface: 'cliMapOverride',
    },
    {
      description: 'Transient command-line scale override passed to runLauncherWindow; no persisted screen scale setting is exposed.',
      sourcePath: 'src/main.ts',
      surface: 'cliScaleOverride',
    },
    {
      description: 'Transient command-line skill override only; no persisted gameplay setting is exposed.',
      sourcePath: 'src/main.ts',
      surface: 'cliSkillOverride',
    },
    {
      description: 'Bun.file checks the default IWAD path; this is data discovery, not config persistence.',
      sourcePath: 'src/main.ts',
      surface: 'defaultIwadProbe',
    },
    {
      description: 'The scale value is passed to the window host for the current launch only.',
      sourcePath: 'src/main.ts',
      surface: 'gameplayWindowScaleOption',
    },
  ],
  packageJson: {
    dependencies: ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'],
    formatScript: 'bun run tools/format-changed.ts',
    name: 'doom-codex',
    startScript: 'bun run src/main.ts',
    type: 'module',
  },
  readScope: {
    allowedFiles: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
    limitation: 'The selected step did not permit opening config, launcher, host, menu, input, save, or persistence implementation files beyond src/main.ts.',
    selectedStepFile: 'plan_fps/steps/01-014-audit-missing-config-persistence.md',
  },
  schemaVersion: 1,
  sourceCatalogRows: [
    {
      authority: 'local-primary',
      catalogIdentifier: 'S-FPS-009',
      path: 'package.json',
      source: 'package manifest',
    },
    {
      authority: 'local-primary',
      catalogIdentifier: 'S-FPS-010',
      path: 'tsconfig.json',
      source: 'TypeScript config',
    },
    {
      authority: 'local-primary',
      catalogIdentifier: 'S-FPS-011',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  sourceHashes: [
    {
      path: 'package.json',
      sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    },
    {
      path: 'plan_fps/SOURCE_CATALOG.md',
      sha256: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
    },
    {
      path: 'src/main.ts',
      sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    },
    {
      path: 'tsconfig.json',
      sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
    },
  ],
  stepId: '01-014',
  stepTitle: 'audit-missing-config-persistence',
  targetCommandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    targetCommand: 'bun run doom.ts',
  },
  tsconfig: {
    include: ['src', 'test', 'tools'],
    module: 'Preserve',
    noEmit: true,
    strict: true,
    types: ['bun'],
  },
};

async function computeSha256(path: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(bytes);

  return hasher.digest('hex');
}

describe('01-014 audit missing config persistence manifest', () => {
  test('locks the exact machine-readable manifest', async () => {
    const manifest: ConfigPersistenceManifest = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').json();

    expect(manifest).toEqual(expectedManifest);
  });

  test('recomputes source hashes from the allowed read scope', async () => {
    for (const sourceHash of expectedManifest.sourceHashes) {
      expect(await computeSha256(sourceHash.path)).toBe(sourceHash.sha256);
    }
  });

  test('cross-checks the live package and TypeScript command contracts', async () => {
    const packageManifest: PackageManifest = await Bun.file('package.json').json();
    const typeScriptConfig: TypeScriptConfig = await Bun.file('tsconfig.json').json();

    expect(packageManifest.name).toBe(expectedManifest.packageJson.name);
    expect(packageManifest.scripts.format).toBe(expectedManifest.packageJson.formatScript);
    expect(packageManifest.scripts.start).toBe(expectedManifest.currentCommandContract.scriptValue);
    expect(packageManifest.scripts.start).not.toBe(expectedManifest.targetCommandContract.targetCommand);
    expect(Object.keys(packageManifest.dependencies)).toEqual(expectedManifest.packageJson.dependencies);
    expect(packageManifest.type).toBe(expectedManifest.packageJson.type);

    expect(typeScriptConfig.compilerOptions.module).toBe(expectedManifest.tsconfig.module);
    expect(typeScriptConfig.compilerOptions.noEmit).toBe(expectedManifest.tsconfig.noEmit);
    expect(typeScriptConfig.compilerOptions.strict).toBe(expectedManifest.tsconfig.strict);
    expect(typeScriptConfig.compilerOptions.types).toEqual(expectedManifest.tsconfig.types);
    expect(typeScriptConfig.include).toEqual(expectedManifest.tsconfig.include);
  });

  test('locks the visible launcher transition and transient config-adjacent options', async () => {
    const sourceText = await Bun.file('src/main.ts').text();
    let previousIndex = -1;

    for (const transitionFragment of expectedManifest.currentLaunchSurface.observedLauncherTransition) {
      const transitionIndex = sourceText.indexOf(transitionFragment);

      expect(transitionIndex).toBeGreaterThan(previousIndex);
      previousIndex = transitionIndex;
    }

    for (const optionName of expectedManifest.currentLaunchSurface.documentedOptions) {
      expect(sourceText).toContain(optionName);
    }

    expect(sourceText).toContain("commandLine.getParameter('--map') ?? DEFAULT_MAP_NAME");
    expect(sourceText).toContain("parseIntegerParameter(commandLine, '--scale', DEFAULT_SCALE)");
    expect(sourceText).toContain("parseIntegerParameter(commandLine, '--skill', DEFAULT_SKILL)");
    expect(sourceText).toContain('const localIwad = Bun.file(DEFAULT_LOCAL_IWAD_PATH);');
  });

  test('locks explicit nulls for missing config persistence surfaces', async () => {
    const manifest: ConfigPersistenceManifest = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').json();
    const sourceText = await Bun.file('src/main.ts').text();
    const surfaceNames = manifest.explicitNullSurfaces.map((surface) => surface.surface);

    expect(surfaceNames).toEqual([...surfaceNames].sort());

    for (const nullSurface of manifest.explicitNullSurfaces) {
      expect(nullSurface.visiblePath).toBeNull();
      expect(nullSurface.reason.length).toBeGreaterThan(20);
    }

    for (const absentToken of ['Bun.write', 'chocolate-doom.cfg', 'default.cfg', 'keyBindings', 'loadConfig', 'saveConfig']) {
      expect(sourceText).not.toContain(absentToken);
    }
  });

  test('verifies source catalog, evidence paths, and fact-log evidence', async () => {
    const sourceCatalogText = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();
    const factLogText = await Bun.file('plan_fps/FACT_LOG.md').text();

    for (const evidencePath of expectedManifest.evidencePaths) {
      expect(await Bun.file(evidencePath).exists()).toBe(true);
    }

    for (const sourceCatalogRow of expectedManifest.sourceCatalogRows) {
      expect(sourceCatalogText).toContain(sourceCatalogRow.catalogIdentifier);
      expect(sourceCatalogText).toContain(`\`${sourceCatalogRow.path}\``);
      expect(sourceCatalogText).toContain(sourceCatalogRow.source);
    }

    expect(factLogText).toContain('## F-FPS-022');
    expect(factLogText).toContain('exposes transient command-line values for IWAD, map, skill, and scale');
    expect(factLogText).toContain('no config file read/write path');
  });
});
