import { describe, expect, test } from 'bun:test';

const manifestPath = 'plan_fps/manifests/15-004-gate-menu-navigation.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';

type AcceptanceScope = {
  gateChecks: string[];
  menuNavigationOracleIds: string[];
  requiredRuntimePath: string;
  windowPolicy: string;
};

type CommandContract = {
  entryFile: string;
  program: string;
  runtimeCommand: string;
  subcommand: string;
};

type DeterministicReplayCompatibility = {
  inputStreamMutation: boolean;
  randomSeedMutation: boolean;
  simulationTickMutation: boolean;
  stateMutationTiming: string;
  timing: string;
};

type GateMenuNavigationManifest = {
  acceptanceScope: AcceptanceScope;
  commandContract: CommandContract;
  deterministicReplayCompatibility: DeterministicReplayCompatibility;
  evidenceHash: string;
  nextGate: string;
  oracle: OracleRegistration;
  schemaVersion: number;
  step: StepIdentity;
  transition: Transition;
};

type OracleRegistration = {
  artifact: string;
  authority: string;
  id: string;
  refreshCommand: string;
};

type StepIdentity = {
  id: string;
  title: string;
};

type Transition = {
  from: string;
  to: string;
};

const createEvidenceHash = (manifest: GateMenuNavigationManifest): string => {
  const hashInput = {
    acceptanceScope: manifest.acceptanceScope,
    commandContract: manifest.commandContract,
    deterministicReplayCompatibility: manifest.deterministicReplayCompatibility,
    nextGate: manifest.nextGate,
    oracle: manifest.oracle,
    schemaVersion: manifest.schemaVersion,
    step: manifest.step,
    transition: manifest.transition,
  };

  return new Bun.CryptoHasher('sha256').update(JSON.stringify(hashInput)).digest('hex');
};

const readManifest = async (): Promise<GateMenuNavigationManifest> => await Bun.file(manifestPath).json();

describe('gate menu navigation acceptance manifest', () => {
  test('locks schema, step, and command contract', async () => {
    const manifest = await readManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.step).toEqual({
      id: '15-004',
      title: 'gate-menu-navigation',
    });
    expect(manifest.commandContract).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(manifest.acceptanceScope.requiredRuntimePath).toBe(manifest.commandContract.runtimeCommand);
  });

  test('locks menu navigation oracle scope and replay compatibility', async () => {
    const manifest = await readManifest();

    expect(manifest.acceptanceScope.menuNavigationOracleIds).toEqual(['OR-FPS-010', 'OR-FPS-015', 'OR-FPS-016', 'OR-FPS-017', 'OR-FPS-018', 'OR-FPS-019', 'OR-FPS-020', 'OR-FPS-021', 'OR-FPS-022', 'OR-FPS-023']);
    expect(manifest.acceptanceScope.gateChecks).toEqual([
      'clean launch reaches menu navigation through bun run doom.ts',
      'menu open and close behavior remains oracle-backed',
      'new game, episode, skill, options, sound, screen, save-load, and quit menu paths remain oracle-backed',
      'windowed presentation remains the only accepted reference-visible host difference',
    ]);
    expect(manifest.acceptanceScope.windowPolicy).toBe('windowed-only presentation difference');
    expect(manifest.deterministicReplayCompatibility).toEqual({
      inputStreamMutation: false,
      randomSeedMutation: false,
      simulationTickMutation: false,
      stateMutationTiming: 'evidence-only acceptance gate; no runtime mutation',
      timing: 'pre-game menu navigation evidence is deterministic and oracle-backed',
    });
  });

  test('locks transition, oracle registration, and evidence hash', async () => {
    const manifest = await readManifest();

    expect(manifest.transition).toEqual({
      from: '15-003 gate-title-frame',
      to: '15-004 gate-menu-navigation',
    });
    expect(manifest.nextGate).toBe('15-005 gate-e1m1-start');
    expect(manifest.oracle).toEqual({
      artifact: manifestPath,
      authority: 'gate menu navigation acceptance evidence for the Bun-run playable parity path',
      id: 'OR-FPS-040',
      refreshCommand: 'bun test test/playable/acceptance/gate-menu-navigation.test.ts',
    });
    expect(manifest.evidenceHash).toBe('32095449043a38a9eb6289e40796056b1310c23fb8ebb635498b899fdd2c123a');
    expect(createEvidenceHash(manifest)).toBe(manifest.evidenceHash);

    const referenceOracles = await Bun.file(referenceOraclesPath).text();
    expect(referenceOracles).toContain(
      '| OR-FPS-040 | `plan_fps/manifests/15-004-gate-menu-navigation.json` | gate menu navigation acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-menu-navigation.test.ts` |',
    );
  });
});
