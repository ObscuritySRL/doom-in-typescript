import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

interface AudioOracleScopeEntry {
  artifact: string;
  authority: string;
  id: string;
  requirement: string;
}

interface CommandContract {
  entryFile: string;
  program: string;
  runtimeCommand: string;
  subcommand: string;
}

interface DeterministicReplayCompatibility {
  audioHostTimingExcludedFromSimulation: boolean;
  audioMixerStateHashLocked: boolean;
  inputStreamMutation: boolean;
  randomSeedMutation: boolean;
  simulationTicMutation: boolean;
}

interface GateTransition {
  fromChecklistStatus: string;
  fromStepId: string;
  toChecklistStatus: string;
  toStepId: string;
}

interface ManifestGate {
  audioOracleScope: AudioOracleScopeEntry[];
  commandContract: CommandContract;
  deterministicReplayCompatibility: DeterministicReplayCompatibility;
  evidenceHash: string;
  nextGate: StepReference;
  oracleId: string;
  previousGate: StepReference;
  requiredRuntimePath: string;
  status: string;
  transition: GateTransition;
}

interface StepReference {
  id: string;
  title: string;
}

interface GateAudioManifest {
  acceptanceGate: ManifestGate;
  artifact: string;
  schemaVersion: number;
  stepId: string;
  stepTitle: string;
}

const expectedAudioOracleScope: AudioOracleScopeEntry[] = [
  {
    artifact: 'test/oracles/fixtures/capture-sound-volume-menu-path.json',
    authority: 'captured local DOS binary derived oracle',
    id: 'OR-FPS-020',
    requirement: 'sound-volume menu route remains tied to the playable audio path',
  },
  {
    artifact: 'test/oracles/fixtures/capture-sfx-hash-windows.json',
    authority: 'captured local DOS binary derived oracle',
    id: 'OR-FPS-032',
    requirement: 'sound effect hash windows remain accepted for the Bun-run playable path',
  },
  {
    artifact: 'test/oracles/fixtures/capture-music-event-hash-windows.json',
    authority: 'captured local DOS binary derived oracle',
    id: 'OR-FPS-033',
    requirement: 'music event hash windows remain accepted for the Bun-run playable path',
  },
];

const expectedCommandContract: CommandContract = {
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
};

const expectedDeterministicReplayCompatibility: DeterministicReplayCompatibility = {
  audioHostTimingExcludedFromSimulation: true,
  audioMixerStateHashLocked: true,
  inputStreamMutation: false,
  randomSeedMutation: false,
  simulationTicMutation: false,
};

const manifestPath = 'plan_fps/manifests/15-007-gate-audio.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';

const loadManifest = async (): Promise<GateAudioManifest> => {
  const manifest: GateAudioManifest = await Bun.file(manifestPath).json();
  return manifest;
};

const hashGateEvidence = (manifest: GateAudioManifest): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        audioOracleScope: manifest.acceptanceGate.audioOracleScope,
        commandContract: manifest.acceptanceGate.commandContract,
        deterministicReplayCompatibility: manifest.acceptanceGate.deterministicReplayCompatibility,
        nextGate: manifest.acceptanceGate.nextGate,
        oracleId: manifest.acceptanceGate.oracleId,
        previousGate: manifest.acceptanceGate.previousGate,
        requiredRuntimePath: manifest.acceptanceGate.requiredRuntimePath,
        status: manifest.acceptanceGate.status,
        transition: manifest.acceptanceGate.transition,
      }),
    )
    .digest('hex');

describe('gate-audio acceptance manifest', () => {
  test('locks the schema, command contract, and audio oracle scope', async () => {
    const manifest = await loadManifest();

    expect(manifest).toMatchObject({
      artifact: manifestPath,
      schemaVersion: 1,
      stepId: '15-007',
      stepTitle: 'gate-audio',
    });
    expect(manifest.acceptanceGate.commandContract).toEqual(expectedCommandContract);
    expect(manifest.acceptanceGate.audioOracleScope).toEqual(expectedAudioOracleScope);
    expect(manifest.acceptanceGate.audioOracleScope.map((audioOracleScopeEntry) => audioOracleScopeEntry.id)).toEqual(['OR-FPS-020', 'OR-FPS-032', 'OR-FPS-033']);
  });

  test('locks transition and deterministic replay compatibility', async () => {
    const manifest = await loadManifest();

    expect(manifest.acceptanceGate.previousGate).toEqual({
      id: '15-006',
      title: 'gate-input-replay',
    });
    expect(manifest.acceptanceGate.nextGate).toEqual({
      id: '15-008',
      title: 'gate-save-load',
    });
    expect(manifest.acceptanceGate.transition).toEqual({
      fromChecklistStatus: 'completed',
      fromStepId: '15-006',
      toChecklistStatus: 'checked-after-verification',
      toStepId: '15-007',
    });
    expect(manifest.acceptanceGate.deterministicReplayCompatibility).toEqual(expectedDeterministicReplayCompatibility);
  });

  test('registers gate evidence as a reference oracle', async () => {
    const manifest = await loadManifest();
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(manifest.acceptanceGate.oracleId).toBe('OR-FPS-043');
    expect(referenceOracles).toContain('| OR-FPS-043 | `plan_fps/manifests/15-007-gate-audio.json` | gate audio acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-audio.test.ts` |');
  });

  test('locks the gate evidence hash', async () => {
    const manifest = await loadManifest();

    expect(hashGateEvidence(manifest)).toBe('b0d8fab49682671fcbb03ec765516cfb913ac6efa3ac365162b56122db308e0b');
    expect(manifest.acceptanceGate.evidenceHash).toBe('b0d8fab49682671fcbb03ec765516cfb913ac6efa3ac365162b56122db308e0b');
    expect(manifest.acceptanceGate.evidenceHash).toBe(hashGateEvidence(manifest));
  });
});
