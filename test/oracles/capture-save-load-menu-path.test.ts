import { describe, expect, test } from 'bun:test';

interface CaptureCommand {
  arguments: string[];
  executable: string;
  requiredPlayableCommand: string;
  status: string;
}

interface CaptureWindow {
  endFrame: number;
  endTic: number;
  sampleRateHz: number;
  startFrame: number;
  startTic: number;
}

interface ExpectedTraceEvent {
  input: string | null;
  menu: string;
  result: string;
  selectedItem: string | null;
  tic: number;
}

interface InputEvent {
  input: string;
  purpose: string;
  tic: number;
}

interface LiveHashStatus {
  reason: string;
  status: string;
  surface: string;
}

interface SourceAuthority {
  authority: string;
  id: string;
  path: string;
  role: string;
}

interface SourceHash {
  path: string;
  sha256: string;
  sizeBytes: number;
}

interface SourceManifest {
  path: string;
  stepId: string;
  stepTitle: string;
}

interface SaveLoadMenuPathFixture {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: ExpectedTraceEvent[];
  inputSequence: InputEvent[];
  liveHashStatus: LiveHashStatus[];
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  sourceHashes: SourceHash[];
  sourceManifest: SourceManifest;
  stepId: string;
  stepTitle: string;
  traceSha256: string;
}

interface SideBySideReplayManifest {
  explicitNullSurfaces: Array<{
    surface: string;
  }>;
  schemaVersion: number;
  sourceHashes: SourceHash[];
  stepId: string;
  stepTitle: string;
  targetReplayContract: {
    requiredCommand: string;
  };
}

const fixturePath = 'test/oracles/fixtures/capture-save-load-menu-path.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedTrace = [
  {
    input: null,
    menu: 'attract-loop',
    result: 'title-loop-running',
    selectedItem: null,
    tic: 0,
  },
  {
    input: 'Escape',
    menu: 'main',
    result: 'main-menu-opened',
    selectedItem: 'new-game',
    tic: 1,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'main-menu-selection-moved',
    selectedItem: 'options',
    tic: 3,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'main-menu-selection-moved',
    selectedItem: 'load-game',
    tic: 5,
  },
  {
    input: 'Enter',
    menu: 'load-game',
    result: 'load-game-menu-opened',
    selectedItem: 'slot-1',
    tic: 7,
  },
  {
    input: 'Escape',
    menu: 'main',
    result: 'returned-to-main-menu',
    selectedItem: 'load-game',
    tic: 9,
  },
  {
    input: 'ArrowDown',
    menu: 'main',
    result: 'main-menu-selection-moved',
    selectedItem: 'save-game',
    tic: 11,
  },
  {
    input: 'Enter',
    menu: 'message',
    result: 'save-game-rejected-outside-active-game',
    selectedItem: 'save-game',
    tic: 13,
  },
] satisfies ExpectedTraceEvent[];

const expectedTraceSha256 = 'a1ed2a9249cf40294c6e13f1bbea0d8aa1c3650cd94121fe848c4960bedfe81c';

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD'],
    executable: 'doom/DOOMD.EXE',
    requiredPlayableCommand: 'bun run doom.ts',
    status: 'contract-only',
  },
  captureWindow: {
    endFrame: 13,
    endTic: 13,
    sampleRateHz: 35,
    startFrame: 0,
    startTic: 0,
  },
  expectedTrace,
  inputSequence: [
    {
      input: 'Escape',
      purpose: 'open the main menu from the attract loop',
      tic: 1,
    },
    {
      input: 'ArrowDown',
      purpose: 'move main menu selection from New Game to Options',
      tic: 3,
    },
    {
      input: 'ArrowDown',
      purpose: 'move main menu selection from Options to Load Game',
      tic: 5,
    },
    {
      input: 'Enter',
      purpose: 'open the Load Game slot menu',
      tic: 7,
    },
    {
      input: 'Escape',
      purpose: 'return from the Load Game slot menu to the main menu',
      tic: 9,
    },
    {
      input: 'ArrowDown',
      purpose: 'move main menu selection from Load Game to Save Game',
      tic: 11,
    },
    {
      input: 'Enter',
      purpose: 'attempt Save Game before an active user game exists',
      tic: 13,
    },
  ],
  liveHashStatus: [
    {
      reason: 'The selected step read scope does not permit opening or executing reference binaries directly.',
      status: 'pending-live-reference-capture',
      surface: 'framebuffer-hash',
    },
    {
      reason: 'The selected step read scope does not permit opening or executing reference binaries directly.',
      status: 'pending-live-reference-capture',
      surface: 'audio-hash',
    },
    {
      reason: 'The selected step read scope does not permit opening or executing reference binaries directly.',
      status: 'pending-live-reference-capture',
      surface: 'state-hash',
    },
  ],
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'preferred local binary authority when usable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data',
    },
    {
      authority: 'local-data',
      id: 'S-FPS-007',
      path: 'iwad/DOOM1.WAD',
      role: 'local IWAD copy',
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
  sourceManifest: {
    path: manifestPath,
    stepId: '01-015',
    stepTitle: 'audit-missing-side-by-side-replay',
  },
  stepId: '02-017',
  stepTitle: 'capture-save-load-menu-path',
  traceSha256: expectedTraceSha256,
} satisfies SaveLoadMenuPathFixture;

async function readFixture(): Promise<SaveLoadMenuPathFixture> {
  return await Bun.file(fixturePath).json();
}

function sha256Text(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

describe('capture-save-load-menu-path oracle', () => {
  test('locks the fixture exactly', async () => {
    const fixture = await readFixture();

    expect(fixture).toEqual(expectedFixture);
  });

  test('recomputes the deterministic trace hash', async () => {
    const fixture = await readFixture();
    const traceSha256 = sha256Text(JSON.stringify(fixture.expectedTrace));

    expect(traceSha256).toBe(expectedTraceSha256);
    expect(fixture.traceSha256).toBe(traceSha256);
  });

  test('captures the load menu and save rejection path in order', async () => {
    const fixture = await readFixture();
    const inputSequence = fixture.inputSequence.map((inputEvent) => inputEvent.input);
    const traceMenus = fixture.expectedTrace.map((traceEvent) => traceEvent.menu);
    const traceResults = fixture.expectedTrace.map((traceEvent) => traceEvent.result);

    expect(inputSequence).toEqual(['Escape', 'ArrowDown', 'ArrowDown', 'Enter', 'Escape', 'ArrowDown', 'Enter']);
    expect(traceMenus).toEqual(['attract-loop', 'main', 'main', 'main', 'load-game', 'main', 'main', 'message']);
    expect(traceResults).toEqual([
      'title-loop-running',
      'main-menu-opened',
      'main-menu-selection-moved',
      'main-menu-selection-moved',
      'load-game-menu-opened',
      'returned-to-main-menu',
      'main-menu-selection-moved',
      'save-game-rejected-outside-active-game',
    ]);
    expect(fixture.expectedTrace[4]).toEqual({
      input: 'Enter',
      menu: 'load-game',
      result: 'load-game-menu-opened',
      selectedItem: 'slot-1',
      tic: 7,
    });
    expect(fixture.expectedTrace[7]).toEqual({
      input: 'Enter',
      menu: 'message',
      result: 'save-game-rejected-outside-active-game',
      selectedItem: 'save-game',
      tic: 13,
    });
  });

  test('cross-checks source authority and inherited launch-surface gaps', async () => {
    const fixture = await readFixture();
    const manifest: SideBySideReplayManifest = await Bun.file(manifestPath).json();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();
    const explicitNullSurfaces = new Set(manifest.explicitNullSurfaces.map((nullSurface) => nullSurface.surface));

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-015');
    expect(manifest.stepTitle).toBe('audit-missing-side-by-side-replay');
    expect(manifest.targetReplayContract.requiredCommand).toBe(fixture.captureCommand.requiredPlayableCommand);
    expect(fixture.sourceHashes).toEqual(manifest.sourceHashes);
    expect(explicitNullSurfaces.has('reference-oracle-replay-capture')).toBe(true);
    expect(explicitNullSurfaces.has('framebuffer-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('audio-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('state-hash-comparison')).toBe(true);

    for (const sourceAuthority of fixture.sourceAuthority) {
      expect(sourceCatalog).toContain(`| ${sourceAuthority.id} |`);
      expect(sourceCatalog).toContain(sourceAuthority.authority);
      expect(sourceCatalog).toContain(`\`${sourceAuthority.path}\``);
    }
  });

  test('registers the oracle artifact', async () => {
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();

    expect(oracleRegistry).toContain(
      '| OR-FPS-022 | `test/oracles/fixtures/capture-save-load-menu-path.json` | save/load menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-save-load-menu-path.test.ts` |',
    );
  });
});
