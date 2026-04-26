import { describe, expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import type { InputScriptPayload } from '../../../src/oracles/inputScript.ts';

import { REPLAY_SCRIPTED_INPUT_FROM_CLEAN_LAUNCH_COMMAND_CONTRACT, replayScriptedInputFromCleanLaunch } from '../../../src/playable/demo-replay/replayScriptedInputFromCleanLaunch.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const EXPECTED_SOURCE_SHA256 = 'c8a3ccc9827e631bf4cc9a0b18f044e2d95458966a2062af2cd3703bfed72374';
const PRODUCT_SOURCE_PATH = 'src/playable/demo-replay/replayScriptedInputFromCleanLaunch.ts';

const MINIMAL_DEMO_BUFFER = Buffer.from([0x6d, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x80]);

describe('replayScriptedInputFromCleanLaunch', () => {
  test('locks the command contract and side-by-side replay audit linkage', async () => {
    expect(REPLAY_SCRIPTED_INPUT_FROM_CLEAN_LAUNCH_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });

    const auditManifest = requireRecord(JSON.parse(await Bun.file(AUDIT_MANIFEST_PATH).text()), 'audit manifest');
    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-015');

    const targetReplayContract = requireRecord(auditManifest.targetReplayContract, 'target replay contract');
    expect(targetReplayContract.acceptanceMode).toBe('side-by-side-verifiable replay parity');
    expect(targetReplayContract.currentVisibility).toBe('missing in allowed launch-surface files');
    expect(targetReplayContract.requiredCommand).toBe('bun run doom.ts');
  });

  test('replays the default clean-launch script deterministically', async () => {
    const evidence = replayScriptedInputFromCleanLaunch();

    expect(await hashFile(PRODUCT_SOURCE_PATH)).toBe(EXPECTED_SOURCE_SHA256);
    expect(evidence.demoReplay).toBeNull();
    expect(evidence.inputScript).toEqual({
      description: 'Scripted input from clean launch through deterministic replay entry',
      eventCount: 4,
      eventSignatures: [
        {
          eventIndex: 0,
          kind: 'key-down',
          payloadHash: '1bf789088c9a333a4dade11306d2ebaabae7f42d9b24444f5116c9c9639fe641',
          signature: '0:key-down:scanCode=13',
          tic: 0,
        },
        {
          eventIndex: 1,
          kind: 'key-up',
          payloadHash: '33783f5f134466ac21db3e26c719fce582625fec3efa0fb76b8a9e99e2bc6b17',
          signature: '1:key-up:scanCode=13',
          tic: 1,
        },
        {
          eventIndex: 2,
          kind: 'key-down',
          payloadHash: '71f7d1827d7e3359bff855a631685b1b6138138d4ef13329adfd01084edad0c8',
          signature: '3:key-down:scanCode=13',
          tic: 3,
        },
        {
          eventIndex: 3,
          kind: 'key-up',
          payloadHash: '79d11d05f80d4b428367646ff1d255c44cf234ebdb5e2728fef7551cb1186bb4',
          signature: '4:key-up:scanCode=13',
          tic: 4,
        },
      ],
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 6,
    });
    expect(evidence.launch).toEqual({
      mapName: 'E1M1',
      skill: 2,
      transition: 'clean-launch-to-scripted-input-replay',
    });
    expect(evidence.replayHash).toBe('675f8f8c441c4b82c232897e470d4b440afd4d741790771bdf8320af95926153');
  });

  test('records demo marker transition evidence when a demo stream is supplied', () => {
    const evidence = replayScriptedInputFromCleanLaunch({
      demoBuffer: MINIMAL_DEMO_BUFFER,
    });

    expect(evidence.demoReplay).toEqual({
      activePlayerCounts: [1],
      completionAction: 'advance-demo',
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
        ticIndex: 1,
      },
      ticCommandHash: 'e737886a22e126e1e9037ce263983d32aa9db6eb920a9568fb316a5f9dd43fe2',
      ticCommandSignatures: ['5088ae2ec33ce72b906c7ffcb5258e658144ef47865f0f271567bb32477edd7f'],
      ticCount: 1,
      transition: 'advance-demo',
    });
    expect(evidence.replayHash).toBe('036a57075b6546a9a34e37ab7aa9d6d102eba16fa151edaf676030e9e38c9478');
  });

  test('rejects non-product commands before replaying input', () => {
    expect(() =>
      replayScriptedInputFromCleanLaunch({
        command: 'bun run src/main.ts',
        demoBuffer: Buffer.from([0x80]),
      }),
    ).toThrow('replay scripted input requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects invalid scripted input evidence', () => {
    const invalidInputScript: InputScriptPayload = Object.freeze({
      description: 'Invalid scan code script',
      events: Object.freeze([
        Object.freeze({
          kind: 'key-down',
          scanCode: 0x100,
          tic: 0,
        }),
      ]),
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 1,
    });

    expect(() =>
      replayScriptedInputFromCleanLaunch({
        inputScript: invalidInputScript,
      }),
    ).toThrow('inputScript.events[0].scanCode must be an integer in 0..255, got 256');
  });
});

async function hashFile(path: string): Promise<string> {
  return createHash('sha256')
    .update(await Bun.file(path).text())
    .digest('hex');
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
