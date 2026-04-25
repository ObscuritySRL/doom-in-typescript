import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  arguments: string[];
  executable: string;
  mode: string;
  workingDirectory: string;
};

type CaptureWindow = {
  endFrame: number;
  endTic: number;
  framePolicy: string;
  startFrame: number;
  startTic: number;
};

type ControlChange = {
  axis: string;
  direction: string;
  stepDelta: number;
};

type ExpectedTraceEntry = {
  control?: ControlChange;
  frame: number;
  menu: string | null;
  selectedItem: string | null;
  state: string;
  tic: number;
};

type InputEvent = {
  action: string;
  key: string;
  target: string;
  tic: number;
};

type LaunchSurfaceManifest = {
  explicitNullSurfaces: {
    reason: string;
    surface: string;
  }[];
  schemaVersion: number;
  sourceHashes: SourceHash[];
  stepId: string;
  stepTitle: string;
};

type OracleFixture = {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: ExpectedTraceEntry[];
  inheritedLaunchSurfaceSourceHashes: SourceHash[];
  inputSequence: InputEvent[];
  pendingLiveHashes: PendingLiveHash[];
  schemaVersion: number;
  sourceAuthority: SourceAuthority;
  sourceCatalogEvidence: SourceCatalogEvidence[];
  sourceManifest: SourceManifest;
  stepId: string;
  stepTitle: string;
  traceSha256: string;
};

type PendingLiveHash = {
  hashKind: string;
  reason: string;
  status: string;
};

type SourceAuthority = {
  binary: SourceAuthorityEntry;
  data: SourceAuthorityEntry;
  mode: string;
};

type SourceAuthorityEntry = {
  authority: string;
  path: string;
  sourceCatalogId: string;
};

type SourceCatalogEvidence = {
  authority: string;
  path: string;
  source: string;
  sourceCatalogId: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type SourceManifest = {
  path: string;
  schemaVersion: number;
  stepId: string;
  stepTitle: string;
};

const FIXTURE_PATH = 'test/oracles/fixtures/capture-screen-size-detail-gamma-paths.json';
const LAUNCH_SURFACE_MANIFEST_PATH = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const REFERENCE_ORACLES_PATH = 'plan_fps/REFERENCE_ORACLES.md';
const SOURCE_CATALOG_PATH = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture: OracleFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD'],
    executable: 'doom/DOOMD.EXE',
    mode: 'abstract-reference-menu-control-capture',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 19,
    endTic: 19,
    framePolicy: 'one abstract oracle frame per captured menu-control tic',
    startFrame: 0,
    startTic: 0,
  },
  expectedTrace: [
    {
      frame: 0,
      menu: null,
      selectedItem: null,
      state: 'attract-loop-title',
      tic: 0,
    },
    {
      frame: 1,
      menu: 'main',
      selectedItem: 'new-game',
      state: 'main-menu-open',
      tic: 1,
    },
    {
      frame: 3,
      menu: 'main',
      selectedItem: 'options',
      state: 'main-menu-selection',
      tic: 3,
    },
    {
      frame: 5,
      menu: 'options',
      selectedItem: 'end-game',
      state: 'options-menu-open',
      tic: 5,
    },
    {
      frame: 7,
      menu: 'options',
      selectedItem: 'messages',
      state: 'options-menu-selection',
      tic: 7,
    },
    {
      frame: 9,
      menu: 'options',
      selectedItem: 'detail',
      state: 'options-menu-selection',
      tic: 9,
    },
    {
      frame: 11,
      menu: 'options',
      selectedItem: 'screen-size',
      state: 'options-menu-selection',
      tic: 11,
    },
    {
      control: {
        axis: 'screen-size',
        direction: 'increase',
        stepDelta: 1,
      },
      frame: 13,
      menu: 'options',
      selectedItem: 'screen-size',
      state: 'screen-size-adjusted',
      tic: 13,
    },
    {
      frame: 15,
      menu: 'options',
      selectedItem: 'detail',
      state: 'options-menu-selection',
      tic: 15,
    },
    {
      control: {
        axis: 'detail',
        direction: 'toggle',
        stepDelta: 1,
      },
      frame: 17,
      menu: 'options',
      selectedItem: 'detail',
      state: 'detail-mode-toggled',
      tic: 17,
    },
    {
      control: {
        axis: 'gamma-correction',
        direction: 'increase',
        stepDelta: 1,
      },
      frame: 19,
      menu: 'options',
      selectedItem: 'detail',
      state: 'gamma-correction-cycled',
      tic: 19,
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
  inputSequence: [
    {
      action: 'open-main-menu',
      key: 'Escape',
      target: 'main-menu',
      tic: 1,
    },
    {
      action: 'select-options',
      key: 'ArrowDown',
      target: 'options',
      tic: 3,
    },
    {
      action: 'open-options-menu',
      key: 'Enter',
      target: 'options-menu',
      tic: 5,
    },
    {
      action: 'select-messages',
      key: 'ArrowDown',
      target: 'messages',
      tic: 7,
    },
    {
      action: 'select-detail',
      key: 'ArrowDown',
      target: 'detail',
      tic: 9,
    },
    {
      action: 'select-screen-size',
      key: 'ArrowDown',
      target: 'screen-size',
      tic: 11,
    },
    {
      action: 'increase-screen-size',
      key: 'ArrowRight',
      target: 'screen-size',
      tic: 13,
    },
    {
      action: 'select-detail',
      key: 'ArrowUp',
      target: 'detail',
      tic: 15,
    },
    {
      action: 'toggle-detail',
      key: 'Enter',
      target: 'detail',
      tic: 17,
    },
    {
      action: 'cycle-gamma-correction',
      key: 'F11',
      target: 'gamma-correction',
      tic: 19,
    },
  ],
  pendingLiveHashes: [
    {
      hashKind: 'audio',
      reason: 'No audio hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-reference-capture-surface',
    },
    {
      hashKind: 'framebuffer',
      reason: 'No framebuffer hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-reference-capture-surface',
    },
    {
      hashKind: 'state',
      reason: 'No state hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-reference-capture-surface',
    },
  ],
  schemaVersion: 1,
  sourceAuthority: {
    binary: {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      sourceCatalogId: 'S-FPS-005',
    },
    data: {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      sourceCatalogId: 'S-FPS-006',
    },
    mode: 'local DOS binary authority plus local IWAD data, represented as an abstract capture contract because this step cannot execute reference binaries',
  },
  sourceCatalogEvidence: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      source: 'local DOS executable',
      sourceCatalogId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      source: 'local IWAD',
      sourceCatalogId: 'S-FPS-006',
    },
  ],
  sourceManifest: {
    path: LAUNCH_SURFACE_MANIFEST_PATH,
    schemaVersion: 1,
    stepId: '01-015',
    stepTitle: 'audit-missing-side-by-side-replay',
  },
  stepId: '02-016',
  stepTitle: 'capture-screen-size-detail-gamma-paths',
  traceSha256: 'b3a24ab51038157cd702471239085a41b826a23f63d0bde05e0663c6dbe06c57',
};

function createSha256(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(value));
  return hasher.digest('hex');
}

describe('capture-screen-size-detail-gamma-paths oracle', () => {
  test('locks the exact fixture contract', async () => {
    const fixture: OracleFixture = await Bun.file(FIXTURE_PATH).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the trace hash and control transitions', async () => {
    const fixture: OracleFixture = await Bun.file(FIXTURE_PATH).json();

    expect(createSha256(fixture.expectedTrace)).toBe(fixture.traceSha256);
    expect(fixture.expectedTrace.map((entry) => entry.state)).toEqual([
      'attract-loop-title',
      'main-menu-open',
      'main-menu-selection',
      'options-menu-open',
      'options-menu-selection',
      'options-menu-selection',
      'options-menu-selection',
      'screen-size-adjusted',
      'options-menu-selection',
      'detail-mode-toggled',
      'gamma-correction-cycled',
    ]);
    expect(fixture.expectedTrace[7]?.control).toEqual({
      axis: 'screen-size',
      direction: 'increase',
      stepDelta: 1,
    });
    expect(fixture.expectedTrace[9]?.control).toEqual({
      axis: 'detail',
      direction: 'toggle',
      stepDelta: 1,
    });
    expect(fixture.expectedTrace[10]?.control).toEqual({
      axis: 'gamma-correction',
      direction: 'increase',
      stepDelta: 1,
    });
  });

  test('locks the command contract and tick window', async () => {
    const fixture: OracleFixture = await Bun.file(FIXTURE_PATH).json();

    expect(fixture.captureCommand).toEqual({
      arguments: ['-iwad', 'doom/DOOM1.WAD'],
      executable: 'doom/DOOMD.EXE',
      mode: 'abstract-reference-menu-control-capture',
      workingDirectory: 'D:/Projects/doom-in-typescript',
    });
    expect(fixture.captureWindow).toEqual({
      endFrame: 19,
      endTic: 19,
      framePolicy: 'one abstract oracle frame per captured menu-control tic',
      startFrame: 0,
      startTic: 0,
    });
    expect(fixture.inputSequence.map((event) => event.tic)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
  });

  test('cross-checks source authority and pending hash surfaces', async () => {
    const fixture: OracleFixture = await Bun.file(FIXTURE_PATH).json();
    const launchSurfaceManifest: LaunchSurfaceManifest = await Bun.file(LAUNCH_SURFACE_MANIFEST_PATH).json();
    const sourceCatalog = await Bun.file(SOURCE_CATALOG_PATH).text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(fixture.inheritedLaunchSurfaceSourceHashes).toEqual(launchSurfaceManifest.sourceHashes);
    expect(fixture.sourceManifest).toEqual({
      path: LAUNCH_SURFACE_MANIFEST_PATH,
      schemaVersion: launchSurfaceManifest.schemaVersion,
      stepId: launchSurfaceManifest.stepId,
      stepTitle: launchSurfaceManifest.stepTitle,
    });
    expect(launchSurfaceManifest.explicitNullSurfaces.map((surface) => surface.surface)).toEqual(expect.arrayContaining(['audio-hash-comparison', 'framebuffer-hash-comparison', 'reference-oracle-replay-capture', 'state-hash-comparison']));
    expect(fixture.pendingLiveHashes.map((hash) => hash.hashKind)).toEqual(['audio', 'framebuffer', 'state']);

    for (const pendingHash of fixture.pendingLiveHashes) {
      expect(pendingHash.status).toBe('pending-reference-capture-surface');
      expect(pendingHash.reason.length).toBeGreaterThan(0);
    }
  });

  test('locks the structural invariants of the trace, input sequence, and capture window', async () => {
    const fixture: OracleFixture = await Bun.file(FIXTURE_PATH).json();
    const traceFrames = fixture.expectedTrace.map((entry) => entry.frame);
    const traceTics = fixture.expectedTrace.map((entry) => entry.tic);
    const inputTics = fixture.inputSequence.map((event) => event.tic);

    expect(traceFrames).toEqual([...traceFrames].sort((left, right) => left - right));
    expect(traceTics).toEqual([...traceTics].sort((left, right) => left - right));
    expect(inputTics).toEqual([...inputTics].sort((left, right) => left - right));
    expect(new Set(traceFrames).size).toBe(traceFrames.length);
    expect(new Set(traceTics).size).toBe(traceTics.length);
    expect(new Set(inputTics).size).toBe(inputTics.length);
    expect(fixture.captureWindow.startFrame).toBe(0);
    expect(fixture.captureWindow.startTic).toBe(0);
    expect(fixture.captureWindow.endFrame).toBe(fixture.captureWindow.endTic);
    expect(fixture.expectedTrace.at(0)?.frame).toBe(fixture.captureWindow.startFrame);
    expect(fixture.expectedTrace.at(0)?.tic).toBe(fixture.captureWindow.startTic);
    expect(fixture.expectedTrace.at(-1)?.frame).toBe(fixture.captureWindow.endFrame);
    expect(fixture.expectedTrace.at(-1)?.tic).toBe(fixture.captureWindow.endTic);

    for (const event of fixture.inputSequence) {
      expect(traceTics).toContain(event.tic);
    }
  });

  test('is registered as OR-FPS-021', async () => {
    const referenceOracles = await Bun.file(REFERENCE_ORACLES_PATH).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-021 | `test/oracles/fixtures/capture-screen-size-detail-gamma-paths.json` | screen size, detail, and gamma path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-screen-size-detail-gamma-paths.test.ts` |',
    );
  });
});
