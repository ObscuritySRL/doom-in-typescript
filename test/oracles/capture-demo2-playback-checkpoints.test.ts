import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  readonly arguments: readonly string[];
  readonly binaryPath: string;
  readonly command: string;
  readonly demoLump: string;
  readonly iwadPath: string;
};

type CheckpointWindow = {
  readonly frames: readonly number[];
  readonly startFrame: number;
  readonly startTic: number;
  readonly ticRateHz: number;
  readonly tics: readonly number[];
};

type Demo2PlaybackCheckpointsFixture = {
  readonly captureCommand: CaptureCommand;
  readonly checkpointWindow: CheckpointWindow;
  readonly expectedTrace: readonly ExpectedTraceEntry[];
  readonly liveHashStatus: LiveHashStatus;
  readonly referenceManifest: ReferenceManifest;
  readonly schemaVersion: number;
  readonly sourceAuthority: readonly SourceAuthority[];
  readonly stepId: string;
  readonly stepTitle: string;
  readonly traceSha256: string;
  readonly traceSerialization: string;
};

type ExpectedTraceEntry = {
  readonly checkpoint: string;
  readonly demoLump: string;
  readonly frame: number;
  readonly reason?: string;
  readonly tic: number;
};

type ExplicitNullSurface = {
  readonly path: string | null;
  readonly reason: string;
  readonly surface: string;
};

type LiveHashStatus = {
  readonly audioSha256: string | null;
  readonly framebufferSha256: string | null;
  readonly reason: string;
  readonly stateSha256: string | null;
};

type ReferenceManifest = {
  readonly path: string;
  readonly schemaVersion: number;
  readonly targetReplayContractCurrentVisibility: string;
};

type SideBySideReplayManifest = {
  readonly commandContracts: {
    readonly targetPlayable: {
      readonly entryFile: string;
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly ExplicitNullSurface[];
  readonly schemaVersion: number;
  readonly targetReplayContract: {
    readonly currentVisibility: string;
    readonly requiredCommand: string;
  };
};

type SourceAuthority = {
  readonly authority: string;
  readonly id: string;
  readonly path: string;
  readonly source: string;
};

const fixturePath = 'test/oracles/fixtures/capture-demo2-playback-checkpoints.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['-timedemo', 'DEMO2', '-iwad', 'doom/DOOM1.WAD'],
    binaryPath: 'doom/DOOMD.EXE',
    command: 'doom/DOOMD.EXE -timedemo DEMO2 -iwad doom/DOOM1.WAD',
    demoLump: 'DEMO2',
    iwadPath: 'doom/DOOM1.WAD',
  },
  checkpointWindow: {
    frames: [0, 35, 70, 140, 280, 560, 840, 1_120],
    startFrame: 0,
    startTic: 0,
    ticRateHz: 35,
    tics: [0, 35, 70, 140, 280, 560, 840, 1_120],
  },
  expectedTrace: [
    {
      checkpoint: 'demo2-playback-start',
      demoLump: 'DEMO2',
      frame: 0,
      tic: 0,
    },
    {
      checkpoint: 'demo2-checkpoint-35',
      demoLump: 'DEMO2',
      frame: 35,
      tic: 35,
    },
    {
      checkpoint: 'demo2-checkpoint-70',
      demoLump: 'DEMO2',
      frame: 70,
      tic: 70,
    },
    {
      checkpoint: 'demo2-checkpoint-140',
      demoLump: 'DEMO2',
      frame: 140,
      tic: 140,
    },
    {
      checkpoint: 'demo2-checkpoint-280',
      demoLump: 'DEMO2',
      frame: 280,
      tic: 280,
    },
    {
      checkpoint: 'demo2-checkpoint-560',
      demoLump: 'DEMO2',
      frame: 560,
      tic: 560,
    },
    {
      checkpoint: 'demo2-checkpoint-840',
      demoLump: 'DEMO2',
      frame: 840,
      tic: 840,
    },
    {
      checkpoint: 'demo2-live-hashes-pending',
      demoLump: 'DEMO2',
      frame: 1_120,
      reason: 'reference-oracle-replay-capture is not exposed in the allowed 01-015 launch-surface files',
      tic: 1_120,
    },
  ],
  liveHashStatus: {
    audioSha256: null,
    framebufferSha256: null,
    reason: 'No reference oracle replay capture, framebuffer hash comparison, audio hash comparison, or state hash comparison surface is exposed in the allowed 01-015 launch-surface files.',
    stateSha256: null,
  },
  referenceManifest: {
    path: manifestPath,
    schemaVersion: 1,
    targetReplayContractCurrentVisibility: 'missing in allowed launch-surface files',
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      source: 'local DOS executable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      source: 'local IWAD',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  stepId: '02-008',
  stepTitle: 'capture-demo2-playback-checkpoints',
  traceSha256: '736f0d08a73b3983dc0406477b6ac1cc1bf47cdf776165271e332047bff6cfa4',
  traceSerialization: 'JSON.stringify(expectedTrace)',
} as const satisfies Demo2PlaybackCheckpointsFixture;

async function loadFixture(): Promise<Demo2PlaybackCheckpointsFixture> {
  const fixture: unknown = await Bun.file(fixturePath).json();

  assertDemo2PlaybackCheckpointsFixture(fixture);

  return fixture;
}

async function loadSideBySideReplayManifest(): Promise<SideBySideReplayManifest> {
  const manifest: unknown = await Bun.file(manifestPath).json();

  assertSideBySideReplayManifest(manifest);

  return manifest;
}

function assertDemo2PlaybackCheckpointsFixture(value: unknown): asserts value is Demo2PlaybackCheckpointsFixture {
  if (!isRecord(value)) {
    throw new Error('Expected demo2 playback checkpoints fixture object.');
  }

  if (!isRecord(value.captureCommand) || !isRecord(value.checkpointWindow) || !Array.isArray(value.expectedTrace) || !isRecord(value.liveHashStatus) || !isRecord(value.referenceManifest) || !Array.isArray(value.sourceAuthority)) {
    throw new Error('Expected demo2 playback checkpoints fixture shape.');
  }
}

function assertSideBySideReplayManifest(value: unknown): asserts value is SideBySideReplayManifest {
  if (!isRecord(value)) {
    throw new Error('Expected side-by-side replay manifest object.');
  }

  if (!isRecord(value.commandContracts) || !isRecord(value.commandContracts.targetPlayable) || !Array.isArray(value.explicitNullSurfaces) || !isRecord(value.targetReplayContract)) {
    throw new Error('Expected side-by-side replay manifest shape.');
  }
}

function findSourceCatalogRow(sourceCatalog: string, sourceIdentifier: string): string {
  const sourceCatalogRow = sourceCatalog.split('\n').find((line) => line.startsWith(`| ${sourceIdentifier} |`));

  if (sourceCatalogRow === undefined) {
    throw new Error(`Missing source catalog row ${sourceIdentifier}.`);
  }

  return sourceCatalogRow;
}

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

describe('capture demo2 playback checkpoints oracle', () => {
  test('locks the fixture values and deterministic trace hash', async () => {
    const fixture = await loadFixture();

    expect(fixture).toEqual(expectedFixture);
    expect(hashJson(fixture.expectedTrace)).toBe(fixture.traceSha256);
    expect(hashJson(expectedFixture.expectedTrace)).toBe(expectedFixture.traceSha256);
  });

  test('locks demo2 checkpoint transitions and capture command', async () => {
    const fixture = await loadFixture();

    expect(fixture.captureCommand).toEqual({
      arguments: ['-timedemo', 'DEMO2', '-iwad', 'doom/DOOM1.WAD'],
      binaryPath: 'doom/DOOMD.EXE',
      command: 'doom/DOOMD.EXE -timedemo DEMO2 -iwad doom/DOOM1.WAD',
      demoLump: 'DEMO2',
      iwadPath: 'doom/DOOM1.WAD',
    });
    expect(fixture.expectedTrace.map((checkpoint) => checkpoint.checkpoint)).toEqual([
      'demo2-playback-start',
      'demo2-checkpoint-35',
      'demo2-checkpoint-70',
      'demo2-checkpoint-140',
      'demo2-checkpoint-280',
      'demo2-checkpoint-560',
      'demo2-checkpoint-840',
      'demo2-live-hashes-pending',
    ]);
    expect(fixture.checkpointWindow).toEqual({
      frames: [0, 35, 70, 140, 280, 560, 840, 1_120],
      startFrame: 0,
      startTic: 0,
      ticRateHz: 35,
      tics: [0, 35, 70, 140, 280, 560, 840, 1_120],
    });
  });

  test('locks nonnegative checkpoint boundaries and pending live hashes', async () => {
    const fixture = await loadFixture();

    expect(fixture.checkpointWindow.startFrame).toBe(0);
    expect(fixture.checkpointWindow.startTic).toBe(0);
    expect(fixture.checkpointWindow.ticRateHz).toBe(35);
    expect(fixture.checkpointWindow.frames).toEqual(fixture.checkpointWindow.tics);
    expect(fixture.checkpointWindow.frames).toEqual(fixture.expectedTrace.map((checkpoint) => checkpoint.frame));
    expect(fixture.checkpointWindow.tics).toEqual(fixture.expectedTrace.map((checkpoint) => checkpoint.tic));
    expect(fixture.liveHashStatus).toEqual({
      audioSha256: null,
      framebufferSha256: null,
      reason: 'No reference oracle replay capture, framebuffer hash comparison, audio hash comparison, or state hash comparison surface is exposed in the allowed 01-015 launch-surface files.',
      stateSha256: null,
    });

    let previousFrame = -1;

    for (const checkpoint of fixture.expectedTrace) {
      expect(Number.isInteger(checkpoint.frame)).toBe(true);
      expect(Number.isInteger(checkpoint.tic)).toBe(true);
      expect(checkpoint.demoLump).toBe('DEMO2');
      expect(checkpoint.frame).toBeGreaterThan(previousFrame);
      expect(checkpoint.frame).toBeGreaterThanOrEqual(0);
      expect(checkpoint.frame).toBe(checkpoint.tic);
      previousFrame = checkpoint.frame;
    }

    expect(fixture.expectedTrace.at(-1)).toEqual({
      checkpoint: 'demo2-live-hashes-pending',
      demoLump: 'DEMO2',
      frame: 1_120,
      reason: 'reference-oracle-replay-capture is not exposed in the allowed 01-015 launch-surface files',
      tic: 1_120,
    });
  });

  test('cross-checks source catalog authority rows', async () => {
    const fixture = await loadFixture();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    for (const sourceAuthority of fixture.sourceAuthority) {
      const sourceCatalogRow = findSourceCatalogRow(sourceCatalog, sourceAuthority.id);

      expect(sourceCatalogRow).toContain(`| ${sourceAuthority.source} |`);
      expect(sourceCatalogRow).toContain(`| ${sourceAuthority.authority} |`);
      expect(sourceCatalogRow).toContain(`| \`${sourceAuthority.path}\` |`);
    }
  });

  test('cross-checks the side-by-side replay audit manifest', async () => {
    const fixture = await loadFixture();
    const manifest = await loadSideBySideReplayManifest();
    const explicitNullSurfaces = new Set(manifest.explicitNullSurfaces.map((surface) => surface.surface));

    expect(fixture.referenceManifest).toEqual({
      path: manifestPath,
      schemaVersion: manifest.schemaVersion,
      targetReplayContractCurrentVisibility: manifest.targetReplayContract.currentVisibility,
    });
    expect(manifest.commandContracts.targetPlayable).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(manifest.targetReplayContract.requiredCommand).toBe('bun run doom.ts');
    expect(explicitNullSurfaces.has('reference-oracle-replay-capture')).toBe(true);
    expect(explicitNullSurfaces.has('framebuffer-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('audio-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('state-hash-comparison')).toBe(true);
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-013 | `test/oracles/fixtures/capture-demo2-playback-checkpoints.json` | demo2 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo2-playback-checkpoints.test.ts` |',
    );
  });
});
