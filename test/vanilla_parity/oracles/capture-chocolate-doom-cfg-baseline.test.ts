import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

import baseline from './capture-chocolate-doom-cfg-baseline.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-008-capture-chocolate-doom-cfg-baseline.md';
const KEY_PATTERN = /^[a-z][a-z0-9_]*[a-z0-9]$/;
const HEX_INTEGER_PATTERN = /^0x[0-9a-fA-F]+$/;
const FLOAT_PATTERN = /^-?\d+\.\d+$/;
const SIGNED_INTEGER_PATTERN = /^-\d+$/;
const UNSIGNED_INTEGER_PATTERN = /^\d+$/;
const QUOTED_STRING_PATTERN = /^".*"$/;

interface BaselineEntry {
  readonly key: string;
  readonly value: number | string;
  readonly type: string;
  readonly raw: string;
}

function loadSourceLines(): readonly string[] {
  return readFileSync(baseline.sourceRelativePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

describe('baseline identity and metadata', () => {
  test('declares OR-VP-CHOCOLATE-CFG-008 oracle id, step 02-008, and oracle lane', () => {
    expect(baseline.id).toBe('OR-VP-CHOCOLATE-CFG-008');
    expect(baseline.stepId).toBe('02-008');
    expect(baseline.stepTitle).toBe('Capture Chocolate Doom Cfg Baseline');
    expect(baseline.lane).toBe('oracle');
  });

  test('pins doom/chocolate-doom.cfg as the source file and it exists on disk', () => {
    expect(baseline.sourceRelativePath).toBe('doom/chocolate-doom.cfg');
    expect(existsSync(baseline.sourceRelativePath)).toBe(true);
    expect(statSync(baseline.sourceRelativePath).isFile()).toBe(true);
  });

  test('declared line count matches the non-empty line count of the source file', () => {
    const sourceLines = loadSourceLines();
    expect(baseline.lineCount).toBe(sourceLines.length);
  });

  test('validTypes is non-empty, sorted, unique, and covers every observed type', () => {
    expect(baseline.validTypes.length).toBeGreaterThan(0);
    expect([...baseline.validTypes].sort()).toEqual([...baseline.validTypes]);
    expect(new Set(baseline.validTypes).size).toBe(baseline.validTypes.length);
    const validTypes = new Set(baseline.validTypes);
    const observedTypes = new Set((baseline.entries as readonly BaselineEntry[]).map((entry) => entry.type));
    for (const observedType of observedTypes) {
      expect(validTypes.has(observedType)).toBe(true);
    }
  });
});

describe('entries shape and integrity', () => {
  test('entry count equals the declared line count', () => {
    expect(baseline.entries).toHaveLength(baseline.lineCount);
  });

  test('every entry has a valid key, type, and value', () => {
    const validTypes = new Set(baseline.validTypes);
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      expect(entry.key).toMatch(KEY_PATTERN);
      expect(validTypes.has(entry.type)).toBe(true);
      expect(typeof entry.raw).toBe('string');
      expect(entry.raw.length).toBeGreaterThan(0);
      const valueIsNumber = typeof entry.value === 'number';
      const valueIsString = typeof entry.value === 'string';
      expect(valueIsNumber || valueIsString).toBe(true);
    }
  });

  test('keys are unique across entries', () => {
    const keys = (baseline.entries as readonly BaselineEntry[]).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('value type matches the type discriminator', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'quoted-string') {
        expect(typeof entry.value).toBe('string');
      } else {
        expect(typeof entry.value).toBe('number');
      }
    }
  });

  test('hex-integer raw values match the 0x... pattern', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'hex-integer') {
        expect(entry.raw).toMatch(HEX_INTEGER_PATTERN);
      }
    }
  });

  test('float raw values match a signed decimal pattern', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'float') {
        expect(entry.raw).toMatch(FLOAT_PATTERN);
      }
    }
  });

  test('signed-integer raw values match a leading-minus pattern', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'signed-integer') {
        expect(entry.raw).toMatch(SIGNED_INTEGER_PATTERN);
      }
    }
  });

  test('integer raw values match an unsigned decimal pattern', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'integer') {
        expect(entry.raw).toMatch(UNSIGNED_INTEGER_PATTERN);
      }
    }
  });

  test('quoted-string raw values match the surrounding-quote pattern', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'quoted-string') {
        expect(entry.raw).toMatch(QUOTED_STRING_PATTERN);
      }
    }
  });
});

describe('on-disk parity with the source chocolate-doom.cfg', () => {
  test('every source line is captured in the baseline with a matching raw value', () => {
    const sourceLines = loadSourceLines();
    const baselineByKey = new Map<string, BaselineEntry>();
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      baselineByKey.set(entry.key, entry);
    }
    for (const sourceLine of sourceLines) {
      const match = sourceLine.match(/^([a-z][a-z0-9_]*[a-z0-9])\s+(.+)$/);
      expect(match).not.toBeNull();
      if (match === null) {
        continue;
      }
      const declaredEntry = baselineByKey.get(match[1]!);
      expect(declaredEntry).toBeDefined();
      expect(declaredEntry!.raw).toBe(match[2]!);
    }
  });

  test('every declared entry decodes its raw value consistently with its type', () => {
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      if (entry.type === 'hex-integer') {
        expect(typeof entry.value).toBe('number');
        expect(entry.value).toBe(Number.parseInt(entry.raw.slice(2), 16));
      } else if (entry.type === 'float') {
        expect(typeof entry.value).toBe('number');
        expect(entry.value).toBeCloseTo(Number.parseFloat(entry.raw), 6);
      } else if (entry.type === 'signed-integer' || entry.type === 'integer') {
        expect(typeof entry.value).toBe('number');
        expect(entry.value).toBe(Number.parseInt(entry.raw, 10));
      } else if (entry.type === 'quoted-string') {
        expect(typeof entry.value).toBe('string');
        expect(entry.raw.length).toBeGreaterThanOrEqual(2);
        expect(entry.raw.startsWith('"')).toBe(true);
        expect(entry.raw.endsWith('"')).toBe(true);
        expect(entry.value).toBe(entry.raw.slice(1, -1));
      }
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-008', () => {
  test('step file write lock pins the baseline json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-chocolate-doom-cfg-baseline.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-chocolate-doom-cfg-baseline.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists doom/chocolate-doom.cfg as a research source', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/chocolate-doom.cfg');
  });
});

describe('vanilla compatibility flags are present and on', () => {
  test('vanilla_demo_limit, vanilla_keyboard_mapping, vanilla_savegame_limit are all 1', () => {
    const baselineByKey = new Map<string, BaselineEntry>();
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      baselineByKey.set(entry.key, entry);
    }
    expect(baselineByKey.get('vanilla_demo_limit')?.value).toBe(1);
    expect(baselineByKey.get('vanilla_keyboard_mapping')?.value).toBe(1);
    expect(baselineByKey.get('vanilla_savegame_limit')?.value).toBe(1);
  });

  test('opl_io_port is the canonical AdLib base address 0x388', () => {
    const baselineByKey = new Map<string, BaselineEntry>();
    for (const entry of baseline.entries as readonly BaselineEntry[]) {
      baselineByKey.set(entry.key, entry);
    }
    const oplEntry = baselineByKey.get('opl_io_port');
    expect(oplEntry).toBeDefined();
    expect(oplEntry!.type).toBe('hex-integer');
    expect(oplEntry!.value).toBe(0x388);
    expect(oplEntry!.raw).toBe('0x388');
  });
});

describe('failure-mode validation invariants', () => {
  test('key pattern rejects malformed keys', () => {
    expect('Bad_Key').not.toMatch(KEY_PATTERN);
    expect('1leading').not.toMatch(KEY_PATTERN);
    expect('trailing_').not.toMatch(KEY_PATTERN);
  });

  test('hex pattern rejects malformed hex literals', () => {
    expect('388').not.toMatch(HEX_INTEGER_PATTERN);
    expect('0X388').not.toMatch(HEX_INTEGER_PATTERN);
    expect('0xZZZ').not.toMatch(HEX_INTEGER_PATTERN);
  });

  test('float pattern rejects integers and malformed floats', () => {
    expect('42').not.toMatch(FLOAT_PATTERN);
    expect('.5').not.toMatch(FLOAT_PATTERN);
    expect('1.').not.toMatch(FLOAT_PATTERN);
  });
});
