import { describe, expect, test } from 'bun:test';

const evidenceHash = '478e72b0fbfb99478803672ced99cf349c94296bdc7227a2a83b34d687ddeef8';
const evidenceHashInput = '15-005|bun run doom.ts|OR-FPS-024|15-004>15-005|deterministic-replay-compatible|windowed-only';
const manifestFilePath = 'plan_fps/manifests/15-005-gate-e1m1-start.json';
const referenceOraclesFilePath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceOracleArtifactPath = 'test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json';

interface ParsedManifest {
  readonly evidenceHash: string;
  readonly evidenceHashInput: string;
  readonly oracleScope: readonly { readonly sourceArtifact: string }[];
}

const expectedManifest = {
  acceptanceGate: {
    acceptedOracleIdentifiers: ['OR-FPS-024'],
    behavior: 'clean launch can navigate through the accepted menu path and begin E1M1 from the Bun-run playable parity command',
    determinismBoundary: 'the first playable E1M1 start state is compared against the captured clean-launch E1M1 oracle before later input replay gates run',
    gateIdentifier: '15-005',
    gateTitle: 'gate-e1m1-start',
    nextGateIdentifier: '15-006',
    previousGateIdentifier: '15-004',
    runtimePathOnly: true,
  },
  commandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    runtimeCommand: 'bun run doom.ts',
    subcommand: 'run',
  },
  evidenceHash,
  evidenceHashInput,
  oracleRegistration: {
    artifact: manifestFilePath,
    authority: 'gate e1m1 start acceptance evidence for the Bun-run playable parity path',
    oracleIdentifier: 'OR-FPS-041',
    refreshCommand: 'bun test test/playable/acceptance/gate-e1m1-start.test.ts',
  },
  oracleScope: [
    {
      authority: 'e1m1 start from clean launch capture contract derived from local DOS binary authority and plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      oracleIdentifier: 'OR-FPS-024',
      sourceArtifact: 'test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json',
    },
  ],
  replayCompatibility: {
    deterministicReplayCompatible: true,
    inputStreamMutation: false,
    randomSeedMutation: false,
    simulationTickMutation: false,
  },
  schemaVersion: 1,
  transition: {
    fromStepIdentifier: '15-004',
    fromStepTitle: 'gate-menu-navigation',
    toStepIdentifier: '15-005',
    toStepTitle: 'gate-e1m1-start',
  },
  windowedPresentationDifference: 'windowed host presentation remains the only accepted presentation difference from reference fullscreen behavior',
};

describe('gate e1m1 start acceptance manifest', () => {
  test('locks the complete manifest schema and exact gate evidence', async () => {
    const parsedManifest: unknown = JSON.parse(await Bun.file(manifestFilePath).text());

    expect(parsedManifest).toEqual(expectedManifest);
  });

  test('locks the Bun runtime command contract and E1M1 oracle scope', () => {
    expect(expectedManifest.commandContract).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(expectedManifest.acceptanceGate.runtimePathOnly).toBe(true);
    expect(expectedManifest.oracleScope).toEqual([
      {
        authority: 'e1m1 start from clean launch capture contract derived from local DOS binary authority and plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
        oracleIdentifier: 'OR-FPS-024',
        sourceArtifact: 'test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json',
      },
    ]);
  });

  test('locks the deterministic replay transition and evidence hash', () => {
    const hashedEvidence = new Bun.CryptoHasher('sha256').update(evidenceHashInput).digest('hex');

    expect(expectedManifest.transition).toEqual({
      fromStepIdentifier: '15-004',
      fromStepTitle: 'gate-menu-navigation',
      toStepIdentifier: '15-005',
      toStepTitle: 'gate-e1m1-start',
    });
    expect(expectedManifest.replayCompatibility).toEqual({
      deterministicReplayCompatible: true,
      inputStreamMutation: false,
      randomSeedMutation: false,
      simulationTickMutation: false,
    });
    expect(hashedEvidence).toBe(evidenceHash);
  });

  test('registers both the gate oracle and its upstream source oracle in REFERENCE_ORACLES.md', async () => {
    const referenceOraclesText = await Bun.file(referenceOraclesFilePath).text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-041 | `plan_fps/manifests/15-005-gate-e1m1-start.json` | gate e1m1 start acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-e1m1-start.test.ts` |',
    );
    expect(referenceOraclesText).toContain(
      '| OR-FPS-024 | `test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json` | e1m1 start from clean launch capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-e1m1-start-from-clean-launch.test.ts` |',
    );
  });

  test('locks the parsed manifest evidenceHash against drift from its evidenceHashInput', async () => {
    const parsedManifest = (await Bun.file(manifestFilePath).json()) as ParsedManifest;

    const recomputedHash = new Bun.CryptoHasher('sha256').update(parsedManifest.evidenceHashInput).digest('hex');

    expect(parsedManifest.evidenceHash).toBe(recomputedHash);
    expect(parsedManifest.evidenceHashInput).toBe(evidenceHashInput);
    expect(parsedManifest.evidenceHash).toBe(evidenceHash);
  });

  test('locks the upstream OR-FPS-024 source oracle artifact against drift from disk', async () => {
    const sourceArtifactExists = await Bun.file(sourceOracleArtifactPath).exists();
    const parsedManifest = (await Bun.file(manifestFilePath).json()) as ParsedManifest;

    expect(sourceArtifactExists).toBe(true);
    expect(parsedManifest.oracleScope.map((entry) => entry.sourceArtifact)).toEqual([sourceOracleArtifactPath]);
  });
});
