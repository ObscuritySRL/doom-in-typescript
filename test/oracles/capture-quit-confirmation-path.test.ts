import { describe, expect, test } from 'bun:test';

interface CaptureCommand {
  inputSequence: string[];
  iwadPath: string;
  referenceExecutable: string;
  referenceRuntime: string;
  targetPlayableCommand: string;
}

interface CaptureWindow {
  captureFrames: number[];
  endTic: number;
  gameTicRateHz: number;
  startTic: number;
  windowName: string;
}

interface ExplicitNullSurface {
  path: string | null;
  reason: string;
  surface: string;
}

interface LiveHashStatus {
  audioSha256: string | null;
  framebufferSha256: string | null;
  stateSha256: string | null;
  status: string;
}

interface QuitConfirmationFixture {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: TraceEvent[];
  inheritedLaunchSurfaceSourceHashes: SourceHash[];
  liveHashStatus: LiveHashStatus;
  pendingCaptureReason: string;
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  stepId: string;
  stepTitle: string;
  traceSha256: string;
}

interface SideBySideManifest {
  explicitNullSurfaces: ExplicitNullSurface[];
  sourceHashes: SourceHash[];
}

interface SourceAuthority {
  authority: string;
  id: string;
  path: string;
  role: string;
  source: string;
}

interface SourceHash {
  path: string;
  sha256: string;
  sizeBytes: number;
}

interface TraceEvent {
  input: string;
  menu: string;
  result: string;
  sound: string;
  state: string;
  tic: number;
}

const expectedTrace = [
  {
    input: 'Escape',
    menu: 'main',
    result: 'main menu opens with cursor on New Game',
    sound: 'menu-open',
    state: 'main-menu',
    tic: 0,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'cursor moves to Options',
    sound: 'menu-cursor',
    state: 'main-menu',
    tic: 2,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'cursor moves to Load Game',
    sound: 'menu-cursor',
    state: 'main-menu',
    tic: 4,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'cursor moves to Save Game',
    sound: 'menu-cursor',
    state: 'main-menu',
    tic: 6,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'cursor moves to Read This!',
    sound: 'menu-cursor',
    state: 'main-menu',
    tic: 8,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'cursor moves to Quit Game',
    sound: 'menu-cursor',
    state: 'main-menu',
    tic: 10,
  },
  {
    input: 'Enter',
    menu: 'main',
    result: 'quit confirmation message opens and waits for yes or no input',
    sound: 'menu-select',
    state: 'quit-confirmation',
    tic: 12,
  },
  {
    input: 'KeyN',
    menu: 'quit-confirmation',
    result: 'confirmation is canceled and the main menu remains active on Quit Game',
    sound: 'none',
    state: 'main-menu',
    tic: 14,
  },
] satisfies TraceEvent[];

const expectedSourceHashes = [
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
] satisfies SourceHash[];

const expectedFixture = {
  captureCommand: {
    inputSequence: ['Escape', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'KeyN'],
    iwadPath: 'doom/DOOM1.WAD',
    referenceExecutable: 'doom/DOOMD.EXE',
    referenceRuntime: 'local-dos-reference',
    targetPlayableCommand: 'bun run doom.ts',
  },
  captureWindow: {
    captureFrames: [0, 2, 4, 6, 8, 10, 12, 14],
    endTic: 14,
    gameTicRateHz: 35,
    startTic: 0,
    windowName: 'clean-launch-quit-confirmation-cancel',
  },
  expectedTrace,
  inheritedLaunchSurfaceSourceHashes: expectedSourceHashes,
  liveHashStatus: {
    audioSha256: null,
    framebufferSha256: null,
    stateSha256: null,
    status: 'pending-reference-capture-surface',
  },
  pendingCaptureReason:
    'The allowed 02-018 read scope exposes no reference oracle replay capture, framebuffer hash comparison, audio hash comparison, or state hash comparison surface in plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json.',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'preferred reference executable',
      source: 'local DOS executable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'reference IWAD data',
      source: 'local IWAD',
    },
    {
      authority: 'local-primary',
      id: '01-015',
      path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      role: 'allowed launch-surface gap record',
      source: 'side-by-side replay audit manifest',
    },
  ],
  stepId: '02-018',
  stepTitle: 'capture-quit-confirmation-path',
  traceSha256: 'da174a3479ae3dff579c03e67588bf160f0e3f810c28aaa089472b029ab944ad',
} satisfies QuitConfirmationFixture;

const fixturePath = new URL('./fixtures/capture-quit-confirmation-path.json', import.meta.url);
const manifestPath = new URL('../../plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json', import.meta.url);
const referenceOraclesPath = new URL('../../plan_fps/REFERENCE_ORACLES.md', import.meta.url);
const sourceCatalogPath = new URL('../../plan_fps/SOURCE_CATALOG.md', import.meta.url);

const hashJsonValue = (jsonValue: unknown): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(jsonValue)).digest('hex');

describe('capture quit confirmation path oracle', () => {
  test('locks the fixture exactly', async () => {
    const fixture: QuitConfirmationFixture = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('recomputes the deterministic trace hash', async () => {
    const fixture: QuitConfirmationFixture = await Bun.file(fixturePath).json();

    expect(hashJsonValue(fixture.expectedTrace)).toBe(fixture.traceSha256);
    expect(fixture.traceSha256).toBe('da174a3479ae3dff579c03e67588bf160f0e3f810c28aaa089472b029ab944ad');
  });

  test('locks the quit confirmation transition path', async () => {
    const fixture: QuitConfirmationFixture = await Bun.file(fixturePath).json();

    expect(fixture.captureCommand.inputSequence).toEqual(fixture.expectedTrace.map((traceEvent) => traceEvent.input));
    expect(fixture.expectedTrace.map((traceEvent) => traceEvent.result)).toEqual([
      'main menu opens with cursor on New Game',
      'cursor moves to Options',
      'cursor moves to Load Game',
      'cursor moves to Save Game',
      'cursor moves to Read This!',
      'cursor moves to Quit Game',
      'quit confirmation message opens and waits for yes or no input',
      'confirmation is canceled and the main menu remains active on Quit Game',
    ]);
    expect(fixture.expectedTrace.map((traceEvent) => traceEvent.sound)).toEqual(['menu-open', 'menu-cursor', 'menu-cursor', 'menu-cursor', 'menu-cursor', 'menu-cursor', 'menu-select', 'none']);
    expect(fixture.expectedTrace[6]).toEqual({
      input: 'Enter',
      menu: 'main',
      result: 'quit confirmation message opens and waits for yes or no input',
      sound: 'menu-select',
      state: 'quit-confirmation',
      tic: 12,
    });
    expect(fixture.expectedTrace[7]).toEqual({
      input: 'KeyN',
      menu: 'quit-confirmation',
      result: 'confirmation is canceled and the main menu remains active on Quit Game',
      sound: 'none',
      state: 'main-menu',
      tic: 14,
    });
  });

  test('cross-checks source authority and inherited launch-surface hashes', async () => {
    const fixture: QuitConfirmationFixture = await Bun.file(fixturePath).json();
    const manifest: SideBySideManifest = await Bun.file(manifestPath).json();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(fixture.sourceAuthority).toEqual(expectedFixture.sourceAuthority);
    expect(fixture.inheritedLaunchSurfaceSourceHashes).toEqual(manifest.sourceHashes);
  });

  test('records pending live capture gaps and oracle registration', async () => {
    const fixture: QuitConfirmationFixture = await Bun.file(fixturePath).json();
    const manifest: SideBySideManifest = await Bun.file(manifestPath).json();
    const referenceOracles = await Bun.file(referenceOraclesPath).text();
    const missingSurfaces = new Map(manifest.explicitNullSurfaces.map((explicitNullSurface) => [explicitNullSurface.surface, explicitNullSurface]));

    expect(fixture.liveHashStatus).toEqual({
      audioSha256: null,
      framebufferSha256: null,
      stateSha256: null,
      status: 'pending-reference-capture-surface',
    });
    expect(missingSurfaces.get('reference-oracle-replay-capture')).toMatchObject({ path: null });
    expect(missingSurfaces.get('framebuffer-hash-comparison')).toMatchObject({ path: null });
    expect(missingSurfaces.get('audio-hash-comparison')).toMatchObject({ path: null });
    expect(missingSurfaces.get('state-hash-comparison')).toMatchObject({ path: null });
    expect(referenceOracles).toContain(
      '| OR-FPS-023 | `test/oracles/fixtures/capture-quit-confirmation-path.json` | quit confirmation path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-quit-confirmation-path.test.ts` |',
    );
  });
});
