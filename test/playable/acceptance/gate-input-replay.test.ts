import { describe, expect, test } from 'bun:test';

interface GateInputReplayManifest {
  acceptanceGate: {
    currentStepId: string;
    currentStepTitle: string;
    description: string;
    previousStepId: string;
    previousStepTitle: string;
  };
  commandContract: {
    entryFile: string;
    program: string;
    runtimeCommand: string;
    subcommand: string;
  };
  deterministicReplayCompatibility: {
    doesNotAdvanceSimulationTicDuringGateEvaluation: boolean;
    doesNotMutateInputStream: boolean;
    doesNotMutateRandomSeed: boolean;
    replayInputTraceRemainsAuthoritative: boolean;
    stateHashComparisonRemainsDeterministic: boolean;
  };
  evidenceHash: string;
  inputReplayOracleScope: Array<{
    artifact: string;
    id: string;
    path: string;
  }>;
  oracleId: string;
  rationale: string[];
  schemaVersion: number;
  transition: {
    currentStepId: string;
    nextStepId: string;
    previousStepId: string;
  };
  windowedOnlyDifference: {
    affectsDeterministicReplay: boolean;
    allowedDifference: string;
  };
}

const manifestPath = 'plan_fps/manifests/15-006-gate-input-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';

async function readManifest(): Promise<GateInputReplayManifest> {
  return (await Bun.file(manifestPath).json()) as GateInputReplayManifest;
}

describe('gate input replay acceptance evidence', () => {
  test('locks the manifest schema, command contract, and transition', async () => {
    const manifest = await readManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.acceptanceGate).toEqual({
      currentStepId: '15-006',
      currentStepTitle: 'gate-input-replay',
      description: 'Gate input replay acceptance evidence for the Bun-run playable parity path.',
      previousStepId: '15-005',
      previousStepTitle: 'gate-e1m1-start',
    });
    expect(manifest.commandContract).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(manifest.transition).toEqual({
      currentStepId: '15-006',
      nextStepId: '15-007',
      previousStepId: '15-005',
    });
  });

  test('locks scripted input replay oracle scope', async () => {
    const manifest = await readManifest();

    expect(manifest.inputReplayOracleScope).toEqual([
      {
        artifact: 'test/oracles/fixtures/capture-scripted-movement-path.json',
        id: 'OR-FPS-025',
        path: 'scripted-movement-path',
      },
      {
        artifact: 'test/oracles/fixtures/capture-scripted-combat-path.json',
        id: 'OR-FPS-026',
        path: 'scripted-combat-path',
      },
      {
        artifact: 'test/oracles/fixtures/capture-scripted-pickup-path.json',
        id: 'OR-FPS-027',
        path: 'scripted-pickup-path',
      },
      {
        artifact: 'test/oracles/fixtures/capture-scripted-door-use-path.json',
        id: 'OR-FPS-028',
        path: 'scripted-door-use-path',
      },
      {
        artifact: 'test/oracles/fixtures/capture-scripted-damage-death-path.json',
        id: 'OR-FPS-029',
        path: 'scripted-damage-death-path',
      },
      {
        artifact: 'test/oracles/fixtures/capture-scripted-intermission-path.json',
        id: 'OR-FPS-030',
        path: 'scripted-intermission-path',
      },
    ]);
  });

  test('locks replay compatibility and evidence hash', async () => {
    const manifest = await readManifest();

    expect(manifest.deterministicReplayCompatibility).toEqual({
      doesNotAdvanceSimulationTicDuringGateEvaluation: true,
      doesNotMutateInputStream: true,
      doesNotMutateRandomSeed: true,
      replayInputTraceRemainsAuthoritative: true,
      stateHashComparisonRemainsDeterministic: true,
    });
    expect(manifest.windowedOnlyDifference).toEqual({
      affectsDeterministicReplay: false,
      allowedDifference: 'fullscreen-vs-windowed-presentation',
    });
    expect(manifest.evidenceHash).toBe('567c6fb22a3dc29b9d6c49dd327f08a03467525c975bfb60eab03f17667f0b36');
  });

  test('registers the acceptance gate oracle', async () => {
    const manifest = await readManifest();
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(manifest.oracleId).toBe('OR-FPS-042');
    expect(referenceOracles).toContain(
      '| OR-FPS-042 | `plan_fps/manifests/15-006-gate-input-replay.json` | gate input replay acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-input-replay.test.ts` |',
    );
  });
});
