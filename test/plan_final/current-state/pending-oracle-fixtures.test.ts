import { describe, expect, test } from 'bun:test';

import { readFileSync, readdirSync } from 'node:fs';

import pendingOracleFixturesInventory from '../../../plan_final/current-state/pending-oracle-fixtures.json';

const FIXTURES_DIRECTORY_PATH = 'test/oracles/fixtures/';
const PENDING_MARKER_SUBSTRINGS = ['contract-only', 'pending', 'Pending', 'unimplemented', 'Unimplemented'] as const;

function listFixtureFilenames(): readonly string[] {
  return readdirSync(FIXTURES_DIRECTORY_PATH)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function extractDistinctQuotedPendingStringsFromFile(filePath: string): { readonly distinctSorted: readonly string[]; readonly totalOccurrences: number } {
  const fileText = readFileSync(filePath, 'utf8');
  const quotedStringPattern = /"([^"\\]|\\.)*"/g;
  const distinctQuotedPendingStrings = new Set<string>();
  let totalPendingMarkerOccurrenceCount = 0;
  for (const match of fileText.matchAll(quotedStringPattern)) {
    const quotedString = match[0];
    for (const markerSubstring of PENDING_MARKER_SUBSTRINGS) {
      if (quotedString.includes(markerSubstring)) {
        distinctQuotedPendingStrings.add(quotedString);
        totalPendingMarkerOccurrenceCount += 1;
        break;
      }
    }
  }
  return { distinctSorted: [...distinctQuotedPendingStrings].sort(), totalOccurrences: totalPendingMarkerOccurrenceCount };
}

describe('inventory: pending oracle fixtures', () => {
  test('inventory pins the canonical id, title, and lane', () => {
    expect(pendingOracleFixturesInventory.id).toBe('01-003');
    expect(pendingOracleFixturesInventory.title).toBe('inventory-pending-oracle-fixtures');
    expect(pendingOracleFixturesInventory.lane).toBe('current-state');
  });

  test('inventory captured_at_utc is a UTC ISO 8601 timestamp ending in Z', () => {
    expect(pendingOracleFixturesInventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(pendingOracleFixturesInventory.captured_at_utc).getTime())).toBe(true);
  });

  test('inventory pending_marker_substrings_searched matches the canonical search list', () => {
    expect([...pendingOracleFixturesInventory.pending_marker_substrings_searched]).toEqual([...PENDING_MARKER_SUBSTRINGS]);
  });

  test('inventory fixtures_directory_relative_path matches the on-disk read-only fixtures directory', () => {
    expect(pendingOracleFixturesInventory.fixtures_directory_relative_path).toBe(FIXTURES_DIRECTORY_PATH);
  });

  test('inventory total_fixture_file_count matches the on-disk fixture count', () => {
    expect(pendingOracleFixturesInventory.total_fixture_file_count).toBe(listFixtureFilenames().length);
  });

  test('inventory total_fixture_files_with_markers matches the freshly observed fresh fixture-with-marker count', () => {
    const observedFixturesWithMarkers = listFixtureFilenames().filter((filename) => extractDistinctQuotedPendingStringsFromFile(`${FIXTURES_DIRECTORY_PATH}${filename}`).distinctSorted.length > 0);
    expect(pendingOracleFixturesInventory.total_fixture_files_with_markers).toBe(observedFixturesWithMarkers.length);
  });

  test('inventory fixtures_with_markers_sorted is ASCIIbetically sorted by relative_path', () => {
    const observedRelativePaths = pendingOracleFixturesInventory.fixtures_with_markers_sorted.map((entry) => entry.relative_path);
    expect([...observedRelativePaths]).toEqual([...observedRelativePaths].sort());
  });

  test('inventory fixtures_with_markers_sorted entries match a fresh read of every fixture body', () => {
    for (const fixtureEntry of pendingOracleFixturesInventory.fixtures_with_markers_sorted) {
      const freshExtraction = extractDistinctQuotedPendingStringsFromFile(fixtureEntry.relative_path);
      expect([...fixtureEntry.distinct_quoted_pending_strings_in_file]).toEqual([...freshExtraction.distinctSorted]);
      expect(fixtureEntry.total_pending_marker_occurrence_count).toBe(freshExtraction.totalOccurrences);
    }
  });

  test('inventory distinct_quoted_pending_string_frequencies_sorted is ASCIIbetically keyed and matches fresh occurrence counts', () => {
    const observedKeys = Object.keys(pendingOracleFixturesInventory.distinct_quoted_pending_string_frequencies_sorted);
    expect(observedKeys).toEqual([...observedKeys].sort());

    const freshFrequencies: Record<string, number> = {};
    for (const filename of listFixtureFilenames()) {
      const filePath = `${FIXTURES_DIRECTORY_PATH}${filename}`;
      const fileText = readFileSync(filePath, 'utf8');
      const quotedStringPattern = /"([^"\\]|\\.)*"/g;
      for (const match of fileText.matchAll(quotedStringPattern)) {
        const quotedString = match[0];
        for (const markerSubstring of PENDING_MARKER_SUBSTRINGS) {
          if (quotedString.includes(markerSubstring)) {
            freshFrequencies[quotedString] = (freshFrequencies[quotedString] ?? 0) + 1;
            break;
          }
        }
      }
    }

    for (const [quotedString, recordedCount] of Object.entries(pendingOracleFixturesInventory.distinct_quoted_pending_string_frequencies_sorted)) {
      expect(freshFrequencies[quotedString]).toBe(recordedCount);
    }
    expect(Object.keys(freshFrequencies).sort()).toEqual(observedKeys);
  });

  test('inventory total_pending_marker_occurrences_across_all_fixtures matches sum of per-fixture occurrence counts', () => {
    const observedSum = pendingOracleFixturesInventory.fixtures_with_markers_sorted.reduce((sum, entry) => sum + entry.total_pending_marker_occurrence_count, 0);
    expect(pendingOracleFixturesInventory.total_pending_marker_occurrences_across_all_fixtures).toBe(observedSum);
  });

  test('inventory implications and follow_up_steps are non-empty and point to oracle lane drainage steps', () => {
    expect(pendingOracleFixturesInventory.implications.length).toBeGreaterThan(0);
    expect(pendingOracleFixturesInventory.follow_up_steps.length).toBeGreaterThan(0);
    for (const followUpStepId of pendingOracleFixturesInventory.follow_up_steps) {
      expect(followUpStepId).toMatch(/^02-\d{3}$/);
    }
  });
});
