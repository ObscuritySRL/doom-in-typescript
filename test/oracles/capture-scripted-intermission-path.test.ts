import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-scripted-intermission-path.json';
const launchSurfaceManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedTrace = [
  {
    description: 'clean launch reaches the title loop before input is applied',
    frame: 0,
    phase: 'clean-launch',
    tic: 0,
  },
  {
    description: 'menu input opens the main menu from the attract loop',
    frame: 42,
    phase: 'main-menu-open',
    tic: 42,
  },
  {
    description: 'new game menu route is selected from the main menu',
    frame: 70,
    phase: 'new-game-selected',
    tic: 70,
  },
  {
    description: 'shareware episode one is selected',
    frame: 94,
    phase: 'episode-selected',
    tic: 94,
  },
  {
    description: 'default skill is accepted and E1M1 load begins',
    frame: 126,
    phase: 'skill-selected',
    tic: 126,
  },
  {
    description: 'first E1M1 gameplay frame is visible',
    frame: 210,
    phase: 'e1m1-loaded',
    tic: 210,
  },
  {
    description: 'scripted movement begins the route toward the E1M1 exit switch',
    frame: 420,
    phase: 'exit-route-started',
    tic: 420,
  },
  {
    description: 'scripted use input activates the E1M1 exit switch path',
    frame: 3780,
    phase: 'exit-switch-activated',
    tic: 3780,
  },
  {
    description: 'level exit transition is accepted after the exit sequence settles',
    frame: 3920,
    phase: 'level-exit-accepted',
    tic: 3920,
  },
  {
    description: 'intermission state becomes the active game state',
    frame: 3990,
    phase: 'intermission-entered',
    tic: 3990,
  },
  {
    description: 'first stable intermission frame is ready for framebuffer/state/audio capture',
    frame: 4025,
    phase: 'intermission-visible',
    tic: 4025,
  },
] as const;

const expectedFixture = {
  captureCommand: {
    arguments: ['run', 'doom.ts', '--iwad', 'doom/DOOM1.WAD', '--script', 'scripted-intermission', '--capture-window', '0:4200'],
    executable: 'bun',
    iwadPath: 'doom/DOOM1.WAD',
    mode: 'scripted-intermission-oracle-contract',
    referenceBinary: 'doom/DOOMD.EXE',
    targetRuntimeCommand: 'bun run doom.ts',
  },
  captureWindow: {
    frameRange: {
      end: 4200,
      start: 0,
    },
    ticRange: {
      end: 4200,
      start: 0,
    },
  },
  expectedTrace,
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
    targetPlayable: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  liveReferenceCapture: {
    reason: 'The 02-025 read scope permits only the source catalog, reference oracle registry, and 01-015 launch-surface audit manifest; that manifest records no reference capture runner or framebuffer/audio/state comparison surfaces.',
    status: 'pending',
    surfaces: ['audio-hash', 'framebuffer-hash', 'state-hash'],
  },
  schemaVersion: 1,
  scriptedInput: [
    {
      description: 'open the main menu from the title loop',
      durationTics: 1,
      key: 'Escape',
      startTic: 42,
    },
    {
      description: 'select New Game',
      durationTics: 1,
      key: 'Enter',
      startTic: 70,
    },
    {
      description: 'select episode one',
      durationTics: 1,
      key: 'Enter',
      startTic: 94,
    },
    {
      description: 'accept the default skill',
      durationTics: 1,
      key: 'Enter',
      startTic: 126,
    },
    {
      description: 'hold forward for the scripted exit route',
      durationTics: 3260,
      key: 'ArrowUp',
      startTic: 420,
    },
    {
      description: 'activate the exit switch path',
      durationTics: 1,
      key: 'Space',
      startTic: 3780,
    },
  ],
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'preferred local DOS binary authority when usable',
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
      role: 'workspace IWAD copy',
    },
  ],
  stepId: '02-025',
  stepTitle: 'capture-scripted-intermission-path',
  traceSha256: 'bf0877168aa8056ddfd5d1176c8977bf5a35df0509a16ef4b63782da07f89863',
} as const;

const expectedOracleRegistryRow =
  '| OR-FPS-030 | `test/oracles/fixtures/capture-scripted-intermission-path.json` | scripted intermission path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-scripted-intermission-path.test.ts` |';

const hashTrace = async (): Promise<string> => {
  const encodedTrace = new TextEncoder().encode(JSON.stringify(expectedTrace));
  const traceDigest = await crypto.subtle.digest('SHA-256', encodedTrace);

  return Array.from(new Uint8Array(traceDigest), (byteValue) => byteValue.toString(16).padStart(2, '0')).join('');
};

describe('capture-scripted-intermission-path oracle fixture', () => {
  test('locks the exact fixture value', async () => {
    const fixtureText = await Bun.file(fixturePath).text();
    const fixture: unknown = JSON.parse(fixtureText);

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the trace hash and intermission transition', async () => {
    const transitionPhases = expectedTrace.map((tracePoint) => tracePoint.phase);

    expect(await hashTrace()).toBe(expectedFixture.traceSha256);
    expect(transitionPhases).toEqual([
      'clean-launch',
      'main-menu-open',
      'new-game-selected',
      'episode-selected',
      'skill-selected',
      'e1m1-loaded',
      'exit-route-started',
      'exit-switch-activated',
      'level-exit-accepted',
      'intermission-entered',
      'intermission-visible',
    ]);
    expect(expectedTrace.at(-1)).toEqual({
      description: 'first stable intermission frame is ready for framebuffer/state/audio capture',
      frame: 4025,
      phase: 'intermission-visible',
      tic: 4025,
    });
  });

  test('cross-checks the command contract against the launch-surface manifest', async () => {
    const manifestText = await Bun.file(launchSurfaceManifestPath).text();
    const manifest: unknown = JSON.parse(manifestText);

    expect(manifest).toMatchObject({
      commandContracts: {
        targetPlayable: expectedFixture.inheritedLaunchSurface.targetPlayable,
      },
      sourceHashes: expectedFixture.inheritedLaunchSurface.sourceHashes,
      stepId: '01-015',
      targetReplayContract: {
        requiredCommand: expectedFixture.captureCommand.targetRuntimeCommand,
      },
    });
  });

  test('cross-checks source authority against the source catalog', async () => {
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    for (const sourceAuthority of expectedFixture.sourceAuthority) {
      expect(sourceCatalog).toContain(`| ${sourceAuthority.id} |`);
      expect(sourceCatalog).toContain(`\`${sourceAuthority.path}\``);
    }
  });

  test('records pending live hash surfaces from the allowed manifest scope', async () => {
    const manifestText = await Bun.file(launchSurfaceManifestPath).text();
    const manifest: unknown = JSON.parse(manifestText);

    expect(expectedFixture.liveReferenceCapture).toEqual({
      reason: 'The 02-025 read scope permits only the source catalog, reference oracle registry, and 01-015 launch-surface audit manifest; that manifest records no reference capture runner or framebuffer/audio/state comparison surfaces.',
      status: 'pending',
      surfaces: ['audio-hash', 'framebuffer-hash', 'state-hash'],
    });
    expect(manifest).toMatchObject({
      explicitNullSurfaces: expect.arrayContaining([
        expect.objectContaining({ surface: 'audio-hash-comparison' }),
        expect.objectContaining({ surface: 'framebuffer-hash-comparison' }),
        expect.objectContaining({ surface: 'reference-oracle-replay-capture' }),
        expect.objectContaining({ surface: 'state-hash-comparison' }),
      ]),
    });
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(expectedOracleRegistryRow);
  });
});
