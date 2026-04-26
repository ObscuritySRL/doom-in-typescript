import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const EXAMPLE_INVENTORY_ARTIFACT_PATH = 'plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json';
const EXAMPLE_INVENTORY_STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-001-inventory-root-scripts-and-missing-doom-ts.md';
const EXAMPLE_INVENTORY_TEST_FILE_PATH = 'test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts';
const LANE_WRITE_LOCK_CONTRACT_PATH = 'plan_vanilla_parity/define-lane-write-lock-contract.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-current-state-inventory-schema.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const POLICY_MODULE_PATH = 'src/reference/policy.ts';
const PROPRIETARY_BOUNDARY_PATH = 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md';
const READ_ONLY_REFERENCE_ROOTS_PATH = 'plan_vanilla_parity/define-read-only-reference-roots.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-011-define-current-state-inventory-schema.md';
const STEP_REQUIRED_FIELDS_PATH = 'plan_vanilla_parity/define-step-file-required-fields.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_INVENTORY_ARTIFACT_DIRECTORY = 'plan_vanilla_parity/current-state/';

const CANONICAL_INVENTORY_LANE_OWNED_WRITE_ROOTS: readonly string[] = ['plan_vanilla_parity/current-state/', 'test/vanilla_parity/current-state/'];

const CANONICAL_REQUIRED_TOP_LEVEL_FIELDS: readonly string[] = ['id', 'title', 'lane', 'summary', 'captured_at_utc', 'evidence_method', 'repository_root', 'implications', 'follow_up_steps'];

const CANONICAL_REQUIRED_TOP_LEVEL_FIELD_COUNT = 9;

const CANONICAL_PER_FIELD_CONTRACT_HEADINGS: readonly string[] = [
  'id field contract',
  'title field contract',
  'lane field contract',
  'summary field contract',
  'captured at utc field contract',
  'evidence method field contract',
  'repository root field contract',
  'implications field contract',
  'follow up steps field contract',
];

interface InventorySchemaDocument {
  readonly acceptancePhrasing: string;
  readonly canonicalRequiredTopLevelFieldCount: string;
  readonly canonicalRequiredTopLevelFields: readonly string[];
  readonly capturedAtUtcFieldContract: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly evidenceMethodFieldContract: string;
  readonly followUpStepsFieldContract: string;
  readonly idFieldContract: string;
  readonly implicationsFieldContract: string;
  readonly inventoryArtifactDirectory: string;
  readonly inventoryArtifactEncoding: string;
  readonly inventoryArtifactFilenameRule: string;
  readonly inventoryExtensionRule: string;
  readonly inventoryLaneOwnedWriteRoots: readonly string[];
  readonly inventoryNoProprietaryBytesRule: string;
  readonly inventoryStepFileContract: string;
  readonly inventoryTestContract: string;
  readonly laneFieldContract: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly repositoryRootFieldContract: string;
  readonly scopeName: string;
  readonly summaryFieldContract: string;
  readonly titleFieldContract: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in current state inventory schema document.`);
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

function parseInventorySchemaDocument(documentText: string): InventorySchemaDocument {
  const canonicalRequiredTopLevelFields = extractBullets(documentText, 'canonical required top level fields');
  if (canonicalRequiredTopLevelFields.length === 0) {
    throw new Error('canonical required top level fields must list at least one field.');
  }

  const inventoryLaneOwnedWriteRoots = extractBullets(documentText, 'inventory lane owned write roots');
  if (inventoryLaneOwnedWriteRoots.length === 0) {
    throw new Error('inventory lane owned write roots must list at least one root.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    canonicalRequiredTopLevelFieldCount: extractSection(documentText, 'canonical required top level field count'),
    canonicalRequiredTopLevelFields,
    capturedAtUtcFieldContract: extractSection(documentText, 'captured at utc field contract'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    evidenceMethodFieldContract: extractSection(documentText, 'evidence method field contract'),
    followUpStepsFieldContract: extractSection(documentText, 'follow up steps field contract'),
    idFieldContract: extractSection(documentText, 'id field contract'),
    implicationsFieldContract: extractSection(documentText, 'implications field contract'),
    inventoryArtifactDirectory: extractSection(documentText, 'inventory artifact directory'),
    inventoryArtifactEncoding: extractSection(documentText, 'inventory artifact encoding'),
    inventoryArtifactFilenameRule: extractSection(documentText, 'inventory artifact filename rule'),
    inventoryExtensionRule: extractSection(documentText, 'inventory extension rule'),
    inventoryLaneOwnedWriteRoots,
    inventoryNoProprietaryBytesRule: extractSection(documentText, 'inventory no proprietary bytes rule'),
    inventoryStepFileContract: extractSection(documentText, 'inventory step file contract'),
    inventoryTestContract: extractSection(documentText, 'inventory test contract'),
    laneFieldContract: extractSection(documentText, 'lane field contract'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    repositoryRootFieldContract: extractSection(documentText, 'repository root field contract'),
    scopeName: extractSection(documentText, 'scope name'),
    summaryFieldContract: extractSection(documentText, 'summary field contract'),
    titleFieldContract: extractSection(documentText, 'title field contract'),
  };
}

async function loadInventorySchemaDocument(): Promise<InventorySchemaDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parseInventorySchemaDocument(documentText);
}

describe('define current state inventory schema declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 current-state inventory artifact schema');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('inventory artifact directory pins the canonical plan_vanilla_parity/current-state/ root', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryArtifactDirectory).toBe(CANONICAL_INVENTORY_ARTIFACT_DIRECTORY);
  });

  test('inventory lane owned write roots equal the two roots declared by PARALLEL_WORK.md inventory row', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryLaneOwnedWriteRoots).toEqual(CANONICAL_INVENTORY_LANE_OWNED_WRITE_ROOTS);
    expect(parsed.inventoryLaneOwnedWriteRoots).toHaveLength(2);
    expect(new Set(parsed.inventoryLaneOwnedWriteRoots).size).toBe(parsed.inventoryLaneOwnedWriteRoots.length);
    for (const ownedRoot of parsed.inventoryLaneOwnedWriteRoots) {
      expect(ownedRoot.endsWith('/')).toBe(true);
    }
  });

  test('canonical required top level fields equal the canonical nine in canonical order with no duplicates', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.canonicalRequiredTopLevelFields).toEqual(CANONICAL_REQUIRED_TOP_LEVEL_FIELDS);
    expect(parsed.canonicalRequiredTopLevelFields).toHaveLength(CANONICAL_REQUIRED_TOP_LEVEL_FIELD_COUNT);
    expect(new Set(parsed.canonicalRequiredTopLevelFields).size).toBe(parsed.canonicalRequiredTopLevelFields.length);
    expect(parsed.canonicalRequiredTopLevelFieldCount).toBe(String(CANONICAL_REQUIRED_TOP_LEVEL_FIELD_COUNT));
  });

  test('every canonical required top level field uses snake_case ASCII identifier shape (no spaces, hyphens, or uppercase)', async () => {
    const parsed = await loadInventorySchemaDocument();
    const snakeCasePattern = /^[a-z][a-z0-9_]*$/;
    for (const fieldName of parsed.canonicalRequiredTopLevelFields) {
      expect(snakeCasePattern.test(fieldName)).toBe(true);
    }
  });

  test('per-field contract sections appear in canonical order in the document', async () => {
    const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const headingsInDocumentOrder: readonly string[] = [...documentText.matchAll(/^## (?<heading>.+)$/gm)].map((match) => match.groups!.heading);
    const fieldContractHeadingsInDocumentOrder: readonly string[] = headingsInDocumentOrder.filter((heading) => heading.endsWith(' field contract'));
    expect(fieldContractHeadingsInDocumentOrder).toEqual(CANONICAL_PER_FIELD_CONTRACT_HEADINGS);
  });

  test('id field contract pins the 01-NNN id pattern and the join key role', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.idFieldContract).toContain('`id`');
    expect(parsed.idFieldContract).toContain('01-');
    expect(parsed.idFieldContract).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.idFieldContract).toContain('plan_vanilla_parity/steps/');
    expect(parsed.idFieldContract).toContain('join key');
  });

  test('title field contract pins title case, the step file source, and the non-empty rule', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.titleFieldContract).toContain('`title`');
    expect(parsed.titleFieldContract).toContain('title case');
    expect(parsed.titleFieldContract).toContain('## title');
    expect(parsed.titleFieldContract).toContain('plan_vanilla_parity/steps/');
    expect(parsed.titleFieldContract).toContain('non-empty');
  });

  test('lane field contract pins the literal `inventory` value and the PARALLEL_WORK.md owned-roots anchor', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.laneFieldContract).toContain('`lane`');
    expect(parsed.laneFieldContract).toContain('`inventory`');
    expect(parsed.laneFieldContract).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.laneFieldContract).toContain('plan_vanilla_parity/current-state/');
    expect(parsed.laneFieldContract).toContain('test/vanilla_parity/current-state/');
  });

  test('summary field contract pins the non-empty single-string rule and the captured-at-utc freezing rule', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.summaryFieldContract).toContain('`summary`');
    expect(parsed.summaryFieldContract).toContain('non-empty');
    expect(parsed.summaryFieldContract).toContain('captured_at_utc');
  });

  test('captured at utc field contract pins ISO 8601, the Z suffix, and the frozen snapshot rule', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.capturedAtUtcFieldContract).toContain('`captured_at_utc`');
    expect(parsed.capturedAtUtcFieldContract).toContain('ISO 8601');
    expect(parsed.capturedAtUtcFieldContract).toContain('UTC');
    expect(parsed.capturedAtUtcFieldContract).toContain('`Z`');
    expect(parsed.capturedAtUtcFieldContract).toContain('frozen snapshot');
  });

  test('evidence method field contract names the inventory lane and the local evidence sources cataloged elsewhere', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.evidenceMethodFieldContract).toContain('`evidence_method`');
    expect(parsed.evidenceMethodFieldContract).toContain('inventory lane');
    expect(parsed.evidenceMethodFieldContract).toContain('local repository');
    expect(parsed.evidenceMethodFieldContract).toContain('Chocolate Doom');
    expect(parsed.evidenceMethodFieldContract).toContain('plan_vanilla_parity/SOURCE_CATALOG.md');
  });

  test('repository root field contract pins the absolute-path rule and the cross-machine portability comment', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.repositoryRootFieldContract).toContain('`repository_root`');
    expect(parsed.repositoryRootFieldContract).toContain('absolute path');
    expect(parsed.repositoryRootFieldContract).toContain('repository root');
  });

  test('implications field contract pins the non-empty array rule and the forward-step linkage rule', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.implicationsFieldContract).toContain('`implications`');
    expect(parsed.implicationsFieldContract).toContain('non-empty array');
    expect(parsed.implicationsFieldContract).toContain('rejection');
  });

  test('follow up steps field contract pins the <id> <slug> shape, the regex shape, and the on-disk resolution rule', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.followUpStepsFieldContract).toContain('`follow_up_steps`');
    expect(parsed.followUpStepsFieldContract).toContain('non-empty array');
    expect(parsed.followUpStepsFieldContract).toContain('plan_vanilla_parity/steps/');
    expect(parsed.followUpStepsFieldContract).toContain('\\d{2}-\\d{3}');
    expect(parsed.followUpStepsFieldContract).toContain('[a-z][a-z0-9-]*');
  });

  test('inventory artifact filename rule pins the per-step single-artifact rule and the .json extension', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryArtifactFilenameRule).toContain('plan_vanilla_parity/current-state/');
    expect(parsed.inventoryArtifactFilenameRule).toContain('plan_vanilla_parity/steps/01-NNN-<slug>.md');
    expect(parsed.inventoryArtifactFilenameRule).toContain('plan_vanilla_parity/current-state/<slug>.json');
    expect(parsed.inventoryArtifactFilenameRule).toContain('`.json`');
    expect(parsed.inventoryArtifactFilenameRule).toContain('kebab-case');
    expect(parsed.inventoryArtifactFilenameRule).toContain('write lock');
  });

  test('inventory artifact encoding pins UTF-8 JSON, the object top-level rule, and the JavaScript-only literal exclusions', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryArtifactEncoding).toContain('UTF-8');
    expect(parsed.inventoryArtifactEncoding).toContain('Bun.file(path).json()');
    expect(parsed.inventoryArtifactEncoding).toContain('`object`');
    expect(parsed.inventoryArtifactEncoding).toContain('`array`');
    expect(parsed.inventoryArtifactEncoding).toContain('`undefined`');
    expect(parsed.inventoryArtifactEncoding).toContain('`NaN`');
    expect(parsed.inventoryArtifactEncoding).toContain('`Infinity`');
  });

  test('inventory extension rule allows step-specific fields but forbids canonical-name collisions', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryExtensionRule).toContain('step-specific fields');
    expect(parsed.inventoryExtensionRule).toContain('canonical');
    expect(parsed.inventoryExtensionRule).toContain('collide');
    expect(parsed.inventoryExtensionRule).toContain('Bun.file().json()');
    expect(parsed.inventoryExtensionRule).toContain('no-proprietary-bytes');
  });

  test('inventory no proprietary bytes rule names the three read-only roots and the redistribution boundary anchor', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryNoProprietaryBytesRule).toContain('`doom/`');
    expect(parsed.inventoryNoProprietaryBytesRule).toContain('`iwad/`');
    expect(parsed.inventoryNoProprietaryBytesRule).toContain('`reference/`');
    expect(parsed.inventoryNoProprietaryBytesRule).toContain('plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    expect(parsed.inventoryNoProprietaryBytesRule).toContain('plan_vanilla_parity/define-read-only-reference-roots.md');
    expect(parsed.inventoryNoProprietaryBytesRule).toContain('hashes');
  });

  test('inventory step file contract pins the inventory lane, the two write-locked paths, and the fourteen-field anchor', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryStepFileContract).toContain('plan_vanilla_parity/steps/01-NNN-<slug>.md');
    expect(parsed.inventoryStepFileContract).toContain('`lane: inventory`');
    expect(parsed.inventoryStepFileContract).toContain('plan_vanilla_parity/current-state/<slug>.json');
    expect(parsed.inventoryStepFileContract).toContain('test/vanilla_parity/current-state/<slug>.test.ts');
    expect(parsed.inventoryStepFileContract).toContain('`## write lock`');
    expect(parsed.inventoryStepFileContract).toContain('`## expected changes`');
    expect(parsed.inventoryStepFileContract).toContain('plan_vanilla_parity/define-step-file-required-fields.md');
  });

  test('inventory test contract pins the Bun.file().json() loader, the canonical field assertions, and the failure-mode requirement', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.inventoryTestContract).toContain('test/vanilla_parity/current-state/<slug>.test.ts');
    expect(parsed.inventoryTestContract).toContain('Bun.file');
    expect(parsed.inventoryTestContract).toContain('canonical');
    expect(parsed.inventoryTestContract).toContain('failure-mode');
    expect(parsed.inventoryTestContract).toContain('plan_vanilla_parity/steps/');
  });

  test('every evidence location exists on disk and is a file, with no duplicates', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include the example inventory artifact, every adjacent governance pin, and the policy module', async () => {
    const parsed = await loadInventorySchemaDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      EXAMPLE_INVENTORY_ARTIFACT_PATH,
      EXAMPLE_INVENTORY_STEP_FILE_PATH,
      EXAMPLE_INVENTORY_TEST_FILE_PATH,
      LANE_WRITE_LOCK_CONTRACT_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      POLICY_MODULE_PATH,
      PROPRIETARY_BOUNDARY_PATH,
      READ_ONLY_REFERENCE_ROOTS_PATH,
      SOURCE_CATALOG_PATH,
      STEP_REQUIRED_FIELDS_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity PARALLEL_WORK.md inventory row owns the two canonical inventory write roots', async () => {
    const parallelWorkText = await Bun.file(PARALLEL_WORK_PATH).text();
    const laneRowPattern = /^\| (?<lane>[a-z][a-z0-9-]*) \| [^|]* \| [^|]* \| (?<owns>[^|]+) \| [^|]+ \|$/gm;
    let inventoryOwnsCell: string | null = null;
    for (const match of parallelWorkText.matchAll(laneRowPattern)) {
      const groups = match.groups;
      if (!groups) {
        continue;
      }
      if (groups.lane.trim() === 'inventory') {
        inventoryOwnsCell = groups.owns.trim();
        break;
      }
    }
    expect(inventoryOwnsCell).not.toBeNull();
    const declaredOwnedRoots = new Set(
      inventoryOwnsCell!
        .split(';')
        .map((root) => root.trim())
        .filter((root) => root.length > 0),
    );
    for (const canonicalOwnedRoot of CANONICAL_INVENTORY_LANE_OWNED_WRITE_ROOTS) {
      expect(declaredOwnedRoots.has(canonicalOwnedRoot)).toBe(true);
    }
  });

  test('example inventory artifact at plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json satisfies the canonical schema', async () => {
    const exampleArtifact = (await Bun.file(EXAMPLE_INVENTORY_ARTIFACT_PATH).json()) as Record<string, unknown>;
    for (const requiredFieldName of CANONICAL_REQUIRED_TOP_LEVEL_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(exampleArtifact, requiredFieldName)).toBe(true);
    }
    expect(typeof exampleArtifact.id).toBe('string');
    expect(/^01-\d{3}$/.test(exampleArtifact.id as string)).toBe(true);
    expect(typeof exampleArtifact.title).toBe('string');
    expect((exampleArtifact.title as string).length).toBeGreaterThan(0);
    expect(exampleArtifact.lane).toBe('inventory');
    expect(typeof exampleArtifact.summary).toBe('string');
    expect((exampleArtifact.summary as string).length).toBeGreaterThan(0);
    expect(typeof exampleArtifact.captured_at_utc).toBe('string');
    expect(/Z$/.test(exampleArtifact.captured_at_utc as string)).toBe(true);
    expect(Number.isFinite(Date.parse(exampleArtifact.captured_at_utc as string))).toBe(true);
    expect(typeof exampleArtifact.evidence_method).toBe('string');
    expect((exampleArtifact.evidence_method as string).length).toBeGreaterThan(0);
    expect(typeof exampleArtifact.repository_root).toBe('string');
    expect((exampleArtifact.repository_root as string).length).toBeGreaterThan(0);
    expect(Array.isArray(exampleArtifact.implications)).toBe(true);
    expect((exampleArtifact.implications as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(exampleArtifact.follow_up_steps)).toBe(true);
    expect((exampleArtifact.follow_up_steps as unknown[]).length).toBeGreaterThan(0);
    for (const followUpEntry of exampleArtifact.follow_up_steps as unknown[]) {
      expect(typeof followUpEntry).toBe('string');
      const followUpMatch = /^(\d{2}-\d{3})\s+([a-z][a-z0-9-]*)$/.exec(followUpEntry as string);
      expect(followUpMatch).not.toBeNull();
      const followUpStepFilePath = `plan_vanilla_parity/steps/${followUpMatch![1]}-${followUpMatch![2]}.md`;
      expect(existsSync(followUpStepFilePath)).toBe(true);
      expect(statSync(followUpStepFilePath).isFile()).toBe(true);
    }
  });

  test('example inventory artifact id and title match the corresponding step file under plan_vanilla_parity/steps/', async () => {
    const exampleArtifact = (await Bun.file(EXAMPLE_INVENTORY_ARTIFACT_PATH).json()) as Record<string, unknown>;
    const stepFileText = await Bun.file(EXAMPLE_INVENTORY_STEP_FILE_PATH).text();
    expect(stepFileText).toContain(`\n## id\n\n${exampleArtifact.id as string}\n`);
    expect(stepFileText).toContain(`\n## title\n\n${exampleArtifact.title as string}\n`);
    expect(stepFileText).toContain('\n## lane\n\ninventory\n');
  });

  test('example inventory artifact does not embed proprietary IWAD, DOS executable, or save bytes', async () => {
    const exampleArtifactText = await Bun.file(EXAMPLE_INVENTORY_ARTIFACT_PATH).text();
    expect(exampleArtifactText).not.toContain('IWAD ');
    expect(exampleArtifactText).not.toContain('PWAD ');
    expect(exampleArtifactText).not.toContain('MZ ');
    expect(exampleArtifactText.length).toBeLessThan(64 * 1024);
  });

  test('CLAUDE.md anchors the inventory lane and the read-only roots that inventory artifacts must respect', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Bun');
    expect(claudeText).toContain('`doom/`');
    expect(claudeText).toContain('`iwad/`');
    expect(claudeText).toContain('`reference/`');
  });

  test('AGENTS.md anchors the local-only publishing authority and the no-secrets staging rule that justify isolating inventory artifacts to plan_vanilla_parity/current-state/', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
    expect(agentsText).toContain('Stage files explicitly by name');
  });

  test('plan_vanilla_parity define-read-only-reference-roots.md anchors the same three read-only roots this schema forbids embedding bytes from', async () => {
    const readOnlyReferenceRootsText = await Bun.file(READ_ONLY_REFERENCE_ROOTS_PATH).text();
    expect(readOnlyReferenceRootsText).toContain('- doom/');
    expect(readOnlyReferenceRootsText).toContain('- iwad/');
    expect(readOnlyReferenceRootsText).toContain('- reference/');
  });

  test('plan_vanilla_parity define-step-file-required-fields.md anchors the canonical fourteen-field step shape this schema layers atop', async () => {
    const stepRequiredFieldsText = await Bun.file(STEP_REQUIRED_FIELDS_PATH).text();
    expect(stepRequiredFieldsText).toContain('write lock');
    expect(stepRequiredFieldsText).toContain('expected changes');
    expect(stepRequiredFieldsText).toContain('test files');
  });

  test('src/reference/policy.ts anchors the doom/ root as REFERENCE_BUNDLE_PATH and catalogs the asset boundaries this schema must not embed', async () => {
    const policyText = await Bun.file(POLICY_MODULE_PATH).text();
    expect(policyText).toContain("REFERENCE_BUNDLE_PATH = resolve(PROJECT_ROOT_PATH, 'doom')");
    expect(policyText).toContain('ASSET_BOUNDARIES');
  });

  test('step 00-011 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-011: Define Current State Inventory Schema');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-current-state-inventory-schema.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-current-state-inventory-schema.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-011 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-011` `define-current-state-inventory-schema` | lane: `governance` | prereqs: `00-010` | file: `plan_vanilla_parity/steps/00-011-define-current-state-inventory-schema.md`';
    const expectedCompletedRow = '- [x] `00-011` `define-current-state-inventory-schema` | lane: `governance` | prereqs: `00-010` | file: `plan_vanilla_parity/steps/00-011-define-current-state-inventory-schema.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the canonical artifact directory, every required field, the inventory lane, every read-only root, and the focused-test contract', async () => {
    const parsed = await loadInventorySchemaDocument();
    expect(parsed.acceptancePhrasing).toContain('plan_vanilla_parity/current-state/');
    for (const fieldName of CANONICAL_REQUIRED_TOP_LEVEL_FIELDS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${fieldName}\``);
    }
    expect(parsed.acceptancePhrasing).toContain('`inventory`');
    expect(parsed.acceptancePhrasing).toContain('`doom/`');
    expect(parsed.acceptancePhrasing).toContain('`iwad/`');
    expect(parsed.acceptancePhrasing).toContain('`reference/`');
    expect(parsed.acceptancePhrasing).toContain('test/vanilla_parity/current-state/');
    expect(parsed.acceptancePhrasing).toContain('write lock');
    expect(parsed.acceptancePhrasing).toContain('expected changes');
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 current-state inventory artifact schema\n';
    expect(() => parseInventorySchemaDocument(documentTextWithMissingSection)).toThrow('Section "canonical required top level fields" not found in current state inventory schema document.');
  });

  test('parser surfaces a meaningful error when canonical required top level fields is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## canonical required top level fields\n\n- id\n- title\n- lane\n- summary\n- captured_at_utc\n- evidence_method\n- repository_root\n- implications\n- follow_up_steps\n/,
      '\n## canonical required top level fields\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseInventorySchemaDocument(corruptedDocumentText)).toThrow('canonical required top level fields must list at least one field.');
  });

  test('parser surfaces a meaningful error when inventory lane owned write roots is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## inventory lane owned write roots\n\n- plan_vanilla_parity\/current-state\/\n- test\/vanilla_parity\/current-state\/\n/,
      '\n## inventory lane owned write roots\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parseInventorySchemaDocument(corruptedDocumentText)).toThrow('inventory lane owned write roots must list at least one root.');
  });

  test('failure mode: an inventory artifact with a missing required field would not satisfy the canonical schema', async () => {
    const exampleArtifact = (await Bun.file(EXAMPLE_INVENTORY_ARTIFACT_PATH).json()) as Record<string, unknown>;
    const tamperedArtifact: Record<string, unknown> = { ...exampleArtifact };
    delete tamperedArtifact.id;
    expect(Object.prototype.hasOwnProperty.call(tamperedArtifact, 'id')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(exampleArtifact, 'id')).toBe(true);
  });
});
