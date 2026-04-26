import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const CONTROL_CENTER_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const CREATE_PLAN_VALIDATION_SCRIPT_CONTRACT_PATH = 'plan_vanilla_parity/create-plan-validation-script-contract.md';
const DEFINE_FINAL_ACCEPTANCE_STANDARD_PATH = 'plan_vanilla_parity/define-final-acceptance-standard.md';
const DEFINE_LANE_WRITE_LOCK_CONTRACT_PATH = 'plan_vanilla_parity/define-lane-write-lock-contract.md';
const DEFINE_STEP_FILE_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/create-plan-validation-test-contract.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-016-create-plan-validation-test-contract.md';
const STEP_TEMPLATE_PATH = 'plan_vanilla_parity/STEP_TEMPLATE.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_TEST_FILE_PATH = 'plan_vanilla_parity/validate-plan.test.ts';
const CANONICAL_TEST_RUNNER = 'bun:test';
const CANONICAL_FOCUSED_TEST_INVOCATION = 'bun test plan_vanilla_parity/validate-plan.test.ts';
const CANONICAL_TOP_LEVEL_DESCRIBE_BLOCK = 'vanilla parity plan validator';

const CANONICAL_TOTAL_TEST_COUNT = 9;
const CANONICAL_TEST_NAMES: readonly string[] = [
  'accepts the generated vanilla parity plan',
  'parses the generated checklist and locks the validation command',
  'accepts a complete fixture through an explicit plan directory',
  'reports missing required step fields',
  'rejects banned verification commands',
  'rejects write locks inside read-only reference roots',
  'rejects final gate evidence that relies on deferred or manifest-only proof',
  'rejects overlapping lane write scopes',
  'returns CLI diagnostics for invalid fixtures',
];

const CANONICAL_IMPORTED_SOURCE_PATH = './validate-plan.ts';
const CANONICAL_IMPORTED_PUBLIC_SURFACE_COUNT = 4;
const CANONICAL_IMPORTED_PUBLIC_SURFACES: readonly string[] = ['PLAN_VALIDATION_COMMAND', 'parseChecklist', 'runValidationCli', 'validatePlan'];

const CANONICAL_PINNED_CONSTANT_COUNT = 3;
const CANONICAL_PINNED_CONSTANTS: readonly string[] = ['expectedTotalSteps', 'finalGateStepId', 'finalGateSlug'];

const CANONICAL_EXPECTED_TOTAL_STEPS_VALUE = '398';
const CANONICAL_FINAL_GATE_STEP_ID_VALUE = '13-004';
const CANONICAL_FINAL_GATE_SLUG_VALUE = 'gate-full-final-side-by-side-proof';

const CANONICAL_FIXTURE_ROOT_PATH_PREFIX = '.cache/plan-vanilla-parity-fixture-';

const CANONICAL_FIXTURE_HELPER_COUNT = 8;
const CANONICAL_FIXTURE_HELPERS: readonly string[] = ['createChecklistLine', 'createFixtureSteps', 'createMasterChecklist', 'createParallelWorkText', 'createRequiredPlanFiles', 'createStepText', 'withPlanFixture', 'writeFixtureFiles'];

const CANONICAL_INTERNAL_INTERFACE_COUNT = 2;
const CANONICAL_INTERNAL_INTERFACES: readonly string[] = ['FixtureOptions', 'FixtureStep'];

const CANONICAL_NODE_MODULE_COUNT = 2;
const CANONICAL_NODE_MODULES: readonly string[] = ['node:fs/promises', 'node:path'];
const CANONICAL_NODE_FS_PROMISES_IMPORTED_NAMES: readonly string[] = ['mkdir', 'mkdtemp', 'rm', 'writeFile'];
const CANONICAL_NODE_PATH_IMPORTED_NAMES: readonly string[] = ['dirname', 'join'];

const CANONICAL_BUN_TEST_IMPORT_COUNT = 3;
const CANONICAL_BUN_TEST_IMPORTS: readonly string[] = ['describe', 'expect', 'test'];

const CANONICAL_REQUIRED_FIXTURE_PLAN_FILE_COUNT = 12;
const CANONICAL_REQUIRED_FIXTURE_PLAN_FILES: readonly string[] = [
  'plan_vanilla_parity/DEPENDENCY_GRAPH.md',
  'plan_vanilla_parity/MASTER_CHECKLIST.md',
  'plan_vanilla_parity/PARALLEL_WORK.md',
  'plan_vanilla_parity/PRE_PROMPT.md',
  'plan_vanilla_parity/PROMPT.md',
  'plan_vanilla_parity/README.md',
  'plan_vanilla_parity/REFERENCE_ORACLES.md',
  'plan_vanilla_parity/RISK_REGISTER.md',
  'plan_vanilla_parity/SOURCE_CATALOG.md',
  'plan_vanilla_parity/STEP_TEMPLATE.md',
  'plan_vanilla_parity/validate-plan.test.ts',
  'plan_vanilla_parity/validate-plan.ts',
];

const CANONICAL_FIXTURE_OVERRIDE_HOOK_COUNT = 3;
const CANONICAL_FIXTURE_OVERRIDE_HOOKS: readonly string[] = ['finalEvidence', 'verificationCommands', 'writeLock'];

const CANONICAL_FAILURE_MODE_COUNT = 6;
const CANONICAL_FAILURE_MODES: readonly string[] = [
  'missing required step fields produces the canonical step-fields diagnostic',
  'banned verification command produces the canonical banned-tool diagnostic',
  'write lock inside read-only reference root produces the canonical read-only-root diagnostic',
  'final gate evidence containing a rejected pattern produces the canonical rejected-pattern diagnostic',
  'overlapping lane write scopes produces the canonical scope-overlap diagnostic',
  'CLI invocation against an invalid fixture surfaces stderr diagnostics and returns exit code 1',
];

interface PlanValidationTestContractDocument {
  readonly acceptancePhrasing: string;
  readonly bunTestImportCount: string;
  readonly bunTestImports: readonly string[];
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly expectedTotalStepsValue: string;
  readonly failureModeCount: string;
  readonly failureModes: readonly string[];
  readonly finalGateSlugValue: string;
  readonly finalGateStepIdValue: string;
  readonly fixtureCleanupRule: string;
  readonly fixtureHelperCount: string;
  readonly fixtureHelpers: readonly string[];
  readonly fixtureIsolationRule: string;
  readonly fixtureOverrideHookCount: string;
  readonly fixtureOverrideHooks: readonly string[];
  readonly fixtureRootPathPrefix: string;
  readonly fixtureStepGenerationRule: string;
  readonly fixtureStepTextShape: string;
  readonly focusedTestInvocation: string;
  readonly importedPublicSurfaceCount: string;
  readonly importedPublicSurfaces: readonly string[];
  readonly importedSourcePath: string;
  readonly internalInterfaceCount: string;
  readonly internalInterfaces: readonly string[];
  readonly nodeFsPromisesImportedNames: readonly string[];
  readonly nodeModuleCount: string;
  readonly nodeModules: readonly string[];
  readonly nodePathImportedNames: readonly string[];
  readonly pinnedConstantCount: string;
  readonly pinnedConstants: readonly string[];
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly requiredFixturePlanFileCount: string;
  readonly requiredFixturePlanFiles: readonly string[];
  readonly scopeName: string;
  readonly test1: string;
  readonly test2: string;
  readonly test3: string;
  readonly test4: string;
  readonly test5: string;
  readonly test6: string;
  readonly test7: string;
  readonly test8: string;
  readonly test9: string;
  readonly testFilePath: string;
  readonly testNames: readonly string[];
  readonly testRunner: string;
  readonly topLevelDescribeBlock: string;
  readonly totalTestCount: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in plan validation test contract document.`);
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

function parsePlanValidationTestContractDocument(documentText: string): PlanValidationTestContractDocument {
  const testNames = extractBullets(documentText, 'test names');
  if (testNames.length === 0) {
    throw new Error('test names must list at least one entry.');
  }

  const importedPublicSurfaces = extractBullets(documentText, 'imported public surfaces');
  if (importedPublicSurfaces.length === 0) {
    throw new Error('imported public surfaces must list at least one entry.');
  }

  const pinnedConstants = extractBullets(documentText, 'pinned constants');
  if (pinnedConstants.length === 0) {
    throw new Error('pinned constants must list at least one entry.');
  }

  const fixtureHelpers = extractBullets(documentText, 'fixture helpers');
  if (fixtureHelpers.length === 0) {
    throw new Error('fixture helpers must list at least one entry.');
  }

  const internalInterfaces = extractBullets(documentText, 'internal interfaces');
  if (internalInterfaces.length === 0) {
    throw new Error('internal interfaces must list at least one entry.');
  }

  const nodeModules = extractBullets(documentText, 'node modules');
  if (nodeModules.length === 0) {
    throw new Error('node modules must list at least one entry.');
  }

  const nodeFsPromisesImportedNames = extractBullets(documentText, 'node:fs/promises imported names');
  if (nodeFsPromisesImportedNames.length === 0) {
    throw new Error('node:fs/promises imported names must list at least one entry.');
  }

  const nodePathImportedNames = extractBullets(documentText, 'node:path imported names');
  if (nodePathImportedNames.length === 0) {
    throw new Error('node:path imported names must list at least one entry.');
  }

  const bunTestImports = extractBullets(documentText, 'bun:test imports');
  if (bunTestImports.length === 0) {
    throw new Error('bun:test imports must list at least one entry.');
  }

  const requiredFixturePlanFiles = extractBullets(documentText, 'required fixture plan files');
  if (requiredFixturePlanFiles.length === 0) {
    throw new Error('required fixture plan files must list at least one entry.');
  }

  const fixtureOverrideHooks = extractBullets(documentText, 'fixture override hooks');
  if (fixtureOverrideHooks.length === 0) {
    throw new Error('fixture override hooks must list at least one entry.');
  }

  const failureModes = extractBullets(documentText, 'failure modes');
  if (failureModes.length === 0) {
    throw new Error('failure modes must list at least one entry.');
  }

  const evidenceLocations = extractBullets(documentText, 'evidence locations');
  if (evidenceLocations.length === 0) {
    throw new Error('evidence locations must list at least one entry.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    bunTestImportCount: extractSection(documentText, 'bun:test import count'),
    bunTestImports,
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations,
    expectedTotalStepsValue: extractSection(documentText, 'expectedTotalSteps value'),
    failureModeCount: extractSection(documentText, 'failure mode count'),
    failureModes,
    finalGateSlugValue: extractSection(documentText, 'finalGateSlug value'),
    finalGateStepIdValue: extractSection(documentText, 'finalGateStepId value'),
    fixtureCleanupRule: extractSection(documentText, 'fixture cleanup rule'),
    fixtureHelperCount: extractSection(documentText, 'fixture helper count'),
    fixtureHelpers,
    fixtureIsolationRule: extractSection(documentText, 'fixture isolation rule'),
    fixtureOverrideHookCount: extractSection(documentText, 'fixture override hook count'),
    fixtureOverrideHooks,
    fixtureRootPathPrefix: extractSection(documentText, 'fixture root path prefix'),
    fixtureStepGenerationRule: extractSection(documentText, 'fixture step generation rule'),
    fixtureStepTextShape: extractSection(documentText, 'fixture step text shape'),
    focusedTestInvocation: extractSection(documentText, 'focused test invocation'),
    importedPublicSurfaceCount: extractSection(documentText, 'imported public surface count'),
    importedPublicSurfaces,
    importedSourcePath: extractSection(documentText, 'imported source path'),
    internalInterfaceCount: extractSection(documentText, 'internal interface count'),
    internalInterfaces,
    nodeFsPromisesImportedNames,
    nodeModuleCount: extractSection(documentText, 'node module count'),
    nodeModules,
    nodePathImportedNames,
    pinnedConstantCount: extractSection(documentText, 'pinned constant count'),
    pinnedConstants,
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    requiredFixturePlanFileCount: extractSection(documentText, 'required fixture plan file count'),
    requiredFixturePlanFiles,
    scopeName: extractSection(documentText, 'scope name'),
    test1: extractSection(documentText, 'test 1 accepts the generated vanilla parity plan'),
    test2: extractSection(documentText, 'test 2 parses the generated checklist and locks the validation command'),
    test3: extractSection(documentText, 'test 3 accepts a complete fixture through an explicit plan directory'),
    test4: extractSection(documentText, 'test 4 reports missing required step fields'),
    test5: extractSection(documentText, 'test 5 rejects banned verification commands'),
    test6: extractSection(documentText, 'test 6 rejects write locks inside read-only reference roots'),
    test7: extractSection(documentText, 'test 7 rejects final gate evidence that relies on deferred or manifest-only proof'),
    test8: extractSection(documentText, 'test 8 rejects overlapping lane write scopes'),
    test9: extractSection(documentText, 'test 9 returns CLI diagnostics for invalid fixtures'),
    testFilePath: extractSection(documentText, 'test file path'),
    testNames,
    testRunner: extractSection(documentText, 'test runner'),
    topLevelDescribeBlock: extractSection(documentText, 'top-level describe block'),
    totalTestCount: extractSection(documentText, 'total test count'),
  };
}

async function loadPlanValidationTestContractDocument(): Promise<PlanValidationTestContractDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePlanValidationTestContractDocument(documentText);
}

describe('create plan validation test contract declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 plan validation test contract');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('test file path pins the canonical Bun test module', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.testFilePath).toBe(CANONICAL_TEST_FILE_PATH);
    expect(existsSync(CANONICAL_TEST_FILE_PATH)).toBe(true);
    expect(statSync(CANONICAL_TEST_FILE_PATH).isFile()).toBe(true);
  });

  test('test runner pins the canonical bun:test module name', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.testRunner).toBe(CANONICAL_TEST_RUNNER);
  });

  test('focused test invocation pins the canonical bun test command path', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.focusedTestInvocation).toBe(CANONICAL_FOCUSED_TEST_INVOCATION);
  });

  test('top-level describe block pins the canonical describe label used in validate-plan.test.ts', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.topLevelDescribeBlock).toBe(CANONICAL_TOP_LEVEL_DESCRIBE_BLOCK);
  });

  test('total test count pins the canonical nine declared tests', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.totalTestCount).toBe(String(CANONICAL_TOTAL_TEST_COUNT));
  });

  test('test names equal the canonical nine entries in canonical declaration order with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.testNames).toEqual(CANONICAL_TEST_NAMES);
    expect(parsed.testNames).toHaveLength(CANONICAL_TOTAL_TEST_COUNT);
    expect(new Set(parsed.testNames).size).toBe(parsed.testNames.length);
  });

  test('imported source path pins the relative module specifier validate-plan.test.ts uses', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.importedSourcePath).toBe(CANONICAL_IMPORTED_SOURCE_PATH);
  });

  test('imported public surfaces equal the canonical four entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.importedPublicSurfaces).toEqual(CANONICAL_IMPORTED_PUBLIC_SURFACES);
    expect(parsed.importedPublicSurfaces).toHaveLength(CANONICAL_IMPORTED_PUBLIC_SURFACE_COUNT);
    expect(new Set(parsed.importedPublicSurfaces).size).toBe(parsed.importedPublicSurfaces.length);
    expect(parsed.importedPublicSurfaceCount).toBe(String(CANONICAL_IMPORTED_PUBLIC_SURFACE_COUNT));
    const ascendingSortedSurfaces = [...parsed.importedPublicSurfaces].sort();
    expect(parsed.importedPublicSurfaces).toEqual(ascendingSortedSurfaces);
  });

  test('pinned constants equal the canonical three entries with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.pinnedConstants).toEqual(CANONICAL_PINNED_CONSTANTS);
    expect(parsed.pinnedConstants).toHaveLength(CANONICAL_PINNED_CONSTANT_COUNT);
    expect(new Set(parsed.pinnedConstants).size).toBe(parsed.pinnedConstants.length);
    expect(parsed.pinnedConstantCount).toBe(String(CANONICAL_PINNED_CONSTANT_COUNT));
  });

  test('expectedTotalSteps value pins 398 to match EXPECTED_TOTAL_STEPS in validate-plan.ts', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.expectedTotalStepsValue).toBe(CANONICAL_EXPECTED_TOTAL_STEPS_VALUE);
  });

  test('finalGateStepId value pins 13-004 to match FINAL_GATE_STEP_ID in validate-plan.ts', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.finalGateStepIdValue).toBe(CANONICAL_FINAL_GATE_STEP_ID_VALUE);
  });

  test('finalGateSlug value pins the canonical final side-by-side gate slug', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.finalGateSlugValue).toBe(CANONICAL_FINAL_GATE_SLUG_VALUE);
  });

  test('fixture root path prefix names mkdtemp, process.cwd, and the canonical .cache prefix', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureRootPathPrefix).toContain(CANONICAL_FIXTURE_ROOT_PATH_PREFIX);
    expect(parsed.fixtureRootPathPrefix).toContain('mkdtemp');
    expect(parsed.fixtureRootPathPrefix).toContain('process.cwd()');
    expect(parsed.fixtureRootPathPrefix).toContain('withPlanFixture');
    expect(parsed.fixtureRootPathPrefix).toContain('plan_vanilla_parity/');
  });

  test('fixture helpers equal the canonical eight entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureHelpers).toEqual(CANONICAL_FIXTURE_HELPERS);
    expect(parsed.fixtureHelpers).toHaveLength(CANONICAL_FIXTURE_HELPER_COUNT);
    expect(new Set(parsed.fixtureHelpers).size).toBe(parsed.fixtureHelpers.length);
    expect(parsed.fixtureHelperCount).toBe(String(CANONICAL_FIXTURE_HELPER_COUNT));
    const ascendingSortedHelpers = [...parsed.fixtureHelpers].sort();
    expect(parsed.fixtureHelpers).toEqual(ascendingSortedHelpers);
  });

  test('internal interfaces equal the canonical two entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.internalInterfaces).toEqual(CANONICAL_INTERNAL_INTERFACES);
    expect(parsed.internalInterfaces).toHaveLength(CANONICAL_INTERNAL_INTERFACE_COUNT);
    expect(new Set(parsed.internalInterfaces).size).toBe(parsed.internalInterfaces.length);
    expect(parsed.internalInterfaceCount).toBe(String(CANONICAL_INTERNAL_INTERFACE_COUNT));
    const ascendingSortedInterfaces = [...parsed.internalInterfaces].sort();
    expect(parsed.internalInterfaces).toEqual(ascendingSortedInterfaces);
  });

  test('node modules equal the canonical two entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.nodeModules).toEqual(CANONICAL_NODE_MODULES);
    expect(parsed.nodeModules).toHaveLength(CANONICAL_NODE_MODULE_COUNT);
    expect(new Set(parsed.nodeModules).size).toBe(parsed.nodeModules.length);
    expect(parsed.nodeModuleCount).toBe(String(CANONICAL_NODE_MODULE_COUNT));
    const ascendingSortedModules = [...parsed.nodeModules].sort();
    expect(parsed.nodeModules).toEqual(ascendingSortedModules);
  });

  test('node:fs/promises imported names equal the canonical four entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.nodeFsPromisesImportedNames).toEqual(CANONICAL_NODE_FS_PROMISES_IMPORTED_NAMES);
    expect(new Set(parsed.nodeFsPromisesImportedNames).size).toBe(parsed.nodeFsPromisesImportedNames.length);
    const ascendingSortedNames = [...parsed.nodeFsPromisesImportedNames].sort();
    expect(parsed.nodeFsPromisesImportedNames).toEqual(ascendingSortedNames);
  });

  test('node:path imported names equal the canonical two entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.nodePathImportedNames).toEqual(CANONICAL_NODE_PATH_IMPORTED_NAMES);
    expect(new Set(parsed.nodePathImportedNames).size).toBe(parsed.nodePathImportedNames.length);
    const ascendingSortedNames = [...parsed.nodePathImportedNames].sort();
    expect(parsed.nodePathImportedNames).toEqual(ascendingSortedNames);
  });

  test('bun:test imports equal the canonical three entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.bunTestImports).toEqual(CANONICAL_BUN_TEST_IMPORTS);
    expect(parsed.bunTestImports).toHaveLength(CANONICAL_BUN_TEST_IMPORT_COUNT);
    expect(new Set(parsed.bunTestImports).size).toBe(parsed.bunTestImports.length);
    expect(parsed.bunTestImportCount).toBe(String(CANONICAL_BUN_TEST_IMPORT_COUNT));
    const ascendingSortedImports = [...parsed.bunTestImports].sort();
    expect(parsed.bunTestImports).toEqual(ascendingSortedImports);
  });

  test('required fixture plan files equal the canonical twelve entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.requiredFixturePlanFiles).toEqual(CANONICAL_REQUIRED_FIXTURE_PLAN_FILES);
    expect(parsed.requiredFixturePlanFiles).toHaveLength(CANONICAL_REQUIRED_FIXTURE_PLAN_FILE_COUNT);
    expect(new Set(parsed.requiredFixturePlanFiles).size).toBe(parsed.requiredFixturePlanFiles.length);
    expect(parsed.requiredFixturePlanFileCount).toBe(String(CANONICAL_REQUIRED_FIXTURE_PLAN_FILE_COUNT));
    const ascendingSortedFiles = [...parsed.requiredFixturePlanFiles].sort();
    expect(parsed.requiredFixturePlanFiles).toEqual(ascendingSortedFiles);
  });

  test('fixture step generation rule names every step generation invariant from createFixtureSteps', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureStepGenerationRule).toContain('createFixtureSteps');
    expect(parsed.fixtureStepGenerationRule).toContain('expectedTotalSteps');
    expect(parsed.fixtureStepGenerationRule).toContain('398');
    expect(parsed.fixtureStepGenerationRule).toContain('00-001');
    expect(parsed.fixtureStepGenerationRule).toContain('establish-vanilla-parity-control-center');
    expect(parsed.fixtureStepGenerationRule).toContain('Establish Vanilla Parity Control Center');
    expect(parsed.fixtureStepGenerationRule).toContain('00-397');
    expect(parsed.fixtureStepGenerationRule).toContain('generated-step-NNN');
    expect(parsed.fixtureStepGenerationRule).toContain('Generated Step NNN');
    expect(parsed.fixtureStepGenerationRule).toContain('13-004');
    expect(parsed.fixtureStepGenerationRule).toContain('gate-full-final-side-by-side-proof');
    expect(parsed.fixtureStepGenerationRule).toContain('Gate Full Final Side By Side Proof');
    expect(parsed.fixtureStepGenerationRule).toContain('governance');
    expect(parsed.fixtureStepGenerationRule).toContain('acceptance');
    expect(parsed.fixtureStepGenerationRule).toContain('parsePrerequisites');
    expect(parsed.fixtureStepGenerationRule).toContain('validateStepText');
  });

  test('fixture step text shape names every required-field invariant from createStepText', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureStepTextShape).toContain('createStepText');
    expect(parsed.fixtureStepTextShape).toContain('# [ ] STEP <id>: <title>');
    expect(parsed.fixtureStepTextShape).toContain('REQUIRED_STEP_FIELDS');
    expect(parsed.fixtureStepTextShape).toContain('id');
    expect(parsed.fixtureStepTextShape).toContain('lane');
    expect(parsed.fixtureStepTextShape).toContain('title');
    expect(parsed.fixtureStepTextShape).toContain('goal');
    expect(parsed.fixtureStepTextShape).toContain('prerequisites');
    expect(parsed.fixtureStepTextShape).toContain('parallel-safe-with');
    expect(parsed.fixtureStepTextShape).toContain('write lock');
    expect(parsed.fixtureStepTextShape).toContain('read-only paths');
    expect(parsed.fixtureStepTextShape).toContain('research sources');
    expect(parsed.fixtureStepTextShape).toContain('expected changes');
    expect(parsed.fixtureStepTextShape).toContain('test files');
    expect(parsed.fixtureStepTextShape).toContain('verification commands');
    expect(parsed.fixtureStepTextShape).toContain('completion criteria');
    expect(parsed.fixtureStepTextShape).toContain('final evidence');
    expect(parsed.fixtureStepTextShape).toContain('bun run format');
    expect(parsed.fixtureStepTextShape).toContain('bun test test/vanilla_parity/<slug>.test.ts');
    expect(parsed.fixtureStepTextShape).toContain('bun test');
    expect(parsed.fixtureStepTextShape).toContain('bun x tsc --noEmit --project tsconfig.json');
    expect(parsed.fixtureStepTextShape).toContain('REQUIRED_FINAL_GATE_PHRASES');
    expect(parsed.fixtureStepTextShape).toContain('REJECTED_FINAL_EVIDENCE_PATTERNS');
    expect(parsed.fixtureStepTextShape).toContain('validateStepText');
    expect(parsed.fixtureStepTextShape).toContain('validateFinalGate');
  });

  test('fixture override hooks equal the canonical three entries ASCIIbetically sorted with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureOverrideHooks).toEqual(CANONICAL_FIXTURE_OVERRIDE_HOOKS);
    expect(parsed.fixtureOverrideHooks).toHaveLength(CANONICAL_FIXTURE_OVERRIDE_HOOK_COUNT);
    expect(new Set(parsed.fixtureOverrideHooks).size).toBe(parsed.fixtureOverrideHooks.length);
    expect(parsed.fixtureOverrideHookCount).toBe(String(CANONICAL_FIXTURE_OVERRIDE_HOOK_COUNT));
    const ascendingSortedHooks = [...parsed.fixtureOverrideHooks].sort();
    expect(parsed.fixtureOverrideHooks).toEqual(ascendingSortedHooks);
  });

  test('test 1 contract section names validatePlan, the canonical first step id, and the canonical 398 total step count', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test1).toContain('accepts the generated vanilla parity plan');
    expect(parsed.test1).toContain('validatePlan()');
    expect(parsed.test1).toContain('DEFAULT_PLAN_DIRECTORY');
    expect(parsed.test1).toContain('import.meta.dir');
    expect(parsed.test1).toContain('result.errors');
    expect(parsed.test1).toContain('result.firstStep');
    expect(parsed.test1).toContain('result.totalSteps');
    expect(parsed.test1).toContain('00-001');
    expect(parsed.test1).toContain('expectedTotalSteps');
    expect(parsed.test1).toContain('398');
  });

  test('test 2 contract section names parseChecklist, MASTER_CHECKLIST.md, the canonical first and last step ids, and PLAN_VALIDATION_COMMAND', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test2).toContain('parses the generated checklist and locks the validation command');
    expect(parsed.test2).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.test2).toContain('Bun.file');
    expect(parsed.test2).toContain('parseChecklist');
    expect(parsed.test2).toContain('expectedTotalSteps');
    expect(parsed.test2).toContain('00-001');
    expect(parsed.test2).toContain('finalGateStepId');
    expect(parsed.test2).toContain('13-004');
    expect(parsed.test2).toContain('PLAN_VALIDATION_COMMAND');
    expect(parsed.test2).toContain('bun run plan_vanilla_parity/validate-plan.ts');
    expect(parsed.test2).toContain('CHECKLIST_LINE_PATTERN');
  });

  test('test 3 contract section names withPlanFixture, validatePlan, and the explicit planDirectory argument', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test3).toContain('accepts a complete fixture through an explicit plan directory');
    expect(parsed.test3).toContain('withPlanFixture');
    expect(parsed.test3).toContain('validatePlan(planDirectory)');
    expect(parsed.test3).toContain('errors: []');
    expect(parsed.test3).toContain('00-001');
    expect(parsed.test3).toContain('expectedTotalSteps');
    expect(parsed.test3).toContain('createFixtureSteps');
    expect(parsed.test3).toContain('createMasterChecklist');
    expect(parsed.test3).toContain('createParallelWorkText');
    expect(parsed.test3).toContain('createRequiredPlanFiles');
    expect(parsed.test3).toContain('createStepText');
    expect(parsed.test3).toContain('import.meta.dir');
  });

  test('test 4 contract section names the canonical step-fields diagnostic and the canonical 00-001 step file path', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test4).toContain('reports missing required step fields');
    expect(parsed.test4).toContain('createStepText');
    expect(parsed.test4).toContain('## final evidence');
    expect(parsed.test4).toContain('- Focused evidence is committed and pushed.');
    expect(parsed.test4).toContain('plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md');
    expect(parsed.test4).toContain(
      'Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.',
    );
    expect(parsed.test4).toContain('validateStepText');
    expect(parsed.test4).toContain('REQUIRED_STEP_FIELDS');
  });

  test('test 5 contract section names the canonical banned-tool diagnostic and the npm test override', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test5).toContain('rejects banned verification commands');
    expect(parsed.test5).toContain('verificationCommands');
    expect(parsed.test5).toContain('npm test');
    expect(parsed.test5).toContain('plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md');
    expect(parsed.test5).toContain('Verification command uses a banned tool: npm test.');
    expect(parsed.test5).toContain('usesBannedCommand');
    expect(parsed.test5).toContain('BANNED_COMMANDS');
    expect(parsed.test5).toContain('validateStepText');
  });

  test('test 6 contract section names the canonical read-only-root diagnostic and the doom/ override', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test6).toContain('rejects write locks inside read-only reference roots');
    expect(parsed.test6).toContain('writeLock');
    expect(parsed.test6).toContain('doom/DOOM1.WAD');
    expect(parsed.test6).toContain('plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md');
    expect(parsed.test6).toContain('Write lock is inside read-only reference root: doom/DOOM1.WAD.');
    expect(parsed.test6).toContain('validateWritablePath');
    expect(parsed.test6).toContain('READ_ONLY_ROOTS');
  });

  test('test 7 contract section names the canonical rejected-pattern diagnostic and the final-gate override', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test7).toContain('rejects final gate evidence that relies on deferred or manifest-only proof');
    expect(parsed.test7).toContain('finalEvidence');
    expect(parsed.test7).toContain('A pending manifest-only sampled-only declared intent report.');
    expect(parsed.test7).toContain('plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md');
    expect(parsed.test7).toContain('Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.');
    expect(parsed.test7).toContain('validateFinalGate');
    expect(parsed.test7).toContain('REJECTED_FINAL_EVIDENCE_PATTERNS');
    expect(parsed.test7).toContain('## final evidence');
  });

  test('test 8 contract section names the canonical scope-overlap diagnostic and the PARALLEL_WORK.md override', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test8).toContain('rejects overlapping lane write scopes');
    expect(parsed.test8).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.test8).toContain('core');
    expect(parsed.test8).toContain('src/core/');
    expect(parsed.test8).toContain('timing');
    expect(parsed.test8).toContain('src/core/fixed.ts');
    expect(parsed.test8).toContain('Lane write scopes overlap: core owns src/core/ and timing owns src/core/fixed.ts.');
    expect(parsed.test8).toContain('parseLaneWriteScopes');
    expect(parsed.test8).toContain('pathsConflict');
    expect(parsed.test8).toContain('validateParallelWork');
  });

  test('test 9 contract section names runValidationCli, exit code 1, empty stdout, and the canonical stderr diagnostic line', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.test9).toContain('returns CLI diagnostics for invalid fixtures');
    expect(parsed.test9).toContain('runValidationCli');
    expect(parsed.test9).toContain('verificationCommands');
    expect(parsed.test9).toContain('node doom.ts');
    expect(parsed.test9).toContain('1');
    expect(parsed.test9).toContain('stdout');
    expect(parsed.test9).toContain('stderr');
    expect(parsed.test9).toContain('plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md: Verification command uses a banned tool: node doom.ts.');
  });

  test('failure modes equal the canonical six entries with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.failureModes).toEqual(CANONICAL_FAILURE_MODES);
    expect(parsed.failureModes).toHaveLength(CANONICAL_FAILURE_MODE_COUNT);
    expect(new Set(parsed.failureModes).size).toBe(parsed.failureModes.length);
    expect(parsed.failureModeCount).toBe(String(CANONICAL_FAILURE_MODE_COUNT));
  });

  test('fixture isolation rule names mkdtemp, the canonical .cache prefix, withPlanFixture, and per-test uniqueness', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureIsolationRule).toContain('mkdtemp');
    expect(parsed.fixtureIsolationRule).toContain('.cache/plan-vanilla-parity-fixture-');
    expect(parsed.fixtureIsolationRule).toContain('withPlanFixture');
    expect(parsed.fixtureIsolationRule).toContain('process.cwd()');
    expect(parsed.fixtureIsolationRule).toContain('createRequiredPlanFiles');
    expect(parsed.fixtureIsolationRule).toContain('createStepText');
    expect(parsed.fixtureIsolationRule).toContain('writeFixtureFiles');
    expect(parsed.fixtureIsolationRule).toContain('options.overrides');
    expect(parsed.fixtureIsolationRule).toContain('planDirectory');
  });

  test('fixture cleanup rule names the canonical rm call, force/recursive flags, finally block, and the no-real-tree-mutation rule', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.fixtureCleanupRule).toContain('withPlanFixture');
    expect(parsed.fixtureCleanupRule).toContain('finally');
    expect(parsed.fixtureCleanupRule).toContain('rm(fixtureRoot, { force: true, recursive: true })');
    expect(parsed.fixtureCleanupRule).toContain('Bun.write');
    expect(parsed.fixtureCleanupRule).toContain('node:fs/promises');
    expect(parsed.fixtureCleanupRule).toContain('writeFile');
    expect(parsed.fixtureCleanupRule).toContain('mkdir');
    expect(parsed.fixtureCleanupRule).toContain('.cache/plan-vanilla-parity-fixture-');
    expect(parsed.fixtureCleanupRule).toContain('plan_vanilla_parity/');
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, every adjacent governance pin, the validate-plan helper plus its test, and the step file', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      CONTROL_CENTER_PATH,
      CREATE_PLAN_VALIDATION_SCRIPT_CONTRACT_PATH,
      DEFINE_FINAL_ACCEPTANCE_STANDARD_PATH,
      DEFINE_LANE_WRITE_LOCK_CONTRACT_PATH,
      DEFINE_STEP_FILE_REQUIRED_FIELDS_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      STEP_FILE_PATH,
      STEP_TEMPLATE_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity validate-plan.test.ts source imports the canonical four public surfaces from validate-plan.ts as one ASCIIbetically sorted statement', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain(`import { ${CANONICAL_IMPORTED_PUBLIC_SURFACES.join(', ')} } from '${CANONICAL_IMPORTED_SOURCE_PATH}';`);
  });

  test('plan_vanilla_parity validate-plan.test.ts source imports the canonical four node:fs/promises names as one statement', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain(`import { ${CANONICAL_NODE_FS_PROMISES_IMPORTED_NAMES.join(', ')} } from 'node:fs/promises';`);
  });

  test('plan_vanilla_parity validate-plan.test.ts source imports the canonical two node:path names as one statement', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain(`import { ${CANONICAL_NODE_PATH_IMPORTED_NAMES.join(', ')} } from 'node:path';`);
  });

  test('plan_vanilla_parity validate-plan.test.ts source imports the canonical three bun:test names as one statement', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain(`import { ${CANONICAL_BUN_TEST_IMPORTS.join(', ')} } from 'bun:test';`);
  });

  test('plan_vanilla_parity validate-plan.test.ts source declares the canonical three pinned constants with the canonical literal values', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain(`const expectedTotalSteps = ${CANONICAL_EXPECTED_TOTAL_STEPS_VALUE};`);
    expect(validatePlanTestText).toContain(`const finalGateStepId = '${CANONICAL_FINAL_GATE_STEP_ID_VALUE}';`);
    expect(validatePlanTestText).toContain(`const finalGateSlug = '${CANONICAL_FINAL_GATE_SLUG_VALUE}';`);
  });

  test('plan_vanilla_parity validate-plan.test.ts source declares the canonical top-level describe block', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain(`describe('${CANONICAL_TOP_LEVEL_DESCRIBE_BLOCK}', () => {`);
  });

  test('plan_vanilla_parity validate-plan.test.ts source declares every canonical test name in canonical order', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    let cursor = 0;
    for (const testName of CANONICAL_TEST_NAMES) {
      const needle = `test('${testName}'`;
      const matchIndex = validatePlanTestText.indexOf(needle, cursor);
      expect(matchIndex).toBeGreaterThan(-1);
      cursor = matchIndex + needle.length;
    }
  });

  test('plan_vanilla_parity validate-plan.test.ts source defines every canonical fixture helper as a top-level function', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    for (const fixtureHelper of CANONICAL_FIXTURE_HELPERS) {
      expect(validatePlanTestText).toContain(`function ${fixtureHelper}`);
    }
  });

  test('plan_vanilla_parity validate-plan.test.ts source defines every canonical internal interface', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    for (const internalInterface of CANONICAL_INTERNAL_INTERFACES) {
      expect(validatePlanTestText).toContain(`interface ${internalInterface}`);
    }
  });

  test('plan_vanilla_parity validate-plan.test.ts source roots fixtures via mkdtemp under process.cwd() and the canonical .cache prefix', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain("mkdtemp(join(process.cwd(), '.cache', 'plan-vanilla-parity-fixture-'))");
  });

  test('plan_vanilla_parity validate-plan.test.ts source cleans up fixtures via rm with force and recursive flags inside a finally block', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    expect(validatePlanTestText).toContain('finally');
    expect(validatePlanTestText).toContain('rm(fixtureRoot, { force: true, recursive: true })');
  });

  test('plan_vanilla_parity validate-plan.test.ts source writes every canonical required fixture plan file via createRequiredPlanFiles', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    for (const requiredFixturePlanFile of CANONICAL_REQUIRED_FIXTURE_PLAN_FILES) {
      expect(validatePlanTestText).toContain(requiredFixturePlanFile);
    }
  });

  test('plan_vanilla_parity validate-plan.test.ts source declares every canonical fixture override hook as an option key', async () => {
    const validatePlanTestText = await Bun.file(VALIDATE_PLAN_TEST_PATH).text();
    for (const fixtureOverrideHook of CANONICAL_FIXTURE_OVERRIDE_HOOKS) {
      expect(validatePlanTestText).toContain(`${fixtureOverrideHook}?:`);
    }
  });

  test('CLAUDE.md anchors the Bun runtime line and the read-only reference roots this contract layers atop', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Bun only.');
    expect(claudeText).toContain('`doom/`');
    expect(claudeText).toContain('`iwad/`');
    expect(claudeText).toContain('`reference/`');
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-fabrication core principle', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
    expect(agentsText).toContain('No fabrication');
  });

  test('plan_vanilla_parity README.md anchors the canonical Validation section that names the validator script and its focused test', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    expect(readmeText).toContain('## Validation');
    expect(readmeText).toContain('bun run plan_vanilla_parity/validate-plan.ts');
    expect(readmeText).toContain(CANONICAL_FOCUSED_TEST_INVOCATION);
  });

  test('plan_vanilla_parity PROMPT.md anchors the verification-order line that names the canonical four verification commands', async () => {
    const promptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(promptText).toContain('Verification order is fixed');
    expect(promptText).toContain('bun run format');
    expect(promptText).toContain('bun test <path>');
    expect(promptText).toContain('bun test');
    expect(promptText).toContain('bun x tsc --noEmit --project tsconfig.json');
  });

  test('step 00-016 file declares the governance lane, lists this contract under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-016: Create Plan Validation Test Contract');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/create-plan-validation-test-contract.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/create-plan-validation-test-contract.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-016 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-016` `create-plan-validation-test-contract` | lane: `governance` | prereqs: `00-015` | file: `plan_vanilla_parity/steps/00-016-create-plan-validation-test-contract.md`';
    const expectedCompletedRow = '- [x] `00-016` `create-plan-validation-test-contract` | lane: `governance` | prereqs: `00-015` | file: `plan_vanilla_parity/steps/00-016-create-plan-validation-test-contract.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the canonical test file path, the canonical focused test invocation, every canonical imported public surface, every canonical pinned constant, every canonical fixture helper, every canonical internal interface, every canonical required fixture plan file, every canonical fixture override hook, and every canonical failure mode trigger', async () => {
    const parsed = await loadPlanValidationTestContractDocument();
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_TEST_FILE_PATH}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_FOCUSED_TEST_INVOCATION}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_TEST_RUNNER}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_TOP_LEVEL_DESCRIBE_BLOCK}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`${CANONICAL_IMPORTED_SOURCE_PATH}\``);
    for (const importedPublicSurface of CANONICAL_IMPORTED_PUBLIC_SURFACES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${importedPublicSurface}\``);
    }
    expect(parsed.acceptancePhrasing).toContain(`\`expectedTotalSteps = ${CANONICAL_EXPECTED_TOTAL_STEPS_VALUE}\``);
    expect(parsed.acceptancePhrasing).toContain(`\`finalGateStepId = '${CANONICAL_FINAL_GATE_STEP_ID_VALUE}'\``);
    expect(parsed.acceptancePhrasing).toContain(`\`finalGateSlug = '${CANONICAL_FINAL_GATE_SLUG_VALUE}'\``);
    for (const testName of CANONICAL_TEST_NAMES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${testName}\``);
    }
    for (const fixtureHelper of CANONICAL_FIXTURE_HELPERS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${fixtureHelper}\``);
    }
    for (const internalInterface of CANONICAL_INTERNAL_INTERFACES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${internalInterface}\``);
    }
    for (const requiredFixturePlanFile of CANONICAL_REQUIRED_FIXTURE_PLAN_FILES) {
      const baseName = requiredFixturePlanFile.replace('plan_vanilla_parity/', '');
      expect(parsed.acceptancePhrasing).toContain(`\`${baseName}\``);
    }
    for (const fixtureOverrideHook of CANONICAL_FIXTURE_OVERRIDE_HOOKS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${fixtureOverrideHook}\``);
    }
    for (const nodeFsPromisesImportedName of CANONICAL_NODE_FS_PROMISES_IMPORTED_NAMES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${nodeFsPromisesImportedName}\``);
    }
    for (const nodePathImportedName of CANONICAL_NODE_PATH_IMPORTED_NAMES) {
      expect(parsed.acceptancePhrasing).toContain(`\`${nodePathImportedName}\``);
    }
    for (const bunTestImport of CANONICAL_BUN_TEST_IMPORTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${bunTestImport}\``);
    }
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 plan validation test contract\n';
    expect(() => parsePlanValidationTestContractDocument(documentTextWithMissingSection)).toThrow('Section "test names" not found in plan validation test contract document.');
  });

  test('parser surfaces a meaningful error when test names is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## test names\n\n- accepts the generated vanilla parity plan\n- parses the generated checklist and locks the validation command\n- accepts a complete fixture through an explicit plan directory\n- reports missing required step fields\n- rejects banned verification commands\n- rejects write locks inside read-only reference roots\n- rejects final gate evidence that relies on deferred or manifest-only proof\n- rejects overlapping lane write scopes\n- returns CLI diagnostics for invalid fixtures\n/,
      '\n## test names\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationTestContractDocument(corruptedDocumentText)).toThrow('test names must list at least one entry.');
  });

  test('parser surfaces a meaningful error when imported public surfaces is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## imported public surfaces\n\n- PLAN_VALIDATION_COMMAND\n- parseChecklist\n- runValidationCli\n- validatePlan\n/, '\n## imported public surfaces\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationTestContractDocument(corruptedDocumentText)).toThrow('imported public surfaces must list at least one entry.');
  });

  test('parser surfaces a meaningful error when fixture helpers is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## fixture helpers\n\n- createChecklistLine\n- createFixtureSteps\n- createMasterChecklist\n- createParallelWorkText\n- createRequiredPlanFiles\n- createStepText\n- withPlanFixture\n- writeFixtureFiles\n/,
      '\n## fixture helpers\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationTestContractDocument(corruptedDocumentText)).toThrow('fixture helpers must list at least one entry.');
  });

  test('parser surfaces a meaningful error when failure modes is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## failure modes\n\n- missing required step fields produces the canonical step-fields diagnostic\n- banned verification command produces the canonical banned-tool diagnostic\n- write lock inside read-only reference root produces the canonical read-only-root diagnostic\n- final gate evidence containing a rejected pattern produces the canonical rejected-pattern diagnostic\n- overlapping lane write scopes produces the canonical scope-overlap diagnostic\n- CLI invocation against an invalid fixture surfaces stderr diagnostics and returns exit code 1\n/,
      '\n## failure modes\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePlanValidationTestContractDocument(corruptedDocumentText)).toThrow('failure modes must list at least one entry.');
  });
});
