import { describe, expect, test } from 'bun:test';

const commandContract = {
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
};

const deterministicReplayCompatibility = {
  inputStreamMutation: false,
  randomSeedMutation: false,
  simulationTickAdvanced: false,
};

const launchSmoke = {
  defaultIwadPath: 'doom/DOOM1.WAD',
  expectedStartupPhase: 'title-loop',
  firstSimulationTic: 0,
  smokeCommand: 'bun run doom.ts',
  smokeScope: ['Bun runtime invocation', 'default IWAD discovery', 'root doom.ts command', 'title-loop entry'],
  validatedRuntimePath: 'Bun',
};

const transition = {
  fromStep: '15-001',
  fromStepTitle: 'gate-plan-structure',
  toStep: '15-002',
  toStepTitle: 'gate-bun-launch-smoke',
};

const gateEvidence = {
  commandContract,
  deterministicReplayCompatibility,
  gateIdentifier: '15-002',
  gateTitle: 'gate-bun-launch-smoke',
  launchSmoke,
  oracleIdentifier: 'OR-FPS-038',
  transition,
};

const evidenceHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(gateEvidence)).digest('hex');

const expectedManifest = {
  evidencePaths: ['plan_fps/MASTER_CHECKLIST.md', 'plan_fps/REFERENCE_ORACLES.md', 'plan_fps/manifests/15-002-gate-bun-launch-smoke.json', 'test/playable/acceptance/gate-bun-launch-smoke.test.ts'],
  gate: {
    ...gateEvidence,
    evidenceHash,
  },
  schemaVersion: 1,
};

describe('gate-bun-launch-smoke acceptance manifest', () => {
  test('locks the manifest schema, command contract, transition, and replay compatibility', async () => {
    const manifestData: unknown = await Bun.file('plan_fps/manifests/15-002-gate-bun-launch-smoke.json').json();

    expect(manifestData).toEqual(expectedManifest);
    expect(evidenceHash).toBe('2ab211f64f41a3f34eb2a277924f26ce6650a622b4c2effcd0aab67a62df372f');
  });

  test('registers the gate evidence as a reference oracle', async () => {
    const referenceOraclesText = await Bun.file('plan_fps/REFERENCE_ORACLES.md').text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-038 | `plan_fps/manifests/15-002-gate-bun-launch-smoke.json` | gate bun launch smoke acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-bun-launch-smoke.test.ts` |',
    );
  });
});
