import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const GITIGNORE_PATH = '.gitignore';
const LANE_WRITE_LOCK_CONTRACT_PATH = 'plan_vanilla_parity/define-lane-write-lock-contract.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-read-only-reference-roots.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const POLICY_MODULE_PATH = 'src/reference/policy.ts';
const PROPRIETARY_BOUNDARY_PATH = 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md';
const REFERENCE_ORACLES_PATH = 'plan_vanilla_parity/REFERENCE_ORACLES.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-010-define-read-only-reference-roots.md';
const STEP_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const USER_SUPPLIED_IWAD_SCOPE_PATH = 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_READ_ONLY_REFERENCE_ROOTS: readonly string[] = ['doom/', 'iwad/', 'reference/'];

const CANONICAL_READ_ONLY_REFERENCE_ROOT_COUNT = 3;

const CANONICAL_FORBIDDEN_WRITE_LOCK_PREFIXES: readonly string[] = ['../', 'doom/', 'iwad/', 'reference/'];

const CANONICAL_VALIDATE_PLAN_DIAGNOSTIC_MESSAGES: readonly string[] = ['Write lock escapes the workspace: <path>.', 'Write lock is inside read-only reference root: <path>.', 'Write lock path must not be empty.'];

const CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS: readonly string[] = ['plan_vanilla_parity/final-gates/', 'test/oracles/fixtures/', 'test/vanilla_parity/acceptance/', 'test/vanilla_parity/oracles/'];

interface PinReadOnlyReferenceRootsDocument {
  readonly acceptancePhrasing: string;
  readonly allowedOracleOutputRoots: readonly string[];
  readonly canonicalReadOnlyReferenceRootCount: string;
  readonly canonicalReadOnlyReferenceRoots: readonly string[];
  readonly doomRootRule: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly forbiddenWriteLockPrefixes: readonly string[];
  readonly gitignoreRule: string;
  readonly iwadRootRule: string;
  readonly oracleOutputRedirectRule: string;
  readonly parallelWorkMustNotTouchRule: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly referenceRootRule: string;
  readonly scopeName: string;
  readonly validatePlanDiagnosticMessages: readonly string[];
  readonly validatePlanHelperRule: string;
  readonly validatePlanLiteral: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in read-only reference roots document.`);
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

function parsePinReadOnlyReferenceRootsDocument(documentText: string): PinReadOnlyReferenceRootsDocument {
  const canonicalReadOnlyReferenceRoots = extractBullets(documentText, 'canonical read-only reference roots');
  if (canonicalReadOnlyReferenceRoots.length === 0) {
    throw new Error('canonical read-only reference roots must list at least one root.');
  }

  const forbiddenWriteLockPrefixes = extractBullets(documentText, 'forbidden write lock prefixes');
  if (forbiddenWriteLockPrefixes.length === 0) {
    throw new Error('forbidden write lock prefixes must list at least one prefix.');
  }

  const validatePlanDiagnosticMessages = extractBullets(documentText, 'validate-plan diagnostic messages');
  if (validatePlanDiagnosticMessages.length === 0) {
    throw new Error('validate-plan diagnostic messages must list at least one diagnostic.');
  }

  const allowedOracleOutputRoots = extractBullets(documentText, 'allowed oracle output roots');
  if (allowedOracleOutputRoots.length === 0) {
    throw new Error('allowed oracle output roots must list at least one root.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    allowedOracleOutputRoots,
    canonicalReadOnlyReferenceRootCount: extractSection(documentText, 'canonical read-only reference root count'),
    canonicalReadOnlyReferenceRoots,
    doomRootRule: extractSection(documentText, 'doom root rule'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    forbiddenWriteLockPrefixes,
    gitignoreRule: extractSection(documentText, 'gitignore rule'),
    iwadRootRule: extractSection(documentText, 'iwad root rule'),
    oracleOutputRedirectRule: extractSection(documentText, 'oracle output redirect rule'),
    parallelWorkMustNotTouchRule: extractSection(documentText, 'parallel work must-not-touch rule'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    referenceRootRule: extractSection(documentText, 'reference root rule'),
    scopeName: extractSection(documentText, 'scope name'),
    validatePlanDiagnosticMessages,
    validatePlanHelperRule: extractSection(documentText, 'validate-plan helper rule'),
    validatePlanLiteral: extractSection(documentText, 'validate-plan literal'),
  };
}

async function loadPinReadOnlyReferenceRootsDocument(): Promise<PinReadOnlyReferenceRootsDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinReadOnlyReferenceRootsDocument(documentText);
}

describe('define read-only reference roots declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 read-only reference roots');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('canonical read-only reference roots equal the doom/, iwad/, reference/ trio in canonical order', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.canonicalReadOnlyReferenceRoots).toEqual(CANONICAL_READ_ONLY_REFERENCE_ROOTS);
    expect(parsed.canonicalReadOnlyReferenceRoots).toHaveLength(CANONICAL_READ_ONLY_REFERENCE_ROOT_COUNT);
    expect(new Set(parsed.canonicalReadOnlyReferenceRoots).size).toBe(parsed.canonicalReadOnlyReferenceRoots.length);
    expect(parsed.canonicalReadOnlyReferenceRootCount).toBe(String(CANONICAL_READ_ONLY_REFERENCE_ROOT_COUNT));
  });

  test('canonical read-only reference roots are ASCIIbetically sorted and every entry ends with a trailing slash', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    const ascendingSortedRoots = [...parsed.canonicalReadOnlyReferenceRoots].sort();
    expect(parsed.canonicalReadOnlyReferenceRoots).toEqual(ascendingSortedRoots);
    for (const readOnlyRoot of parsed.canonicalReadOnlyReferenceRoots) {
      expect(readOnlyRoot.endsWith('/')).toBe(true);
    }
  });

  test('doom root rule pins the proprietary asset boundary, the policy module catalog, and the gitignored drop location', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.doomRootRule).toContain('`doom/`');
    expect(parsed.doomRootRule).toContain('ASSET_BOUNDARIES');
    expect(parsed.doomRootRule).toContain('REFERENCE_BUNDLE_PATH');
    expect(parsed.doomRootRule).toContain('src/reference/policy.ts');
    expect(parsed.doomRootRule).toContain('plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    expect(parsed.doomRootRule).toContain('gitignored');
    expect(parsed.doomRootRule).toContain('read-only paths');
    expect(parsed.doomRootRule).toContain('write lock');
  });

  test('iwad root rule pins the user-supplied IWAD scope, the gitignored drop location, and the read-only-paths allowance', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.iwadRootRule).toContain('`iwad/`');
    expect(parsed.iwadRootRule).toContain('plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md');
    expect(parsed.iwadRootRule).toContain('gitignored');
    expect(parsed.iwadRootRule).toContain('read-only paths');
    expect(parsed.iwadRootRule).toContain('write lock');
  });

  test('reference root rule pins the manifests subdirectory, the committed-but-read-only status, and the oracle-lane regeneration carve-out', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.referenceRootRule).toContain('`reference/`');
    expect(parsed.referenceRootRule).toContain('reference/manifests/');
    expect(parsed.referenceRootRule).toContain('committed');
    expect(parsed.referenceRootRule).toContain('read-only');
    expect(parsed.referenceRootRule).toContain('oracle');
    expect(parsed.referenceRootRule).toContain('write lock');
    expect(parsed.referenceRootRule).toContain('read-only paths');
  });

  test('validate-plan literal pins the verbatim READ_ONLY_ROOTS tuple in plan_vanilla_parity/validate-plan.ts', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.validatePlanLiteral).toContain("const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;");
    expect(parsed.validatePlanLiteral).toContain('plan_vanilla_parity/validate-plan.ts');
  });

  test('validate-plan helper rule pins validateWritablePath, normalizePlanPath, and the three diagnostic strings', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.validatePlanHelperRule).toContain('validateWritablePath');
    expect(parsed.validatePlanHelperRule).toContain('normalizePlanPath');
    expect(parsed.validatePlanHelperRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.validatePlanHelperRule).toContain('Write lock path must not be empty.');
    expect(parsed.validatePlanHelperRule).toContain('Write lock escapes the workspace: <path>.');
    expect(parsed.validatePlanHelperRule).toContain('Write lock is inside read-only reference root: <path>.');
  });

  test('validate-plan diagnostic messages list the three canonical write-lock diagnostics ASCIIbetically sorted', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.validatePlanDiagnosticMessages).toEqual(CANONICAL_VALIDATE_PLAN_DIAGNOSTIC_MESSAGES);
    const ascendingSortedDiagnostics = [...parsed.validatePlanDiagnosticMessages].sort();
    expect(parsed.validatePlanDiagnosticMessages).toEqual(ascendingSortedDiagnostics);
    expect(new Set(parsed.validatePlanDiagnosticMessages).size).toBe(parsed.validatePlanDiagnosticMessages.length);
  });

  test('forbidden write lock prefixes include the workspace-escape prefix and every read-only root, ASCIIbetically sorted', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.forbiddenWriteLockPrefixes).toEqual(CANONICAL_FORBIDDEN_WRITE_LOCK_PREFIXES);
    expect(parsed.forbiddenWriteLockPrefixes).toContain('../');
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.forbiddenWriteLockPrefixes).toContain(readOnlyRoot);
    }
    const ascendingSortedPrefixes = [...parsed.forbiddenWriteLockPrefixes].sort();
    expect(parsed.forbiddenWriteLockPrefixes).toEqual(ascendingSortedPrefixes);
  });

  test('parallel work must-not-touch rule pins the literal cell value and the parseLaneWriteScopes helper', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.parallelWorkMustNotTouchRule).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.parallelWorkMustNotTouchRule).toContain('must not touch');
    expect(parsed.parallelWorkMustNotTouchRule).toContain('doom/; iwad/; reference/');
    expect(parsed.parallelWorkMustNotTouchRule).toContain('parseLaneWriteScopes');
    expect(parsed.parallelWorkMustNotTouchRule).toContain('validateWritablePath');
  });

  test('gitignore rule pins doom/ and iwad/ as gitignored, and reference/ as committed-but-read-only', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.gitignoreRule).toContain('doom/');
    expect(parsed.gitignoreRule).toContain('iwad/');
    expect(parsed.gitignoreRule).toContain('reference/');
    expect(parsed.gitignoreRule).toContain('gitignored');
    expect(parsed.gitignoreRule).toContain('not gitignored');
    expect(parsed.gitignoreRule).toContain('read-only');
  });

  test('oracle output redirect rule pins the verbatim REFERENCE_ORACLES.md sentence and every allowed oracle output root', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.oracleOutputRedirectRule).toContain('plan_vanilla_parity/REFERENCE_ORACLES.md');
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(parsed.oracleOutputRedirectRule).toContain(`\`${allowedOracleOutputRoot}\``);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.oracleOutputRedirectRule).toContain(`\`${readOnlyRoot.replace(/\/$/, '')}/\``);
    }
  });

  test('allowed oracle output roots match the four canonical writable destinations pinned by REFERENCE_ORACLES.md, ASCIIbetically sorted', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.allowedOracleOutputRoots).toEqual(CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS);
    expect(parsed.allowedOracleOutputRoots).toHaveLength(4);
    expect(new Set(parsed.allowedOracleOutputRoots).size).toBe(parsed.allowedOracleOutputRoots.length);
    const ascendingSortedRoots = [...parsed.allowedOracleOutputRoots].sort();
    expect(parsed.allowedOracleOutputRoots).toEqual(ascendingSortedRoots);
    const proprietaryRootSet = new Set(CANONICAL_READ_ONLY_REFERENCE_ROOTS);
    for (const allowedOracleOutputRoot of parsed.allowedOracleOutputRoots) {
      expect(proprietaryRootSet.has(allowedOracleOutputRoot)).toBe(false);
    }
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, .gitignore, the policy module, the validator, and every adjacent governance pin', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      GITIGNORE_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      POLICY_MODULE_PATH,
      PROPRIETARY_BOUNDARY_PATH,
      REFERENCE_ORACLES_PATH,
      SOURCE_CATALOG_PATH,
      USER_SUPPLIED_IWAD_SCOPE_PATH,
      LANE_WRITE_LOCK_CONTRACT_PATH,
      STEP_REQUIRED_FIELDS_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity validate-plan.ts declares the canonical READ_ONLY_ROOTS literal verbatim', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain("const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;");
  });

  test('plan_vanilla_parity validate-plan.ts emits every canonical write-lock diagnostic string this document anchors', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain("'Write lock path must not be empty.'");
    expect(validatePlanText).toContain('Write lock escapes the workspace: ${path}.');
    expect(validatePlanText).toContain('Write lock is inside read-only reference root: ${path}.');
  });

  test('plan_vanilla_parity validate-plan.ts declares the validateWritablePath helper that enforces the three rules', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('function validateWritablePath(');
    expect(validatePlanText).toContain('function normalizePlanPath(');
    expect(validatePlanText).toContain('for (const readOnlyRoot of READ_ONLY_ROOTS) {');
  });

  test('repository .gitignore lists doom/ and iwad/ on their own lines and does not list reference/', async () => {
    const gitignoreText = await Bun.file(GITIGNORE_PATH).text();
    const gitignoreLines = new Set(gitignoreText.split(/\r?\n/).map((line) => line.trim()));
    expect(gitignoreLines.has('doom/')).toBe(true);
    expect(gitignoreLines.has('iwad/')).toBe(true);
    expect(gitignoreLines.has('reference/')).toBe(false);
  });

  test('plan_vanilla_parity REFERENCE_ORACLES.md anchors the verbatim oracle output redirect sentence this document pins', async () => {
    const referenceOraclesText = await Bun.file(REFERENCE_ORACLES_PATH).text();
    expect(referenceOraclesText).toContain(
      'Oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/`.',
    );
    expect(referenceOraclesText).toContain('Never write inside `doom/`, `iwad/`, or `reference/`.');
  });

  test('plan_vanilla_parity PARALLEL_WORK.md lists doom/; iwad/; reference/ under the must-not-touch column for every committed lane row', async () => {
    const parallelWorkText = await Bun.file(PARALLEL_WORK_PATH).text();
    const laneRowPattern = /^\| (?<lane>[a-z][a-z0-9-]*) \| [^|]* \| [^|]* \| [^|]* \| (?<mustNotTouch>[^|]+) \|$/gm;
    const declaredMustNotTouchByLane = new Map<string, string>();
    for (const match of parallelWorkText.matchAll(laneRowPattern)) {
      const groups = match.groups;
      if (!groups) {
        continue;
      }
      const laneCell = groups.lane.trim();
      if (laneCell === 'lane') {
        continue;
      }
      declaredMustNotTouchByLane.set(laneCell, groups.mustNotTouch.trim());
    }
    expect(declaredMustNotTouchByLane.size).toBeGreaterThan(0);
    for (const [laneSlug, mustNotTouchCell] of declaredMustNotTouchByLane) {
      expect(mustNotTouchCell.length).toBeGreaterThan(0);
      const declaredRoots = new Set(
        mustNotTouchCell
          .split(';')
          .map((root) => root.trim())
          .filter((root) => root.length > 0),
      );
      for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
        expect(declaredRoots.has(readOnlyRoot)).toBe(true);
      }
      expect(laneSlug.length).toBeGreaterThan(0);
    }
  });

  test('plan_vanilla_parity SOURCE_CATALOG.md anchors the doom/ and iwad/ roots as the two local primary source locations', async () => {
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    expect(sourceCatalogText).toContain('`doom/`');
    expect(sourceCatalogText).toContain('`iwad/`');
  });

  test('CLAUDE.md anchors doom/, iwad/, and reference/ as the three read-only roots that oracle artifacts must never write into', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('`doom/`');
    expect(claudeText).toContain('`iwad/`');
    expect(claudeText).toContain('`reference/`');
    expect(claudeText).toContain('read-only');
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-secrets staging rule that justify gitignoring the proprietary drop locations', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
    expect(agentsText).toContain('Stage files explicitly by name');
  });

  test('plan_vanilla_parity define-lane-write-lock-contract.md anchors the same three read-only roots and the same four forbidden write lock prefixes', async () => {
    const laneWriteLockContractText = await Bun.file(LANE_WRITE_LOCK_CONTRACT_PATH).text();
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(laneWriteLockContractText).toContain(`- ${readOnlyRoot}`);
    }
    for (const forbiddenWriteLockPrefix of CANONICAL_FORBIDDEN_WRITE_LOCK_PREFIXES) {
      expect(laneWriteLockContractText).toContain(`- ${forbiddenWriteLockPrefix}`);
    }
  });

  test('plan_vanilla_parity define-step-file-required-fields.md anchors the same three read-only roots in its read-only reference roots section', async () => {
    const stepRequiredFieldsText = await Bun.file(STEP_REQUIRED_FIELDS_PATH).text();
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(stepRequiredFieldsText).toContain(`- ${readOnlyRoot}`);
    }
  });

  test('src/reference/policy.ts anchors the doom/ root as REFERENCE_BUNDLE_PATH and catalogs the asset boundaries', async () => {
    const policyText = await Bun.file(POLICY_MODULE_PATH).text();
    expect(policyText).toContain("REFERENCE_BUNDLE_PATH = resolve(PROJECT_ROOT_PATH, 'doom')");
    expect(policyText).toContain('ASSET_BOUNDARIES');
    expect(policyText).toContain('CODEX_WORKSPACE_PATH');
  });

  test('step 00-010 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-010: Define Read Only Reference Roots');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-read-only-reference-roots.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-read-only-reference-roots.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-010 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-010` `define-read-only-reference-roots` | lane: `governance` | prereqs: `00-009` | file: `plan_vanilla_parity/steps/00-010-define-read-only-reference-roots.md`';
    const expectedCompletedRow = '- [x] `00-010` `define-read-only-reference-roots` | lane: `governance` | prereqs: `00-009` | file: `plan_vanilla_parity/steps/00-010-define-read-only-reference-roots.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names every canonical read-only root, every allowed oracle output root, the workspace-escape prefix, and the must-not-touch column', async () => {
    const parsed = await loadPinReadOnlyReferenceRootsDocument();
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${readOnlyRoot.replace(/\/$/, '')}/\``);
    }
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${allowedOracleOutputRoot}\``);
    }
    expect(parsed.acceptancePhrasing).toContain('../');
    expect(parsed.acceptancePhrasing).toContain('must not touch');
    expect(parsed.acceptancePhrasing).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.acceptancePhrasing).toContain('write lock');
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 read-only reference roots\n';
    expect(() => parsePinReadOnlyReferenceRootsDocument(documentTextWithMissingSection)).toThrow('Section "canonical read-only reference roots" not found in read-only reference roots document.');
  });

  test('parser surfaces a meaningful error when canonical read-only reference roots is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## canonical read-only reference roots\n\n- doom\/\n- iwad\/\n- reference\/\n/, '\n## canonical read-only reference roots\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinReadOnlyReferenceRootsDocument(corruptedDocumentText)).toThrow('canonical read-only reference roots must list at least one root.');
  });

  test('parser surfaces a meaningful error when allowed oracle output roots is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## allowed oracle output roots\n\n- plan_vanilla_parity\/final-gates\/\n- test\/oracles\/fixtures\/\n- test\/vanilla_parity\/acceptance\/\n- test\/vanilla_parity\/oracles\/\n/,
      '\n## allowed oracle output roots\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinReadOnlyReferenceRootsDocument(corruptedDocumentText)).toThrow('allowed oracle output roots must list at least one root.');
  });
});
