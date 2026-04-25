import { describe, expect, test } from 'bun:test';

const expectedFixture = {
  abstractTraceSha256: '85fd03f8b419d49ef08c1c0fd9050550e0b015cbad1853b3f46e180c29bd2f16',
  captureCommand: {
    arguments: ['run', 'doom.ts', '--oracle-capture', 'live-save-load-roundtrip', '--iwad', 'doom/DOOM1.WAD', '--map', 'E1M1', '--skill', '2', '--save-slot', '0'],
    description: 'Scripted live save/load roundtrip from clean launch through E1M1 save slot 0, post-save state mutation, load, and restored-state verification.',
    executable: 'bun',
    mode: 'abstract-contract-pending-live-reference-run',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    firstGameplayTic: 140,
    firstLoadVerificationTic: 490,
    frameRateHz: 35,
    sampleFrames: [0, 35, 140, 210, 245, 280, 350, 420, 455, 490],
    ticRateHz: 35,
  },
  commandContract: {
    entryFile: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
    sourceManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
  },
  expectedTrace: [
    {
      action: 'clean-launch',
      expectedState: 'title loop reached with no save slot loaded',
      frame: 0,
      note: 'start from the target playable command with local IWAD authority',
      ordinal: 1,
      tic: 0,
    },
    {
      action: 'open-main-menu',
      expectedState: 'main menu active from attract loop',
      frame: 35,
      note: 'menu path begins from clean launch before gameplay state exists',
      ordinal: 2,
      tic: 35,
    },
    {
      action: 'start-e1m1',
      expectedState: 'E1M1 gameplay state initialized at skill 2',
      frame: 140,
      note: 'new game route establishes the state that will be saved',
      ordinal: 3,
      tic: 140,
    },
    {
      action: 'open-save-menu',
      expectedState: 'save slot menu active over live gameplay',
      frame: 210,
      note: 'roundtrip captures a live save from gameplay rather than a startup-only path',
      ordinal: 4,
      tic: 210,
    },
    {
      action: 'write-save-slot-zero',
      expectedState: 'slot 0 contains the abstract saved E1M1 state marker',
      frame: 245,
      note: 'save description is captured as RLP ROUNDTRIP',
      ordinal: 5,
      tic: 245,
    },
    {
      action: 'return-to-gameplay-after-save',
      expectedState: 'gameplay resumes from the saved state marker',
      frame: 280,
      note: 'post-save state becomes the comparison baseline',
      ordinal: 6,
      tic: 280,
    },
    {
      action: 'mutate-live-state-after-save',
      expectedState: 'player state diverges from the saved marker before load',
      frame: 350,
      note: 'scripted movement after saving proves the later load restores older state',
      ordinal: 7,
      tic: 350,
    },
    {
      action: 'open-load-menu',
      expectedState: 'load slot menu active over mutated gameplay',
      frame: 420,
      note: 'same slot is selected for the restore path',
      ordinal: 8,
      tic: 420,
    },
    {
      action: 'load-save-slot-zero',
      expectedState: 'gameplay restored to the abstract saved E1M1 state marker',
      frame: 455,
      note: 'load completes without advancing to a different map or intermission',
      ordinal: 9,
      tic: 455,
    },
    {
      action: 'verify-restored-frame',
      expectedState: 'post-load frame, state, audio, and input baseline match the saved marker contract',
      frame: 490,
      note: 'live hashes remain pending until reference capture tooling exists',
      ordinal: 10,
      tic: 490,
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
  liveCaptureStatus: {
    audioHash: 'pending-live-reference-capture',
    framebufferHash: 'pending-live-reference-capture',
    reason: 'The 02-026 read scope exposes source authority and missing replay surfaces but does not permit opening or executing reference capture tooling.',
    stateHash: 'pending-live-reference-capture',
  },
  pendingReferenceArtifacts: [
    {
      requiredSurface: 'reference-oracle-replay-capture',
      status: 'pending-live-reference-capture',
    },
    {
      requiredSurface: 'input-trace-replay-loader',
      status: 'pending-live-reference-capture',
    },
    {
      requiredSurface: 'framebuffer-hash-comparison',
      status: 'pending-live-reference-capture',
    },
    {
      requiredSurface: 'state-hash-comparison',
      status: 'pending-live-reference-capture',
    },
    {
      requiredSurface: 'audio-hash-comparison',
      status: 'pending-live-reference-capture',
    },
  ],
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      role: 'preferred local DOS binary authority when usable',
      sourceId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data for the scripted live roundtrip',
      sourceId: 'S-FPS-006',
    },
    {
      authority: 'derived-launch-surface-audit',
      path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      role: 'allowed manifest proving the replay capture and hash surfaces are still missing',
      sourceId: '01-015',
    },
  ],
  stepId: '02-026',
  stepTitle: 'capture-live-save-load-roundtrip',
};

type CaptureLiveSaveLoadRoundtripFixture = typeof expectedFixture;

type SideBySideReplayManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: readonly {
    evidencePaths: readonly string[];
    path: string | null;
    reason: string;
    surface: string;
  }[];
  sourceHashes: readonly {
    path: string;
    sha256: string;
    sizeBytes: number;
  }[];
};

const fixturePath = new URL('./fixtures/capture-live-save-load-roundtrip.json', import.meta.url);
const referenceOraclesPath = new URL('../../plan_fps/REFERENCE_ORACLES.md', import.meta.url);
const sideBySideManifestPath = new URL('../../plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json', import.meta.url);
const sourceCatalogPath = new URL('../../plan_fps/SOURCE_CATALOG.md', import.meta.url);

async function createTraceHash(trace: CaptureLiveSaveLoadRoundtripFixture['expectedTrace']): Promise<string> {
  const traceBytes = new TextEncoder().encode(JSON.stringify(trace));
  const traceDigest = await crypto.subtle.digest('SHA-256', traceBytes);

  return Array.from(new Uint8Array(traceDigest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readFixture(): Promise<CaptureLiveSaveLoadRoundtripFixture> {
  return (await Bun.file(fixturePath).json()) as CaptureLiveSaveLoadRoundtripFixture;
}

describe('capture-live-save-load-roundtrip oracle', () => {
  test('locks the exact fixture value', async () => {
    await expect(readFixture()).resolves.toEqual(expectedFixture);
  });

  test('locks the abstract live save/load roundtrip trace hash', async () => {
    const fixture = await readFixture();

    await expect(createTraceHash(fixture.expectedTrace)).resolves.toBe(fixture.abstractTraceSha256);
    expect(fixture.expectedTrace.map((traceEvent) => traceEvent.action)).toEqual([
      'clean-launch',
      'open-main-menu',
      'start-e1m1',
      'open-save-menu',
      'write-save-slot-zero',
      'return-to-gameplay-after-save',
      'mutate-live-state-after-save',
      'open-load-menu',
      'load-save-slot-zero',
      'verify-restored-frame',
    ]);
    expect(fixture.captureWindow.sampleFrames).toEqual(fixture.expectedTrace.map((traceEvent) => traceEvent.frame));
  });

  test('cross-checks source authority and inherited manifest evidence', async () => {
    const fixture = await readFixture();
    const sideBySideManifest = (await Bun.file(sideBySideManifestPath).json()) as SideBySideReplayManifest;
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(fixture.commandContract).toMatchObject(sideBySideManifest.commandContracts.targetPlayable);
    expect([...fixture.inheritedLaunchSurfaceSourceHashes]).toEqual([...sideBySideManifest.sourceHashes]);

    for (const sourceAuthorityEntry of fixture.sourceAuthority) {
      if (sourceAuthorityEntry.sourceId.startsWith('S-FPS-')) {
        expect(sourceCatalog).toContain(`| ${sourceAuthorityEntry.sourceId} |`);
        expect(sourceCatalog).toContain(`\`${sourceAuthorityEntry.path}\``);
      } else {
        expect(sourceAuthorityEntry.path).toBe('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json');
      }
    }
  });

  test('records pending live reference gaps from the side-by-side audit', async () => {
    const fixture = await readFixture();
    const sideBySideManifest = (await Bun.file(sideBySideManifestPath).json()) as SideBySideReplayManifest;
    const missingSurfaces = new Set(sideBySideManifest.explicitNullSurfaces.map((nullSurface) => nullSurface.surface));

    expect(fixture.liveCaptureStatus).toEqual({
      audioHash: 'pending-live-reference-capture',
      framebufferHash: 'pending-live-reference-capture',
      reason: 'The 02-026 read scope exposes source authority and missing replay surfaces but does not permit opening or executing reference capture tooling.',
      stateHash: 'pending-live-reference-capture',
    });
    for (const pendingReferenceArtifact of fixture.pendingReferenceArtifacts) {
      expect(missingSurfaces.has(pendingReferenceArtifact.requiredSurface)).toBe(true);
      expect(pendingReferenceArtifact.status).toBe('pending-live-reference-capture');
    }
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-031 | `test/oracles/fixtures/capture-live-save-load-roundtrip.json` | live save/load roundtrip capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-live-save-load-roundtrip.test.ts` |',
    );
  });
});
