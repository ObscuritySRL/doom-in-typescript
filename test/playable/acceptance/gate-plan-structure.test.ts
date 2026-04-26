import { describe, expect, test } from 'bun:test';

interface CommandContract {
  entryFile: string;
  program: string;
  runtimeCommand: string;
  subcommand: string;
}

interface DeterministicReplayCompatibility {
  advancesSimulationTics: boolean;
  mutatesInputStream: boolean;
  mutatesRandomSeed: boolean;
  requiresLiveClock: boolean;
}

interface ExpectedTransition {
  fromPrerequisite: string;
  nextStep: string;
  toStep: string;
}

interface GateEvidence {
  category: string;
  completionSignal: string;
  identifier: string;
  title: string;
}

interface GatePlanStructureManifest {
  commandContract: CommandContract;
  deterministicReplayCompatibility: DeterministicReplayCompatibility;
  evidenceHash: string;
  evidenceInputs: string[];
  expectedTransition: ExpectedTransition;
  gate: GateEvidence;
  oracle: OracleEvidence;
  planStructure: PlanStructureEvidence;
  schemaVersion: number;
}

interface OracleEvidence {
  artifact: string;
  authority: string;
  identifier: string;
  refreshCommand: string;
}

interface PlanStructureEvidence {
  activeControlCenter: string;
  finalGate: string;
  firstEligibleBeforeCompletion: string;
  firstStep: string;
  phase: string;
  priorArtControlCenter: string;
  runtimeTarget: string;
  totalSteps: number;
}

const focusedTestPath = 'test/playable/acceptance/gate-plan-structure.test.ts';
const manifestPath = 'plan_fps/manifests/15-001-gate-plan-structure.json';
const masterChecklistPath = 'plan_fps/MASTER_CHECKLIST.md';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';

const expectedManifest = {
  commandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    runtimeCommand: 'bun run doom.ts',
    subcommand: 'run',
  },
  deterministicReplayCompatibility: {
    advancesSimulationTics: false,
    mutatesInputStream: false,
    mutatesRandomSeed: false,
    requiresLiveClock: false,
  },
  evidenceHash: '4b0fa6dbf32a15fa82e3c434e9c2abce85f6f4ca29b356a87ade6797715c7b9f',
  evidenceInputs: ['plan_fps/FACT_LOG.md', 'plan_fps/MASTER_CHECKLIST.md', 'plan_fps/REFERENCE_ORACLES.md', manifestPath, focusedTestPath],
  expectedTransition: {
    fromPrerequisite: '14-007 smoke-test-clean-local-working-tree',
    nextStep: '15-002 gate-bun-launch-smoke',
    toStep: '15-001 gate-plan-structure',
  },
  gate: {
    category: 'acceptance',
    completionSignal: 'plan structure accepted for playable parity gates',
    identifier: '15-001',
    title: 'gate-plan-structure',
  },
  oracle: {
    artifact: manifestPath,
    authority: 'gate plan structure acceptance evidence for the Bun-run playable parity path',
    identifier: 'OR-FPS-037',
    refreshCommand: `bun test ${focusedTestPath}`,
  },
  planStructure: {
    activeControlCenter: 'plan_fps/',
    finalGate: '15-010 gate-final-side-by-side',
    firstEligibleBeforeCompletion: '15-001 gate-plan-structure',
    firstStep: '00-001 classify-existing-plan',
    phase: '15 Acceptance Gates',
    priorArtControlCenter: 'plan_engine/',
    runtimeTarget: 'bun run doom.ts',
    totalSteps: 223,
  },
  schemaVersion: 1,
} satisfies GatePlanStructureManifest;

const computeJsonSha256Hash = (value: unknown): string => new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');

const loadManifest = async (): Promise<GatePlanStructureManifest> => await Bun.file(manifestPath).json();

describe('gate plan structure acceptance', () => {
  test('locks the acceptance gate manifest schema', async () => {
    const manifest = await loadManifest();

    expect(manifest).toEqual(expectedManifest);
  });

  test('records deterministic gate evidence without replay mutation', async () => {
    const manifest = await loadManifest();
    const hashEvidence = {
      commandContract: manifest.commandContract,
      deterministicReplayCompatibility: manifest.deterministicReplayCompatibility,
      expectedTransition: manifest.expectedTransition,
      gate: manifest.gate,
      oracle: manifest.oracle,
      planStructure: manifest.planStructure,
      schemaVersion: manifest.schemaVersion,
    };

    expect(manifest.deterministicReplayCompatibility).toEqual({
      advancesSimulationTics: false,
      mutatesInputStream: false,
      mutatesRandomSeed: false,
      requiresLiveClock: false,
    });
    expect(computeJsonSha256Hash(hashEvidence)).toBe(manifest.evidenceHash);
  });

  test('keeps the gate wired to the Bun command contract and checklist transition', async () => {
    const checklist = await Bun.file(masterChecklistPath).text();
    const manifest = await loadManifest();

    expect(manifest.commandContract).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(checklist).toContain('- [x] `14-007` `smoke-test-clean-local-working-tree` | prereqs: `14-006` | file: `plan_fps/steps/14-007-smoke-test-clean-local-working-tree.md`');
    expect(checklist).toMatch(/^- \[[ x]\] `15-001` `gate-plan-structure` \| prereqs: `14-007` \| file: `plan_fps\/steps\/15-001-gate-plan-structure\.md`$/m);
    expect(checklist).toMatch(/^- \[[ x]\] `15-002` `gate-bun-launch-smoke` \| prereqs: `15-001` \| file: `plan_fps\/steps\/15-002-gate-bun-launch-smoke\.md`$/m);
  });

  test('registers the gate manifest as a refreshable oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-037 | `plan_fps/manifests/15-001-gate-plan-structure.json` | gate plan structure acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-plan-structure.test.ts` |',
    );
  });
});
