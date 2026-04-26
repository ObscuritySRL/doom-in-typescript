import { describe, expect, test } from 'bun:test';

import { REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT, replayDemo2Deterministically } from '../../../src/playable/demo-replay/replayDemo2Deterministically.ts';

const SOURCE_PATH = 'src/playable/demo-replay/replayDemo2Deterministically.ts';
const SOURCE_SHA256 = 'b4f794a598e1131dbffa52d7c9293780676dd4514c903b434e56f36b4f363825';

describe('replayDemo2Deterministically', () => {
  test('locks the Bun-run DEMO2 replay command contract and audit evidence', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();

    expect(sha256Text(sourceText)).toBe(SOURCE_SHA256);
    expect(REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });

    const evidence = replayDemo2Deterministically(createDemo2Buffer());

    expect(evidence.auditManifestPath).toBe('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json');
    expect(evidence.commandContract).toEqual(REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT);
    expect(evidence.demoName).toBe('DEMO2');
    expect(evidence.inputScriptTargetRunMode).toBe('demo-playback');
  });

  test('replays DEMO2 deterministically through the marker transition', () => {
    const evidence = replayDemo2Deterministically(createDemo2Buffer());

    expect(evidence).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      commandContract: {
        entryFile: 'doom.ts',
        runtimeCommand: 'bun run doom.ts',
      },
      completionAction: 'advance-demo',
      demoName: 'DEMO2',
      inputScriptDescription: 'Empty input script for pre-recorded demo playback capture',
      inputScriptTargetRunMode: 'demo-playback',
      playerCount: 4,
      replayHash: 'f4116862a910a88785042ca14b12bbda7d64a3cd7e634cbfc458bf4aa24b5bf7',
      ticCommandHash: 'af3438c72f736d8208c5d11c1a6d11f52c76c416a5ffa6d2a750eb19f922d2d0',
      ticCount: 2,
      ticSignatures: ['b9e31e319b1e02f9899cc2e2ef8744a8e332c0022e5cd7d529ef8f47a8778792', 'f2d6de0bdbbf1b9dbe29f3157502f1134b0dbba0c1547e614832d0a15215310b'],
    });
  });

  test('rejects legacy launcher commands before reading demo bytes', () => {
    expect(() =>
      replayDemo2Deterministically(Buffer.alloc(0), {
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('replay-demo2-deterministically requires bun run doom.ts');
  });

  test('rejects empty DEMO2 streams', () => {
    expect(() => replayDemo2Deterministically(createEmptyDemo2Buffer())).toThrow('DEMO2 replay must contain at least one tic');
  });
});

function createDemo2Buffer(): Buffer {
  return Buffer.from([0x6d, 0x02, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x19, 0x00, 0x10, 0x01, 0xe7, 0x00, 0x11, 0x02, 0x80]);
}

function createEmptyDemo2Buffer(): Buffer {
  return Buffer.from([0x6d, 0x02, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x80]);
}

function sha256Text(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
