import { describe, expect, test } from 'bun:test';

const evidenceHash = '67807d585153dbac7acf4b9c8b6dedcd690dc4d7322016910c73b3ceb4182c38';
const manifestPath = 'plan_fps/manifests/15-010-gate-final-side-by-side.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';

const manifestPayload = {
  schemaVersion: 1,
  stepId: '15-010',
  stepTitle: 'gate-final-side-by-side',
  commandContract: {
    runtimeCommand: 'bun run doom.ts',
    program: 'bun',
    subcommand: 'run',
    entryFile: 'doom.ts',
  },
  gate: {
    id: 'gate-final-side-by-side',
    status: 'accepted',
    acceptanceScope: [
      {
        oracleId: 'OR-FPS-036',
        artifact: 'test/oracles/fixtures/capture-final-side-by-side-replay.json',
        coverage: 'final side-by-side replay capture contract pairing reference and implementation runs on the shared input trace and sample tics',
      },
      {
        oracleId: 'OR-FPS-032',
        artifact: 'test/oracles/fixtures/capture-sfx-hash-windows.json',
        coverage: 'sampled sfx audio hash windows from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-033',
        artifact: 'test/oracles/fixtures/capture-music-event-hash-windows.json',
        coverage: 'sampled music event hash windows from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-034',
        artifact: 'test/oracles/fixtures/capture-framebuffer-hash-windows.json',
        coverage: 'sampled framebuffer hash windows from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-035',
        artifact: 'test/oracles/fixtures/capture-state-hash-windows.json',
        coverage: 'sampled state hash windows from captured reference behavior',
      },
    ],
    requiredRuntimePath: 'bun-run-playable',
    windowedOnlyDifference: true,
  },
  transition: {
    fromStepId: '15-009',
    fromStepTitle: 'gate-attract-loop-and-long-run',
    toStepId: '15-010',
    toStepTitle: 'gate-final-side-by-side',
    nextStepId: null,
    nextStepTitle: null,
  },
  deterministicReplayCompatibility: {
    compatible: true,
    inputStreamMutated: false,
    randomSeedMutated: false,
    saveFileBytesRedistributed: false,
    simulationTicMutated: false,
  },
  oracleRegistration: {
    oracleId: 'OR-FPS-046',
    artifact: 'plan_fps/manifests/15-010-gate-final-side-by-side.json',
    authority: 'gate final side by side acceptance evidence for the Bun-run playable parity path',
    refreshCommand: 'bun test test/playable/acceptance/gate-final-side-by-side.test.ts',
  },
};

const expectedManifest = {
  ...manifestPayload,
  evidenceHash,
};

describe('gate final side by side acceptance manifest', () => {
  test('locks the final side-by-side gate evidence payload', async () => {
    const manifest: unknown = await Bun.file(manifestPath).json();

    expect(manifest).toEqual(expectedManifest);
  });

  test('locks the final side-by-side gate evidence hash', () => {
    const actualHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(manifestPayload)).digest('hex');

    expect(actualHash).toBe(evidenceHash);
  });

  test('registers the gate artifact as a reference oracle', async () => {
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();

    expect(oracleRegistry).toContain(
      '| OR-FPS-046 | `plan_fps/manifests/15-010-gate-final-side-by-side.json` | gate final side by side acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-final-side-by-side.test.ts` |',
    );
  });

  test('terminates the gate transition chain at the final acceptance gate', () => {
    expect(manifestPayload.transition.toStepId).toBe('15-010');
    expect(manifestPayload.transition.fromStepId).toBe('15-009');
    expect(manifestPayload.transition.nextStepId).toBeNull();
    expect(manifestPayload.transition.nextStepTitle).toBeNull();
  });

  test('locks the Bun runtime command contract and final-gate oracle scope', () => {
    expect(manifestPayload.commandContract).toEqual({
      runtimeCommand: 'bun run doom.ts',
      program: 'bun',
      subcommand: 'run',
      entryFile: 'doom.ts',
    });
    expect(manifestPayload.gate.requiredRuntimePath).toBe('bun-run-playable');
    expect(manifestPayload.gate.windowedOnlyDifference).toBe(true);
    expect(manifestPayload.gate.acceptanceScope.map((entry) => entry.oracleId)).toEqual(['OR-FPS-036', 'OR-FPS-032', 'OR-FPS-033', 'OR-FPS-034', 'OR-FPS-035']);
  });

  test('locks deterministic replay compatibility flags', () => {
    expect(manifestPayload.deterministicReplayCompatibility).toEqual({
      compatible: true,
      inputStreamMutated: false,
      randomSeedMutated: false,
      saveFileBytesRedistributed: false,
      simulationTicMutated: false,
    });
  });
});
