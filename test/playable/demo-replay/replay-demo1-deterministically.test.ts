import { describe, expect, test } from 'bun:test';

import { REPLAY_DEMO1_DETERMINISTICALLY_COMMAND_CONTRACT, replayDemo1Deterministically } from '../../../src/playable/demo-replay/replayDemo1Deterministically.ts';

interface ReplayAuditManifestEvidence {
  readonly commandContracts: {
    readonly targetPlayable: {
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly surface: string;
  }[];
  readonly schemaVersion: number;
  readonly stepId: string;
}

const DEMO1_FIXTURE = Buffer.from([0x6d, 0x02, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x04, 0x02, 0x01, 0x80]);
const EMPTY_DEMO1_FIXTURE = Buffer.from([0x6d, 0x02, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x80]);
const EXPECTED_SOURCE_SHA256 = '8bc1c0dd4186314dd3f1b7807636e67187bb568ffb56ed9a590b8aff772d32d0';
const SOURCE_PATH = 'src/playable/demo-replay/replayDemo1Deterministically.ts';

describe('replayDemo1Deterministically', () => {
  test('locks the product command contract and audit linkage', async () => {
    expect(REPLAY_DEMO1_DETERMINISTICALLY_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });

    const auditManifest: unknown = await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json();
    expect(isReplayAuditManifestEvidence(auditManifest)).toBe(true);
    if (!isReplayAuditManifestEvidence(auditManifest)) {
      throw new Error('01-015 audit manifest shape changed');
    }

    expect(auditManifest.commandContracts.targetPlayable.runtimeCommand).toBe('bun run doom.ts');
    expect(auditManifest.explicitNullSurfaces.some((surface) => surface.surface === 'side-by-side-replay-command')).toBe(true);
    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-015');
  });

  test('locks the formatted source hash', async () => {
    const source = await Bun.file(SOURCE_PATH).text();
    expect(sha256Hex(source)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('replays demo1 deterministically through the marker transition', () => {
    const evidence = replayDemo1Deterministically(DEMO1_FIXTURE);

    expect(evidence).toEqual({
      commandContract: {
        entryFile: 'doom.ts',
        runtimeCommand: 'bun run doom.ts',
      },
      demoName: 'DEMO1',
      demoPlaybackScript: {
        description: 'Empty input script for pre-recorded demo playback capture',
        events: [],
        targetRunMode: 'demo-playback',
        ticRateHz: 35,
        totalTics: 0,
      },
      finalSnapshot: {
        completionAction: 'advance-demo',
        consolePlayer: 0,
        deathmatch: 0,
        demoplayback: false,
        fastMonsters: 0,
        netDemo: false,
        netGame: false,
        noMonsters: 0,
        playersInGame: [true, false, false, false],
        respawnMonsters: 0,
        singleDemo: false,
        ticIndex: 2,
      },
      firstTicSignature: '[{"angleTurn":0,"buttons":0,"forwardMove":16,"sideMove":0}]',
      lastTicSignature: '[{"angleTurn":512,"buttons":1,"forwardMove":0,"sideMove":4}]',
      manifestStepId: '01-015',
      parsedDemo: {
        activePlayerCount: 1,
        commandByteLength: 4,
        durationSeconds: 0.05714285714285714,
        endMarkerOffset: 21,
        episode: 1,
        format: 'vanilla',
        headerByteLength: 13,
        map: 5,
        playersInGame: [true, false, false, false],
        skill: 2,
        ticCount: 2,
        versionByte: 109,
      },
      replayHash: 'e7b3d30358ef6e526067767ab7620c3239d44a38bdd5dfea7d8cf9774515d9e3',
      ticCommandHash: 'a1f52b04a4af249d34b2af49916ace78420ebac586b15ea73555e73aa69b3dcc',
      transition: {
        completionAction: 'advance-demo',
        initialSnapshot: {
          completionAction: 'none',
          consolePlayer: 0,
          deathmatch: 0,
          demoplayback: true,
          fastMonsters: 0,
          netDemo: false,
          netGame: false,
          noMonsters: 0,
          playersInGame: [true, false, false, false],
          respawnMonsters: 0,
          singleDemo: false,
          ticIndex: 0,
        },
        markerReadResult: null,
        postCompletionSnapshot: {
          completionAction: 'advance-demo',
          consolePlayer: 0,
          deathmatch: 0,
          demoplayback: false,
          fastMonsters: 0,
          netDemo: false,
          netGame: false,
          noMonsters: 0,
          playersInGame: [true, false, false, false],
          respawnMonsters: 0,
          singleDemo: false,
          ticIndex: 2,
        },
      },
    });
    expect(Object.isFrozen(evidence)).toBe(true);
  });

  test('rejects the legacy launcher command before parsing demo bytes', () => {
    expect(() => replayDemo1Deterministically(Buffer.alloc(0), { runtimeCommand: 'bun run src/main.ts' })).toThrow('replay-demo1-deterministically requires bun run doom.ts');
  });

  test('rejects demo1 playback without tic commands', () => {
    expect(() => replayDemo1Deterministically(EMPTY_DEMO1_FIXTURE)).toThrow('DEMO1 deterministic replay produced no tic commands');
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReplayAuditManifestEvidence(value: unknown): value is ReplayAuditManifestEvidence {
  if (!isRecord(value) || !isRecord(value.commandContracts) || !isRecord(value.commandContracts.targetPlayable) || !Array.isArray(value.explicitNullSurfaces)) {
    return false;
  }

  return (
    typeof value.commandContracts.targetPlayable.runtimeCommand === 'string' &&
    value.explicitNullSurfaces.every((surface) => isRecord(surface) && typeof surface.surface === 'string') &&
    typeof value.schemaVersion === 'number' &&
    typeof value.stepId === 'string'
  );
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
