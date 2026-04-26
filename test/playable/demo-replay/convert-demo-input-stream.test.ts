import { describe, expect, test } from 'bun:test';

import { CONVERT_DEMO_INPUT_STREAM_COMMAND, convertDemoInputStream } from '../../../src/playable/demo-replay/convertDemoInputStream.ts';

interface AuditManifest {
  readonly explicitNullSurfaces: readonly AuditManifestExplicitNullSurface[];
  readonly schemaVersion: number;
  readonly stepId: string;
  readonly targetReplayContract: AuditManifestTargetReplayContract;
}

interface AuditManifestExplicitNullSurface {
  readonly surface: string;
}

interface AuditManifestTargetReplayContract {
  readonly requiredCommand: string;
}

const SAMPLE_DEMO_BUFFER_BYTES = Object.freeze([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 12, 254, 3, 1, 0, 5, 255, 2, 128]);
const SOURCE_PATH = 'src/playable/demo-replay/convertDemoInputStream.ts';

describe('convertDemoInputStream', () => {
  test('locks command contract and 01-015 side-by-side audit linkage', async () => {
    const auditManifest = (await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json()) as AuditManifest;
    const evidence = convertDemoInputStream(createSampleDemoBuffer(), { demoName: 'DEMO1' });

    expect(CONVERT_DEMO_INPUT_STREAM_COMMAND).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(auditManifest.targetReplayContract.requiredCommand).toBe(CONVERT_DEMO_INPUT_STREAM_COMMAND.runtimeCommand);
    expect(auditManifest.explicitNullSurfaces.some((surface) => surface.surface === 'input-trace-replay-loader')).toBe(true);
    expect(auditManifest.schemaVersion).toBe(evidence.auditEvidence.schemaVersion);
    expect(auditManifest.stepId).toBe(evidence.auditEvidence.stepIdentifier);
    expect(evidence.auditEvidence).toEqual({
      missingSurface: 'input-trace-replay-loader',
      schemaVersion: 1,
      stepIdentifier: '01-015',
    });
  });

  test('locks exact converted stream transition and hashes', () => {
    const evidence = convertDemoInputStream(createSampleDemoBuffer(), { demoName: 'DEMO1' });

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(evidence.activePlayerCounts).toEqual([1, 1]);
    expect(evidence.completionAction).toBe('advance-demo');
    expect(evidence.demoName).toBe('DEMO1');
    expect(evidence.inputScript).toEqual({
      description: 'Converted DEMO1 demo input stream',
      events: [],
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 2,
    });
    expect(evidence.ticCommandHash).toBe('7c76c537c1928362e376cd5c2de659021d00a5823e7ade0d5f0aeb253aa3b645');
    expect(evidence.ticSignatures).toEqual([
      {
        activePlayerCount: 1,
        commandSignature: '[{"angleTurn":768,"buttons":1,"forwardMove":12,"sideMove":-2}]',
        tic: 0,
      },
      {
        activePlayerCount: 1,
        commandSignature: '[{"angleTurn":-256,"buttons":2,"forwardMove":0,"sideMove":5}]',
        tic: 1,
      },
    ]);
    expect(evidence.totalTics).toBe(2);
    expect(evidence.replayHash).toBe('8f7dc41b370d6aa399353560b281a003a886d3ab1cb4a3e731e6a4b951825dc8');
  });

  test('locks formatted source hash', async () => {
    expect(sha256Hex(await Bun.file(SOURCE_PATH).text())).toBe('71c99ef8824fb34c47366b6691206ad93a240ac65d653bf48d11f722ada15831');
  });

  test('preserves single-demo quit completion in deterministic evidence', () => {
    const evidence = convertDemoInputStream(createSampleDemoBuffer(), {
      demoName: 'DEMO1',
      description: 'Single demo conversion',
      singleDemo: true,
    });

    expect(evidence.completionAction).toBe('quit');
    expect(evidence.inputScript).toEqual({
      description: 'Single demo conversion',
      events: [],
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      totalTics: 2,
    });
    expect(evidence.ticCommandHash).toBe('7c76c537c1928362e376cd5c2de659021d00a5823e7ade0d5f0aeb253aa3b645');
    expect(evidence.replayHash).toBe('0ea7ed40464617078776d928c49a27fa44cb27a059281e5737f15ac056114926');
  });

  test('prevalidates the Bun runtime command before parsing demo bytes', () => {
    expect(() => convertDemoInputStream(Buffer.from([]), { command: 'bun run src/main.ts' })).toThrow('convert-demo-input-stream requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects marker-only streams that carry no tic commands', () => {
    expect(() => convertDemoInputStream(createMarkerOnlyDemoBuffer())).toThrow('Demo input stream must contain at least one tic command');
  });
});

function createMarkerOnlyDemoBuffer(): Buffer {
  return Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 128]);
}

function createSampleDemoBuffer(): Buffer {
  return Buffer.from(SAMPLE_DEMO_BUFFER_BYTES);
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
