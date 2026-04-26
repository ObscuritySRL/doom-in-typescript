import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  arguments: string[];
  mode: string;
  runtimeCommand: string;
};

type CaptureWindow = {
  endTic: number;
  frameRateHz: number;
  map: string;
  sampledTics: number[];
  skill: number;
  startTic: number;
};

type ExpectedTraceEntry = {
  command?: string;
  frame?: string;
  input?: string;
  map?: string;
  phase: 'startup' | 'title' | 'menu' | 'gameplay';
  pickup?: string;
  result?: string;
  selection?: string;
  state: string;
  tic: number;
};

type InheritedSourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type PendingLiveHash = {
  kind: 'audio' | 'framebuffer' | 'state';
  reason: string;
  status: 'pending';
};

type SourceAuthority = {
  authority: string;
  id: string;
  path: string;
  role: string;
};

type ScriptedPickupPathOracleFixture = {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: ExpectedTraceEntry[];
  inheritedLaunchSurfaceSourceHashes: InheritedSourceHash[];
  oracleId: string;
  pendingLiveHashes: PendingLiveHash[];
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
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
  sourceHashes: InheritedSourceHash[];
  targetReplayContract: {
    acceptanceMode: string;
    currentVisibility: string;
    requiredCommand: string;
  };
};

const fixturePath = 'test/oracles/fixtures/capture-scripted-pickup-path.json';
const sideBySideReplayManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const ALLOWED_PHASES: ReadonlySet<string> = new Set(['startup', 'title', 'menu', 'gameplay']);

const expectedFixture = {
  captureCommand: {
    arguments: ['--iwad', 'doom/DOOM1.WAD', '--reference-binary', 'doom/DOOMD.EXE', '--script', 'capture-scripted-pickup-path', '--map', 'E1M1', '--skill', '2'],
    mode: 'deterministic-reference-capture-contract',
    runtimeCommand: 'bun run doom.ts',
  },
  captureWindow: {
    endTic: 280,
    frameRateHz: 35,
    map: 'E1M1',
    sampledTics: [0, 35, 70, 105, 140, 175, 210, 245, 246, 280],
    skill: 2,
    startTic: 0,
  },
  expectedTrace: [
    { tic: 0, phase: 'startup', state: 'clean-launch', frame: 'process-created' },
    { tic: 35, phase: 'title', state: 'title-screen', input: 'KeyEnter' },
    { tic: 70, phase: 'menu', state: 'main-menu', selection: 'New Game' },
    { tic: 105, phase: 'menu', state: 'episode-menu', selection: 'Knee-Deep in the Dead' },
    { tic: 140, phase: 'menu', state: 'skill-menu', selection: 'Hey, Not Too Rough' },
    { tic: 175, phase: 'gameplay', state: 'E1M1-start', map: 'E1M1' },
    { tic: 210, phase: 'gameplay', state: 'scripted-movement', command: 'forward' },
    { tic: 245, phase: 'gameplay', state: 'pickup-contact', pickup: 'first-route-pickup' },
    { tic: 246, phase: 'gameplay', state: 'pickup-applied', result: 'inventory-or-stat-change-observed' },
    { tic: 280, phase: 'gameplay', state: 'post-pickup-stable', result: 'continued-E1M1-gameplay' },
  ],
  inheritedLaunchSurfaceSourceHashes: [
    { path: 'package.json', sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe', sizeBytes: 569 },
    { path: 'src/main.ts', sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44', sizeBytes: 3239 },
    { path: 'tsconfig.json', sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62', sizeBytes: 645 },
  ],
  oracleId: 'OR-FPS-027',
  pendingLiveHashes: [
    { kind: 'framebuffer', reason: 'No reference oracle replay capture surface is exposed by the allowed 01-015 launch-surface manifest.', status: 'pending' },
    { kind: 'audio', reason: 'No audio hash comparison surface is exposed by the allowed 01-015 launch-surface manifest.', status: 'pending' },
    { kind: 'state', reason: 'No state hash comparison surface is exposed by the allowed 01-015 launch-surface manifest.', status: 'pending' },
  ],
  schemaVersion: 1,
  sourceAuthority: [
    { authority: 'local-primary-binary', id: 'S-FPS-005', path: 'doom/DOOMD.EXE', role: 'reference-binary' },
    { authority: 'local-primary-data', id: 'S-FPS-006', path: 'doom/DOOM1.WAD', role: 'reference-iwad' },
    { authority: 'local-primary', id: 'S-FPS-011', path: 'src/main.ts', role: 'allowed-launch-surface' },
  ],
  sourceManifest: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
  stepId: '02-022',
  stepTitle: 'capture-scripted-pickup-path',
  traceSha256: '23cb97d5e35c896a189bc3f80b4993b64b9925398f453ed3178717aa699987bc',
} satisfies ScriptedPickupPathOracleFixture;

const hashJson = (value: unknown): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');

describe('capture-scripted-pickup-path oracle', () => {
  test('locks the exact scripted pickup fixture', async () => {
    await expect(Bun.file(fixturePath).json()).resolves.toEqual(expectedFixture);
  });

  test('recomputes the on-disk trace hash and locks structural invariants', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as ScriptedPickupPathOracleFixture;

    expect(fixture.traceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(hashJson(fixture.expectedTrace)).toBe(fixture.traceSha256);

    const traceTics = fixture.expectedTrace.map((entry) => entry.tic);
    expect(traceTics).toEqual([...traceTics].sort((leftTic, rightTic) => leftTic - rightTic));
    expect(new Set(traceTics).size).toBe(traceTics.length);

    const stateNames = fixture.expectedTrace.map((entry) => entry.state);
    expect(new Set(stateNames).size).toBe(stateNames.length);

    for (const entry of fixture.expectedTrace) {
      expect(Number.isInteger(entry.tic)).toBe(true);
      expect(entry.tic).toBeGreaterThanOrEqual(0);
      expect(entry.phase.length).toBeGreaterThan(0);
      expect(entry.state.length).toBeGreaterThan(0);
      expect(ALLOWED_PHASES.has(entry.phase)).toBe(true);
    }

    expect(fixture.captureWindow.startTic).toBe(fixture.expectedTrace[0]!.tic);
    expect(fixture.captureWindow.endTic).toBe(fixture.expectedTrace[fixture.expectedTrace.length - 1]!.tic);
    expect(fixture.captureWindow.sampledTics).toEqual(traceTics);
    expect(fixture.captureWindow.frameRateHz).toBe(35);
    expect(fixture.captureWindow.skill).toBe(2);
    expect(fixture.captureWindow.map).toBe('E1M1');

    for (const sourceHash of fixture.inheritedLaunchSurfaceSourceHashes) {
      expect(sourceHash.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(sourceHash.sizeBytes).toBeGreaterThan(0);
      expect(sourceHash.path.length).toBeGreaterThan(0);
    }
  });

  test('locks the menu progression and the pickup-contact / pickup-applied transition', () => {
    expect(expectedFixture.expectedTrace[0]).toEqual({ tic: 0, phase: 'startup', state: 'clean-launch', frame: 'process-created' });
    expect(expectedFixture.expectedTrace.at(-1)).toEqual({ tic: 280, phase: 'gameplay', state: 'post-pickup-stable', result: 'continued-E1M1-gameplay' });
    expect(expectedFixture.expectedTrace).toContainEqual({ tic: 245, phase: 'gameplay', state: 'pickup-contact', pickup: 'first-route-pickup' });
    expect(expectedFixture.expectedTrace).toContainEqual({ tic: 246, phase: 'gameplay', state: 'pickup-applied', result: 'inventory-or-stat-change-observed' });

    const stateOrder = expectedFixture.expectedTrace.map((entry) => entry.state);
    const pickupContactIndex = stateOrder.indexOf('pickup-contact');
    const pickupAppliedIndex = stateOrder.indexOf('pickup-applied');
    const postPickupIndex = stateOrder.indexOf('post-pickup-stable');
    expect(pickupContactIndex).toBeGreaterThanOrEqual(0);
    expect(pickupAppliedIndex).toBeGreaterThan(pickupContactIndex);
    expect(postPickupIndex).toBeGreaterThan(pickupAppliedIndex);

    const pickupContactEntry = expectedFixture.expectedTrace[pickupContactIndex]!;
    const pickupAppliedEntry = expectedFixture.expectedTrace[pickupAppliedIndex]!;
    expect(pickupAppliedEntry.tic).toBe(pickupContactEntry.tic + 1);
  });

  test('cross-checks source authority and the side-by-side audit manifest', async () => {
    const sourceCatalogText = await Bun.file(sourceCatalogPath).text();
    const sideBySideReplayManifest = (await Bun.file(sideBySideReplayManifestPath).json()) as SideBySideReplayManifest;

    expect(expectedFixture.captureCommand.runtimeCommand).toBe(sideBySideReplayManifest.commandContracts.targetPlayable.runtimeCommand);
    expect(expectedFixture.sourceManifest).toBe(sideBySideReplayManifestPath);
    expect(expectedFixture.inheritedLaunchSurfaceSourceHashes).toEqual(sideBySideReplayManifest.sourceHashes);
    expect(sideBySideReplayManifest.targetReplayContract).toEqual({
      acceptanceMode: 'side-by-side-verifiable replay parity',
      currentVisibility: 'missing in allowed launch-surface files',
      requiredCommand: 'bun run doom.ts',
    });

    const explicitNullSurfaces = new Set(sideBySideReplayManifest.explicitNullSurfaces.map((surface) => surface.surface));
    expect(explicitNullSurfaces.has('reference-oracle-replay-capture')).toBe(true);
    expect(explicitNullSurfaces.has('framebuffer-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('audio-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('state-hash-comparison')).toBe(true);

    for (const sourceAuthorityEntry of expectedFixture.sourceAuthority) {
      const catalogRow = sourceCatalogText.split('\n').find((line) => line.startsWith(`| ${sourceAuthorityEntry.id} |`));
      expect(catalogRow).toBeDefined();
      expect(catalogRow).toContain(`| ${sourceAuthorityEntry.authority} |`);
      expect(catalogRow).toContain(`\`${sourceAuthorityEntry.path}\``);
    }
  });

  test('records pending live hash gaps and oracle registration', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as ScriptedPickupPathOracleFixture;
    const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

    const liveHashKinds = fixture.pendingLiveHashes.map((entry) => entry.kind);
    expect([...liveHashKinds].sort()).toEqual(['audio', 'framebuffer', 'state']);
    expect(new Set(liveHashKinds).size).toBe(liveHashKinds.length);

    for (const entry of fixture.pendingLiveHashes) {
      expect(entry.status).toBe('pending');
      expect(entry.reason.length).toBeGreaterThan(0);
    }

    expect(referenceOraclesText).toContain(
      `| ${fixture.oracleId} | \`${fixturePath}\` | scripted pickup path capture contract derived from local DOS binary authority and \`${sideBySideReplayManifestPath}\` | \`bun test test/oracles/capture-scripted-pickup-path.test.ts\` |`,
    );
  });

  test('matches the inherited launch-surface hashes against live source files', async () => {
    for (const sourceHash of expectedFixture.inheritedLaunchSurfaceSourceHashes) {
      const fileBytes = await Bun.file(sourceHash.path).bytes();
      const liveSha256 = new Bun.CryptoHasher('sha256').update(fileBytes).digest('hex');
      expect(liveSha256).toBe(sourceHash.sha256);
      expect(fileBytes.byteLength).toBe(sourceHash.sizeBytes);
    }
  });
});
