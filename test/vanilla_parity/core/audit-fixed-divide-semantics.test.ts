import { describe, expect, test } from 'bun:test';

import { FIXED_MAX, FIXED_MIN, FRACBITS, FRACUNIT, fixedDiv } from '../../../src/core/fixed.ts';
import {
  AUDITED_FIXED_MAX,
  AUDITED_FIXED_MIN,
  AUDITED_FRACBITS,
  AUDITED_FRACUNIT,
  FIXED_DIV_AUDIT,
  FIXED_DIV_INVARIANTS,
  FIXED_DIV_PROBES,
  crossCheckFixedDivSemantics,
  fixedDivReference,
} from '../../../src/core/audit-fixed-divide-semantics.ts';
import type { FixedDivFactId, FixedDivFunction, FixedDivInvariantId, FixedDivProbeId } from '../../../src/core/audit-fixed-divide-semantics.ts';

const ALL_FACT_IDS: Set<FixedDivFactId> = new Set([
  'C_HEADER_DECLARATION',
  'C_BODY_OVERFLOW_GUARD',
  'C_BODY_OVERFLOW_RETURN',
  'C_BODY_INT64_DIVISION',
  'C_RETURN_TRUNCATION_TO_INT32',
  'GUARD_CAPTURES_DIVIDE_BY_ZERO',
  'GUARD_CLAMP_SIGN_FROM_XOR',
  'NON_OVERFLOW_TRUNCATES_TOWARD_ZERO',
  'FIXED_MIN_NUMERATOR_BYPASSES_GUARD_VIA_X86_ABS_PARITY',
  'JS_IMPLEMENTATION_FLOAT_DIVIDE_THEN_NARROW',
]);

const ALL_INVARIANT_IDS: Set<FixedDivInvariantId> = new Set([
  'GUARD_CATCHES_DIVIDE_BY_ZERO_FOR_EVERY_NUMERATOR',
  'GUARD_CLAMP_FOLLOWS_SIGN_XOR',
  'IDENTITY_BY_FRACUNIT_DIVISOR',
  'IDENTITY_BY_SELF_DIVISOR',
  'ZERO_DIVIDEND_ABSORBS_FOR_NON_ZERO_DIVISOR',
  'INT32_RANGE_RESULT',
  'AGREES_WITH_BIGINT_REFERENCE',
]);

const ALL_PROBE_IDS: Set<FixedDivProbeId> = new Set([
  'identity_FRACUNIT_div_FRACUNIT',
  'identity_seven_div_FRACUNIT',
  'identity_neg_three_div_FRACUNIT',
  'zero_div_FRACUNIT',
  'zero_div_neg_FRACUNIT',
  'integer_six_div_three',
  'integer_six_div_neg_three',
  'integer_neg_six_div_neg_three',
  'fractional_three_div_two',
  'fractional_half_div_half',
  'fractional_neg_three_div_two',
  'truncation_seven_div_three_FRACUNIT',
  'truncation_neg_seven_div_three_FRACUNIT',
  'truncation_one_div_FRACUNIT',
  'divide_by_zero_positive_returns_FIXED_MAX',
  'divide_by_zero_negative_returns_FIXED_MIN',
  'divide_by_zero_zero_returns_FIXED_MAX',
  'overflow_FIXED_MAX_div_one',
  'overflow_neg_FIXED_MAX_div_one',
  'overflow_at_boundary_16384_FRACUNIT',
  'non_overflow_just_below_boundary',
  'wrap_FIXED_MIN_div_one_to_zero',
  'wrap_FIXED_MIN_div_neg_one_to_zero',
  'overflow_FIXED_MIN_div_FIXED_MIN_clamps_FIXED_MAX',
  'wrap_FIXED_MIN_div_FRACUNIT_preserves_FIXED_MIN',
]);

describe('audit-fixed-divide-semantics audited canonical constants', () => {
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

describe('audit-fixed-divide-semantics fact ledger shape', () => {
  test('audits exactly ten facts — five c-source, four divide-rule, one js-implementation', () => {
    expect(FIXED_DIV_AUDIT.length).toBe(10);
    const cSource = FIXED_DIV_AUDIT.filter((fact) => fact.category === 'c-source');
    const divideRule = FIXED_DIV_AUDIT.filter((fact) => fact.category === 'divide-rule');
    const jsImplementation = FIXED_DIV_AUDIT.filter((fact) => fact.category === 'js-implementation');
    expect(cSource.length).toBe(5);
    expect(divideRule.length).toBe(4);
    expect(jsImplementation.length).toBe(1);
  });

  test('every fact id is unique', () => {
    const ids = FIXED_DIV_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(FIXED_DIV_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of FIXED_DIV_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every c-source fact references an upstream Chocolate Doom 2.2.1 file', () => {
    const allowed = new Set(['src/m_fixed.h', 'src/m_fixed.c']);
    for (const fact of FIXED_DIV_AUDIT) {
      if (fact.category === 'c-source') {
        expect(allowed.has(fact.referenceSourceFile)).toBe(true);
      }
    }
  });

  test('the only js-implementation fact references src/core/fixed.ts', () => {
    const jsImplementation = FIXED_DIV_AUDIT.filter((fact) => fact.category === 'js-implementation');
    expect(jsImplementation.length).toBe(1);
    expect(jsImplementation[0]?.referenceSourceFile).toBe('src/core/fixed.ts');
  });

  test('every divide-rule fact is marked as derived', () => {
    for (const fact of FIXED_DIV_AUDIT) {
      if (fact.category === 'divide-rule') {
        expect(fact.referenceSourceFile).toBe('derived');
      }
    }
  });
});

describe('audit-fixed-divide-semantics fact ledger values', () => {
  test('C_HEADER_DECLARATION pins the header signature exactly', () => {
    const fact = FIXED_DIV_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('fixed_t FixedDiv(fixed_t a, fixed_t b);');
    expect(fact?.referenceSourceFile).toBe('src/m_fixed.h');
  });

  test('C_BODY_OVERFLOW_GUARD pins the canonical guard predicate exactly', () => {
    const fact = FIXED_DIV_AUDIT.find((candidate) => candidate.id === 'C_BODY_OVERFLOW_GUARD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('if ((abs(a) >> 14) >= abs(b))');
    expect(fact?.referenceSourceFile).toBe('src/m_fixed.c');
  });

  test('C_BODY_OVERFLOW_RETURN pins the sign-XOR clamp return exactly', () => {
    const fact = FIXED_DIV_AUDIT.find((candidate) => candidate.id === 'C_BODY_OVERFLOW_RETURN');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('return (a^b) < 0 ? INT_MIN : INT_MAX;');
    expect(fact?.referenceSourceFile).toBe('src/m_fixed.c');
  });

  test('C_BODY_INT64_DIVISION pins the canonical non-overflow body line exactly', () => {
    const fact = FIXED_DIV_AUDIT.find((candidate) => candidate.id === 'C_BODY_INT64_DIVISION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('result = ((int64_t) a << 16) / b;');
    expect(fact?.referenceSourceFile).toBe('src/m_fixed.c');
  });
});

describe('audit-fixed-divide-semantics invariant ledger shape', () => {
  test('lists exactly seven derived invariants', () => {
    expect(FIXED_DIV_INVARIANTS.length).toBe(7);
  });

  test('every invariant id is unique', () => {
    const ids = FIXED_DIV_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(FIXED_DIV_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of FIXED_DIV_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-fixed-divide-semantics probe ledger shape', () => {
  test('declares exactly twenty-five probes', () => {
    expect(FIXED_DIV_PROBES.length).toBe(25);
  });

  test('every probe id is unique', () => {
    const ids = FIXED_DIV_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(FIXED_DIV_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe operand and expected value is an int32', () => {
    for (const probe of FIXED_DIV_PROBES) {
      expect((probe.a | 0) === probe.a).toBe(true);
      expect((probe.b | 0) === probe.b).toBe(true);
      expect((probe.expected | 0) === probe.expected).toBe(true);
    }
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of FIXED_DIV_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every probe category at least once', () => {
    const categories = new Set(FIXED_DIV_PROBES.map((probe) => probe.category));
    expect(categories).toEqual(new Set(['identity', 'zero-dividend', 'integer', 'fractional', 'truncation', 'divide-by-zero', 'overflow-guard', 'boundary', 'fixed-min-bypass']));
  });

  test('every probe`s guardTriggers flag agrees with the canonical guard predicate computed independently', () => {
    for (const probe of FIXED_DIV_PROBES) {
      const aInt32 = probe.a | 0;
      const bInt32 = probe.b | 0;
      const absoluteA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
      const absoluteB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
      const expectedGuardTriggers = absoluteA >> 14 >= absoluteB;
      expect(probe.guardTriggers).toBe(expectedGuardTriggers);
    }
  });
});

describe('audit-fixed-divide-semantics BigInt reference', () => {
  test('agrees with every probe expected value', () => {
    for (const probe of FIXED_DIV_PROBES) {
      expect(fixedDivReference(probe.a, probe.b)).toBe(probe.expected);
    }
  });

  test('models the canonical body bit-for-bit on a sweep of int32 inputs', () => {
    const sweep = [0, 1, -1, 7, -7, 65_536, -65_536, 32_768, -32_768, 65_537, -65_537, 0x7fff_ffff, -0x8000_0000, 0x0001_8000, -0x0001_8000];
    for (const a of sweep) {
      for (const b of sweep) {
        const reference = fixedDivReference(a, b);

        // Build an independent reference that mirrors the canonical
        // C body without sharing any code with `fixedDivReference`.
        // The non-overflow branch handles `b == 0` by returning `0`
        // (matching the JS implementation's `-Infinity | 0` route),
        // and the BigInt division otherwise.
        const aInt32 = a | 0;
        const bInt32 = b | 0;
        const absA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
        const absB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
        let independent: number;
        if (absA >> 14 >= absB) {
          independent = (aInt32 ^ bInt32) < 0 ? -0x8000_0000 : 0x7fff_ffff;
        } else if (bInt32 === 0) {
          independent = 0;
        } else {
          const product = BigInt(aInt32) << 16n;
          const quotient = product / BigInt(bInt32);
          independent = Number(BigInt.asIntN(32, quotient));
        }

        expect(reference).toBe(independent);
      }
    }
  });

  test('coerces non-int32 inputs via | 0 to match implicit C narrowing on int32-typed callers', () => {
    expect(fixedDivReference(1.7, 65_536)).toBe(fixedDivReference(1, 65_536));
    expect(fixedDivReference(65_536, 1.7)).toBe(fixedDivReference(65_536, 1));
    expect(fixedDivReference(0x1_0000_0000, 65_536)).toBe(fixedDivReference(0, 65_536));
  });
});

describe('crossCheckFixedDivSemantics on the live runtime fixedDiv', () => {
  test('reports zero failures', () => {
    expect(crossCheckFixedDivSemantics(fixedDiv)).toEqual([]);
  });

  test('runtime fixedDiv matches every probe expected value', () => {
    for (const probe of FIXED_DIV_PROBES) {
      expect(fixedDiv(probe.a, probe.b)).toBe(probe.expected);
    }
  });

  test('runtime fixedDiv agrees with the BigInt reference for every probe', () => {
    for (const probe of FIXED_DIV_PROBES) {
      expect(fixedDiv(probe.a, probe.b)).toBe(fixedDivReference(probe.a, probe.b));
    }
  });

  test('runtime fixedDiv honours GUARD_CAPTURES_DIVIDE_BY_ZERO across all three numerator signs', () => {
    expect(fixedDiv(FRACUNIT, 0)).toBe(FIXED_MAX);
    expect(fixedDiv(-FRACUNIT, 0)).toBe(FIXED_MIN);
    expect(fixedDiv(0, 0)).toBe(FIXED_MAX);
  });

  test('runtime fixedDiv honours NON_OVERFLOW_TRUNCATES_TOWARD_ZERO on every documented case', () => {
    expect(fixedDiv(7, FRACUNIT * 3)).toBe(2);
    expect(fixedDiv(-7, FRACUNIT * 3)).toBe(-2);
    expect(fixedDiv(1, FRACUNIT)).toBe(1);
  });

  test('runtime fixedDiv honours FIXED_MIN_NUMERATOR_BYPASSES_GUARD_VIA_X86_ABS_PARITY', () => {
    expect(fixedDiv(FIXED_MIN, 1)).toBe(0);
    expect(fixedDiv(FIXED_MIN, -1)).toBe(0);
    expect(fixedDiv(FIXED_MIN, FRACUNIT)).toBe(FIXED_MIN);
  });

  test('runtime fixedDiv honours GUARD_CLAMP_SIGN_FROM_XOR on the canonical extremes', () => {
    expect(fixedDiv(FIXED_MAX, 1)).toBe(FIXED_MAX);
    expect(fixedDiv(-FIXED_MAX, 1)).toBe(FIXED_MIN);
    expect(fixedDiv(FIXED_MIN, FIXED_MIN)).toBe(FIXED_MAX);
  });

  test('runtime fixedDiv honours the >= boundary at numerator == 16384 * FRACUNIT', () => {
    const sixteenThousandFracUnit = (16384 * FRACUNIT) | 0;
    const justBelowBoundary = (16383 * FRACUNIT) | 0;
    expect(fixedDiv(sixteenThousandFracUnit, FRACUNIT)).toBe(FIXED_MAX);
    expect(fixedDiv(justBelowBoundary, FRACUNIT)).toBe(justBelowBoundary);
  });
});

describe('crossCheckFixedDivSemantics failure modes — tampered candidates', () => {
  test('detects a candidate that uses > instead of >= in the overflow guard (off-by-one at the boundary)', () => {
    const tampered: FixedDivFunction = (a, b) => {
      const aInt32 = a | 0;
      const bInt32 = b | 0;
      const absA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
      const absB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
      // Off-by-one: > instead of >=. Falls through cleanly via the JS
      // float divide on the non-overflow branch — no BigInt RangeError
      // when the off-by-one drops a divide-by-zero through the guard.
      if (absA >> 14 > absB) {
        return (aInt32 ^ bInt32) < 0 ? -0x8000_0000 : 0x7fff_ffff;
      }
      return ((aInt32 * 0x10000) / bInt32) | 0;
    };
    const failures = crossCheckFixedDivSemantics(tampered);
    expect(failures).toContain('probe:overflow_at_boundary_16384_FRACUNIT');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that always returns FIXED_MAX on guard (no sign-XOR)', () => {
    const tampered: FixedDivFunction = (a, b) => {
      const aInt32 = a | 0;
      const bInt32 = b | 0;
      const absA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
      const absB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
      if (absA >> 14 >= absB) {
        // Bug: always FIXED_MAX, no sign check.
        return 0x7fff_ffff;
      }
      return ((aInt32 * 0x10000) / bInt32) | 0;
    };
    const failures = crossCheckFixedDivSemantics(tampered);
    expect(failures).toContain('probe:divide_by_zero_negative_returns_FIXED_MIN');
    expect(failures).toContain('probe:overflow_neg_FIXED_MAX_div_one');
    expect(failures).toContain('invariant:GUARD_CLAMP_FOLLOWS_SIGN_XOR');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that floors instead of truncating toward zero on the non-overflow branch', () => {
    const tampered: FixedDivFunction = (a, b) => {
      const aInt32 = a | 0;
      const bInt32 = b | 0;
      const absA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
      const absB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
      if (absA >> 14 >= absB) {
        return (aInt32 ^ bInt32) < 0 ? -0x8000_0000 : 0x7fff_ffff;
      }
      // Bug: floor toward -infinity instead of truncate toward zero.
      // Use Math.floor on the float divide so the non-overflow branch
      // remains crash-safe on b == 0 (Math.floor(±Infinity) is still
      // ±Infinity, then `| 0` narrows to 0).
      return Math.floor((aInt32 * 0x10000) / bInt32) | 0;
    };
    const failures = crossCheckFixedDivSemantics(tampered);
    expect(failures).toContain('probe:truncation_neg_seven_div_three_FRACUNIT');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that skips the int32 narrowing cast (returns float beyond int32)', () => {
    const tampered: FixedDivFunction = (a, b) => {
      const aInt32 = a | 0;
      const bInt32 = b | 0;
      const absA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
      const absB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
      if (absA >> 14 >= absB) {
        return (aInt32 ^ bInt32) < 0 ? -0x8000_0000 : 0x7fff_ffff;
      }
      // Bug: skip the `| 0` narrowing entirely. The float result for
      // (FIXED_MIN, 1) is -2^47, which is outside int32 and triggers
      // the INT32_RANGE_RESULT invariant.
      return (aInt32 * 0x10000) / bInt32;
    };
    const failures = crossCheckFixedDivSemantics(tampered);
    expect(failures).toContain('probe:wrap_FIXED_MIN_div_one_to_zero');
    expect(failures).toContain('invariant:INT32_RANGE_RESULT');
  });

  test('detects a candidate that does not guard against divide-by-zero (returns NaN)', () => {
    const tampered: FixedDivFunction = (a, b) => {
      const aInt32 = a | 0;
      const bInt32 = b | 0;
      // Bug: replace the overflow-guard branch with a NaN return for
      // b == 0 specifically. The non-overflow branch still uses the
      // canonical JS body so everything else passes.
      if (bInt32 === 0) {
        return Number.NaN;
      }
      const absA = aInt32 < 0 ? -aInt32 | 0 : aInt32;
      const absB = bInt32 < 0 ? -bInt32 | 0 : bInt32;
      if (absA >> 14 >= absB) {
        return (aInt32 ^ bInt32) < 0 ? -0x8000_0000 : 0x7fff_ffff;
      }
      return ((aInt32 * 0x10000) / bInt32) | 0;
    };
    const failures = crossCheckFixedDivSemantics(tampered);
    expect(failures).toContain('probe:divide_by_zero_positive_returns_FIXED_MAX');
    expect(failures).toContain('invariant:GUARD_CATCHES_DIVIDE_BY_ZERO_FOR_EVERY_NUMERATOR');
  });

  test('detects a candidate that uses true math abs (collapses the FIXED_MIN bypass)', () => {
    const tampered: FixedDivFunction = (a, b) => {
      const aInt32 = a | 0;
      const bInt32 = b | 0;
      // Bug: use Math.abs and divide by 16384 directly (Number arithmetic
      // does not wrap), so |INT_MIN| stays positive at 2^31, the guard
      // triggers, and the FIXED_MIN bypass is lost.
      const absA = Math.abs(aInt32);
      const absB = Math.abs(bInt32);
      if (absA / 16384 >= absB) {
        return (aInt32 ^ bInt32) < 0 ? -0x8000_0000 : 0x7fff_ffff;
      }
      return ((aInt32 * 0x10000) / bInt32) | 0;
    };
    const failures = crossCheckFixedDivSemantics(tampered);
    expect(failures).toContain('probe:wrap_FIXED_MIN_div_one_to_zero');
    expect(failures).toContain('probe:wrap_FIXED_MIN_div_neg_one_to_zero');
    expect(failures).toContain('invariant:AGREES_WITH_BIGINT_REFERENCE');
  });

  test('reports an empty failure list for the BigInt reference itself', () => {
    expect(crossCheckFixedDivSemantics(fixedDivReference)).toEqual([]);
  });
});

describe('audit-fixed-divide-semantics step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-003-audit-fixed-divide-semantics.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-fixed-divide-semantics.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-fixed-divide-semantics.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-003-audit-fixed-divide-semantics.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-003-audit-fixed-divide-semantics.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
