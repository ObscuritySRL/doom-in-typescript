import { describe, expect, test } from 'bun:test';

const evidenceHash = '914619b51275e4559bf71423c97d4908a535fadf6bbba847752217f6dd69743e';
const manifestPath = 'plan_fps/manifests/15-008-gate-save-load.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';

const manifestPayload = {
  schemaVersion: 1,
  stepId: '15-008',
  stepTitle: 'gate-save-load',
  commandContract: {
    runtimeCommand: 'bun run doom.ts',
    program: 'bun',
    subcommand: 'run',
    entryFile: 'doom.ts',
  },
  gate: {
    id: 'gate-save-load',
    status: 'accepted',
    acceptanceScope: [
      {
        oracleId: 'OR-FPS-022',
        artifact: 'test/oracles/fixtures/capture-save-load-menu-path.json',
        coverage: 'save-load menu path from captured reference behavior',
      },
      {
        oracleId: 'OR-FPS-031',
        artifact: 'test/oracles/fixtures/capture-live-save-load-roundtrip.json',
        coverage: 'live save-load roundtrip from captured reference behavior',
      },
    ],
    requiredRuntimePath: 'bun-run-playable',
    windowedOnlyDifference: true,
  },
  transition: {
    fromStepId: '15-007',
    fromStepTitle: 'gate-audio',
    toStepId: '15-008',
    toStepTitle: 'gate-save-load',
    nextStepId: '15-009',
    nextStepTitle: 'gate-attract-loop-and-long-run',
  },
  deterministicReplayCompatibility: {
    compatible: true,
    inputStreamMutated: false,
    randomSeedMutated: false,
    saveFileBytesRedistributed: false,
    simulationTicMutated: false,
  },
  oracleRegistration: {
    oracleId: 'OR-FPS-044',
    artifact: 'plan_fps/manifests/15-008-gate-save-load.json',
    authority: 'gate save load acceptance evidence for the Bun-run playable parity path',
    refreshCommand: 'bun test test/playable/acceptance/gate-save-load.test.ts',
  },
};

const expectedManifest = {
  ...manifestPayload,
  evidenceHash,
};

describe('gate save load acceptance manifest', () => {
  test('locks the save-load gate evidence payload', async () => {
    const manifest: unknown = await Bun.file(manifestPath).json();

    expect(manifest).toEqual(expectedManifest);
  });

  test('locks the save-load gate evidence hash', () => {
    const actualHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(manifestPayload)).digest('hex');

    expect(actualHash).toBe(evidenceHash);
  });

  test('registers the gate artifact as a reference oracle', async () => {
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();

    expect(oracleRegistry).toContain('| OR-FPS-044 | `plan_fps/manifests/15-008-gate-save-load.json` | gate save load acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-save-load.test.ts` |');
  });
});
