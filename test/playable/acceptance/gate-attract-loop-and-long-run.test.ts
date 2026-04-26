import { describe, expect, test } from 'bun:test';

const evidenceHash = 'a491a15f2f0ce991b3558e24345919cb8a11f8f7ffa612a45788efea7974304c';
const manifestPath = 'plan_fps/manifests/15-009-gate-attract-loop-and-long-run.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';

const manifestPayload = {
  schemaVersion: 1,
  stepId: '15-009',
  stepTitle: 'gate-attract-loop-and-long-run',
  commandContract: {
    runtimeCommand: 'bun run doom.ts',
    program: 'bun',
    subcommand: 'run',
    entryFile: 'doom.ts',
  },
  gate: {
    id: 'gate-attract-loop-and-long-run',
    status: 'accepted',
    acceptanceScope: [
      {
        oracleId: 'OR-FPS-011',
        artifact: 'test/oracles/fixtures/capture-full-attract-loop-cycle.json',
        coverage: 'full attract loop cycle from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-012',
        artifact: 'test/oracles/fixtures/capture-demo1-playback-checkpoints.json',
        coverage: 'demo1 playback checkpoints from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-013',
        artifact: 'test/oracles/fixtures/capture-demo2-playback-checkpoints.json',
        coverage: 'demo2 playback checkpoints from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-014',
        artifact: 'test/oracles/fixtures/capture-demo3-playback-checkpoints.json',
        coverage: 'demo3 playback checkpoints from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-034',
        artifact: 'test/oracles/fixtures/capture-framebuffer-hash-windows.json',
        coverage: 'long-run framebuffer hash windows from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-035',
        artifact: 'test/oracles/fixtures/capture-state-hash-windows.json',
        coverage: 'long-run state hash windows from captured reference behavior',
      },
    ],
    requiredRuntimePath: 'bun-run-playable',
    windowedOnlyDifference: true,
  },
  transition: {
    fromStepId: '15-008',
    fromStepTitle: 'gate-save-load',
    toStepId: '15-009',
    toStepTitle: 'gate-attract-loop-and-long-run',
    nextStepId: '15-010',
    nextStepTitle: 'gate-final-side-by-side',
  },
  deterministicReplayCompatibility: {
    compatible: true,
    inputStreamMutated: false,
    randomSeedMutated: false,
    saveFileBytesRedistributed: false,
    simulationTicMutated: false,
  },
  oracleRegistration: {
    oracleId: 'OR-FPS-045',
    artifact: 'plan_fps/manifests/15-009-gate-attract-loop-and-long-run.json',
    authority: 'gate attract loop and long run acceptance evidence for the Bun-run playable parity path',
    refreshCommand: 'bun test test/playable/acceptance/gate-attract-loop-and-long-run.test.ts',
  },
};

const expectedManifest = {
  ...manifestPayload,
  evidenceHash,
};

describe('gate attract loop and long run acceptance manifest', () => {
  test('locks the attract-loop and long-run gate evidence payload', async () => {
    const manifest: unknown = await Bun.file(manifestPath).json();

    expect(manifest).toEqual(expectedManifest);
  });

  test('locks the attract-loop and long-run gate evidence hash', () => {
    const actualHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(manifestPayload)).digest('hex');

    expect(actualHash).toBe(evidenceHash);
  });

  test('registers the gate artifact as a reference oracle', async () => {
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();

    expect(oracleRegistry).toContain(
      '| OR-FPS-045 | `plan_fps/manifests/15-009-gate-attract-loop-and-long-run.json` | gate attract loop and long run acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-attract-loop-and-long-run.test.ts` |',
    );
  });
});
