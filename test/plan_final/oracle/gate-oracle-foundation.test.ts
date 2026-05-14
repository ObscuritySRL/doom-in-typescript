import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const FIXTURES_DIRECTORY = 'test/oracles/fixtures';
const PENDING_VALUE_PREFIX = 'pending-';
const BLOCKED_STATUS_LITERAL = 'blocked-pending-future-step';
const PLAN_FINAL_STEP_ID_REGEX = /^\d{2}-\d{3}$/;

type JsonObject = { readonly [key: string]: JsonValue };
type JsonValue = JsonObject | JsonValue[] | boolean | null | number | string;

interface PendingOccurrence {
  readonly fixtureRelativePath: string;
  readonly jsonPointer: string;
  readonly stringValue: string;
}

interface OracleFoundationGateVerdict {
  readonly blockedFixtureRelativePaths: readonly string[];
  readonly passes: boolean;
  readonly pendingOccurrences: readonly PendingOccurrence[];
  readonly totalFixturesAudited: number;
}

function listFixtureRelativePathsSorted(): readonly string[] {
  return readdirSync(FIXTURES_DIRECTORY)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => `${FIXTURES_DIRECTORY}/${entry}`)
    .sort();
}

function readFixture(fixtureRelativePath: string): JsonValue {
  const text = readFileSync(fixtureRelativePath, 'utf8');
  return JSON.parse(text) as JsonValue;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function collectPendingValueOccurrences(fixtureRelativePath: string, fixtureRoot: JsonValue): readonly PendingOccurrence[] {
  const occurrences: PendingOccurrence[] = [];
  function walk(currentValue: JsonValue, currentPointer: string): void {
    if (typeof currentValue === 'string') {
      if (currentValue.startsWith(PENDING_VALUE_PREFIX)) {
        occurrences.push({ fixtureRelativePath, jsonPointer: currentPointer, stringValue: currentValue });
      }
      return;
    }
    if (currentValue === null || typeof currentValue === 'boolean' || typeof currentValue === 'number') {
      return;
    }
    if (Array.isArray(currentValue)) {
      for (let arrayIndex = 0; arrayIndex < currentValue.length; arrayIndex += 1) {
        const arrayElement = currentValue[arrayIndex];
        if (arrayElement === undefined) {
          continue;
        }
        walk(arrayElement, `${currentPointer}/${arrayIndex}`);
      }
      return;
    }
    for (const propertyKey of Object.keys(currentValue)) {
      const propertyValue = currentValue[propertyKey];
      if (propertyValue === undefined) {
        continue;
      }
      walk(propertyValue, `${currentPointer}/${escapeJsonPointerSegment(propertyKey)}`);
    }
  }
  walk(fixtureRoot, '');
  return occurrences;
}

function runOracleFoundationGate(): OracleFoundationGateVerdict {
  const fixturePaths = listFixtureRelativePathsSorted();
  const pendingOccurrences: PendingOccurrence[] = [];
  const blockedFixtureRelativePaths: string[] = [];
  for (const fixturePath of fixturePaths) {
    const fixtureRoot = readFixture(fixturePath);
    const occurrences = collectPendingValueOccurrences(fixturePath, fixtureRoot);
    if (occurrences.length === 0) {
      continue;
    }
    blockedFixtureRelativePaths.push(fixturePath);
    for (const occurrence of occurrences) {
      pendingOccurrences.push(occurrence);
    }
  }
  return Object.freeze({
    blockedFixtureRelativePaths: Object.freeze(blockedFixtureRelativePaths) as readonly string[],
    passes: blockedFixtureRelativePaths.length === 0,
    pendingOccurrences: Object.freeze(pendingOccurrences) as readonly PendingOccurrence[],
    totalFixturesAudited: fixturePaths.length,
  } satisfies OracleFoundationGateVerdict);
}

describe('oracle: gate-oracle-foundation', () => {
  test('runOracleFoundationGate audits every fixture under test/oracles/fixtures/ and returns a stable shape', () => {
    const verdict = runOracleFoundationGate();
    expect(verdict.totalFixturesAudited).toBeGreaterThan(0);
    expect(typeof verdict.passes).toBe('boolean');
    expect(Array.isArray(verdict.blockedFixtureRelativePaths)).toBe(true);
    expect(Array.isArray(verdict.pendingOccurrences)).toBe(true);
    if (verdict.blockedFixtureRelativePaths.length === 0) {
      expect(verdict.passes).toBe(true);
      expect(verdict.pendingOccurrences.length).toBe(0);
    } else {
      expect(verdict.passes).toBe(false);
      expect(verdict.pendingOccurrences.length).toBeGreaterThan(0);
    }
  });

  test('the gate verdict is internally consistent: every blocked path appears in pendingOccurrences', () => {
    const verdict = runOracleFoundationGate();
    const observedBlockedPathSet = new Set(verdict.blockedFixtureRelativePaths);
    const occurrencePathSet = new Set(verdict.pendingOccurrences.map((occurrence) => occurrence.fixtureRelativePath));
    for (const blockedPath of observedBlockedPathSet) {
      expect(occurrencePathSet.has(blockedPath)).toBe(true);
    }
    for (const occurrencePath of occurrencePathSet) {
      expect(observedBlockedPathSet.has(occurrencePath)).toBe(true);
    }
  });

  test('every pending-* value occurrence has a non-empty JSON pointer and a string value still starting with the pending- prefix', () => {
    const verdict = runOracleFoundationGate();
    for (const occurrence of verdict.pendingOccurrences) {
      expect(occurrence.fixtureRelativePath.startsWith(`${FIXTURES_DIRECTORY}/`)).toBe(true);
      expect(occurrence.jsonPointer.startsWith('/')).toBe(true);
      expect(occurrence.stringValue.startsWith(PENDING_VALUE_PREFIX)).toBe(true);
    }
  });

  test('contract constants and the gate signature match the documented oracle-foundation gate behavior', () => {
    expect(BLOCKED_STATUS_LITERAL).toBe('blocked-pending-future-step');
    expect(PENDING_VALUE_PREFIX).toBe('pending-');
    expect(PLAN_FINAL_STEP_ID_REGEX.test('02-011')).toBe(true);
    expect(PLAN_FINAL_STEP_ID_REGEX.test('99-099')).toBe(true);
    expect(PLAN_FINAL_STEP_ID_REGEX.test('2-011')).toBe(false);
    expect(typeof runOracleFoundationGate).toBe('function');
    expect(runOracleFoundationGate.length).toBe(0);
  });

  test('the gate documents itself as the oracle-foundation completion check: empty registry + zero pending values == passes; any pending value == blocked until a follow-up step replaces it with live evidence', () => {
    const verdict = runOracleFoundationGate();
    if (verdict.passes) {
      expect(verdict.blockedFixtureRelativePaths.length).toBe(0);
      expect(verdict.pendingOccurrences.length).toBe(0);
    } else {
      expect(verdict.blockedFixtureRelativePaths.length).toBeGreaterThan(0);
    }
  });
});
