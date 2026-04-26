import { describe, expect, test } from 'bun:test';

import { DemoPlayback } from '../../../src/demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../../src/oracles/inputScript.ts';
import { PRESERVE_DEMO_TERMINATION_BEHAVIOR_AUDIT_EVIDENCE, PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT, preserveDemoTerminationBehavior } from '../../../src/playable/demo-replay/preserveDemoTerminationBehavior.ts';

const FORMATTED_SOURCE_SHA256 = '1240580357c90dc19cbee774f971410ab780e0f77c144a22c88cbce2017d1c9b';
const ONE_TIC_ADVANCE_REPLAY_HASH = 'f7a84870a62af81dc1eb1bb7ca4c880362b4ea2b0a47ee42acbf5b3718a7823a';
const ONE_TIC_QUIT_REPLAY_HASH = 'fc158f8166820f1fe370a8eabc3fa1bef5eff1130b3f95fa795efba8b3ba376f';
const ONE_TIC_TIC_COMMAND_HASH = '2ef04362fa1d9049f007f334150c3697f12ce74bbe466ca4470b48921dd849cc';

describe('preserveDemoTerminationBehavior', () => {
  test('locks the command contract, audit manifest linkage, and source hash', async () => {
    const sourceHash = await sha256File('src/playable/demo-replay/preserveDemoTerminationBehavior.ts');
    const sideBySideReplayAuditManifest = await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json();

    expect(PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(PRESERVE_DEMO_TERMINATION_BEHAVIOR_AUDIT_EVIDENCE).toEqual({
      missingSurface: 'input-trace-replay-loader',
      requiredCommand: 'bun run doom.ts',
      sourceManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      stepId: '13-006',
    });
    expect(sideBySideReplayAuditManifest.commandContracts.targetPlayable.runtimeCommand).toBe(PRESERVE_DEMO_TERMINATION_BEHAVIOR_AUDIT_EVIDENCE.requiredCommand);
    expect(sideBySideReplayAuditManifest.explicitNullSurfaces.some((surface: { readonly surface: string }) => surface.surface === 'input-trace-replay-loader')).toBe(true);
    expect(sourceHash).toBe(FORMATTED_SOURCE_SHA256);
  });

  test('preserves advance-demo completion at the marker boundary', () => {
    const evidence = preserveDemoTerminationBehavior({
      command: 'bun run doom.ts',
      demoBuffer: createOneTicDemoBuffer(),
    });

    expect(evidence.activePlayerCounts).toEqual([1]);
    expect(evidence.commandContract.runtimeCommand).toBe('bun run doom.ts');
    expect(evidence.completionAction).toBe('advance-demo');
    expect(evidence.completionSnapshot).toMatchObject({
      completionAction: 'advance-demo',
      demoplayback: false,
      netDemo: false,
      netGame: false,
      singleDemo: false,
      ticIndex: 1,
    });
    expect(evidence.inputScript).toEqual({
      description: 'Attract-loop demo advance after marker consumption',
      events: EMPTY_DEMO_PLAYBACK_SCRIPT.events,
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 1,
    });
    expect(evidence.markerBoundary).toEqual({
      completionAction: 'advance-demo',
      demoplaybackAfterMarker: false,
      demoplaybackBeforeMarker: true,
      finalReadResult: 'null',
      netDemoAfterMarker: false,
      netGameAfterMarker: false,
      readAtMarkerTic: 1,
      singleDemo: false,
    });
    expect(evidence.markerBoundarySnapshot).toMatchObject({
      completionAction: 'none',
      demoplayback: true,
      singleDemo: false,
      ticIndex: 1,
    });
    expect(evidence.replayHash).toBe(ONE_TIC_ADVANCE_REPLAY_HASH);
    expect(evidence.ticCommandHashes).toEqual([ONE_TIC_TIC_COMMAND_HASH]);
    expect(evidence.ticCount).toBe(1);
    expect(Object.isFrozen(evidence)).toBe(true);
  });

  test('preserves single-demo quit completion as a deterministic quit event', () => {
    const evidence = preserveDemoTerminationBehavior({
      command: 'bun run doom.ts',
      demoBuffer: createOneTicDemoBuffer(),
      singleDemo: true,
    });

    expect(evidence.completionAction).toBe('quit');
    expect(evidence.completionSnapshot).toMatchObject({
      completionAction: 'quit',
      demoplayback: false,
      singleDemo: true,
      ticIndex: 1,
    });
    expect(evidence.inputScript).toEqual({
      description: 'Single-demo quit termination after marker consumption',
      events: [{ kind: 'quit', tic: 1 }],
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 1,
    });
    expect(evidence.markerBoundary).toEqual({
      completionAction: 'quit',
      demoplaybackAfterMarker: false,
      demoplaybackBeforeMarker: true,
      finalReadResult: 'null',
      netDemoAfterMarker: false,
      netGameAfterMarker: false,
      readAtMarkerTic: 1,
      singleDemo: true,
    });
    expect(evidence.replayHash).toBe(ONE_TIC_QUIT_REPLAY_HASH);
    expect(evidence.ticCommandHashes).toEqual([ONE_TIC_TIC_COMMAND_HASH]);
  });

  test('rejects non-product commands before parsing demo bytes', () => {
    expect(() =>
      preserveDemoTerminationBehavior({
        command: 'bun run src/main.ts',
        demoBuffer: Buffer.from([]),
      }),
    ).toThrow('Expected command bun run doom.ts, got bun run src/main.ts');
  });

  test('matches DemoPlayback marker timing exactly', () => {
    const playback = new DemoPlayback(createOneTicDemoBuffer());

    expect(playback.readNextTic()).not.toBeNull();
    expect(playback.snapshot()).toMatchObject({
      completionAction: 'none',
      demoplayback: true,
      ticIndex: 1,
    });
    expect(playback.readNextTic()).toBeNull();
    expect(playback.snapshot()).toMatchObject({
      completionAction: 'advance-demo',
      demoplayback: false,
      ticIndex: 1,
    });
  });
});

function createOneTicDemoBuffer(): Buffer {
  return Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4, 0x80]);
}

async function sha256File(path: string): Promise<string> {
  const sourceText = await Bun.file(path).text();
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(sourceText);
  return hasher.digest('hex');
}
