import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-menu-open-close-behavior.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

interface CaptureCommand {
  arguments: string[];
  binaryPath: string;
  commandLine: string;
  inputSequence: InputEvent[];
  iwadPath: string;
  scenario: string;
  status: string;
  targetRuntimeCommand: string;
}

interface CaptureWindow {
  endFrame: number;
  endTic: number;
  frameRateMode: string;
  startFrame: number;
  startTic: number;
  ticRateHz: number;
}

interface ExpectedHashes {
  traceSerialization: string;
  traceSha256: string;
}

interface InputEvent {
  input: string;
  tic: number;
}

interface MenuOpenCloseFixture {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedHashes: ExpectedHashes;
  expectedTrace: TraceEntry[];
  pendingLiveCapture: PendingLiveCapture;
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  sourceHashes: SourceHash[];
  stepId: string;
  stepTitle: string;
}

interface PendingLiveCapture {
  reason: string;
  surfaces: string[];
}

interface SideBySideReplayManifest {
  commandContracts: {
    targetPlayable: {
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: {
    path: string | null;
    surface: string;
  }[];
  schemaVersion: number;
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

interface TraceEntry {
  activeMenu: string | null;
  activeScreen: string;
  frame: number;
  input: string;
  menuState: string;
  selectedItem: string | null;
  soundEvent: string | null;
  tic: number;
  transition: string;
}

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD', '-skill', '2'],
    binaryPath: 'doom/DOOMD.EXE',
    commandLine: 'doom/DOOMD.EXE -iwad doom/DOOM1.WAD -skill 2',
    inputSequence: [
      {
        input: 'keydown:Escape',
        tic: 1,
      },
      {
        input: 'keyup:Escape',
        tic: 2,
      },
      {
        input: 'keydown:Escape',
        tic: 17,
      },
      {
        input: 'keyup:Escape',
        tic: 18,
      },
    ],
    iwadPath: 'doom/DOOM1.WAD',
    scenario: 'menu-open-close-behavior',
    status: 'static-contract-pending-live-reference-capture',
    targetRuntimeCommand: 'bun run doom.ts',
  },
  captureWindow: {
    endFrame: 18,
    endTic: 18,
    frameRateMode: 'one-frame-per-visible-tic',
    startFrame: 0,
    startTic: 0,
    ticRateHz: 35,
  },
  expectedHashes: {
    traceSerialization: 'JSON.stringify(expectedTrace)',
    traceSha256: 'aa425fc70db080d98adc293577191e3411d5c8157a55b63e29b7d3d62385d748',
  },
  expectedTrace: [
    {
      activeMenu: null,
      activeScreen: 'title-loop',
      frame: 0,
      input: 'none',
      menuState: 'closed',
      selectedItem: null,
      soundEvent: null,
      tic: 0,
      transition: 'baseline-closed',
    },
    {
      activeMenu: 'main',
      activeScreen: 'menu-overlay',
      frame: 1,
      input: 'keydown:Escape',
      menuState: 'open',
      selectedItem: 'new game',
      soundEvent: 'swtchn',
      tic: 1,
      transition: 'open-main-menu',
    },
    {
      activeMenu: 'main',
      activeScreen: 'menu-overlay',
      frame: 2,
      input: 'keyup:Escape',
      menuState: 'open',
      selectedItem: 'new game',
      soundEvent: null,
      tic: 2,
      transition: 'hold-open',
    },
    {
      activeMenu: null,
      activeScreen: 'title-loop',
      frame: 17,
      input: 'keydown:Escape',
      menuState: 'closed',
      selectedItem: null,
      soundEvent: 'swtchx',
      tic: 17,
      transition: 'close-menu',
    },
    {
      activeMenu: null,
      activeScreen: 'title-loop',
      frame: 18,
      input: 'keyup:Escape',
      menuState: 'closed',
      selectedItem: null,
      soundEvent: null,
      tic: 18,
      transition: 'hold-closed',
    },
  ],
  pendingLiveCapture: {
    reason: 'The 02-010 step read scope does not permit opening or executing local reference binaries directly.',
    surfaces: ['framebuffer-hash', 'audio-hash', 'state-hash'],
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'reference binary',
      source: 'local DOS executable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'reference data',
      source: 'local IWAD',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      role: 'current launcher evidence',
      source: 'current launcher entry',
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
  stepId: '02-010',
  stepTitle: 'capture-menu-open-close-behavior',
} satisfies MenuOpenCloseFixture;

const loadFixture = async (): Promise<MenuOpenCloseFixture> => {
  const fixture: MenuOpenCloseFixture = await Bun.file(fixturePath).json();

  return fixture;
};

const loadManifest = async (): Promise<SideBySideReplayManifest> => {
  const manifest: SideBySideReplayManifest = await Bun.file(manifestPath).json();

  return manifest;
};

const sha256Json = (value: unknown): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');

describe('capture menu open close behavior oracle', () => {
  test('locks the fixture exactly', async () => {
    expect(await loadFixture()).toEqual(expectedFixture);
  });

  test('locks the menu open and close transitions', async () => {
    const fixture = await loadFixture();

    expect(fixture.captureCommand.inputSequence).toEqual([
      { input: 'keydown:Escape', tic: 1 },
      { input: 'keyup:Escape', tic: 2 },
      { input: 'keydown:Escape', tic: 17 },
      { input: 'keyup:Escape', tic: 18 },
    ]);
    expect(fixture.expectedTrace.map(({ transition }) => transition)).toEqual(['baseline-closed', 'open-main-menu', 'hold-open', 'close-menu', 'hold-closed']);
    expect(fixture.expectedTrace[1]).toMatchObject({
      input: 'keydown:Escape',
      menuState: 'open',
      selectedItem: 'new game',
      soundEvent: 'swtchn',
      transition: 'open-main-menu',
    });
    expect(fixture.expectedTrace[3]).toMatchObject({
      input: 'keydown:Escape',
      menuState: 'closed',
      soundEvent: 'swtchx',
      transition: 'close-menu',
    });
  });

  test('recomputes the exact trace hash', async () => {
    const fixture = await loadFixture();

    expect(sha256Json(fixture.expectedTrace)).toBe(fixture.expectedHashes.traceSha256);
  });

  test('cross-checks source authority and launch-surface manifest evidence', async () => {
    const fixture = await loadFixture();
    const manifest = await loadManifest();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(manifest.schemaVersion).toBe(1);
    expect(fixture.captureCommand.targetRuntimeCommand).toBe(manifest.commandContracts.targetPlayable.runtimeCommand);
    expect(fixture.sourceHashes).toEqual(manifest.sourceHashes);
    expect(manifest.explicitNullSurfaces.some(({ path, surface }) => surface === 'reference-oracle-replay-capture' && path === null)).toBe(true);

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` | Preferred local binary authority when usable. |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` | Shareware IWAD data. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-015 | `test/oracles/fixtures/capture-menu-open-close-behavior.json` | menu open/close capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-menu-open-close-behavior.test.ts` |',
    );
  });
});
