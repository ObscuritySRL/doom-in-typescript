import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-final-side-by-side-replay.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  artifactPath: fixturePath,
  captureCommand: {
    arguments: [
      'run',
      'doom.ts',
      '--side-by-side-replay',
      '--reference-executable',
      'doom/DOOMD.EXE',
      '--iwad',
      'doom/DOOM1.WAD',
      '--input-trace',
      'test/oracles/fixtures/final-side-by-side-replay-input-trace.json',
      '--sample-tics',
      '0,1,35,70,140,210,350,700,1050,1400,1750,2100',
      '--hash',
      'framebuffer,state,audio,music-event',
      '--report',
      fixturePath,
    ],
    implementationStatus: 'pending-unimplemented-side-by-side-surface',
    program: 'bun',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 2100,
    endTic: 2100,
    framebufferHeight: 200,
    framebufferWidth: 320,
    sampleFrames: [0, 1, 35, 70, 140, 210, 350, 700, 1050, 1400, 1750, 2100],
    sampleTics: [0, 1, 35, 70, 140, 210, 350, 700, 1050, 1400, 1750, 2100],
    startFrame: 0,
    startTic: 0,
    ticRateHz: 35,
  },
  commandContract: {
    acceptanceMode: 'side-by-side-verifiable replay parity',
    entryFile: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
    sourceManifestStepId: '01-015',
  },
  expectedTrace: [
    {
      checkpoint: 'clean-launch-pair-created',
      comparisonStatus: 'pending-live-capture',
      detail: 'Reference and implementation launch from clean workspace with the same IWAD, map, skill, and deterministic input trace.',
      frameIndex: 0,
      referenceState: 'title-loop-start',
      tic: 0,
    },
    {
      checkpoint: 'menu-route-to-e1m1',
      comparisonStatus: 'pending-live-capture',
      detail: 'The replay leaves the title/menu path through the recorded new-game, episode, and skill selections.',
      frameIndex: 210,
      referenceState: 'menu-confirmed-skill',
      tic: 210,
    },
    {
      checkpoint: 'e1m1-gameplay-synchronized',
      comparisonStatus: 'pending-live-capture',
      detail: 'Both sides are expected to enter E1M1 and apply the same per-tic input commands before hash sampling begins.',
      frameIndex: 350,
      referenceState: 'e1m1-active',
      tic: 350,
    },
    {
      checkpoint: 'scripted-path-samples-collected',
      comparisonStatus: 'pending-live-capture',
      detail: 'Framebuffer, state, SFX, and music-event hash windows from earlier capture steps are sampled on the shared replay timeline.',
      frameIndex: 1400,
      referenceState: 'scripted-e1m1-path-active',
      tic: 1400,
    },
    {
      checkpoint: 'final-side-by-side-report-ready',
      comparisonStatus: 'pending-unimplemented-surface',
      detail: 'The final report should contain paired framebuffer, state, audio, and music-event comparisons once the side-by-side runner exists.',
      frameIndex: 2100,
      referenceState: 'report-ready',
      tic: 2100,
    },
  ],
  inheritedSourceHashes: [
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
  liveHashStatus: [
    {
      hashKind: 'audio',
      reason: 'No audio hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-capture',
      surface: 'audio-hash-comparison',
    },
    {
      hashKind: 'framebuffer',
      reason: 'No framebuffer hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-capture',
      surface: 'framebuffer-hash-comparison',
    },
    {
      hashKind: 'music-event',
      reason: 'No final side-by-side replay report surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-capture',
      surface: 'final-side-by-side-report',
    },
    {
      hashKind: 'state',
      reason: 'No state hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-capture',
      surface: 'state-hash-comparison',
    },
  ],
  oracleId: 'OR-FPS-036',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'reference executable authority when usable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data authority',
    },
    {
      authority: 'derived-manifest',
      id: '01-015',
      path: manifestPath,
      role: 'allowed launch-surface and missing-side-by-side evidence',
    },
  ],
  sourceManifestPath: manifestPath,
  stepId: '02-031',
  stepTitle: 'capture-final-side-by-side-replay',
  traceSha256: '4c4e75ccf5333fe7ea84916139237d77403adb8307f5220bfd5c95fd784e6111',
};

type FinalSideBySideReplayFixture = typeof expectedFixture;

type SideBySideReplayManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: {
    reason: string;
    surface: string;
  }[];
  schemaVersion: number;
  sourceHashes: {
    path: string;
    sha256: string;
    sizeBytes: number;
  }[];
  stepId: string;
  stepTitle: string;
  targetReplayContract: {
    acceptanceMode: string;
    currentVisibility: string;
    requiredCommand: string;
  };
};

function assertFinalSideBySideReplayFixture(value: unknown): asserts value is FinalSideBySideReplayFixture {
  if (!isRecord(value) || !Array.isArray(value.expectedTrace) || !Array.isArray(value.liveHashStatus)) {
    throw new Error('Expected final side-by-side replay fixture shape.');
  }
}

function assertSideBySideReplayManifest(value: unknown): asserts value is SideBySideReplayManifest {
  if (!isRecord(value)) {
    throw new Error('Expected side-by-side replay manifest object.');
  }

  const commandContracts = value.commandContracts;
  const targetReplayContract = value.targetReplayContract;

  if (!isRecord(commandContracts) || !isRecord(commandContracts.targetPlayable) || !isRecord(targetReplayContract) || !Array.isArray(value.explicitNullSurfaces) || !Array.isArray(value.sourceHashes)) {
    throw new Error('Expected side-by-side replay manifest shape.');
  }
}

function hashTrace(trace: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(trace));
  return hasher.digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readFixture(): Promise<FinalSideBySideReplayFixture> {
  const fixture: unknown = await Bun.file(fixturePath).json();
  assertFinalSideBySideReplayFixture(fixture);
  return fixture;
}

async function readManifest(): Promise<SideBySideReplayManifest> {
  const manifest: unknown = await Bun.file(manifestPath).json();
  assertSideBySideReplayManifest(manifest);
  return manifest;
}

describe('capture final side-by-side replay oracle', () => {
  test('locks the exact fixture value', async () => {
    const fixture = await readFixture();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the trace hash and final transition', async () => {
    const fixture = await readFixture();

    expect(hashTrace(fixture.expectedTrace)).toBe(fixture.traceSha256);
    expect(fixture.expectedTrace.at(-1)).toEqual(expectedFixture.expectedTrace[4]);
    expect(fixture.captureWindow.sampleTics).toEqual(fixture.captureWindow.sampleFrames);
  });

  test('cross-checks the command contract against the 01-015 manifest', async () => {
    const fixture = await readFixture();
    const manifest = await readManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe(fixture.commandContract.sourceManifestStepId);
    expect(fixture.commandContract.entryFile).toBe(manifest.commandContracts.targetPlayable.entryFile);
    expect(fixture.commandContract.runtimeCommand).toBe(manifest.commandContracts.targetPlayable.runtimeCommand);
    expect(fixture.commandContract.runtimeCommand).toBe(manifest.targetReplayContract.requiredCommand);
    expect(fixture.commandContract.acceptanceMode).toBe(manifest.targetReplayContract.acceptanceMode);
    expect(manifest.targetReplayContract.currentVisibility).toBe('missing in allowed launch-surface files');
    expect(fixture.inheritedSourceHashes).toEqual(manifest.sourceHashes);
  });

  test('locks missing live hash surfaces from the allowed manifest', async () => {
    const fixture = await readFixture();
    const manifest = await readManifest();
    const expectedSurfaces = ['audio-hash-comparison', 'framebuffer-hash-comparison', 'final-side-by-side-report', 'state-hash-comparison'];

    expect(fixture.liveHashStatus.map((liveHashStatus) => liveHashStatus.surface)).toEqual(expectedSurfaces);

    for (const liveHashStatus of fixture.liveHashStatus) {
      const explicitNullSurface = manifest.explicitNullSurfaces.find((candidateSurface) => candidateSurface.surface === liveHashStatus.surface);

      expect(explicitNullSurface?.reason).toBe(liveHashStatus.reason);
    }
  });

  test('registers the oracle and source authorities', async () => {
    const fixture = await readFixture();
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(oracleRegistry).toContain(
      '| OR-FPS-036 | `test/oracles/fixtures/capture-final-side-by-side-replay.json` | final side-by-side replay capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-final-side-by-side-replay.test.ts` |',
    );
    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(fixture.sourceAuthority).toEqual(expectedFixture.sourceAuthority);
  });
});
