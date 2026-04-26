import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-scripted-door-use-path.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sideBySideReplayManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

type CaptureCommand = {
  arguments: string[];
  command: string;
  implementationStatus: string;
  scriptedInput: ScriptedInput[];
};

type CaptureWindow = {
  endFrame: number;
  endTic: number;
  firstGameplayTic: number;
  startFrame: number;
  startTic: number;
  ticRateHz: number;
};

type CommandContract = {
  entryFile: string;
  runtimeCommand: string;
  sourceManifestPath: string;
};

type DoorUseOracleFixture = {
  artifactPath: string;
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  commandContract: CommandContract;
  expectedTrace: ExpectedTrace;
  liveReferenceCapture: LiveReferenceCapture;
  oracleIdentifier: string;
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  sourceHashes: SourceHash[];
  stepIdentifier: string;
  stepTitle: string;
};

type ExpectedTrace = {
  traceSha256: string;
  transitions: TraceTransition[];
};

type ExplicitNullSurface = {
  evidencePaths: string[];
  path: null;
  reason: string;
  surface: string;
};

type LiveReferenceCapture = {
  audioHashSha256: string | null;
  framebufferHashSha256: string | null;
  reason: string;
  stateHashSha256: string | null;
  status: string;
};

type ScriptedInput = {
  durationTics: number;
  input: string[];
  purpose: string;
  startTic: number;
};

type SideBySideReplayManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: ExplicitNullSurface[];
  sourceHashes: SourceHash[];
  stepId: string;
};

type SourceAuthority = {
  authority: string;
  path: string;
  role: string;
  source: string;
  sourceIdentifier: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type TraceTransition = {
  event: string;
  state: string;
  tic: number;
};

const fixture: DoorUseOracleFixture = await Bun.file(fixturePath).json();
const referenceOraclesText = await Bun.file(referenceOraclesPath).text();
const sideBySideReplayManifest: SideBySideReplayManifest = await Bun.file(sideBySideReplayManifestPath).json();
const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

const calculateSha256 = (value: unknown): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');

describe('capture scripted door use path oracle', () => {
  test('locks the oracle identity, command contract, and capture window', () => {
    expect(fixture.artifactPath).toBe(fixturePath);
    expect(fixture.oracleIdentifier).toBe('OR-FPS-028');
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.stepIdentifier).toBe('02-023');
    expect(fixture.stepTitle).toBe('capture-scripted-door-use-path');

    expect(fixture.commandContract).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
      sourceManifestPath: sideBySideReplayManifestPath,
    });
    expect(fixture.commandContract.entryFile).toBe(sideBySideReplayManifest.commandContracts.targetPlayable.entryFile);
    expect(fixture.commandContract.runtimeCommand).toBe(sideBySideReplayManifest.commandContracts.targetPlayable.runtimeCommand);

    expect(fixture.captureCommand.command).toBe('bun run doom.ts');
    expect(fixture.captureCommand.arguments).toEqual(['--iwad', 'doom/DOOM1.WAD', '--oracle', 'capture-scripted-door-use-path', '--scripted-input', 'capture-scripted-door-use-path', '--capture-start-tic', '0', '--capture-end-tic', '560']);
    expect(fixture.captureCommand.implementationStatus).toBe('pending future replay and reference-capture surface');
    expect(fixture.captureWindow).toEqual({
      endFrame: 560,
      endTic: 560,
      firstGameplayTic: 70,
      startFrame: 0,
      startTic: 0,
      ticRateHz: 35,
    });
    expect(fixture.captureWindow.endFrame).toBe(fixture.captureWindow.endTic);
  });

  test('locks the scripted input sequence through the first door use', () => {
    expect(fixture.captureCommand.scriptedInput).toEqual([
      {
        durationTics: 1,
        input: ['Escape'],
        purpose: 'open the main menu from the clean launch attract loop',
        startTic: 0,
      },
      {
        durationTics: 1,
        input: ['Enter'],
        purpose: 'select New Game',
        startTic: 4,
      },
      {
        durationTics: 1,
        input: ['Enter'],
        purpose: 'select Knee-Deep in the Dead',
        startTic: 8,
      },
      {
        durationTics: 1,
        input: ['Enter'],
        purpose: 'select Hurt Me Plenty',
        startTic: 12,
      },
      {
        durationTics: 120,
        input: ['ArrowUp'],
        purpose: 'walk from the E1M1 start area toward the first usable door',
        startTic: 70,
      },
      {
        durationTics: 1,
        input: ['Space'],
        purpose: 'activate the first reachable E1M1 door',
        startTic: 190,
      },
      {
        durationTics: 70,
        input: [],
        purpose: 'observe the accepted door-use transition',
        startTic: 191,
      },
    ]);
  });

  test('locks the semantic trace and deterministic transition hash', () => {
    expect(fixture.expectedTrace.transitions.map((transition) => transition.state)).toEqual([
      'clean-launch-attract-loop',
      'main-menu-open',
      'new-game-menu-open',
      'episode-menu-accepted',
      'skill-menu-accepted',
      'e1m1-gameplay-started',
      'e1m1-first-door-contact',
      'door-use-input-submitted',
      'door-use-accepted',
      'door-opening-observed',
    ]);
    expect(fixture.expectedTrace.transitions).toContainEqual({
      event: 'the door-use action is accepted and the door thinker begins opening',
      state: 'door-use-accepted',
      tic: 191,
    });
    expect(calculateSha256(fixture.expectedTrace.transitions)).toBe(fixture.expectedTrace.traceSha256);
    expect(fixture.expectedTrace.traceSha256).toBe('3540e0ab0370cdfa1a87db4480d3fb724eb5afe0564f2458d2519cd6619e14b0');
  });

  test('cross-checks authority against the source catalog and inherited launch manifest', () => {
    expect(fixture.sourceAuthority).toHaveLength(4);

    for (const authority of fixture.sourceAuthority.filter((entry) => entry.sourceIdentifier.startsWith('S-FPS-'))) {
      expect(sourceCatalogText).toContain(`| ${authority.sourceIdentifier} | ${authority.source} |`);
      expect(sourceCatalogText).toContain(`| \`${authority.path}\` |`);
      expect(sourceCatalogText).toContain(`| ${authority.authority} |`);
    }

    expect(fixture.sourceAuthority).toContainEqual({
      authority: 'local-derived-audit',
      path: sideBySideReplayManifestPath,
      role: 'allowed launch-surface gap manifest inherited by this oracle fixture',
      source: '01-015 audit manifest',
      sourceIdentifier: 'M-FPS-01-015',
    });
    expect(sideBySideReplayManifest.stepId).toBe('01-015');
    expect(fixture.sourceHashes).toEqual(sideBySideReplayManifest.sourceHashes);
  });

  test('records pending live reference hashes from the 01-015 explicit-null surfaces', () => {
    expect(fixture.liveReferenceCapture).toEqual({
      audioHashSha256: null,
      framebufferHashSha256: null,
      reason: 'The 02-023 read scope does not permit opening or executing reference binaries, and the 01-015 launch-surface audit records no reference oracle replay capture surface.',
      stateHashSha256: null,
      status: 'pending-reference-oracle-replay-capture-surface',
    });

    expect(sideBySideReplayManifest.explicitNullSurfaces.map((explicitNullSurface) => explicitNullSurface.surface)).toEqual(
      expect.arrayContaining(['audio-hash-comparison', 'framebuffer-hash-comparison', 'input-trace-replay-loader', 'reference-oracle-replay-capture', 'state-hash-comparison']),
    );
  });

  test('registers the oracle artifact and refresh command', () => {
    expect(referenceOraclesText).toContain(
      '| OR-FPS-028 | `test/oracles/fixtures/capture-scripted-door-use-path.json` | scripted door use path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-scripted-door-use-path.test.ts` |',
    );
  });
});
