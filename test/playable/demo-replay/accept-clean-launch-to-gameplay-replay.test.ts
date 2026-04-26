import { describe, expect, test } from 'bun:test';

import type { InputScriptPayload } from '../../../src/oracles/inputScript.ts';

import { DemoPlayback } from '../../../src/demo/demoPlayback.ts';
import { EMPTY_TITLE_LOOP_SCRIPT } from '../../../src/oracles/inputScript.ts';
import {
  ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND,
  ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND_CONTRACT,
  ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_STEP_IDENTIFIER,
  SIDE_BY_SIDE_REPLAY_AUDIT_STEP_IDENTIFIER,
  acceptCleanLaunchToGameplayReplay,
} from '../../../src/playable/demo-replay/acceptCleanLaunchToGameplayReplay.ts';

const ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_SOURCE_PATH = 'src/playable/demo-replay/acceptCleanLaunchToGameplayReplay.ts';

describe('acceptCleanLaunchToGameplayReplay', () => {
  test('locks the Bun command contract and 01-015 audit manifest link', async () => {
    const auditManifest = requireRecord(await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json(), 'auditManifest');
    const targetReplayContract = requireRecord(auditManifest.targetReplayContract, 'targetReplayContract');
    const explicitNullSurfaces = requireRecordArray(auditManifest.explicitNullSurfaces, 'explicitNullSurfaces');

    expect(ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND).toBe('bun run doom.ts');
    expect(ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_STEP_IDENTIFIER).toBe('13-010');
    expect(SIDE_BY_SIDE_REPLAY_AUDIT_STEP_IDENTIFIER).toBe('01-015');
    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-015');
    expect(targetReplayContract.requiredCommand).toBe(ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND);
    expect(explicitNullSurfaces.some((explicitNullSurface) => explicitNullSurface.surface === 'side-by-side-replay-command')).toBe(true);
  });

  test('accepts clean launch to gameplay replay with exact deterministic evidence', async () => {
    const evidence = acceptCleanLaunchToGameplayReplay({
      demoBuffer: createTwoTicDemoBuffer(),
    });

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(await sha256File(ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_SOURCE_PATH)).toBe('8c88cf9ac9a4ef3a51c44aabf231ae1a7cc581a40b258c22d24ad4b0d5705a0b');
    expect(evidence.auditEvidence).toEqual({
      missingSurface: 'side-by-side-replay-command',
      sourceStepIdentifier: '01-015',
    });
    expect(evidence.cleanLaunch).toEqual({
      inputEventCount: 0,
      scriptHash: '080942b75058e2bb80c8f3708b5a86973db393c0d5356eb6b198d093c71d50fe',
      targetRunMode: 'title-loop',
      ticRateHz: 35,
      totalTics: 0,
      transition: 'clean-launch-to-gameplay',
    });
    expect(evidence.commandContract).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(evidence.demoPlayback.activePlayerCounts).toEqual([1, 1]);
    expect(evidence.demoPlayback.completionAction).toBe('advance-demo');
    expect(evidence.demoPlayback.demoTicCount).toBe(2);
    expect(evidence.demoPlayback.finalSnapshot).toMatchObject({
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
    expect(evidence.demoPlayback.ticCommandHash).toBe('85c8a0e233a40a4decc6b5c4a2b9e9cb88a9532f062205fb0e4cadce6a1cb3b1');
    expect(evidence.demoPlayback.ticSignatures).toEqual(['40170a2f0ce38594003fcea8798cd3ab3695b538a11a4e75efb2acc2476a0947', '84f487c126e79a7a5ade05989802ecfcc6d8e895976fcb600215d6f02d426b00']);
    expect(evidence.replayHash).toBe('cd2aad40b67afec10c25fa67a5b59826b3dbc5c965e9ea208d29a620a9658612');
    expect(evidence.stepIdentifier).toBe('13-010');
  });

  test('preserves the demo marker transition to gameplay acceptance', () => {
    const playback = new DemoPlayback(createTwoTicDemoBuffer());

    expect(playback.readNextTic()).not.toBeNull();
    expect(playback.readNextTic()).not.toBeNull();
    expect(playback.readNextTic()).toBeNull();
    expect(playback.snapshot()).toMatchObject({
      completionAction: 'advance-demo',
      demoplayback: false,
      ticIndex: 2,
    });
  });

  test('rejects marker-only demo replay streams', () => {
    expect(() =>
      acceptCleanLaunchToGameplayReplay({
        demoBuffer: createMarkerOnlyDemoBuffer(),
      }),
    ).toThrow('requires at least one gameplay tic');
  });

  test('rejects invalid input scripts before accepting replay evidence', () => {
    const invalidInputScript: InputScriptPayload = {
      description: 'Invalid clean-launch scan code',
      events: Object.freeze([
        {
          kind: 'key-down',
          scanCode: 0x100,
          tic: 0,
        },
      ]),
      targetRunMode: EMPTY_TITLE_LOOP_SCRIPT.targetRunMode,
      ticRateHz: 35,
      totalTics: 1,
    };

    expect(() =>
      acceptCleanLaunchToGameplayReplay({
        demoBuffer: createTwoTicDemoBuffer(),
        inputScript: invalidInputScript,
      }),
    ).toThrow('inputScript.events[].scanCode must be an integer in 0..255');
  });

  test('rejects legacy launcher commands before parsing demo bytes', () => {
    expect(() =>
      acceptCleanLaunchToGameplayReplay({
        demoBuffer: Buffer.from([0xff]),
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Expected Bun runtime command bun run doom.ts');
  });
});

function createMarkerOnlyDemoBuffer(): Buffer {
  return Buffer.from([...createSinglePlayerDemoHeader(), 0x80]);
}

function createSinglePlayerDemoHeader(): readonly number[] {
  return [109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0];
}

function createTwoTicDemoBuffer(): Buffer {
  return Buffer.from([...createSinglePlayerDemoHeader(), 12, 0, 1, 0, 0, 4, 2, 1, 0x80]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be a record`);
  }

  return value;
}

function requireRecordArray(value: unknown, label: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new TypeError(`${label} must be a record array`);
  }

  return value;
}

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(new Uint8Array(await Bun.file(path).arrayBuffer()));
  return hasher.digest('hex');
}
