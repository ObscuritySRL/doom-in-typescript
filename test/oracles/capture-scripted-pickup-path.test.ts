import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-scripted-pickup-path.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

type FixtureRecord = Record<string, string | number>;

type ScriptedPickupFixture = {
  captureCommand: {
    arguments: string[];
    mode: string;
    runtimeCommand: string;
  };
  captureWindow: {
    endTic: number;
    frameRateHz: number;
    map: string;
    sampledTics: number[];
    skill: number;
    startTic: number;
  };
  expectedTrace: FixtureRecord[];
  inheritedLaunchSurfaceSourceHashes: SourceHash[];
  oracleId: string;
  pendingLiveHashes: {
    kind: string;
    reason: string;
    status: string;
  }[];
  schemaVersion: number;
  sourceAuthority: {
    authority: string;
    id: string;
    path: string;
    role: string;
  }[];
  sourceManifest: string;
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
  explicitNullSurfaces: {
    evidencePaths: string[];
    path: null;
    reason: string;
    surface: string;
  }[];
  sourceHashes: SourceHash[];
  targetReplayContract: {
    acceptanceMode: string;
    currentVisibility: string;
    requiredCommand: string;
  };
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertScriptedPickupFixture(value: unknown): asserts value is ScriptedPickupFixture {
  assertRecord(value, 'fixture');
  expect(value.schemaVersion).toBe(1);
  expect(value.stepId).toBe('02-022');
  expect(value.stepTitle).toBe('capture-scripted-pickup-path');
  expect(value.oracleId).toBe('OR-FPS-027');
  expect(Array.isArray(value.expectedTrace)).toBe(true);
  expect(typeof value.traceSha256).toBe('string');
}

function assertSideBySideReplayManifest(value: unknown): asserts value is SideBySideReplayManifest {
  assertRecord(value, 'side-by-side replay manifest');
  expect(value.targetReplayContract).toBeDefined();
  expect(value.commandContracts).toBeDefined();
  expect(Array.isArray(value.explicitNullSurfaces)).toBe(true);
  expect(Array.isArray(value.sourceHashes)).toBe(true);
}

async function loadFixture(): Promise<ScriptedPickupFixture> {
  const value: unknown = await Bun.file(fixturePath).json();
  assertScriptedPickupFixture(value);
  return value;
}

async function loadManifest(): Promise<SideBySideReplayManifest> {
  const value: unknown = await Bun.file(manifestPath).json();
  assertSideBySideReplayManifest(value);
  return value;
}

describe('capture-scripted-pickup-path oracle', () => {
  test('locks the command contract and capture window', async () => {
    const fixture = await loadFixture();

    expect(fixture.captureCommand).toEqual({
      arguments: ['--iwad', 'doom/DOOM1.WAD', '--reference-binary', 'doom/DOOMD.EXE', '--script', 'capture-scripted-pickup-path', '--map', 'E1M1', '--skill', '2'],
      mode: 'deterministic-reference-capture-contract',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(fixture.captureWindow).toEqual({
      endTic: 280,
      frameRateHz: 35,
      map: 'E1M1',
      sampledTics: [0, 35, 70, 105, 140, 175, 210, 245, 246, 280],
      skill: 2,
      startTic: 0,
    });
  });

  test('locks the scripted pickup trace and hash', async () => {
    const fixture = await loadFixture();
    const hasher = new Bun.CryptoHasher('sha256');

    hasher.update(JSON.stringify(fixture.expectedTrace));

    expect(hasher.digest('hex')).toBe(fixture.traceSha256);
    expect(fixture.traceSha256).toBe('23cb97d5e35c896a189bc3f80b4993b64b9925398f453ed3178717aa699987bc');
    expect(fixture.expectedTrace).toContainEqual({
      pickup: 'first-route-pickup',
      phase: 'gameplay',
      state: 'pickup-contact',
      tic: 245,
    });
    expect(fixture.expectedTrace.at(-1)).toEqual({
      phase: 'gameplay',
      result: 'continued-E1M1-gameplay',
      state: 'post-pickup-stable',
      tic: 280,
    });
  });

  test('cross-checks source authority against the source catalog', async () => {
    const fixture = await loadFixture();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    for (const source of fixture.sourceAuthority) {
      expect(sourceCatalog).toContain(`| ${source.id} |`);
      expect(sourceCatalog).toContain(`| ${source.authority} |`);
      expect(sourceCatalog).toContain(`\`${source.path}\``);
    }
  });

  test('inherits pending live-hash gaps from the 01-015 manifest', async () => {
    const fixture = await loadFixture();
    const manifest = await loadManifest();
    const explicitNullSurfaces = new Set(manifest.explicitNullSurfaces.map((surface) => surface.surface));

    expect(fixture.captureCommand.runtimeCommand).toBe(manifest.commandContracts.targetPlayable.runtimeCommand);
    expect(fixture.sourceManifest).toBe(manifestPath);
    expect(fixture.inheritedLaunchSurfaceSourceHashes).toEqual(manifest.sourceHashes);
    expect(manifest.targetReplayContract).toEqual({
      acceptanceMode: 'side-by-side-verifiable replay parity',
      currentVisibility: 'missing in allowed launch-surface files',
      requiredCommand: 'bun run doom.ts',
    });
    expect(explicitNullSurfaces.has('reference-oracle-replay-capture')).toBe(true);
    expect(explicitNullSurfaces.has('framebuffer-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('audio-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('state-hash-comparison')).toBe(true);
    expect(fixture.pendingLiveHashes).toEqual([
      {
        kind: 'framebuffer',
        reason: 'No reference oracle replay capture surface is exposed by the allowed 01-015 launch-surface manifest.',
        status: 'pending',
      },
      {
        kind: 'audio',
        reason: 'No audio hash comparison surface is exposed by the allowed 01-015 launch-surface manifest.',
        status: 'pending',
      },
      {
        kind: 'state',
        reason: 'No state hash comparison surface is exposed by the allowed 01-015 launch-surface manifest.',
        status: 'pending',
      },
    ]);
  });

  test('registers the oracle artifact', async () => {
    const fixture = await loadFixture();
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();

    expect(oracleRegistry).toContain(
      `| ${fixture.oracleId} | \`${fixturePath}\` | scripted pickup path capture contract derived from local DOS binary authority and \`${manifestPath}\` | \`bun test test/oracles/capture-scripted-pickup-path.test.ts\` |`,
    );
  });
});
