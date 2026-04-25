import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

type CaptureWindow = {
  endFrame: number;
  endTic: number;
  frameRate: number;
  startFrame: number;
  startTic: number;
  ticRate: number;
};

type CommandContract = {
  entryFile: string;
  runtimeCommand: string;
  sourceManifestPath: string;
};

type DamageDeathFixture = {
  captureArguments: string[];
  captureCommand: {
    arguments: string[];
    command: string;
    description: string;
    workingDirectory: string;
  };
  captureWindow: CaptureWindow;
  commandContract: CommandContract;
  expectedTrace: TraceCheckpoint[];
  expectedTraceSha256: string;
  inheritedLaunchSurfaceSourceHashes: SourceHash[];
  liveCaptureStatus: {
    audioHash: null;
    framebufferHash: null;
    reason: string;
    stateHash: null;
    status: string;
  };
  oracleId: string;
  rationale: string;
  schemaVersion: number;
  scriptedInput: ScriptedInput[];
  sourceAuthority: SourceAuthority[];
  sourceManifestPath: string;
  stepId: string;
  stepTitle: string;
};

type ScriptedInput = {
  endTic: number;
  input: string;
  purpose: string;
  startTic: number;
};

type SourceAuthority = {
  authority: string;
  path: string;
  role: string;
  sourceId: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type TraceCheckpoint = {
  tic: number;
  frame: number;
  state: string;
  event: string;
  note: string;
};

const expectedFixture = {
  captureArguments: ['--iwad', 'doom/DOOM1.WAD', '--oracle', 'capture-scripted-damage-death-path', '--script', 'damage-death', '--start', 'clean-launch', '--map', 'E1M1', '--skill', '2', '--capture-tics', '0..840'],
  captureCommand: {
    arguments: ['--iwad', 'doom/DOOM1.WAD', '--oracle', 'capture-scripted-damage-death-path', '--script', 'damage-death', '--start', 'clean-launch', '--map', 'E1M1', '--skill', '2', '--capture-tics', '0..840'],
    command: 'bun run doom.ts -- --iwad doom/DOOM1.WAD --oracle capture-scripted-damage-death-path --script damage-death --start clean-launch --map E1M1 --skill 2 --capture-tics 0..840',
    description: 'Future replay capture command for the scripted damage and death oracle.',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 840,
    endTic: 840,
    frameRate: 35,
    startFrame: 0,
    startTic: 0,
    ticRate: 35,
  },
  commandContract: {
    entryFile: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
    sourceManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
  },
  expectedTrace: [
    {
      tic: 0,
      frame: 0,
      state: 'startup',
      event: 'clean-launch',
      note: 'reference process starts from the target playable command contract',
    },
    {
      tic: 35,
      frame: 35,
      state: 'attract-loop',
      event: 'main-menu-opened',
      note: 'Escape opens the main menu from the initial title or attract loop',
    },
    {
      tic: 40,
      frame: 40,
      state: 'main-menu',
      event: 'new-game-selected',
      note: 'Enter activates New Game',
    },
    {
      tic: 45,
      frame: 45,
      state: 'episode-menu',
      event: 'episode-one-selected',
      note: 'Enter selects Knee-Deep in the Dead',
    },
    {
      tic: 50,
      frame: 50,
      state: 'skill-menu',
      event: 'hurt-me-plenty-selected',
      note: 'ArrowDown then Enter selects Hurt Me Plenty',
    },
    {
      tic: 105,
      frame: 105,
      state: 'gameplay',
      event: 'e1m1-first-playable-frame',
      note: 'first scripted E1M1 gameplay frame after load',
    },
    {
      tic: 140,
      frame: 140,
      state: 'gameplay',
      event: 'damage-route-start',
      note: 'scripted movement starts toward the first repeatable damage source',
    },
    {
      tic: 420,
      frame: 420,
      state: 'gameplay',
      event: 'first-damage-checkpoint',
      note: 'player health is expected to decrease from the vanilla starting health',
    },
    {
      tic: 700,
      frame: 700,
      state: 'gameplay',
      event: 'lethal-damage-window-entered',
      note: 'script keeps the player exposed until health reaches zero',
    },
    {
      tic: 735,
      frame: 735,
      state: 'player-death',
      event: 'player-health-zero',
      note: 'death state begins when accumulated damage reduces health to zero',
    },
    {
      tic: 770,
      frame: 770,
      state: 'player-death',
      event: 'death-animation-active',
      note: 'death camera and player-dead state remain active without reborn input',
    },
    {
      tic: 840,
      frame: 840,
      state: 'player-death',
      event: 'awaiting-reborn-input',
      note: 'capture stops before any use-key reborn command is issued',
    },
  ],
  expectedTraceSha256: 'ec745735b19026d6f114883527c8a1002295b1287fd01607599a8ae6679d4a6a',
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
    audioHash: null,
    framebufferHash: null,
    reason: 'The selected step read scope does not permit opening or executing reference binaries directly.',
    stateHash: null,
    status: 'pending-reference-execution',
  },
  oracleId: 'OR-FPS-029',
  rationale:
    'This fixture records the scripted damage and death replay contract from local DOS binary and IWAD authority plus the allowed 01-015 launch-surface manifest. Live framebuffer, audio, and state hashes remain pending for a later capture step with reference execution in scope.',
  schemaVersion: 1,
  scriptedInput: [
    {
      endTic: 35,
      input: 'Escape',
      purpose: 'open the main menu from the initial title or attract loop',
      startTic: 35,
    },
    {
      endTic: 40,
      input: 'Enter',
      purpose: 'select New Game',
      startTic: 40,
    },
    {
      endTic: 45,
      input: 'Enter',
      purpose: 'select episode one',
      startTic: 45,
    },
    {
      endTic: 49,
      input: 'ArrowDown',
      purpose: 'move the skill cursor to Hurt Me Plenty',
      startTic: 48,
    },
    {
      endTic: 50,
      input: 'Enter',
      purpose: 'start E1M1 on Hurt Me Plenty',
      startTic: 50,
    },
    {
      endTic: 250,
      input: 'MoveForward',
      purpose: 'leave the spawn area and enter the damage route',
      startTic: 112,
    },
    {
      endTic: 260,
      input: 'TurnRight',
      purpose: 'face the scripted damage exposure route',
      startTic: 210,
    },
    {
      endTic: 320,
      input: 'MoveForward',
      purpose: 'enter the hostile exposure area',
      startTic: 261,
    },
    {
      endTic: 840,
      input: 'NoInput',
      purpose: 'keep the player exposed until death without issuing reborn input',
      startTic: 321,
    },
  ],
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      role: 'reference executable authority when usable',
      sourceId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data',
      sourceId: 'S-FPS-006',
    },
    {
      authority: 'local-data',
      path: 'iwad/DOOM1.WAD',
      role: 'available local IWAD copy',
      sourceId: 'S-FPS-007',
    },
    {
      authority: 'local-primary',
      path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      role: 'allowed launch-surface manifest for target command and missing replay surfaces',
      sourceId: '01-015',
    },
  ],
  sourceManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
  stepId: '02-024',
  stepTitle: 'capture-scripted-damage-death-path',
} satisfies DamageDeathFixture;

const fixturePath = 'test/oracles/fixtures/capture-scripted-damage-death-path.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

describe('capture scripted damage death path oracle', () => {
  test('locks the complete fixture value', async () => {
    const parsedFixture: unknown = JSON.parse(await Bun.file(fixturePath).text());

    expect(parsedFixture).toEqual(expectedFixture);
  });

  test('recomputes the deterministic trace hash', () => {
    const traceHash = createHash('sha256').update(JSON.stringify(expectedFixture.expectedTrace)).digest('hex');

    expect(traceHash).toBe(expectedFixture.expectedTraceSha256);
  });

  test('locks the damage and death transition checkpoints', () => {
    expect(expectedFixture.expectedTrace.map((traceCheckpoint) => traceCheckpoint.event)).toEqual([
      'clean-launch',
      'main-menu-opened',
      'new-game-selected',
      'episode-one-selected',
      'hurt-me-plenty-selected',
      'e1m1-first-playable-frame',
      'damage-route-start',
      'first-damage-checkpoint',
      'lethal-damage-window-entered',
      'player-health-zero',
      'death-animation-active',
      'awaiting-reborn-input',
    ]);
    expect(expectedFixture.expectedTrace.at(-3)).toMatchObject({
      state: 'player-death',
      tic: 735,
    });
    expect(expectedFixture.scriptedInput.at(-1)).toEqual({
      endTic: 840,
      input: 'NoInput',
      purpose: 'keep the player exposed until death without issuing reborn input',
      startTic: 321,
    });
  });

  test('cross-checks source authority and the allowed launch-surface manifest', async () => {
    const parsedManifest: unknown = JSON.parse(await Bun.file(manifestPath).text());
    const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

    expect(parsedManifest).toMatchObject({
      commandContracts: {
        targetPlayable: {
          entryFile: expectedFixture.commandContract.entryFile,
          runtimeCommand: expectedFixture.commandContract.runtimeCommand,
        },
      },
      explicitNullSurfaces: expect.arrayContaining([
        expect.objectContaining({ surface: 'framebuffer-hash-comparison' }),
        expect.objectContaining({ surface: 'audio-hash-comparison' }),
        expect.objectContaining({ surface: 'state-hash-comparison' }),
        expect.objectContaining({ surface: 'reference-oracle-replay-capture' }),
      ]),
      sourceHashes: expectedFixture.inheritedLaunchSurfaceSourceHashes,
    });

    for (const sourceAuthority of expectedFixture.sourceAuthority) {
      if (!sourceAuthority.sourceId.startsWith('S-FPS-')) {
        expect(sourceAuthority.path).toBe(manifestPath);
        continue;
      }

      expect(sourceCatalogText).toContain(`| ${sourceAuthority.sourceId} |`);
      expect(sourceCatalogText).toContain(`\`${sourceAuthority.path}\``);
    }
  });

  test('registers the oracle and records pending live hash gaps', async () => {
    const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-029 | `test/oracles/fixtures/capture-scripted-damage-death-path.json` | scripted damage death path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-scripted-damage-death-path.test.ts` |',
    );
    expect(expectedFixture.liveCaptureStatus).toEqual({
      audioHash: null,
      framebufferHash: null,
      reason: 'The selected step read scope does not permit opening or executing reference binaries directly.',
      stateHash: null,
      status: 'pending-reference-execution',
    });
  });
});
