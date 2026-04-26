import { describe, expect, test } from 'bun:test';

import { DETECT_LONG_RUN_DRIFT_COMMAND, detectLongRunDrift } from '../../../src/playable/demo-replay/detectLongRunDrift.ts';

const LONG_RUN_DEMO = Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0x80]);

const MARKER_ONLY_DEMO = Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0x80]);

describe('detect long run drift', () => {
  test('locks the Bun command contract and side-by-side replay audit linkage', async () => {
    const evidence = detectLongRunDrift(LONG_RUN_DEMO, { windowTics: 2 });
    const manifestText = await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').text();

    expect(DETECT_LONG_RUN_DRIFT_COMMAND).toBe('bun run doom.ts');
    expect(evidence.commandContract).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(evidence.auditEvidence).toEqual({
      manifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      missingSurface: 'synchronized-tic-stepper',
      requiredCommand: 'bun run doom.ts',
      stepId: '01-015',
    });
    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(manifestText).toContain('"surface": "synchronized-tic-stepper"');
  });

  test('locks the formatted source hash', async () => {
    const source = await Bun.file('src/playable/demo-replay/detectLongRunDrift.ts').text();

    expect(sha256(source)).toBe('76714371a988f5bef854d5d9f59ad9801df97b187261f578b397520a4b22f19f');
  });

  test('locks exact long-run drift evidence for deterministic replay windows', () => {
    expect(detectLongRunDrift(LONG_RUN_DEMO, { windowTics: 2 })).toEqual({
      auditEvidence: {
        manifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
        missingSurface: 'synchronized-tic-stepper',
        requiredCommand: 'bun run doom.ts',
        stepId: '01-015',
      },
      commandContract: {
        entryFile: 'doom.ts',
        runtimeCommand: 'bun run doom.ts',
      },
      completionAction: 'advance-demo',
      driftEvents: [],
      driftStatus: 'not-detected',
      inputScript: {
        description: 'Empty input script for pre-recorded demo playback capture',
        events: [],
        targetRunMode: 'demo-playback',
        ticRateHz: 35,
        totalTics: 0,
      },
      replayHash: 'a925f79c6211f3ab6780c98ead436196baa7a6da01a56174a9def7756e800b52',
      ticCommandHash: 'ee5b70bb240dff5006404444dddf726298ae06ac7ba32d048aa67b299f325b21',
      ticCount: 4,
      transition: {
        completionAction: 'advance-demo',
        from: 'demo-playback',
        markerConsumed: true,
        to: 'long-run-drift-report',
      },
      windowTics: 2,
      windows: [
        {
          cumulativeHash: 'e30697a4417ab6e67d48cb8e9a08a4fdd470c9f95372b5e3c03f6fc01fe2d0f8',
          firstTic: 0,
          lastTic: 1,
          ticCommandHash: 'a63d1f6e837223048362c9859f939b2bb8f101b04d16b5077a19627f292526b6',
          ticCount: 2,
          windowHash: '9dd68849a4a204acd87479075a87641895b2452d5fde4be71995b51f56992b30',
          windowIndex: 0,
        },
        {
          cumulativeHash: '12af9de639e5ff359136afc2da424f24a6f32960aca9979d9103f606d4dfc790',
          firstTic: 2,
          lastTic: 3,
          ticCommandHash: '249b462a3a7c16bb89becb4a1932117db1cea93b3ffeaa0fe50548f584804e5d',
          ticCount: 2,
          windowHash: '9a102f64332a754ffbcc43829886e91f607538764224b55d0f8e60ec4b56c96e',
          windowIndex: 1,
        },
      ],
    });
  });

  test('reports mismatched expected window hashes as drift events', () => {
    const evidence = detectLongRunDrift(LONG_RUN_DEMO, {
      expectedWindowHashes: ['9dd68849a4a204acd87479075a87641895b2452d5fde4be71995b51f56992b30', 'expected-window-hash'],
      windowTics: 2,
    });

    expect(evidence.driftStatus).toBe('detected');
    expect(evidence.driftEvents).toEqual([
      {
        expectedWindowHash: 'expected-window-hash',
        observedWindowHash: '9a102f64332a754ffbcc43829886e91f607538764224b55d0f8e60ec4b56c96e',
        windowIndex: 1,
      },
    ]);
  });

  test('rejects non-product commands before demo parsing', () => {
    expect(() => detectLongRunDrift(Buffer.from([0x80]), { command: 'bun run src/main.ts' })).toThrow('detect-long-run-drift requires bun run doom.ts');
  });

  test('rejects marker-only demos without a replay window', () => {
    expect(() => detectLongRunDrift(MARKER_ONLY_DEMO)).toThrow('detect-long-run-drift requires at least one demo tic before the marker');
  });
});

function sha256(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}
