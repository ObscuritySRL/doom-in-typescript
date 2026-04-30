import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/classify-stubbed-or-manifest-only-surfaces.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-023-classify-stubbed-or-manifest-only-surfaces.md';
const STATUS_STUBBED_OR_MANIFEST_ONLY = 'stubbed_or_manifest_only';

const CANONICAL_REQUIRED_FIELDS_IN_ORDER: readonly string[] = ['id', 'title', 'lane', 'summary', 'captured_at_utc', 'evidence_method', 'repository_root', 'implications', 'follow_up_steps'];
const EXPECTED_GROUP_IDS_SORTED: readonly string[] = ['explicit_unimplemented_runtime_branch', 'manifest_only_acceptance_gates', 'pending_oracle_capture_fixtures', 'prior_plan_missing_surface_manifests'];
const EXPECTED_STUBBED_OR_MANIFEST_ONLY_CRITERIA_SORTED: readonly string[] = [
  'contains an explicit runtime unimplemented branch or placeholder contract that defers vanilla behavior',
  'records pending reference-capture or pending-live hash/status markers instead of captured comparator bytes',
  'stores acceptance or missing-surface evidence as a manifest/test contract without executing the final vanilla side-by-side path',
  'uses source-only metadata and local git-tracked files rather than proprietary runtime capture output',
];
const GIT_TRACKED_FILE_ROOTS: readonly string[] = [
  'plan_fps/manifests',
  'src/playable/front-end-menus/implementScreenSizeDetailGammaControls.ts',
  'test/oracles',
  'test/plan_fps',
  'test/playable/acceptance',
  'test/playable/front-end-menus/implement-screen-size-detail-gamma-controls.test.ts',
];

interface ClassificationDefinition {
  readonly criteria_sorted: readonly string[];
  readonly not_end_to_end_gate: boolean;
  readonly scope_note: string;
  readonly status_value: string;
}

interface ClassificationSummary {
  readonly group_count: number;
  readonly marker_file_count: number;
  readonly representative_path_count: number;
  readonly source_only_metadata: boolean;
  readonly tracked_file_count: number;
  readonly tracked_test_file_count: number;
}

interface InventoryDocument {
  readonly captured_at_utc: string;
  readonly classification_definition: ClassificationDefinition;
  readonly classification_summary: ClassificationSummary;
  readonly evidence_method: string;
  readonly follow_up_steps: readonly string[];
  readonly id: string;
  readonly implications: readonly string[];
  readonly lane: string;
  readonly repository_root: string;
  readonly stubbed_or_manifest_only_groups: readonly StubbedOrManifestOnlyGroup[];
  readonly summary: string;
  readonly title: string;
}

interface StubbedOrManifestOnlyGroup {
  readonly classification: string;
  readonly evidence: string;
  readonly group_id: string;
  readonly marker_file_count: number;
  readonly notes: string;
  readonly representative_paths: readonly string[];
  readonly status_markers: readonly string[];
  readonly surface_kind: string;
  readonly surface_roots: readonly string[];
  readonly tracked_file_count: number;
  readonly tracked_file_patterns_sorted: readonly string[];
  readonly tracked_test_file_count: number;
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

async function loadInventoryDocument(): Promise<InventoryDocument> {
  return (await Bun.file(INVENTORY_JSON_PATH).json()) as InventoryDocument;
}

async function loadTrackedRepositoryPaths(): Promise<readonly string[]> {
  trackedRepositoryPathsPromise ??= collectTrackedRepositoryPaths();
  return trackedRepositoryPathsPromise;
}

function countMarkerFiles(groupEntry: StubbedOrManifestOnlyGroup, trackedRepositoryPaths: readonly string[]): number {
  let markerFileCount = 0;
  for (const repositoryPath of matchTrackedPatterns(groupEntry.tracked_file_patterns_sorted, trackedRepositoryPaths)) {
    const fileText = readFileSync(repositoryPath, 'utf8');
    if (groupEntry.status_markers.some((statusMarker) => fileText.includes(statusMarker))) {
      markerFileCount += 1;
    }
  }
  return markerFileCount;
}

function countTestFilesForPatterns(patterns: readonly string[], trackedRepositoryPaths: readonly string[]): number {
  return matchTrackedPatterns(patterns, trackedRepositoryPaths).filter((repositoryPath) => repositoryPath.endsWith('.test.ts')).length;
}

function matchTrackedPatterns(patterns: readonly string[], trackedRepositoryPaths: readonly string[]): readonly string[] {
  const matchedRepositoryPaths = new Set<string>();
  const regularExpressions = patterns.map((pattern) => wildcardPatternToRegularExpression(pattern));
  for (const repositoryPath of trackedRepositoryPaths) {
    if (regularExpressions.some((regularExpression) => regularExpression.test(repositoryPath))) {
      matchedRepositoryPaths.add(repositoryPath);
    }
  }
  return [...matchedRepositoryPaths].sort();
}

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((leftValue, rightValue) => (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
}

function wildcardPatternToRegularExpression(pattern: string): RegExp {
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escapedPattern}$`);
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function expectFollowUpStepExists(followUpEntry: string): void {
  const followUpStepMatch = /^(\d{2}-\d{3})\s+([a-z][a-z0-9-]*)$/.exec(followUpEntry);
  expect(followUpStepMatch).not.toBeNull();
  const followUpStepFilePath = `plan_vanilla_parity/steps/${followUpStepMatch![1]}-${followUpStepMatch![2]}.md`;
  expect(existsSync(followUpStepFilePath)).toBe(true);
  expect(statSync(followUpStepFilePath).isFile()).toBe(true);
}

describe('inventory: classify stubbed or manifest-only surfaces', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-023');
    expect(inventory.title).toBe('Classify Stubbed Or Manifest Only Surfaces');
    expect(inventory.lane).toBe('inventory');
  });

  test('inventory declares the canonical nine required top-level fields in canonical order', async () => {
    const inventoryText = await Bun.file(INVENTORY_JSON_PATH).text();
    const parsedInventory = JSON.parse(inventoryText) as Record<string, unknown>;
    const observedKeys = Object.keys(parsedInventory);
    for (const requiredFieldName of CANONICAL_REQUIRED_FIELDS_IN_ORDER) {
      expect(observedKeys).toContain(requiredFieldName);
    }
    const requiredFieldOrder = CANONICAL_REQUIRED_FIELDS_IN_ORDER.map((requiredFieldName) => observedKeys.indexOf(requiredFieldName));
    for (let fieldIndex = 1; fieldIndex < requiredFieldOrder.length; fieldIndex += 1) {
      expect(requiredFieldOrder[fieldIndex]!).toBeGreaterThan(requiredFieldOrder[fieldIndex - 1]!);
    }
  });

  test('inventory captures a parseable UTC timestamp and the absolute repository root', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('classification definition pins the stubbed-or-manifest-only status and source-only scope', async () => {
    const inventory = await loadInventoryDocument();
    const definition = inventory.classification_definition;
    expect(definition.status_value).toBe(STATUS_STUBBED_OR_MANIFEST_ONLY);
    expect(definition.not_end_to_end_gate).toBe(true);
    expect(definition.scope_note).toContain('not sufficient');
    expect(definition.scope_note).toContain('vanilla DOOM 1.9 behavior proof');
    expectAsciiSorted(definition.criteria_sorted);
    expect(definition.criteria_sorted).toEqual([...EXPECTED_STUBBED_OR_MANIFEST_ONLY_CRITERIA_SORTED]);
  });

  test('classification groups are sorted, unique, and match the canonical group list', async () => {
    const inventory = await loadInventoryDocument();
    const observedGroupIds = inventory.stubbed_or_manifest_only_groups.map((groupEntry) => groupEntry.group_id);
    expectAsciiSorted(observedGroupIds);
    expect(observedGroupIds).toEqual([...EXPECTED_GROUP_IDS_SORTED]);
    expect(new Set(observedGroupIds).size).toBe(observedGroupIds.length);
    for (const groupEntry of inventory.stubbed_or_manifest_only_groups) {
      expect(groupEntry.classification).toBe(STATUS_STUBBED_OR_MANIFEST_ONLY);
      expect(groupEntry.evidence.length).toBeGreaterThan(0);
      expect(groupEntry.notes.length).toBeGreaterThan(0);
      expect(groupEntry.surface_kind.length).toBeGreaterThan(0);
      expectAsciiSorted(groupEntry.representative_paths);
      expectAsciiSorted(groupEntry.status_markers);
      expectAsciiSorted(groupEntry.surface_roots);
      expectAsciiSorted(groupEntry.tracked_file_patterns_sorted);
    }
  });

  test('classification summary matches the captured group counts', async () => {
    const inventory = await loadInventoryDocument();
    const totalTrackedFileCount = inventory.stubbed_or_manifest_only_groups.reduce((sum, groupEntry) => sum + groupEntry.tracked_file_count, 0);
    const totalTrackedTestFileCount = inventory.stubbed_or_manifest_only_groups.reduce((sum, groupEntry) => sum + groupEntry.tracked_test_file_count, 0);
    const totalMarkerFileCount = inventory.stubbed_or_manifest_only_groups.reduce((sum, groupEntry) => sum + groupEntry.marker_file_count, 0);
    const totalRepresentativePathCount = inventory.stubbed_or_manifest_only_groups.reduce((sum, groupEntry) => sum + groupEntry.representative_paths.length, 0);
    expect(inventory.classification_summary.group_count).toBe(inventory.stubbed_or_manifest_only_groups.length);
    expect(inventory.classification_summary.tracked_file_count).toBe(totalTrackedFileCount);
    expect(inventory.classification_summary.tracked_test_file_count).toBe(totalTrackedTestFileCount);
    expect(inventory.classification_summary.marker_file_count).toBe(totalMarkerFileCount);
    expect(inventory.classification_summary.representative_path_count).toBe(totalRepresentativePathCount);
    expect(inventory.classification_summary.source_only_metadata).toBe(true);
  });

  test('each group file count and test count matches the git-tracked local repository tree', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    for (const groupEntry of inventory.stubbed_or_manifest_only_groups) {
      const matchedRepositoryPaths = matchTrackedPatterns(groupEntry.tracked_file_patterns_sorted, trackedRepositoryPaths);
      expect(groupEntry.tracked_file_count).toBe(matchedRepositoryPaths.length);
      expect(groupEntry.tracked_test_file_count).toBe(countTestFilesForPatterns(groupEntry.tracked_file_patterns_sorted, trackedRepositoryPaths));
      expect(matchedRepositoryPaths.length).toBeGreaterThan(0);
    }
  });

  test('each group marker count matches files carrying the declared status markers', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    for (const groupEntry of inventory.stubbed_or_manifest_only_groups) {
      expect(groupEntry.marker_file_count).toBe(countMarkerFiles(groupEntry, trackedRepositoryPaths));
      expect(groupEntry.marker_file_count).toBeGreaterThan(0);
      expect(groupEntry.marker_file_count).toBeLessThanOrEqual(groupEntry.tracked_file_count);
    }
  });

  test('representative paths exist and are covered by each group pattern', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    for (const groupEntry of inventory.stubbed_or_manifest_only_groups) {
      const matchedRepositoryPaths = matchTrackedPatterns(groupEntry.tracked_file_patterns_sorted, trackedRepositoryPaths);
      for (const representativePath of groupEntry.representative_paths) {
        expect(existsSync(representativePath)).toBe(true);
        expect(statSync(representativePath).isFile()).toBe(true);
        expect(matchedRepositoryPaths).toContain(representativePath);
        expect(readFileSync(representativePath, 'utf8').trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('known stubbed and manifest-only surfaces keep their exact local evidence', async () => {
    const inventory = await loadInventoryDocument();
    const groupById = new Map(inventory.stubbed_or_manifest_only_groups.map((groupEntry) => [groupEntry.group_id, groupEntry]));

    const explicitRuntimeBranch = groupById.get('explicit_unimplemented_runtime_branch');
    expect(explicitRuntimeBranch).toBeDefined();
    expect(explicitRuntimeBranch!.surface_kind).toBe('runtime_stub');
    expect(readFileSync('src/playable/front-end-menus/implementScreenSizeDetailGammaControls.ts', 'utf8')).toContain('Messages toggle is not implemented by implementScreenSizeDetailGammaControls.');
    expect(readFileSync('test/playable/front-end-menus/implement-screen-size-detail-gamma-controls.test.ts', 'utf8')).toContain('rejects the unimplemented Messages toggle path');

    const manifestOnlyGates = groupById.get('manifest_only_acceptance_gates');
    expect(manifestOnlyGates).toBeDefined();
    expect(manifestOnlyGates!.tracked_file_count).toBe(20);
    expect(manifestOnlyGates!.tracked_test_file_count).toBe(10);

    const pendingOracleFixtures = groupById.get('pending_oracle_capture_fixtures');
    expect(pendingOracleFixtures).toBeDefined();
    expect(pendingOracleFixtures!.marker_file_count).toBe(56);
    expect(pendingOracleFixtures!.status_markers).toContain('pending-unimplemented-side-by-side-surface');

    const priorPlanMissingSurfaces = groupById.get('prior_plan_missing_surface_manifests');
    expect(priorPlanMissingSurfaces).toBeDefined();
    expect(priorPlanMissingSurfaces!.tracked_file_count).toBe(18);
    expect(priorPlanMissingSurfaces!.status_markers).toContain('not implemented in this read scope');
  });

  test('implications and follow-up steps keep deferred surfaces out of final acceptance proof', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('git ls-files');
    expect(inventory.evidence_method).toContain('AUDIT_LOG files are not used');
    expect(inventory.implications.join('\n')).toContain('01-024');
    expect(inventory.implications.join('\n')).toContain('pending capture markers');
    expect(inventory.implications.join('\n')).toContain('unimplemented runtime branches');
    for (const followUpStep of inventory.follow_up_steps) {
      expectFollowUpStepExists(followUpStep);
    }
  });

  test('step file under plan_vanilla_parity/steps pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/classify-stubbed-or-manifest-only-surfaces.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered group classification diverges from the captured status', async () => {
    const inventory = await loadInventoryDocument();
    const firstGroup = inventory.stubbed_or_manifest_only_groups[0]!;
    const tamperedGroup: StubbedOrManifestOnlyGroup = {
      ...firstGroup,
      classification: 'real',
    };
    expect(tamperedGroup.classification).not.toBe(firstGroup.classification);
    expect(firstGroup.classification).toBe(STATUS_STUBBED_OR_MANIFEST_ONLY);
  });

  test('failure mode: a fabricated marker count would not match the local marker search', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    const pendingOracleFixtures = inventory.stubbed_or_manifest_only_groups.find((groupEntry) => groupEntry.group_id === 'pending_oracle_capture_fixtures')!;
    expect(pendingOracleFixtures.marker_file_count + 1).not.toBe(countMarkerFiles(pendingOracleFixtures, trackedRepositoryPaths));
    expect(pendingOracleFixtures.marker_file_count).toBe(countMarkerFiles(pendingOracleFixtures, trackedRepositoryPaths));
  });
});
