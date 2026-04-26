import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const CONTROL_CENTER_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const DEFINE_ORACLE_CAPTURE_POLICY_PATH = 'plan_vanilla_parity/define-oracle-capture-policy.md';
const DEFINE_READ_ONLY_REFERENCE_ROOTS_PATH = 'plan_vanilla_parity/define-read-only-reference-roots.md';
const DEFINE_SOURCE_AUTHORITY_ORDER_PATH = 'plan_vanilla_parity/define-source-authority-order.md';
const DEFINE_STEP_FILE_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-final-acceptance-standard.md';
const PIN_PROPRIETARY_ASSET_PATH = 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md';
const PIN_USER_SUPPLIED_IWAD_PATH = 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const POLICY_MODULE_PATH = 'src/reference/policy.ts';
const REFERENCE_ORACLES_PATH = 'plan_vanilla_parity/REFERENCE_ORACLES.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-014-define-final-acceptance-standard.md';
const STEP_13_001_PATH = 'plan_vanilla_parity/steps/13-001-gate-shareware-doom-one-full-playthrough.md';
const STEP_13_002_PATH = 'plan_vanilla_parity/steps/13-002-gate-registered-doom-user-supplied-iwad-scope.md';
const STEP_13_003_PATH = 'plan_vanilla_parity/steps/13-003-gate-ultimate-doom-user-supplied-iwad-scope.md';
const STEP_13_004_PATH = 'plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_ACCEPTANCE_LANE = 'acceptance';
const CANONICAL_ACCEPTANCE_GATE_PHASE = '13';
const CANONICAL_ACCEPTANCE_GATE_PHASE_TITLE = 'Final Proof / Handoff';
const CANONICAL_ACCEPTANCE_GATE_COUNT = 4;
const CANONICAL_ACCEPTANCE_GATE_IDS: readonly string[] = ['13-001', '13-002', '13-003', '13-004'];
const CANONICAL_ACCEPTANCE_GATE_SLUGS: readonly string[] = ['gate-shareware-doom-one-full-playthrough', 'gate-registered-doom-user-supplied-iwad-scope', 'gate-ultimate-doom-user-supplied-iwad-scope', 'gate-full-final-side-by-side-proof'];
const CANONICAL_FINAL_SIDE_BY_SIDE_GATE_ID = '13-004';
const CANONICAL_FINAL_SIDE_BY_SIDE_GATE_SLUG = 'gate-full-final-side-by-side-proof';
const CANONICAL_FINAL_SIDE_BY_SIDE_GATE_FILE_PATH = 'plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md';

const CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOTS: readonly string[] = ['plan_vanilla_parity/final-gates/', 'src/oracles/', 'test/parity/', 'test/vanilla_parity/acceptance/'];
const CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOT_COUNT = 4;

const CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS: readonly string[] = ['02-035', '03-036', '04-030', '05-028', '06-032', '07-034', '08-032', '09-038', '10-028', '11-031', '12-028'];
const CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_COUNT = 11;
const CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_SLUGS: ReadonlyMap<string, string> = new Map([
  ['02-035', 'gate-oracle-foundation-without-deferred-status'],
  ['03-036', 'gate-clean-launch-host-and-input'],
  ['04-030', 'gate-demo-sync-primitives'],
  ['05-028', 'gate-user-supplied-doom-wad-detection'],
  ['06-032', 'gate-world-movement-against-oracle'],
  ['07-034', 'gate-player-oracle-replay'],
  ['08-032', 'gate-boss-and-episode-exit-semantics'],
  ['09-038', 'gate-status-bar-and-automap-parity'],
  ['10-028', 'gate-intermission-and-finale-parity'],
  ['11-031', 'gate-music-opl-parity'],
  ['12-028', 'gate-save-load-byte-parity'],
]);

const CANONICAL_RUNTIME_TARGET = 'bun run doom.ts';

const CANONICAL_COMPARISON_SURFACES: readonly string[] = ['deterministic state', 'framebuffer', 'audio', 'music events', 'menu transitions', 'level transitions', 'save/load bytes', 'demo playback', 'full-playthrough completion'];
const CANONICAL_COMPARISON_SURFACE_COUNT = 9;

const CANONICAL_REQUIRED_FINAL_GATE_PHRASES: readonly string[] = [
  'bun run doom.ts',
  'same deterministic input stream',
  'deterministic state',
  'framebuffer',
  'audio',
  'music events',
  'menu transitions',
  'level transitions',
  'save/load bytes',
  'demo playback',
  'full-playthrough completion',
  'zero default differences',
];
const CANONICAL_REQUIRED_FINAL_GATE_PHRASE_COUNT = 12;

const CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERNS: readonly string[] = ['pending', 'manifest-only', 'sampled-only', 'intent-only', 'declared intent'];
const CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERN_COUNT = 5;

const CANONICAL_MERGE_CHECKPOINT_IDENTIFIER = 'G6';
const CANONICAL_MERGE_CHECKPOINT_TITLE = 'full final side-by-side proof';
const CANONICAL_MERGE_CHECKPOINT_LINE = 'Merge checkpoints: G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof.';

const CANONICAL_OR_VP_012_MINIMUM_EVIDENCE = 'Clean-launch paired run using the same input stream and zero default allowed differences.';

const CANONICAL_INTERMEDIATE_VS_FINAL_SENTENCE =
  'Intermediate gates may use sampled hashes. Final gates must run the implementation and reference from clean launch with the same deterministic input stream and compare deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion.';

interface FinalAcceptanceStandardDocument {
  readonly acceptanceGateCount: string;
  readonly acceptanceGateIds: readonly string[];
  readonly acceptanceGatePhase: string;
  readonly acceptanceGatePhaseTitle: string;
  readonly acceptanceGateSlugs: readonly string[];
  readonly acceptanceLaneIdentifier: string;
  readonly acceptanceLaneOwnedWritableRootCount: string;
  readonly acceptanceLaneOwnedWritableRoots: readonly string[];
  readonly acceptancePhrasing: string;
  readonly acceptancePrerequisiteGateCount: string;
  readonly acceptancePrerequisiteGateIds: readonly string[];
  readonly acceptancePrerequisiteGateSlugs: readonly string[];
  readonly cleanLaunchRule: string;
  readonly comparisonSurfaceCount: string;
  readonly comparisonSurfaces: readonly string[];
  readonly deterministicInputStreamRule: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly finalSideBySideGateFilePath: string;
  readonly finalSideBySideGateId: string;
  readonly finalSideBySideGateSlug: string;
  readonly gate13_001: string;
  readonly gate13_002: string;
  readonly gate13_003: string;
  readonly gate13_004: string;
  readonly localReferenceRule: string;
  readonly mergeCheckpointAnchor: string;
  readonly mergeCheckpointIdentifier: string;
  readonly mergeCheckpointTitle: string;
  readonly noProprietaryBytesRule: string;
  readonly oracleVp012FamilyAnchor: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly rejectedFinalEvidencePatternCount: string;
  readonly rejectedFinalEvidencePatternEnforcement: string;
  readonly rejectedFinalEvidencePatterns: readonly string[];
  readonly requiredFinalGatePhraseCount: string;
  readonly requiredFinalGatePhraseEnforcement: string;
  readonly requiredFinalGatePhrases: readonly string[];
  readonly runtimeTarget: string;
  readonly sampledHashesIntermediateRule: string;
  readonly scopeName: string;
  readonly zeroDefaultDifferencesRule: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in final acceptance standard document.`);
  }
  const bodyStart = sectionStart + heading.length + 2;
  const remainder = documentText.slice(bodyStart);
  const nextHeadingOffset = remainder.search(/\n## /);
  return (nextHeadingOffset === -1 ? remainder : remainder.slice(0, nextHeadingOffset)).trim();
}

function extractBullets(documentText: string, sectionHeading: string): readonly string[] {
  return extractSection(documentText, sectionHeading)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^`|`$/g, ''));
}

function parseFinalAcceptanceStandardDocument(documentText: string): FinalAcceptanceStandardDocument {
  const acceptanceGateIds = extractBullets(documentText, 'acceptance gate ids');
  if (acceptanceGateIds.length === 0) {
    throw new Error('acceptance gate ids must list at least one id.');
  }

  const acceptanceGateSlugs = extractBullets(documentText, 'acceptance gate slugs');
  if (acceptanceGateSlugs.length === 0) {
    throw new Error('acceptance gate slugs must list at least one slug.');
  }

  const acceptanceLaneOwnedWritableRoots = extractBullets(documentText, 'acceptance lane owned writable roots');
  if (acceptanceLaneOwnedWritableRoots.length === 0) {
    throw new Error('acceptance lane owned writable roots must list at least one root.');
  }

  const acceptancePrerequisiteGateIds = extractBullets(documentText, 'acceptance prerequisite gate ids');
  if (acceptancePrerequisiteGateIds.length === 0) {
    throw new Error('acceptance prerequisite gate ids must list at least one id.');
  }

  const acceptancePrerequisiteGateSlugs = extractBullets(documentText, 'acceptance prerequisite gate slugs');
  if (acceptancePrerequisiteGateSlugs.length === 0) {
    throw new Error('acceptance prerequisite gate slugs must list at least one slug.');
  }

  const comparisonSurfaces = extractBullets(documentText, 'comparison surfaces');
  if (comparisonSurfaces.length === 0) {
    throw new Error('comparison surfaces must list at least one surface.');
  }

  const requiredFinalGatePhrases = extractBullets(documentText, 'required final gate phrases');
  if (requiredFinalGatePhrases.length === 0) {
    throw new Error('required final gate phrases must list at least one phrase.');
  }

  const rejectedFinalEvidencePatterns = extractBullets(documentText, 'rejected final evidence patterns');
  if (rejectedFinalEvidencePatterns.length === 0) {
    throw new Error('rejected final evidence patterns must list at least one pattern.');
  }

  const evidenceLocations = extractBullets(documentText, 'evidence locations');
  if (evidenceLocations.length === 0) {
    throw new Error('evidence locations must list at least one location.');
  }

  return {
    acceptanceGateCount: extractSection(documentText, 'acceptance gate count'),
    acceptanceGateIds,
    acceptanceGatePhase: extractSection(documentText, 'acceptance gate phase'),
    acceptanceGatePhaseTitle: extractSection(documentText, 'acceptance gate phase title'),
    acceptanceGateSlugs,
    acceptanceLaneIdentifier: extractSection(documentText, 'acceptance lane identifier'),
    acceptanceLaneOwnedWritableRootCount: extractSection(documentText, 'acceptance lane owned writable root count'),
    acceptanceLaneOwnedWritableRoots,
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    acceptancePrerequisiteGateCount: extractSection(documentText, 'acceptance prerequisite gate count'),
    acceptancePrerequisiteGateIds,
    acceptancePrerequisiteGateSlugs,
    cleanLaunchRule: extractSection(documentText, 'clean launch rule'),
    comparisonSurfaceCount: extractSection(documentText, 'comparison surface count'),
    comparisonSurfaces,
    deterministicInputStreamRule: extractSection(documentText, 'deterministic input stream rule'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations,
    finalSideBySideGateFilePath: extractSection(documentText, 'final side-by-side gate file path'),
    finalSideBySideGateId: extractSection(documentText, 'final side-by-side gate id'),
    finalSideBySideGateSlug: extractSection(documentText, 'final side-by-side gate slug'),
    gate13_001: extractSection(documentText, '13-001 acceptance gate'),
    gate13_002: extractSection(documentText, '13-002 acceptance gate'),
    gate13_003: extractSection(documentText, '13-003 acceptance gate'),
    gate13_004: extractSection(documentText, '13-004 acceptance gate'),
    localReferenceRule: extractSection(documentText, 'local reference rule'),
    mergeCheckpointAnchor: extractSection(documentText, 'merge checkpoint anchor'),
    mergeCheckpointIdentifier: extractSection(documentText, 'merge checkpoint identifier'),
    mergeCheckpointTitle: extractSection(documentText, 'merge checkpoint title'),
    noProprietaryBytesRule: extractSection(documentText, 'no proprietary bytes rule'),
    oracleVp012FamilyAnchor: extractSection(documentText, 'OR-VP-012 family anchor'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    rejectedFinalEvidencePatternCount: extractSection(documentText, 'rejected final evidence pattern count'),
    rejectedFinalEvidencePatternEnforcement: extractSection(documentText, 'rejected final evidence pattern enforcement'),
    rejectedFinalEvidencePatterns,
    requiredFinalGatePhraseCount: extractSection(documentText, 'required final gate phrase count'),
    requiredFinalGatePhraseEnforcement: extractSection(documentText, 'required final gate phrase enforcement'),
    requiredFinalGatePhrases,
    runtimeTarget: extractSection(documentText, 'runtime target'),
    sampledHashesIntermediateRule: extractSection(documentText, 'sampled hashes intermediate rule'),
    scopeName: extractSection(documentText, 'scope name'),
    zeroDefaultDifferencesRule: extractSection(documentText, 'zero default differences rule'),
  };
}

async function loadFinalAcceptanceStandardDocument(): Promise<FinalAcceptanceStandardDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parseFinalAcceptanceStandardDocument(documentText);
}

describe('define final acceptance standard declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 final acceptance standard');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('acceptance lane identifier pins the canonical acceptance lane slug', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptanceLaneIdentifier).toBe(CANONICAL_ACCEPTANCE_LANE);
  });

  test('acceptance gate phase pins the canonical Phase 13 identifier and the canonical phase title', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptanceGatePhase).toBe(CANONICAL_ACCEPTANCE_GATE_PHASE);
    expect(parsed.acceptanceGatePhaseTitle).toBe(CANONICAL_ACCEPTANCE_GATE_PHASE_TITLE);
  });

  test('acceptance gate ids equal the canonical four entries in canonical order with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptanceGateIds).toEqual(CANONICAL_ACCEPTANCE_GATE_IDS);
    expect(parsed.acceptanceGateIds).toHaveLength(CANONICAL_ACCEPTANCE_GATE_COUNT);
    expect(new Set(parsed.acceptanceGateIds).size).toBe(parsed.acceptanceGateIds.length);
    expect(parsed.acceptanceGateCount).toBe(String(CANONICAL_ACCEPTANCE_GATE_COUNT));
  });

  test('acceptance gate slugs equal the canonical four entries in canonical step-id order with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptanceGateSlugs).toEqual(CANONICAL_ACCEPTANCE_GATE_SLUGS);
    expect(parsed.acceptanceGateSlugs).toHaveLength(CANONICAL_ACCEPTANCE_GATE_COUNT);
    expect(new Set(parsed.acceptanceGateSlugs).size).toBe(parsed.acceptanceGateSlugs.length);
  });

  test('every per-gate contract section names its own gate id and slug, the writable artifact path, and the focused test path', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    const gateSectionsByGateId: ReadonlyMap<string, string> = new Map([
      ['13-001', parsed.gate13_001],
      ['13-002', parsed.gate13_002],
      ['13-003', parsed.gate13_003],
      ['13-004', parsed.gate13_004],
    ]);

    for (const [gateId, gateSectionBody] of gateSectionsByGateId) {
      expect(gateSectionBody.length).toBeGreaterThan(0);
      expect(gateSectionBody).toContain(`\`${gateId}\``);
      const gateIndex = CANONICAL_ACCEPTANCE_GATE_IDS.indexOf(gateId);
      expect(gateIndex).toBeGreaterThanOrEqual(0);
      const gateSlug = CANONICAL_ACCEPTANCE_GATE_SLUGS[gateIndex];
      expect(gateSlug).toBeDefined();
      if (gateSlug !== undefined) {
        expect(gateSectionBody).toContain(gateSlug);
        expect(gateSectionBody).toContain(`test/vanilla_parity/acceptance/${gateSlug}.json`);
        expect(gateSectionBody).toContain(`test/vanilla_parity/acceptance/${gateSlug}.test.ts`);
      }
      expect(gateSectionBody).toContain('test/vanilla_parity/acceptance/');
    }
  });

  test('per-gate contract section headings appear in canonical step-id order in the document', async () => {
    const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const headingsInDocumentOrder: readonly string[] = [...documentText.matchAll(/^## (?<heading>.+)$/gm)].map((match) => match.groups!.heading);
    const gateHeadingsInDocumentOrder: readonly string[] = headingsInDocumentOrder.filter((heading) => /^13-\d{3} acceptance gate$/.test(heading));
    const expectedGateHeadings: readonly string[] = CANONICAL_ACCEPTANCE_GATE_IDS.map((gateId) => `${gateId} acceptance gate`);
    expect(gateHeadingsInDocumentOrder).toEqual(expectedGateHeadings);
  });

  test('final side-by-side gate id, slug, and file path pin the canonical 13-004 anchor used by validate-plan.ts', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.finalSideBySideGateId).toBe(CANONICAL_FINAL_SIDE_BY_SIDE_GATE_ID);
    expect(parsed.finalSideBySideGateSlug).toBe(CANONICAL_FINAL_SIDE_BY_SIDE_GATE_SLUG);
    expect(parsed.finalSideBySideGateFilePath).toBe(CANONICAL_FINAL_SIDE_BY_SIDE_GATE_FILE_PATH);
  });

  test('acceptance lane owned writable roots equal the canonical four entries ASCIIbetically sorted with no duplicates and disjoint from the read-only reference roots', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptanceLaneOwnedWritableRoots).toEqual(CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOTS);
    expect(parsed.acceptanceLaneOwnedWritableRoots).toHaveLength(CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOT_COUNT);
    expect(new Set(parsed.acceptanceLaneOwnedWritableRoots).size).toBe(parsed.acceptanceLaneOwnedWritableRoots.length);
    expect(parsed.acceptanceLaneOwnedWritableRootCount).toBe(String(CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOT_COUNT));
    const ascendingSortedRoots = [...parsed.acceptanceLaneOwnedWritableRoots].sort();
    expect(parsed.acceptanceLaneOwnedWritableRoots).toEqual(ascendingSortedRoots);
    const readOnlyRoots = ['doom/', 'iwad/', 'reference/'] as const;
    for (const acceptanceRoot of parsed.acceptanceLaneOwnedWritableRoots) {
      expect(readOnlyRoots.includes(acceptanceRoot as (typeof readOnlyRoots)[number])).toBe(false);
    }
  });

  test('acceptance prerequisite gate ids equal the canonical eleven entries in canonical order with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptancePrerequisiteGateIds).toEqual(CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS);
    expect(parsed.acceptancePrerequisiteGateIds).toHaveLength(CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_COUNT);
    expect(new Set(parsed.acceptancePrerequisiteGateIds).size).toBe(parsed.acceptancePrerequisiteGateIds.length);
    expect(parsed.acceptancePrerequisiteGateCount).toBe(String(CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_COUNT));
  });

  test('acceptance prerequisite gate slugs pair every prerequisite gate id with its canonical slug from MASTER_CHECKLIST.md', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptancePrerequisiteGateSlugs).toHaveLength(CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_COUNT);
    for (let index = 0; index < CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS.length; index += 1) {
      const expectedGateId = CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS[index]!;
      const expectedGateSlug = CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_SLUGS.get(expectedGateId);
      expect(expectedGateSlug).toBeDefined();
      const documentEntry = parsed.acceptancePrerequisiteGateSlugs[index];
      expect(documentEntry).toBe(`${expectedGateId} ${expectedGateSlug}`);
    }
  });

  test('runtime target pins the canonical bun run doom.ts entrypoint', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.runtimeTarget).toBe(CANONICAL_RUNTIME_TARGET);
  });

  test('local reference rule names tier-one local primary sources, the read-only reference roots, and the proprietary asset boundary anchors', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.localReferenceRule).toContain('plan_vanilla_parity/SOURCE_CATALOG.md');
    expect(parsed.localReferenceRule).toContain('plan_vanilla_parity/define-source-authority-order.md');
    expect(parsed.localReferenceRule).toContain('SRC-LOCAL-001');
    expect(parsed.localReferenceRule).toContain('SRC-LOCAL-002');
    expect(parsed.localReferenceRule).toContain('doom/DOOMD.EXE');
    expect(parsed.localReferenceRule).toContain('doom/DOOM.EXE');
    expect(parsed.localReferenceRule).toContain('SHA-256');
    expect(parsed.localReferenceRule).toContain('plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    expect(parsed.localReferenceRule).toContain('ASSET_BOUNDARIES');
    expect(parsed.localReferenceRule).toContain('REFERENCE_BUNDLE_PATH');
    expect(parsed.localReferenceRule).toContain('src/reference/policy.ts');
  });

  test('clean launch rule names the D_DoomMain init order, the D_DoomLoop per-frame schedule, and the title-loop / main-menu / scripted-scenario starting points', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.cleanLaunchRule).toContain('clean launch');
    expect(parsed.cleanLaunchRule).toContain('D_DoomMain');
    expect(parsed.cleanLaunchRule).toContain('D_DoomLoop');
    expect(parsed.cleanLaunchRule).toContain('title loop');
    expect(parsed.cleanLaunchRule).toContain('main menu');
    expect(parsed.cleanLaunchRule).toContain('scripted scenario');
  });

  test('deterministic input stream rule names the OR-VP-002 family, the Phase 02 capture steps, and the SHA-256 hash requirement', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.deterministicInputStreamRule).toContain('deterministic input stream');
    expect(parsed.deterministicInputStreamRule).toContain('OR-VP-002');
    expect(parsed.deterministicInputStreamRule).toContain('plan_vanilla_parity/REFERENCE_ORACLES.md');
    expect(parsed.deterministicInputStreamRule).toContain('plan_vanilla_parity/define-oracle-capture-policy.md');
    expect(parsed.deterministicInputStreamRule).toContain('02-009');
    expect(parsed.deterministicInputStreamRule).toContain('02-010');
    expect(parsed.deterministicInputStreamRule).toContain('SHA-256');
  });

  test('comparison surfaces equal the canonical nine entries in canonical order with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.comparisonSurfaces).toEqual(CANONICAL_COMPARISON_SURFACES);
    expect(parsed.comparisonSurfaces).toHaveLength(CANONICAL_COMPARISON_SURFACE_COUNT);
    expect(new Set(parsed.comparisonSurfaces).size).toBe(parsed.comparisonSurfaces.length);
    expect(parsed.comparisonSurfaceCount).toBe(String(CANONICAL_COMPARISON_SURFACE_COUNT));
  });

  test('zero default differences rule pins the verbatim phrase used by validate-plan.ts and validateFinalGate', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.zeroDefaultDifferencesRule).toContain('zero default differences');
    expect(parsed.zeroDefaultDifferencesRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.zeroDefaultDifferencesRule).toContain('validateFinalGate');
    expect(parsed.zeroDefaultDifferencesRule).toContain('## final evidence');
  });

  test('sampled hashes intermediate rule pins the verbatim README sentence', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.sampledHashesIntermediateRule).toContain(CANONICAL_INTERMEDIATE_VS_FINAL_SENTENCE);
    expect(parsed.sampledHashesIntermediateRule).toContain('plan_vanilla_parity/README.md');
    expect(parsed.sampledHashesIntermediateRule).toContain('plan_vanilla_parity/establish-vanilla-parity-control-center.md');
  });

  test('required final gate phrases equal the canonical twelve REQUIRED_FINAL_GATE_PHRASES from validate-plan.ts in canonical order with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.requiredFinalGatePhrases).toEqual(CANONICAL_REQUIRED_FINAL_GATE_PHRASES);
    expect(parsed.requiredFinalGatePhrases).toHaveLength(CANONICAL_REQUIRED_FINAL_GATE_PHRASE_COUNT);
    expect(new Set(parsed.requiredFinalGatePhrases).size).toBe(parsed.requiredFinalGatePhrases.length);
    expect(parsed.requiredFinalGatePhraseCount).toBe(String(CANONICAL_REQUIRED_FINAL_GATE_PHRASE_COUNT));
  });

  test('required final gate phrase enforcement section names the validateFinalGate helper, the REQUIRED_FINAL_GATE_PHRASES array, and the verbatim diagnostic', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.requiredFinalGatePhraseEnforcement).toContain('REQUIRED_FINAL_GATE_PHRASES');
    expect(parsed.requiredFinalGatePhraseEnforcement).toContain('validateFinalGate');
    expect(parsed.requiredFinalGatePhraseEnforcement).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.requiredFinalGatePhraseEnforcement).toContain('Final gate evidence must include <phrase>.');
    expect(parsed.requiredFinalGatePhraseEnforcement).toContain('## final evidence');
    expect(parsed.requiredFinalGatePhraseEnforcement).toContain('plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md');
  });

  test('rejected final evidence patterns equal the canonical five REJECTED_FINAL_EVIDENCE_PATTERNS from validate-plan.ts in canonical order with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.rejectedFinalEvidencePatterns).toEqual(CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERNS);
    expect(parsed.rejectedFinalEvidencePatterns).toHaveLength(CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERN_COUNT);
    expect(new Set(parsed.rejectedFinalEvidencePatterns).size).toBe(parsed.rejectedFinalEvidencePatterns.length);
    expect(parsed.rejectedFinalEvidencePatternCount).toBe(String(CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERN_COUNT));
  });

  test('rejected final evidence pattern enforcement section names the validateFinalGate helper, the REJECTED_FINAL_EVIDENCE_PATTERNS array, and the verbatim diagnostic', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.rejectedFinalEvidencePatternEnforcement).toContain('REJECTED_FINAL_EVIDENCE_PATTERNS');
    expect(parsed.rejectedFinalEvidencePatternEnforcement).toContain('validateFinalGate');
    expect(parsed.rejectedFinalEvidencePatternEnforcement).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.rejectedFinalEvidencePatternEnforcement).toContain('Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.');
    expect(parsed.rejectedFinalEvidencePatternEnforcement).toContain('## final evidence');
    expect(parsed.rejectedFinalEvidencePatternEnforcement).toContain('plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md');
  });

  test('merge checkpoint identifier and merge checkpoint title pin the canonical G6 anchor', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.mergeCheckpointIdentifier).toBe(CANONICAL_MERGE_CHECKPOINT_IDENTIFIER);
    expect(parsed.mergeCheckpointTitle).toBe(CANONICAL_MERGE_CHECKPOINT_TITLE);
  });

  test('merge checkpoint anchor section pins the verbatim PARALLEL_WORK.md merge checkpoints line and the seven-checkpoint sequence', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.mergeCheckpointAnchor).toContain(CANONICAL_MERGE_CHECKPOINT_LINE);
    expect(parsed.mergeCheckpointAnchor).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.mergeCheckpointAnchor).toContain('G6');
    expect(parsed.mergeCheckpointAnchor).toContain(CANONICAL_FINAL_SIDE_BY_SIDE_GATE_ID);
    expect(parsed.mergeCheckpointAnchor).toContain(CANONICAL_FINAL_SIDE_BY_SIDE_GATE_SLUG);
  });

  test('OR-VP-012 family anchor section pins the verbatim minimum evidence sentence and names the canonical four required oracle artifact fields', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.oracleVp012FamilyAnchor).toContain('OR-VP-012');
    expect(parsed.oracleVp012FamilyAnchor).toContain(CANONICAL_OR_VP_012_MINIMUM_EVIDENCE);
    expect(parsed.oracleVp012FamilyAnchor).toContain('plan_vanilla_parity/REFERENCE_ORACLES.md');
    expect(parsed.oracleVp012FamilyAnchor).toContain('plan_vanilla_parity/define-oracle-capture-policy.md');
    expect(parsed.oracleVp012FamilyAnchor).toContain('plan_vanilla_parity/final-gates/');
    expect(parsed.oracleVp012FamilyAnchor).toContain('test/vanilla_parity/acceptance/');
    expect(parsed.oracleVp012FamilyAnchor).toContain('`id`');
    expect(parsed.oracleVp012FamilyAnchor).toContain('`stepId`');
    expect(parsed.oracleVp012FamilyAnchor).toContain('`stepTitle`');
    expect(parsed.oracleVp012FamilyAnchor).toContain('`lane`');
    expect(parsed.oracleVp012FamilyAnchor).toContain('acceptance');
  });

  test('no proprietary bytes rule names every category of forbidden id Software bytes and the proprietary asset boundary anchors', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.noProprietaryBytesRule).toContain('IWAD');
    expect(parsed.noProprietaryBytesRule).toContain('PWAD');
    expect(parsed.noProprietaryBytesRule).toContain('DOS executable');
    expect(parsed.noProprietaryBytesRule).toContain('Chocolate Doom');
    expect(parsed.noProprietaryBytesRule).toContain('save bytes');
    expect(parsed.noProprietaryBytesRule).toContain('demo bytes');
    expect(parsed.noProprietaryBytesRule).toContain('audio sample bytes');
    expect(parsed.noProprietaryBytesRule).toContain('music sample bytes');
    expect(parsed.noProprietaryBytesRule).toContain('SHA-256');
    expect(parsed.noProprietaryBytesRule).toContain('plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    expect(parsed.noProprietaryBytesRule).toContain('plan_vanilla_parity/define-oracle-capture-policy.md');
    expect(parsed.noProprietaryBytesRule).toContain('ASSET_BOUNDARIES');
    expect(parsed.noProprietaryBytesRule).toContain('REFERENCE_BUNDLE_PATH');
    expect(parsed.noProprietaryBytesRule).toContain('src/reference/policy.ts');
    for (const readOnlyRoot of ['doom/', 'iwad/', 'reference/']) {
      expect(parsed.noProprietaryBytesRule).toContain(readOnlyRoot);
    }
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, every adjacent governance pin, the validate-plan helper, and the four Phase 13 gate step files', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      CONTROL_CENTER_PATH,
      DEFINE_ORACLE_CAPTURE_POLICY_PATH,
      DEFINE_READ_ONLY_REFERENCE_ROOTS_PATH,
      DEFINE_SOURCE_AUTHORITY_ORDER_PATH,
      DEFINE_STEP_FILE_REQUIRED_FIELDS_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PIN_PROPRIETARY_ASSET_PATH,
      PIN_USER_SUPPLIED_IWAD_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      POLICY_MODULE_PATH,
      REFERENCE_ORACLES_PATH,
      SOURCE_CATALOG_PATH,
      STEP_13_001_PATH,
      STEP_13_002_PATH,
      STEP_13_003_PATH,
      STEP_13_004_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity README.md anchors the canonical Acceptance Standard section with the verbatim sampled-hashes-vs-final-gates sentence and every comparison surface', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    expect(readmeText).toContain('## Acceptance Standard');
    expect(readmeText).toContain(CANONICAL_INTERMEDIATE_VS_FINAL_SENTENCE);
    expect(readmeText).toContain('The default allowed difference is none.');
    for (const comparisonSurface of CANONICAL_COMPARISON_SURFACES) {
      expect(readmeText).toContain(comparisonSurface);
    }
  });

  test('plan_vanilla_parity establish-vanilla-parity-control-center.md anchors the same canonical final gate id, slug, and acceptance standard wording', async () => {
    const controlCenterText = await Bun.file(CONTROL_CENTER_PATH).text();
    expect(controlCenterText).toContain(`\n## final gate step id\n\n${CANONICAL_FINAL_SIDE_BY_SIDE_GATE_ID}\n`);
    expect(controlCenterText).toContain(`\n## final gate step slug\n\n${CANONICAL_FINAL_SIDE_BY_SIDE_GATE_SLUG}\n`);
    expect(controlCenterText).toContain(`\n## final gate step file path\n\n${CANONICAL_FINAL_SIDE_BY_SIDE_GATE_FILE_PATH}\n`);
    expect(controlCenterText).toContain(CANONICAL_RUNTIME_TARGET);
    expect(controlCenterText).toContain('zero default differences');
    for (const comparisonSurface of CANONICAL_COMPARISON_SURFACES) {
      expect(controlCenterText).toContain(comparisonSurface);
    }
  });

  test('plan_vanilla_parity PARALLEL_WORK.md anchors the verbatim merge checkpoints line and the acceptance lane row owning every canonical writable root', async () => {
    const parallelWorkText = await Bun.file(PARALLEL_WORK_PATH).text();
    expect(parallelWorkText).toContain(CANONICAL_MERGE_CHECKPOINT_LINE);
    const acceptanceLaneRowMatch = parallelWorkText.match(/^\| acceptance \|.*$/m);
    expect(acceptanceLaneRowMatch).not.toBeNull();
    if (acceptanceLaneRowMatch !== null) {
      const acceptanceLaneRow = acceptanceLaneRowMatch[0];
      for (const acceptanceLaneRoot of CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOTS) {
        expect(acceptanceLaneRow).toContain(acceptanceLaneRoot);
      }
    }
  });

  test('plan_vanilla_parity validate-plan.ts anchors the FINAL_GATE_STEP_ID, REQUIRED_FINAL_GATE_PHRASES, REJECTED_FINAL_EVIDENCE_PATTERNS, and validateFinalGate helper this standard depends on', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain(`FINAL_GATE_STEP_ID = '${CANONICAL_FINAL_SIDE_BY_SIDE_GATE_ID}';`);
    expect(validatePlanText).toContain('REQUIRED_FINAL_GATE_PHRASES');
    expect(validatePlanText).toContain('REJECTED_FINAL_EVIDENCE_PATTERNS');
    expect(validatePlanText).toContain('function validateFinalGate');
    expect(validatePlanText).toContain('Final gate evidence must include ${requiredPhrase}.');
    expect(validatePlanText).toContain("'Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.'");
    for (const requiredPhrase of CANONICAL_REQUIRED_FINAL_GATE_PHRASES) {
      expect(validatePlanText).toContain(requiredPhrase);
    }
  });

  test('plan_vanilla_parity REFERENCE_ORACLES.md anchors the OR-VP-012 final side by side family with its verbatim minimum evidence sentence', async () => {
    const referenceOraclesText = await Bun.file(REFERENCE_ORACLES_PATH).text();
    expect(referenceOraclesText).toContain('| OR-VP-012 |');
    expect(referenceOraclesText).toContain(CANONICAL_OR_VP_012_MINIMUM_EVIDENCE);
  });

  test('plan_vanilla_parity MASTER_CHECKLIST.md anchors every Phase 13 acceptance gate row with the canonical eleven prerequisites and the canonical acceptance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    expect(checklistText).toContain('## Phase 13: Final Proof / Handoff');
    const expectedPrereqs = CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS.join(',');
    for (let index = 0; index < CANONICAL_ACCEPTANCE_GATE_IDS.length; index += 1) {
      const gateId = CANONICAL_ACCEPTANCE_GATE_IDS[index]!;
      const gateSlug = CANONICAL_ACCEPTANCE_GATE_SLUGS[index]!;
      const expectedPendingRow = `- [ ] \`${gateId}\` \`${gateSlug}\` | lane: \`${CANONICAL_ACCEPTANCE_LANE}\` | prereqs: \`${expectedPrereqs}\` | file: \`plan_vanilla_parity/steps/${gateId}-${gateSlug}.md\``;
      const expectedCompletedRow = `- [x] \`${gateId}\` \`${gateSlug}\` | lane: \`${CANONICAL_ACCEPTANCE_LANE}\` | prereqs: \`${expectedPrereqs}\` | file: \`plan_vanilla_parity/steps/${gateId}-${gateSlug}.md\``;
      expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
    }
  });

  test('every Phase 13 acceptance gate step file declares the acceptance lane and the canonical eleven prerequisite gate ids', async () => {
    const gateFilePathsByGateId: ReadonlyMap<string, string> = new Map([
      ['13-001', STEP_13_001_PATH],
      ['13-002', STEP_13_002_PATH],
      ['13-003', STEP_13_003_PATH],
      ['13-004', STEP_13_004_PATH],
    ]);
    for (const gateFilePath of gateFilePathsByGateId.values()) {
      expect(existsSync(gateFilePath)).toBe(true);
      const gateText = await Bun.file(gateFilePath).text();
      expect(gateText).toContain(`\n## lane\n\n${CANONICAL_ACCEPTANCE_LANE}\n`);
      for (const prerequisiteGateId of CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS) {
        expect(gateText).toContain(`- ${prerequisiteGateId}`);
      }
    }
  });

  test('CLAUDE.md anchors the Bun runtime line and the read-only reference roots this standard depends on', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Bun only.');
    for (const readOnlyRoot of ['doom/', 'iwad/', 'reference/']) {
      expect(claudeText).toContain(`\`${readOnlyRoot}\``);
    }
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-fabrication core principle that motivate the zero-default-differences rule', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
    expect(agentsText).toContain('No fabrication');
  });

  test('src/reference/policy.ts anchors the doom/ root as REFERENCE_BUNDLE_PATH and ASSET_BOUNDARIES', async () => {
    const policyText = await Bun.file(POLICY_MODULE_PATH).text();
    expect(policyText).toContain("REFERENCE_BUNDLE_PATH = resolve(PROJECT_ROOT_PATH, 'doom')");
    expect(policyText).toContain('ASSET_BOUNDARIES');
  });

  test('step 00-014 file declares the governance lane, lists this standard declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-014: Define Final Acceptance Standard');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-final-acceptance-standard.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-final-acceptance-standard.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-014 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-014` `define-final-acceptance-standard` | lane: `governance` | prereqs: `00-013` | file: `plan_vanilla_parity/steps/00-014-define-final-acceptance-standard.md`';
    const expectedCompletedRow = '- [x] `00-014` `define-final-acceptance-standard` | lane: `governance` | prereqs: `00-013` | file: `plan_vanilla_parity/steps/00-014-define-final-acceptance-standard.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the runtime target, every canonical comparison surface, every canonical Phase 13 gate id and slug, every canonical acceptance lane writable root, every canonical acceptance prerequisite gate id, every canonical required final gate phrase, every canonical rejected final evidence pattern, the merge checkpoint G6, and the OR-VP-012 family identifier', async () => {
    const parsed = await loadFinalAcceptanceStandardDocument();
    expect(parsed.acceptancePhrasing).toContain(CANONICAL_RUNTIME_TARGET);
    for (const comparisonSurface of CANONICAL_COMPARISON_SURFACES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${comparisonSurface}\``);
    }
    for (const gateId of CANONICAL_ACCEPTANCE_GATE_IDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${gateId}\``);
    }
    for (const gateSlug of CANONICAL_ACCEPTANCE_GATE_SLUGS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${gateSlug}\``);
    }
    for (const acceptanceRoot of CANONICAL_ACCEPTANCE_LANE_OWNED_WRITABLE_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${acceptanceRoot}\``);
    }
    for (const prerequisiteGateId of CANONICAL_ACCEPTANCE_PREREQUISITE_GATE_IDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${prerequisiteGateId}\``);
    }
    for (const requiredPhrase of CANONICAL_REQUIRED_FINAL_GATE_PHRASES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${requiredPhrase}\``);
    }
    for (const rejectedPattern of CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERNS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${rejectedPattern}\``);
    }
    expect(parsed.acceptancePhrasing).toContain(CANONICAL_MERGE_CHECKPOINT_IDENTIFIER);
    expect(parsed.acceptancePhrasing).toContain(CANONICAL_MERGE_CHECKPOINT_TITLE);
    expect(parsed.acceptancePhrasing).toContain('OR-VP-012');
    expect(parsed.acceptancePhrasing).toContain(CANONICAL_ACCEPTANCE_LANE);
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 final acceptance standard\n';
    expect(() => parseFinalAcceptanceStandardDocument(documentTextWithMissingSection)).toThrow('Section "acceptance gate ids" not found in final acceptance standard document.');
  });

  test('parser surfaces a meaningful error when acceptance gate ids is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## acceptance gate ids\n\n- 13-001\n- 13-002\n- 13-003\n- 13-004\n/, '\n## acceptance gate ids\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFinalAcceptanceStandardDocument(corruptedDocumentText)).toThrow('acceptance gate ids must list at least one id.');
  });

  test('parser surfaces a meaningful error when required final gate phrases is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## required final gate phrases\n\n- bun run doom\.ts\n- same deterministic input stream\n- deterministic state\n- framebuffer\n- audio\n- music events\n- menu transitions\n- level transitions\n- save\/load bytes\n- demo playback\n- full-playthrough completion\n- zero default differences\n/,
      '\n## required final gate phrases\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFinalAcceptanceStandardDocument(corruptedDocumentText)).toThrow('required final gate phrases must list at least one phrase.');
  });

  test('parser surfaces a meaningful error when rejected final evidence patterns is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## rejected final evidence patterns\n\n- pending\n- manifest-only\n- sampled-only\n- intent-only\n- declared intent\n/,
      '\n## rejected final evidence patterns\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFinalAcceptanceStandardDocument(corruptedDocumentText)).toThrow('rejected final evidence patterns must list at least one pattern.');
  });

  test('parser surfaces a meaningful error when acceptance prerequisite gate ids is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## acceptance prerequisite gate ids\n\n- 02-035\n- 03-036\n- 04-030\n- 05-028\n- 06-032\n- 07-034\n- 08-032\n- 09-038\n- 10-028\n- 11-031\n- 12-028\n/,
      '\n## acceptance prerequisite gate ids\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFinalAcceptanceStandardDocument(corruptedDocumentText)).toThrow('acceptance prerequisite gate ids must list at least one id.');
  });
});
