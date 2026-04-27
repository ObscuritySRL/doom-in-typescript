import { describe, expect, test } from 'bun:test';

import { FIXED_MAX, FIXED_MIN, FRACBITS, FRACUNIT, fixedMul } from '../../../src/core/fixed.ts';
import {
  AUDITED_FIXED_MAX,
  AUDITED_FIXED_MIN,
  AUDITED_FRACBITS,
  AUDITED_FRACUNIT,
  FIXED_MUL_OVERFLOW_AUDIT,
  FIXED_MUL_OVERFLOW_INVARIANTS,
  FIXED_MUL_OVERFLOW_PROBES,
  crossCheckFixedMulOverflowSemantics,
  fixedMulReference,
} from '../../../src/core/audit-fixed-multiply-overflow-semantics.ts';
import type { FixedMulFunction, FixedMulOverflowFactId, FixedMulOverflowInvariantId, FixedMulProbeId } from '../../../src/core/audit-fixed-multiply-overflow-semantics.ts';

const ALL_FACT_IDS: Set<FixedMulOverflowFactId> = new Set([
  'C_HEADER_DECLARATION',
  'C_BODY_INT64_PROMOTION',
  'C_BODY_ARITHMETIC_RIGHT_SHIFT',
  'C_RETURN_TRUNCATION_TO_INT32',
  'OVERFLOW_WRAPS_MODULO_2_TO_32',
  'OVERFLOW_RIGHT_SHIFT_ROUNDS_TOWARD_NEG_INF',
  'OVERFLOW_IDENTITY_BY_FRACUNIT',
  'OVERFLOW_ZERO_ABSORBS',
  'OVERFLOW_COMMUTES',
  'JS_DECOMPOSITION_BOUNDED_BY_2_TO_53',
]);

const ALL_INVARIANT_IDS: Set<FixedMulOverflowInvariantId> = new Set([
  'IDENTITY_BY_FRACUNIT_LEFT',
  'IDENTITY_BY_FRACUNIT_RIGHT',
  'ZERO_LEFT_ABSORBS',
  'ZERO_RIGHT_ABSORBS',
  'COMMUTATIVE',
  'INT32_RANGE_RESULT',
  'AGREES_WITH_BIGINT_REFERENCE',
]);

const ALL_PROBE_IDS: Set<FixedMulProbeId> = new Set([
  'identity_FRACUNIT_x_FRACUNIT',
  'identity_FRACUNIT_x_zero',
  'identity_zero_x_FRACUNIT',
  'identity_FRACUNIT_x_seven',
  'identity_seven_x_FRACUNIT',
  'integer_three_x_two',
  'integer_three_x_neg_two',
  'integer_neg_three_x_neg_two',
  'fractional_half_x_half',
  'fractional_one_point_five_squared',
  'fractional_neg_one_point_five_x_one_point_five',
  'wrap_FIXED_MAX_squared',
  'wrap_FIXED_MIN_squared',
  'wrap_FIXED_MIN_x_FRACUNIT',
  'wrap_FIXED_MAX_x_FRACUNIT',
  'wrap_FIXED_MAX_x_two',
  'wrap_FIXED_MIN_x_two',
  'rounding_neg_three_x_one',
  'rounding_three_x_one',
  'rounding_neg_one_x_one',
  'rounding_neg_one_x_neg_one',
  'sub_unit_one_plus_epsilon_squared',
  'extreme_FIXED_MAX_x_FIXED_MIN',
  'extreme_one_x_FIXED_MAX',
  'extreme_one_x_FIXED_MIN',
]);

describe('audit-fixed-multiply-overflow-semantics audited canonical constants', () => {
  test('AUDITED_FRACBITS is exactly 16, independent of src/core/fixed.ts', () => {
    expect(AUDITED_FRACBITS).toBe(16);
  });

  test('AUDITED_FRACUNIT is exactly 65536, independent of src/core/fixed.ts', () => {
    expect(AUDITED_FRACUNIT).toBe(65_536);
  });

  test('AUDITED_FIXED_MAX is exactly INT32_MAX (0x7FFFFFFF), independent of src/core/fixed.ts', () => {
    expect(AUDITED_FIXED_MAX).toBe(0x7fff_ffff);
  });

  test('AUDITED_FIXED_MIN is exactly INT32_MIN (-0x80000000), independent of src/core/fixed.ts', () => {
    expect(AUDITED_FIXED_MIN).toBe(-0x8000_0000);
  });

  test('audited canonical constants agree with the runtime exports from src/core/fixed.ts', () => {
    expect(AUDITED_FRACBITS).toBe(FRACBITS);
    expect(AUDITED_FRACUNIT).toBe(FRACUNIT);
    expect(AUDITED_FIXED_MAX).toBe(FIXED_MAX);
    expect(AUDITED_FIXED_MIN).toBe(FIXED_MIN);
  });
});

describe('audit-fixed-multiply-overflow-semantics fact ledger shape', () => {
  test('audits exactly ten facts — three c-source, six overflow-rule, one js-implementation', () => {
    expect(FIXED_MUL_OVERFLOW_AUDIT.length).toBe(10);
    const cSource = FIXED_MUL_OVERFLOW_AUDIT.filter((fact) => fact.category === 'c-source');
    const overflowRule = FIXED_MUL_OVERFLOW_AUDIT.filter((fact) => fact.category === 'overflow-rule');
    const jsImplementation = FIXED_MUL_OVERFLOW_AUDIT.filter((fact) => fact.category === 'js-implementation');
    expect(cSource.length).toBe(4);
    expect(overflowRule.length).toBe(5);
    expect(jsImplementation.length).toBe(1);
  });

  test('every fact id is unique', () => {
    const ids = FIXED_MUL_OVERFLOW_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(FIXED_MUL_OVERFLOW_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of FIXED_MUL_OVERFLOW_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every c-source fact references an upstream Chocolate Doom 2.2.1 file', () => {
    const allowed = new Set(['src/m_fixed.h', 'src/m_fixed.c']);
    for (const fact of FIXED_MUL_OVERFLOW_AUDIT) {
      if (fact.category === 'c-source') {
        expect(allowed.has(fact.referenceSourceFile)).toBe(true);
      }
    }
  });

  test('the only js-implementation fact references src/core/fixed.ts', () => {
    const jsImplementation = FIXED_MUL_OVERFLOW_AUDIT.filter((fact) => fact.category === 'js-implementation');
    expect(jsImplementation.length).toBe(1);
    expect(jsImplementation[0]?.referenceSourceFile).toBe('src/core/fixed.ts');
  });

  test('every overflow-rule fact is marked as derived', () => {
    for (const fact of FIXED_MUL_OVERFLOW_AUDIT) {
      if (fact.category === 'overflow-rule') {
        expect(fact.referenceSourceFile).toBe('derived');
      }
    }
  });
});

describe('audit-fixed-multiply-overflow-semantics fact ledger values', () => {
  test('C_HEADER_DECLARATION pins the header signature exactly', () => {
    const fact = FIXED_MUL_OVERFLOW_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('fixed_t FixedMul(fixed_t a, fixed_t b);');
    expect(fact?.referenceSourceFile).toBe('src/m_fixed.h');
  });

  test('C_BODY_INT64_PROMOTION pins the canonical one-line body', () => {
    const fact = FIXED_MUL_OVERFLOW_AUDIT.find((candidate) => candidate.id === 'C_BODY_INT64_PROMOTION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('return ((int64_t) a * (int64_t) b) >> FRACBITS;');
    expect(fact?.referenceSourceFile).toBe('src/m_fixed.c');
  });
});

describe('audit-fixed-multiply-overflow-semantics invariant ledger shape', () => {
  test('lists exactly seven derived invariants', () => {
    expect(FIXED_MUL_OVERFLOW_INVARIANTS.length).toBe(7);
  });

  test('every invariant id is unique', () => {
    const ids = FIXED_MUL_OVERFLOW_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(FIXED_MUL_OVERFLOW_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of FIXED_MUL_OVERFLOW_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-fixed-multiply-overflow-semantics probe ledger shape', () => {
  test('declares exactly twenty-five probes', () => {
    expect(FIXED_MUL_OVERFLOW_PROBES.length).toBe(25);
  });

  test('every probe id is unique', () => {
    const ids = FIXED_MUL_OVERFLOW_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(FIXED_MUL_OVERFLOW_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe operand and expected value is an int32', () => {
    for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
      expect((probe.a | 0) === probe.a).toBe(true);
      expect((probe.b | 0) === probe.b).toBe(true);
      expect((probe.expected | 0) === probe.expected).toBe(true);
    }
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every probe category at least once', () => {
    const categories = new Set(FIXED_MUL_OVERFLOW_PROBES.map((probe) => probe.category));
    expect(categories).toEqual(new Set(['identity', 'zero', 'integer', 'fractional', 'wrap', 'rounding', 'sub-unit', 'extreme']));
  });
});

describe('audit-fixed-multiply-overflow-semantics BigInt reference', () => {
  test('agrees with every probe expected value', () => {
    for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
      expect(fixedMulReference(probe.a, probe.b)).toBe(probe.expected);
    }
  });

  test('models the canonical body bit-for-bit on a sweep of int32 inputs', () => {
    const sweep = [0, 1, -1, 7, -7, 65_536, -65_536, 32_768, -32_768, 65_537, -65_537, 0x7fff_ffff, -0x8000_0000, 0x0001_8000, -0x0001_8000, 0x7fff_0001, -0x7fff_0001];
    for (const a of sweep) {
      for (const b of sweep) {
        const reference = fixedMulReference(a, b);
        const independentReference = Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b)) >> 16n));
        expect(reference).toBe(independentReference);
      }
    }
  });

  test('coerces non-int32 inputs via | 0 to match implicit C narrowing on int32-typed callers', () => {
    expect(fixedMulReference(1.7, 65_536)).toBe(fixedMulReference(1, 65_536));
    expect(fixedMulReference(65_536, 1.7)).toBe(fixedMulReference(65_536, 1));
    expect(fixedMulReference(0x1_0000_0000, 65_536)).toBe(fixedMulReference(0, 65_536));
  });
});

describe('crossCheckFixedMulOverflowSemantics on the live runtime fixedMul', () => {
  test('reports zero failures', () => {
    expect(crossCheckFixedMulOverflowSemantics(fixedMul)).toEqual([]);
  });

  test('runtime fixedMul matches every probe expected value', () => {
    for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
      expect(fixedMul(probe.a, probe.b)).toBe(probe.expected);
    }
  });

  test('runtime fixedMul agrees with the BigInt reference for every probe', () => {
    for (const probe of FIXED_MUL_OVERFLOW_PROBES) {
      expect(fixedMul(probe.a, probe.b)).toBe(fixedMulReference(probe.a, probe.b));
    }
  });

  test('runtime fixedMul honours OVERFLOW_WRAPS_MODULO_2_TO_32 on the canonical wrap example', () => {
    expect(fixedMul(FIXED_MAX, FIXED_MAX)).toBe(-FRACUNIT);
    expect(fixedMul(FIXED_MIN, FIXED_MIN)).toBe(0);
  });

  test('runtime fixedMul honours OVERFLOW_RIGHT_SHIFT_ROUNDS_TOWARD_NEG_INF on every documented case', () => {
    expect(fixedMul(-3, 1)).toBe(-1);
    expect(fixedMul(-1, 1)).toBe(-1);
    expect(fixedMul(-1, -1)).toBe(0);
  });

  test('runtime fixedMul honours OVERFLOW_IDENTITY_BY_FRACUNIT on extremes', () => {
    expect(fixedMul(FIXED_MIN, FRACUNIT)).toBe(FIXED_MIN);
    expect(fixedMul(FIXED_MAX, FRACUNIT)).toBe(FIXED_MAX);
  });
});

describe('crossCheckFixedMulOverflowSemantics failure modes — tampered candidates', () => {
  test('detects a candidate that uses Math.imul (no int64 promotion, drops high bits of product)', () => {
    const tampered: FixedMulFunction = (a, b) => Math.imul(a, b) >> 16;
    const failures = crossCheckFixedMulOverflowSemantics(tampered);
    expect(failures).toContain('probe:identity_FRACUNIT_x_FRACUNIT');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that truncates toward zero instead of rounding toward negative infinity', () => {
    const tampered: FixedMulFunction = (a, b) => {
      const product = BigInt(a) * BigInt(b);
      // BigInt division truncates toward zero — different from arith right shift on negative results.
      const div = product / 65536n;
      return Number(BigInt.asIntN(32, div));
    };
    const failures = crossCheckFixedMulOverflowSemantics(tampered);
    expect(failures).toContain('probe:rounding_neg_three_x_one');
    expect(failures).toContain('probe:rounding_neg_one_x_one');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that saturates instead of wrapping on overflow', () => {
    const tampered: FixedMulFunction = (a, b) => {
      const product = BigInt(a) * BigInt(b);
      const shifted = product >> 16n;
      if (shifted > BigInt(AUDITED_FIXED_MAX)) return AUDITED_FIXED_MAX;
      if (shifted < BigInt(AUDITED_FIXED_MIN)) return AUDITED_FIXED_MIN;
      return Number(shifted);
    };
    const failures = crossCheckFixedMulOverflowSemantics(tampered);
    expect(failures).toContain('probe:wrap_FIXED_MAX_squared');
    expect(failures).toContain('probe:wrap_FIXED_MAX_x_two');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that returns a float beyond int32 (no narrowing | 0)', () => {
    const tampered: FixedMulFunction = (a, b) => {
      const product = BigInt(a) * BigInt(b);
      const shifted = product >> 16n;
      // Skip the asIntN truncation entirely — return the raw shifted value as a Number.
      return Number(shifted);
    };
    const failures = crossCheckFixedMulOverflowSemantics(tampered);
    expect(failures).toContain('probe:wrap_FIXED_MAX_squared');
    expect(failures).toContain('invariant:INT32_RANGE_RESULT');
  });

  test('detects a candidate whose result is non-commutative', () => {
    // A deliberately asymmetric tamper: only honour the canonical formula on the smaller operand on the right,
    // otherwise return zero. This breaks commutativity for many probe pairs.
    const tampered: FixedMulFunction = (a, b) => {
      if (a < b) return 0;
      const product = BigInt(a) * BigInt(b);
      return Number(BigInt.asIntN(32, product >> 16n));
    };
    const failures = crossCheckFixedMulOverflowSemantics(tampered);
    expect(failures).toContain('invariant:COMMUTATIVE');
  });

  test('reports an empty failure list for the BigInt reference itself', () => {
    expect(crossCheckFixedMulOverflowSemantics(fixedMulReference)).toEqual([]);
  });
});

describe('audit-fixed-multiply-overflow-semantics step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-002-audit-fixed-multiply-overflow-semantics.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-fixed-multiply-overflow-semantics.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-fixed-multiply-overflow-semantics.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-002-audit-fixed-multiply-overflow-semantics.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-002-audit-fixed-multiply-overflow-semantics.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
