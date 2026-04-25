import { describe, expect, test } from 'bun:test';

import type { LiveSoundMusicTriggerSession } from '../../../src/playable/game-session-wiring/wireLiveSoundMusicTriggers.ts';

import { WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT, wireLiveSoundMusicTriggers } from '../../../src/playable/game-session-wiring/wireLiveSoundMusicTriggers.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json';
const SOURCE_PATH = 'src/playable/game-session-wiring/wireLiveSoundMusicTriggers.ts';
const SOURCE_SHA256 = '84b343be8c0e08a64a3ddc545044310789cd7f9ce4d8786adf1cfcfd0e0dda8a';

const E1M1_AUDIO_SESSION = {
  levelTime: 0,
  mapName: 'E1M1',
  player: {
    mo: {
      angle: 0,
      x: 109_314_048,
      y: -54_657_024,
    },
  },
  showAutomap: false,
} satisfies LiveSoundMusicTriggerSession;

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
      readonly implementedInReadScope: boolean;
    };
  };
  readonly currentLauncherSurface: {
    readonly defaults: {
      readonly mapName: string;
      readonly scale: number;
      readonly skill: number;
    };
  };
  readonly schemaVersion: number;
  readonly stepId: string;
}

describe('wireLiveSoundMusicTriggers', () => {
  test('locks the Bun runtime command contract and audit manifest linkage', async () => {
    const auditManifest: AuditManifest = await Bun.file(AUDIT_MANIFEST_PATH).json();

    expect(WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
    });
    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-009');
    expect(auditManifest.commandContracts.targetRuntime).toEqual({
      command: WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT.command,
      entryFile: WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT.entryFile,
      implementedInReadScope: false,
    });
    expect(auditManifest.currentLauncherSurface.defaults).toEqual({
      mapName: 'E1M1',
      scale: 2,
      skill: 2,
    });
  });

  test('locks the formatted implementation hash', async () => {
    expect(await sha256(SOURCE_PATH)).toBe(SOURCE_SHA256);
  });

  test('emits deterministic music and listener sound triggers from updateSounds', () => {
    expect(
      wireLiveSoundMusicTriggers({
        runtimeCommand: WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT.command,
        session: E1M1_AUDIO_SESSION,
      }),
    ).toEqual({
      command: 'bun run doom.ts',
      frameCountAfter: 1,
      frameCountBefore: 0,
      musicTrigger: {
        kind: 'start-level-music',
        lumpName: 'D_E1M1',
        mapName: 'E1M1',
        phase: 'updateSounds',
        tic: 0,
      },
      phaseTrace: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      preLoopTrace: ['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop'],
      soundTrigger: {
        angle: 0,
        kind: 'update-listener-sounds',
        listenerActive: true,
        listenerX: 109_314_048,
        listenerY: -54_657_024,
        phase: 'updateSounds',
        tic: 0,
        view: 'gameplay',
      },
    });
  });

  test('rejects non-Bun runtime commands before emitting audio triggers', () => {
    expect(() =>
      wireLiveSoundMusicTriggers({
        runtimeCommand: 'bun run src/main.ts',
        session: E1M1_AUDIO_SESSION,
      }),
    ).toThrow('wireLiveSoundMusicTriggers requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects map names without a known episode music trigger', () => {
    expect(() =>
      wireLiveSoundMusicTriggers({
        runtimeCommand: WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT.command,
        session: {
          ...E1M1_AUDIO_SESSION,
          mapName: 'MAP01',
        },
      }),
    ).toThrow('No episode-map music trigger is defined for MAP01.');
  });
});

async function sha256(path: string): Promise<string> {
  const sourceBytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return new Bun.CryptoHasher('sha256').update(sourceBytes).digest('hex');
}
