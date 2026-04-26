import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const CONTROL_CENTER_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const DEFINE_FINAL_ACCEPTANCE_STANDARD_PATH = 'plan_vanilla_parity/define-final-acceptance-standard.md';
const DEFINE_LANE_WRITE_LOCK_CONTRACT_PATH = 'plan_vanilla_parity/define-lane-write-lock-contract.md';
const DEFINE_STEP_FILE_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/create-plan-validation-script-contract.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-015-create-plan-validation-script-contract.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_SCRIPT_PATH = 'plan_vanilla_parity/validate-plan.ts';
const CANONICAL_SCRIPT_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';
const CANONICAL_CLI_INVOCATION = 'bun run plan_vanilla_parity/validate-plan.ts';
const CANONICAL_PLAN_VALIDATION_COMMAND_EXPORT = 'PLAN_VALIDATION_COMMAND';

const CANONICAL_EXPORTED_PUBLIC_SURFACE_COUNT = 4;
const CANONICAL_EXPORTED_PUBLIC_SURFACES: readonly string[] = ['PLAN_VALIDATION_COMMAND', 'parseChecklist', 'runValidationCli', 'validatePlan'];

const CANONICAL_EXPORTED_RESULT_TYPE_COUNT = 2;
const CANONICAL_EXPORTED_RESULT_TYPES: readonly string[] = ['ValidationError', 'ValidationResult'];

const CANONICAL_VALIDATION_ERROR_FIELDS: readonly string[] = ['file', 'message'];

const CANONICAL_VALIDATION_RESULT_FIELD_COUNT = 3;
const CANONICAL_VALIDATION_RESULT_FIELDS: readonly string[] = ['errors', 'firstStep', 'totalSteps'];

const CANONICAL_EXPECTED_FIRST_STEP_CONSTANT = '00-001';
const CANONICAL_EXPECTED_TOTAL_STEPS_CONSTANT = '398';
const CANONICAL_FINAL_GATE_STEP_ID_CONSTANT = '13-004';

const CANONICAL_REQUIRED_FILES_COUNT = 12;
const CANONICAL_REQUIRED_FILES: readonly string[] = [
  'DEPENDENCY_GRAPH.md',
  'MASTER_CHECKLIST.md',
  'PARALLEL_WORK.md',
  'PRE_PROMPT.md',
  'PROMPT.md',
  'README.md',
  'REFERENCE_ORACLES.md',
  'RISK_REGISTER.md',
  'SOURCE_CATALOG.md',
  'STEP_TEMPLATE.md',
  'validate-plan.test.ts',
  'validate-plan.ts',
];

const CANONICAL_REQUIRED_STEP_FIELD_COUNT = 14;
const CANONICAL_REQUIRED_STEP_FIELDS: readonly string[] = [
  'id',
  'lane',
  'title',
  'goal',
  'prerequisites',
  'parallel-safe-with',
  'write lock',
  'read-only paths',
  'research sources',
  'expected changes',
  'test files',
  'verification commands',
  'completion criteria',
  'final evidence',
];

const CANONICAL_BANNED_COMMANDS_COUNT = 10;
const CANONICAL_BANNED_COMMANDS: readonly string[] = ['jest', 'mocha', 'node', 'npm', 'npx', 'pnpm', 'ts-node', 'tsx', 'vitest', 'yarn'];

const CANONICAL_READ_ONLY_ROOTS_COUNT = 3;
const CANONICAL_READ_ONLY_ROOTS: readonly string[] = ['doom/', 'iwad/', 'reference/'];

const CANONICAL_REQUIRED_FINAL_GATE_PHRASE_COUNT = 12;
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

const CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERN_COUNT = 5;
const CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERNS: readonly string[] = ['pending', 'manifest-only', 'sampled-only', 'intent-only', 'declared intent'];

const CANONICAL_CHECKLIST_LINE_PATTERN_NAMED_CAPTURE_GROUPS: readonly string[] = ['id', 'slug', 'lane', 'prerequisites', 'filePath'];

const CANONICAL_INTERNAL_HELPER_COUNT = 16;
const CANONICAL_INTERNAL_HELPERS: readonly string[] = [
  'addMissingFileError',
  'collectStepFiles',
  'extractBullets',
  'extractSection',
  'normalizePlanPath',
  'parseLaneWriteScopes',
  'parsePrerequisites',
  'pathsConflict',
  'readTextIfExists',
  'usesBannedCommand',
  'validateChecklistSummary',
  'validateFinalGate',
  'validateParallelWork',
  'validateRequiredFiles',
  'validateStepText',
  'validateWritablePath',
];

const CANONICAL_DIAGNOSTIC_COUNT = 19;
const CANONICAL_DIAGNOSTICS: readonly string[] = [
  'Required plan file is missing.',
  'Checklist must declare total steps 398.',
  'Checklist must declare the first eligible vanilla parity step.',
  'Checklist must declare the bun run doom.ts runtime target.',
  'Checklist must contain 398 steps, got <count>.',
  'First parsed step must be 00-001.',
  'Checklist step <id> points to missing file <path>.',
  'Step file is not referenced by MASTER_CHECKLIST.md.',
  'Missing final gate step 13-004.',
  'Final gate evidence must include <phrase>.',
  'Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.',
  'Lane <lane> must list at least one owned write root.',
  'Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.',
  'Step heading must match the id and title fields.',
  'Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.',
  'Missing or empty required field: <field>.',
  'Verification command uses a banned tool: <command>.',
  'Write lock escapes the workspace: <path>.',
  'Write lock is inside read-only reference root: <path>.',
];

interface PlanValidationScriptContractDocument {
  readonly acceptancePhrasing: string;
  readonly bannedCommands: readonly string[];
  readonly bannedCommandsCount: string;
  readonly checklistLinePattern: string;
  readonly checklistLinePatternNamedCaptureGroups: readonly string[];
  readonly cliFailureBehavior: string;
  readonly cliInvocation: string;
  readonly cliSuccessBehavior: string;
  readonly defaultPlanDirectoryAnchor: string;
  readonly diagnosticCount: string;
  readonly diagnostics: readonly string[];
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly expectedFirstStepConstant: string;
  readonly expectedPublicSurfaceCount: string;
  readonly expectedPublicSurfaces: readonly string[];
  readonly expectedResultTypeCount: string;
  readonly expectedResultTypes: readonly string[];
  readonly expectedTotalStepsConstant: string;
  readonly finalGateStepIdConstant: string;
  readonly internalHelperCount: string;
  readonly internalHelpers: readonly string[];
  readonly noRuntimeSideEffectsRule: string;
  readonly planValidationCommandExportName: string;
  readonly readOnlyRoots: readonly string[];
  readonly readOnlyRootsCount: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly rejectedFinalEvidencePatternCount: string;
  readonly rejectedFinalEvidencePatterns: readonly string[];
  readonly requiredFilesCount: string;
  readonly requiredFiles: readonly string[];
  readonly requiredFinalGatePhraseCount: string;
  readonly requiredFinalGatePhrases: readonly string[];
  readonly requiredStepFieldCount: string;
  readonly requiredStepFields: readonly string[];
  readonly scopeName: string;
  readonly scriptPath: string;
  readonly scriptTestPath: string;
  readonly validateChecklistSummaryHelper: string;
  readonly validateFinalGateHelper: string;
  readonly validateParallelWorkHelper: string;
  readonly validateRequiredFilesHelper: string;
  readonly validateStepTextHelper: string;
  readonly validateWritablePathHelper: string;
  readonly validationErrorFields: readonly string[];
  readonly validationResultFieldCount: string;
  readonly validationResultFields: readonly string[];
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in plan validation script contract document.`);
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

function parsePlanValidationScriptContractDocument(documentText: string): PlanValidationScriptContractDocument {
  const expectedPublicSurfaces = extractBullets(documentText, 'exported public surfaces');
  if (expectedPublicSurfaces.length === 0) {
    throw new Error('exported public surfaces must list at least one entry.');
  }

  const expectedResultTypes = extractBullets(documentText, 'exported result types');
  if (expectedResultTypes.length === 0) {
    throw new Error('exported result types must list at least one entry.');
  }

  const validationErrorFields = extractBullets(documentText, 'validation error fields');
  if (validationErrorFields.length === 0) {
    throw new Error('validation error fields must list at least one entry.');
  }

  const validationResultFields = extractBullets(documentText, 'validation result fields');
  if (validationResultFields.length === 0) {
    throw new Error('validation result fields must list at least one entry.');
  }

  const requiredFiles = extractBullets(documentText, 'required files');
  if (requiredFiles.length === 0) {
    throw new Error('required files must list at least one entry.');
  }

  const requiredStepFields = extractBullets(documentText, 'required step fields');
  if (requiredStepFields.length === 0) {
    throw new Error('required step fields must list at least one entry.');
  }

  const bannedCommands = extractBullets(documentText, 'banned commands');
  if (bannedCommands.length === 0) {
    throw new Error('banned commands must list at least one entry.');
  }

  const readOnlyRoots = extractBullets(documentText, 'read-only roots');
  if (readOnlyRoots.length === 0) {
    throw new Error('read-only roots must list at least one entry.');
  }

  const requiredFinalGatePhrases = extractBullets(documentText, 'required final gate phrases');
  if (requiredFinalGatePhrases.length === 0) {
    throw new Error('required final gate phrases must list at least one entry.');
  }

  const rejectedFinalEvidencePatterns = extractBullets(documentText, 'rejected final evidence patterns');
  if (rejectedFinalEvidencePatterns.length === 0) {
    throw new Error('rejected final evidence patterns must list at least one entry.');
  }

  const checklistLinePatternNamedCaptureGroups = extractBullets(documentText, 'checklist line pattern named capture groups');
  if (checklistLinePatternNamedCaptureGroups.length === 0) {
    throw new Error('checklist line pattern named capture groups must list at least one entry.');
  }

  const internalHelpers = extractBullets(documentText, 'internal helpers');
  if (internalHelpers.length === 0) {
    throw new Error('internal helpers must list at least one entry.');
  }

  const diagnostics = extractBullets(documentText, 'diagnostics');
  if (diagnostics.length === 0) {
    throw new Error('diagnostics must list at least one entry.');
  }

  const evidenceLocations = extractBullets(documentText, 'evidence locations');
  if (evidenceLocations.length === 0) {
    throw new Error('evidence locations must list at least one entry.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    bannedCommands,
    bannedCommandsCount: extractSection(documentText, 'banned commands count'),
    checklistLinePattern: extractSection(documentText, 'checklist line pattern'),
    checklistLinePatternNamedCaptureGroups,
    cliFailureBehavior: extractSection(documentText, 'cli failure behavior'),
    cliInvocation: extractSection(documentText, 'cli invocation'),
    cliSuccessBehavior: extractSection(documentText, 'cli success behavior'),
    defaultPlanDirectoryAnchor: extractSection(documentText, 'default plan directory anchor'),
    diagnosticCount: extractSection(documentText, 'diagnostic count'),
    diagnostics,
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations,
    expectedFirstStepConstant: extractSection(documentText, 'expected first step constant'),
    expectedPublicSurfaceCount: extractSection(documentText, 'exported public surface count'),
    expectedPublicSurfaces,
    expectedResultTypeCount: extractSection(documentText, 'exported result type count'),
    expectedResultTypes,
    expectedTotalStepsConstant: extractSection(documentText, 'expected total steps constant'),
    finalGateStepIdConstant: extractSection(documentText, 'final gate step id constant'),
    internalHelperCount: extractSection(documentText, 'internal helper count'),
    internalHelpers,
    noRuntimeSideEffectsRule: extractSection(documentText, 'no runtime side effects rule'),
    planValidationCommandExportName: extractSection(documentText, 'plan validation command export name'),
    readOnlyRoots,
    readOnlyRootsCount: extractSection(documentText, 'read-only roots count'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    rejectedFinalEvidencePatternCount: extractSection(documentText, 'rejected final evidence pattern count'),
    rejectedFinalEvidencePatterns,
    requiredFiles,
    requiredFilesCount: extractSection(documentText, 'required files count'),
    requiredFinalGatePhraseCount: extractSection(documentText, 'required final gate phrase count'),
    requiredFinalGatePhrases,
    requiredStepFieldCount: extractSection(documentText, 'required step field count'),
    requiredStepFields,
    scopeName: extractSection(documentText, 'scope name'),
    scriptPath: extractSection(documentText, 'script path'),
    scriptTestPath: extractSection(documentText, 'script test path'),
    validateChecklistSummaryHelper: extractSection(documentText, 'validate checklist summary helper'),
    validateFinalGateHelper: extractSection(documentText, 'validate final gate helper'),
    validateParallelWorkHelper: extractSection(documentText, 'validate parallel work helper'),
    validateRequiredFilesHelper: extractSection(documentText, 'validate required files helper'),
    validateStepTextHelper: extractSection(documentText, 'validate step text helper'),
    validateWritablePathHelper: extractSection(documentText, 'validate writable path helper'),
    validationErrorFields,
    validationResultFieldCount: extractSection(documentText, 'validation result field count'),
    validationResultFields,
  };
}

async function loadPlanValidationScriptContractDocument(): Promise<PlanValidationScriptContractDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePlanValidationScriptContractDocument(documentText);
}

describe('create plan validation script contract declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 plan validation script contract');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('script path and script test path pin the canonical Bun script and its focused test', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.scriptPath).toBe(CANONICAL_SCRIPT_PATH);
    expect(parsed.scriptTestPath).toBe(CANONICAL_SCRIPT_TEST_PATH);
    expect(existsSync(CANONICAL_SCRIPT_PATH)).toBe(true);
    expect(existsSync(CANONICAL_SCRIPT_TEST_PATH)).toBe(true);
  });

  test('cli invocation pins the canonical bun run command exposed as PLAN_VALIDATION_COMMAND', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.cliInvocation).toBe(CANONICAL_CLI_INVOCATION);
    expect(parsed.planValidationCommandExportName).toBe(CANONICAL_PLAN_VALIDATION_COMMAND_EXPORT);
  });

  test('exported public surfaces equal the canonical four entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.expectedPublicSurfaces).toEqual(CANONICAL_EXPORTED_PUBLIC_SURFACES);
    expect(parsed.expectedPublicSurfaces).toHaveLength(CANONICAL_EXPORTED_PUBLIC_SURFACE_COUNT);
    expect(new Set(parsed.expectedPublicSurfaces).size).toBe(parsed.expectedPublicSurfaces.length);
    expect(parsed.expectedPublicSurfaceCount).toBe(String(CANONICAL_EXPORTED_PUBLIC_SURFACE_COUNT));
    const ascendingSortedSurfaces = [...parsed.expectedPublicSurfaces].sort();
    expect(parsed.expectedPublicSurfaces).toEqual(ascendingSortedSurfaces);
  });

  test('exported result types equal the canonical two entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.expectedResultTypes).toEqual(CANONICAL_EXPORTED_RESULT_TYPES);
    expect(parsed.expectedResultTypes).toHaveLength(CANONICAL_EXPORTED_RESULT_TYPE_COUNT);
    expect(new Set(parsed.expectedResultTypes).size).toBe(parsed.expectedResultTypes.length);
    expect(parsed.expectedResultTypeCount).toBe(String(CANONICAL_EXPORTED_RESULT_TYPE_COUNT));
    const ascendingSortedTypes = [...parsed.expectedResultTypes].sort();
    expect(parsed.expectedResultTypes).toEqual(ascendingSortedTypes);
  });

  test('validation error fields equal the canonical two entries with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validationErrorFields).toEqual(CANONICAL_VALIDATION_ERROR_FIELDS);
    expect(new Set(parsed.validationErrorFields).size).toBe(parsed.validationErrorFields.length);
  });

  test('validation result fields equal the canonical three entries in canonical order with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validationResultFields).toEqual(CANONICAL_VALIDATION_RESULT_FIELDS);
    expect(parsed.validationResultFields).toHaveLength(CANONICAL_VALIDATION_RESULT_FIELD_COUNT);
    expect(new Set(parsed.validationResultFields).size).toBe(parsed.validationResultFields.length);
    expect(parsed.validationResultFieldCount).toBe(String(CANONICAL_VALIDATION_RESULT_FIELD_COUNT));
  });

  test('default plan directory anchor names import.meta.dir, the planDirectory override argument, and the validate-plan.test.ts fixture', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.defaultPlanDirectoryAnchor).toContain('import.meta.dir');
    expect(parsed.defaultPlanDirectoryAnchor).toContain('DEFAULT_PLAN_DIRECTORY');
    expect(parsed.defaultPlanDirectoryAnchor).toContain('planDirectory');
    expect(parsed.defaultPlanDirectoryAnchor).toContain(CANONICAL_SCRIPT_TEST_PATH);
    expect(parsed.defaultPlanDirectoryAnchor).toContain('plan_vanilla_parity/');
  });

  test('expected constants pin the canonical first step, total step count, and final gate step id used by validate-plan.ts', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.expectedFirstStepConstant).toBe(CANONICAL_EXPECTED_FIRST_STEP_CONSTANT);
    expect(parsed.expectedTotalStepsConstant).toBe(CANONICAL_EXPECTED_TOTAL_STEPS_CONSTANT);
    expect(parsed.finalGateStepIdConstant).toBe(CANONICAL_FINAL_GATE_STEP_ID_CONSTANT);
  });

  test('required files equal the canonical twelve entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.requiredFiles).toEqual(CANONICAL_REQUIRED_FILES);
    expect(parsed.requiredFiles).toHaveLength(CANONICAL_REQUIRED_FILES_COUNT);
    expect(new Set(parsed.requiredFiles).size).toBe(parsed.requiredFiles.length);
    expect(parsed.requiredFilesCount).toBe(String(CANONICAL_REQUIRED_FILES_COUNT));
    const ascendingSortedFiles = [...parsed.requiredFiles].sort();
    expect(parsed.requiredFiles).toEqual(ascendingSortedFiles);
  });

  test('required step fields equal the canonical fourteen REQUIRED_STEP_FIELDS entries from validate-plan.ts in canonical order with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.requiredStepFields).toEqual(CANONICAL_REQUIRED_STEP_FIELDS);
    expect(parsed.requiredStepFields).toHaveLength(CANONICAL_REQUIRED_STEP_FIELD_COUNT);
    expect(new Set(parsed.requiredStepFields).size).toBe(parsed.requiredStepFields.length);
    expect(parsed.requiredStepFieldCount).toBe(String(CANONICAL_REQUIRED_STEP_FIELD_COUNT));
  });

  test('banned commands equal the canonical ten BANNED_COMMANDS entries from validate-plan.ts ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.bannedCommands).toEqual(CANONICAL_BANNED_COMMANDS);
    expect(parsed.bannedCommands).toHaveLength(CANONICAL_BANNED_COMMANDS_COUNT);
    expect(new Set(parsed.bannedCommands).size).toBe(parsed.bannedCommands.length);
    expect(parsed.bannedCommandsCount).toBe(String(CANONICAL_BANNED_COMMANDS_COUNT));
    const ascendingSortedCommands = [...parsed.bannedCommands].sort();
    expect(parsed.bannedCommands).toEqual(ascendingSortedCommands);
  });

  test('read-only roots equal the canonical three READ_ONLY_ROOTS entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.readOnlyRoots).toEqual(CANONICAL_READ_ONLY_ROOTS);
    expect(parsed.readOnlyRoots).toHaveLength(CANONICAL_READ_ONLY_ROOTS_COUNT);
    expect(new Set(parsed.readOnlyRoots).size).toBe(parsed.readOnlyRoots.length);
    expect(parsed.readOnlyRootsCount).toBe(String(CANONICAL_READ_ONLY_ROOTS_COUNT));
    const ascendingSortedRoots = [...parsed.readOnlyRoots].sort();
    expect(parsed.readOnlyRoots).toEqual(ascendingSortedRoots);
  });

  test('required final gate phrases equal the canonical twelve REQUIRED_FINAL_GATE_PHRASES entries from validate-plan.ts in canonical order with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.requiredFinalGatePhrases).toEqual(CANONICAL_REQUIRED_FINAL_GATE_PHRASES);
    expect(parsed.requiredFinalGatePhrases).toHaveLength(CANONICAL_REQUIRED_FINAL_GATE_PHRASE_COUNT);
    expect(new Set(parsed.requiredFinalGatePhrases).size).toBe(parsed.requiredFinalGatePhrases.length);
    expect(parsed.requiredFinalGatePhraseCount).toBe(String(CANONICAL_REQUIRED_FINAL_GATE_PHRASE_COUNT));
  });

  test('rejected final evidence patterns equal the canonical five REJECTED_FINAL_EVIDENCE_PATTERNS entries from validate-plan.ts in canonical order with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.rejectedFinalEvidencePatterns).toEqual(CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERNS);
    expect(parsed.rejectedFinalEvidencePatterns).toHaveLength(CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERN_COUNT);
    expect(new Set(parsed.rejectedFinalEvidencePatterns).size).toBe(parsed.rejectedFinalEvidencePatterns.length);
    expect(parsed.rejectedFinalEvidencePatternCount).toBe(String(CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERN_COUNT));
  });

  test('checklist line pattern section names every canonical named capture group and the pending and completed checkbox forms', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.checklistLinePattern).toContain('CHECKLIST_LINE_PATTERN');
    expect(parsed.checklistLinePattern).toContain('parseChecklist');
    expect(parsed.checklistLinePattern).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.checklistLinePattern).toContain('[ ]');
    expect(parsed.checklistLinePattern).toContain('[x]');
    for (const namedCaptureGroup of CANONICAL_CHECKLIST_LINE_PATTERN_NAMED_CAPTURE_GROUPS) {
      expect(parsed.checklistLinePattern).toContain(namedCaptureGroup);
    }
  });

  test('checklist line pattern named capture groups equal the canonical five entries in canonical order with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.checklistLinePatternNamedCaptureGroups).toEqual(CANONICAL_CHECKLIST_LINE_PATTERN_NAMED_CAPTURE_GROUPS);
    expect(new Set(parsed.checklistLinePatternNamedCaptureGroups).size).toBe(parsed.checklistLinePatternNamedCaptureGroups.length);
  });

  test('internal helpers equal the canonical sixteen entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.internalHelpers).toEqual(CANONICAL_INTERNAL_HELPERS);
    expect(parsed.internalHelpers).toHaveLength(CANONICAL_INTERNAL_HELPER_COUNT);
    expect(new Set(parsed.internalHelpers).size).toBe(parsed.internalHelpers.length);
    expect(parsed.internalHelperCount).toBe(String(CANONICAL_INTERNAL_HELPER_COUNT));
    const ascendingSortedHelpers = [...parsed.internalHelpers].sort();
    expect(parsed.internalHelpers).toEqual(ascendingSortedHelpers);
  });

  test('validate required files helper section names the canonical twelve REQUIRED_FILES anchor and the verbatim missing-file diagnostic', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validateRequiredFilesHelper).toContain('REQUIRED_FILES');
    expect(parsed.validateRequiredFilesHelper).toContain('Bun.file');
    expect(parsed.validateRequiredFilesHelper).toContain('addMissingFileError');
    expect(parsed.validateRequiredFilesHelper).toContain('Required plan file is missing.');
    expect(parsed.validateRequiredFilesHelper).toContain('plan_vanilla_parity/<relativePath>');
  });

  test('validate checklist summary helper section names every literal summary line diagnostic from validate-plan.ts', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validateChecklistSummaryHelper).toContain('Checklist must declare total steps 398.');
    expect(parsed.validateChecklistSummaryHelper).toContain('Checklist must declare the first eligible vanilla parity step.');
    expect(parsed.validateChecklistSummaryHelper).toContain('Checklist must declare the bun run doom.ts runtime target.');
    expect(parsed.validateChecklistSummaryHelper).toContain('Checklist must contain 398 steps, got <count>.');
    expect(parsed.validateChecklistSummaryHelper).toContain('First parsed step must be 00-001.');
    expect(parsed.validateChecklistSummaryHelper).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
  });

  test('validate final gate helper section names every required-phrase diagnostic, every rejected-pattern diagnostic, and the missing-final-gate diagnostic', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validateFinalGateHelper).toContain('REQUIRED_FINAL_GATE_PHRASES');
    expect(parsed.validateFinalGateHelper).toContain('REJECTED_FINAL_EVIDENCE_PATTERNS');
    expect(parsed.validateFinalGateHelper).toContain('Final gate evidence must include <phrase>.');
    expect(parsed.validateFinalGateHelper).toContain('Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.');
    expect(parsed.validateFinalGateHelper).toContain('Missing final gate step 13-004.');
    expect(parsed.validateFinalGateHelper).toContain('plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md');
    expect(parsed.validateFinalGateHelper).toContain('## final evidence');
  });

  test('validate parallel work helper section names parseLaneWriteScopes, pathsConflict, and every disjoint-scope diagnostic', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validateParallelWorkHelper).toContain('parseLaneWriteScopes');
    expect(parsed.validateParallelWorkHelper).toContain('pathsConflict');
    expect(parsed.validateParallelWorkHelper).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.validateParallelWorkHelper).toContain('Lane <lane> must list at least one owned write root.');
    expect(parsed.validateParallelWorkHelper).toContain('Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.');
    expect(parsed.validateParallelWorkHelper).toContain('validateWritablePath');
  });

  test('validate step text helper section names every per-step diagnostic from validate-plan.ts and the canonical fourteen REQUIRED_STEP_FIELDS', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validateStepTextHelper).toContain('Step heading must match the id and title fields.');
    expect(parsed.validateStepTextHelper).toContain('Step fields must exactly match: <fields>.');
    expect(parsed.validateStepTextHelper).toContain('Missing or empty required field: <field>.');
    expect(parsed.validateStepTextHelper).toContain('id field must be <id>.');
    expect(parsed.validateStepTextHelper).toContain('lane field must be <lane>.');
    expect(parsed.validateStepTextHelper).toContain('Step prerequisites must match MASTER_CHECKLIST.md.');
    expect(parsed.validateStepTextHelper).toContain('Prerequisite <id> does not point to an existing prior step.');
    expect(parsed.validateStepTextHelper).toContain('Step must list at least one focused test file.');
    expect(parsed.validateStepTextHelper).toContain('Verification must include bun run format.');
    expect(parsed.validateStepTextHelper).toContain('Verification must include the focused bun test command.');
    expect(parsed.validateStepTextHelper).toContain('Verification must include full bun test.');
    expect(parsed.validateStepTextHelper).toContain('Verification must include the Bun typecheck command.');
    expect(parsed.validateStepTextHelper).toContain('Verification command uses a banned tool: <command>.');
    expect(parsed.validateStepTextHelper).toContain('REQUIRED_STEP_FIELDS');
    expect(parsed.validateStepTextHelper).toContain('BANNED_COMMANDS');
    expect(parsed.validateStepTextHelper).toContain('plan_vanilla_parity/steps/');
  });

  test('validate writable path helper section names normalizePlanPath, every diagnostic, and the canonical READ_ONLY_ROOTS anchor', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.validateWritablePathHelper).toContain('normalizePlanPath');
    expect(parsed.validateWritablePathHelper).toContain('READ_ONLY_ROOTS');
    expect(parsed.validateWritablePathHelper).toContain('Write lock path must not be empty.');
    expect(parsed.validateWritablePathHelper).toContain('Write lock escapes the workspace: <path>.');
    expect(parsed.validateWritablePathHelper).toContain('Write lock is inside read-only reference root: <path>.');
  });

  test('diagnostics equal the canonical nineteen entries with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.diagnostics).toEqual(CANONICAL_DIAGNOSTICS);
    expect(parsed.diagnostics).toHaveLength(CANONICAL_DIAGNOSTIC_COUNT);
    expect(new Set(parsed.diagnostics).size).toBe(parsed.diagnostics.length);
    expect(parsed.diagnosticCount).toBe(String(CANONICAL_DIAGNOSTIC_COUNT));
  });

  test('cli success behavior section names runValidationCli, the verbatim Validated stdout line, the import.meta.main guard, and exit code 0', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.cliSuccessBehavior).toContain('runValidationCli');
    expect(parsed.cliSuccessBehavior).toContain('validatePlan');
    expect(parsed.cliSuccessBehavior).toContain("Validated <result.totalSteps> vanilla parity steps. First step: <result.firstStep ?? 'NONE'>.");
    expect(parsed.cliSuccessBehavior).toContain('stdout');
    expect(parsed.cliSuccessBehavior).toContain('exit code `0`');
    expect(parsed.cliSuccessBehavior).toContain('import.meta.main');
    expect(parsed.cliSuccessBehavior).toContain('process.exit');
    expect(parsed.cliSuccessBehavior).toContain(CANONICAL_CLI_INVOCATION);
  });

  test('cli failure behavior section names runValidationCli, the verbatim error stderr format, and exit code 1', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.cliFailureBehavior).toContain('runValidationCli');
    expect(parsed.cliFailureBehavior).toContain('stderr');
    expect(parsed.cliFailureBehavior).toContain('<error.file>: <error.message>');
    expect(parsed.cliFailureBehavior).toContain('exit code `1`');
  });

  test('no runtime side effects rule names every forbidden write API, the read-only Bun.file APIs, and the .cache fixture root', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.noRuntimeSideEffectsRule).toContain('read-only');
    expect(parsed.noRuntimeSideEffectsRule).toContain('Bun.file');
    expect(parsed.noRuntimeSideEffectsRule).toContain('Bun.write');
    expect(parsed.noRuntimeSideEffectsRule).toContain('node:fs/promises');
    expect(parsed.noRuntimeSideEffectsRule).toContain('writeFile');
    expect(parsed.noRuntimeSideEffectsRule).toContain('mkdir');
    expect(parsed.noRuntimeSideEffectsRule).toContain('fetch');
    expect(parsed.noRuntimeSideEffectsRule).toContain('plan_vanilla_parity/');
    expect(parsed.noRuntimeSideEffectsRule).toContain('.cache/plan-vanilla-parity-fixture-');
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, every adjacent governance pin, the validate-plan helper plus its test, and the step file', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      CONTROL_CENTER_PATH,
      DEFINE_FINAL_ACCEPTANCE_STANDARD_PATH,
      DEFINE_LANE_WRITE_LOCK_CONTRACT_PATH,
      DEFINE_STEP_FILE_REQUIRED_FIELDS_PATH,
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

  test('plan_vanilla_parity validate-plan.ts source anchors every canonical export, constant, and array this contract pins', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain("PLAN_VALIDATION_COMMAND = 'bun run plan_vanilla_parity/validate-plan.ts'");
    expect(validatePlanText).toContain('export { PLAN_VALIDATION_COMMAND }');
    expect(validatePlanText).toContain('export async function validatePlan');
    expect(validatePlanText).toContain('export async function runValidationCli');
    expect(validatePlanText).toContain('export function parseChecklist');
    expect(validatePlanText).toContain('export interface ValidationError');
    expect(validatePlanText).toContain('export interface ValidationResult');
    expect(validatePlanText).toContain(`EXPECTED_FIRST_STEP = '${CANONICAL_EXPECTED_FIRST_STEP_CONSTANT}';`);
    expect(validatePlanText).toContain(`EXPECTED_TOTAL_STEPS = ${CANONICAL_EXPECTED_TOTAL_STEPS_CONSTANT};`);
    expect(validatePlanText).toContain(`FINAL_GATE_STEP_ID = '${CANONICAL_FINAL_GATE_STEP_ID_CONSTANT}';`);
    expect(validatePlanText).toContain('const REQUIRED_FILES =');
    expect(validatePlanText).toContain('const REQUIRED_STEP_FIELDS =');
    expect(validatePlanText).toContain('const BANNED_COMMANDS =');
    expect(validatePlanText).toContain('const READ_ONLY_ROOTS =');
    expect(validatePlanText).toContain('const REQUIRED_FINAL_GATE_PHRASES =');
    expect(validatePlanText).toContain('const REJECTED_FINAL_EVIDENCE_PATTERNS =');
    expect(validatePlanText).toContain('const CHECKLIST_LINE_PATTERN =');
    expect(validatePlanText).toContain('const DEFAULT_PLAN_DIRECTORY = import.meta.dir;');
    for (const requiredFile of CANONICAL_REQUIRED_FILES) {
      expect(validatePlanText).toContain(requiredFile);
    }
    for (const requiredStepField of CANONICAL_REQUIRED_STEP_FIELDS) {
      expect(validatePlanText).toContain(`'${requiredStepField}'`);
    }
    for (const bannedCommand of CANONICAL_BANNED_COMMANDS) {
      expect(validatePlanText).toContain(`'${bannedCommand}'`);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_ROOTS) {
      expect(validatePlanText).toContain(`'${readOnlyRoot}'`);
    }
    for (const requiredFinalGatePhrase of CANONICAL_REQUIRED_FINAL_GATE_PHRASES) {
      expect(validatePlanText).toContain(requiredFinalGatePhrase);
    }
  });

  test('plan_vanilla_parity validate-plan.ts source defines every canonical internal helper this contract pins', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    for (const internalHelper of CANONICAL_INTERNAL_HELPERS) {
      expect(validatePlanText).toContain(`function ${internalHelper}`);
    }
  });

  test('plan_vanilla_parity validate-plan.ts source emits every canonical diagnostic this contract pins as raw text', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('Required plan file is missing.');
    expect(validatePlanText).toContain('Checklist must declare total steps ${EXPECTED_TOTAL_STEPS}.');
    expect(validatePlanText).toContain('Checklist must declare the first eligible vanilla parity step.');
    expect(validatePlanText).toContain('Checklist must declare the bun run doom.ts runtime target.');
    expect(validatePlanText).toContain('Checklist must contain ${EXPECTED_TOTAL_STEPS} steps, got ${checklistSteps.length}.');
    expect(validatePlanText).toContain('First parsed step must be ${EXPECTED_FIRST_STEP}.');
    expect(validatePlanText).toContain('Checklist step ${checklistStep.id} points to missing file ${checklistStep.filePath}.');
    expect(validatePlanText).toContain('Step file is not referenced by MASTER_CHECKLIST.md.');
    expect(validatePlanText).toContain('Missing final gate step ${FINAL_GATE_STEP_ID}.');
    expect(validatePlanText).toContain('Final gate evidence must include ${requiredPhrase}.');
    expect(validatePlanText).toContain('Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.');
    expect(validatePlanText).toContain('Lane ${scope.lane} must list at least one owned write root.');
    expect(validatePlanText).toContain('Lane write scopes overlap: ${leftScope.lane} owns ${leftRoot} and ${rightScope.lane} owns ${rightRoot}.');
    expect(validatePlanText).toContain('Step heading must match the id and title fields.');
    expect(validatePlanText).toContain("Step fields must exactly match: ${REQUIRED_STEP_FIELDS.join(', ')}.");
    expect(validatePlanText).toContain('Missing or empty required field: ${field}.');
    expect(validatePlanText).toContain('Verification command uses a banned tool: ${command}.');
    expect(validatePlanText).toContain('Write lock escapes the workspace: ${path}.');
    expect(validatePlanText).toContain('Write lock is inside read-only reference root: ${path}.');
  });

  test('plan_vanilla_parity validate-plan.ts CLI success path writes the verbatim Validated stdout line and exits 0', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain("Validated ${result.totalSteps} vanilla parity steps. First step: ${result.firstStep ?? 'NONE'}.");
    expect(validatePlanText).toContain('return 0;');
    expect(validatePlanText).toContain('return 1;');
    expect(validatePlanText).toContain('if (import.meta.main)');
    expect(validatePlanText).toContain('process.exit(await runValidationCli());');
  });

  test('plan_vanilla_parity validate-plan.test.ts test source imports the canonical four exported public surfaces from validate-plan.ts', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain("from './validate-plan.ts'");
    for (const exportedSurface of CANONICAL_EXPORTED_PUBLIC_SURFACES) {
      expect(validatePlanTestText).toContain(exportedSurface);
    }
  });

  test('CLAUDE.md anchors the Bun runtime line and the read-only reference roots this contract depends on', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Bun only.');
    for (const readOnlyRoot of CANONICAL_READ_ONLY_ROOTS) {
      expect(claudeText).toContain(`\`${readOnlyRoot}\``);
    }
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-fabrication core principle', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
    expect(agentsText).toContain('No fabrication');
  });

  test('plan_vanilla_parity README.md anchors the canonical Validation section that names the validator script and its test', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    expect(readmeText).toContain('## Validation');
    expect(readmeText).toContain('bun run plan_vanilla_parity/validate-plan.ts');
    expect(readmeText).toContain('bun test plan_vanilla_parity/validate-plan.test.ts');
  });

  test('step 00-015 file declares the governance lane, lists this contract under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-015: Create Plan Validation Script Contract');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/create-plan-validation-script-contract.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/create-plan-validation-script-contract.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-015 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-015` `create-plan-validation-script-contract` | lane: `governance` | prereqs: `00-014` | file: `plan_vanilla_parity/steps/00-015-create-plan-validation-script-contract.md`';
    const expectedCompletedRow = '- [x] `00-015` `create-plan-validation-script-contract` | lane: `governance` | prereqs: `00-014` | file: `plan_vanilla_parity/steps/00-015-create-plan-validation-script-contract.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the canonical script path, the canonical CLI invocation, every canonical exported public surface, every canonical exported result type, every canonical validation result field, the three canonical constants, every canonical required file, every canonical required step field, every canonical banned command, every canonical read-only root, every canonical required final gate phrase, every canonical rejected final evidence pattern, and every canonical internal helper', async () => {
    const parsed = await loadPlanValidationScriptContractDocument();
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_SCRIPT_PATH}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_CLI_INVOCATION}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_PLAN_VALIDATION_COMMAND_EXPORT}\``);
    for (const exportedSurface of CANONICAL_EXPORTED_PUBLIC_SURFACES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${exportedSurface}\``);
    }
    for (const exportedResultType of CANONICAL_EXPORTED_RESULT_TYPES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${exportedResultType}\``);
    }
    for (const validationResultField of CANONICAL_VALIDATION_RESULT_FIELDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${validationResultField}\``);
    }
    expect(parsed.acceptancePhrasing).toContain(`\`EXPECTED_FIRST_STEP = '${CANONICAL_EXPECTED_FIRST_STEP_CONSTANT}'\``);
    expect(parsed.acceptancePhrasing).toContain(`\`EXPECTED_TOTAL_STEPS = ${CANONICAL_EXPECTED_TOTAL_STEPS_CONSTANT}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`FINAL_GATE_STEP_ID = '${CANONICAL_FINAL_GATE_STEP_ID_CONSTANT}'\``);
    for (const requiredFile of CANONICAL_REQUIRED_FILES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${requiredFile}\``);
    }
    for (const requiredStepField of CANONICAL_REQUIRED_STEP_FIELDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${requiredStepField}\``);
    }
    for (const bannedCommand of CANONICAL_BANNED_COMMANDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${bannedCommand}\``);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${readOnlyRoot}\``);
    }
    for (const requiredFinalGatePhrase of CANONICAL_REQUIRED_FINAL_GATE_PHRASES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${requiredFinalGatePhrase}\``);
    }
    for (const rejectedFinalEvidencePattern of CANONICAL_REJECTED_FINAL_EVIDENCE_PATTERNS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${rejectedFinalEvidencePattern}\``);
    }
    for (const internalHelper of CANONICAL_INTERNAL_HELPERS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${internalHelper}\``);
    }
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 plan validation script contract\n';
    expect(() => parsePlanValidationScriptContractDocument(documentTextWithMissingSection)).toThrow('Section "exported public surfaces" not found in plan validation script contract document.');
  });

  test('parser surfaces a meaningful error when exported public surfaces is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## exported public surfaces\n\n- PLAN_VALIDATION_COMMAND\n- parseChecklist\n- runValidationCli\n- validatePlan\n/, '\n## exported public surfaces\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationScriptContractDocument(corruptedDocumentText)).toThrow('exported public surfaces must list at least one entry.');
  });

  test('parser surfaces a meaningful error when required files is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## required files\n\n- DEPENDENCY_GRAPH\.md\n- MASTER_CHECKLIST\.md\n- PARALLEL_WORK\.md\n- PRE_PROMPT\.md\n- PROMPT\.md\n- README\.md\n- REFERENCE_ORACLES\.md\n- RISK_REGISTER\.md\n- SOURCE_CATALOG\.md\n- STEP_TEMPLATE\.md\n- validate-plan\.test\.ts\n- validate-plan\.ts\n/,
      '\n## required files\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationScriptContractDocument(corruptedDocumentText)).toThrow('required files must list at least one entry.');
  });

  test('parser surfaces a meaningful error when banned commands is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## banned commands\n\n- jest\n- mocha\n- node\n- npm\n- npx\n- pnpm\n- ts-node\n- tsx\n- vitest\n- yarn\n/, '\n## banned commands\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationScriptContractDocument(corruptedDocumentText)).toThrow('banned commands must list at least one entry.');
  });

  test('parser surfaces a meaningful error when internal helpers is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## internal helpers\n\n- addMissingFileError\n- collectStepFiles\n- extractBullets\n- extractSection\n- normalizePlanPath\n- parseLaneWriteScopes\n- parsePrerequisites\n- pathsConflict\n- readTextIfExists\n- usesBannedCommand\n- validateChecklistSummary\n- validateFinalGate\n- validateParallelWork\n- validateRequiredFiles\n- validateStepText\n- validateWritablePath\n/,
      '\n## internal helpers\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationScriptContractDocument(corruptedDocumentText)).toThrow('internal helpers must list at least one entry.');
  });
});
