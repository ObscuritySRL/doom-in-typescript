import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-plan-fps-manifest-only-gates.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-017-inventory-plan-fps-manifest-only-gates.md';
const MANIFEST_DIRECTORY_PATH = 'plan_fps/manifests/';
const ACCEPTANCE_TEST_DIRECTORY_PATH = 'test/playable/acceptance/';
const REFERENCE_ORACLES_PATH = 'plan_fps/REFERENCE_ORACLES.md';
const MASTER_CHECKLIST_PATH = 'plan_fps/MASTER_CHECKLIST.md';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const ORACLE_ID_REGEX = /^OR-FPS-\d{3}$/;
const GATE_IDENTIFIER_REGEX = /^15-\d{3}$/;

interface InventoryManifestDirectoryGroups {
  readonly manifest_relative_path: string;
  readonly acceptance_test_relative_path: string;
  readonly manifest_count: number;
  readonly acceptance_test_count: number;
  readonly total_manifest_size_bytes: number;
  readonly total_manifest_line_count: number;
  readonly total_acceptance_test_size_bytes: number;
  readonly total_acceptance_test_line_count: number;
}

interface InventoryGateEntry {
  readonly gate_identifier: string;
  readonly gate_title: string;
  readonly manifest_filename: string;
  readonly manifest_relative_path: string;
  readonly manifest_size_bytes: number;
  readonly manifest_line_count: number;
  readonly manifest_sha256: string;
  readonly manifest_evidence_hash: string;
  readonly manifest_schema_version: number;
  readonly manifest_oracle_id: string;
  readonly acceptance_test_filename: string;
  readonly acceptance_test_relative_path: string;
  readonly acceptance_test_size_bytes: number;
  readonly acceptance_test_line_count: number;
  readonly acceptance_test_sha256: string;
  readonly prior_step_id: string;
  readonly prior_step_title: string;
  readonly next_step_id: string | null;
  readonly next_step_title: string | null;
  readonly captured_oracle_scope_sorted: readonly string[];
}

interface InventoryGateSummary {
  readonly gate_count: number;
  readonly manifest_oracle_ids_sorted: readonly string[];
  readonly manifest_oracle_id_range: readonly string[];
  readonly manifest_oracle_id_count: number;
  readonly captured_oracle_scope_union_sorted: readonly string[];
  readonly captured_oracle_scope_union_count: number;
  readonly gate_identifier_range: readonly string[];
  readonly gate_identifiers_sorted: readonly string[];
  readonly gate_titles_sorted: readonly string[];
  readonly manifest_filenames_sorted: readonly string[];
  readonly acceptance_test_filenames_sorted: readonly string[];
  readonly gate_count_with_no_captured_oracle_scope: number;
  readonly gate_count_with_one_or_more_captured_oracle_scope_entries: number;
}

interface InventoryCommandContractInvariants {
  readonly runtime_command: string;
  readonly program: string;
  readonly subcommand: string;
  readonly entry_file: string;
  readonly notes: string;
}

interface InventoryDeterministicReplayCompatibilityInvariants {
  readonly no_simulation_tic_advance_during_gate: boolean;
  readonly no_input_stream_mutation_during_gate: boolean;
  readonly no_random_seed_mutation_during_gate: boolean;
  readonly no_live_clock_or_audio_or_savefile_redistribution_during_gate: boolean;
  readonly field_name_vocabulary_observed_sorted: readonly string[];
  readonly notes: string;
}

interface InventoryOracleNamespaceOrigin {
  readonly notes: string;
  readonly manifest_oracle_id_namespace_prefix: string;
  readonly manifest_oracle_id_range: readonly string[];
  readonly manifest_oracle_id_count: number;
  readonly captured_oracle_id_namespace_prefix: string;
  readonly captured_oracle_id_range_referenced: readonly string[];
  readonly captured_oracle_unique_count_referenced_here: number;
  readonly current_plan_phase_13_first_step_id: string;
  readonly current_plan_phase_13_first_step_title: string;
  readonly current_plan_phase_13_last_step_id: string;
  readonly current_plan_phase_13_last_step_title: string;
}

interface InventoryBoundaryStatus {
  readonly manifest_relative_path: string;
  readonly acceptance_test_relative_path: string;
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
  readonly manifest_directory_groups: InventoryManifestDirectoryGroups;
  readonly manifest_only_gates: readonly InventoryGateEntry[];
  readonly gate_summary: InventoryGateSummary;
  readonly command_contract_invariants: InventoryCommandContractInvariants;
  readonly deterministic_replay_compatibility_invariants: InventoryDeterministicReplayCompatibilityInvariants;
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

describe('inventory: plan_fps manifest-only gates', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-017');
    expect(inventory.title).toBe('Inventory Plan Fps Manifest Only Gates');
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

  test('inventory summary and evidence method identify the audited plan_fps manifest-only gate surface', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain(MANIFEST_DIRECTORY_PATH);
    expect(inventory.summary).toContain(ACCEPTANCE_TEST_DIRECTORY_PATH);
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.summary).toContain('OR-FPS-037');
    expect(inventory.summary).toContain('OR-FPS-046');
    expect(inventory.summary).toContain('bun run doom.ts');
    expect(inventory.summary).toContain('schemaVersion=1');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('SHA-256');
    expect(inventory.evidence_method).toContain(MANIFEST_DIRECTORY_PATH);
    expect(inventory.evidence_method).toContain(ACCEPTANCE_TEST_DIRECTORY_PATH);
    expect(inventory.evidence_method).toContain('plan_fps/REFERENCE_ORACLES.md');
    expect(inventory.evidence_method).toContain('plan_fps/MASTER_CHECKLIST.md');
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

  test('inventory manifest_directory_groups records both manifest and acceptance test counts and on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const groups = inventory.manifest_directory_groups;
    expect(groups.manifest_relative_path).toBe(MANIFEST_DIRECTORY_PATH);
    expect(groups.acceptance_test_relative_path).toBe(ACCEPTANCE_TEST_DIRECTORY_PATH);
    expect(existsSync(groups.manifest_relative_path)).toBe(true);
    expect(existsSync(groups.acceptance_test_relative_path)).toBe(true);

    const onDiskManifestNames = listMatchingFilenamesSortedAscii(groups.manifest_relative_path, (filename) => filename.startsWith('15-') && filename.endsWith('.json'));
    const onDiskAcceptanceTestNames = listMatchingFilenamesSortedAscii(groups.acceptance_test_relative_path, (filename) => filename.startsWith('gate-') && filename.endsWith('.test.ts'));
    expect(groups.manifest_count).toBe(onDiskManifestNames.length);
    expect(groups.acceptance_test_count).toBe(onDiskAcceptanceTestNames.length);
    expect(groups.manifest_count).toBe(10);
    expect(groups.acceptance_test_count).toBe(10);

    let totalManifestSizeBytes = 0;
    let totalManifestLineCount = 0;
    for (const filename of onDiskManifestNames) {
      const filePath = `${groups.manifest_relative_path}${filename}`;
      totalManifestSizeBytes += statSync(filePath).size;
      totalManifestLineCount += countLines(filePath);
    }
    let totalAcceptanceTestSizeBytes = 0;
    let totalAcceptanceTestLineCount = 0;
    for (const filename of onDiskAcceptanceTestNames) {
      const filePath = `${groups.acceptance_test_relative_path}${filename}`;
      totalAcceptanceTestSizeBytes += statSync(filePath).size;
      totalAcceptanceTestLineCount += countLines(filePath);
    }
    expect(groups.total_manifest_size_bytes).toBe(totalManifestSizeBytes);
    expect(groups.total_manifest_line_count).toBe(totalManifestLineCount);
    expect(groups.total_acceptance_test_size_bytes).toBe(totalAcceptanceTestSizeBytes);
    expect(groups.total_acceptance_test_line_count).toBe(totalAcceptanceTestLineCount);
  });

  test('inventory manifest_only_gates are sorted ASCIIbetically by gate_identifier and cover every on-disk plan_fps/manifests/15-*.json gate', async () => {
    const inventory = await loadInventoryDocument();
    const observedGateIdentifiers = inventory.manifest_only_gates.map((entry) => entry.gate_identifier);
    expectAsciiSorted(observedGateIdentifiers);

    const expectedManifestFilenamesSorted = listMatchingFilenamesSortedAscii(MANIFEST_DIRECTORY_PATH, (name) => name.startsWith('15-') && name.endsWith('.json'));
    expect(inventory.manifest_only_gates.length).toBe(expectedManifestFilenamesSorted.length);
    expect([...observedGateIdentifiers]).toEqual([...expectedManifestFilenamesSorted].map((filename) => filename.slice(0, 6)));
  });

  test('inventory manifest_only_gates entries match on-disk size, line count, and sha256 for every manifest and acceptance test', async () => {
    const inventory = await loadInventoryDocument();
    for (const entry of inventory.manifest_only_gates) {
      expect(GATE_IDENTIFIER_REGEX.test(entry.gate_identifier)).toBe(true);
      expect(entry.gate_title.length).toBeGreaterThan(0);

      expect(existsSync(entry.manifest_relative_path)).toBe(true);
      expect(entry.manifest_size_bytes).toBe(statSync(entry.manifest_relative_path).size);
      expect(entry.manifest_line_count).toBe(countLines(entry.manifest_relative_path));
      expect(entry.manifest_sha256).toBe(computeSha256(entry.manifest_relative_path));
      expect(SHA256_HEX_REGEX.test(entry.manifest_sha256)).toBe(true);
      expect(entry.manifest_relative_path).toBe(`${MANIFEST_DIRECTORY_PATH}${entry.manifest_filename}`);
      expect(entry.manifest_filename.startsWith(`${entry.gate_identifier}-`)).toBe(true);
      expect(entry.manifest_filename.endsWith('.json')).toBe(true);

      expect(existsSync(entry.acceptance_test_relative_path)).toBe(true);
      expect(entry.acceptance_test_size_bytes).toBe(statSync(entry.acceptance_test_relative_path).size);
      expect(entry.acceptance_test_line_count).toBe(countLines(entry.acceptance_test_relative_path));
      expect(entry.acceptance_test_sha256).toBe(computeSha256(entry.acceptance_test_relative_path));
      expect(SHA256_HEX_REGEX.test(entry.acceptance_test_sha256)).toBe(true);
      expect(entry.acceptance_test_relative_path).toBe(`${ACCEPTANCE_TEST_DIRECTORY_PATH}${entry.acceptance_test_filename}`);
      expect(entry.acceptance_test_filename).toBe(`${entry.gate_title}.test.ts`);
    }
  });

  test('inventory manifest_only_gates evidence_hash, schema_version, and oracle_id match the on-disk manifest content', async () => {
    const inventory = await loadInventoryDocument();
    for (const entry of inventory.manifest_only_gates) {
      const manifest = (await Bun.file(entry.manifest_relative_path).json()) as Record<string, unknown>;
      expect(manifest.schemaVersion).toBe(entry.manifest_schema_version);
      expect(manifest.schemaVersion).toBe(1);

      const recordedHash = entry.manifest_evidence_hash;
      expect(SHA256_HEX_REGEX.test(recordedHash)).toBe(true);
      expect(ORACLE_ID_REGEX.test(entry.manifest_oracle_id)).toBe(true);

      const rawManifestText = readFileSync(entry.manifest_relative_path, 'utf8');
      expect(rawManifestText).toContain(recordedHash);
      expect(rawManifestText).toContain(entry.manifest_oracle_id);
    }
  });

  test('inventory manifest_only_gates pin a transition chain where each gate cites the immediately prior gate and the immediately next gate', async () => {
    const inventory = await loadInventoryDocument();
    const gates = inventory.manifest_only_gates;
    for (let gateIndex = 0; gateIndex < gates.length; gateIndex += 1) {
      const gate = gates[gateIndex]!;
      if (gateIndex === 0) {
        expect(gate.gate_identifier).toBe('15-001');
        expect(gate.prior_step_id).toBe('14-007');
        expect(gate.prior_step_title).toBe('smoke-test-clean-local-working-tree');
      } else {
        const prior = gates[gateIndex - 1]!;
        expect(gate.prior_step_id).toBe(prior.gate_identifier);
        expect(gate.prior_step_title).toBe(prior.gate_title);
      }
      if (gateIndex === gates.length - 1) {
        expect(gate.gate_identifier).toBe('15-010');
        expect(gate.next_step_id).toBeNull();
        expect(gate.next_step_title).toBeNull();
      } else {
        const next = gates[gateIndex + 1]!;
        expect(gate.next_step_id).toBe(next.gate_identifier);
        expect(gate.next_step_title).toBe(next.gate_title);
      }
    }
  });

  test('inventory manifest_only_gates pin gate_identifier to gate_title pairs that match the canonical 10-gate table', async () => {
    const inventory = await loadInventoryDocument();
    const expectedGateTitleByIdentifier: Record<string, string> = {
      '15-001': 'gate-plan-structure',
      '15-002': 'gate-bun-launch-smoke',
      '15-003': 'gate-title-frame',
      '15-004': 'gate-menu-navigation',
      '15-005': 'gate-e1m1-start',
      '15-006': 'gate-input-replay',
      '15-007': 'gate-audio',
      '15-008': 'gate-save-load',
      '15-009': 'gate-attract-loop-and-long-run',
      '15-010': 'gate-final-side-by-side',
    };
    expect(Object.keys(expectedGateTitleByIdentifier).length).toBe(inventory.manifest_only_gates.length);
    for (const entry of inventory.manifest_only_gates) {
      expect(entry.gate_title).toBe(expectedGateTitleByIdentifier[entry.gate_identifier]);
    }
  });

  test('inventory manifest_only_gates pin manifest_oracle_ids OR-FPS-037..OR-FPS-046 in canonical gate-identifier order', async () => {
    const inventory = await loadInventoryDocument();
    const expectedOracleIdByIdentifier: Record<string, string> = {
      '15-001': 'OR-FPS-037',
      '15-002': 'OR-FPS-038',
      '15-003': 'OR-FPS-039',
      '15-004': 'OR-FPS-040',
      '15-005': 'OR-FPS-041',
      '15-006': 'OR-FPS-042',
      '15-007': 'OR-FPS-043',
      '15-008': 'OR-FPS-044',
      '15-009': 'OR-FPS-045',
      '15-010': 'OR-FPS-046',
    };
    for (const entry of inventory.manifest_only_gates) {
      expect(entry.manifest_oracle_id).toBe(expectedOracleIdByIdentifier[entry.gate_identifier]);
    }
  });

  test('inventory manifest_only_gates manifest_oracle_id and captured_oracle_scope are registered in plan_fps/REFERENCE_ORACLES.md', async () => {
    const inventory = await loadInventoryDocument();
    const referenceOraclesText = await Bun.file(REFERENCE_ORACLES_PATH).text();
    for (const entry of inventory.manifest_only_gates) {
      expect(referenceOraclesText).toContain(`| ${entry.manifest_oracle_id} | \`${entry.manifest_relative_path}\``);
      expectAsciiSorted(entry.captured_oracle_scope_sorted);
      for (const capturedOracleId of entry.captured_oracle_scope_sorted) {
        expect(ORACLE_ID_REGEX.test(capturedOracleId)).toBe(true);
        expect(referenceOraclesText).toContain(`| ${capturedOracleId} |`);
      }
    }
  });

  test('inventory manifest_only_gates transition lines match plan_fps/MASTER_CHECKLIST.md', async () => {
    const inventory = await loadInventoryDocument();
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    for (const entry of inventory.manifest_only_gates) {
      const checklistPattern = new RegExp(`^- \\[[ x]\\] \`${entry.gate_identifier}\` \`${entry.gate_title}\` \\| prereqs: \`${entry.prior_step_id}\` \\| file: \`plan_fps/steps/${entry.gate_identifier}-${entry.gate_title}\\.md\`$`, 'm');
      expect(checklistText).toMatch(checklistPattern);
    }
  });

  test('inventory gate_summary aggregates counts, ranges, and unions from the per-gate entries', async () => {
    const inventory = await loadInventoryDocument();
    const summary = inventory.gate_summary;
    expect(summary.gate_count).toBe(inventory.manifest_only_gates.length);
    expect(summary.gate_count).toBe(10);

    const recomputedManifestOracleIdsSorted = inventory.manifest_only_gates.map((entry) => entry.manifest_oracle_id).sort();
    expectAsciiSorted(summary.manifest_oracle_ids_sorted);
    expect([...summary.manifest_oracle_ids_sorted]).toEqual([...recomputedManifestOracleIdsSorted]);
    expect(summary.manifest_oracle_id_count).toBe(recomputedManifestOracleIdsSorted.length);
    expect(summary.manifest_oracle_id_range[0]).toBe(recomputedManifestOracleIdsSorted[0]);
    expect(summary.manifest_oracle_id_range[1]).toBe(recomputedManifestOracleIdsSorted[recomputedManifestOracleIdsSorted.length - 1]);

    const capturedScopeUnionRecomputed = new Set<string>();
    for (const entry of inventory.manifest_only_gates) {
      for (const capturedOracleId of entry.captured_oracle_scope_sorted) {
        capturedScopeUnionRecomputed.add(capturedOracleId);
      }
    }
    expectAsciiSorted(summary.captured_oracle_scope_union_sorted);
    expect([...summary.captured_oracle_scope_union_sorted]).toEqual([...capturedScopeUnionRecomputed].sort());
    expect(summary.captured_oracle_scope_union_count).toBe(capturedScopeUnionRecomputed.size);

    const recomputedGateIdentifiersSorted = inventory.manifest_only_gates.map((entry) => entry.gate_identifier).sort();
    expectAsciiSorted(summary.gate_identifiers_sorted);
    expect([...summary.gate_identifiers_sorted]).toEqual([...recomputedGateIdentifiersSorted]);
    expect(summary.gate_identifier_range[0]).toBe(recomputedGateIdentifiersSorted[0]);
    expect(summary.gate_identifier_range[1]).toBe(recomputedGateIdentifiersSorted[recomputedGateIdentifiersSorted.length - 1]);

    const recomputedGateTitlesSorted = inventory.manifest_only_gates.map((entry) => entry.gate_title).sort();
    expectAsciiSorted(summary.gate_titles_sorted);
    expect([...summary.gate_titles_sorted]).toEqual([...recomputedGateTitlesSorted]);

    const recomputedManifestFilenamesSorted = inventory.manifest_only_gates.map((entry) => entry.manifest_filename).sort();
    expectAsciiSorted(summary.manifest_filenames_sorted);
    expect([...summary.manifest_filenames_sorted]).toEqual([...recomputedManifestFilenamesSorted]);

    const recomputedAcceptanceTestFilenamesSorted = inventory.manifest_only_gates.map((entry) => entry.acceptance_test_filename).sort();
    expectAsciiSorted(summary.acceptance_test_filenames_sorted);
    expect([...summary.acceptance_test_filenames_sorted]).toEqual([...recomputedAcceptanceTestFilenamesSorted]);

    const recomputedNoCapturedScope = inventory.manifest_only_gates.filter((entry) => entry.captured_oracle_scope_sorted.length === 0).length;
    const recomputedSomeCapturedScope = inventory.manifest_only_gates.filter((entry) => entry.captured_oracle_scope_sorted.length > 0).length;
    expect(summary.gate_count_with_no_captured_oracle_scope).toBe(recomputedNoCapturedScope);
    expect(summary.gate_count_with_one_or_more_captured_oracle_scope_entries).toBe(recomputedSomeCapturedScope);
    expect(summary.gate_count_with_no_captured_oracle_scope + summary.gate_count_with_one_or_more_captured_oracle_scope_entries).toBe(summary.gate_count);
  });

  test('inventory command_contract_invariants pin the same bun run doom.ts contract every gate manifest declares', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.command_contract_invariants;
    expect(invariants.runtime_command).toBe('bun run doom.ts');
    expect(invariants.program).toBe('bun');
    expect(invariants.subcommand).toBe('run');
    expect(invariants.entry_file).toBe('doom.ts');
    expect(invariants.notes.length).toBeGreaterThan(0);
    for (const entry of inventory.manifest_only_gates) {
      const rawManifestText = readFileSync(entry.manifest_relative_path, 'utf8');
      expect(rawManifestText).toContain('bun run doom.ts');
      expect(rawManifestText).toContain('"program": "bun"');
      expect(rawManifestText).toContain('"subcommand": "run"');
      expect(rawManifestText).toContain('"entryFile": "doom.ts"');
    }
  });

  test('inventory deterministic_replay_compatibility_invariants record the four canonical invariants and the observed field-name vocabulary', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.deterministic_replay_compatibility_invariants;
    expect(invariants.no_simulation_tic_advance_during_gate).toBe(true);
    expect(invariants.no_input_stream_mutation_during_gate).toBe(true);
    expect(invariants.no_random_seed_mutation_during_gate).toBe(true);
    expect(invariants.no_live_clock_or_audio_or_savefile_redistribution_during_gate).toBe(true);
    expectAsciiSorted(invariants.field_name_vocabulary_observed_sorted);
    expect(invariants.field_name_vocabulary_observed_sorted.length).toBeGreaterThan(0);
    expect(invariants.notes.length).toBeGreaterThan(0);

    for (const entry of inventory.manifest_only_gates) {
      const rawManifestText = readFileSync(entry.manifest_relative_path, 'utf8');
      const observedFieldsForThisManifest = invariants.field_name_vocabulary_observed_sorted.filter((fieldName) => rawManifestText.includes(`"${fieldName}":`));
      expect(observedFieldsForThisManifest.length).toBeGreaterThan(0);
    }
  });

  test('inventory oracle_namespace_origin pins the OR-FPS-037..OR-FPS-046 manifest oracle range and the Phase 13 follow-up step ids exist on disk', async () => {
    const inventory = await loadInventoryDocument();
    const origin = inventory.oracle_namespace_origin;
    expect(origin.notes.length).toBeGreaterThan(0);
    expect(origin.manifest_oracle_id_namespace_prefix).toBe('OR-FPS-');
    expect(origin.manifest_oracle_id_range[0]).toBe('OR-FPS-037');
    expect(origin.manifest_oracle_id_range[1]).toBe('OR-FPS-046');
    expect(origin.manifest_oracle_id_count).toBe(inventory.gate_summary.manifest_oracle_id_count);
    expect(origin.captured_oracle_id_namespace_prefix).toBe('OR-FPS-');
    expect(origin.captured_oracle_id_range_referenced[0]).toBe('OR-FPS-009');
    expect(origin.captured_oracle_id_range_referenced[1]).toBe('OR-FPS-036');
    expect(origin.captured_oracle_unique_count_referenced_here).toBe(inventory.gate_summary.captured_oracle_scope_union_count);

    const phase13FirstStepFilePath = `plan_vanilla_parity/steps/${origin.current_plan_phase_13_first_step_id}-${origin.current_plan_phase_13_first_step_title}.md`;
    const phase13LastStepFilePath = `plan_vanilla_parity/steps/${origin.current_plan_phase_13_last_step_id}-${origin.current_plan_phase_13_last_step_title}.md`;
    expect(existsSync(phase13FirstStepFilePath)).toBe(true);
    expect(existsSync(phase13LastStepFilePath)).toBe(true);
  });

  test('inventory boundary_status records the writable workspaces and source-only no-proprietary-bytes contract', async () => {
    const inventory = await loadInventoryDocument();
    const boundary = inventory.boundary_status;
    expect(boundary.manifest_relative_path).toBe(MANIFEST_DIRECTORY_PATH);
    expect(boundary.acceptance_test_relative_path).toBe(ACCEPTANCE_TEST_DIRECTORY_PATH);
    expect(boundary.writable_workspace).toBe(true);
    expect(boundary.source_only_metadata).toBe(true);
    expect(boundary.no_proprietary_bytes_embedded).toBe(true);
    expect(boundary.notes.length).toBeGreaterThan(0);
    expect(boundary.notes).toContain('plan_fps/');
    expect(boundary.notes).toContain('test/playable/acceptance/');
    expect(existsSync(MANIFEST_DIRECTORY_PATH)).toBe(true);
    expect(existsSync(ACCEPTANCE_TEST_DIRECTORY_PATH)).toBe(true);
  });

  test('inventory implications mention the inherited gate count, the OR-FPS namespace prefix, and the Phase 13 acceptance-gate handover', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('15-001');
    expect(concatenatedImplications).toContain('15-010');
    expect(concatenatedImplications).toContain('OR-FPS-046');
    expect(concatenatedImplications).toContain('13-001');
    expect(concatenatedImplications).toContain('13-003');
    expect(concatenatedImplications).toContain('bun run doom.ts');
    expect(concatenatedImplications).toContain('SHA-256');
  });

  test('inventory follow_up_steps point at real plan_vanilla_parity step files', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.follow_up_steps.length).toBeGreaterThan(0);
    let phase13FirstFollowUpFound = false;
    let phase13LastFollowUpFound = false;
    for (const followUpEntry of inventory.follow_up_steps) {
      const stepIdMatch = /^(\d{2}-\d{3})\s+(.+)$/.exec(followUpEntry);
      expect(stepIdMatch).not.toBeNull();
      const stepId = stepIdMatch![1]!;
      const stepSlug = stepIdMatch![2]!;
      const stepFilePath = `plan_vanilla_parity/steps/${stepId}-${stepSlug}.md`;
      expect(existsSync(stepFilePath)).toBe(true);
      expect(statSync(stepFilePath).isFile()).toBe(true);
      if (stepId === '13-001') {
        phase13FirstFollowUpFound = true;
      }
      if (stepId === '13-003') {
        phase13LastFollowUpFound = true;
      }
    }
    expect(phase13FirstFollowUpFound).toBe(true);
    expect(phase13LastFollowUpFound).toBe(true);
  });

  test('step file under plan_vanilla_parity/steps pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-plan-fps-manifest-only-gates.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a fabricated manifest sha256 with a bogus value would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstEntry = inventory.manifest_only_gates[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstEntry.manifest_sha256).not.toBe(fabricatedSha256);
    expect(firstEntry.manifest_sha256).toBe(computeSha256(firstEntry.manifest_relative_path));
  });

  test('failure mode: a fabricated manifest_oracle_id outside OR-FPS-037..OR-FPS-046 would fail the per-entry validation', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedOracleId = 'OR-FPS-999';
    expect(inventory.gate_summary.manifest_oracle_ids_sorted).not.toContain(fabricatedOracleId);
    for (const entry of inventory.manifest_only_gates) {
      expect(entry.manifest_oracle_id).not.toBe(fabricatedOracleId);
      const numericPart = Number.parseInt(entry.manifest_oracle_id.slice('OR-FPS-'.length), 10);
      expect(numericPart).toBeGreaterThanOrEqual(37);
      expect(numericPart).toBeLessThanOrEqual(46);
    }
  });

  test('failure mode: a tampered captured_oracle_scope that adds a bogus OR-FPS-999 entry diverges from the union summary', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedCapturedOracleId = 'OR-FPS-999';
    expect(inventory.gate_summary.captured_oracle_scope_union_sorted).not.toContain(fabricatedCapturedOracleId);
    for (const entry of inventory.manifest_only_gates) {
      expect(entry.captured_oracle_scope_sorted).not.toContain(fabricatedCapturedOracleId);
    }
  });

  test('failure mode: a fabricated runtime_command that disagrees with bun run doom.ts would fail the command-contract invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedRuntimeCommand = 'node doom.js';
    expect(inventory.command_contract_invariants.runtime_command).not.toBe(fabricatedRuntimeCommand);
    expect(inventory.command_contract_invariants.runtime_command).toBe('bun run doom.ts');
  });
});
