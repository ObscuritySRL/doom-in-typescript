import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const LEGACY_REFERENCE_ORACLES_PATH = 'plan_fps/REFERENCE_ORACLES.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-oracle-capture-policy.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const POLICY_MODULE_PATH = 'src/reference/policy.ts';
const PROPRIETARY_BOUNDARY_PATH = 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md';
const READ_ONLY_REFERENCE_ROOTS_PATH = 'plan_vanilla_parity/define-read-only-reference-roots.md';
const REFERENCE_ORACLES_PATH = 'plan_vanilla_parity/REFERENCE_ORACLES.md';
const SOURCE_AUTHORITY_ORDER_PATH = 'plan_vanilla_parity/define-source-authority-order.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-013-define-oracle-capture-policy.md';
const STEP_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const LANE_WRITE_LOCK_CONTRACT_PATH = 'plan_vanilla_parity/define-lane-write-lock-contract.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_VERIFIABLE_EVIDENCE_SOURCES: readonly string[] = ['local binaries', 'IWAD data', 'id Software source', 'Chocolate Doom source'];

const CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS: readonly string[] = ['plan_vanilla_parity/final-gates/', 'test/oracles/fixtures/', 'test/vanilla_parity/acceptance/', 'test/vanilla_parity/oracles/'];

const CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOT_COUNT = 4;

const CANONICAL_READ_ONLY_REFERENCE_ROOTS: readonly string[] = ['doom/', 'iwad/', 'reference/'];

const CANONICAL_ORACLE_LANE_OWNED_OUTPUT_ROOTS: readonly string[] = ['test/oracles/fixtures/', 'test/vanilla_parity/oracles/'];

const CANONICAL_ACCEPTANCE_LANE_OWNED_OUTPUT_ROOTS: readonly string[] = ['plan_vanilla_parity/final-gates/', 'test/vanilla_parity/acceptance/'];

const CANONICAL_ORACLE_FAMILY_COUNT = 12;

const CANONICAL_ORACLE_FAMILY_IDENTIFIERS: readonly string[] = ['OR-VP-001', 'OR-VP-002', 'OR-VP-003', 'OR-VP-004', 'OR-VP-005', 'OR-VP-006', 'OR-VP-007', 'OR-VP-008', 'OR-VP-009', 'OR-VP-010', 'OR-VP-011', 'OR-VP-012'];

const CANONICAL_ORACLE_FAMILY_MINIMUM_EVIDENCE: ReadonlyMap<string, string> = new Map([
  ['OR-VP-001', 'Paired implementation/reference launch logs and startup state from clean sandbox.'],
  ['OR-VP-002', 'Shared deterministic keyboard and mouse stream, with hash and injection transcript.'],
  ['OR-VP-003', '320x200 indexed framebuffer captures and hashes at required points.'],
  ['OR-VP-004', 'Deterministic state snapshots covering tic, RNG, gamestate, player, map, thinkers, and specials.'],
  ['OR-VP-005', 'SFX mixer windows and hashes with source event transcript.'],
  ['OR-VP-006', 'MUS/OPL event log and timing comparison.'],
  ['OR-VP-007', 'Menu transition and rendering transcript from clean launch.'],
  ['OR-VP-008', 'Level transition transcript including E1M1 start and E1 exits.'],
  ['OR-VP-009', 'Byte-level save and load roundtrip comparison.'],
  ['OR-VP-010', 'DEMO1, DEMO2, and DEMO3 playback sync through termination.'],
  ['OR-VP-011', 'Full shareware episode route with state, video, audio, and transition evidence.'],
  ['OR-VP-012', 'Clean-launch paired run using the same input stream and zero default allowed differences.'],
]);

const CANONICAL_ORACLE_ARTIFACT_REQUIRED_FIELDS: readonly string[] = ['id', 'stepId', 'stepTitle', 'lane'];

const CANONICAL_ORACLE_ARTIFACT_REQUIRED_FIELD_COUNT = 4;

const CANONICAL_NO_GUESS_TRIGGER_SENTENCE = 'If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.';

const CANONICAL_ORACLE_REDIRECT_SENTENCE =
  'Oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/`.';

interface OracleCapturePolicyDocument {
  readonly OR_VP_001Family: string;
  readonly OR_VP_002Family: string;
  readonly OR_VP_003Family: string;
  readonly OR_VP_004Family: string;
  readonly OR_VP_005Family: string;
  readonly OR_VP_006Family: string;
  readonly OR_VP_007Family: string;
  readonly OR_VP_008Family: string;
  readonly OR_VP_009Family: string;
  readonly OR_VP_010Family: string;
  readonly OR_VP_011Family: string;
  readonly OR_VP_012Family: string;
  readonly acceptanceLaneOwnedOutputRoots: readonly string[];
  readonly acceptancePhrasing: string;
  readonly allowedOracleOutputRootCount: string;
  readonly allowedOracleOutputRoots: readonly string[];
  readonly authorityAnchor: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly laneToOutputRootMapping: string;
  readonly noGuessTriggerRule: string;
  readonly noProprietaryBytesRule: string;
  readonly oracleArtifactFilenameRule: string;
  readonly oracleArtifactIdFieldRule: string;
  readonly oracleArtifactJsonEncodingRule: string;
  readonly oracleArtifactLaneFieldRule: string;
  readonly oracleArtifactRequiredFieldCount: string;
  readonly oracleArtifactRequiredFields: readonly string[];
  readonly oracleArtifactStepIdFieldRule: string;
  readonly oracleArtifactStepTitleFieldRule: string;
  readonly oracleCaptureLane: string;
  readonly oracleCapturePhase: string;
  readonly oracleCapturePhaseTitle: string;
  readonly oracleFamilyCount: string;
  readonly oracleFamilyIdentifiers: readonly string[];
  readonly oracleLaneOwnedOutputRoots: readonly string[];
  readonly oracleRedirectRule: string;
  readonly oracleTestFocusedFieldRule: string;
  readonly readOnlyReferenceRoots: readonly string[];
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly scopeName: string;
  readonly verifiableEvidenceSources: readonly string[];
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in oracle capture policy document.`);
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

function parseOracleCapturePolicyDocument(documentText: string): OracleCapturePolicyDocument {
  const verifiableEvidenceSources = extractBullets(documentText, 'verifiable evidence sources');
  if (verifiableEvidenceSources.length === 0) {
    throw new Error('verifiable evidence sources must list at least one source.');
  }

  const allowedOracleOutputRoots = extractBullets(documentText, 'allowed oracle output roots');
  if (allowedOracleOutputRoots.length === 0) {
    throw new Error('allowed oracle output roots must list at least one root.');
  }

  const readOnlyReferenceRoots = extractBullets(documentText, 'read-only reference roots');
  if (readOnlyReferenceRoots.length === 0) {
    throw new Error('read-only reference roots must list at least one root.');
  }

  const oracleLaneOwnedOutputRoots = extractBullets(documentText, 'oracle lane owned output roots');
  if (oracleLaneOwnedOutputRoots.length === 0) {
    throw new Error('oracle lane owned output roots must list at least one root.');
  }

  const acceptanceLaneOwnedOutputRoots = extractBullets(documentText, 'acceptance lane owned output roots');
  if (acceptanceLaneOwnedOutputRoots.length === 0) {
    throw new Error('acceptance lane owned output roots must list at least one root.');
  }

  const oracleFamilyIdentifiers = extractBullets(documentText, 'oracle family identifiers');
  if (oracleFamilyIdentifiers.length === 0) {
    throw new Error('oracle family identifiers must list at least one identifier.');
  }

  const oracleArtifactRequiredFields = extractBullets(documentText, 'oracle artifact required fields');
  if (oracleArtifactRequiredFields.length === 0) {
    throw new Error('oracle artifact required fields must list at least one field.');
  }

  return {
    OR_VP_001Family: extractSection(documentText, 'OR-VP-001 family'),
    OR_VP_002Family: extractSection(documentText, 'OR-VP-002 family'),
    OR_VP_003Family: extractSection(documentText, 'OR-VP-003 family'),
    OR_VP_004Family: extractSection(documentText, 'OR-VP-004 family'),
    OR_VP_005Family: extractSection(documentText, 'OR-VP-005 family'),
    OR_VP_006Family: extractSection(documentText, 'OR-VP-006 family'),
    OR_VP_007Family: extractSection(documentText, 'OR-VP-007 family'),
    OR_VP_008Family: extractSection(documentText, 'OR-VP-008 family'),
    OR_VP_009Family: extractSection(documentText, 'OR-VP-009 family'),
    OR_VP_010Family: extractSection(documentText, 'OR-VP-010 family'),
    OR_VP_011Family: extractSection(documentText, 'OR-VP-011 family'),
    OR_VP_012Family: extractSection(documentText, 'OR-VP-012 family'),
    acceptanceLaneOwnedOutputRoots,
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    allowedOracleOutputRootCount: extractSection(documentText, 'allowed oracle output root count'),
    allowedOracleOutputRoots,
    authorityAnchor: extractSection(documentText, 'authority anchor'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    laneToOutputRootMapping: extractSection(documentText, 'lane to output root mapping'),
    noGuessTriggerRule: extractSection(documentText, 'no guess trigger rule'),
    noProprietaryBytesRule: extractSection(documentText, 'no proprietary bytes rule'),
    oracleArtifactFilenameRule: extractSection(documentText, 'oracle artifact filename rule'),
    oracleArtifactIdFieldRule: extractSection(documentText, 'oracle artifact id field rule'),
    oracleArtifactJsonEncodingRule: extractSection(documentText, 'oracle artifact json encoding rule'),
    oracleArtifactLaneFieldRule: extractSection(documentText, 'oracle artifact lane field rule'),
    oracleArtifactRequiredFieldCount: extractSection(documentText, 'oracle artifact required field count'),
    oracleArtifactRequiredFields,
    oracleArtifactStepIdFieldRule: extractSection(documentText, 'oracle artifact stepid field rule'),
    oracleArtifactStepTitleFieldRule: extractSection(documentText, 'oracle artifact steptitle field rule'),
    oracleCaptureLane: extractSection(documentText, 'oracle capture lane'),
    oracleCapturePhase: extractSection(documentText, 'oracle capture phase'),
    oracleCapturePhaseTitle: extractSection(documentText, 'oracle capture phase title'),
    oracleFamilyCount: extractSection(documentText, 'oracle family count'),
    oracleFamilyIdentifiers,
    oracleLaneOwnedOutputRoots,
    oracleRedirectRule: extractSection(documentText, 'oracle redirect rule'),
    oracleTestFocusedFieldRule: extractSection(documentText, 'oracle test focused field rule'),
    readOnlyReferenceRoots,
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    scopeName: extractSection(documentText, 'scope name'),
    verifiableEvidenceSources,
  };
}

async function loadOracleCapturePolicyDocument(): Promise<OracleCapturePolicyDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parseOracleCapturePolicyDocument(documentText);
}

describe('define oracle capture policy declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 oracle capture policy');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('oracle capture phase pins the canonical Phase 02 identifier and the canonical phase title', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleCapturePhase).toBe('02');
    expect(parsed.oracleCapturePhaseTitle).toBe('Reference / Oracle Capture Foundation');
  });

  test('oracle capture lane pins the canonical oracle lane slug', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleCaptureLane).toBe('oracle');
  });

  test('no guess trigger rule pins the verbatim PROMPT.md sentence and names every canonical verifiable evidence source', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.noGuessTriggerRule).toContain(CANONICAL_NO_GUESS_TRIGGER_SENTENCE);
    expect(parsed.noGuessTriggerRule).toContain('plan_vanilla_parity/PROMPT.md');
    expect(parsed.noGuessTriggerRule).toContain('plan_vanilla_parity/define-source-authority-order.md');
    for (const verifiableEvidenceSource of CANONICAL_VERIFIABLE_EVIDENCE_SOURCES) {
      expect(parsed.noGuessTriggerRule).toContain(verifiableEvidenceSource);
    }
  });

  test('verifiable evidence sources list the four canonical sources in canonical order with no duplicates', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.verifiableEvidenceSources).toEqual(CANONICAL_VERIFIABLE_EVIDENCE_SOURCES);
    expect(parsed.verifiableEvidenceSources).toHaveLength(CANONICAL_VERIFIABLE_EVIDENCE_SOURCES.length);
    expect(new Set(parsed.verifiableEvidenceSources).size).toBe(parsed.verifiableEvidenceSources.length);
  });

  test('allowed oracle output roots equal the four canonical writable destinations ASCIIbetically sorted with no duplicates and disjoint from the read-only reference roots', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.allowedOracleOutputRoots).toEqual(CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS);
    expect(parsed.allowedOracleOutputRoots).toHaveLength(CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOT_COUNT);
    expect(new Set(parsed.allowedOracleOutputRoots).size).toBe(parsed.allowedOracleOutputRoots.length);
    expect(parsed.allowedOracleOutputRootCount).toBe(String(CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOT_COUNT));
    const ascendingSortedRoots = [...parsed.allowedOracleOutputRoots].sort();
    expect(parsed.allowedOracleOutputRoots).toEqual(ascendingSortedRoots);
    const readOnlyRootSet = new Set(CANONICAL_READ_ONLY_REFERENCE_ROOTS);
    for (const allowedOracleOutputRoot of parsed.allowedOracleOutputRoots) {
      expect(readOnlyRootSet.has(allowedOracleOutputRoot)).toBe(false);
    }
  });

  test('read-only reference roots equal the doom/, iwad/, reference/ trio in canonical order', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.readOnlyReferenceRoots).toEqual(CANONICAL_READ_ONLY_REFERENCE_ROOTS);
  });

  test('oracle lane owned output roots equal the canonical two oracle lane writable destinations and are a subset of the four allowed roots', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleLaneOwnedOutputRoots).toEqual(CANONICAL_ORACLE_LANE_OWNED_OUTPUT_ROOTS);
    const allowedRootSet = new Set(parsed.allowedOracleOutputRoots);
    for (const oracleLaneRoot of parsed.oracleLaneOwnedOutputRoots) {
      expect(allowedRootSet.has(oracleLaneRoot)).toBe(true);
    }
  });

  test('acceptance lane owned output roots equal the canonical two acceptance lane writable destinations and are a subset of the four allowed roots', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.acceptanceLaneOwnedOutputRoots).toEqual(CANONICAL_ACCEPTANCE_LANE_OWNED_OUTPUT_ROOTS);
    const allowedRootSet = new Set(parsed.allowedOracleOutputRoots);
    for (const acceptanceLaneRoot of parsed.acceptanceLaneOwnedOutputRoots) {
      expect(allowedRootSet.has(acceptanceLaneRoot)).toBe(true);
    }
  });

  test('oracle lane and acceptance lane owned output roots together cover every canonical allowed oracle output root', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    const combined = new Set([...parsed.oracleLaneOwnedOutputRoots, ...parsed.acceptanceLaneOwnedOutputRoots]);
    expect(combined.size).toBe(parsed.allowedOracleOutputRoots.length);
    for (const allowedRoot of parsed.allowedOracleOutputRoots) {
      expect(combined.has(allowedRoot)).toBe(true);
    }
  });

  test('lane to output root mapping pins both lane slugs and the disjoint-lane-scope rule anchor', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.laneToOutputRootMapping).toContain('`oracle`');
    expect(parsed.laneToOutputRootMapping).toContain('`acceptance`');
    expect(parsed.laneToOutputRootMapping).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.laneToOutputRootMapping).toContain('plan_vanilla_parity/define-lane-write-lock-contract.md');
    expect(parsed.laneToOutputRootMapping).toContain('validateParallelWork');
    for (const oracleLaneRoot of CANONICAL_ORACLE_LANE_OWNED_OUTPUT_ROOTS) {
      expect(parsed.laneToOutputRootMapping).toContain(`\`${oracleLaneRoot}\``);
    }
    for (const acceptanceLaneRoot of CANONICAL_ACCEPTANCE_LANE_OWNED_OUTPUT_ROOTS) {
      expect(parsed.laneToOutputRootMapping).toContain(`\`${acceptanceLaneRoot}\``);
    }
  });

  test('oracle family identifiers list the canonical twelve OR-VP-001..OR-VP-012 entries in canonical order with no duplicates', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleFamilyIdentifiers).toEqual(CANONICAL_ORACLE_FAMILY_IDENTIFIERS);
    expect(parsed.oracleFamilyIdentifiers).toHaveLength(CANONICAL_ORACLE_FAMILY_COUNT);
    expect(new Set(parsed.oracleFamilyIdentifiers).size).toBe(parsed.oracleFamilyIdentifiers.length);
    expect(parsed.oracleFamilyCount).toBe(String(CANONICAL_ORACLE_FAMILY_COUNT));
    const ascendingSortedIdentifiers = [...parsed.oracleFamilyIdentifiers].sort();
    expect(parsed.oracleFamilyIdentifiers).toEqual(ascendingSortedIdentifiers);
  });

  test('every OR-VP family section pins its identifier and the verbatim minimum evidence sentence from REFERENCE_ORACLES.md', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    const familySectionsByIdentifier: ReadonlyMap<string, string> = new Map([
      ['OR-VP-001', parsed.OR_VP_001Family],
      ['OR-VP-002', parsed.OR_VP_002Family],
      ['OR-VP-003', parsed.OR_VP_003Family],
      ['OR-VP-004', parsed.OR_VP_004Family],
      ['OR-VP-005', parsed.OR_VP_005Family],
      ['OR-VP-006', parsed.OR_VP_006Family],
      ['OR-VP-007', parsed.OR_VP_007Family],
      ['OR-VP-008', parsed.OR_VP_008Family],
      ['OR-VP-009', parsed.OR_VP_009Family],
      ['OR-VP-010', parsed.OR_VP_010Family],
      ['OR-VP-011', parsed.OR_VP_011Family],
      ['OR-VP-012', parsed.OR_VP_012Family],
    ]);

    for (const [familyIdentifier, familySectionBody] of familySectionsByIdentifier) {
      expect(familySectionBody.length).toBeGreaterThan(0);
      expect(familySectionBody).toContain(`\`${familyIdentifier}\``);
      expect(familySectionBody).toContain('plan_vanilla_parity/REFERENCE_ORACLES.md');
      const minimumEvidenceSentence = CANONICAL_ORACLE_FAMILY_MINIMUM_EVIDENCE.get(familyIdentifier);
      expect(minimumEvidenceSentence).toBeDefined();
      if (minimumEvidenceSentence !== undefined) {
        expect(familySectionBody).toContain(minimumEvidenceSentence);
      }
    }
  });

  test('OR-VP family section headings appear in canonical order in the document', async () => {
    const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const headingsInDocumentOrder: readonly string[] = [...documentText.matchAll(/^## (?<heading>.+)$/gm)].map((match) => match.groups!.heading);
    const familyHeadingsInDocumentOrder: readonly string[] = headingsInDocumentOrder.filter((heading) => /^OR-VP-\d{3} family$/.test(heading));
    const expectedFamilyHeadings: readonly string[] = CANONICAL_ORACLE_FAMILY_IDENTIFIERS.map((familyIdentifier) => `${familyIdentifier} family`);
    expect(familyHeadingsInDocumentOrder).toEqual(expectedFamilyHeadings);
  });

  test('oracle redirect rule pins the verbatim REFERENCE_ORACLES.md sentence and names every allowed oracle output root and every read-only reference root', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleRedirectRule).toContain('plan_vanilla_parity/REFERENCE_ORACLES.md');
    expect(parsed.oracleRedirectRule).toContain('Write lock is inside read-only reference root: <path>.');
    expect(parsed.oracleRedirectRule).toContain('Write lock escapes the workspace: <path>.');
    expect(parsed.oracleRedirectRule).toContain('validateWritablePath');
    expect(parsed.oracleRedirectRule).toContain('normalizePlanPath');
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(parsed.oracleRedirectRule).toContain(allowedOracleOutputRoot);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.oracleRedirectRule).toContain(readOnlyRoot);
    }
  });

  test('oracle artifact filename rule pins the canonical step-file path shape, both write-locked artifacts, and the validateWritablePath constraints', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleArtifactFilenameRule).toContain('plan_vanilla_parity/steps/02-NNN-<slug>.md');
    expect(parsed.oracleArtifactFilenameRule).toContain('<slug>.json');
    expect(parsed.oracleArtifactFilenameRule).toContain('<slug>.test.ts');
    expect(parsed.oracleArtifactFilenameRule).toContain('## write lock');
    expect(parsed.oracleArtifactFilenameRule).toContain('## expected changes');
    expect(parsed.oracleArtifactFilenameRule).toContain('validateWritablePath');
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.oracleArtifactFilenameRule).toContain(readOnlyRoot.replace(/\/$/, ''));
    }
  });

  test('oracle artifact json encoding rule pins UTF-8, Bun.file().json() parseability, and the JSON purity rules', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('UTF-8');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('Bun.file().json()');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('object');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('trailing commas');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('comments');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('undefined');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('NaN');
    expect(parsed.oracleArtifactJsonEncodingRule).toContain('Infinity');
  });

  test('oracle artifact required fields list the four canonical fields in canonical order with no duplicates', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleArtifactRequiredFields).toEqual(CANONICAL_ORACLE_ARTIFACT_REQUIRED_FIELDS);
    expect(parsed.oracleArtifactRequiredFields).toHaveLength(CANONICAL_ORACLE_ARTIFACT_REQUIRED_FIELD_COUNT);
    expect(new Set(parsed.oracleArtifactRequiredFields).size).toBe(parsed.oracleArtifactRequiredFields.length);
    expect(parsed.oracleArtifactRequiredFieldCount).toBe(String(CANONICAL_ORACLE_ARTIFACT_REQUIRED_FIELD_COUNT));
  });

  test('every per-field contract section names its own canonical field in backticks and pins the join-key and lane rules', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleArtifactIdFieldRule).toContain('`id`');
    expect(parsed.oracleArtifactIdFieldRule).toContain('OR-VP-');
    expect(parsed.oracleArtifactIdFieldRule).toContain('plan_vanilla_parity/steps/02-NNN-<slug>.md');

    expect(parsed.oracleArtifactStepIdFieldRule).toContain('`stepId`');
    expect(parsed.oracleArtifactStepIdFieldRule).toContain('02-NNN');
    expect(parsed.oracleArtifactStepIdFieldRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');

    expect(parsed.oracleArtifactStepTitleFieldRule).toContain('`stepTitle`');
    expect(parsed.oracleArtifactStepTitleFieldRule).toContain('## title');

    expect(parsed.oracleArtifactLaneFieldRule).toContain('`lane`');
    expect(parsed.oracleArtifactLaneFieldRule).toContain('oracle');
    expect(parsed.oracleArtifactLaneFieldRule).toContain('acceptance');
    for (const oracleLaneRoot of CANONICAL_ORACLE_LANE_OWNED_OUTPUT_ROOTS) {
      expect(parsed.oracleArtifactLaneFieldRule).toContain(oracleLaneRoot);
    }
    for (const acceptanceLaneRoot of CANONICAL_ACCEPTANCE_LANE_OWNED_OUTPUT_ROOTS) {
      expect(parsed.oracleArtifactLaneFieldRule).toContain(acceptanceLaneRoot);
    }
  });

  test('no proprietary bytes rule names every category of forbidden id Software bytes and the proprietary asset boundary anchors', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
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
    expect(parsed.noProprietaryBytesRule).toContain('ASSET_BOUNDARIES');
    expect(parsed.noProprietaryBytesRule).toContain('REFERENCE_BUNDLE_PATH');
    expect(parsed.noProprietaryBytesRule).toContain('src/reference/policy.ts');
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.noProprietaryBytesRule).toContain(readOnlyRoot);
    }
  });

  test('oracle test focused field rule pins bun:test, the Bun.file().json() loader, and the failure-mode requirement', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.oracleTestFocusedFieldRule).toContain('bun:test');
    expect(parsed.oracleTestFocusedFieldRule).toContain('Bun.file().json()');
    expect(parsed.oracleTestFocusedFieldRule).toContain('failure-mode');
  });

  test('authority anchor pins the upstream source authority order document and every canonical verifiable evidence source', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.authorityAnchor).toContain('plan_vanilla_parity/define-source-authority-order.md');
    for (const verifiableEvidenceSource of CANONICAL_VERIFIABLE_EVIDENCE_SOURCES) {
      expect(parsed.authorityAnchor).toContain(verifiableEvidenceSource);
    }
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, every adjacent governance pin, the validate-plan helper, and the policy module', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      LEGACY_REFERENCE_ORACLES_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      POLICY_MODULE_PATH,
      PROPRIETARY_BOUNDARY_PATH,
      READ_ONLY_REFERENCE_ROOTS_PATH,
      REFERENCE_ORACLES_PATH,
      SOURCE_AUTHORITY_ORDER_PATH,
      SOURCE_CATALOG_PATH,
      STEP_REQUIRED_FIELDS_PATH,
      LANE_WRITE_LOCK_CONTRACT_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity REFERENCE_ORACLES.md anchors the verbatim oracle redirect sentence this policy pins, the canonical four allowed oracle output roots, and every OR-VP-001..OR-VP-012 family identifier with its minimum evidence sentence', async () => {
    const referenceOraclesText = await Bun.file(REFERENCE_ORACLES_PATH).text();
    expect(referenceOraclesText).toContain(CANONICAL_ORACLE_REDIRECT_SENTENCE);
    expect(referenceOraclesText).toContain('Never write inside `doom/`, `iwad/`, or `reference/`.');
    expect(referenceOraclesText).toContain('If behavior cannot be verified, add an oracle-capture step.');
    for (const familyIdentifier of CANONICAL_ORACLE_FAMILY_IDENTIFIERS) {
      expect(referenceOraclesText).toContain(`| ${familyIdentifier} |`);
      const minimumEvidenceSentence = CANONICAL_ORACLE_FAMILY_MINIMUM_EVIDENCE.get(familyIdentifier);
      expect(minimumEvidenceSentence).toBeDefined();
      if (minimumEvidenceSentence !== undefined) {
        expect(referenceOraclesText).toContain(minimumEvidenceSentence);
      }
    }
  });

  test('plan_vanilla_parity PROMPT.md anchors the verbatim no-guess trigger sentence this policy pins', async () => {
    const planPromptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(planPromptText).toContain(CANONICAL_NO_GUESS_TRIGGER_SENTENCE);
  });

  test('plan_vanilla_parity define-source-authority-order.md anchors the same canonical four verifiable evidence sources this policy pins', async () => {
    const sourceAuthorityOrderText = await Bun.file(SOURCE_AUTHORITY_ORDER_PATH).text();
    for (const verifiableEvidenceSource of CANONICAL_VERIFIABLE_EVIDENCE_SOURCES) {
      expect(sourceAuthorityOrderText).toContain(verifiableEvidenceSource);
    }
    expect(sourceAuthorityOrderText).toContain(CANONICAL_NO_GUESS_TRIGGER_SENTENCE);
  });

  test('plan_vanilla_parity define-read-only-reference-roots.md anchors the same canonical four allowed oracle output roots this policy pins', async () => {
    const readOnlyReferenceRootsText = await Bun.file(READ_ONLY_REFERENCE_ROOTS_PATH).text();
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(readOnlyReferenceRootsText).toContain(`- ${allowedOracleOutputRoot}`);
    }
  });

  test('plan_vanilla_parity PARALLEL_WORK.md anchors the oracle lane and acceptance lane owned output roots this policy pins', async () => {
    const parallelWorkText = await Bun.file(PARALLEL_WORK_PATH).text();
    for (const oracleLaneRoot of CANONICAL_ORACLE_LANE_OWNED_OUTPUT_ROOTS) {
      expect(parallelWorkText).toContain(oracleLaneRoot);
    }
    for (const acceptanceLaneRoot of CANONICAL_ACCEPTANCE_LANE_OWNED_OUTPUT_ROOTS) {
      expect(parallelWorkText).toContain(acceptanceLaneRoot);
    }
    const oracleLaneRowMatch = parallelWorkText.match(/^\| oracle \|.*$/m);
    expect(oracleLaneRowMatch).not.toBeNull();
    if (oracleLaneRowMatch !== null) {
      const oracleLaneRow = oracleLaneRowMatch[0];
      for (const oracleLaneRoot of CANONICAL_ORACLE_LANE_OWNED_OUTPUT_ROOTS) {
        expect(oracleLaneRow).toContain(oracleLaneRoot);
      }
    }
    const acceptanceLaneRowMatch = parallelWorkText.match(/^\| acceptance \|.*$/m);
    expect(acceptanceLaneRowMatch).not.toBeNull();
    if (acceptanceLaneRowMatch !== null) {
      const acceptanceLaneRow = acceptanceLaneRowMatch[0];
      for (const acceptanceLaneRoot of CANONICAL_ACCEPTANCE_LANE_OWNED_OUTPUT_ROOTS) {
        expect(acceptanceLaneRow).toContain(acceptanceLaneRoot);
      }
    }
  });

  test('plan_vanilla_parity validate-plan.ts anchors the validateWritablePath helper and the canonical READ_ONLY_ROOTS literal this policy depends on', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('function validateWritablePath');
    expect(validatePlanText).toContain('function normalizePlanPath');
    expect(validatePlanText).toContain("READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;");
    expect(validatePlanText).toContain('Write lock is inside read-only reference root: ${path}.');
    expect(validatePlanText).toContain('Write lock escapes the workspace: ${path}.');
    expect(validatePlanText).toContain('Write lock path must not be empty.');
  });

  test('CLAUDE.md anchors the legacy oracle output redirect line this policy supersedes for the active control center', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Oracle artifacts must be written under');
    expect(claudeText).toContain('never inside `doom/`, `iwad/`, or `reference/`');
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-fabrication core principle that motivate the no-guess trigger rule', async () => {
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

  test('step 00-013 file declares the governance lane, lists this policy declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-013: Define Oracle Capture Policy');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-oracle-capture-policy.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-oracle-capture-policy.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-013 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-013` `define-oracle-capture-policy` | lane: `governance` | prereqs: `00-012` | file: `plan_vanilla_parity/steps/00-013-define-oracle-capture-policy.md`';
    const expectedCompletedRow = '- [x] `00-013` `define-oracle-capture-policy` | lane: `governance` | prereqs: `00-012` | file: `plan_vanilla_parity/steps/00-013-define-oracle-capture-policy.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names every canonical verifiable evidence source, every canonical allowed oracle output root, every canonical read-only reference root, every canonical OR-VP family identifier, and every canonical oracle artifact required field', async () => {
    const parsed = await loadOracleCapturePolicyDocument();
    for (const verifiableEvidenceSource of CANONICAL_VERIFIABLE_EVIDENCE_SOURCES) {
      expect(parsed.acceptancePhrasing).toContain(verifiableEvidenceSource);
    }
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(allowedOracleOutputRoot);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(readOnlyRoot);
    }
    for (const familyIdentifier of CANONICAL_ORACLE_FAMILY_IDENTIFIERS) {
      expect(parsed.acceptancePhrasing).toContain(familyIdentifier);
    }
    for (const requiredField of CANONICAL_ORACLE_ARTIFACT_REQUIRED_FIELDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${requiredField}\``);
    }
    expect(parsed.acceptancePhrasing).toContain('oracle');
    expect(parsed.acceptancePhrasing).toContain('acceptance');
    expect(parsed.acceptancePhrasing).toContain('bun:test');
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 oracle capture policy\n';
    expect(() => parseOracleCapturePolicyDocument(documentTextWithMissingSection)).toThrow('Section "verifiable evidence sources" not found in oracle capture policy document.');
  });

  test('parser surfaces a meaningful error when verifiable evidence sources is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## verifiable evidence sources\n\n- local binaries\n- IWAD data\n- id Software source\n- Chocolate Doom source\n/, '\n## verifiable evidence sources\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseOracleCapturePolicyDocument(corruptedDocumentText)).toThrow('verifiable evidence sources must list at least one source.');
  });

  test('parser surfaces a meaningful error when allowed oracle output roots is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## allowed oracle output roots\n\n- plan_vanilla_parity\/final-gates\/\n- test\/oracles\/fixtures\/\n- test\/vanilla_parity\/acceptance\/\n- test\/vanilla_parity\/oracles\/\n/,
      '\n## allowed oracle output roots\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseOracleCapturePolicyDocument(corruptedDocumentText)).toThrow('allowed oracle output roots must list at least one root.');
  });

  test('parser surfaces a meaningful error when oracle family identifiers is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## oracle family identifiers\n\n- OR-VP-001\n- OR-VP-002\n- OR-VP-003\n- OR-VP-004\n- OR-VP-005\n- OR-VP-006\n- OR-VP-007\n- OR-VP-008\n- OR-VP-009\n- OR-VP-010\n- OR-VP-011\n- OR-VP-012\n/,
      '\n## oracle family identifiers\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseOracleCapturePolicyDocument(corruptedDocumentText)).toThrow('oracle family identifiers must list at least one identifier.');
  });

  test('parser surfaces a meaningful error when oracle artifact required fields is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## oracle artifact required fields\n\n- id\n- stepId\n- stepTitle\n- lane\n/, '\n## oracle artifact required fields\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseOracleCapturePolicyDocument(corruptedDocumentText)).toThrow('oracle artifact required fields must list at least one field.');
  });
});
