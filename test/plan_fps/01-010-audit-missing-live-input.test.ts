import { describe, expect, test } from 'bun:test';

interface AuditManifest {
  commandContracts: {
    current: {
      entryPoint: string;
      scriptName: string;
      scriptValue: string;
    };
    target: {
      entryPoint: string;
      runtimeCommand: string;
    };
  };
  currentLauncher: {
    defaultMapName: string;
    defaultScale: number;
    defaultSkill: number;
    helpTextLaunchMode: string;
    launchTransition: {
      consoleMessages: string[];
      orderedSteps: string[];
      terminalCall: string;
    };
  };
  documentedInputControls: {
    action: string;
    control: string;
    sourceOrder: number;
  }[];
  evidencePaths: string[];
  explicitNullSurfaces: {
    evidence: string;
    path: null;
    reason: string;
    surface: string;
    symbol: null;
  }[];
  importedModules: {
    importedSymbols: string[];
    modulePath: string;
  }[];
  readScope: string[];
  schemaVersion: number;
  sourceCatalogRows: {
    authority: string;
    id: string;
    kind: string;
    notes: string;
    path: string;
    source: string;
  }[];
  sourceHashes: Record<string, string>;
  stepId: string;
  stepTitle: string;
}

interface PackageJson {
  scripts: Record<string, string>;
}

const expectedManifest: AuditManifest = {
  commandContracts: {
    current: {
      entryPoint: 'src/main.ts',
      scriptName: 'start',
      scriptValue: 'bun run src/main.ts',
    },
    target: {
      entryPoint: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  currentLauncher: {
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    helpTextLaunchMode: 'The launcher now starts in the gameplay view and can switch to automap on demand.',
    launchTransition: {
      consoleMessages: ['Launching ${session.mapName} from ${resources.iwadPath}', 'Opening gameplay window. Use Tab to switch to the automap.'],
      orderedSteps: ['new CommandLine(Bun.argv)', 'resolveDefaultIwadPath', 'loadLauncherResources', 'createLauncherSession', 'runLauncherWindow'],
      terminalCall: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    },
  },
  documentedInputControls: [
    {
      action: 'turn left or right',
      control: 'A/D or Left/Right',
      sourceOrder: 2,
    },
    {
      action: 'quit',
      control: 'Esc',
      sourceOrder: 8,
    },
    {
      action: 'toggle automap follow',
      control: 'F',
      sourceOrder: 7,
    },
    {
      action: 'zoom the automap',
      control: 'PageUp/PageDown',
      sourceOrder: 6,
    },
    {
      action: 'strafe left or right',
      control: 'Q/E',
      sourceOrder: 3,
    },
    {
      action: 'run',
      control: 'Shift',
      sourceOrder: 4,
    },
    {
      action: 'toggle gameplay view and automap',
      control: 'Tab',
      sourceOrder: 5,
    },
    {
      action: 'move forward or backward',
      control: 'W/S or Up/Down',
      sourceOrder: 1,
    },
  ],
  evidencePaths: ['package.json', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  explicitNullSurfaces: [
    {
      evidence: 'src/main.ts creates a launcher session and delegates to runLauncherWindow without exposing a gameplay input router.',
      path: null,
      reason: 'No gameplay command routing surface is visible within the 01-010 read scope.',
      surface: 'gameplay-command-routing',
      symbol: null,
    },
    {
      evidence: 'src/main.ts imports CommandLine for CLI parsing only and contains no keyboard or mouse event source.',
      path: null,
      reason: 'No live keyboard or mouse event source is visible within the 01-010 read scope.',
      surface: 'input-event-source',
      symbol: null,
    },
    {
      evidence: 'src/main.ts exposes no file, stream, or recorder for input events.',
      path: null,
      reason: 'No live input trace recording surface is visible within the 01-010 read scope.',
      surface: 'input-trace-recording',
      symbol: null,
    },
    {
      evidence: 'src/main.ts HELP_TEXT documents control labels but defines no Doom key mapping table.',
      path: null,
      reason: 'No key translation table is visible within the 01-010 read scope.',
      surface: 'key-translation-table',
      symbol: null,
    },
    {
      evidence: 'src/main.ts awaits runLauncherWindow(session, ...) as the terminal window call.',
      path: null,
      reason: 'No live input event loop implementation is visible within the 01-010 read scope.',
      surface: 'live-input-event-loop',
      symbol: null,
    },
    {
      evidence: 'src/main.ts starts in gameplay view and contains no menu-first input path.',
      path: null,
      reason: 'No menu input routing surface is visible within the 01-010 read scope.',
      surface: 'menu-input-routing',
      symbol: null,
    },
    {
      evidence: 'src/main.ts HELP_TEXT documents movement, automap, and quit controls but no capture policy.',
      path: null,
      reason: 'No mouse capture or release policy is visible within the 01-010 read scope.',
      surface: 'mouse-capture-policy',
      symbol: null,
    },
    {
      evidence: 'src/main.ts passes a session to runLauncherWindow and does not expose per-tic input state accumulation.',
      path: null,
      reason: 'No per-tic input accumulation surface is visible within the 01-010 read scope.',
      surface: 'per-tic-input-accumulation',
      symbol: null,
    },
  ],
  importedModules: [
    {
      importedSymbols: ['CommandLine'],
      modulePath: './bootstrap/cmdline.ts',
    },
    {
      importedSymbols: ['createLauncherSession', 'loadLauncherResources'],
      modulePath: './launcher/session.ts',
    },
    {
      importedSymbols: ['runLauncherWindow'],
      modulePath: './launcher/win32.ts',
    },
    {
      importedSymbols: ['REFERENCE_BUNDLE_PATH'],
      modulePath: './reference/policy.ts',
    },
    {
      importedSymbols: ['PRIMARY_TARGET'],
      modulePath: './reference/target.ts',
    },
  ],
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  schemaVersion: 1,
  sourceCatalogRows: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      kind: 'file',
      notes: 'Bun package and dependency inventory.',
      path: 'package.json',
      source: 'package manifest',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      kind: 'file',
      notes: 'Typecheck target for step verification.',
      path: 'tsconfig.json',
      source: 'TypeScript config',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      kind: 'file',
      notes: 'Current launcher surface, not the final requested `doom.ts` command.',
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
  stepId: '01-010',
  stepTitle: 'audit-missing-live-input',
};

async function readAuditManifest(): Promise<AuditManifest> {
  const manifest: AuditManifest = await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').json();

  return manifest;
}

async function readPackageJson(): Promise<PackageJson> {
  const packageJson: PackageJson = await Bun.file('package.json').json();

  return packageJson;
}

async function sha256FileHex(path: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(path).arrayBuffer());
  const bytes = new Uint8Array(digest);
  const parts: string[] = [];

  for (const byte of bytes) {
    parts.push(byte.toString(16).padStart(2, '0'));
  }

  return parts.join('');
}

describe('01-010 audit missing live input manifest', () => {
  test('locks the exact manifest schema and audit values', async () => {
    await expect(readAuditManifest()).resolves.toEqual(expectedManifest);
  });

  test('cross-checks command contracts against the live package manifest', async () => {
    const manifest = await readAuditManifest();
    const packageJson = await readPackageJson();

    expect(packageJson.scripts[manifest.commandContracts.current.scriptName]).toBe(manifest.commandContracts.current.scriptValue);
    expect(manifest.commandContracts.current.entryPoint).toBe('src/main.ts');
    expect(manifest.commandContracts.target.runtimeCommand).toBe('bun run doom.ts');
  });

  test('cross-checks source hashes against current readable evidence files', async () => {
    const manifest = await readAuditManifest();

    for (const evidencePath of manifest.evidencePaths) {
      expect(await sha256FileHex(evidencePath)).toBe(manifest.sourceHashes[evidencePath]);
    }
  });

  test('verifies the launcher transition delegates to the window host after gameplay session creation', async () => {
    const manifest = await readAuditManifest();
    const mainSource = await Bun.file('src/main.ts').text();

    expect(mainSource).toContain('const commandLine = new CommandLine(Bun.argv);');
    expect(mainSource.indexOf('const session = createLauncherSession(resources, {')).toBeLessThan(mainSource.indexOf('await runLauncherWindow(session, {'));
    expect(mainSource).toContain("console.log('Opening gameplay window. Use Tab to switch to the automap.');");
    expect(mainSource).toContain("'  The launcher now starts in the gameplay view and can switch to automap on demand.',");
    expect(manifest.currentLauncher.launchTransition.orderedSteps).toEqual(['new CommandLine(Bun.argv)', 'resolveDefaultIwadPath', 'loadLauncherResources', 'createLauncherSession', 'runLauncherWindow']);
  });

  test('verifies documented controls and explicit null live-input surfaces', async () => {
    const manifest = await readAuditManifest();
    const mainSource = await Bun.file('src/main.ts').text();
    const surfaceNames = manifest.explicitNullSurfaces.map((surface) => surface.surface);

    expect(manifest.documentedInputControls.map((control) => control.control)).toEqual(['A/D or Left/Right', 'Esc', 'F', 'PageUp/PageDown', 'Q/E', 'Shift', 'Tab', 'W/S or Up/Down']);

    for (const documentedControl of manifest.documentedInputControls) {
      expect(mainSource).toContain(documentedControl.control);
    }

    expect(surfaceNames).toEqual([...surfaceNames].sort());

    for (const explicitNullSurface of manifest.explicitNullSurfaces) {
      expect(explicitNullSurface.path).toBeNull();
      expect(explicitNullSurface.symbol).toBeNull();
      expect(explicitNullSurface.reason).toContain('01-010 read scope');
    }
  });

  test('verifies source catalog and fact log evidence for the audit finding', async () => {
    const manifest = await readAuditManifest();
    const factLog = await Bun.file('plan_fps/FACT_LOG.md').text();
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    expect(manifest.sourceCatalogRows).toEqual([
      {
        authority: 'local-primary',
        id: 'S-FPS-009',
        kind: 'file',
        notes: 'Bun package and dependency inventory.',
        path: 'package.json',
        source: 'package manifest',
      },
      {
        authority: 'local-primary',
        id: 'S-FPS-010',
        kind: 'file',
        notes: 'Typecheck target for step verification.',
        path: 'tsconfig.json',
        source: 'TypeScript config',
      },
      {
        authority: 'local-primary',
        id: 'S-FPS-011',
        kind: 'file',
        notes: 'Current launcher surface, not the final requested `doom.ts` command.',
        path: 'src/main.ts',
        source: 'current launcher entry',
      },
    ]);

    for (const catalogRow of manifest.sourceCatalogRows) {
      expect(sourceCatalog).toContain(`| ${catalogRow.id} | ${catalogRow.source} | ${catalogRow.kind} | ${catalogRow.authority} | \`${catalogRow.path}\` | ${catalogRow.notes} |`);
    }

    expect(factLog).toContain('## F-FPS-018');
    expect(factLog).toContain('no live keyboard/mouse event source, key translation table, gameplay input router, menu input router, mouse capture policy, input trace recorder, or per-tic input accumulator is exposed');
  });
});
