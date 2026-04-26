import { describe, expect, test } from 'bun:test';

import type { AcceptAttractLoopAndLongRunReplaysEvidence } from '../../../src/playable/demo-replay/acceptAttractLoopAndLongRunReplays.ts';
import type { InputScriptPayload } from '../../../src/oracles/inputScript.ts';

import {
  ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH,
  ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND,
  ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID,
  ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_TITLE,
  acceptAttractLoopAndLongRunReplays,
} from '../../../src/playable/demo-replay/acceptAttractLoopAndLongRunReplays.ts';
import { EMPTY_TITLE_LOOP_SCRIPT } from '../../../src/oracles/inputScript.ts';

const EXPECTED_ACCEPTANCE_HASH = 'b1ef76a5c7ec05bf6a43ebc742cacb7005f4fb729f487b036483b833aae7d629';
const EXPECTED_INPUT_SCRIPT_HASH = '0218a222fbd45f94d546e7d93f554e1fa310671ee537c28d5fc74ba5359065ff';
const EXPECTED_LONG_RUN_REPLAY_HASH = '40771aed5f8549d23f02dcd56c88d3d2df36785de121c796cfe26cdbdf2b3204';
const EXPECTED_LONG_RUN_WINDOW_HASHES = Object.freeze(['7f3a427ef3f9366f8af3ab595709e81ea1e9588fd199efc83d77f874a6f9b440', 'f7e9a9845c9265f61c1b15340ff0a9ff863f8225ae80f50f9e8977fd0c13cf7f'] as const);
const EXPECTED_PRODUCT_SOURCE_SHA256 = '4d1eb898f96ca6433fbec43848a3abbd7cce1e6d92e914fa2f2c9615aa9d0645';
const EXPECTED_TIC_COMMAND_HASH = '8bf4bb43cd9296e2e2c7e35deee438d21eb3743393043b57a018c7b3857f32c1';
const EXPECTED_TIC_SIGNATURES = Object.freeze([
  '04ba1ff249983882718770b1bef7c3d604b0d55851da95f8f3994ff8d99a3fa0',
  '7bba1bf1ff19d87564017dc05e07f0ef0a4505a271ecac3f43b2e93f5a59013c',
  'aafd826e9b4d6055189679881d3d5736f1f7241b4f5b385f4e562136ddf6503d',
] as const);
const PRODUCT_SOURCE_PATH = 'src/playable/demo-replay/acceptAttractLoopAndLongRunReplays.ts';

describe('acceptAttractLoopAndLongRunReplays', () => {
  test('locks the Bun product command contract and 01-015 audit linkage', async () => {
    const auditManifest = requireRecord(await Bun.file(ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH).json(), 'audit manifest');
    const commandContracts = requireRecord(auditManifest.commandContracts, 'audit manifest commandContracts');
    const targetPlayable = requireRecord(commandContracts.targetPlayable, 'audit manifest targetPlayable');

    expect(ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json');
    expect(ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID).toBe('13-011');
    expect(ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_TITLE).toBe('accept-attract-loop-and-long-run-replays');
    expect(requireString(targetPlayable.entryFile, 'audit manifest target entryFile')).toBe('doom.ts');
    expect(requireString(targetPlayable.runtimeCommand, 'audit manifest target runtimeCommand')).toBe(ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND);
  });

  test('locks the formatted product source hash', async () => {
    const productSource = await Bun.file(PRODUCT_SOURCE_PATH).text();

    expect(sha256Hex(productSource)).toBe(EXPECTED_PRODUCT_SOURCE_SHA256);
  });

  test('accepts attract-loop marker transition and long-run replay hashes', () => {
    const evidence = acceptAttractLoopAndLongRunReplays({
      demoBuffer: createThreeTicDemoBuffer(),
      expectedLongRunWindowHashes: EXPECTED_LONG_RUN_WINDOW_HASHES,
    });

    expect(evidence).toMatchObject({
      acceptanceHash: EXPECTED_ACCEPTANCE_HASH,
      auditManifestPath: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH,
      commandContract: {
        entryFile: 'doom.ts',
        runtimeCommand: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND,
      },
      demoTicCount: 3,
      inputScriptHash: EXPECTED_INPUT_SCRIPT_HASH,
      longRunDriftEvents: [],
      longRunReplayHash: EXPECTED_LONG_RUN_REPLAY_HASH,
      stepIdentifier: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID,
      stepTitle: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_TITLE,
      ticCommandHash: EXPECTED_TIC_COMMAND_HASH,
      ticSignatures: EXPECTED_TIC_SIGNATURES,
    } satisfies Partial<AcceptAttractLoopAndLongRunReplaysEvidence>);
    expect(evidence.longRunWindows).toEqual([
      {
        cumulativeHash: '91c1a1c7c47d83bf3a8d4aab4fb476c49a70a6326596541dc1d4c5e4c5de3515',
        expectedHash: EXPECTED_LONG_RUN_WINDOW_HASHES[0],
        hash: EXPECTED_LONG_RUN_WINDOW_HASHES[0],
        matchesExpected: true,
        startTic: 0,
        ticCount: 2,
        windowIndex: 0,
      },
      {
        cumulativeHash: 'e253e86e14e4a8e3201be23393d891275481855f088972d94a3c3e2bfa9ab2f5',
        expectedHash: EXPECTED_LONG_RUN_WINDOW_HASHES[1],
        hash: EXPECTED_LONG_RUN_WINDOW_HASHES[1],
        matchesExpected: true,
        startTic: 2,
        ticCount: 1,
        windowIndex: 1,
      },
    ]);
    expect(evidence.markerTransition).toEqual({
      afterMarker: {
        completionAction: 'advance-demo',
        demoplayback: false,
        netGame: false,
        playersInGame: [true, false, false, false],
        ticIndex: 3,
      },
      beforeMarker: {
        completionAction: 'none',
        demoplayback: true,
        netGame: false,
        playersInGame: [true, false, false, false],
        ticIndex: 3,
      },
      completionAction: 'advance-demo',
    });
    expect(Object.isFrozen(evidence)).toBe(true);
  });

  test('reports long-run drift without hiding the actual window hash', () => {
    const mismatchedWindowHash = '0'.repeat(64);
    const evidence = acceptAttractLoopAndLongRunReplays({
      demoBuffer: createThreeTicDemoBuffer(),
      expectedLongRunWindowHashes: [mismatchedWindowHash],
    });

    expect(evidence.longRunDriftEvents).toEqual([
      {
        actualHash: EXPECTED_LONG_RUN_WINDOW_HASHES[0],
        expectedHash: mismatchedWindowHash,
        windowIndex: 0,
      },
    ]);
    expect(evidence.longRunWindows[0]?.matchesExpected).toBe(false);
  });

  test('rejects legacy launcher commands before parsing demo bytes', () => {
    expect(() =>
      acceptAttractLoopAndLongRunReplays({
        demoBuffer: Buffer.from([]),
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Runtime command must be bun run doom.ts');
  });

  test('rejects marker-only replay streams and invalid title-loop scripts', () => {
    const invalidInputScript = Object.freeze({
      description: EMPTY_TITLE_LOOP_SCRIPT.description,
      events: EMPTY_TITLE_LOOP_SCRIPT.events,
      targetRunMode: EMPTY_TITLE_LOOP_SCRIPT.targetRunMode,
      ticRateHz: 34,
      totalTics: EMPTY_TITLE_LOOP_SCRIPT.totalTics,
    } satisfies InputScriptPayload);

    expect(() =>
      acceptAttractLoopAndLongRunReplays({
        demoBuffer: createMarkerOnlyDemoBuffer(),
      }),
    ).toThrow('Attract-loop replay must contain at least one demo tic before the marker');
    expect(() =>
      acceptAttractLoopAndLongRunReplays({
        demoBuffer: createThreeTicDemoBuffer(),
        inputScript: invalidInputScript,
      }),
    ).toThrow('Attract-loop input script must run at 35 Hz');
  });
});

function createMarkerOnlyDemoBuffer(): Buffer {
  return Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 128]);
}

function createThreeTicDemoBuffer(): Buffer {
  return Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 10, 0, 1, 0, 0, 2, 0, 0, 5, 255, 3, 1, 128]);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object`);
  }

  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
