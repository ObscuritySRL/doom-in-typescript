import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const LEGACY_REFERENCE_ORACLES_PATH = 'plan_fps/REFERENCE_ORACLES.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-source-authority-order.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const POLICY_MODULE_PATH = 'src/reference/policy.ts';
const PROPRIETARY_BOUNDARY_PATH = 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md';
const READ_ONLY_REFERENCE_ROOTS_PATH = 'plan_vanilla_parity/define-read-only-reference-roots.md';
const REFERENCE_ORACLES_PATH = 'plan_vanilla_parity/REFERENCE_ORACLES.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-012-define-source-authority-order.md';
const STEP_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const USER_SUPPLIED_IWAD_SCOPE_PATH = 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_AUTHORITY_TIER_COUNT = 5;

const CANONICAL_AUTHORITY_TIER_HEADINGS: readonly string[] = ['authority tier one', 'authority tier two', 'authority tier three', 'authority tier four', 'authority tier five'];

const CANONICAL_LOCAL_PRIMARY_SOURCE_IDENTIFIERS: readonly string[] = ['SRC-LOCAL-001', 'SRC-LOCAL-002', 'SRC-LOCAL-003', 'SRC-LOCAL-004', 'SRC-LOCAL-005', 'SRC-LOCAL-006'];

const CANONICAL_LOCAL_PRIMARY_SOURCE_PATHS: readonly string[] = ['doom/DOOMD.EXE', 'doom/DOOM.EXE', 'doom/DOOM1.WAD', 'iwad/DOOM1.WAD', 'doom/default.cfg', 'doom/chocolate-doom.cfg'];

const CANONICAL_VERIFIABLE_EVIDENCE_SOURCES: readonly string[] = ['local binaries', 'IWAD data', 'id Software source', 'Chocolate Doom source'];

const CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS: readonly string[] = ['plan_vanilla_parity/final-gates/', 'test/oracles/fixtures/', 'test/vanilla_parity/acceptance/', 'test/vanilla_parity/oracles/'];

const CANONICAL_READ_ONLY_REFERENCE_ROOTS: readonly string[] = ['doom/', 'iwad/', 'reference/'];

const ID_SOFTWARE_SOURCE_URL = 'https://github.com/id-Software/DOOM';
const CHOCOLATE_DOOM_RELEASE_URL = 'https://github.com/chocolate-doom/chocolate-doom/releases/tag/chocolate-doom-2.2.1';

interface SourceAuthorityOrderDocument {
  readonly acceptancePhrasing: string;
  readonly allowedOracleOutputRoots: readonly string[];
  readonly authorityTierCount: string;
  readonly authorityTierFour: string;
  readonly authorityTierOne: string;
  readonly authorityTierThree: string;
  readonly authorityTierTwo: string;
  readonly authorityTierFive: string;
  readonly chocolateDoomSecondaryReferenceRule: string;
  readonly claudeMdAuthorityOrderingAnchor: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly localPrimarySourceIdentifiers: readonly string[];
  readonly localPrimarySourcePaths: readonly string[];
  readonly noGuessRule: string;
  readonly oracleRedirectRule: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly scopeName: string;
  readonly verifiableEvidenceSources: readonly string[];
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in source authority order document.`);
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

function parseSourceAuthorityOrderDocument(documentText: string): SourceAuthorityOrderDocument {
  const localPrimarySourceIdentifiers = extractBullets(documentText, 'local primary source identifiers');
  if (localPrimarySourceIdentifiers.length === 0) {
    throw new Error('local primary source identifiers must list at least one identifier.');
  }

  const localPrimarySourcePaths = extractBullets(documentText, 'local primary source paths');
  if (localPrimarySourcePaths.length === 0) {
    throw new Error('local primary source paths must list at least one path.');
  }

  const verifiableEvidenceSources = extractBullets(documentText, 'verifiable evidence sources');
  if (verifiableEvidenceSources.length === 0) {
    throw new Error('verifiable evidence sources must list at least one source.');
  }

  const allowedOracleOutputRoots = extractBullets(documentText, 'allowed oracle output roots');
  if (allowedOracleOutputRoots.length === 0) {
    throw new Error('allowed oracle output roots must list at least one root.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    allowedOracleOutputRoots,
    authorityTierCount: extractSection(documentText, 'authority tier count'),
    authorityTierFive: extractSection(documentText, 'authority tier five'),
    authorityTierFour: extractSection(documentText, 'authority tier four'),
    authorityTierOne: extractSection(documentText, 'authority tier one'),
    authorityTierThree: extractSection(documentText, 'authority tier three'),
    authorityTierTwo: extractSection(documentText, 'authority tier two'),
    chocolateDoomSecondaryReferenceRule: extractSection(documentText, 'chocolate doom secondary reference rule'),
    claudeMdAuthorityOrderingAnchor: extractSection(documentText, 'claude md authority ordering anchor'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    localPrimarySourceIdentifiers,
    localPrimarySourcePaths,
    noGuessRule: extractSection(documentText, 'no guess rule'),
    oracleRedirectRule: extractSection(documentText, 'oracle redirect rule'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    scopeName: extractSection(documentText, 'scope name'),
    verifiableEvidenceSources,
  };
}

async function loadSourceAuthorityOrderDocument(): Promise<SourceAuthorityOrderDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parseSourceAuthorityOrderDocument(documentText);
}

describe('define source authority order declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 source authority order');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('authority tier count is the canonical five and matches the number of authority tier headings in the document', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.authorityTierCount).toBe(String(CANONICAL_AUTHORITY_TIER_COUNT));
    expect(CANONICAL_AUTHORITY_TIER_HEADINGS).toHaveLength(CANONICAL_AUTHORITY_TIER_COUNT);
  });

  test('authority tier headings appear in canonical order in the document', async () => {
    const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const headingsInDocumentOrder: readonly string[] = [...documentText.matchAll(/^## (?<heading>.+)$/gm)].map((match) => match.groups!.heading);
    const tierHeadingsInDocumentOrder: readonly string[] = headingsInDocumentOrder.filter((heading) => heading.startsWith('authority tier ') && heading !== 'authority tier count');
    expect(tierHeadingsInDocumentOrder).toEqual(CANONICAL_AUTHORITY_TIER_HEADINGS);
  });

  test('authority tier one pins the local binaries, configs, and IWADs under doom/ and iwad/', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.authorityTierOne).toContain('`doom/`');
    expect(parsed.authorityTierOne).toContain('`iwad/`');
    expect(parsed.authorityTierOne).toContain('proprietary');
    expect(parsed.authorityTierOne).toContain('plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    expect(parsed.authorityTierOne).toContain('plan_vanilla_parity/define-read-only-reference-roots.md');
    for (const localPrimarySourcePath of CANONICAL_LOCAL_PRIMARY_SOURCE_PATHS) {
      expect(parsed.authorityTierOne).toContain(`\`${localPrimarySourcePath}\``);
    }
  });

  test('authority tier two pins the local reference manifests as prior captured evidence and never final proof', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.authorityTierTwo).toContain('reference/manifests/');
    expect(parsed.authorityTierTwo).toContain('prior captured evidence');
    expect(parsed.authorityTierTwo).toContain('never');
    expect(parsed.authorityTierTwo).toContain('final');
    expect(parsed.authorityTierTwo).toContain('plan_vanilla_parity/define-read-only-reference-roots.md');
    expect(parsed.authorityTierTwo).toContain('proprietary');
  });

  test('authority tier three pins the id Software DOOM source URL and the linuxdoom-1.10 emphasis', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.authorityTierThree).toContain('id Software');
    expect(parsed.authorityTierThree).toContain('linuxdoom-1.10');
    expect(parsed.authorityTierThree).toContain(ID_SOFTWARE_SOURCE_URL);
  });

  test('authority tier four pins the Chocolate Doom 2.2.1 source URL and the canonical source files emphasis', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.authorityTierFour).toContain('Chocolate Doom 2.2.1');
    expect(parsed.authorityTierFour).toContain(CHOCOLATE_DOOM_RELEASE_URL);
    expect(parsed.authorityTierFour).toContain('d_main.c');
    expect(parsed.authorityTierFour).toContain('g_game.c');
    expect(parsed.authorityTierFour).toContain('s_sound.c');
    expect(parsed.authorityTierFour).toContain('m_menu.c');
    expect(parsed.authorityTierFour).toContain('m_fixed.c');
    expect(parsed.authorityTierFour).toContain('tables.c');
    expect(parsed.authorityTierFour).toContain('p_saveg.c');
    expect(parsed.authorityTierFour).toContain('DOS behavior');
    expect(parsed.authorityTierFour).toContain('demo compatibility');
  });

  test('authority tier five pins DoomWiki for orientation only and never final authority', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.authorityTierFive).toContain('DoomWiki');
    expect(parsed.authorityTierFive).toContain('orientation');
    expect(parsed.authorityTierFive).toContain('never');
    expect(parsed.authorityTierFive).toContain('final');
    expect(parsed.authorityTierFive).toContain('plan_vanilla_parity/SOURCE_CATALOG.md');
  });

  test('local primary source identifiers list the six SRC-LOCAL-001..SRC-LOCAL-006 entries in canonical order with no duplicates', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.localPrimarySourceIdentifiers).toEqual(CANONICAL_LOCAL_PRIMARY_SOURCE_IDENTIFIERS);
    expect(parsed.localPrimarySourceIdentifiers).toHaveLength(CANONICAL_LOCAL_PRIMARY_SOURCE_IDENTIFIERS.length);
    expect(new Set(parsed.localPrimarySourceIdentifiers).size).toBe(parsed.localPrimarySourceIdentifiers.length);
    const ascendingSortedIdentifiers = [...parsed.localPrimarySourceIdentifiers].sort();
    expect(parsed.localPrimarySourceIdentifiers).toEqual(ascendingSortedIdentifiers);
  });

  test('local primary source paths list the six paths cataloged by SOURCE_CATALOG.md in cataloged order with no duplicates', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.localPrimarySourcePaths).toEqual(CANONICAL_LOCAL_PRIMARY_SOURCE_PATHS);
    expect(parsed.localPrimarySourcePaths).toHaveLength(CANONICAL_LOCAL_PRIMARY_SOURCE_PATHS.length);
    expect(new Set(parsed.localPrimarySourcePaths).size).toBe(parsed.localPrimarySourcePaths.length);
  });

  test('every local primary source path begins with one of the read-only reference roots doom/ or iwad/', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    for (const localPrimarySourcePath of parsed.localPrimarySourcePaths) {
      const beginsWithDoomRoot = localPrimarySourcePath.startsWith('doom/');
      const beginsWithIwadRoot = localPrimarySourcePath.startsWith('iwad/');
      expect(beginsWithDoomRoot || beginsWithIwadRoot).toBe(true);
    }
  });

  test('chocolate doom secondary reference rule pins the project-goal sentence, the local Windows executable, and the source release tag', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain('Chocolate Doom 2.2.1');
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain('accurate DOS behavior');
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain('demo compatibility');
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain('SRC-LOCAL-001');
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain('SRC-LOCAL-002');
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain(CHOCOLATE_DOOM_RELEASE_URL);
    expect(parsed.chocolateDoomSecondaryReferenceRule).toContain('local binary proof wins');
  });

  test('no guess rule pins the verbatim PROMPT.md sentence and names the four canonical verifiable evidence sources', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.noGuessRule).toContain('plan_vanilla_parity/PROMPT.md');
    expect(parsed.noGuessRule).toContain('If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.');
    expect(parsed.noGuessRule).toContain('plan_vanilla_parity/define-read-only-reference-roots.md');
    for (const verifiableEvidenceSource of CANONICAL_VERIFIABLE_EVIDENCE_SOURCES) {
      expect(parsed.noGuessRule).toContain(verifiableEvidenceSource);
    }
  });

  test('verifiable evidence sources list the four canonical sources in canonical order with no duplicates', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.verifiableEvidenceSources).toEqual(CANONICAL_VERIFIABLE_EVIDENCE_SOURCES);
    expect(parsed.verifiableEvidenceSources).toHaveLength(CANONICAL_VERIFIABLE_EVIDENCE_SOURCES.length);
    expect(new Set(parsed.verifiableEvidenceSources).size).toBe(parsed.verifiableEvidenceSources.length);
  });

  test('claude md authority ordering anchor pins the verbatim CLAUDE.md sentence and notes that plan_vanilla_parity/SOURCE_CATALOG.md supersedes it', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.claudeMdAuthorityOrderingAnchor).toContain('CLAUDE.md');
    expect(parsed.claudeMdAuthorityOrderingAnchor).toContain(
      'Authority order for behavioral questions is in `plan_fps/REFERENCE_ORACLES.md`: local DOS binary > local IWAD > local Windows/Chocolate Doom exe > upstream Chocolate Doom source > community docs.',
    );
    expect(parsed.claudeMdAuthorityOrderingAnchor).toContain('plan_vanilla_parity/SOURCE_CATALOG.md');
    expect(parsed.claudeMdAuthorityOrderingAnchor).toContain('superseded');
  });

  test('oracle redirect rule pins the verbatim REFERENCE_ORACLES.md sentence and every allowed oracle output root', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.oracleRedirectRule).toContain('plan_vanilla_parity/REFERENCE_ORACLES.md');
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(parsed.oracleRedirectRule).toContain(`\`${allowedOracleOutputRoot}\``);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.oracleRedirectRule).toContain(`\`${readOnlyRoot.replace(/\/$/, '')}/\``);
    }
    expect(parsed.oracleRedirectRule).toContain('plan_vanilla_parity/define-read-only-reference-roots.md');
    expect(parsed.oracleRedirectRule).toContain('validateWritablePath');
  });

  test('allowed oracle output roots match the four canonical writable destinations pinned by REFERENCE_ORACLES.md, ASCIIbetically sorted', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
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
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, the plan governance index files, and every adjacent governance pin', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
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
      SOURCE_CATALOG_PATH,
      STEP_REQUIRED_FIELDS_PATH,
      USER_SUPPLIED_IWAD_SCOPE_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity SOURCE_CATALOG.md anchors the canonical five tier authority order in the same order this document pins', async () => {
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    expect(sourceCatalogText).toContain('## Authority Order');
    expect(sourceCatalogText).toContain('1. Local binaries, configs, and IWADs under `doom/` and `iwad/`.');
    expect(sourceCatalogText).toContain('2. Local reference manifests only as prior captured evidence, never as final proof.');
    expect(sourceCatalogText).toContain('id Software DOOM source');
    expect(sourceCatalogText).toContain('linuxdoom-1.10');
    expect(sourceCatalogText).toContain(ID_SOFTWARE_SOURCE_URL);
    expect(sourceCatalogText).toContain('Chocolate Doom 2.2.1 source');
    expect(sourceCatalogText).toContain(CHOCOLATE_DOOM_RELEASE_URL);
    expect(sourceCatalogText).toContain('DoomWiki only for orientation, never final authority.');
  });

  test('plan_vanilla_parity SOURCE_CATALOG.md catalogs every canonical local primary source identifier and path', async () => {
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    for (const localPrimarySourceIdentifier of CANONICAL_LOCAL_PRIMARY_SOURCE_IDENTIFIERS) {
      expect(sourceCatalogText).toContain(localPrimarySourceIdentifier);
    }
    for (const localPrimarySourcePath of CANONICAL_LOCAL_PRIMARY_SOURCE_PATHS) {
      expect(sourceCatalogText).toContain(`\`${localPrimarySourcePath}\``);
    }
  });

  test('plan_vanilla_parity SOURCE_CATALOG.md anchors the Chocolate Doom secondary reference rule this document pins', async () => {
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    expect(sourceCatalogText).toContain('accurate DOS behavior');
    expect(sourceCatalogText).toContain('demo compatibility');
    expect(sourceCatalogText).toContain('local binary proof wins when behavior differs or source reading is inconclusive');
  });

  test('plan_vanilla_parity PROMPT.md anchors the verbatim no-guess rule sentence this document pins', async () => {
    const planPromptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(planPromptText).toContain('If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.');
  });

  test('plan_vanilla_parity REFERENCE_ORACLES.md anchors the verbatim oracle output redirect sentence this document pins', async () => {
    const referenceOraclesText = await Bun.file(REFERENCE_ORACLES_PATH).text();
    expect(referenceOraclesText).toContain(
      'Oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/`.',
    );
    expect(referenceOraclesText).toContain('Never write inside `doom/`, `iwad/`, or `reference/`.');
  });

  test('plan_vanilla_parity define-read-only-reference-roots.md anchors the same allowed oracle output roots this document pins', async () => {
    const readOnlyReferenceRootsText = await Bun.file(READ_ONLY_REFERENCE_ROOTS_PATH).text();
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(readOnlyReferenceRootsText).toContain(`- ${allowedOracleOutputRoot}`);
    }
  });

  test('CLAUDE.md anchors the verbatim authority-order line this document treats as the legacy plan_fps surface anchor', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Authority order for behavioral questions is in `plan_fps/REFERENCE_ORACLES.md`: local DOS binary > local IWAD > local Windows/Chocolate Doom exe > upstream Chocolate Doom source > community docs.');
  });

  test('plan_fps/REFERENCE_ORACLES.md anchors the legacy Authority Order section this document treats as the prior-art surface', async () => {
    const legacyReferenceOraclesText = await Bun.file(LEGACY_REFERENCE_ORACLES_PATH).text();
    expect(legacyReferenceOraclesText).toContain('## Authority Order');
    expect(legacyReferenceOraclesText).toContain('1. Local original DOS binary if present and usable.');
    expect(legacyReferenceOraclesText).toContain('2. Local IWAD/data files.');
    expect(legacyReferenceOraclesText).toContain('Chocolate Doom');
    expect(legacyReferenceOraclesText).toContain('Community documentation for orientation only.');
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-fabrication core principle that motivate the no-guess rule', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
    expect(agentsText).toContain('No fabrication');
  });

  test('src/reference/policy.ts anchors the doom/ root as REFERENCE_BUNDLE_PATH and catalogs every canonical local primary source filename', async () => {
    const policyText = await Bun.file(POLICY_MODULE_PATH).text();
    expect(policyText).toContain("REFERENCE_BUNDLE_PATH = resolve(PROJECT_ROOT_PATH, 'doom')");
    expect(policyText).toContain('ASSET_BOUNDARIES');
    expect(policyText).toContain('DOOM.EXE');
    expect(policyText).toContain('DOOM1.WAD');
    expect(policyText).toContain('DOOMD.EXE');
    expect(policyText).toContain('default.cfg');
    expect(policyText).toContain('chocolate-doom.cfg');
  });

  test('step 00-012 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-012: Define Source Authority Order');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-source-authority-order.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-source-authority-order.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-012 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-012` `define-source-authority-order` | lane: `governance` | prereqs: `00-011` | file: `plan_vanilla_parity/steps/00-012-define-source-authority-order.md`';
    const expectedCompletedRow = '- [x] `00-012` `define-source-authority-order` | lane: `governance` | prereqs: `00-011` | file: `plan_vanilla_parity/steps/00-012-define-source-authority-order.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names every authority tier source, every local primary source identifier, every verifiable evidence source, every allowed oracle output root, and every read-only reference root', async () => {
    const parsed = await loadSourceAuthorityOrderDocument();
    expect(parsed.acceptancePhrasing).toContain('plan_vanilla_parity/SOURCE_CATALOG.md');
    for (const localPrimarySourceIdentifier of CANONICAL_LOCAL_PRIMARY_SOURCE_IDENTIFIERS) {
      expect(parsed.acceptancePhrasing).toContain(localPrimarySourceIdentifier);
    }
    for (const localPrimarySourcePath of CANONICAL_LOCAL_PRIMARY_SOURCE_PATHS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${localPrimarySourcePath}\``);
    }
    expect(parsed.acceptancePhrasing).toContain('id Software');
    expect(parsed.acceptancePhrasing).toContain(ID_SOFTWARE_SOURCE_URL);
    expect(parsed.acceptancePhrasing).toContain('Chocolate Doom 2.2.1');
    expect(parsed.acceptancePhrasing).toContain(CHOCOLATE_DOOM_RELEASE_URL);
    expect(parsed.acceptancePhrasing).toContain('DoomWiki');
    expect(parsed.acceptancePhrasing).toContain('orientation');
    for (const verifiableEvidenceSource of CANONICAL_VERIFIABLE_EVIDENCE_SOURCES) {
      expect(parsed.acceptancePhrasing).toContain(verifiableEvidenceSource);
    }
    for (const allowedOracleOutputRoot of CANONICAL_ALLOWED_ORACLE_OUTPUT_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${allowedOracleOutputRoot}\``);
    }
    for (const readOnlyRoot of CANONICAL_READ_ONLY_REFERENCE_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${readOnlyRoot.replace(/\/$/, '')}/\``);
    }
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 source authority order\n';
    expect(() => parseSourceAuthorityOrderDocument(documentTextWithMissingSection)).toThrow('Section "local primary source identifiers" not found in source authority order document.');
  });

  test('parser surfaces a meaningful error when local primary source identifiers is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## local primary source identifiers\n\n- SRC-LOCAL-001\n- SRC-LOCAL-002\n- SRC-LOCAL-003\n- SRC-LOCAL-004\n- SRC-LOCAL-005\n- SRC-LOCAL-006\n/,
      '\n## local primary source identifiers\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseSourceAuthorityOrderDocument(corruptedDocumentText)).toThrow('local primary source identifiers must list at least one identifier.');
  });

  test('parser surfaces a meaningful error when verifiable evidence sources is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## verifiable evidence sources\n\n- local binaries\n- IWAD data\n- id Software source\n- Chocolate Doom source\n/, '\n## verifiable evidence sources\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseSourceAuthorityOrderDocument(corruptedDocumentText)).toThrow('verifiable evidence sources must list at least one source.');
  });

  test('parser surfaces a meaningful error when allowed oracle output roots is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## allowed oracle output roots\n\n- plan_vanilla_parity\/final-gates\/\n- test\/oracles\/fixtures\/\n- test\/vanilla_parity\/acceptance\/\n- test\/vanilla_parity\/oracles\/\n/,
      '\n## allowed oracle output roots\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseSourceAuthorityOrderDocument(corruptedDocumentText)).toThrow('allowed oracle output roots must list at least one root.');
  });
});
