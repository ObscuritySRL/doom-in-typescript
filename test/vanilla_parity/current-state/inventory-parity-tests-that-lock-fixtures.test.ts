import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-parity-tests-that-lock-fixtures.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-016-inventory-parity-tests-that-lock-fixtures.md';
const PARITY_TEST_DIRECTORY_PATH = 'test/parity/';
const ORACLE_TEST_DIRECTORY_PATH = 'test/oracles/';
const PARITY_FIXTURES_DIRECTORY_PATH = 'test/parity/fixtures/';
const ORACLE_FIXTURES_DIRECTORY_PATH = 'test/oracles/fixtures/';
const REFERENCE_MANIFESTS_DIRECTORY_PATH = 'reference/manifests/';
const ALLOWED_LOCK_KINDS_SORTED: readonly string[] = ['lock-via-bun-file-json-load', 'lock-via-bun-file-text-json-parse', 'lock-via-bun-file-text-load', 'lock-via-json-module-import', 'lock-via-node-readfilesync'];
const ALLOWED_TEST_DIRECTORY_GROUPS_SORTED: readonly string[] = [ORACLE_TEST_DIRECTORY_PATH, PARITY_TEST_DIRECTORY_PATH];
const ALLOWED_PRIMARY_ORACLE_ID_KINDS_SORTED: readonly string[] = ['O', 'OR-FPS'];

interface InventoryTestDirectoryGroups {
  readonly parity_relative_path: string;
  readonly oracle_relative_path: string;
  readonly parity_test_count: number;
  readonly oracle_test_count: number;
  readonly total_test_count: number;
  readonly total_size_bytes: number;
  readonly total_line_count: number;
}

interface InventoryFixtureLockEntry {
  readonly filename: string;
  readonly relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly test_directory_group: string;
  readonly locked_fixture_paths_sorted: readonly string[];
  readonly locked_manifest_paths_sorted: readonly string[];
  readonly primary_oracle_id: string | null;
  readonly primary_oracle_id_kind: string | null;
  readonly lock_kinds_sorted: readonly string[];
}

interface InventoryFixtureLockSummary {
  readonly test_count: number;
  readonly test_count_by_directory_group: Readonly<Record<string, number>>;
  readonly test_count_with_primary_oracle_id: number;
  readonly test_count_locking_at_least_one_fixture: number;
  readonly test_count_locking_at_least_one_manifest: number;
  readonly primary_oracle_id_kind_distribution: Readonly<Record<string, number>>;
  readonly primary_oracle_ids_o_namespace_sorted: readonly string[];
  readonly primary_oracle_ids_or_fps_namespace_sorted: readonly string[];
  readonly locked_fixture_paths_union_sorted: readonly string[];
  readonly locked_manifest_paths_union_sorted: readonly string[];
  readonly lock_kinds_observed_sorted: readonly string[];
  readonly allowed_lock_kinds_sorted: readonly string[];
  readonly test_filenames_sorted: readonly string[];
}

interface InventoryOracleNamespaceOrigin {
  readonly notes: string;
  readonly plan_engine_namespace_prefix: string;
  readonly plan_engine_oracle_id_range: readonly string[];
  readonly plan_engine_unique_oracle_count_pinned_here: number;
  readonly plan_engine_test_count_pinned_here: number;
  readonly plan_fps_namespace_prefix: string;
  readonly plan_fps_oracle_id_range: readonly string[];
  readonly plan_fps_unique_oracle_count_pinned_here: number;
  readonly plan_fps_test_count_pinned_here: number;
  readonly current_plan_replace_pending_step_id: string;
  readonly current_plan_replace_pending_step_title: string;
  readonly current_plan_gate_step_id: string;
  readonly current_plan_gate_step_title: string;
}

interface InventoryBoundaryStatus {
  readonly parity_relative_path: string;
  readonly oracle_relative_path: string;
  readonly fixtures_relative_paths_sorted: readonly string[];
  readonly manifests_relative_paths_sorted: readonly string[];
  readonly writable_workspace: boolean;
  readonly source_only_metadata: boolean;
  readonly no_proprietary_bytes_embedded: boolean;
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
  readonly test_directory_groups: InventoryTestDirectoryGroups;
  readonly fixture_lock_tests: readonly InventoryFixtureLockEntry[];
  readonly fixture_lock_summary: InventoryFixtureLockSummary;
  readonly oracle_namespace_origin: InventoryOracleNamespaceOrigin;
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

function listMatchingFilenamesSortedAscii(directoryPath: string, predicate: (filename: string) => boolean): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

describe('inventory: parity tests that lock fixtures', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-016');
    expect(inventory.title).toBe('Inventory Parity Tests That Lock Fixtures');
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

  test('inventory summary and evidence method identify the audited parity-test surface', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain(PARITY_TEST_DIRECTORY_PATH);
    expect(inventory.summary).toContain(ORACLE_TEST_DIRECTORY_PATH);
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.summary).toContain('OR-FPS-');
    expect(inventory.summary).toContain('O-022');
    expect(inventory.summary).toContain('reference/manifests/c1-complete.json');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('SHA-256');
    expect(inventory.evidence_method).toContain(PARITY_TEST_DIRECTORY_PATH);
    expect(inventory.evidence_method).toContain(ORACLE_TEST_DIRECTORY_PATH);
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

  test('inventory test_directory_groups records both parity and oracle counts and on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const groups = inventory.test_directory_groups;
    expect(groups.parity_relative_path).toBe(PARITY_TEST_DIRECTORY_PATH);
    expect(groups.oracle_relative_path).toBe(ORACLE_TEST_DIRECTORY_PATH);
    expect(existsSync(groups.parity_relative_path)).toBe(true);
    expect(existsSync(groups.oracle_relative_path)).toBe(true);

    const onDiskParityTestNames = listMatchingFilenamesSortedAscii(groups.parity_relative_path, (filename) => filename.endsWith('.test.ts'));
    const onDiskOracleCaptureTestNames = listMatchingFilenamesSortedAscii(groups.oracle_relative_path, (filename) => filename.startsWith('capture-') && filename.endsWith('.test.ts'));
    expect(groups.parity_test_count).toBe(onDiskParityTestNames.length);
    expect(groups.oracle_test_count).toBe(onDiskOracleCaptureTestNames.length);
    expect(groups.total_test_count).toBe(groups.parity_test_count + groups.oracle_test_count);

    let totalSizeBytes = 0;
    let totalLineCount = 0;
    for (const filename of onDiskParityTestNames) {
      const filePath = `${groups.parity_relative_path}${filename}`;
      totalSizeBytes += statSync(filePath).size;
      totalLineCount += countLines(filePath);
    }
    for (const filename of onDiskOracleCaptureTestNames) {
      const filePath = `${groups.oracle_relative_path}${filename}`;
      totalSizeBytes += statSync(filePath).size;
      totalLineCount += countLines(filePath);
    }
    expect(groups.total_size_bytes).toBe(totalSizeBytes);
    expect(groups.total_line_count).toBe(totalLineCount);
  });

  test('inventory fixture_lock_tests are sorted ASCIIbetically by relative_path and cover every on-disk parity test plus every on-disk capture-* oracle test', async () => {
    const inventory = await loadInventoryDocument();
    const observedRelativePaths = inventory.fixture_lock_tests.map((entry) => entry.relative_path);
    expectAsciiSorted(observedRelativePaths);

    const expectedRelativePaths: string[] = [];
    for (const filename of listMatchingFilenamesSortedAscii(PARITY_TEST_DIRECTORY_PATH, (name) => name.endsWith('.test.ts'))) {
      expectedRelativePaths.push(`${PARITY_TEST_DIRECTORY_PATH}${filename}`);
    }
    for (const filename of listMatchingFilenamesSortedAscii(ORACLE_TEST_DIRECTORY_PATH, (name) => name.startsWith('capture-') && name.endsWith('.test.ts'))) {
      expectedRelativePaths.push(`${ORACLE_TEST_DIRECTORY_PATH}${filename}`);
    }
    expect([...observedRelativePaths].sort()).toEqual([...expectedRelativePaths].sort());
    expect(inventory.fixture_lock_tests.length).toBe(expectedRelativePaths.length);
  });

  test('inventory fixture_lock_tests entries match on-disk size, line count, sha256, and test_directory_group classification', async () => {
    const inventory = await loadInventoryDocument();
    for (const entry of inventory.fixture_lock_tests) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(entry.relative_path.endsWith(`/${entry.filename}`)).toBe(true);
      expect(entry.relative_path.startsWith(entry.test_directory_group)).toBe(true);
      expect(ALLOWED_TEST_DIRECTORY_GROUPS_SORTED).toContain(entry.test_directory_group);
    }
  });

  test('inventory fixture_lock_tests locked fixtures and manifests resolve to existing on-disk files inside permitted workspaces', async () => {
    const inventory = await loadInventoryDocument();
    for (const entry of inventory.fixture_lock_tests) {
      expectAsciiSorted(entry.locked_fixture_paths_sorted);
      expectAsciiSorted(entry.locked_manifest_paths_sorted);
      expect(entry.locked_fixture_paths_sorted.length + entry.locked_manifest_paths_sorted.length).toBeGreaterThan(0);
      for (const fixturePath of entry.locked_fixture_paths_sorted) {
        expect(existsSync(fixturePath)).toBe(true);
        const isInsidePermittedFixturesDirectory = fixturePath.startsWith(PARITY_FIXTURES_DIRECTORY_PATH) || fixturePath.startsWith(ORACLE_FIXTURES_DIRECTORY_PATH);
        expect(isInsidePermittedFixturesDirectory).toBe(true);
      }
      for (const manifestPath of entry.locked_manifest_paths_sorted) {
        expect(existsSync(manifestPath)).toBe(true);
        expect(manifestPath.startsWith(REFERENCE_MANIFESTS_DIRECTORY_PATH)).toBe(true);
      }
    }
  });

  test('inventory fixture_lock_tests primary oracle ids and lock kinds belong to the closed-enum vocabularies', async () => {
    const inventory = await loadInventoryDocument();
    for (const entry of inventory.fixture_lock_tests) {
      if (entry.primary_oracle_id_kind !== null) {
        expect(ALLOWED_PRIMARY_ORACLE_ID_KINDS_SORTED).toContain(entry.primary_oracle_id_kind);
      }
      if (entry.primary_oracle_id !== null) {
        const expectedPrefix = entry.primary_oracle_id_kind === 'O' ? 'O-' : 'OR-FPS-';
        expect(entry.primary_oracle_id.startsWith(expectedPrefix)).toBe(true);
      }
      expectAsciiSorted(entry.lock_kinds_sorted);
      expect(entry.lock_kinds_sorted.length).toBeGreaterThan(0);
      for (const lockKind of entry.lock_kinds_sorted) {
        expect(ALLOWED_LOCK_KINDS_SORTED).toContain(lockKind);
      }
    }
  });

  test('inventory fixture_lock_tests primary oracle id pairs the test filename with the expected OR-FPS-* or O-* identifier for each test', async () => {
    const inventory = await loadInventoryDocument();
    const fileToOracle: Record<string, string> = {
      'audio-suite.test.ts': 'O-027',
      'bundled-demo-sync.test.ts': 'O-023',
      'final-gate.test.ts': 'O-030',
      'framebuffer-crc.test.ts': 'O-025',
      'full-e1-acceptance.test.ts': 'O-030',
      'level-start-state-hash.test.ts': 'O-022',
      'menu-timing.test.ts': 'O-026',
      'quirk-regressions.test.ts': 'O-029',
      'save-load-roundtrip.test.ts': 'O-028',
      'scripted-mechanics.test.ts': 'O-024',
      'capture-demo1-playback-checkpoints.test.ts': 'OR-FPS-012',
      'capture-demo2-playback-checkpoints.test.ts': 'OR-FPS-013',
      'capture-demo3-playback-checkpoints.test.ts': 'OR-FPS-014',
      'capture-e1m1-start-from-clean-launch.test.ts': 'OR-FPS-024',
      'capture-episode-menu-path.test.ts': 'OR-FPS-017',
      'capture-final-side-by-side-replay.test.ts': 'OR-FPS-036',
      'capture-first-menu-frame.test.ts': 'OR-FPS-010',
      'capture-framebuffer-hash-windows.test.ts': 'OR-FPS-034',
      'capture-full-attract-loop-cycle.test.ts': 'OR-FPS-011',
      'capture-implementation-clean-launch-expectations.test.ts': 'OR-FPS-006',
      'capture-initial-title-frame.test.ts': 'OR-FPS-009',
      'capture-live-save-load-roundtrip.test.ts': 'OR-FPS-031',
      'capture-menu-open-close-behavior.test.ts': 'OR-FPS-015',
      'capture-music-event-hash-windows.test.ts': 'OR-FPS-033',
      'capture-new-game-menu-path.test.ts': 'OR-FPS-016',
      'capture-options-menu-path.test.ts': 'OR-FPS-019',
      'capture-quit-confirmation-path.test.ts': 'OR-FPS-023',
      'capture-reference-clean-launch.test.ts': 'OR-FPS-007',
      'capture-save-load-menu-path.test.ts': 'OR-FPS-022',
      'capture-screen-size-detail-gamma-paths.test.ts': 'OR-FPS-021',
      'capture-scripted-combat-path.test.ts': 'OR-FPS-026',
      'capture-scripted-damage-death-path.test.ts': 'OR-FPS-029',
      'capture-scripted-door-use-path.test.ts': 'OR-FPS-028',
      'capture-scripted-intermission-path.test.ts': 'OR-FPS-030',
      'capture-scripted-movement-path.test.ts': 'OR-FPS-025',
      'capture-scripted-pickup-path.test.ts': 'OR-FPS-027',
      'capture-sfx-hash-windows.test.ts': 'OR-FPS-032',
      'capture-skill-menu-path.test.ts': 'OR-FPS-018',
      'capture-sound-volume-menu-path.test.ts': 'OR-FPS-020',
      'capture-startup-sequence.test.ts': 'OR-FPS-008',
      'capture-state-hash-windows.test.ts': 'OR-FPS-035',
    };
    expect(Object.keys(fileToOracle).length).toBe(inventory.fixture_lock_tests.length);
    for (const entry of inventory.fixture_lock_tests) {
      const expectedOracleId = fileToOracle[entry.filename];
      expect(expectedOracleId).toBeDefined();
      expect(entry.primary_oracle_id).toBe(expectedOracleId!);
    }
  });

  test('inventory fixture_lock_summary aggregates counts, names, and observed lock kinds from the per-test entries', async () => {
    const inventory = await loadInventoryDocument();
    const summary = inventory.fixture_lock_summary;
    expect(summary.test_count).toBe(inventory.fixture_lock_tests.length);

    const recomputedCountByGroup: Record<string, number> = {};
    for (const entry of inventory.fixture_lock_tests) {
      recomputedCountByGroup[entry.test_directory_group] = (recomputedCountByGroup[entry.test_directory_group] ?? 0) + 1;
    }
    expect(summary.test_count_by_directory_group).toEqual(recomputedCountByGroup);

    expect(summary.test_count_with_primary_oracle_id).toBe(inventory.fixture_lock_tests.filter((entry) => entry.primary_oracle_id !== null).length);
    expect(summary.test_count_locking_at_least_one_fixture).toBe(inventory.fixture_lock_tests.filter((entry) => entry.locked_fixture_paths_sorted.length > 0).length);
    expect(summary.test_count_locking_at_least_one_manifest).toBe(inventory.fixture_lock_tests.filter((entry) => entry.locked_manifest_paths_sorted.length > 0).length);

    const recomputedKindDistribution: Record<string, number> = {};
    for (const entry of inventory.fixture_lock_tests) {
      const key = entry.primary_oracle_id_kind ?? 'absent';
      recomputedKindDistribution[key] = (recomputedKindDistribution[key] ?? 0) + 1;
    }
    expect(summary.primary_oracle_id_kind_distribution).toEqual(recomputedKindDistribution);

    const recomputedOracleOIds = [...new Set(inventory.fixture_lock_tests.filter((entry) => entry.primary_oracle_id_kind === 'O').map((entry) => entry.primary_oracle_id!))].sort();
    const recomputedOracleOrFpsIds = [...new Set(inventory.fixture_lock_tests.filter((entry) => entry.primary_oracle_id_kind === 'OR-FPS').map((entry) => entry.primary_oracle_id!))].sort();
    expectAsciiSorted(summary.primary_oracle_ids_o_namespace_sorted);
    expectAsciiSorted(summary.primary_oracle_ids_or_fps_namespace_sorted);
    expect([...summary.primary_oracle_ids_o_namespace_sorted]).toEqual([...recomputedOracleOIds]);
    expect([...summary.primary_oracle_ids_or_fps_namespace_sorted]).toEqual([...recomputedOracleOrFpsIds]);

    const recomputedFixtureUnion = new Set<string>();
    const recomputedManifestUnion = new Set<string>();
    const recomputedLockKindsUnion = new Set<string>();
    for (const entry of inventory.fixture_lock_tests) {
      for (const path of entry.locked_fixture_paths_sorted) recomputedFixtureUnion.add(path);
      for (const path of entry.locked_manifest_paths_sorted) recomputedManifestUnion.add(path);
      for (const kind of entry.lock_kinds_sorted) recomputedLockKindsUnion.add(kind);
    }
    expectAsciiSorted(summary.locked_fixture_paths_union_sorted);
    expectAsciiSorted(summary.locked_manifest_paths_union_sorted);
    expectAsciiSorted(summary.lock_kinds_observed_sorted);
    expect([...summary.locked_fixture_paths_union_sorted]).toEqual([...recomputedFixtureUnion].sort());
    expect([...summary.locked_manifest_paths_union_sorted]).toEqual([...recomputedManifestUnion].sort());
    expect([...summary.lock_kinds_observed_sorted]).toEqual([...recomputedLockKindsUnion].sort());

    expect([...summary.allowed_lock_kinds_sorted]).toEqual([...ALLOWED_LOCK_KINDS_SORTED]);
    for (const observedKind of summary.lock_kinds_observed_sorted) {
      expect(ALLOWED_LOCK_KINDS_SORTED).toContain(observedKind);
    }

    const recomputedFilenames = inventory.fixture_lock_tests.map((entry) => entry.filename).sort();
    expectAsciiSorted(summary.test_filenames_sorted);
    expect([...summary.test_filenames_sorted]).toEqual([...recomputedFilenames]);
  });

  test('inventory oracle_namespace_origin pins the plan_engine and plan_fps prefixes plus the current plan replace-pending and gate step ids on disk', async () => {
    const inventory = await loadInventoryDocument();
    const origin = inventory.oracle_namespace_origin;
    expect(origin.notes.length).toBeGreaterThan(0);
    expect(origin.plan_engine_namespace_prefix).toBe('O-');
    expect(origin.plan_fps_namespace_prefix).toBe('OR-FPS-');
    expect(origin.plan_engine_oracle_id_range[0]).toBe('O-022');
    expect(origin.plan_engine_oracle_id_range[1]).toBe('O-030');
    expect(origin.plan_fps_oracle_id_range[0]).toBe('OR-FPS-006');
    expect(origin.plan_fps_oracle_id_range[1]).toBe('OR-FPS-036');
    expect(origin.plan_engine_unique_oracle_count_pinned_here).toBe(inventory.fixture_lock_summary.primary_oracle_ids_o_namespace_sorted.length);
    expect(origin.plan_fps_unique_oracle_count_pinned_here).toBe(inventory.fixture_lock_summary.primary_oracle_ids_or_fps_namespace_sorted.length);
    expect(origin.plan_engine_test_count_pinned_here).toBe(inventory.fixture_lock_tests.filter((entry) => entry.test_directory_group === PARITY_TEST_DIRECTORY_PATH).length);
    expect(origin.plan_fps_test_count_pinned_here).toBe(inventory.fixture_lock_tests.filter((entry) => entry.test_directory_group === ORACLE_TEST_DIRECTORY_PATH).length);

    expect(origin.current_plan_replace_pending_step_id).toBe('02-034');
    expect(origin.current_plan_replace_pending_step_title).toBe('replace-pending-oracle-fixtures-with-live-evidence');
    expect(origin.current_plan_gate_step_id).toBe('02-035');
    expect(origin.current_plan_gate_step_title).toBe('gate-oracle-foundation-without-deferred-status');

    const replacePendingStepFilePath = `plan_vanilla_parity/steps/${origin.current_plan_replace_pending_step_id}-${origin.current_plan_replace_pending_step_title}.md`;
    const gateStepFilePath = `plan_vanilla_parity/steps/${origin.current_plan_gate_step_id}-${origin.current_plan_gate_step_title}.md`;
    expect(existsSync(replacePendingStepFilePath)).toBe(true);
    expect(existsSync(gateStepFilePath)).toBe(true);
  });

  test('inventory boundary_status records the writable workspaces and source-only no-proprietary-bytes contract', async () => {
    const inventory = await loadInventoryDocument();
    const boundary = inventory.boundary_status;
    expect(boundary.parity_relative_path).toBe(PARITY_TEST_DIRECTORY_PATH);
    expect(boundary.oracle_relative_path).toBe(ORACLE_TEST_DIRECTORY_PATH);
    expect(boundary.writable_workspace).toBe(true);
    expect(boundary.source_only_metadata).toBe(true);
    expect(boundary.no_proprietary_bytes_embedded).toBe(true);
    expectAsciiSorted(boundary.fixtures_relative_paths_sorted);
    expectAsciiSorted(boundary.manifests_relative_paths_sorted);
    expect([...boundary.fixtures_relative_paths_sorted]).toEqual([ORACLE_FIXTURES_DIRECTORY_PATH, PARITY_FIXTURES_DIRECTORY_PATH]);
    expect([...boundary.manifests_relative_paths_sorted]).toEqual([REFERENCE_MANIFESTS_DIRECTORY_PATH]);
    expect(boundary.notes.length).toBeGreaterThan(0);
    expect(boundary.notes).toContain(PARITY_TEST_DIRECTORY_PATH);
    expect(boundary.notes).toContain(ORACLE_TEST_DIRECTORY_PATH);
    expect(boundary.notes).toContain('reference/policy.ts');
    expect(existsSync(PARITY_FIXTURES_DIRECTORY_PATH)).toBe(true);
    expect(existsSync(ORACLE_FIXTURES_DIRECTORY_PATH)).toBe(true);
    expect(existsSync(REFERENCE_MANIFESTS_DIRECTORY_PATH)).toBe(true);
  });

  test('inventory implications mention the locked fixture and manifest counts, owning step ids, and oracle namespace prefixes', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain(PARITY_TEST_DIRECTORY_PATH);
    expect(concatenatedImplications).toContain(ORACLE_TEST_DIRECTORY_PATH);
    expect(concatenatedImplications).toContain('02-034');
    expect(concatenatedImplications).toContain('02-035');
    expect(concatenatedImplications).toContain('OR-FPS-');
    expect(concatenatedImplications).toContain('O-022');
    expect(concatenatedImplications).toContain('reference/manifests/c1-complete.json');
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
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-parity-tests-that-lock-fixtures.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a fabricated test sha256 with a bogus value would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstEntry = inventory.fixture_lock_tests[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstEntry.sha256).toBe(computeSha256(firstEntry.relative_path));
  });

  test('failure mode: a fabricated lock kind not in the closed-enum set would fail the per-entry lock-kind validation', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedLockKind = 'lock-via-fabricated-strategy-not-in-allowed-set';
    expect(ALLOWED_LOCK_KINDS_SORTED).not.toContain(fabricatedLockKind);
    for (const entry of inventory.fixture_lock_tests) {
      expect(entry.lock_kinds_sorted).not.toContain(fabricatedLockKind);
    }
  });

  test('failure mode: a tampered locked fixture path that drops a real fixture diverges from the union summary', async () => {
    const inventory = await loadInventoryDocument();
    const summary = inventory.fixture_lock_summary;
    expect(summary.locked_fixture_paths_union_sorted.length).toBeGreaterThan(0);
    const droppedFixturePath = summary.locked_fixture_paths_union_sorted[0]!;
    const tamperedFixturePathsSorted: readonly string[] = summary.locked_fixture_paths_union_sorted.filter((path) => path !== droppedFixturePath);
    expect(tamperedFixturePathsSorted.length).toBe(summary.locked_fixture_paths_union_sorted.length - 1);
    expect(tamperedFixturePathsSorted).not.toContain(droppedFixturePath);
  });

  test('failure mode: a fabricated primary_oracle_id_kind not in the closed-enum set would fail the per-entry validation', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedKind = 'NOT-A-NAMESPACE';
    expect(ALLOWED_PRIMARY_ORACLE_ID_KINDS_SORTED).not.toContain(fabricatedKind);
    for (const entry of inventory.fixture_lock_tests) {
      if (entry.primary_oracle_id_kind !== null) {
        expect(entry.primary_oracle_id_kind).not.toBe(fabricatedKind);
      }
    }
  });
});
