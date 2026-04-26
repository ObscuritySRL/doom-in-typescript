import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const CONTROL_CENTER_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const FIRST_STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md';
const FINAL_GATE_STEP_FILE_PATH = 'plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/record-first-eligible-step-and-total-count.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-017-record-first-eligible-step-and-total-count.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_FIRST_ELIGIBLE_STEP_ID = '00-001';
const CANONICAL_FIRST_ELIGIBLE_STEP_SLUG = 'establish-vanilla-parity-control-center';
const CANONICAL_FIRST_ELIGIBLE_STEP_TITLE = 'Establish Vanilla Parity Control Center';
const CANONICAL_FIRST_ELIGIBLE_STEP_LANE = 'governance';
const CANONICAL_FIRST_ELIGIBLE_STEP_PREREQUISITE = 'none';
const CANONICAL_FIRST_ELIGIBLE_STEP_FILE_PATH = FIRST_STEP_FILE_PATH;
const CANONICAL_FIRST_ELIGIBLE_STEP_HEADING = `# [ ] STEP ${CANONICAL_FIRST_ELIGIBLE_STEP_ID}: ${CANONICAL_FIRST_ELIGIBLE_STEP_TITLE}`;
const CANONICAL_FIRST_ELIGIBLE_STEP_CHECKLIST_ROW = `- [x] \`${CANONICAL_FIRST_ELIGIBLE_STEP_ID}\` \`${CANONICAL_FIRST_ELIGIBLE_STEP_SLUG}\` | lane: \`${CANONICAL_FIRST_ELIGIBLE_STEP_LANE}\` | prereqs: \`${CANONICAL_FIRST_ELIGIBLE_STEP_PREREQUISITE}\` | file: \`${CANONICAL_FIRST_ELIGIBLE_STEP_FILE_PATH}\``;

const CANONICAL_TOTAL_STEP_COUNT = '398';

const CANONICAL_FINAL_GATE_STEP_ID = '13-004';
const CANONICAL_FINAL_GATE_STEP_SLUG = 'gate-full-final-side-by-side-proof';
const CANONICAL_FINAL_GATE_STEP_LANE = 'acceptance';
const CANONICAL_FINAL_GATE_STEP_FILE_PATH = FINAL_GATE_STEP_FILE_PATH;
const CANONICAL_FINAL_GATE_STEP_HEADING = `# [ ] STEP ${CANONICAL_FINAL_GATE_STEP_ID}: Gate Full Final Side By Side Proof`;
const CANONICAL_FINAL_GATE_STEP_PREREQUISITES = '02-035,03-036,04-030,05-028,06-032,07-034,08-032,09-038,10-028,11-031,12-028';
const CANONICAL_FINAL_GATE_STEP_CHECKLIST_ROW = `- [ ] \`${CANONICAL_FINAL_GATE_STEP_ID}\` \`${CANONICAL_FINAL_GATE_STEP_SLUG}\` | lane: \`${CANONICAL_FINAL_GATE_STEP_LANE}\` | prereqs: \`${CANONICAL_FINAL_GATE_STEP_PREREQUISITES}\` | file: \`${CANONICAL_FINAL_GATE_STEP_FILE_PATH}\``;

const CANONICAL_RUNTIME_TARGET = 'bun run doom.ts';

const CANONICAL_PINNED_CONSTANT_COUNT = 3;
const CANONICAL_PINNED_CONSTANTS: readonly string[] = ['EXPECTED_FIRST_STEP', 'EXPECTED_TOTAL_STEPS', 'FINAL_GATE_STEP_ID'];
const CANONICAL_EXPECTED_FIRST_STEP_VALUE = "'00-001'";
const CANONICAL_EXPECTED_TOTAL_STEPS_VALUE = '398';
const CANONICAL_FINAL_GATE_STEP_ID_VALUE = "'13-004'";

const CANONICAL_CHECKLIST_SUMMARY_DIAGNOSTIC_COUNT = 5;
const CANONICAL_CHECKLIST_SUMMARY_DIAGNOSTICS: readonly string[] = [
  'Checklist must declare total steps 398.',
  'Checklist must declare the first eligible vanilla parity step.',
  'Checklist must declare the bun run doom.ts runtime target.',
  'Checklist must contain 398 steps, got <count>.',
  'First parsed step must be 00-001.',
];

const CANONICAL_MASTER_CHECKLIST_REQUIRED_SUMMARY_LINE_COUNT = 4;
const CANONICAL_MASTER_CHECKLIST_REQUIRED_SUMMARY_LINES: readonly string[] = [
  '- Total steps: 398',
  '- First eligible step: `00-001 establish-vanilla-parity-control-center`',
  '- Runtime target: `bun run doom.ts`',
  '- Rule: choose the first unchecked step whose prerequisites are complete.',
];
const CANONICAL_MASTER_CHECKLIST_HEADING = '# Master Checklist';

const CANONICAL_README_REQUIRED_ANCHOR_COUNT = 3;
const CANONICAL_README_REQUIRED_ANCHORS: readonly string[] = ['- Active plan directory: `plan_vanilla_parity/`.', '- Total steps: `398`.', '- First eligible step: `00-001 establish-vanilla-parity-control-center`.'];

const CANONICAL_CONTROL_CENTER_ANCHOR_COUNT = 8;
const CANONICAL_CONTROL_CENTER_ANCHORS: readonly string[] = [
  '## total steps',
  '## first eligible step id',
  '## first eligible step slug',
  '## first eligible step file path',
  '## final gate step id',
  '## final gate step slug',
  '## final gate step file path',
  '## runtime target',
];

interface FirstEligibleStepAndTotalCountDocument {
  readonly acceptancePhrasing: string;
  readonly checklistSummaryDiagnosticCount: string;
  readonly checklistSummaryDiagnostics: readonly string[];
  readonly controlCenterAnchorCount: string;
  readonly controlCenterAnchors: readonly string[];
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly expectedFirstStepValue: string;
  readonly expectedTotalStepsValue: string;
  readonly finalGateStepCheckListRow: string;
  readonly finalGateStepFilePath: string;
  readonly finalGateStepHeading: string;
  readonly finalGateStepIdValue: string;
  readonly finalGateStepLane: string;
  readonly finalGateStepRule: string;
  readonly finalGateStepSlug: string;
  readonly firstEligibleStepChecklistRow: string;
  readonly firstEligibleStepFilePath: string;
  readonly firstEligibleStepHeading: string;
  readonly firstEligibleStepId: string;
  readonly firstEligibleStepLane: string;
  readonly firstEligibleStepPrerequisite: string;
  readonly firstEligibleStepRule: string;
  readonly firstEligibleStepSlug: string;
  readonly firstEligibleStepTitle: string;
  readonly masterChecklistHeading: string;
  readonly masterChecklistRequiredSummaryLineCount: string;
  readonly masterChecklistRequiredSummaryLines: readonly string[];
  readonly pinnedConstantCount: string;
  readonly pinnedConstants: readonly string[];
  readonly readmeRequiredAnchorCount: string;
  readonly readmeRequiredAnchors: readonly string[];
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly runtimeTarget: string;
  readonly runtimeTargetRule: string;
  readonly scopeName: string;
  readonly totalStepCount: string;
  readonly totalStepCountRule: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in first eligible step and total count document.`);
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
    .map((line) => line.slice(2).trim());
}

function parseFirstEligibleStepAndTotalCountDocument(documentText: string): FirstEligibleStepAndTotalCountDocument {
  const pinnedConstants = extractBullets(documentText, 'pinned constants');
  if (pinnedConstants.length === 0) {
    throw new Error('pinned constants must list at least one entry.');
  }

  const checklistSummaryDiagnostics = extractBullets(documentText, 'checklist summary diagnostics');
  if (checklistSummaryDiagnostics.length === 0) {
    throw new Error('checklist summary diagnostics must list at least one entry.');
  }

  const masterChecklistRequiredSummaryLines = extractBullets(documentText, 'master checklist required summary lines');
  if (masterChecklistRequiredSummaryLines.length === 0) {
    throw new Error('master checklist required summary lines must list at least one entry.');
  }

  const readmeRequiredAnchors = extractBullets(documentText, 'readme required anchors');
  if (readmeRequiredAnchors.length === 0) {
    throw new Error('readme required anchors must list at least one entry.');
  }

  const controlCenterAnchors = extractBullets(documentText, 'control center anchors');
  if (controlCenterAnchors.length === 0) {
    throw new Error('control center anchors must list at least one entry.');
  }

  const evidenceLocations = extractBullets(documentText, 'evidence locations');
  if (evidenceLocations.length === 0) {
    throw new Error('evidence locations must list at least one entry.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    checklistSummaryDiagnosticCount: extractSection(documentText, 'checklist summary diagnostic count'),
    checklistSummaryDiagnostics,
    controlCenterAnchorCount: extractSection(documentText, 'control center anchor count'),
    controlCenterAnchors,
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations,
    expectedFirstStepValue: extractSection(documentText, 'EXPECTED_FIRST_STEP value'),
    expectedTotalStepsValue: extractSection(documentText, 'EXPECTED_TOTAL_STEPS value'),
    finalGateStepCheckListRow: extractSection(documentText, 'final gate step checklist row'),
    finalGateStepFilePath: extractSection(documentText, 'final gate step file path'),
    finalGateStepHeading: extractSection(documentText, 'final gate step heading'),
    finalGateStepIdValue: extractSection(documentText, 'FINAL_GATE_STEP_ID value'),
    finalGateStepLane: extractSection(documentText, 'final gate step lane'),
    finalGateStepRule: extractSection(documentText, 'final gate step rule'),
    finalGateStepSlug: extractSection(documentText, 'final gate step slug'),
    firstEligibleStepChecklistRow: extractSection(documentText, 'first eligible step checklist row'),
    firstEligibleStepFilePath: extractSection(documentText, 'first eligible step file path'),
    firstEligibleStepHeading: extractSection(documentText, 'first eligible step heading'),
    firstEligibleStepId: extractSection(documentText, 'first eligible step id'),
    firstEligibleStepLane: extractSection(documentText, 'first eligible step lane'),
    firstEligibleStepPrerequisite: extractSection(documentText, 'first eligible step prerequisite'),
    firstEligibleStepRule: extractSection(documentText, 'first eligible step rule'),
    firstEligibleStepSlug: extractSection(documentText, 'first eligible step slug'),
    firstEligibleStepTitle: extractSection(documentText, 'first eligible step title'),
    masterChecklistHeading: extractSection(documentText, 'master checklist heading'),
    masterChecklistRequiredSummaryLineCount: extractSection(documentText, 'master checklist required summary line count'),
    masterChecklistRequiredSummaryLines,
    pinnedConstantCount: extractSection(documentText, 'pinned constant count'),
    pinnedConstants,
    readmeRequiredAnchorCount: extractSection(documentText, 'readme required anchor count'),
    readmeRequiredAnchors,
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    runtimeTarget: extractSection(documentText, 'runtime target'),
    runtimeTargetRule: extractSection(documentText, 'runtime target rule'),
    scopeName: extractSection(documentText, 'scope name'),
    totalStepCount: extractSection(documentText, 'total step count'),
    totalStepCountRule: extractSection(documentText, 'total step count rule'),
  };
}

async function loadFirstEligibleStepAndTotalCountDocument(): Promise<FirstEligibleStepAndTotalCountDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parseFirstEligibleStepAndTotalCountDocument(documentText);
}

describe('record first eligible step and total count declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 first eligible step and total count');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('first eligible step identity sections pin the canonical 00-001 governance step', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.firstEligibleStepId).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_ID);
    expect(parsed.firstEligibleStepSlug).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_SLUG);
    expect(parsed.firstEligibleStepTitle).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_TITLE);
    expect(parsed.firstEligibleStepLane).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_LANE);
    expect(parsed.firstEligibleStepPrerequisite).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_PREREQUISITE);
    expect(parsed.firstEligibleStepFilePath).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_FILE_PATH);
    expect(parsed.firstEligibleStepHeading).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_HEADING);
    expect(parsed.firstEligibleStepChecklistRow).toBe(CANONICAL_FIRST_ELIGIBLE_STEP_CHECKLIST_ROW);
  });

  test('total step count pins the canonical 398 declared by MASTER_CHECKLIST.md', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.totalStepCount).toBe(CANONICAL_TOTAL_STEP_COUNT);
  });

  test('final gate step identity sections pin the canonical 13-004 acceptance step', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.finalGateStepIdValue).toBe(`'${CANONICAL_FINAL_GATE_STEP_ID}'`);
    expect(parsed.finalGateStepSlug).toBe(CANONICAL_FINAL_GATE_STEP_SLUG);
    expect(parsed.finalGateStepLane).toBe(CANONICAL_FINAL_GATE_STEP_LANE);
    expect(parsed.finalGateStepFilePath).toBe(CANONICAL_FINAL_GATE_STEP_FILE_PATH);
    expect(parsed.finalGateStepHeading).toBe(CANONICAL_FINAL_GATE_STEP_HEADING);
    expect(parsed.finalGateStepCheckListRow).toBe(CANONICAL_FINAL_GATE_STEP_CHECKLIST_ROW);
  });

  test('runtime target pins the canonical bun run doom.ts command', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.runtimeTarget).toBe(CANONICAL_RUNTIME_TARGET);
  });

  test('pinned constants equal the canonical three entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.pinnedConstants).toEqual(CANONICAL_PINNED_CONSTANTS);
    expect(parsed.pinnedConstants).toHaveLength(CANONICAL_PINNED_CONSTANT_COUNT);
    expect(new Set(parsed.pinnedConstants).size).toBe(parsed.pinnedConstants.length);
    expect(parsed.pinnedConstantCount).toBe(String(CANONICAL_PINNED_CONSTANT_COUNT));
    const ascendingSortedConstants = [...parsed.pinnedConstants].sort();
    expect(parsed.pinnedConstants).toEqual(ascendingSortedConstants);
  });

  test('EXPECTED_FIRST_STEP value pins 00-001 to match the constant in validate-plan.ts', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.expectedFirstStepValue).toBe(CANONICAL_EXPECTED_FIRST_STEP_VALUE);
  });

  test('EXPECTED_TOTAL_STEPS value pins 398 to match the constant in validate-plan.ts', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.expectedTotalStepsValue).toBe(CANONICAL_EXPECTED_TOTAL_STEPS_VALUE);
  });

  test('FINAL_GATE_STEP_ID value pins 13-004 to match the constant in validate-plan.ts', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.finalGateStepIdValue).toBe(CANONICAL_FINAL_GATE_STEP_ID_VALUE);
  });

  test('checklist summary diagnostics equal the canonical five verbatim entries with no duplicates', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.checklistSummaryDiagnostics).toEqual(CANONICAL_CHECKLIST_SUMMARY_DIAGNOSTICS);
    expect(parsed.checklistSummaryDiagnostics).toHaveLength(CANONICAL_CHECKLIST_SUMMARY_DIAGNOSTIC_COUNT);
    expect(new Set(parsed.checklistSummaryDiagnostics).size).toBe(parsed.checklistSummaryDiagnostics.length);
    expect(parsed.checklistSummaryDiagnosticCount).toBe(String(CANONICAL_CHECKLIST_SUMMARY_DIAGNOSTIC_COUNT));
  });

  test('master checklist required summary lines equal the canonical four verbatim entries with no duplicates', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.masterChecklistRequiredSummaryLines).toEqual(CANONICAL_MASTER_CHECKLIST_REQUIRED_SUMMARY_LINES);
    expect(parsed.masterChecklistRequiredSummaryLines).toHaveLength(CANONICAL_MASTER_CHECKLIST_REQUIRED_SUMMARY_LINE_COUNT);
    expect(new Set(parsed.masterChecklistRequiredSummaryLines).size).toBe(parsed.masterChecklistRequiredSummaryLines.length);
    expect(parsed.masterChecklistRequiredSummaryLineCount).toBe(String(CANONICAL_MASTER_CHECKLIST_REQUIRED_SUMMARY_LINE_COUNT));
    expect(parsed.masterChecklistHeading).toBe(CANONICAL_MASTER_CHECKLIST_HEADING);
  });

  test('readme required anchors equal the canonical three verbatim entries with no duplicates', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.readmeRequiredAnchors).toEqual(CANONICAL_README_REQUIRED_ANCHORS);
    expect(parsed.readmeRequiredAnchors).toHaveLength(CANONICAL_README_REQUIRED_ANCHOR_COUNT);
    expect(new Set(parsed.readmeRequiredAnchors).size).toBe(parsed.readmeRequiredAnchors.length);
    expect(parsed.readmeRequiredAnchorCount).toBe(String(CANONICAL_README_REQUIRED_ANCHOR_COUNT));
  });

  test('control center anchors equal the canonical eight section headings with no duplicates', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.controlCenterAnchors).toEqual(CANONICAL_CONTROL_CENTER_ANCHORS);
    expect(parsed.controlCenterAnchors).toHaveLength(CANONICAL_CONTROL_CENTER_ANCHOR_COUNT);
    expect(new Set(parsed.controlCenterAnchors).size).toBe(parsed.controlCenterAnchors.length);
    expect(parsed.controlCenterAnchorCount).toBe(String(CANONICAL_CONTROL_CENTER_ANCHOR_COUNT));
  });

  test('first eligible step rule names the canonical lane-selection invariants', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.firstEligibleStepRule).toContain(CANONICAL_FIRST_ELIGIBLE_STEP_ID);
    expect(parsed.firstEligibleStepRule).toContain(CANONICAL_FIRST_ELIGIBLE_STEP_SLUG);
    expect(parsed.firstEligibleStepRule).toContain('prerequisite `none`');
    expect(parsed.firstEligibleStepRule).toContain('Phase 00: Governance / Plan Foundation');
    expect(parsed.firstEligibleStepRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.firstEligibleStepRule).toContain('plan_vanilla_parity/PROMPT.md');
    expect(parsed.firstEligibleStepRule).toContain('first unchecked');
  });

  test('total step count rule names the canonical 398 invariant in three anchors', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.totalStepCountRule).toContain(CANONICAL_TOTAL_STEP_COUNT);
    expect(parsed.totalStepCountRule).toContain('CHECKLIST_LINE_PATTERN');
    expect(parsed.totalStepCountRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.totalStepCountRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.totalStepCountRule).toContain('plan_vanilla_parity/README.md');
    expect(parsed.totalStepCountRule).toContain('EXPECTED_TOTAL_STEPS = 398');
    expect(parsed.totalStepCountRule).toContain('validateChecklistSummary');
  });

  test('final gate step rule names the canonical 13-004 acceptance invariants', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.finalGateStepRule).toContain(CANONICAL_FINAL_GATE_STEP_ID);
    expect(parsed.finalGateStepRule).toContain('FINAL_GATE_STEP_ID');
    expect(parsed.finalGateStepRule).toContain(CANONICAL_FINAL_GATE_STEP_LANE);
    expect(parsed.finalGateStepRule).toContain('Phase 13: Final Proof / Handoff');
    expect(parsed.finalGateStepRule).toContain('PARALLEL_WORK.md');
    expect(parsed.finalGateStepRule).toContain('G6');
    expect(parsed.finalGateStepRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.finalGateStepRule).toContain('02-035');
    expect(parsed.finalGateStepRule).toContain('12-028');
  });

  test('runtime target rule names the canonical bun run doom.ts invariant in three anchors', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.runtimeTargetRule).toContain(CANONICAL_RUNTIME_TARGET);
    expect(parsed.runtimeTargetRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.runtimeTargetRule).toContain('plan_vanilla_parity/establish-vanilla-parity-control-center.md');
    expect(parsed.runtimeTargetRule).toContain('Checklist must declare the bun run doom.ts runtime target.');
    expect(parsed.runtimeTargetRule).toContain('plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.md');
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, the master checklist, the README, the control-center pin, the first and final gate step files, the validate-plan helper plus its test, and this step file', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      CONTROL_CENTER_PATH,
      FINAL_GATE_STEP_FILE_PATH,
      FIRST_STEP_FILE_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      STEP_FILE_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity MASTER_CHECKLIST.md declares every canonical required summary line under the canonical heading', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    expect(checklistText.startsWith(CANONICAL_MASTER_CHECKLIST_HEADING)).toBe(true);
    for (const requiredSummaryLine of CANONICAL_MASTER_CHECKLIST_REQUIRED_SUMMARY_LINES) {
      expect(checklistText).toContain(requiredSummaryLine);
    }
  });

  test('plan_vanilla_parity MASTER_CHECKLIST.md anchors the canonical first eligible step row', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    expect(checklistText).toContain(CANONICAL_FIRST_ELIGIBLE_STEP_CHECKLIST_ROW);
  });

  test('plan_vanilla_parity MASTER_CHECKLIST.md anchors the canonical final gate step row', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    expect(checklistText).toContain(CANONICAL_FINAL_GATE_STEP_CHECKLIST_ROW);
  });

  test('plan_vanilla_parity README.md anchors every canonical required README anchor', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    for (const requiredAnchor of CANONICAL_README_REQUIRED_ANCHORS) {
      expect(readmeText).toContain(requiredAnchor);
    }
  });

  test('plan_vanilla_parity establish-vanilla-parity-control-center.md anchors every canonical control-center section heading and pins the canonical literal values', async () => {
    const controlCenterText = await Bun.file(CONTROL_CENTER_PATH).text();
    for (const controlCenterAnchor of CANONICAL_CONTROL_CENTER_ANCHORS) {
      expect(controlCenterText).toContain(`\n${controlCenterAnchor}\n`);
    }
    expect(controlCenterText).toContain(`\n## total steps\n\n${CANONICAL_TOTAL_STEP_COUNT}\n`);
    expect(controlCenterText).toContain(`\n## first eligible step id\n\n${CANONICAL_FIRST_ELIGIBLE_STEP_ID}\n`);
    expect(controlCenterText).toContain(`\n## first eligible step slug\n\n${CANONICAL_FIRST_ELIGIBLE_STEP_SLUG}\n`);
    expect(controlCenterText).toContain(`\n## first eligible step file path\n\n${CANONICAL_FIRST_ELIGIBLE_STEP_FILE_PATH}\n`);
    expect(controlCenterText).toContain(`\n## final gate step id\n\n${CANONICAL_FINAL_GATE_STEP_ID}\n`);
    expect(controlCenterText).toContain(`\n## final gate step slug\n\n${CANONICAL_FINAL_GATE_STEP_SLUG}\n`);
    expect(controlCenterText).toContain(`\n## final gate step file path\n\n${CANONICAL_FINAL_GATE_STEP_FILE_PATH}\n`);
    expect(controlCenterText).toContain(`\n## runtime target\n\n${CANONICAL_RUNTIME_TARGET}\n`);
  });

  test('plan_vanilla_parity validate-plan.ts pins every canonical constant with the canonical literal value', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain(`const EXPECTED_FIRST_STEP = ${CANONICAL_EXPECTED_FIRST_STEP_VALUE};`);
    expect(validatePlanText).toContain(`const EXPECTED_TOTAL_STEPS = ${CANONICAL_EXPECTED_TOTAL_STEPS_VALUE};`);
    expect(validatePlanText).toContain(`const FINAL_GATE_STEP_ID = ${CANONICAL_FINAL_GATE_STEP_ID_VALUE};`);
  });

  test('plan_vanilla_parity validate-plan.ts emits every canonical checklist summary diagnostic verbatim', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('Checklist must declare total steps ${EXPECTED_TOTAL_STEPS}.');
    expect(validatePlanText).toContain('Checklist must declare the first eligible vanilla parity step.');
    expect(validatePlanText).toContain('Checklist must declare the bun run doom.ts runtime target.');
    expect(validatePlanText).toContain('Checklist must contain ${EXPECTED_TOTAL_STEPS} steps, got ${checklistSteps.length}.');
    expect(validatePlanText).toContain('First parsed step must be ${EXPECTED_FIRST_STEP}.');
  });

  test('plan_vanilla_parity steps/00-001 file declares the canonical first eligible step heading, id, lane, and title', async () => {
    expect(existsSync(FIRST_STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(FIRST_STEP_FILE_PATH).text();
    expect(stepText.startsWith(CANONICAL_FIRST_ELIGIBLE_STEP_HEADING)).toBe(true);
    expect(stepText).toContain(`\n## id\n\n${CANONICAL_FIRST_ELIGIBLE_STEP_ID}\n`);
    expect(stepText).toContain(`\n## lane\n\n${CANONICAL_FIRST_ELIGIBLE_STEP_LANE}\n`);
    expect(stepText).toContain(`\n## title\n\n${CANONICAL_FIRST_ELIGIBLE_STEP_TITLE}\n`);
  });

  test('plan_vanilla_parity steps/13-004 file declares the canonical final gate step heading, id, lane, and title', async () => {
    expect(existsSync(FINAL_GATE_STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(FINAL_GATE_STEP_FILE_PATH).text();
    expect(stepText.startsWith(CANONICAL_FINAL_GATE_STEP_HEADING)).toBe(true);
    expect(stepText).toContain(`\n## id\n\n${CANONICAL_FINAL_GATE_STEP_ID}\n`);
    expect(stepText).toContain(`\n## lane\n\n${CANONICAL_FINAL_GATE_STEP_LANE}\n`);
  });

  test('CLAUDE.md anchors the Bun runtime line that motivates the canonical bun run doom.ts runtime target', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Bun only.');
    expect(claudeText).toContain('bun run doom.ts');
  });

  test('AGENTS.md anchors the local-only publishing authority that motivates the no-fabrication invariants this contract pins', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('No fabrication');
  });

  test('plan_vanilla_parity PROMPT.md anchors the lane-selection rule that picks the first unchecked step in the assigned lane', async () => {
    const promptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(promptText).toContain('first unchecked step');
    expect(promptText).toContain('lane');
    expect(promptText).toContain('plan_vanilla_parity');
  });

  test('step 00-017 file declares the governance lane, lists this contract under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-017: Record First Eligible Step And Total Count');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/record-first-eligible-step-and-total-count.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/record-first-eligible-step-and-total-count.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-017 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-017` `record-first-eligible-step-and-total-count` | lane: `governance` | prereqs: `00-016` | file: `plan_vanilla_parity/steps/00-017-record-first-eligible-step-and-total-count.md`';
    const expectedCompletedRow = '- [x] `00-017` `record-first-eligible-step-and-total-count` | lane: `governance` | prereqs: `00-016` | file: `plan_vanilla_parity/steps/00-017-record-first-eligible-step-and-total-count.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names every canonical pinned constant with its literal value plus every canonical first eligible step and final gate step anchor', async () => {
    const parsed = await loadFirstEligibleStepAndTotalCountDocument();
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FIRST_ELIGIBLE_STEP_ID} ${CANONICAL_FIRST_ELIGIBLE_STEP_SLUG}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FIRST_ELIGIBLE_STEP_LANE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FIRST_ELIGIBLE_STEP_PREREQUISITE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FIRST_ELIGIBLE_STEP_FILE_PATH}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_TOTAL_STEP_COUNT}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FINAL_GATE_STEP_ID} ${CANONICAL_FINAL_GATE_STEP_SLUG}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FINAL_GATE_STEP_LANE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FINAL_GATE_STEP_FILE_PATH}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_RUNTIME_TARGET}\``);
    expect(parsed.acceptancePhrasing).toContain(`EXPECTED_FIRST_STEP = ${CANONICAL_EXPECTED_FIRST_STEP_VALUE}`);
    expect(parsed.acceptancePhrasing).toContain(`EXPECTED_TOTAL_STEPS = ${CANONICAL_EXPECTED_TOTAL_STEPS_VALUE}`);
    expect(parsed.acceptancePhrasing).toContain(`FINAL_GATE_STEP_ID = ${CANONICAL_FINAL_GATE_STEP_ID_VALUE}`);
    for (const checklistSummaryDiagnostic of CANONICAL_CHECKLIST_SUMMARY_DIAGNOSTICS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${checklistSummaryDiagnostic}\``);
    }
    for (const controlCenterAnchor of CANONICAL_CONTROL_CENTER_ANCHORS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${controlCenterAnchor}\``);
    }
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 first eligible step and total count\n';
    expect(() => parseFirstEligibleStepAndTotalCountDocument(documentTextWithMissingSection)).toThrow('Section "pinned constants" not found in first eligible step and total count document.');
  });

  test('parser surfaces a meaningful error when pinned constants is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## pinned constants\n\n- EXPECTED_FIRST_STEP\n- EXPECTED_TOTAL_STEPS\n- FINAL_GATE_STEP_ID\n/, '\n## pinned constants\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFirstEligibleStepAndTotalCountDocument(corruptedDocumentText)).toThrow('pinned constants must list at least one entry.');
  });

  test('parser surfaces a meaningful error when checklist summary diagnostics is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## checklist summary diagnostics\n\n- Checklist must declare total steps 398\.\n- Checklist must declare the first eligible vanilla parity step\.\n- Checklist must declare the bun run doom\.ts runtime target\.\n- Checklist must contain 398 steps, got <count>\.\n- First parsed step must be 00-001\.\n/,
      '\n## checklist summary diagnostics\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFirstEligibleStepAndTotalCountDocument(corruptedDocumentText)).toThrow('checklist summary diagnostics must list at least one entry.');
  });

  test('parser surfaces a meaningful error when master checklist required summary lines is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## master checklist required summary lines\n\n- - Total steps: 398\n- - First eligible step: `00-001 establish-vanilla-parity-control-center`\n- - Runtime target: `bun run doom\.ts`\n- - Rule: choose the first unchecked step whose prerequisites are complete\.\n/,
      '\n## master checklist required summary lines\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFirstEligibleStepAndTotalCountDocument(corruptedDocumentText)).toThrow('master checklist required summary lines must list at least one entry.');
  });

  test('parser surfaces a meaningful error when readme required anchors is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## readme required anchors\n\n- - Active plan directory: `plan_vanilla_parity\/`\.\n- - Total steps: `398`\.\n- - First eligible step: `00-001 establish-vanilla-parity-control-center`\.\n/,
      '\n## readme required anchors\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFirstEligibleStepAndTotalCountDocument(corruptedDocumentText)).toThrow('readme required anchors must list at least one entry.');
  });

  test('parser surfaces a meaningful error when control center anchors is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## control center anchors\n\n- ## total steps\n- ## first eligible step id\n- ## first eligible step slug\n- ## first eligible step file path\n- ## final gate step id\n- ## final gate step slug\n- ## final gate step file path\n- ## runtime target\n/,
      '\n## control center anchors\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseFirstEligibleStepAndTotalCountDocument(corruptedDocumentText)).toThrow('control center anchors must list at least one entry.');
  });
});
