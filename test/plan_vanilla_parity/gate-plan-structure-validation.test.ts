import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import { PLAN_VALIDATION_COMMAND, parseChecklist, runValidationCli, validatePlan } from '../../plan_vanilla_parity/validate-plan.ts';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const CONTROL_CENTER_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const FIRST_STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md';
const GATE_DOCUMENT_PATH = 'plan_vanilla_parity/gate-plan-structure-validation.md';
const GATE_STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const RECORD_FIRST_ELIGIBLE_PATH = 'plan_vanilla_parity/record-first-eligible-step-and-total-count.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_GATE_ID = '00-018';
const CANONICAL_GATE_SLUG = 'gate-plan-structure-validation';
const CANONICAL_GATE_TITLE = 'Gate Plan Structure Validation';
const CANONICAL_GATE_LANE = 'governance';
const CANONICAL_GATE_PHASE = 'Phase 00: Governance / Plan Foundation';
const CANONICAL_GATE_PREREQUISITE = '00-017';
const CANONICAL_GATE_FILE_PATH = GATE_STEP_FILE_PATH;
const CANONICAL_GATE_HEADING = `# [ ] STEP ${CANONICAL_GATE_ID}: ${CANONICAL_GATE_TITLE}`;
const CANONICAL_GATE_CHECKLIST_ROW_PENDING = `- [ ] \`${CANONICAL_GATE_ID}\` \`${CANONICAL_GATE_SLUG}\` | lane: \`${CANONICAL_GATE_LANE}\` | prereqs: \`${CANONICAL_GATE_PREREQUISITE}\` | file: \`${CANONICAL_GATE_FILE_PATH}\``;
const CANONICAL_GATE_CHECKLIST_ROW_COMPLETED = `- [x] \`${CANONICAL_GATE_ID}\` \`${CANONICAL_GATE_SLUG}\` | lane: \`${CANONICAL_GATE_LANE}\` | prereqs: \`${CANONICAL_GATE_PREREQUISITE}\` | file: \`${CANONICAL_GATE_FILE_PATH}\``;

const CANONICAL_MERGE_CHECKPOINT_LABEL = 'G0';
const CANONICAL_MERGE_CHECKPOINT_DESCRIPTION = 'plan validation';
const CANONICAL_MERGE_CHECKPOINT_SOURCE = 'plan_vanilla_parity/PARALLEL_WORK.md';
const CANONICAL_MERGE_CHECKPOINT_SEQUENCE = 'G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof.';

const CANONICAL_PLAN_VALIDATION_SCRIPT_PATH = 'plan_vanilla_parity/validate-plan.ts';
const CANONICAL_PLAN_VALIDATION_SCRIPT_COMMAND = 'bun run plan_vanilla_parity/validate-plan.ts';
const CANONICAL_PLAN_VALIDATION_FOCUSED_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';
const CANONICAL_PLAN_VALIDATION_FOCUSED_TEST_COMMAND = 'bun test plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_PRE_GATE_VERIFICATION_COMMAND_COUNT = 5;
const CANONICAL_PRE_GATE_VERIFICATION_COMMANDS: readonly string[] = [
  'bun run format',
  'bun test plan_vanilla_parity/validate-plan.test.ts',
  'bun run plan_vanilla_parity/validate-plan.ts',
  'bun test',
  'bun x tsc --noEmit --project tsconfig.json',
];

const CANONICAL_CLI_SUCCESS_EXIT_CODE = '0';
const CANONICAL_CLI_FAILURE_EXIT_CODE = '1';
const CANONICAL_CLI_SUCCESS_STDOUT_LINE = 'Validated 398 vanilla parity steps. First step: 00-001.';
const CANONICAL_CLI_FAILURE_STDERR_LINE_SHAPE = '<file>: <message>';

const CANONICAL_ZERO_ERROR_INVARIANT = 'result.errors.length === 0';
const CANONICAL_FIRST_PARSED_STEP_ID = '00-001';
const CANONICAL_TOTAL_PARSED_STEP_COUNT = '398';
const CANONICAL_EXPECTED_VALIDATE_PLAN_RESULT = "{ errors: [], firstStep: '00-001', totalSteps: 398 }";

const CANONICAL_VALIDATE_PLAN_HELPER_EXPORT_COUNT = 4;
const CANONICAL_VALIDATE_PLAN_HELPER_EXPORTS: readonly string[] = ['PLAN_VALIDATION_COMMAND', 'parseChecklist', 'runValidationCli', 'validatePlan'];

const CANONICAL_VALIDATE_PLAN_RESULT_FIELD_COUNT = 3;
const CANONICAL_VALIDATE_PLAN_RESULT_FIELDS: readonly string[] = ['errors', 'firstStep', 'totalSteps'];

const CANONICAL_DOWNSTREAM_DEPENDENT_COUNT = 114;

interface GatePlanStructureValidationDocument {
  readonly acceptancePhrasing: string;
  readonly cliFailureExitCode: string;
  readonly cliFailureStderrLineShape: string;
  readonly cliSuccessExitCode: string;
  readonly cliSuccessStdoutLine: string;
  readonly downstreamDependentCount: string;
  readonly downstreamDependentRule: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly expectedValidatePlanResult: string;
  readonly firstParsedStepId: string;
  readonly gateBlockingRule: string;
  readonly gateChecklistRowCompleted: string;
  readonly gateChecklistRowPending: string;
  readonly gateFilePath: string;
  readonly gateHeading: string;
  readonly gateId: string;
  readonly gateLane: string;
  readonly gatePassingRule: string;
  readonly gatePhase: string;
  readonly gatePrerequisite: string;
  readonly gateSlug: string;
  readonly gateTitle: string;
  readonly mergeCheckpointDescription: string;
  readonly mergeCheckpointLabel: string;
  readonly mergeCheckpointSequence: string;
  readonly mergeCheckpointSource: string;
  readonly noSkipRule: string;
  readonly planValidationFocusedTestCommand: string;
  readonly planValidationFocusedTestPath: string;
  readonly planValidationScriptCommand: string;
  readonly planValidationScriptPath: string;
  readonly preGateVerificationCommandCount: string;
  readonly preGateVerificationCommands: readonly string[];
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly scopeName: string;
  readonly totalParsedStepCount: string;
  readonly validatePlanHelperExportCount: string;
  readonly validatePlanHelperExports: readonly string[];
  readonly validatePlanResultFieldCount: string;
  readonly validatePlanResultFields: readonly string[];
  readonly zeroErrorInvariant: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in gate plan structure validation document.`);
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

function parseGatePlanStructureValidationDocument(documentText: string): GatePlanStructureValidationDocument {
  const preGateVerificationCommands = extractBullets(documentText, 'pre-gate verification commands');
  if (preGateVerificationCommands.length === 0) {
    throw new Error('pre-gate verification commands must list at least one entry.');
  }

  const validatePlanHelperExports = extractBullets(documentText, 'validate plan helper exports');
  if (validatePlanHelperExports.length === 0) {
    throw new Error('validate plan helper exports must list at least one entry.');
  }

  const validatePlanResultFields = extractBullets(documentText, 'validate plan result fields');
  if (validatePlanResultFields.length === 0) {
    throw new Error('validate plan result fields must list at least one entry.');
  }

  const evidenceLocations = extractBullets(documentText, 'evidence locations');
  if (evidenceLocations.length === 0) {
    throw new Error('evidence locations must list at least one entry.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    cliFailureExitCode: extractSection(documentText, 'cli failure exit code'),
    cliFailureStderrLineShape: extractSection(documentText, 'cli failure stderr line shape'),
    cliSuccessExitCode: extractSection(documentText, 'cli success exit code'),
    cliSuccessStdoutLine: extractSection(documentText, 'cli success stdout line'),
    downstreamDependentCount: extractSection(documentText, 'downstream dependent count'),
    downstreamDependentRule: extractSection(documentText, 'downstream dependent rule'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations,
    expectedValidatePlanResult: extractSection(documentText, 'expected validate plan result'),
    firstParsedStepId: extractSection(documentText, 'first parsed step id'),
    gateBlockingRule: extractSection(documentText, 'gate blocking rule'),
    gateChecklistRowCompleted: extractSection(documentText, 'gate checklist row completed'),
    gateChecklistRowPending: extractSection(documentText, 'gate checklist row pending'),
    gateFilePath: extractSection(documentText, 'gate file path'),
    gateHeading: extractSection(documentText, 'gate heading'),
    gateId: extractSection(documentText, 'gate id'),
    gateLane: extractSection(documentText, 'gate lane'),
    gatePassingRule: extractSection(documentText, 'gate passing rule'),
    gatePhase: extractSection(documentText, 'gate phase'),
    gatePrerequisite: extractSection(documentText, 'gate prerequisite'),
    gateSlug: extractSection(documentText, 'gate slug'),
    gateTitle: extractSection(documentText, 'gate title'),
    mergeCheckpointDescription: extractSection(documentText, 'merge checkpoint description'),
    mergeCheckpointLabel: extractSection(documentText, 'merge checkpoint label'),
    mergeCheckpointSequence: extractSection(documentText, 'merge checkpoint sequence'),
    mergeCheckpointSource: extractSection(documentText, 'merge checkpoint source'),
    noSkipRule: extractSection(documentText, 'no skip rule'),
    planValidationFocusedTestCommand: extractSection(documentText, 'plan validation focused test command'),
    planValidationFocusedTestPath: extractSection(documentText, 'plan validation focused test path'),
    planValidationScriptCommand: extractSection(documentText, 'plan validation script command'),
    planValidationScriptPath: extractSection(documentText, 'plan validation script path'),
    preGateVerificationCommandCount: extractSection(documentText, 'pre-gate verification command count'),
    preGateVerificationCommands,
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    scopeName: extractSection(documentText, 'scope name'),
    totalParsedStepCount: extractSection(documentText, 'total parsed step count'),
    validatePlanHelperExportCount: extractSection(documentText, 'validate plan helper export count'),
    validatePlanHelperExports,
    validatePlanResultFieldCount: extractSection(documentText, 'validate plan result field count'),
    validatePlanResultFields,
    zeroErrorInvariant: extractSection(documentText, 'zero error invariant'),
  };
}

async function loadGatePlanStructureValidationDocument(): Promise<GatePlanStructureValidationDocument> {
  const documentText = await Bun.file(GATE_DOCUMENT_PATH).text();
  return parseGatePlanStructureValidationDocument(documentText);
}

describe('gate plan structure validation declaration', () => {
  test('gate document exists at the canonical path and is a file', () => {
    expect(existsSync(GATE_DOCUMENT_PATH)).toBe(true);
    expect(statSync(GATE_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 plan structure validation gate');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('gate identity sections pin the canonical 00-018 governance gate', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.gateId).toBe(CANONICAL_GATE_ID);
    expect(parsed.gateSlug).toBe(CANONICAL_GATE_SLUG);
    expect(parsed.gateTitle).toBe(CANONICAL_GATE_TITLE);
    expect(parsed.gateLane).toBe(CANONICAL_GATE_LANE);
    expect(parsed.gatePhase).toBe(CANONICAL_GATE_PHASE);
    expect(parsed.gatePrerequisite).toBe(CANONICAL_GATE_PREREQUISITE);
    expect(parsed.gateFilePath).toBe(CANONICAL_GATE_FILE_PATH);
    expect(parsed.gateHeading).toBe(CANONICAL_GATE_HEADING);
    expect(parsed.gateChecklistRowPending).toBe(CANONICAL_GATE_CHECKLIST_ROW_PENDING);
    expect(parsed.gateChecklistRowCompleted).toBe(CANONICAL_GATE_CHECKLIST_ROW_COMPLETED);
  });

  test('merge checkpoint sections pin the canonical G0 plan validation label, description, source, and sequence', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.mergeCheckpointLabel).toBe(CANONICAL_MERGE_CHECKPOINT_LABEL);
    expect(parsed.mergeCheckpointDescription).toBe(CANONICAL_MERGE_CHECKPOINT_DESCRIPTION);
    expect(parsed.mergeCheckpointSource).toBe(CANONICAL_MERGE_CHECKPOINT_SOURCE);
    expect(parsed.mergeCheckpointSequence).toBe(CANONICAL_MERGE_CHECKPOINT_SEQUENCE);
  });

  test('plan validation script and focused test sections pin the canonical paths and commands', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.planValidationScriptPath).toBe(CANONICAL_PLAN_VALIDATION_SCRIPT_PATH);
    expect(parsed.planValidationScriptCommand).toBe(CANONICAL_PLAN_VALIDATION_SCRIPT_COMMAND);
    expect(parsed.planValidationFocusedTestPath).toBe(CANONICAL_PLAN_VALIDATION_FOCUSED_TEST_PATH);
    expect(parsed.planValidationFocusedTestCommand).toBe(CANONICAL_PLAN_VALIDATION_FOCUSED_TEST_COMMAND);
  });

  test('pre-gate verification commands equal the canonical five entries in canonical fixed order with no duplicates', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.preGateVerificationCommands).toEqual(CANONICAL_PRE_GATE_VERIFICATION_COMMANDS);
    expect(parsed.preGateVerificationCommands).toHaveLength(CANONICAL_PRE_GATE_VERIFICATION_COMMAND_COUNT);
    expect(new Set(parsed.preGateVerificationCommands).size).toBe(parsed.preGateVerificationCommands.length);
    expect(parsed.preGateVerificationCommandCount).toBe(String(CANONICAL_PRE_GATE_VERIFICATION_COMMAND_COUNT));
  });

  test('cli exit codes pin 0 on success and 1 on failure', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.cliSuccessExitCode).toBe(CANONICAL_CLI_SUCCESS_EXIT_CODE);
    expect(parsed.cliFailureExitCode).toBe(CANONICAL_CLI_FAILURE_EXIT_CODE);
  });

  test('cli success stdout line and failure stderr line shape pin the canonical literals', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.cliSuccessStdoutLine).toBe(CANONICAL_CLI_SUCCESS_STDOUT_LINE);
    expect(parsed.cliFailureStderrLineShape).toBe(CANONICAL_CLI_FAILURE_STDERR_LINE_SHAPE);
  });

  test('zero-error invariant section pins the canonical result.errors.length expression', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.zeroErrorInvariant).toBe(CANONICAL_ZERO_ERROR_INVARIANT);
  });

  test('first parsed step id and total parsed step count sections pin the canonical values matching validate-plan.ts', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.firstParsedStepId).toBe(CANONICAL_FIRST_PARSED_STEP_ID);
    expect(parsed.totalParsedStepCount).toBe(CANONICAL_TOTAL_PARSED_STEP_COUNT);
  });

  test('expected validate plan result section pins the canonical literal object shape', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.expectedValidatePlanResult).toBe(CANONICAL_EXPECTED_VALIDATE_PLAN_RESULT);
  });

  test('validate plan helper exports equal the canonical four entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.validatePlanHelperExports).toEqual(CANONICAL_VALIDATE_PLAN_HELPER_EXPORTS);
    expect(parsed.validatePlanHelperExports).toHaveLength(CANONICAL_VALIDATE_PLAN_HELPER_EXPORT_COUNT);
    expect(new Set(parsed.validatePlanHelperExports).size).toBe(parsed.validatePlanHelperExports.length);
    expect(parsed.validatePlanHelperExportCount).toBe(String(CANONICAL_VALIDATE_PLAN_HELPER_EXPORT_COUNT));
    const ascendingSortedHelpers = [...parsed.validatePlanHelperExports].sort();
    expect(parsed.validatePlanHelperExports).toEqual(ascendingSortedHelpers);
  });

  test('validate plan result fields equal the canonical three entries in canonical order with no duplicates', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.validatePlanResultFields).toEqual(CANONICAL_VALIDATE_PLAN_RESULT_FIELDS);
    expect(parsed.validatePlanResultFields).toHaveLength(CANONICAL_VALIDATE_PLAN_RESULT_FIELD_COUNT);
    expect(new Set(parsed.validatePlanResultFields).size).toBe(parsed.validatePlanResultFields.length);
    expect(parsed.validatePlanResultFieldCount).toBe(String(CANONICAL_VALIDATE_PLAN_RESULT_FIELD_COUNT));
  });

  test('downstream dependent count and rule pin the canonical 114 dependent rows invariant', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.downstreamDependentCount).toBe(String(CANONICAL_DOWNSTREAM_DEPENDENT_COUNT));
    expect(parsed.downstreamDependentRule).toContain('114');
    expect(parsed.downstreamDependentRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.downstreamDependentRule).toContain('00-018');
    expect(parsed.downstreamDependentRule).toContain('prereqs');
  });

  test('gate passing rule names every canonical gate-clearing condition', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.gatePassingRule).toContain('clean repository state');
    expect(parsed.gatePassingRule).toContain('plan_vanilla_parity/');
    for (const verificationCommand of CANONICAL_PRE_GATE_VERIFICATION_COMMANDS) {
      expect(parsed.gatePassingRule).toContain(verificationCommand);
    }
    expect(parsed.gatePassingRule).toContain(CANONICAL_CLI_SUCCESS_STDOUT_LINE);
    expect(parsed.gatePassingRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.gatePassingRule).toContain('validatePlan()');
    expect(parsed.gatePassingRule).toContain(CANONICAL_EXPECTED_VALIDATE_PLAN_RESULT);
  });

  test('gate blocking rule names every canonical gate-failure trigger', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.gateBlockingRule).toContain('non-zero exit code');
    expect(parsed.gateBlockingRule).toContain('stderr');
    expect(parsed.gateBlockingRule).toContain('result.errors');
    expect(parsed.gateBlockingRule).toContain('result.firstStep');
    expect(parsed.gateBlockingRule).toContain('result.totalSteps');
    expect(parsed.gateBlockingRule).toContain(CANONICAL_FIRST_PARSED_STEP_ID);
    expect(parsed.gateBlockingRule).toContain(CANONICAL_TOTAL_PARSED_STEP_COUNT);
    expect(parsed.gateBlockingRule).toContain(CANONICAL_CLI_SUCCESS_STDOUT_LINE);
    expect(parsed.gateBlockingRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
  });

  test('no skip rule names the canonical lane-selection invariants that block dependents while the gate is unchecked', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.noSkipRule).toContain(CANONICAL_GATE_ID);
    expect(parsed.noSkipRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.noSkipRule).toContain('plan_vanilla_parity/PROMPT.md');
    expect(parsed.noSkipRule).toContain('first unchecked');
    expect(parsed.noSkipRule).toContain('all-`[x]`');
    expect(parsed.noSkipRule).toContain('inventory');
    expect(parsed.noSkipRule).toContain('oracle');
    expect(parsed.noSkipRule).toContain('launch');
    expect(parsed.noSkipRule).toContain('core');
    expect(parsed.noSkipRule).toContain('wad');
    expect(parsed.noSkipRule).toContain('acceptance');
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, the master checklist, the parallel work table, the prompt, the README, the control-center pin, the first eligible step pin, the first eligible step file, the gate step file, the validate-plan helper, and the validate-plan focused test', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      CONTROL_CENTER_PATH,
      FIRST_STEP_FILE_PATH,
      GATE_STEP_FILE_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      RECORD_FIRST_ELIGIBLE_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity MASTER_CHECKLIST.md anchors the canonical 00-018 gate row in either pending or completed form', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    expect(checklistText.includes(CANONICAL_GATE_CHECKLIST_ROW_PENDING) || checklistText.includes(CANONICAL_GATE_CHECKLIST_ROW_COMPLETED)).toBe(true);
  });

  test('plan_vanilla_parity MASTER_CHECKLIST.md declares exactly 114 downstream rows whose prereqs column reads `00-018`', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const lines = checklistText.split(/\r?\n/);
    const dependentLines = lines.filter((line) => line.includes('prereqs: `00-018`'));
    expect(dependentLines).toHaveLength(CANONICAL_DOWNSTREAM_DEPENDENT_COUNT);
  });

  test('plan_vanilla_parity PARALLEL_WORK.md declares the canonical merge-checkpoint sequence verbatim', async () => {
    const parallelWorkText = await Bun.file(PARALLEL_WORK_PATH).text();
    expect(parallelWorkText).toContain(`Merge checkpoints: ${CANONICAL_MERGE_CHECKPOINT_SEQUENCE}`);
  });

  test('plan_vanilla_parity steps/00-018 file declares the canonical gate heading, id, lane, and title', async () => {
    expect(existsSync(GATE_STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(GATE_STEP_FILE_PATH).text();
    expect(stepText.startsWith(CANONICAL_GATE_HEADING)).toBe(true);
    expect(stepText).toContain(`\n## id\n\n${CANONICAL_GATE_ID}\n`);
    expect(stepText).toContain(`\n## lane\n\n${CANONICAL_GATE_LANE}\n`);
    expect(stepText).toContain(`\n## title\n\n${CANONICAL_GATE_TITLE}\n`);
  });

  test('plan_vanilla_parity validate-plan.ts exports the canonical four public surfaces', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('export interface ValidationError');
    expect(validatePlanText).toContain('export interface ValidationResult');
    expect(validatePlanText).toContain('export async function validatePlan');
    expect(validatePlanText).toContain('export async function runValidationCli');
    expect(validatePlanText).toContain('export function parseChecklist');
    expect(validatePlanText).toContain('export { PLAN_VALIDATION_COMMAND };');
  });

  test('PLAN_VALIDATION_COMMAND constant resolves to the canonical CLI invocation', () => {
    expect(PLAN_VALIDATION_COMMAND).toBe(CANONICAL_PLAN_VALIDATION_SCRIPT_COMMAND);
  });

  test('validatePlan() returns the canonical zero-error result when run against the production plan_vanilla_parity tree', async () => {
    const result = await validatePlan();
    expect(result.errors).toEqual([]);
    expect(result.firstStep).toBe(CANONICAL_FIRST_PARSED_STEP_ID);
    expect(result.totalSteps).toBe(Number(CANONICAL_TOTAL_PARSED_STEP_COUNT));
  });

  test('parseChecklist returns the canonical 398 steps with the canonical first step id 00-001', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const steps = parseChecklist(checklistText);
    expect(steps).toHaveLength(Number(CANONICAL_TOTAL_PARSED_STEP_COUNT));
    expect(steps[0]?.id).toBe(CANONICAL_FIRST_PARSED_STEP_ID);
  });

  test('runValidationCli exits 0 and writes the canonical success stdout line when run against the production plan_vanilla_parity tree', async () => {
    const standardOutputLines: string[] = [];
    const standardErrorLines: string[] = [];
    const exitCode = await runValidationCli(
      undefined,
      (line) => standardOutputLines.push(line),
      (line) => standardErrorLines.push(line),
    );
    expect(exitCode).toBe(Number(CANONICAL_CLI_SUCCESS_EXIT_CODE));
    expect(standardOutputLines).toEqual([CANONICAL_CLI_SUCCESS_STDOUT_LINE]);
    expect(standardErrorLines).toEqual([]);
  });

  test('CLAUDE.md anchors the Bun-only runtime constraint that motivates the canonical bun-only pre-gate verification commands', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Bun only.');
    expect(claudeText).toContain('bun run doom.ts');
  });

  test('AGENTS.md anchors the local-only publishing authority that motivates the no-fabrication invariants this gate pins', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('No fabrication');
  });

  test('plan_vanilla_parity PROMPT.md anchors the lane-selection rule that picks the first unchecked step whose prerequisites are complete', async () => {
    const promptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(promptText).toContain('first unchecked step');
    expect(promptText).toContain('lane');
    expect(promptText).toContain('plan_vanilla_parity');
  });

  test('plan_vanilla_parity establish-vanilla-parity-control-center.md anchors the canonical five validation commands the gate enforces', async () => {
    const controlCenterText = await Bun.file(CONTROL_CENTER_PATH).text();
    for (const verificationCommand of CANONICAL_PRE_GATE_VERIFICATION_COMMANDS) {
      expect(controlCenterText).toContain(verificationCommand);
    }
  });

  test('acceptance phrasing names every canonical gate identity, merge-checkpoint, pre-gate command, CLI behavior, and validate-plan result anchor', async () => {
    const parsed = await loadGatePlanStructureValidationDocument();
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_GATE_ID} ${CANONICAL_GATE_SLUG}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_GATE_LANE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_GATE_PHASE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_GATE_PREREQUISITE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_GATE_FILE_PATH}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_GATE_HEADING}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_MERGE_CHECKPOINT_LABEL} ${CANONICAL_MERGE_CHECKPOINT_DESCRIPTION}\``);
    expect(parsed.acceptancePhrasing).toContain(CANONICAL_MERGE_CHECKPOINT_SEQUENCE);
    for (const verificationCommand of CANONICAL_PRE_GATE_VERIFICATION_COMMANDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${verificationCommand}\``);
    }
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_CLI_SUCCESS_STDOUT_LINE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_EXPECTED_VALIDATE_PLAN_RESULT}\``);
    for (const helperExport of CANONICAL_VALIDATE_PLAN_HELPER_EXPORTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${helperExport}\``);
    }
    for (const resultField of CANONICAL_VALIDATE_PLAN_RESULT_FIELDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${resultField}\``);
    }
    expect(parsed.acceptancePhrasing).toContain(String(CANONICAL_DOWNSTREAM_DEPENDENT_COUNT));
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 plan structure validation gate\n';
    expect(() => parseGatePlanStructureValidationDocument(documentTextWithMissingSection)).toThrow('Section "pre-gate verification commands" not found in gate plan structure validation document.');
  });

  test('parser surfaces a meaningful error when pre-gate verification commands is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(GATE_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## pre-gate verification commands\n\n- `bun run format`\n- `bun test plan_vanilla_parity\/validate-plan\.test\.ts`\n- `bun run plan_vanilla_parity\/validate-plan\.ts`\n- `bun test`\n- `bun x tsc --noEmit --project tsconfig\.json`\n/,
      '\n## pre-gate verification commands\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseGatePlanStructureValidationDocument(corruptedDocumentText)).toThrow('pre-gate verification commands must list at least one entry.');
  });

  test('parser surfaces a meaningful error when validate plan helper exports is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(GATE_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## validate plan helper exports\n\n- PLAN_VALIDATION_COMMAND\n- parseChecklist\n- runValidationCli\n- validatePlan\n/, '\n## validate plan helper exports\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseGatePlanStructureValidationDocument(corruptedDocumentText)).toThrow('validate plan helper exports must list at least one entry.');
  });

  test('parser surfaces a meaningful error when validate plan result fields is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(GATE_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## validate plan result fields\n\n- errors\n- firstStep\n- totalSteps\n/, '\n## validate plan result fields\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseGatePlanStructureValidationDocument(corruptedDocumentText)).toThrow('validate plan result fields must list at least one entry.');
  });

  test('parser surfaces a meaningful error when evidence locations is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(GATE_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## evidence locations\n\n(- [^\n]+\n)+/, '\n## evidence locations\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseGatePlanStructureValidationDocument(corruptedDocumentText)).toThrow('evidence locations must list at least one entry.');
  });
});
