import { describe, expect, test } from 'bun:test';

type CaptureWindow = {
  frameEnd: number;
  frameStart: number;
  ticEnd: number;
  ticStart: number;
};

type CaptureSfxHashWindowsFixture = {
  captureCommand: {
    arguments: string[];
    entryFile: string;
    runtimeCommand: string;
  };
  captureWindow: CaptureWindow & {
    windowName: string;
  };
  expectedTrace: {
    capture: string;
    event: string;
    reason: string;
    window: CaptureWindow;
  }[];
  hashWindows: {
    expectedAudioHash: null;
    name: string;
    status: string;
    window: CaptureWindow;
  }[];
  inheritedLaunchSurface: {
    manifestPath: string;
    missingSurfaces: string[];
    sourceHashes: {
      path: string;
      sha256: string;
      sizeBytes: number;
    }[];
  };
  liveReferenceStatus: {
    blockedSurfaces: string[];
    expectedAudioHashes: null;
    reason: string;
    status: string;
  };
  schemaVersion: number;
  sourceAuthority: {
    authority: string;
    id: string;
    path: string;
    role: string;
  }[];
  stepId: string;
  stepTitle: string;
  traceHash: string;
};

type LaunchSurfaceManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: {
    surface: string;
  }[];
  sourceHashes: {
    path: string;
    sha256: string;
    sizeBytes: number;
  }[];
};

const fixturePath = 'test/oracles/fixtures/capture-sfx-hash-windows.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['--capture-oracle', 'sfx-hash-windows', '--iwad', 'doom/DOOM1.WAD', '--reference-exe', 'doom/DOOMD.EXE', '--window-set', 'clean-launch-menu-gameplay'],
    entryFile: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
  },
  captureWindow: {
    frameEnd: 840,
    frameStart: 0,
    ticEnd: 24,
    ticStart: 0,
    windowName: 'clean-launch-menu-gameplay-sfx',
  },
  expectedTrace: [
    {
      capture: 'pending-sfx-audio-hash',
      event: 'clean-launch-menu-sfx-window',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 manifest.',
      window: {
        frameEnd: 140,
        frameStart: 0,
        ticEnd: 4,
        ticStart: 0,
      },
    },
    {
      capture: 'pending-sfx-audio-hash',
      event: 'menu-navigation-sfx-window',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 manifest.',
      window: {
        frameEnd: 280,
        frameStart: 141,
        ticEnd: 8,
        ticStart: 5,
      },
    },
    {
      capture: 'pending-sfx-audio-hash',
      event: 'gameplay-weapon-sfx-window',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 manifest.',
      window: {
        frameEnd: 560,
        frameStart: 281,
        ticEnd: 16,
        ticStart: 9,
      },
    },
    {
      capture: 'pending-sfx-audio-hash',
      event: 'gameplay-world-interaction-sfx-window',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 manifest.',
      window: {
        frameEnd: 840,
        frameStart: 561,
        ticEnd: 24,
        ticStart: 17,
      },
    },
  ],
  hashWindows: [
    {
      expectedAudioHash: null,
      name: 'clean-launch-menu-sfx-window',
      status: 'pending-reference-capture-surface',
      window: {
        frameEnd: 140,
        frameStart: 0,
        ticEnd: 4,
        ticStart: 0,
      },
    },
    {
      expectedAudioHash: null,
      name: 'menu-navigation-sfx-window',
      status: 'pending-reference-capture-surface',
      window: {
        frameEnd: 280,
        frameStart: 141,
        ticEnd: 8,
        ticStart: 5,
      },
    },
    {
      expectedAudioHash: null,
      name: 'gameplay-weapon-sfx-window',
      status: 'pending-reference-capture-surface',
      window: {
        frameEnd: 560,
        frameStart: 281,
        ticEnd: 16,
        ticStart: 9,
      },
    },
    {
      expectedAudioHash: null,
      name: 'gameplay-world-interaction-sfx-window',
      status: 'pending-reference-capture-surface',
      window: {
        frameEnd: 840,
        frameStart: 561,
        ticEnd: 24,
        ticStart: 17,
      },
    },
  ],
  inheritedLaunchSurface: {
    manifestPath,
    missingSurfaces: ['audio-hash-comparison', 'reference-oracle-replay-capture', 'side-by-side-replay-command', 'synchronized-tic-stepper'],
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
  },
  liveReferenceStatus: {
    blockedSurfaces: ['audio-hash-comparison', 'reference-oracle-replay-capture'],
    expectedAudioHashes: null,
    reason: 'The allowed 01-015 manifest exposes no audio hash comparison or reference oracle replay capture surface.',
    status: 'pending-reference-capture-surface',
  },
  schemaVersion: 1,
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
      role: 'local shareware IWAD data',
    },
    {
      authority: 'local-data',
      id: 'S-FPS-007',
      path: 'iwad/DOOM1.WAD',
      role: 'workspace IWAD copy',
    },
    {
      authority: 'local-secondary-binary',
      id: 'S-FPS-004',
      path: 'doom/DOOM.EXE',
      role: 'practical fallback executable oracle',
    },
  ],
  stepId: '02-027',
  stepTitle: 'capture-sfx-hash-windows',
  traceHash: '0556b29344e35e928ea9ba4f1255821d1ae6c8ebc64a79f314dc0eb07c1d824b',
} satisfies CaptureSfxHashWindowsFixture;

const fixture: CaptureSfxHashWindowsFixture = await Bun.file(fixturePath).json();
const launchSurfaceManifest: LaunchSurfaceManifest = await Bun.file(manifestPath).json();
const oracleRegistry = await Bun.file(oracleRegistryPath).text();
const sourceCatalog = await Bun.file(sourceCatalogPath).text();

describe('capture-sfx-hash-windows oracle', () => {
  test('locks the exact fixture value', () => {
    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the deterministic trace hash', () => {
    const traceHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(fixture.expectedTrace)).digest('hex');

    expect(traceHash).toBe(fixture.traceHash);
    expect(fixture.traceHash).toBe(expectedFixture.traceHash);
  });

  test('records the target command contract and SFX windows', () => {
    expect(fixture.captureCommand.entryFile).toBe(launchSurfaceManifest.commandContracts.targetPlayable.entryFile);
    expect(fixture.captureCommand.runtimeCommand).toBe(launchSurfaceManifest.commandContracts.targetPlayable.runtimeCommand);
    expect(fixture.captureWindow).toEqual({
      frameEnd: 840,
      frameStart: 0,
      ticEnd: 24,
      ticStart: 0,
      windowName: 'clean-launch-menu-gameplay-sfx',
    });
    expect(fixture.hashWindows.map((hashWindow) => hashWindow.name)).toEqual(fixture.expectedTrace.map((traceEntry) => traceEntry.event));
    expect(fixture.hashWindows.every((hashWindow) => hashWindow.expectedAudioHash === null)).toBe(true);
  });

  test('cross-checks source authority and inherited 01-015 gaps', () => {
    for (const authority of fixture.sourceAuthority) {
      expect(sourceCatalog).toContain(`| ${authority.id} |`);
      expect(sourceCatalog).toContain(`\`${authority.path}\``);
      expect(sourceCatalog).toContain(authority.authority);
    }

    const missingSurfaces = launchSurfaceManifest.explicitNullSurfaces.map((surface) => surface.surface);
    expect(missingSurfaces).toEqual(expect.arrayContaining(fixture.inheritedLaunchSurface.missingSurfaces));
    expect(fixture.liveReferenceStatus.blockedSurfaces).toEqual(['audio-hash-comparison', 'reference-oracle-replay-capture']);
    expect(fixture.inheritedLaunchSurface.sourceHashes).toEqual(launchSurfaceManifest.sourceHashes);
  });

  test('registers the oracle artifact', () => {
    expect(oracleRegistry).toContain(
      '| OR-FPS-032 | `test/oracles/fixtures/capture-sfx-hash-windows.json` | sfx hash windows capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-sfx-hash-windows.test.ts` |',
    );
  });
});
