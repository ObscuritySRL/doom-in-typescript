import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-scripted-movement-path.json';
const launchSurfaceManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['--iwad', 'doom/DOOM1.WAD', '--scripted-input', 'capture-scripted-movement-path', '--capture-window', 'e1m1-scripted-movement'],
    description: 'Replay a deterministic clean-launch movement script and capture the E1M1 movement window.',
    environment: {
      DOOM_CAPTURE_MODE: 'reference-oracle',
      DOOM_CAPTURE_STEP: '02-020',
    },
    runtimeCommand: 'bun run doom.ts',
    targetCommandContract: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  expectedTrace: [
    {
      event: 'clean-launch',
      frame: 0,
      state: 'attract-title',
      tic: 0,
    },
    {
      event: 'open-main-menu',
      frame: 1,
      input: ['Escape'],
      state: 'main-menu',
      tic: 1,
    },
    {
      event: 'select-new-game',
      frame: 2,
      input: ['Enter'],
      state: 'episode-menu',
      tic: 2,
    },
    {
      event: 'select-knee-deep-in-the-dead',
      frame: 3,
      input: ['Enter'],
      state: 'skill-menu',
      tic: 3,
    },
    {
      event: 'select-hurt-me-plenty',
      frame: 4,
      input: ['Enter'],
      map: 'E1M1',
      state: 'level-start',
      tic: 4,
    },
    {
      event: 'spawn-player',
      frame: 5,
      map: 'E1M1',
      state: 'gameplay',
      tic: 5,
    },
    {
      angle: 'east',
      event: 'hold-forward',
      frame: 40,
      input: ['ArrowUp'],
      map: 'E1M1',
      movement: 'advance-from-spawn',
      state: 'gameplay',
      tic: 40,
    },
    {
      angle: 'east-turning-south',
      event: 'turn-right-while-moving',
      frame: 70,
      input: ['ArrowUp', 'ArrowRight'],
      map: 'E1M1',
      movement: 'arc-right-from-spawn-hall',
      state: 'gameplay',
      tic: 70,
    },
    {
      angle: 'south',
      event: 'release-forward',
      frame: 96,
      input: ['ArrowRight'],
      map: 'E1M1',
      movement: 'complete-scripted-movement-window',
      state: 'gameplay',
      tic: 96,
    },
  ],
  hashStatus: [
    {
      hash: null,
      kind: 'audio',
      reason: 'The 02-020 read scope does not permit executing the local DOS binary or a reference capture bridge.',
      status: 'pending-reference-capture',
    },
    {
      hash: null,
      kind: 'framebuffer',
      reason: 'The 02-020 read scope does not permit executing the local DOS binary or a reference capture bridge.',
      status: 'pending-reference-capture',
    },
    {
      hash: null,
      kind: 'state',
      reason: 'The 02-020 read scope does not permit executing the local DOS binary or a reference capture bridge.',
      status: 'pending-reference-capture',
    },
  ],
  inheritedLaunchSurface: {
    manifestPath: launchSurfaceManifestPath,
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
    targetReplayContract: {
      acceptanceMode: 'side-by-side-verifiable replay parity',
      currentVisibility: 'missing in allowed launch-surface files',
      requiredCommand: 'bun run doom.ts',
    },
  },
  inputScript: {
    description: 'Open the menu from clean launch, start E1M1 on Hurt Me Plenty, then hold forward and turn right through a fixed movement window.',
    name: 'scripted-movement-clean-launch-e1m1',
    sequence: [
      {
        durationTics: 1,
        keys: ['Escape'],
        startTic: 1,
      },
      {
        durationTics: 1,
        keys: ['Enter'],
        startTic: 2,
      },
      {
        durationTics: 1,
        keys: ['Enter'],
        startTic: 3,
      },
      {
        durationTics: 1,
        keys: ['Enter'],
        startTic: 4,
      },
      {
        durationTics: 30,
        keys: ['ArrowUp'],
        startTic: 40,
      },
      {
        durationTics: 26,
        keys: ['ArrowUp', 'ArrowRight'],
        startTic: 70,
      },
      {
        durationTics: 1,
        keys: ['ArrowRight'],
        startTic: 96,
      },
    ],
  },
  oracleIdentifier: 'OR-FPS-025',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      catalogIdentifier: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'preferred reference executable when usable',
    },
    {
      authority: 'local-primary-data',
      catalogIdentifier: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data for the capture',
    },
    {
      authority: 'local-data',
      catalogIdentifier: 'S-FPS-007',
      path: 'iwad/DOOM1.WAD',
      role: 'workspace IWAD copy for implementation replay',
    },
  ],
  stepIdentifier: '02-020',
  stepTitle: 'capture-scripted-movement-path',
  traceSha256: 'c2f7f1028cb3ab46b35ebce9e93274a16415e18e0596265ea7ed0e3a7f8293ea',
  window: {
    captureFrames: [0, 1, 2, 3, 4, 5, 40, 70, 96],
    endFrame: 96,
    endTic: 96,
    map: 'E1M1',
    startFrame: 0,
    startTic: 0,
  },
} as const;

interface CaptureScriptedMovementFixture {
  readonly expectedTrace: readonly { readonly event: string; readonly frame: number; readonly tic: number }[];
  readonly hashStatus: readonly { readonly hash: null; readonly kind: string; readonly reason: string; readonly status: string }[];
  readonly inputScript: { readonly sequence: readonly { readonly durationTics: number; readonly keys: readonly string[]; readonly startTic: number }[] };
  readonly traceSha256: string;
  readonly window: { readonly captureFrames: readonly number[]; readonly endFrame: number; readonly endTic: number; readonly startFrame: number; readonly startTic: number };
}

const hashJson = (value: unknown): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');

describe('capture scripted movement path oracle', () => {
  test('locks the exact fixture structure', async () => {
    await expect(Bun.file(fixturePath).json()).resolves.toEqual(expectedFixture);
  });

  test('recomputes the on-disk trace hash and locks structural invariants', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as CaptureScriptedMovementFixture;

    expect(fixture.traceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(hashJson(fixture.expectedTrace)).toBe(fixture.traceSha256);

    const traceFrames = fixture.expectedTrace.map((entry) => entry.frame);
    const traceTics = fixture.expectedTrace.map((entry) => entry.tic);
    expect(traceFrames).toEqual([...traceFrames].sort((leftFrame, rightFrame) => leftFrame - rightFrame));
    expect(traceTics).toEqual([...traceTics].sort((leftTic, rightTic) => leftTic - rightTic));
    expect(new Set(traceFrames).size).toBe(traceFrames.length);
    expect(new Set(traceTics).size).toBe(traceTics.length);

    const eventNames = fixture.expectedTrace.map((entry) => entry.event);
    expect(new Set(eventNames).size).toBe(eventNames.length);

    expect(fixture.window.startFrame).toBe(fixture.expectedTrace[0]!.frame);
    expect(fixture.window.startTic).toBe(fixture.expectedTrace[0]!.tic);
    expect(fixture.window.endFrame).toBe(fixture.expectedTrace[fixture.expectedTrace.length - 1]!.frame);
    expect(fixture.window.endTic).toBe(fixture.expectedTrace[fixture.expectedTrace.length - 1]!.tic);
    expect(fixture.window.captureFrames).toEqual(traceFrames);

    const inputStartTics = fixture.inputScript.sequence.map((entry) => entry.startTic);
    expect(inputStartTics).toEqual([...inputStartTics].sort((leftTic, rightTic) => leftTic - rightTic));
    for (const entry of fixture.inputScript.sequence) {
      expect(entry.keys.length).toBeGreaterThan(0);
      expect(entry.durationTics).toBeGreaterThan(0);
    }
  });

  test('cross-checks source authority and inherited launch-surface data', async () => {
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();
    const launchSurfaceManifest = (await Bun.file(launchSurfaceManifestPath).json()) as {
      readonly commandContracts: { readonly targetPlayable: unknown };
      readonly sourceHashes: unknown;
      readonly targetReplayContract: unknown;
    };

    for (const sourceAuthority of expectedFixture.sourceAuthority) {
      const catalogRow = sourceCatalog.split('\n').find((line) => line.startsWith(`| ${sourceAuthority.catalogIdentifier} |`));
      expect(catalogRow).toBeDefined();
      expect(catalogRow).toContain(`| ${sourceAuthority.authority} |`);
      expect(catalogRow).toContain(`\`${sourceAuthority.path}\``);
    }

    expect(launchSurfaceManifest.commandContracts.targetPlayable).toEqual(expectedFixture.captureCommand.targetCommandContract);
    expect(launchSurfaceManifest.targetReplayContract).toEqual(expectedFixture.inheritedLaunchSurface.targetReplayContract);
    expect(launchSurfaceManifest.sourceHashes).toEqual(expectedFixture.inheritedLaunchSurface.sourceHashes);
  });

  test('records the three pending live capture surfaces explicitly', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as CaptureScriptedMovementFixture;

    const hashKinds = fixture.hashStatus.map((entry) => entry.kind);
    expect([...hashKinds].sort()).toEqual(['audio', 'framebuffer', 'state']);
    expect(new Set(hashKinds).size).toBe(hashKinds.length);

    for (const entry of fixture.hashStatus) {
      expect(entry.hash).toBeNull();
      expect(entry.status).toBe('pending-reference-capture');
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-025 | `test/oracles/fixtures/capture-scripted-movement-path.json` | scripted movement path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-scripted-movement-path.test.ts` |',
    );
  });
});
