import { describe, expect, test } from 'bun:test';

type AcceptanceGate = {
  commandContract: CommandContract;
  deterministicReplayCompatibility: DeterministicReplayCompatibility;
  evidenceHash: string;
  gateId: string;
  gateTitle: string;
  oracleId: string;
  scope: string[];
  titleFrameEvidence: TitleFrameEvidence;
  transition: Transition;
};

type CommandContract = {
  entryFile: string;
  program: string;
  runtimeCommand: string;
  subcommand: string;
};

type DeterministicReplayCompatibility = {
  advancesSimulationTics: boolean;
  mutatesInputStream: boolean;
  mutatesRandomSeed: boolean;
  requiresLiveAudio: boolean;
  requiresWallClockTiming: boolean;
};

type GateTitleFrameManifest = {
  acceptanceGate: AcceptanceGate;
  schemaVersion: number;
};

type TitleFrameEvidence = {
  capturedOracleArtifact: string;
  capturedOracleId: string;
  expectedFrameRole: string;
  expectedPresentationMode: string;
  expectedRenderSurface: string;
  sideBySideAcceptance: string;
  windowedOnlyDifference: boolean;
};

type Transition = {
  fromStepId: string;
  fromStepTitle: string;
  nextStepId: string;
  nextStepTitle: string;
  toStepId: string;
  toStepTitle: string;
};

const checklistPath = 'plan_fps/MASTER_CHECKLIST.md';
const manifestPath = 'plan_fps/manifests/15-003-gate-title-frame.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';

const checklistText = await Bun.file(checklistPath).text();
const manifest: GateTitleFrameManifest = await Bun.file(manifestPath).json();
const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

describe('gate title frame acceptance manifest', () => {
  test('locks manifest schema, command contract, and title frame evidence', () => {
    expect(manifest).toEqual({
      acceptanceGate: {
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
          requiresLiveAudio: false,
          requiresWallClockTiming: false,
        },
        evidenceHash: 'a1addd77ec2defd07f7542f6c4e93bc6dd1aaba8a6176578a62bc26759949ea6',
        gateId: '15-003',
        gateTitle: 'gate-title-frame',
        oracleId: 'OR-FPS-039',
        scope: [
          'verify the first visible title-loop frame in the Bun runtime path',
          'tie the acceptance gate to the captured initial title-frame oracle',
          'preserve deterministic replay by recording evidence without consuming input or advancing simulation',
        ],
        titleFrameEvidence: {
          capturedOracleArtifact: 'test/oracles/fixtures/capture-initial-title-frame.json',
          capturedOracleId: 'OR-FPS-009',
          expectedFrameRole: 'initial-title-frame',
          expectedPresentationMode: 'windowed',
          expectedRenderSurface: '320x200-indexed-framebuffer',
          sideBySideAcceptance: 'implementation title frame matches the captured reference title frame except for fullscreen-vs-windowed presentation',
          windowedOnlyDifference: true,
        },
        transition: {
          fromStepId: '15-002',
          fromStepTitle: 'gate-bun-launch-smoke',
          nextStepId: '15-004',
          nextStepTitle: 'gate-menu-navigation',
          toStepId: '15-003',
          toStepTitle: 'gate-title-frame',
        },
      },
      schemaVersion: 1,
    });
  });

  test('locks deterministic evidence hash', () => {
    const hashPayload = {
      commandContract: manifest.acceptanceGate.commandContract,
      deterministicReplayCompatibility: manifest.acceptanceGate.deterministicReplayCompatibility,
      gateId: manifest.acceptanceGate.gateId,
      gateTitle: manifest.acceptanceGate.gateTitle,
      oracleId: manifest.acceptanceGate.oracleId,
      scope: manifest.acceptanceGate.scope,
      titleFrameEvidence: manifest.acceptanceGate.titleFrameEvidence,
      transition: manifest.acceptanceGate.transition,
    } satisfies Omit<AcceptanceGate, 'evidenceHash'>;

    const cryptoHasher = new Bun.CryptoHasher('sha256');
    cryptoHasher.update(JSON.stringify(hashPayload));

    expect(manifest.acceptanceGate.evidenceHash).toBe('a1addd77ec2defd07f7542f6c4e93bc6dd1aaba8a6176578a62bc26759949ea6');
    expect(cryptoHasher.digest('hex')).toBe(manifest.acceptanceGate.evidenceHash);
  });

  test('locks checklist transition and oracle registration', () => {
    expect(checklistText).toContain('- [x] `15-002` `gate-bun-launch-smoke` | prereqs: `15-001` | file: `plan_fps/steps/15-002-gate-bun-launch-smoke.md`');
    expect(checklistText).toMatch(/- \[[ x]\] `15-003` `gate-title-frame` \| prereqs: `15-002` \| file: `plan_fps\/steps\/15-003-gate-title-frame\.md`/);
    expect(referenceOraclesText).toContain(
      '| OR-FPS-039 | `plan_fps/manifests/15-003-gate-title-frame.json` | gate title frame acceptance evidence for the Bun-run playable parity path | `bun test test/playable/acceptance/gate-title-frame.test.ts` |',
    );
  });
});
