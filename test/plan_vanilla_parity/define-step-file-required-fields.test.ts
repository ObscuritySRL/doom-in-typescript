import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const REFERENCE_STEP_PATH = 'plan_vanilla_parity/steps/00-007-ban-non-bun-runtime-and-package-commands.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-008-define-step-file-required-fields.md';
const STEP_TEMPLATE_PATH = 'plan_vanilla_parity/STEP_TEMPLATE.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_REQUIRED_STEP_FIELD_ORDER: readonly string[] = [
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

const CANONICAL_REQUIRED_STEP_FIELD_COUNT = 14;

const CANONICAL_READ_ONLY_REFERENCE_ROOTS: readonly string[] = ['doom/', 'iwad/', 'reference/'];

const CANONICAL_BANNED_VERIFICATION_COMMANDS: readonly string[] = ['jest', 'mocha', 'node', 'npm', 'npx', 'pnpm', 'ts-node', 'tsx', 'vitest', 'yarn'];

const CANONICAL_VERIFICATION_COMMANDS: readonly string[] = ['bun run format', 'bun test <focused>', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'];

const CANONICAL_FIELD_CONTRACT_HEADINGS: readonly string[] = CANONICAL_REQUIRED_STEP_FIELD_ORDER.map((field) => `${field} field contract`);

interface PinDefineStepFileRequiredFieldsDocument {
  readonly acceptancePhrasing: string;
  readonly bannedVerificationCommandRule: string;
  readonly bannedVerificationCommands: readonly string[];
  readonly canonicalVerificationCommands: readonly string[];
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly fieldContracts: ReadonlyMap<string, string>;
  readonly fieldsExactlyMatchRule: string;
  readonly idAndLaneConsistencyRule: string;
  readonly nonEmptyFieldRule: string;
  readonly prerequisitesEntryRule: string;
  readonly readOnlyReferenceRoots: readonly string[];
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly requiredStepFieldCount: string;
  readonly requiredStepFieldOrder: readonly string[];
  readonly scopeName: string;
  readonly stepHeadingFormatRule: string;
  readonly testFilesMinimumRule: string;
  readonly verificationCommandInclusionRule: string;
  readonly writeLockPathRule: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in define step file required fields document.`);
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

function parsePinDefineStepFileRequiredFieldsDocument(documentText: string): PinDefineStepFileRequiredFieldsDocument {
  const requiredStepFieldOrder = extractBullets(documentText, 'required step field order');
  if (requiredStepFieldOrder.length === 0) {
    throw new Error('required step field order must list at least one field.');
  }

  const readOnlyReferenceRoots = extractBullets(documentText, 'read-only reference roots');
  if (readOnlyReferenceRoots.length === 0) {
    throw new Error('read-only reference roots must list at least one root.');
  }

  const canonicalVerificationCommands = extractBullets(documentText, 'canonical verification commands');
  if (canonicalVerificationCommands.length === 0) {
    throw new Error('canonical verification commands must list at least one command.');
  }

  const bannedVerificationCommands = extractBullets(documentText, 'banned verification commands');
  if (bannedVerificationCommands.length === 0) {
    throw new Error('banned verification commands must list at least one command.');
  }

  const fieldContracts = new Map<string, string>();
  for (const fieldName of requiredStepFieldOrder) {
    fieldContracts.set(fieldName, extractSection(documentText, `${fieldName} field contract`));
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    bannedVerificationCommandRule: extractSection(documentText, 'banned verification command rule'),
    bannedVerificationCommands,
    canonicalVerificationCommands,
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    fieldContracts,
    fieldsExactlyMatchRule: extractSection(documentText, 'fields exactly match rule'),
    idAndLaneConsistencyRule: extractSection(documentText, 'id and lane consistency rule'),
    nonEmptyFieldRule: extractSection(documentText, 'non-empty field rule'),
    prerequisitesEntryRule: extractSection(documentText, 'prerequisites entry rule'),
    readOnlyReferenceRoots,
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    requiredStepFieldCount: extractSection(documentText, 'required step field count'),
    requiredStepFieldOrder,
    scopeName: extractSection(documentText, 'scope name'),
    stepHeadingFormatRule: extractSection(documentText, 'step heading format rule'),
    testFilesMinimumRule: extractSection(documentText, 'test files minimum rule'),
    verificationCommandInclusionRule: extractSection(documentText, 'verification command inclusion rule'),
    writeLockPathRule: extractSection(documentText, 'write lock path rule'),
  };
}

async function loadPinDefineStepFileRequiredFieldsDocument(): Promise<PinDefineStepFileRequiredFieldsDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinDefineStepFileRequiredFieldsDocument(documentText);
}

describe('define step file required fields declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 step file required fields');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('required step field count is exactly 14 and matches the parsed field order length', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.requiredStepFieldCount).toBe(String(CANONICAL_REQUIRED_STEP_FIELD_COUNT));
    expect(parsed.requiredStepFieldOrder).toHaveLength(CANONICAL_REQUIRED_STEP_FIELD_COUNT);
  });

  test('required step field order is the canonical fourteen fields in the canonical order with no duplicates', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.requiredStepFieldOrder).toEqual(CANONICAL_REQUIRED_STEP_FIELD_ORDER);
    expect(new Set(parsed.requiredStepFieldOrder).size).toBe(parsed.requiredStepFieldOrder.length);
  });

  test('every required field has a non-empty per-field contract section', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    for (const fieldName of CANONICAL_REQUIRED_STEP_FIELD_ORDER) {
      const contract = parsed.fieldContracts.get(fieldName);
      expect(contract).toBeDefined();
      expect((contract ?? '').length).toBeGreaterThan(0);
    }
  });

  test('per-field contracts mention the field name they describe', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    for (const fieldName of CANONICAL_REQUIRED_STEP_FIELD_ORDER) {
      const contract = parsed.fieldContracts.get(fieldName) ?? '';
      expect(contract).toContain(`\`${fieldName}\``);
    }
  });

  test('id field contract pins the NN-NNN regex and the MASTER_CHECKLIST id-column equality', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const contract = parsed.fieldContracts.get('id') ?? '';
    expect(contract).toContain('NN-NNN');
    expect(contract).toContain('^\\d{2}-\\d{3}$');
    expect(contract).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(contract).toContain('# [ ] STEP <id>: <Title>');
  });

  test('lane field contract pins the lowercase slug requirement and the MASTER_CHECKLIST lane-column equality', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const contract = parsed.fieldContracts.get('lane') ?? '';
    expect(contract).toContain('lowercase');
    expect(contract).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(contract).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    for (const laneSlug of ['governance', 'inventory', 'oracle', 'launch', 'core', 'wad']) {
      expect(contract).toContain(`\`${laneSlug}\``);
    }
  });

  test('prerequisites field contract pins the none-or-prior-id rule and the bullet-list shape', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const contract = parsed.fieldContracts.get('prerequisites') ?? '';
    expect(contract).toContain('`none`');
    expect(contract).toContain('NN-NNN');
    expect(contract).toContain('bullet list');
    expect(contract).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
  });

  test('write lock field contract pins the read-only-root prohibition and the workspace-escape prohibition', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const contract = parsed.fieldContracts.get('write lock') ?? '';
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(contract).toContain(`\`${readOnlyRoot}\``);
    }
    expect(contract).toContain('../');
    expect(contract).toContain('expected changes');
  });

  test('test files field contract pins the at-least-one rule and the focused bun:test path requirement', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const contract = parsed.fieldContracts.get('test files') ?? '';
    expect(contract).toContain('focused');
    expect(contract).toContain('bun:test');
    expect(contract).toContain('at least one');
  });

  test('verification commands field contract pins the four canonical commands in canonical order', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const contract = parsed.fieldContracts.get('verification commands') ?? '';
    expect(contract).toContain('bun run format');
    expect(contract).toContain('bun test <focused>');
    expect(contract).toContain('bun test');
    expect(contract).toContain('bun x tsc --noEmit --project tsconfig.json');
    for (const bannedCommand of CANONICAL_BANNED_VERIFICATION_COMMANDS) {
      expect(contract).toContain(`\`${bannedCommand}\``);
    }
  });

  test('read-only reference roots are the canonical doom/, iwad/, reference/ trio', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.readOnlyReferenceRoots).toEqual(CANONICAL_READ_ONLY_REFERENCE_ROOTS);
    expect(new Set(parsed.readOnlyReferenceRoots).size).toBe(parsed.readOnlyReferenceRoots.length);
  });

  test('canonical verification commands list the four canonical commands in canonical order', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.canonicalVerificationCommands).toEqual(CANONICAL_VERIFICATION_COMMANDS);
  });

  test('banned verification commands cover the canonical ten non-Bun tools, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.bannedVerificationCommands).toEqual(CANONICAL_BANNED_VERIFICATION_COMMANDS);
    expect(parsed.bannedVerificationCommands).toHaveLength(10);
    expect(new Set(parsed.bannedVerificationCommands).size).toBe(parsed.bannedVerificationCommands.length);
    const ascendingSortedCommands = [...parsed.bannedVerificationCommands].sort();
    expect(parsed.bannedVerificationCommands).toEqual(ascendingSortedCommands);
  });

  test('step heading format rule pins the # [ ] STEP <id>: <Title> heading template', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.stepHeadingFormatRule).toContain('# [ ] STEP <id>: <Title>');
    expect(parsed.stepHeadingFormatRule).toContain('# [x] STEP <id>: <Title>');
    expect(parsed.stepHeadingFormatRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
  });

  test('fields exactly match rule pins the exact validate-plan diagnostic message', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.fieldsExactlyMatchRule).toContain(
      'Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.',
    );
    expect(parsed.fieldsExactlyMatchRule).toContain('plan_vanilla_parity/validate-plan.ts');
  });

  test('non-empty field rule pins the exact validate-plan diagnostic message', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.nonEmptyFieldRule).toContain('Missing or empty required field: <field>.');
  });

  test('id and lane consistency rule pins MASTER_CHECKLIST id, lane, and prereqs equality', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.idAndLaneConsistencyRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.idAndLaneConsistencyRule).toContain('id');
    expect(parsed.idAndLaneConsistencyRule).toContain('lane');
    expect(parsed.idAndLaneConsistencyRule).toContain('prereqs');
  });

  test('prerequisites entry rule pins the none-or-existing-prior-step rule', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.prerequisitesEntryRule).toContain('`none`');
    expect(parsed.prerequisitesEntryRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
  });

  test('write lock path rule pins the read-only-root and workspace-escape prohibitions and the validateWritablePath helper', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.writeLockPathRule).toContain('../');
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.writeLockPathRule).toContain(`\`${readOnlyRoot}\``);
    }
    expect(parsed.writeLockPathRule).toContain('validateWritablePath');
    expect(parsed.writeLockPathRule).toContain('plan_vanilla_parity/validate-plan.ts');
  });

  test('test files minimum rule pins the at-least-one focused test rule and the validate-plan diagnostic message', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.testFilesMinimumRule).toContain('Step must list at least one focused test file.');
  });

  test('verification command inclusion rule pins all four validate-plan diagnostic messages', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.verificationCommandInclusionRule).toContain('Verification must include bun run format.');
    expect(parsed.verificationCommandInclusionRule).toContain('Verification must include the focused bun test command.');
    expect(parsed.verificationCommandInclusionRule).toContain('Verification must include full bun test.');
    expect(parsed.verificationCommandInclusionRule).toContain('Verification must include the Bun typecheck command.');
  });

  test('banned verification command rule pins the validate-plan helper and diagnostic message', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.bannedVerificationCommandRule).toContain('usesBannedCommand');
    expect(parsed.bannedVerificationCommandRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.bannedVerificationCommandRule).toContain('Verification command uses a banned tool: <command>.');
    expect(parsed.bannedVerificationCommandRule).toContain('bun x');
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, plan_vanilla_parity governance files, the reference step, and the validator', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    const requiredEvidence: readonly string[] = [AGENTS_PATH, CLAUDE_PATH, MASTER_CHECKLIST_PATH, PARALLEL_WORK_PATH, PLAN_PROMPT_PATH, PLAN_README_PATH, STEP_TEMPLATE_PATH, REFERENCE_STEP_PATH, VALIDATE_PLAN_PATH, VALIDATE_PLAN_TEST_PATH];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity validate-plan.ts REQUIRED_STEP_FIELDS literal contains exactly the canonical fourteen field names this document freezes', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('const REQUIRED_STEP_FIELDS = [');
    const requiredStepFieldsLiteralPattern = /const REQUIRED_STEP_FIELDS = \[([^\]]+)\] as const;/;
    const requiredStepFieldsLiteralMatch = requiredStepFieldsLiteralPattern.exec(validatePlanText);
    expect(requiredStepFieldsLiteralMatch).not.toBeNull();
    if (requiredStepFieldsLiteralMatch === null) {
      return;
    }
    const literalBody = requiredStepFieldsLiteralMatch[1] ?? '';
    const requiredFields: readonly string[] = literalBody
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter((entry) => entry.length > 0);
    expect(requiredFields).toEqual(CANONICAL_REQUIRED_STEP_FIELD_ORDER);
  });

  test('plan_vanilla_parity validate-plan.ts READ_ONLY_ROOTS literal contains exactly the three roots this document freezes', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain("const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;");
  });

  test('plan_vanilla_parity STEP_TEMPLATE.md declares every canonical field heading in canonical order', async () => {
    const stepTemplateText = await Bun.file(STEP_TEMPLATE_PATH).text();
    const headings: readonly string[] = [...stepTemplateText.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
    expect(headings).toEqual(CANONICAL_REQUIRED_STEP_FIELD_ORDER);
    expect(stepTemplateText.startsWith('# [ ] STEP <id>: <Title>')).toBe(true);
  });

  test('plan_vanilla_parity STEP_TEMPLATE.md declares the four canonical verification commands in canonical order', async () => {
    const stepTemplateText = await Bun.file(STEP_TEMPLATE_PATH).text();
    expect(stepTemplateText).toContain('- `bun run format`');
    expect(stepTemplateText).toContain('- `bun test <focused bun:test path>`');
    expect(stepTemplateText).toContain('- `bun test`');
    expect(stepTemplateText).toContain('- `bun x tsc --noEmit --project tsconfig.json`');
  });

  test('reference step 00-007 declares every canonical field heading in canonical order', async () => {
    expect(existsSync(REFERENCE_STEP_PATH)).toBe(true);
    const referenceStepText = await Bun.file(REFERENCE_STEP_PATH).text();
    const headings: readonly string[] = [...referenceStepText.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
    expect(headings).toEqual(CANONICAL_REQUIRED_STEP_FIELD_ORDER);
    expect(referenceStepText.startsWith('# [ ] STEP 00-007: Ban Non Bun Runtime And Package Commands')).toBe(true);
  });

  test('every committed step file under plan_vanilla_parity/steps/ declares the canonical fourteen headings in the canonical order', async () => {
    const stepsGlob = new Bun.Glob('plan_vanilla_parity/steps/*.md');
    const stepFilePaths: string[] = [];
    for await (const stepFilePath of stepsGlob.scan({ cwd: '.' })) {
      stepFilePaths.push(stepFilePath.replace(/\\/g, '/'));
    }
    expect(stepFilePaths.length).toBeGreaterThanOrEqual(CANONICAL_REQUIRED_STEP_FIELD_COUNT);

    for (const stepFilePath of stepFilePaths) {
      const stepText = await Bun.file(stepFilePath).text();
      const headings: readonly string[] = [...stepText.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
      expect(headings).toEqual(CANONICAL_REQUIRED_STEP_FIELD_ORDER);
      expect(stepText.startsWith('# [ ] STEP ')).toBe(true);
    }
  });

  test('AGENTS.md anchors bun run, bun test, and tsc --noEmit as the canonical verification primitives', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('bun run');
    expect(agentsText).toContain('bun test');
    expect(agentsText).toContain('tsc --noEmit');
  });

  test('plan_vanilla_parity PROMPT.md anchors the fixed verification command order this document freezes', async () => {
    const promptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(promptText).toContain('Verification order is fixed');
    expect(promptText).toContain('bun run format');
    expect(promptText).toContain('bun test <path>');
    expect(promptText).toContain('bun test');
    expect(promptText).toContain('bun x tsc --noEmit --project tsconfig.json');
  });

  test('plan_vanilla_parity README.md Ralph-loop rules forbid every banned verification command this document freezes', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    for (const bannedCommand of CANONICAL_BANNED_VERIFICATION_COMMANDS) {
      expect(readmeText).toContain(bannedCommand);
    }
  });

  test('step 00-008 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-008: Define Step File Required Fields');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-step-file-required-fields.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-step-file-required-fields.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-008 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-008` `define-step-file-required-fields` | lane: `governance` | prereqs: `00-007` | file: `plan_vanilla_parity/steps/00-008-define-step-file-required-fields.md`';
    const expectedCompletedRow = '- [x] `00-008` `define-step-file-required-fields` | lane: `governance` | prereqs: `00-007` | file: `plan_vanilla_parity/steps/00-008-define-step-file-required-fields.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names every canonical field in canonical order and the canonical step heading template', async () => {
    const parsed = await loadPinDefineStepFileRequiredFieldsDocument();
    expect(parsed.acceptancePhrasing).toContain('# [ ] STEP <id>: <Title>');
    for (const fieldName of CANONICAL_REQUIRED_STEP_FIELD_ORDER) {
      expect(parsed.acceptancePhrasing).toContain(`\`${fieldName}\``);
    }
  });

  test('document declares per-field-contract headings for every canonical field in canonical order', async () => {
    const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const headings: readonly string[] = [...documentText.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
    for (const expectedFieldContractHeading of CANONICAL_FIELD_CONTRACT_HEADINGS) {
      expect(headings).toContain(expectedFieldContractHeading);
    }
    const fieldContractHeadingsInDocumentOrder: readonly string[] = headings.filter((heading) => heading.endsWith(' field contract'));
    expect(fieldContractHeadingsInDocumentOrder).toEqual(CANONICAL_FIELD_CONTRACT_HEADINGS);
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 step file required fields\n';
    expect(() => parsePinDefineStepFileRequiredFieldsDocument(documentTextWithMissingSection)).toThrow('Section "required step field order" not found in define step file required fields document.');
  });

  test('parser surfaces a meaningful error when required step field order is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## required step field order\n\n- id\n- lane\n- title\n- goal\n- prerequisites\n- parallel-safe-with\n- write lock\n- read-only paths\n- research sources\n- expected changes\n- test files\n- verification commands\n- completion criteria\n- final evidence\n/,
      '\n## required step field order\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinDefineStepFileRequiredFieldsDocument(corruptedDocumentText)).toThrow('required step field order must list at least one field.');
  });

  test('parser surfaces a meaningful error when banned verification commands is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## banned verification commands\n\n- jest\n- mocha\n- node\n- npm\n- npx\n- pnpm\n- ts-node\n- tsx\n- vitest\n- yarn\n/,
      '\n## banned verification commands\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinDefineStepFileRequiredFieldsDocument(corruptedDocumentText)).toThrow('banned verification commands must list at least one command.');
  });
});
