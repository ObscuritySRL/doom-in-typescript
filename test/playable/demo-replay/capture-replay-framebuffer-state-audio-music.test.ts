import { describe, expect, test } from 'bun:test';

import {
  CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_ID,
  CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_TITLE,
  CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND,
  captureReplayFramebufferStateAudioMusic,
} from '../../../src/playable/demo-replay/captureReplayFramebufferStateAudioMusic.ts';

const EXPECTED_SOURCE_SHA256 = '5277e196d4ad95a322d4f8a5c8b199e2c8e3f6fb72a47af6d9cc69fbca783167';

describe('captureReplayFramebufferStateAudioMusic', () => {
  test('locks the command contract and formatted source hash', async () => {
    const sourceText = await Bun.file('src/playable/demo-replay/captureReplayFramebufferStateAudioMusic.ts').text();

    expect(CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND).toBe('bun run doom.ts');
    expect(sha256Hex(sourceText)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('cross-checks the missing side-by-side replay audit linkage', async () => {
    const auditManifestJson: unknown = await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json();

    if (!isAuditManifest(auditManifestJson)) {
      throw new Error('01-015 audit manifest shape changed');
    }

    const evidence = captureReplayFramebufferStateAudioMusic(createTwoTicDemoBuffer());
    const missingSurfaceNames = auditManifestJson.explicitNullSurfaces.map((surface) => surface.surface);

    expect(auditManifestJson.stepId).toBe(CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_ID);
    expect(auditManifestJson.stepTitle).toBe(CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_TITLE);
    expect(auditManifestJson.targetReplayContract.requiredCommand).toBe(CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND);
    expect(missingSurfaceNames).toContain('audio-hash-comparison');
    expect(missingSurfaceNames).toContain('framebuffer-hash-comparison');
    expect(missingSurfaceNames).toContain('state-hash-comparison');
    expect(evidence.auditEvidence).toEqual({
      commandContract: 'bun run doom.ts',
      missingSurfaces: ['audio-hash-comparison', 'framebuffer-hash-comparison', 'state-hash-comparison'],
      sourceManifestStepId: '01-015',
      sourceManifestStepTitle: 'audit-missing-side-by-side-replay',
    });
  });

  test('captures exact deterministic replay stream evidence', () => {
    const evidence = captureReplayFramebufferStateAudioMusic(createTwoTicDemoBuffer(), {
      captureTics: 8,
      demoName: 'DEMO1',
    });

    expect(evidence.captureTics).toBe(2);
    expect(evidence.command).toBe('bun run doom.ts');
    expect(evidence.completionAction).toBe('advance-demo');
    expect(evidence.demoName).toBe('DEMO1');
    expect(evidence.inputScript).toEqual({
      description: 'Empty input script for pre-recorded demo playback capture',
      events: [],
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 0,
    });
    expect(evidence.frameCaptures).toEqual([
      {
        audioEventHash: '6cca9d57b9568d3f2398be7df97627bd3f544c47fbff1c74db42c6d5fee34aac',
        framebufferHash: '44e4f2e7a7f2aad5c1a42d2a526a69d117c170ec880aa680687e51002d7ae30a',
        musicEventHash: 'e88fd98aa081acb376c7851dc79e5727cda99f61cc3fd7cda8745043256f3b85',
        stateHash: '63c14a7655ae6be03ef4c90907fa034fbcc752a9bcb72863b8046ca0be40d8f4',
        tic: 0,
      },
      {
        audioEventHash: '5ab17b4a88da78983edc6b9b189bab23e97518fc17cfbb252cbc2c2af730baef',
        framebufferHash: '4847b9639459c3085bde0544f0a86d40293d1f7a9c94f4836d5cc6bc7c3a89fd',
        musicEventHash: 'bb0bcd62f611f57a16d14720a8db73a93930a03b3c88d42e31e447059c9c8e7b',
        stateHash: '17b92849086f05af336599e2218f8dc35f748b462f7064711d55f2d59d3d5f5e',
        tic: 1,
      },
    ]);
    expect(evidence.snapshot).toEqual({
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
    });
    expect(evidence.streamHashes).toEqual({
      audio: '3434cbed49aa8f239282a6c20d00d51135bc692e228a1d33caa6fed3be19876c',
      framebuffer: '8f9d63e2edd0cde8b87c5cc405ba4789b77bc8149deb3465885948d3bc03244f',
      music: '6ad800ec1dd40897e9868288f3f072524dbaf078ca01f4095942835d5ab9ba95',
      state: 'd28bc0360e0f8209269effe0566a186f7dd232eb4c2ee345649824b587441216',
    });
    expect(evidence.ticCommandHash).toBe('69ab5d02c523305fe19e72ab1e085d04ab37266298502ad71e87504bfdd3e4d9');
    expect(evidence.ticCount).toBe(2);
    expect(evidence.replayHash).toBe('15770a113f86acf06972840d41f00ffc19bdd52ac0522d536b2c317f88ccdebd');
  });

  test('preserves single-demo quit completion in capture evidence', () => {
    const evidence = captureReplayFramebufferStateAudioMusic(createTwoTicDemoBuffer(), {
      captureTics: 8,
      singleDemo: true,
    });

    expect(evidence.completionAction).toBe('quit');
    expect(evidence.snapshot.singleDemo).toBe(true);
    expect(evidence.replayHash).toBe('4b6305ef57927bf4ea2a2b70b695cf8903ee47230bb3a4b3570110c522e73da8');
  });

  test('rejects legacy launcher commands before parsing demo bytes', () => {
    expect(() =>
      captureReplayFramebufferStateAudioMusic(Buffer.alloc(0), {
        command: 'bun run src/main.ts',
      }),
    ).toThrow('Replay capture requires bun run doom.ts');
  });

  test('rejects marker-only demo streams without captureable tics', () => {
    expect(() => captureReplayFramebufferStateAudioMusic(createMarkerOnlyDemoBuffer())).toThrow('Replay capture requires at least one demo tic');
  });
});

interface AuditManifest {
  readonly explicitNullSurfaces: readonly AuditManifestNullSurface[];
  readonly stepId: string;
  readonly stepTitle: string;
  readonly targetReplayContract: {
    readonly requiredCommand: string;
  };
}

interface AuditManifestNullSurface {
  readonly surface: string;
}

function createDemoHeader(): number[] {
  return [0x6d, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00];
}

function createMarkerOnlyDemoBuffer(): Buffer {
  return Buffer.from([...createDemoHeader(), 0x80]);
}

function createTwoTicDemoBuffer(): Buffer {
  return Buffer.from([...createDemoHeader(), 0x01, 0x00, 0x20, 0x01, 0xff, 0x01, 0x10, 0x00, 0x80]);
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const targetReplayContract = value.targetReplayContract;
  return Array.isArray(value.explicitNullSurfaces) && typeof value.stepId === 'string' && typeof value.stepTitle === 'string' && isRecord(targetReplayContract) && typeof targetReplayContract.requiredCommand === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
