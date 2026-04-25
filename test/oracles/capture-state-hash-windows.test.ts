import { describe, expect, test } from 'bun:test';

type CaptureWindow = {
  frameEnd: number;
  frameStart: number;
  name: string;
  stateTargets: string[];
  ticEnd: number;
  ticStart: number;
};

type ExpectedStateHashWindow = {
  expectedHash: null;
  traceEvent: string;
  window: string;
};

type OracleFixture = {
  captureCommand: {
    arguments: string[];
    requiredCommand: string;
    sourceManifestPath: string;
  };
  captureWindows: CaptureWindow[];
  expectedStateHashes: {
    hashAlgorithm: string;
    reason: string;
    status: string;
    windows: ExpectedStateHashWindow[];
  };
  referenceAuthority: {
    primaryBinary: string;
    primaryData: string;
    secondaryBinary: string;
  };
  schemaVersion: number;
  sourceCatalogAuthority: SourceCatalogAuthority[];
  sourceHashes: SourceHash[];
  stateHashTrace: StateHashTraceEvent[];
  stepId: string;
  stepTitle: string;
  traceSha256: string;
};

type SideBySideReplayManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: Array<{
    evidencePaths: string[];
    path: null;
    reason: string;
    surface: string;
  }>;
  sourceHashes: SourceHash[];
};

type SourceCatalogAuthority = {
  authority: string;
  id: string;
  path: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type StateHashTraceEvent = Record<string, number | string | string[]>;

const fixturePath = 'test/oracles/fixtures/capture-state-hash-windows.json';
const sideBySideManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';

const expectedFixture = {
  captureCommand: {
    arguments: [
      '--oracle-capture',
      'state-hash-windows',
      '--iwad',
      'doom/DOOM1.WAD',
      '--reference',
      'doom/DOOMD.EXE',
      '--window',
      'clean-launch-initial-state',
      '--window',
      'first-title-tic-state',
      '--window',
      'first-menu-state',
      '--window',
      'e1m1-start-state',
      '--window',
      'scripted-e1m1-state-sample',
    ],
    requiredCommand: 'bun run doom.ts',
    sourceManifestPath: sideBySideManifestPath,
  },
  captureWindows: [
    {
      frameEnd: 2,
      frameStart: 0,
      name: 'clean-launch-initial-state',
      stateTargets: ['gameaction', 'gamestate', 'gametic', 'players[0]'],
      ticEnd: 0,
      ticStart: 0,
    },
    {
      frameEnd: 35,
      frameStart: 34,
      name: 'first-title-tic-state',
      stateTargets: ['gameaction', 'gamestate', 'gametic', 'menuactive', 'players[0]'],
      ticEnd: 1,
      ticStart: 1,
    },
    {
      frameEnd: 122,
      frameStart: 120,
      name: 'first-menu-state',
      stateTargets: ['gamestate', 'menuactive', 'menuitem', 'skullAnimCounter'],
      ticEnd: 4,
      ticStart: 4,
    },
    {
      frameEnd: 358,
      frameStart: 356,
      name: 'e1m1-start-state',
      stateTargets: ['episode', 'gamemap', 'gamestate', 'players[0]', 'skill'],
      ticEnd: 10,
      ticStart: 10,
    },
    {
      frameEnd: 540,
      frameStart: 538,
      name: 'scripted-e1m1-state-sample',
      stateTargets: ['automap', 'mobjThinkers', 'players[0]', 'sectors', 'validcount'],
      ticEnd: 15,
      ticStart: 15,
    },
  ],
  expectedStateHashes: {
    hashAlgorithm: 'sha256',
    reason: 'No state hash comparison surface is exposed in the allowed launch-surface files.',
    status: 'pending-reference-capture',
    windows: [
      {
        expectedHash: null,
        traceEvent: 'window-requested',
        window: 'clean-launch-initial-state',
      },
      {
        expectedHash: null,
        traceEvent: 'window-requested',
        window: 'first-title-tic-state',
      },
      {
        expectedHash: null,
        traceEvent: 'window-requested',
        window: 'first-menu-state',
      },
      {
        expectedHash: null,
        traceEvent: 'window-requested',
        window: 'e1m1-start-state',
      },
      {
        expectedHash: null,
        traceEvent: 'window-requested',
        window: 'scripted-e1m1-state-sample',
      },
    ],
  },
  referenceAuthority: {
    primaryBinary: 'doom/DOOMD.EXE',
    primaryData: 'doom/DOOM1.WAD',
    secondaryBinary: 'doom/DOOM.EXE',
  },
  schemaVersion: 1,
  sourceCatalogAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
    },
    {
      authority: 'local-secondary-binary',
      id: 'S-FPS-004',
      path: 'doom/DOOM.EXE',
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
  stateHashTrace: [
    {
      event: 'capture-contract-created',
      referenceAuthority: 'doom/DOOMD.EXE',
      requiredCommand: 'bun run doom.ts',
      sourceManifestPath: sideBySideManifestPath,
    },
    {
      event: 'window-requested',
      frameEnd: 2,
      frameStart: 0,
      stateTargets: ['gameaction', 'gamestate', 'gametic', 'players[0]'],
      ticEnd: 0,
      ticStart: 0,
      window: 'clean-launch-initial-state',
    },
    {
      event: 'window-requested',
      frameEnd: 35,
      frameStart: 34,
      stateTargets: ['gameaction', 'gamestate', 'gametic', 'menuactive', 'players[0]'],
      ticEnd: 1,
      ticStart: 1,
      window: 'first-title-tic-state',
    },
    {
      event: 'window-requested',
      frameEnd: 122,
      frameStart: 120,
      stateTargets: ['gamestate', 'menuactive', 'menuitem', 'skullAnimCounter'],
      ticEnd: 4,
      ticStart: 4,
      window: 'first-menu-state',
    },
    {
      event: 'window-requested',
      frameEnd: 358,
      frameStart: 356,
      stateTargets: ['episode', 'gamemap', 'gamestate', 'players[0]', 'skill'],
      ticEnd: 10,
      ticStart: 10,
      window: 'e1m1-start-state',
    },
    {
      event: 'window-requested',
      frameEnd: 540,
      frameStart: 538,
      stateTargets: ['automap', 'mobjThinkers', 'players[0]', 'sectors', 'validcount'],
      ticEnd: 15,
      ticStart: 15,
      window: 'scripted-e1m1-state-sample',
    },
    {
      event: 'state-hash-values-pending',
      reason: 'No state hash comparison surface is exposed in the allowed launch-surface files.',
      surface: 'state-hash-comparison',
    },
  ],
  stepId: '02-030',
  stepTitle: 'capture-state-hash-windows',
  traceSha256: 'e727588516b58ec529f0978b41ec5673597cca755d4315ed86a2b832bfcbaedb',
} satisfies OracleFixture;

describe('capture-state-hash-windows oracle fixture', () => {
  test('locks the exact fixture value', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the deterministic state hash trace', () => {
    const traceSha256 = new Bun.CryptoHasher('sha256').update(JSON.stringify(expectedFixture.stateHashTrace)).digest('hex');

    expect(traceSha256).toBe(expectedFixture.traceSha256);
    expect(expectedFixture.stateHashTrace.map((traceEvent) => traceEvent.event)).toEqual([
      'capture-contract-created',
      'window-requested',
      'window-requested',
      'window-requested',
      'window-requested',
      'window-requested',
      'state-hash-values-pending',
    ]);
  });

  test('locks command contract and capture windows', () => {
    expect(expectedFixture.captureCommand).toEqual({
      arguments: [
        '--oracle-capture',
        'state-hash-windows',
        '--iwad',
        'doom/DOOM1.WAD',
        '--reference',
        'doom/DOOMD.EXE',
        '--window',
        'clean-launch-initial-state',
        '--window',
        'first-title-tic-state',
        '--window',
        'first-menu-state',
        '--window',
        'e1m1-start-state',
        '--window',
        'scripted-e1m1-state-sample',
      ],
      requiredCommand: 'bun run doom.ts',
      sourceManifestPath: sideBySideManifestPath,
    });
    expect(expectedFixture.captureWindows.map((window) => `${window.name}:${window.ticStart}-${window.ticEnd}:${window.frameStart}-${window.frameEnd}`)).toEqual([
      'clean-launch-initial-state:0-0:0-2',
      'first-title-tic-state:1-1:34-35',
      'first-menu-state:4-4:120-122',
      'e1m1-start-state:10-10:356-358',
      'scripted-e1m1-state-sample:15-15:538-540',
    ]);
  });

  test('cross-checks the allowed side-by-side replay manifest', async () => {
    const sideBySideReplayManifest: SideBySideReplayManifest = await Bun.file(sideBySideManifestPath).json();

    expect(sideBySideReplayManifest.commandContracts.targetPlayable).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: expectedFixture.captureCommand.requiredCommand,
    });
    expect(sideBySideReplayManifest.explicitNullSurfaces).toContainEqual({
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: expectedFixture.expectedStateHashes.reason,
      surface: 'state-hash-comparison',
    });
    expect(sideBySideReplayManifest.sourceHashes).toEqual(expectedFixture.sourceHashes);
  });

  test('cross-checks source catalog authority and oracle registration', async () => {
    const referenceOracles = await Bun.file('plan_fps/REFERENCE_ORACLES.md').text();
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(sourceCatalog).toContain('| S-FPS-004 | local Windows executable | file | local-secondary-binary | `doom/DOOM.EXE` |');
    expect(referenceOracles).toContain(
      '| OR-FPS-035 | `test/oracles/fixtures/capture-state-hash-windows.json` | state hash windows capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-state-hash-windows.test.ts` |',
    );
  });
});
