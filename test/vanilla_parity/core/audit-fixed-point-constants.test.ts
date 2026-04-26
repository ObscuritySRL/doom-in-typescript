import { describe, expect, test } from 'bun:test';

import { FIXED_MAX, FIXED_MIN, FRACBITS, FRACUNIT } from '../../../src/core/fixed.ts';
import { FIXED_POINT_CONSTANT_AUDIT, FIXED_POINT_DERIVED_INVARIANTS, crossCheckFixedPointConstants } from '../../../src/core/audit-fixed-point-constants.ts';
import type { FixedPointConstantSnapshot } from '../../../src/core/audit-fixed-point-constants.ts';

const RUNTIME_SNAPSHOT: FixedPointConstantSnapshot = { FRACBITS, FRACUNIT, FIXED_MAX, FIXED_MIN };

const ALLOWED_REFERENCE_SOURCE_FILES = new Set(['src/m_fixed.h', 'src/doomtype.h', 'derived']);

describe('audit-fixed-point-constants ledger shape', () => {
  test('audits exactly four constants — the full surface of src/core/fixed.ts', () => {
    expect(FIXED_POINT_CONSTANT_AUDIT.length).toBe(4);
  });

  test('every audited name is unique', () => {
    const names = FIXED_POINT_CONSTANT_AUDIT.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('audits every runtime export from src/core/fixed.ts exactly once', () => {
    const audited = new Set(FIXED_POINT_CONSTANT_AUDIT.map((entry) => entry.name));
    expect(audited).toEqual(new Set(['FRACBITS', 'FRACUNIT', 'FIXED_MAX', 'FIXED_MIN']));
  });

  test('every entry pins underlyingBitWidth to int32', () => {
    for (const entry of FIXED_POINT_CONSTANT_AUDIT) {
      expect(entry.underlyingBitWidth).toBe(32);
    }
  });

  test('every entry references an allowed Chocolate Doom 2.2.1 source file', () => {
    for (const entry of FIXED_POINT_CONSTANT_AUDIT) {
      expect(ALLOWED_REFERENCE_SOURCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every entry carries a non-empty C declaration', () => {
    for (const entry of FIXED_POINT_CONSTANT_AUDIT) {
      expect(entry.cDeclaration.length).toBeGreaterThan(0);
    }
  });

  test('every entry carries a non-empty invariant note', () => {
    for (const entry of FIXED_POINT_CONSTANT_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-fixed-point-constants ledger values', () => {
  test('FRACBITS audit value matches runtime export', () => {
    const entry = FIXED_POINT_CONSTANT_AUDIT.find((candidate) => candidate.name === 'FRACBITS');
    expect(entry).toBeDefined();
    expect(entry?.value).toBe(FRACBITS);
    expect(entry?.value).toBe(16);
    expect(entry?.hex).toBe('0x10');
    expect(entry?.cDeclaration).toBe('#define FRACBITS 16');
    expect(entry?.referenceSourceFile).toBe('src/m_fixed.h');
  });

  test('FRACUNIT audit value matches runtime export', () => {
    const entry = FIXED_POINT_CONSTANT_AUDIT.find((candidate) => candidate.name === 'FRACUNIT');
    expect(entry).toBeDefined();
    expect(entry?.value).toBe(FRACUNIT);
    expect(entry?.value).toBe(65_536);
    expect(entry?.hex).toBe('0x10000');
    expect(entry?.cDeclaration).toBe('#define FRACUNIT (1<<FRACBITS)');
    expect(entry?.referenceSourceFile).toBe('src/m_fixed.h');
  });

  test('FIXED_MAX audit value matches runtime export', () => {
    const entry = FIXED_POINT_CONSTANT_AUDIT.find((candidate) => candidate.name === 'FIXED_MAX');
    expect(entry).toBeDefined();
    expect(entry?.value).toBe(FIXED_MAX);
    expect(entry?.value).toBe(0x7fff_ffff);
    expect(entry?.hex).toBe('0x7FFFFFFF');
    expect(entry?.referenceSourceFile).toBe('derived');
  });

  test('FIXED_MIN audit value matches runtime export', () => {
    const entry = FIXED_POINT_CONSTANT_AUDIT.find((candidate) => candidate.name === 'FIXED_MIN');
    expect(entry).toBeDefined();
    expect(entry?.value).toBe(FIXED_MIN);
    expect(entry?.value).toBe(-0x8000_0000);
    expect(entry?.hex).toBe('-0x80000000');
    expect(entry?.referenceSourceFile).toBe('derived');
  });
});

describe('audit-fixed-point-constants hex strings parse to numeric values', () => {
  test('hex strings round-trip to numeric values via parseInt', () => {
    for (const entry of FIXED_POINT_CONSTANT_AUDIT) {
      const isNegative = entry.hex.startsWith('-');
      const magnitude = isNegative ? entry.hex.slice(1) : entry.hex;
      expect(magnitude.startsWith('0x')).toBe(true);
      const parsed = Number.parseInt(magnitude.slice(2), 16);
      expect(Number.isFinite(parsed)).toBe(true);
      expect(isNegative ? -parsed : parsed).toBe(entry.value);
    }
  });
});

describe('audit-fixed-point-constants derived invariants ledger', () => {
  test('lists every derived invariant with a unique stable id', () => {
    const ids = FIXED_POINT_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the eleven derived invariants the cross-check enforces', () => {
    const ids = new Set(FIXED_POINT_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'FRACUNIT_EQUALS_ONE_SHIFTED_BY_FRACBITS',
        'FRACUNIT_IS_POWER_OF_TWO',
        'FIXED_MAX_IS_INT32_MAX',
        'FIXED_MIN_IS_INT32_MIN',
        'FIXED_RANGE_SPANS_2_TO_32',
        'FIXED_MAX_INTEGER_PART_IS_INT16_MAX',
        'FIXED_MIN_INTEGER_PART_IS_INT16_MIN',
        'FIXED_MAX_FRACTIONAL_PART_IS_SATURATED',
        'FIXED_MIN_FRACTIONAL_PART_IS_ZERO',
        'INT32_WRAP_AROUND_FROM_MAX_TO_MIN',
        'INT32_WRAP_AROUND_FROM_MIN_TO_MAX',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of FIXED_POINT_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('crossCheckFixedPointConstants on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckFixedPointConstants(RUNTIME_SNAPSHOT)).toEqual([]);
  });

  test('FRACUNIT === 1 << FRACBITS holds at runtime', () => {
    expect(FRACUNIT).toBe(1 << FRACBITS);
  });

  test('FIXED_MAX integer half is INT16_MAX', () => {
    expect(FIXED_MAX >> FRACBITS).toBe(32_767);
  });

  test('FIXED_MIN integer half is INT16_MIN', () => {
    expect(FIXED_MIN >> FRACBITS).toBe(-32_768);
  });

  test('FIXED_MAX fractional bits are fully saturated', () => {
    expect(FIXED_MAX & (FRACUNIT - 1)).toBe(0xffff);
  });

  test('FIXED_MIN fractional bits are zero', () => {
    expect(FIXED_MIN & (FRACUNIT - 1)).toBe(0);
  });

  test('int32 wrap from MAX+1 to MIN', () => {
    expect((FIXED_MAX + 1) | 0).toBe(FIXED_MIN);
  });

  test('int32 wrap from MIN-1 to MAX', () => {
    expect((FIXED_MIN - 1) | 0).toBe(FIXED_MAX);
  });

  test('range spans exactly 2^32 values', () => {
    expect(FIXED_MAX - FIXED_MIN + 1).toBe(2 ** 32);
  });
});

describe('crossCheckFixedPointConstants failure modes', () => {
  test('detects a tampered FRACBITS that breaks the 16.16 split', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FRACBITS: 8 };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FRACBITS:value-mismatch');
    expect(failures).toContain('derived:FRACUNIT_EQUALS_ONE_SHIFTED_BY_FRACBITS');
    expect(failures).toContain('derived:FIXED_MAX_INTEGER_PART_IS_INT16_MAX');
    expect(failures).toContain('derived:FIXED_MIN_INTEGER_PART_IS_INT16_MIN');
  });

  test('detects a tampered FRACUNIT that no longer equals 1 << FRACBITS', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FRACUNIT: 32_768 };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FRACUNIT:value-mismatch');
    expect(failures).toContain('derived:FRACUNIT_EQUALS_ONE_SHIFTED_BY_FRACBITS');
  });

  test('detects a non-power-of-two FRACUNIT', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FRACBITS: 16, FRACUNIT: 65_535 };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FRACUNIT:value-mismatch');
    expect(failures).toContain('derived:FRACUNIT_IS_POWER_OF_TWO');
    expect(failures).toContain('derived:FRACUNIT_EQUALS_ONE_SHIFTED_BY_FRACBITS');
  });

  test('detects a clamped FIXED_MAX that no longer matches INT32_MAX', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FIXED_MAX: 0x3fff_ffff };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FIXED_MAX:value-mismatch');
    expect(failures).toContain('derived:FIXED_MAX_IS_INT32_MAX');
    expect(failures).toContain('derived:FIXED_RANGE_SPANS_2_TO_32');
    expect(failures).toContain('derived:FIXED_MAX_INTEGER_PART_IS_INT16_MAX');
  });

  test('detects a tampered FIXED_MIN that no longer matches INT32_MIN', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FIXED_MIN: -0x4000_0000 };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FIXED_MIN:value-mismatch');
    expect(failures).toContain('derived:FIXED_MIN_IS_INT32_MIN');
    expect(failures).toContain('derived:FIXED_RANGE_SPANS_2_TO_32');
    expect(failures).toContain('derived:FIXED_MIN_INTEGER_PART_IS_INT16_MIN');
  });

  test('detects a fractional-saturation regression on FIXED_MAX', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FIXED_MAX: 0x7fff_0000 };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FIXED_MAX:value-mismatch');
    expect(failures).toContain('derived:FIXED_MAX_FRACTIONAL_PART_IS_SATURATED');
  });

  test('detects an integer-aligned regression on FIXED_MIN', () => {
    const tampered = { ...RUNTIME_SNAPSHOT, FIXED_MIN: -0x8000_0000 + 1 };
    const failures = crossCheckFixedPointConstants(tampered);
    expect(failures).toContain('audit:FIXED_MIN:value-mismatch');
  });

  test('reports an empty failure list for an exact runtime-equivalent snapshot', () => {
    const cloned: FixedPointConstantSnapshot = {
      FRACBITS: 16,
      FRACUNIT: 65_536,
      FIXED_MAX: 0x7fff_ffff,
      FIXED_MIN: -0x8000_0000,
    };
    expect(crossCheckFixedPointConstants(cloned)).toEqual([]);
  });
});

describe('audit-fixed-point-constants step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-001-audit-fixed-point-constants.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-fixed-point-constants.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-fixed-point-constants.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-001-audit-fixed-point-constants.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });
});
