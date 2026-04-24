import { expect, test } from 'bun:test';

type CommandContracts = {
  currentLauncher: {
    entryFile: string;
    helpUsageLines: string[];
    packageScript: string;
    packageScriptCommand: string;
  };
  targetPlayable: {
    entryFile: string;
    runtimeCommand: string;
  };
};

type InitialTitleFrameFixture = {
  captureCommand: {
    arguments: string[];
    mode: string;
    program: string;
    workingDirectory: string;
  };
  captureWindow: {
    endFrame: number;
    endTic: number;
    frameName: string;
    startFrame: number;
    startTic: number;
  };
  commandContracts: CommandContracts;
  expectedFrame: {
    framebufferSha256: null | string;
    framebufferSha256Status: string;
    frameIndex: number;
    surface: string;
    tic: number;
    traceSha256: string;
  };
  expectedTrace: TraceEvent[];
  expectedTraceHash: string;
  manifestEvidence: {
    allowedReadScopeManifest: string;
    observedLaunchSurfaces: string[];
    relevantExplicitNullSurfaces: string[];
    sourceHashes: SourceHash[];
  };
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  stepId: string;
  stepTitle: string;
};

type SideBySideManifest = {
  commandContracts: CommandContracts;
  explicitNullSurfaces: { surface: string }[];
  observedLaunchSurfaces: { surface: string }[];
  schemaVersion: number;
  sourceHashes: SourceHash[];
  stepId: string;
  targetReplayContract: {
    requiredCommand: string;
  };
};

type SourceAuthority = {
  authority: string;
  path: string;
  role: string;
  sourceCatalogId: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type TraceEvent = {
  arguments?: string[];
  authority?: string;
  event: string;
  frameIndex?: number;
  manifestPath?: string;
  ordinal: number;
  path?: string;
  program?: string;
  reason?: string;
  sourceCatalogId?: string;
  status?: string;
  targetSurface?: string;
  tic?: number;
  workingDirectory?: string;
};

const fixturePath = 'test/oracles/fixtures/capture-initial-title-frame.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD'],
    mode: 'reference-initial-title-frame-capture',
    program: 'doom/DOOMD.EXE',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 0,
    endTic: 0,
    frameName: 'initial-title-frame',
    startFrame: 0,
    startTic: 0,
  },
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
  expectedFrame: {
    framebufferSha256: null,
    framebufferSha256Status: 'pending-live-reference-capture',
    frameIndex: 0,
    surface: 'title-screen',
    tic: 0,
    traceSha256: '68f6f03a34995d715382a2fdfed8fa37b42c45d6cabbf4d02ca555717dc966ec',
  },
  expectedTrace: [
    {
      authority: 'local-primary-binary',
      event: 'select-local-dos-binary',
      ordinal: 1,
      path: 'doom/DOOMD.EXE',
      sourceCatalogId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      event: 'select-local-iwad',
      ordinal: 2,
      path: 'doom/DOOM1.WAD',
      sourceCatalogId: 'S-FPS-006',
    },
    {
      arguments: ['-iwad', 'doom/DOOM1.WAD'],
      event: 'prepare-reference-command',
      ordinal: 3,
      program: 'doom/DOOMD.EXE',
      workingDirectory: 'D:/Projects/doom-in-typescript',
    },
    {
      event: 'capture-initial-title-frame',
      frameIndex: 0,
      ordinal: 4,
      targetSurface: 'title-screen',
      tic: 0,
    },
    {
      event: 'lock-contract-derived-from-allowed-authority',
      manifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      ordinal: 5,
      reason: 'The selected step read scope does not permit opening or executing reference binaries directly.',
      status: 'pending-live-framebuffer-capture',
    },
  ],
  expectedTraceHash: '68f6f03a34995d715382a2fdfed8fa37b42c45d6cabbf4d02ca555717dc966ec',
  manifestEvidence: {
    allowedReadScopeManifest: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    observedLaunchSurfaces: ['bun-argv-command-line', 'gameplay-first-console-message', 'launcher-window-entry'],
    relevantExplicitNullSurfaces: ['framebuffer-hash-comparison', 'reference-oracle-replay-capture', 'side-by-side-replay-command'],
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
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      role: 'reference executable for initial title frame capture',
      sourceCatalogId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data for initial title frame capture',
      sourceCatalogId: 'S-FPS-006',
    },
  ],
  stepId: '02-004',
  stepTitle: 'capture-initial-title-frame',
} satisfies InitialTitleFrameFixture;

async function readJson<T>(path: string): Promise<T> {
  return await Bun.file(path).json();
}

function sha256(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);

  return hasher.digest('hex');
}

test('locks the initial title frame oracle fixture exactly', async () => {
  const fixture = await readJson<InitialTitleFrameFixture>(fixturePath);

  expect(fixture).toEqual(expectedFixture);
});

test('recomputes the expected trace hash', async () => {
  const fixture = await readJson<InitialTitleFrameFixture>(fixturePath);
  const traceHash = sha256(JSON.stringify(fixture.expectedTrace));

  expect(traceHash).toBe(fixture.expectedTraceHash);
  expect(fixture.expectedFrame.traceSha256).toBe(traceHash);
  expect(fixture.expectedTrace.map((traceEvent) => traceEvent.ordinal)).toEqual([1, 2, 3, 4, 5]);
  expect(new Set(fixture.expectedTrace.map((traceEvent) => traceEvent.event)).size).toBe(fixture.expectedTrace.length);
});

test('cross-checks source catalog authority rows', async () => {
  const fixture = await readJson<InitialTitleFrameFixture>(fixturePath);
  const sourceCatalog = await Bun.file(sourceCatalogPath).text();

  for (const sourceAuthority of fixture.sourceAuthority) {
    expect(sourceCatalog).toContain(`| ${sourceAuthority.sourceCatalogId} |`);
    expect(sourceCatalog).toContain(sourceAuthority.authority);
    expect(sourceCatalog).toContain(`\`${sourceAuthority.path}\``);
  }
});

test('cross-checks the allowed side-by-side manifest evidence', async () => {
  const fixture = await readJson<InitialTitleFrameFixture>(fixturePath);
  const manifest = await readJson<SideBySideManifest>(manifestPath);
  const explicitNullSurfaceNames = manifest.explicitNullSurfaces.map((explicitNullSurface) => explicitNullSurface.surface);
  const observedLaunchSurfaceNames = manifest.observedLaunchSurfaces.map((observedLaunchSurface) => observedLaunchSurface.surface);

  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.stepId).toBe('01-015');
  expect(manifest.commandContracts).toEqual(fixture.commandContracts);
  expect(manifest.sourceHashes).toEqual(fixture.manifestEvidence.sourceHashes);
  expect(manifest.targetReplayContract.requiredCommand).toBe(fixture.commandContracts.targetPlayable.runtimeCommand);

  for (const observedLaunchSurfaceName of fixture.manifestEvidence.observedLaunchSurfaces) {
    expect(observedLaunchSurfaceNames).toContain(observedLaunchSurfaceName);
  }

  for (const explicitNullSurfaceName of fixture.manifestEvidence.relevantExplicitNullSurfaces) {
    expect(explicitNullSurfaceNames).toContain(explicitNullSurfaceName);
  }
});

test('registers the oracle artifact', async () => {
  const referenceOracles = await Bun.file(referenceOraclesPath).text();

  expect(referenceOracles).toContain(
    '| OR-FPS-009 | `test/oracles/fixtures/capture-initial-title-frame.json` | initial title frame capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-initial-title-frame.test.ts` |',
  );
});
