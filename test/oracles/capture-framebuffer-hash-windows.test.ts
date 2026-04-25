import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  arguments: string[];
  program: string;
  status: string;
  workingDirectory: string;
};

type CaptureWindow = {
  frameEnd: number;
  frameStart: number;
  framebuffer: {
    height: number;
    pixelFormat: string;
    width: number;
  };
  sampleFrames: number[];
  sampleTics: number[];
  source: string;
  ticEnd: number;
  ticStart: number;
};

type CommandContract = {
  entryFile: string;
  runtimeCommand: string;
  sourceManifestPath: string;
};

type FramebufferHashTraceEntry = {
  label: string;
  tic: number;
  frame: number;
  window: string;
  expectedHashStatus: string;
  expectedSha256: string | null;
  surface: string;
  reason: string;
};

type FramebufferHashWindowsFixture = {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  commandContract: CommandContract;
  fixtureKind: string;
  framebufferHashTrace: FramebufferHashTraceEntry[];
  inheritedLaunchSurfaceSourceHashes: SourceHash[];
  missingSurfaces: MissingSurface[];
  oracleId: string;
  oracleRegistration: OracleRegistration;
  rationale: string;
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  stepId: string;
  stepTitle: string;
  traceSha256: string;
};

type MissingSurface = {
  evidencePaths: string[];
  path: null;
  reason: string;
  surface: string;
};

type OracleRegistration = {
  artifact: string;
  authority: string;
  refreshCommand: string;
};

type SourceAuthority = {
  authority: string;
  path: string;
  role: string;
  sourceId: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

const fixturePath = 'test/oracles/fixtures/capture-framebuffer-hash-windows.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sideBySideReplayManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const missingFramebufferHashComparisonReason = 'No framebuffer hash comparison surface is exposed in the allowed launch-surface files.';

const expectedFixture = {
  captureCommand: {
    arguments: ['run', 'doom.ts', '--oracle', 'capture-framebuffer-hash-windows', '--iwad', 'doom/DOOM1.WAD', '--reference-binary', 'doom/DOOMD.EXE', '--script', 'clean-launch-framebuffer-windows', '--frames', '0,35,70,105,140,175,210'],
    program: 'bun',
    status: 'pending-implementation',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    frameEnd: 210,
    frameStart: 0,
    framebuffer: {
      height: 200,
      pixelFormat: 'indexed-8-bit-playpal',
      width: 320,
    },
    sampleFrames: [0, 35, 70, 105, 140, 175, 210],
    sampleTics: [0, 35, 70, 105, 140, 175, 210],
    source: 'clean launch through title, menu, and E1M1 gameplay framebuffer checkpoints',
    ticEnd: 210,
    ticStart: 0,
  },
  commandContract: {
    entryFile: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
    sourceManifestPath: sideBySideReplayManifestPath,
  },
  fixtureKind: 'framebuffer-hash-windows-capture-contract',
  framebufferHashTrace: [
    {
      label: 'clean-launch-first-visible-frame',
      tic: 0,
      frame: 0,
      window: 'startup',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
    {
      label: 'title-settled-frame',
      tic: 35,
      frame: 35,
      window: 'title',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
    {
      label: 'menu-first-frame',
      tic: 70,
      frame: 70,
      window: 'menu',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
    {
      label: 'e1m1-first-gameplay-frame',
      tic: 105,
      frame: 105,
      window: 'gameplay',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
    {
      label: 'e1m1-post-movement-frame',
      tic: 140,
      frame: 140,
      window: 'gameplay',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
    {
      label: 'e1m1-post-combat-frame',
      tic: 175,
      frame: 175,
      window: 'gameplay',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
    {
      label: 'e1m1-post-pickup-frame',
      tic: 210,
      frame: 210,
      window: 'gameplay',
      expectedHashStatus: 'pending-reference-capture',
      expectedSha256: null,
      surface: 'framebuffer-hash-comparison',
      reason: missingFramebufferHashComparisonReason,
    },
  ],
  inheritedLaunchSurfaceSourceHashes: [
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
  missingSurfaces: [
    {
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: missingFramebufferHashComparisonReason,
      surface: 'framebuffer-hash-comparison',
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
  ],
  oracleId: 'OR-FPS-034',
  oracleRegistration: {
    artifact: fixturePath,
    authority: 'framebuffer hash windows capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json`',
    refreshCommand: 'bun test test/oracles/capture-framebuffer-hash-windows.test.ts',
  },
  rationale:
    'The selected read scope exposes local binary/IWAD authority and the 01-015 launch-surface audit, but no runnable reference capture bridge or framebuffer hash comparison surface. This fixture therefore locks the exact pending framebuffer hash trace and the command contract that later implementation steps must satisfy.',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      role: 'reference executable authority',
      sourceId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      role: 'reference IWAD data',
      sourceId: 'S-FPS-006',
    },
    {
      authority: 'local-data',
      path: 'iwad/DOOM1.WAD',
      role: 'workspace IWAD copy',
      sourceId: 'S-FPS-007',
    },
    {
      authority: 'local-primary',
      path: 'package.json',
      role: 'launcher package surface inherited from 01-015',
      sourceId: 'S-FPS-009',
    },
    {
      authority: 'local-primary',
      path: 'tsconfig.json',
      role: 'TypeScript verification surface inherited from 01-015',
      sourceId: 'S-FPS-010',
    },
    {
      authority: 'local-primary',
      path: 'src/main.ts',
      role: 'current launcher surface inherited from 01-015',
      sourceId: 'S-FPS-011',
    },
  ],
  stepId: '02-029',
  stepTitle: 'capture-framebuffer-hash-windows',
  traceSha256: '26256123a36f2efb13333281e8b304214233084e04559aff9a3cd114d1e5da9c',
} satisfies FramebufferHashWindowsFixture;

function assertFixture(value: unknown): asserts value is FramebufferHashWindowsFixture {
  expect(value).toEqual(expectedFixture);
}

const hashTrace = (traceEntries: FramebufferHashTraceEntry[]): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(traceEntries)).digest('hex');

const readJson = async (path: string): Promise<unknown> => JSON.parse(await Bun.file(path).text());

describe('capture framebuffer hash windows oracle', () => {
  test('locks the exact fixture value', async () => {
    const fixture = await readJson(fixturePath);

    assertFixture(fixture);
  });

  test('locks the trace hash and framebuffer window', async () => {
    const fixture = await readJson(fixturePath);
    assertFixture(fixture);

    expect(hashTrace(fixture.framebufferHashTrace)).toBe(fixture.traceSha256);
    expect(fixture.captureWindow.sampleFrames).toEqual(fixture.captureWindow.sampleTics);
    expect(fixture.framebufferHashTrace.map((entry) => entry.frame)).toEqual(fixture.captureWindow.sampleFrames);
    expect(fixture.framebufferHashTrace.every((entry) => entry.expectedSha256 === null)).toBe(true);
    expect(fixture.framebufferHashTrace.every((entry) => entry.expectedHashStatus === 'pending-reference-capture')).toBe(true);
  });

  test('cross-checks the target command contract against the side-by-side replay audit', async () => {
    const sideBySideReplayManifest = await readJson(sideBySideReplayManifestPath);

    expect(sideBySideReplayManifest).toMatchObject({
      commandContracts: {
        targetPlayable: {
          entryFile: expectedFixture.commandContract.entryFile,
          runtimeCommand: expectedFixture.commandContract.runtimeCommand,
        },
      },
      sourceHashes: expectedFixture.inheritedLaunchSurfaceSourceHashes,
      targetReplayContract: {
        requiredCommand: expectedFixture.commandContract.runtimeCommand,
      },
    });
  });

  test('cross-checks missing framebuffer capture surfaces against the side-by-side replay audit', async () => {
    const sideBySideReplayManifest = await readJson(sideBySideReplayManifestPath);

    expect(sideBySideReplayManifest).toMatchObject({
      explicitNullSurfaces: expect.arrayContaining(expectedFixture.missingSurfaces),
    });
  });

  test('cross-checks source-catalog authority and oracle registration', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    for (const source of expectedFixture.sourceAuthority) {
      expect(sourceCatalog).toContain(source.sourceId);
      expect(sourceCatalog).toContain(`\`${source.path}\``);
      expect(sourceCatalog).toContain(source.authority);
    }

    expect(referenceOracles).toContain(expectedFixture.oracleId);
    expect(referenceOracles).toContain(`\`${expectedFixture.oracleRegistration.artifact}\``);
    expect(referenceOracles).toContain(expectedFixture.oracleRegistration.authority);
    expect(referenceOracles).toContain(`\`${expectedFixture.oracleRegistration.refreshCommand}\``);
  });
});
