import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-oracle-fixtures-with-pending-status.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-015-inventory-oracle-fixtures-with-pending-status.md';
const FIXTURES_DIRECTORY_PATH = 'test/oracles/fixtures/';
const FIXTURE_OWNERS_DIRECTORY_PATH = 'test/oracles/';
const ALLOWED_PENDING_SIGNALS_SORTED: readonly string[] = ['hash-status-pending-value', 'null-live-hash-field', 'status-field-pending-value', 'string-token-contains-pending', 'top-level-pending-key'];
const ALLOWED_PENDING_TOP_LEVEL_KEYS_SORTED: readonly string[] = ['deferredLiveHashes', 'pendingCaptureReason', 'pendingLiveCapture', 'pendingLiveHashes', 'pendingReferenceArtifacts'];
const ALLOWED_STEP_ID_FIELD_NAMES_SORTED: readonly string[] = ['stepId', 'stepIdentifier'];
const ALLOWED_ORACLE_ID_FIELD_NAMES_SORTED: readonly string[] = ['oracleId', 'oracleIdentifier'];
const NON_PENDING_FIXTURE_FILENAMES_SORTED: readonly string[] = ['capture-implementation-clean-launch-expectations.json', 'capture-reference-clean-launch.json', 'capture-startup-sequence.json'];

interface InventoryFixturesDirectory {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly fixture_count: number;
  readonly fixture_filenames_sorted: readonly string[];
  readonly total_size_bytes: number;
  readonly total_line_count: number;
}

interface InventoryFixtureEntry {
  readonly filename: string;
  readonly step_id: string | null;
  readonly step_id_field_used: string | null;
  readonly step_title: string | null;
  readonly oracle_id: string | null;
  readonly oracle_id_field_used: string | null;
  readonly schema_version: number;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly is_pending: boolean;
  readonly pending_signals_present: readonly string[];
  readonly pending_status_codes: readonly string[];
  readonly pending_keys_present: readonly string[];
}

interface InventoryPendingStatusSummary {
  readonly pending_fixture_count: number;
  readonly non_pending_fixture_count: number;
  readonly pending_filenames_sorted: readonly string[];
  readonly non_pending_filenames_sorted: readonly string[];
  readonly pending_signals_observed_sorted: readonly string[];
  readonly pending_status_codes_observed_sorted: readonly string[];
  readonly pending_top_level_keys_observed_sorted: readonly string[];
  readonly step_id_field_distribution: Readonly<Record<string, number>>;
  readonly oracle_id_field_distribution: Readonly<Record<string, number>>;
  readonly fixture_step_ids_sorted: readonly string[];
  readonly fixture_step_ids_pending_sorted: readonly string[];
  readonly fixture_step_ids_non_pending_sorted: readonly string[];
  readonly fixture_oracle_ids_present_sorted: readonly string[];
  readonly fixture_count_with_oracle_id: number;
}

interface InventoryFixtureStepIdOrigin {
  readonly notes: string;
  readonly current_plan_phase_02_step_count: number;
  readonly current_plan_replace_pending_step_id: string;
  readonly current_plan_replace_pending_step_title: string;
  readonly current_plan_gate_step_id: string;
  readonly current_plan_gate_step_title: string;
  readonly fixture_step_id_field_options_sorted: readonly string[];
  readonly fixture_oracle_id_field_options_sorted: readonly string[];
}

interface InventoryBoundaryStatus {
  readonly fixtures_directory_relative_path: string;
  readonly writable_workspace: boolean;
  readonly source_only_metadata: boolean;
  readonly no_proprietary_bytes_embedded: boolean;
  readonly fixture_owners_directory_relative_path: string;
  readonly owning_phase: string;
  readonly notes: string;
}

interface InventoryDocument {
  readonly id: string;
  readonly title: string;
  readonly lane: string;
  readonly summary: string;
  readonly captured_at_utc: string;
  readonly evidence_method: string;
  readonly repository_root: string;
  readonly fixtures_directory: InventoryFixturesDirectory;
  readonly fixtures: readonly InventoryFixtureEntry[];
  readonly pending_status_summary: InventoryPendingStatusSummary;
  readonly fixture_step_id_origin: InventoryFixtureStepIdOrigin;
  readonly boundary_status: InventoryBoundaryStatus;
  readonly implications: readonly string[];
  readonly follow_up_steps: readonly string[];
}

async function loadInventoryDocument(): Promise<InventoryDocument> {
  return (await Bun.file(INVENTORY_JSON_PATH).json()) as InventoryDocument;
}

function computeSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function countLines(filePath: string): number {
  const text = readFileSync(filePath, 'utf8');
  if (text.length === 0) {
    return 0;
  }
  const lineCount = text.split('\n').length;
  return text.endsWith('\n') ? lineCount - 1 : lineCount;
}

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((leftValue, rightValue) => (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function listJsonFixtureFilenames(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
}

function readFixtureJson(filePath: string): Record<string, unknown> {
  const text = readFileSync(filePath, 'utf8');
  return JSON.parse(text) as Record<string, unknown>;
}

function classifyFixturePendingSignals(parsed: Record<string, unknown>, text: string): readonly string[] {
  const signals: Set<string> = new Set();
  const pendingTopLevelKeys: readonly string[] = ['pendingLiveHashes', 'pendingLiveCapture', 'pendingReferenceArtifacts', 'pendingCaptureReason', 'deferredLiveHashes'];
  for (const candidateKey of pendingTopLevelKeys) {
    if (Object.prototype.hasOwnProperty.call(parsed, candidateKey)) {
      signals.add('top-level-pending-key');
      break;
    }
  }
  const statusFieldValues = [...text.matchAll(/"status"\s*:\s*"([^"]+)"/g)].map((match) => match[1]!);
  if (statusFieldValues.some((value) => value.toLowerCase().includes('pending') || value.toLowerCase().includes('contract-only') || value.toLowerCase().includes('static-contract-pending'))) {
    signals.add('status-field-pending-value');
  }
  const hashStatusFieldNames: readonly string[] = ['hashStatus', 'expectedHashStatus', 'liveHashStatus', 'liveCaptureStatus', 'liveArtifactStatus', 'liveReferenceStatus', 'referenceCaptureStatus'];
  for (const fieldName of hashStatusFieldNames) {
    const fieldExpression = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`, 'g');
    const fieldMatches = [...text.matchAll(fieldExpression)].map((match) => match[1]!);
    if (fieldMatches.some((value) => value.toLowerCase().includes('pending'))) {
      signals.add('hash-status-pending-value');
    }
  }
  if (/"(?:framebufferSha256|audioSha256|stateSha256|musicEventSha256|sfxSha256|expectedSha256)"\s*:\s*null/.test(text)) {
    signals.add('null-live-hash-field');
  }
  const stringValues = [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
  if (stringValues.some((value) => value.toLowerCase().includes('pending'))) {
    signals.add('string-token-contains-pending');
  }
  return [...signals].sort();
}

function collectFixturePendingStatusCodes(text: string): readonly string[] {
  const codes: Set<string> = new Set();
  for (const match of text.matchAll(/pending-[a-z][a-z0-9\-]*/g)) {
    codes.add(match[0]);
  }
  for (const match of text.matchAll(/"([a-z][a-z0-9\-]*)"/g)) {
    const candidate = match[1]!;
    if (candidate.startsWith('contract-only') || candidate.startsWith('static-contract-pending')) {
      codes.add(candidate);
    }
  }
  return [...codes].sort();
}

function collectFixturePendingTopLevelKeys(parsed: Record<string, unknown>): readonly string[] {
  return Object.keys(parsed)
    .filter((key) => key.toLowerCase().includes('pending') || key.toLowerCase().includes('deferred'))
    .sort();
}

describe('inventory: oracle fixtures with pending status', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-015');
    expect(inventory.title).toBe('Inventory Oracle Fixtures With Pending Status');
    expect(inventory.lane).toBe('inventory');
  });

  test('inventory declares the canonical nine required top-level fields in canonical order', async () => {
    const rawText = await Bun.file(INVENTORY_JSON_PATH).text();
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const canonicalRequiredFieldsInOrder: readonly string[] = ['id', 'title', 'lane', 'summary', 'captured_at_utc', 'evidence_method', 'repository_root', 'implications', 'follow_up_steps'];
    const observedKeys = Object.keys(parsed);
    for (const requiredFieldName of canonicalRequiredFieldsInOrder) {
      expect(observedKeys).toContain(requiredFieldName);
    }
    const requiredFieldOrder = canonicalRequiredFieldsInOrder.map((requiredFieldName) => observedKeys.indexOf(requiredFieldName));
    for (let canonicalIndex = 1; canonicalIndex < requiredFieldOrder.length; canonicalIndex += 1) {
      expect(requiredFieldOrder[canonicalIndex]!).toBeGreaterThan(requiredFieldOrder[canonicalIndex - 1]!);
    }
  });

  test('inventory summary and evidence method identify the audited oracle fixtures surface', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain(FIXTURES_DIRECTORY_PATH);
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.summary).toContain('pending');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('git ls-files');
    expect(inventory.evidence_method).toContain('sha256sum');
    expect(inventory.evidence_method).toContain(FIXTURES_DIRECTORY_PATH);
    expect(inventory.evidence_method).toContain('plan_vanilla_parity/steps/02-');
  });

  test('inventory captured_at_utc is parseable as a UTC ISO 8601 timestamp ending in Z', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
  });

  test('inventory repository_root is the captured absolute path string', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory fixtures_directory enumerates test/oracles/fixtures with on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const directory = inventory.fixtures_directory;
    expect(directory.relative_path).toBe(FIXTURES_DIRECTORY_PATH);
    expect(directory.exists).toBe(true);
    expect(existsSync(directory.relative_path)).toBe(true);
    expectAsciiSorted(directory.fixture_filenames_sorted);
    const onDiskFixtureFilenames = listJsonFixtureFilenames(directory.relative_path);
    expect([...directory.fixture_filenames_sorted]).toEqual([...onDiskFixtureFilenames]);
    expect(directory.fixture_count).toBe(onDiskFixtureFilenames.length);

    let totalSizeBytes = 0;
    let totalLineCount = 0;
    for (const filename of onDiskFixtureFilenames) {
      const fixturePath = `${directory.relative_path}${filename}`;
      totalSizeBytes += statSync(fixturePath).size;
      totalLineCount += countLines(fixturePath);
    }
    expect(directory.total_size_bytes).toBe(totalSizeBytes);
    expect(directory.total_line_count).toBe(totalLineCount);
  });

  test('inventory fixtures are sorted ASCIIbetically and cover every on-disk fixture filename', async () => {
    const inventory = await loadInventoryDocument();
    const observedFilenames = inventory.fixtures.map((fixtureEntry) => fixtureEntry.filename);
    expectAsciiSorted(observedFilenames);
    expect(inventory.fixtures.length).toBe(inventory.fixtures_directory.fixture_count);
    expect([...observedFilenames]).toEqual([...inventory.fixtures_directory.fixture_filenames_sorted]);
  });

  test('inventory fixture entries match on-disk size, line count, sha256, schema version, and embedded step/oracle identifier fields', async () => {
    const inventory = await loadInventoryDocument();
    for (const fixtureEntry of inventory.fixtures) {
      const fixturePath = `${FIXTURES_DIRECTORY_PATH}${fixtureEntry.filename}`;
      expect(existsSync(fixturePath)).toBe(true);
      expect(fixtureEntry.size_bytes).toBe(statSync(fixturePath).size);
      expect(fixtureEntry.line_count).toBe(countLines(fixturePath));
      expect(fixtureEntry.sha256).toBe(computeSha256(fixturePath));

      const parsed = readFixtureJson(fixturePath);
      expect(fixtureEntry.schema_version).toBe(parsed.schemaVersion as number);

      const observedStepIdField: string | null = Object.prototype.hasOwnProperty.call(parsed, 'stepId') ? 'stepId' : Object.prototype.hasOwnProperty.call(parsed, 'stepIdentifier') ? 'stepIdentifier' : null;
      expect(fixtureEntry.step_id_field_used).toBe(observedStepIdField);
      const observedStepIdValue: string | null = observedStepIdField === 'stepId' ? (parsed.stepId as string) : observedStepIdField === 'stepIdentifier' ? (parsed.stepIdentifier as string) : null;
      expect(fixtureEntry.step_id).toBe(observedStepIdValue);

      const observedStepTitle: string | null = Object.prototype.hasOwnProperty.call(parsed, 'stepTitle') ? (parsed.stepTitle as string) : null;
      expect(fixtureEntry.step_title).toBe(observedStepTitle);

      const observedOracleIdField: string | null = Object.prototype.hasOwnProperty.call(parsed, 'oracleId') ? 'oracleId' : Object.prototype.hasOwnProperty.call(parsed, 'oracleIdentifier') ? 'oracleIdentifier' : null;
      expect(fixtureEntry.oracle_id_field_used).toBe(observedOracleIdField);
      const observedOracleIdValue: string | null = observedOracleIdField === 'oracleId' ? (parsed.oracleId as string) : observedOracleIdField === 'oracleIdentifier' ? (parsed.oracleIdentifier as string) : null;
      expect(fixtureEntry.oracle_id).toBe(observedOracleIdValue);
    }
  });

  test('inventory fixture pending classification matches recomputed pending signals, status codes, and top-level pending or deferred keys', async () => {
    const inventory = await loadInventoryDocument();
    for (const fixtureEntry of inventory.fixtures) {
      const fixturePath = `${FIXTURES_DIRECTORY_PATH}${fixtureEntry.filename}`;
      const text = readFileSync(fixturePath, 'utf8');
      const parsed = JSON.parse(text) as Record<string, unknown>;

      const recomputedSignals = classifyFixturePendingSignals(parsed, text);
      expect([...fixtureEntry.pending_signals_present]).toEqual([...recomputedSignals]);

      const recomputedStatusCodes = collectFixturePendingStatusCodes(text);
      expect([...fixtureEntry.pending_status_codes]).toEqual([...recomputedStatusCodes]);

      const recomputedTopLevelKeys = collectFixturePendingTopLevelKeys(parsed);
      expect([...fixtureEntry.pending_keys_present]).toEqual([...recomputedTopLevelKeys]);

      expect(fixtureEntry.is_pending).toBe(recomputedSignals.length > 0);

      for (const signalName of fixtureEntry.pending_signals_present) {
        expect(ALLOWED_PENDING_SIGNALS_SORTED).toContain(signalName);
      }
      for (const topLevelKey of fixtureEntry.pending_keys_present) {
        expect(ALLOWED_PENDING_TOP_LEVEL_KEYS_SORTED).toContain(topLevelKey);
      }
      if (fixtureEntry.step_id_field_used !== null) {
        expect(ALLOWED_STEP_ID_FIELD_NAMES_SORTED).toContain(fixtureEntry.step_id_field_used);
      }
      if (fixtureEntry.oracle_id_field_used !== null) {
        expect(ALLOWED_ORACLE_ID_FIELD_NAMES_SORTED).toContain(fixtureEntry.oracle_id_field_used);
      }
    }
  });

  test('inventory pending_status_summary aggregates counts, names, and observed signals from the fixture entries', async () => {
    const inventory = await loadInventoryDocument();
    const summary = inventory.pending_status_summary;

    const recomputedPendingFilenames = inventory.fixtures
      .filter((fixtureEntry) => fixtureEntry.is_pending)
      .map((fixtureEntry) => fixtureEntry.filename)
      .sort();
    const recomputedNonPendingFilenames = inventory.fixtures
      .filter((fixtureEntry) => !fixtureEntry.is_pending)
      .map((fixtureEntry) => fixtureEntry.filename)
      .sort();

    expect(summary.pending_fixture_count).toBe(recomputedPendingFilenames.length);
    expect(summary.non_pending_fixture_count).toBe(recomputedNonPendingFilenames.length);
    expectAsciiSorted(summary.pending_filenames_sorted);
    expectAsciiSorted(summary.non_pending_filenames_sorted);
    expect([...summary.pending_filenames_sorted]).toEqual([...recomputedPendingFilenames]);
    expect([...summary.non_pending_filenames_sorted]).toEqual([...recomputedNonPendingFilenames]);
    expect([...summary.non_pending_filenames_sorted]).toEqual([...NON_PENDING_FIXTURE_FILENAMES_SORTED]);

    const recomputedSignalsUnion = new Set<string>();
    const recomputedStatusCodesUnion = new Set<string>();
    const recomputedTopLevelKeysUnion = new Set<string>();
    for (const fixtureEntry of inventory.fixtures) {
      for (const signalName of fixtureEntry.pending_signals_present) {
        recomputedSignalsUnion.add(signalName);
      }
      for (const statusCode of fixtureEntry.pending_status_codes) {
        recomputedStatusCodesUnion.add(statusCode);
      }
      for (const topLevelKey of fixtureEntry.pending_keys_present) {
        recomputedTopLevelKeysUnion.add(topLevelKey);
      }
    }
    expectAsciiSorted(summary.pending_signals_observed_sorted);
    expectAsciiSorted(summary.pending_status_codes_observed_sorted);
    expectAsciiSorted(summary.pending_top_level_keys_observed_sorted);
    expect([...summary.pending_signals_observed_sorted]).toEqual([...recomputedSignalsUnion].sort());
    expect([...summary.pending_status_codes_observed_sorted]).toEqual([...recomputedStatusCodesUnion].sort());
    expect([...summary.pending_top_level_keys_observed_sorted]).toEqual([...recomputedTopLevelKeysUnion].sort());

    const recomputedStepIdFieldDistribution: Record<string, number> = {};
    const recomputedOracleIdFieldDistribution: Record<string, number> = {};
    for (const fixtureEntry of inventory.fixtures) {
      const stepIdFieldKey = fixtureEntry.step_id_field_used ?? 'absent';
      recomputedStepIdFieldDistribution[stepIdFieldKey] = (recomputedStepIdFieldDistribution[stepIdFieldKey] ?? 0) + 1;
      const oracleIdFieldKey = fixtureEntry.oracle_id_field_used ?? 'absent';
      recomputedOracleIdFieldDistribution[oracleIdFieldKey] = (recomputedOracleIdFieldDistribution[oracleIdFieldKey] ?? 0) + 1;
    }
    expect(summary.step_id_field_distribution).toEqual(recomputedStepIdFieldDistribution);
    expect(summary.oracle_id_field_distribution).toEqual(recomputedOracleIdFieldDistribution);

    const recomputedFixtureStepIds = [...new Set(inventory.fixtures.map((fixtureEntry) => fixtureEntry.step_id).filter((stepId): stepId is string => stepId !== null))].sort();
    const recomputedFixtureStepIdsPending = [
      ...new Set(
        inventory.fixtures
          .filter((fixtureEntry) => fixtureEntry.is_pending)
          .map((fixtureEntry) => fixtureEntry.step_id)
          .filter((stepId): stepId is string => stepId !== null),
      ),
    ].sort();
    const recomputedFixtureStepIdsNonPending = [
      ...new Set(
        inventory.fixtures
          .filter((fixtureEntry) => !fixtureEntry.is_pending)
          .map((fixtureEntry) => fixtureEntry.step_id)
          .filter((stepId): stepId is string => stepId !== null),
      ),
    ].sort();
    const recomputedFixtureOracleIds = [...new Set(inventory.fixtures.map((fixtureEntry) => fixtureEntry.oracle_id).filter((oracleId): oracleId is string => oracleId !== null))].sort();

    expect([...summary.fixture_step_ids_sorted]).toEqual([...recomputedFixtureStepIds]);
    expect([...summary.fixture_step_ids_pending_sorted]).toEqual([...recomputedFixtureStepIdsPending]);
    expect([...summary.fixture_step_ids_non_pending_sorted]).toEqual([...recomputedFixtureStepIdsNonPending]);
    expect([...summary.fixture_oracle_ids_present_sorted]).toEqual([...recomputedFixtureOracleIds]);
    expect(summary.fixture_count_with_oracle_id).toBe(inventory.fixtures.filter((fixtureEntry) => fixtureEntry.oracle_id !== null).length);
  });

  test('inventory fixture_step_id_origin pins the current plan replace-pending and gate step ids and resolves them on disk', async () => {
    const inventory = await loadInventoryDocument();
    const origin = inventory.fixture_step_id_origin;
    expect(origin.notes.length).toBeGreaterThan(0);
    expect(origin.current_plan_phase_02_step_count).toBeGreaterThan(0);
    expect(origin.current_plan_replace_pending_step_id).toBe('02-034');
    expect(origin.current_plan_replace_pending_step_title).toBe('replace-pending-oracle-fixtures-with-live-evidence');
    expect(origin.current_plan_gate_step_id).toBe('02-035');
    expect(origin.current_plan_gate_step_title).toBe('gate-oracle-foundation-without-deferred-status');
    expect([...origin.fixture_step_id_field_options_sorted]).toEqual([...ALLOWED_STEP_ID_FIELD_NAMES_SORTED]);
    expect([...origin.fixture_oracle_id_field_options_sorted]).toEqual([...ALLOWED_ORACLE_ID_FIELD_NAMES_SORTED]);

    const replacePendingStepFilePath = `plan_vanilla_parity/steps/${origin.current_plan_replace_pending_step_id}-${origin.current_plan_replace_pending_step_title}.md`;
    const gateStepFilePath = `plan_vanilla_parity/steps/${origin.current_plan_gate_step_id}-${origin.current_plan_gate_step_title}.md`;
    expect(existsSync(replacePendingStepFilePath)).toBe(true);
    expect(existsSync(gateStepFilePath)).toBe(true);

    const phase02StepFilePaths = readdirSync('plan_vanilla_parity/steps', { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name.startsWith('02-'))
      .map((entry) => entry.name);
    expect(origin.current_plan_phase_02_step_count).toBe(phase02StepFilePaths.length);
  });

  test('inventory boundary_status records the writable workspace and source-only no-proprietary-bytes contract', async () => {
    const inventory = await loadInventoryDocument();
    const boundary = inventory.boundary_status;
    expect(boundary.fixtures_directory_relative_path).toBe(FIXTURES_DIRECTORY_PATH);
    expect(boundary.writable_workspace).toBe(true);
    expect(boundary.source_only_metadata).toBe(true);
    expect(boundary.no_proprietary_bytes_embedded).toBe(true);
    expect(boundary.fixture_owners_directory_relative_path).toBe(FIXTURE_OWNERS_DIRECTORY_PATH);
    expect(boundary.owning_phase).toContain('Phase 02');
    expect(boundary.notes.length).toBeGreaterThan(0);
    expect(boundary.notes).toContain(FIXTURES_DIRECTORY_PATH);
    expect(boundary.notes).toContain('schemaVersion=1');
    expect(existsSync(boundary.fixtures_directory_relative_path)).toBe(true);
    expect(existsSync(boundary.fixture_owners_directory_relative_path)).toBe(true);
  });

  test('inventory implications reference the pending status counts, owning step ids, and field-naming variants', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain(FIXTURES_DIRECTORY_PATH);
    expect(concatenatedImplications).toContain('02-034');
    expect(concatenatedImplications).toContain('02-035');
    expect(concatenatedImplications).toContain('stepId');
    expect(concatenatedImplications).toContain('stepIdentifier');
    expect(concatenatedImplications).toContain('schemaVersion=1');
  });

  test('inventory follow_up_steps point at real plan_vanilla_parity step files including the replace-pending and gate steps', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.follow_up_steps.length).toBeGreaterThan(0);
    let replacePendingFollowUpFound = false;
    let gateFollowUpFound = false;
    for (const followUpEntry of inventory.follow_up_steps) {
      const stepIdMatch = /^(\d{2}-\d{3})\s+(.+)$/.exec(followUpEntry);
      expect(stepIdMatch).not.toBeNull();
      const stepId = stepIdMatch![1]!;
      const stepSlug = stepIdMatch![2]!;
      const stepFilePath = `plan_vanilla_parity/steps/${stepId}-${stepSlug}.md`;
      expect(existsSync(stepFilePath)).toBe(true);
      expect(statSync(stepFilePath).isFile()).toBe(true);
      if (stepId === '02-034') {
        replacePendingFollowUpFound = true;
      }
      if (stepId === '02-035') {
        gateFollowUpFound = true;
      }
    }
    expect(replacePendingFollowUpFound).toBe(true);
    expect(gateFollowUpFound).toBe(true);
  });

  test('step file under plan_vanilla_parity/steps pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-oracle-fixtures-with-pending-status.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered inventory that flips a non-pending fixture to pending diverges from the captured snapshot', async () => {
    const inventory = await loadInventoryDocument();
    const originalEntry = inventory.fixtures.find((fixtureEntry) => fixtureEntry.filename === 'capture-startup-sequence.json')!;
    expect(originalEntry.is_pending).toBe(false);
    const tamperedEntry: InventoryFixtureEntry = {
      ...originalEntry,
      is_pending: true,
    };
    expect(tamperedEntry.is_pending).not.toBe(originalEntry.is_pending);
  });

  test('failure mode: a fabricated fixture sha256 with a bogus value would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstFixtureEntry = inventory.fixtures[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstFixtureEntry.sha256).not.toBe(fabricatedSha256);
    const fixturePath = `${FIXTURES_DIRECTORY_PATH}${firstFixtureEntry.filename}`;
    expect(firstFixtureEntry.sha256).toBe(computeSha256(fixturePath));
  });

  test('failure mode: a tampered pending status summary that drops a pending filename diverges from the per-entry classification', async () => {
    const inventory = await loadInventoryDocument();
    const summary = inventory.pending_status_summary;
    expect(summary.pending_filenames_sorted.length).toBeGreaterThan(0);
    const droppedPendingFilename = summary.pending_filenames_sorted[0]!;
    const tamperedFilenamesSorted: readonly string[] = summary.pending_filenames_sorted.filter((filename) => filename !== droppedPendingFilename);
    expect(tamperedFilenamesSorted.length).toBe(summary.pending_filenames_sorted.length - 1);
    expect(tamperedFilenamesSorted).not.toContain(droppedPendingFilename);
  });

  test('failure mode: a fabricated pending signal not in the closed-enum set would fail the per-entry signal validation', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedSignal = 'pending-fabricated-signal-not-in-allowed-set';
    expect(ALLOWED_PENDING_SIGNALS_SORTED).not.toContain(fabricatedSignal);
    for (const fixtureEntry of inventory.fixtures) {
      expect(fixtureEntry.pending_signals_present).not.toContain(fabricatedSignal);
    }
  });
});
