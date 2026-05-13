import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

import baseline from './capture-default-cfg-baseline.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-007-capture-default-cfg-baseline.md';
const KEY_PATTERN = /^[a-z][a-z0-9_]*[a-z0-9]$/;
const INTEGER_LINE_PATTERN = /^([a-z][a-z0-9_]*[a-z0-9])\s+(-?\d+)$/;
const QUOTED_STRING_LINE_PATTERN = /^([a-z][a-z0-9_]*[a-z0-9])\s+"(.*)"$/;

interface BaselineEntry {
  readonly key: string;
  readonly value: number | string;
  readonly type: string;
}

function loadSourceLines(): readonly string[] {
  return readFileSync(baseline.sourceRelativePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

describe('baseline identity and metadata', () => {
  test('declares OR-VP-DEFAULT-CFG-007 oracle id, step 02-007, and oracle lane', () => {
    expect(baseline.id).toBe('OR-VP-DEFAULT-CFG-007');
    expect(baseline.stepId).toBe('02-007');
    expect(baseline.stepTitle).toBe('Capture Default Cfg Baseline');
    expect(baseline.lane).toBe('oracle');
  });

  test('pins doom/default.cfg as the source file and it exists on disk', () => {
    expect(baseline.sourceRelativePath).toBe('doom/default.cfg');
    expect(existsSync(baseline.sourceRelativePath)).toBe(true);
    expect(statSync(baseline.sourceRelativePath).isFile()).toBe(true);
  });

  test('declared line count matches the non-empty line count of the source file', () => {
    const sourceLines = loadSourceLines();
    expect(baseline.lineCount).toBe(sourceLines.length);
  });

  test('validTypes is non-empty, sorted, and contains unique values', () => {
    expect(baseline.validTypes.length).toBeGreaterThan(0);
    expect([...baseline.validTypes].sort()).toEqual([...baseline.validTypes]);
    expect(new Set(baseline.validTypes).size).toBe(baseline.validTypes.length);
  });
});

describe('entries shape and integrity', () => {
  test('entry count equals the declared line count', () => {
    expect(baseline.entries).toHaveLength(baseline.lineCount);
  });

  test('every entry has a non-empty key, a declared type, and a string-or-number value', () => {
    const validTypes = new Set(baseline.validTypes);
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      expect(entry.key).toMatch(KEY_PATTERN);
      expect(validTypes.has(entry.type)).toBe(true);
      const valueIsNumber = typeof entry.value === 'number';
      const valueIsString = typeof entry.value === 'string';
      expect(valueIsNumber || valueIsString).toBe(true);
    }
  });

  test('quoted-string entries hold string values; numeric types hold number values', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'quoted-string') {
        expect(typeof entry.value).toBe('string');
      } else {
        expect(typeof entry.value).toBe('number');
      }
    }
  });

  test('keys are unique across entries', () => {
    const keys = (baseline.entries as readonly BaselineEntry[]).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('boolean-int values are limited to 0 or 1', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'boolean-int') {
        expect(entry.value === 0 || entry.value === 1).toBe(true);
      }
    }
  });

  test('dos-scancode values fall inside the 1-127 vanilla DOS make-code range', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'dos-scancode') {
        expect(typeof entry.value).toBe('number');
        const scanCode = entry.value as number;
        expect(scanCode).toBeGreaterThanOrEqual(1);
        expect(scanCode).toBeLessThanOrEqual(127);
      }
    }
  });
});

describe('on-disk parity with the source default.cfg', () => {
  test('every source line parses cleanly and produces a key whose declared entry matches the parsed value', () => {
    const sourceLines = loadSourceLines();
    const baselineByKey = new Map<string, BaselineEntry>();
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      baselineByKey.set(entry.key, entry);
    }
    for (const sourceLine of sourceLines) {
      const quotedMatch = QUOTED_STRING_LINE_PATTERN.exec(sourceLine);
      const integerMatch = INTEGER_LINE_PATTERN.exec(sourceLine);
      if (quotedMatch !== null) {
        const declaredEntry = baselineByKey.get(quotedMatch[1]!);
        expect(declaredEntry).toBeDefined();
        expect(declaredEntry!.type).toBe('quoted-string');
        expect(declaredEntry!.value).toBe(quotedMatch[2]!);
      } else if (integerMatch !== null) {
        const declaredEntry = baselineByKey.get(integerMatch[1]!);
        expect(declaredEntry).toBeDefined();
        expect(typeof declaredEntry!.value).toBe('number');
        expect(declaredEntry!.value).toBe(Number.parseInt(integerMatch[2]!, 10));
      } else {
        throw new Error(`Unparseable default.cfg line: ${sourceLine}`);
      }
    }
  });

  test('every declared entry appears in the source file with a matching value', () => {
    const sourceLines = loadSourceLines();
    const sourceByKey = new Map<string, string>();
    for (const sourceLine of sourceLines) {
      const integerMatch = INTEGER_LINE_PATTERN.exec(sourceLine);
      const quotedMatch = QUOTED_STRING_LINE_PATTERN.exec(sourceLine);
      if (quotedMatch !== null) {
        sourceByKey.set(quotedMatch[1]!, quotedMatch[2]!);
      } else if (integerMatch !== null) {
        sourceByKey.set(integerMatch[1]!, integerMatch[2]!);
      }
    }
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      const sourceValue = sourceByKey.get(entry.key);
      expect(sourceValue).toBeDefined();
      if (typeof entry.value === 'string') {
        expect(entry.type).toBe('quoted-string');
        expect(sourceValue).toBe(entry.value);
      } else {
        expect(typeof entry.value).toBe('number');
        expect(Number.parseInt(sourceValue!, 10)).toBe(entry.value);
      }
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-007', () => {
  test('step file write lock pins the baseline json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-default-cfg-baseline.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-default-cfg-baseline.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists doom/default.cfg as a research source', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/default.cfg');
  });
});

describe('failure-mode validation invariants', () => {
  test('key pattern rejects malformed keys', () => {
    expect('Bad_Key').not.toMatch(KEY_PATTERN);
    expect('_leading').not.toMatch(KEY_PATTERN);
    expect('trailing_').not.toMatch(KEY_PATTERN);
    expect('1leading').not.toMatch(KEY_PATTERN);
    expect('').not.toMatch(KEY_PATTERN);
  });

  test('integer line pattern rejects malformed lines', () => {
    expect(INTEGER_LINE_PATTERN.exec('no_value')).toBeNull();
    expect(INTEGER_LINE_PATTERN.exec('=42')).toBeNull();
    expect(INTEGER_LINE_PATTERN.exec('key 4.2')).toBeNull();
  });

  test('quoted-string line pattern rejects unquoted values', () => {
    expect(QUOTED_STRING_LINE_PATTERN.exec('chatmacro0 No')).toBeNull();
    expect(QUOTED_STRING_LINE_PATTERN.exec('chatmacro0 "')).toBeNull();
  });
});
