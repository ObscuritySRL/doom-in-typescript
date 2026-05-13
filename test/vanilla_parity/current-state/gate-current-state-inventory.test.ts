import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

const CANONICAL_REQUIRED_FIELDS_IN_ORDER: readonly string[] = ['id', 'title', 'lane', 'summary', 'captured_at_utc', 'evidence_method', 'repository_root', 'implications', 'follow_up_steps'];
const EXPECTED_FOLLOW_UP_STEPS_SORTED: readonly string[] = ['02-002 verify-local-reference-file-hashes', '02-003 define-read-only-reference-sandbox-copy-policy', '02-035 gate-oracle-foundation-without-deferred-status'];
const EXPECTED_PRIOR_STEP_IDS_SORTED: readonly string[] = [
  '01-001',
  '01-002',
  '01-003',
  '01-004',
  '01-005',
  '01-006',
  '01-007',
  '01-008',
  '01-009',
  '01-010',
  '01-011',
  '01-012',
  '01-013',
  '01-014',
  '01-015',
  '01-016',
  '01-017',
  '01-018',
  '01-019',
  '01-020',
  '01-021',
  '01-022',
  '01-023',
];
const GATE_INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/gate-current-state-inventory.json';
const GIT_TRACKED_FILE_ROOTS: readonly string[] = ['plan_vanilla_parity/MASTER_CHECKLIST.md', 'plan_vanilla_parity/current-state', 'plan_vanilla_parity/steps', 'test/vanilla_parity/current-state'];
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-024-gate-current-state-inventory.md';

interface GateDefinition {
  readonly checked_prior_step_count: number;
  readonly not_end_to_end_gate: boolean;
  readonly prior_inventory_step_range_end: string;
  readonly prior_inventory_step_range_start: string;
  readonly scope_note: string;
}

interface GateInventoryDocument {
  readonly captured_at_utc: string;
  readonly evidence_method: string;
  readonly follow_up_steps: readonly string[];
  readonly gate_definition: GateDefinition;
  readonly gate_summary: GateSummary;
  readonly id: string;
  readonly implications: readonly string[];
  readonly lane: string;
  readonly prior_inventory_steps: readonly PriorInventoryStep[];
  readonly repository_root: string;
  readonly risk_register: readonly GateRisk[];
  readonly summary: string;
  readonly title: string;
}

interface GateRisk {
  readonly mitigation: string;
  readonly risk_id: string;
  readonly status: string;
}

interface GateSummary {
  readonly artifact_count: number;
  readonly checked_step_count: number;
  readonly focused_test_count: number;
  readonly source_only_metadata: boolean;
  readonly step_file_count: number;
}

interface PriorInventoryStep {
  readonly artifact_path: string;
  readonly focused_test_path: string;
  readonly step_file_path: string;
  readonly step_id: string;
  readonly step_title: string;
  readonly verification_status: string;
}

let trackedRepositoryPathsPromise: Promise<readonly string[]> | undefined;

async function collectTrackedRepositoryPaths(): Promise<readonly string[]> {
  const subprocess = Bun.spawn({
    cmd: ['git', 'ls-files', '--', ...GIT_TRACKED_FILE_ROOTS],
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [standardErrorText, standardOutputText, exitCode] = await Promise.all([new Response(subprocess.stderr).text(), new Response(subprocess.stdout).text(), subprocess.exited]);
  if (exitCode !== 0) {
    throw new Error(`git ls-files failed with exit code ${exitCode}: ${standardErrorText.trim()}`);
  }
  return standardOutputText
    .split(/\r?\n/)
    .filter((repositoryPath) => repositoryPath.length > 0)
    .map((repositoryPath) => repositoryPath.replace(/\\/g, '/'))
    .sort();
}

async function loadGateInventoryDocument(): Promise<GateInventoryDocument> {
  return (await Bun.file(GATE_INVENTORY_JSON_PATH).json()) as GateInventoryDocument;
}

async function loadTrackedRepositoryPaths(): Promise<readonly string[]> {
  trackedRepositoryPathsPromise ??= collectTrackedRepositoryPaths();
  return trackedRepositoryPathsPromise;
}

function checklistEntryIsChecked(masterChecklistText: string, stepIdentifier: string): boolean {
  const checkedChecklistLinePrefix = `- [x] \`${stepIdentifier}\` `;
  const uncheckedChecklistLinePrefix = `- [ ] \`${stepIdentifier}\` `;
  const checklistLine = masterChecklistText.split(/\r?\n/).find((lineText) => lineText.startsWith(checkedChecklistLinePrefix) || lineText.startsWith(uncheckedChecklistLinePrefix));
  if (checklistLine === undefined) {
    throw new Error(`Missing checklist line for ${stepIdentifier}`);
  }
  return checklistLine.startsWith(checkedChecklistLinePrefix);
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function expectFollowUpStepExists(followUpEntry: string): void {
  const followUpStepMatch = /^(\d{2}-\d{3})\s+([a-z][a-z0-9-]*)$/.exec(followUpEntry);
  expect(followUpStepMatch).not.toBeNull();
  if (followUpStepMatch === null) {
    throw new Error(`Invalid follow-up step entry: ${followUpEntry}`);
  }
  const followUpStepFilePath = `plan_vanilla_parity/steps/${followUpStepMatch[1]}-${followUpStepMatch[2]}.md`;
  expect(existsSync(followUpStepFilePath)).toBe(true);
  expect(statSync(followUpStepFilePath).isFile()).toBe(true);
}

function findDuplicateValues(values: readonly string[]): readonly string[] {
  const observedValues = new Set<string>();
  const duplicateValues = new Set<string>();
  for (const value of values) {
    if (observedValues.has(value)) {
      duplicateValues.add(value);
    }
    observedValues.add(value);
  }
  return [...duplicateValues].sort();
}

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((leftValue, rightValue) => (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
}

describe('inventory: gate current state inventory', () => {
  test('gate artifact exists at the canonical write-locked path', () => {
    expect(existsSync(GATE_INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(GATE_INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('gate declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadGateInventoryDocument();
    expect(inventory.id).toBe('01-024');
    expect(inventory.title).toBe('Gate Current State Inventory');
    expect(inventory.lane).toBe('inventory');
  });

  test('gate declares the canonical nine required top-level fields in canonical order', async () => {
    const inventoryText = await Bun.file(GATE_INVENTORY_JSON_PATH).text();
    const parsedInventory = JSON.parse(inventoryText) as Record<string, unknown>;
    const observedKeys = Object.keys(parsedInventory);
    for (const requiredFieldName of CANONICAL_REQUIRED_FIELDS_IN_ORDER) {
      expect(observedKeys).toContain(requiredFieldName);
    }
    const requiredFieldOrder = CANONICAL_REQUIRED_FIELDS_IN_ORDER.map((requiredFieldName) => observedKeys.indexOf(requiredFieldName));
    for (let fieldIndex = 1; fieldIndex < requiredFieldOrder.length; fieldIndex += 1) {
      expect(requiredFieldOrder[fieldIndex]).toBeGreaterThan(requiredFieldOrder[fieldIndex - 1]);
    }
  });

  test('gate captures a parseable UTC timestamp and the absolute repository root', async () => {
    const inventory = await loadGateInventoryDocument();
    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('gate definition marks this as source-only metadata, not runtime parity proof', async () => {
    const inventory = await loadGateInventoryDocument();
    expect(inventory.gate_definition.checked_prior_step_count).toBe(EXPECTED_PRIOR_STEP_IDS_SORTED.length);
    expect(inventory.gate_definition.not_end_to_end_gate).toBe(true);
    expect(inventory.gate_definition.prior_inventory_step_range_start).toBe('01-001');
    expect(inventory.gate_definition.prior_inventory_step_range_end).toBe('01-023');
    expect(inventory.gate_definition.scope_note).toContain('source-only current-state inventory');
    expect(inventory.gate_definition.scope_note).toContain('not a vanilla DOOM 1.9 runtime parity claim');
  });

  test('gate summary matches the captured prior inventory step list', async () => {
    const inventory = await loadGateInventoryDocument();
    expect(inventory.gate_summary.artifact_count).toBe(inventory.prior_inventory_steps.length);
    expect(inventory.gate_summary.checked_step_count).toBe(inventory.prior_inventory_steps.length);
    expect(inventory.gate_summary.focused_test_count).toBe(inventory.prior_inventory_steps.length);
    expect(inventory.gate_summary.source_only_metadata).toBe(true);
    expect(inventory.gate_summary.step_file_count).toBe(inventory.prior_inventory_steps.length);
  });

  test('prior inventory steps are sorted, unique, and cover exactly 01-001 through 01-023', async () => {
    const inventory = await loadGateInventoryDocument();
    const observedStepIdentifiers = inventory.prior_inventory_steps.map((priorStep) => priorStep.step_id);
    expectAsciiSorted(observedStepIdentifiers);
    expect(observedStepIdentifiers).toEqual([...EXPECTED_PRIOR_STEP_IDS_SORTED]);
    expect(findDuplicateValues(observedStepIdentifiers)).toEqual([]);
    expect(observedStepIdentifiers).not.toContain(inventory.id);
  });

  test('each prior artifact, focused test, and step file exists and is tracked by git', async () => {
    const inventory = await loadGateInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    for (const priorStep of inventory.prior_inventory_steps) {
      expect(priorStep.verification_status).toBe('completed_focused_inventory_artifact_test');
      expect(existsSync(priorStep.artifact_path)).toBe(true);
      expect(existsSync(priorStep.focused_test_path)).toBe(true);
      expect(existsSync(priorStep.step_file_path)).toBe(true);
      expect(statSync(priorStep.artifact_path).isFile()).toBe(true);
      expect(statSync(priorStep.focused_test_path).isFile()).toBe(true);
      expect(statSync(priorStep.step_file_path).isFile()).toBe(true);
      expect(trackedRepositoryPaths).toContain(priorStep.artifact_path);
      expect(trackedRepositoryPaths).toContain(priorStep.focused_test_path);
      expect(trackedRepositoryPaths).toContain(priorStep.step_file_path);
    }
  });

  test('each prior artifact declares the matching step id and inventory lane', async () => {
    const inventory = await loadGateInventoryDocument();
    for (const priorStep of inventory.prior_inventory_steps) {
      const priorArtifact = (await Bun.file(priorStep.artifact_path).json()) as Record<string, unknown>;
      expect(priorArtifact.id).toBe(priorStep.step_id);
      expect(priorArtifact.lane).toBe('inventory');
      expect(priorArtifact.title).toBe(priorStep.step_title);
      expect(typeof priorArtifact.captured_at_utc).toBe('string');
    }
  });

  test('MASTER_CHECKLIST marks every prior inventory step complete', async () => {
    const inventory = await loadGateInventoryDocument();
    const masterChecklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    for (const priorStep of inventory.prior_inventory_steps) {
      expect(checklistEntryIsChecked(masterChecklistText, priorStep.step_id)).toBe(true);
    }
  });

  test('step files pin the same current-state artifacts and focused tests that the gate records', async () => {
    const inventory = await loadGateInventoryDocument();
    for (const priorStep of inventory.prior_inventory_steps) {
      const stepFileText = await Bun.file(priorStep.step_file_path).text();
      expect(stepFileText).toContain(priorStep.artifact_path);
      expect(stepFileText).toContain(priorStep.focused_test_path);
      expect(stepFileText).toContain('\n## lane\n\ninventory\n');
    }
  });

  test('gate step file pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(GATE_INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/gate-current-state-inventory.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('follow-up steps and risks keep the gate scoped to downstream work', async () => {
    const inventory = await loadGateInventoryDocument();
    expect(inventory.follow_up_steps).toEqual([...EXPECTED_FOLLOW_UP_STEPS_SORTED]);
    expectAsciiSorted(inventory.follow_up_steps);
    for (const followUpStep of inventory.follow_up_steps) {
      expectFollowUpStepExists(followUpStep);
    }
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.evidence_method).toContain('AUDIT_LOG files are not used');
    expect(inventory.implications.join('\n')).toContain('does not claim vanilla DOOM 1.9 runtime parity');
    expectAsciiSorted(inventory.risk_register.map((riskEntry) => riskEntry.risk_id));
  });

  test('failure mode: a duplicated prior step id is detected by the uniqueness guard', async () => {
    const inventory = await loadGateInventoryDocument();
    const observedStepIdentifiers = inventory.prior_inventory_steps.map((priorStep) => priorStep.step_id);
    const duplicatedStepIdentifiers = [...observedStepIdentifiers, observedStepIdentifiers[0] ?? '01-001'];
    expect(findDuplicateValues(duplicatedStepIdentifiers)).toEqual([observedStepIdentifiers[0]]);
    expect(findDuplicateValues(observedStepIdentifiers)).toEqual([]);
  });

  test('failure mode: an unchecked checklist line would not satisfy the gate predicate', () => {
    const fabricatedChecklistText = '- [ ] `01-001` `inventory-root-scripts-and-missing-doom-ts` | lane: `inventory` | prereqs: `none` | file: `plan_vanilla_parity/steps/01-001-inventory-root-scripts-and-missing-doom-ts.md`';
    expect(checklistEntryIsChecked(fabricatedChecklistText, '01-001')).toBe(false);
    expect(checklistEntryIsChecked(readFileSync(MASTER_CHECKLIST_PATH, 'utf8'), '01-001')).toBe(true);
  });
});
