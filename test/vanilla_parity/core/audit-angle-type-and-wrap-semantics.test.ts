import { describe, expect, test } from 'bun:test';

import { ANG45, ANG90, ANG180, ANG270, angleWrap } from '../../../src/core/angle.ts';
import {
  ANGLE_WRAP_AUDIT,
  ANGLE_WRAP_INVARIANTS,
  ANGLE_WRAP_PROBES,
  AUDITED_ANG45,
  AUDITED_ANG90,
  AUDITED_ANG180,
  AUDITED_ANG270,
  AUDITED_ANG_MAX,
  AUDITED_FULL_CIRCLE,
  angleWrapReference,
  crossCheckAngleWrapSemantics,
} from '../../../src/core/audit-angle-type-and-wrap-semantics.ts';
import type { AngleWrapFactId, AngleWrapFunction, AngleWrapInvariantId, AngleWrapProbeId } from '../../../src/core/audit-angle-type-and-wrap-semantics.ts';

const ALL_FACT_IDS: Set<AngleWrapFactId> = new Set([
  'C_HEADER_TYPEDEF_ANGLE_T',
  'C_HEADER_DEFINE_ANG45',
  'C_HEADER_DEFINE_ANG90',
  'C_HEADER_DEFINE_ANG180',
  'C_HEADER_DEFINE_ANG270',
  'C_HEADER_DEFINE_ANG_MAX',
  'UNSIGNED_ARITHMETIC_WRAPS_MOD_2_TO_32',
  'RENDERER_FOV_DELTA_RELIES_ON_UNSIGNED_SUBTRACT',
  'PLAYER_HITSCAN_RANDOM_RELIES_ON_UNSIGNED_ADD',
  'JS_IMPLEMENTATION_USES_UNSIGNED_RIGHT_SHIFT_ZERO',
]);

const ALL_INVARIANT_IDS: Set<AngleWrapInvariantId> = new Set([
  'WRAP_PRESERVES_VALUES_IN_UINT32_RANGE',
  'WRAP_FULL_CIRCLE_RETURNS_ZERO',
  'WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX',
  'WRAP_INT32_MIN_RETURNS_ANG180',
  'WRAP_IS_IDEMPOTENT',
  'WRAP_RESULT_IS_UINT32',
  'WRAP_AGREES_WITH_BIGINT_REFERENCE',
]);

const ALL_PROBE_IDS: Set<AngleWrapProbeId> = new Set([
  'preserve_zero',
  'preserve_ANG45',
  'preserve_ANG90',
  'preserve_ANG180',
  'preserve_ANG270',
  'preserve_ANG_MAX',
  'sum_ANG90_plus_ANG90_to_ANG180',
  'sum_ANG180_plus_ANG180_to_zero',
  'sum_ANG270_plus_ANG180_to_ANG90',
  'sum_ANG_MAX_plus_one_to_zero',
  'sum_full_circle_plus_one_to_one',
  'sum_double_full_circle_to_zero',
  'wrap_negative_one_to_ANG_MAX',
  'wrap_neg_ANG45_to_ANG315',
  'wrap_neg_ANG90_to_ANG270',
  'wrap_neg_ANG180_to_ANG180',
  'wrap_neg_full_circle_to_zero',
  'wrap_INT32_MIN_to_ANG180',
  'sub_ANG45_minus_ANG90_to_ANG315',
  'sub_ANG90_minus_ANG270_to_ANG180',
  'renderer_FOV_delta_view_eq_vis_to_ANG90',
  'renderer_FOV_delta_view_ANG90_above_vis_zero_to_zero',
  'renderer_FOV_delta_view_ANG270_above_vis_ANG45_to_ANG225',
  'hitscan_random_neg_255_offset_added_to_ANG90',
  'demo_turn_carry_negative_minus_ANG_MAX_to_one',
]);

describe('audit-angle-type-and-wrap-semantics audited canonical constants', () => {
  test('AUDITED_ANG45 is exactly 0x20000000, independent of src/core/angle.ts', () => {
    expect(AUDITED_ANG45).toBe(0x2000_0000);
  });

  test('AUDITED_ANG90 is exactly 0x40000000, independent of src/core/angle.ts', () => {
    expect(AUDITED_ANG90).toBe(0x4000_0000);
  });

  test('AUDITED_ANG180 is exactly 0x80000000, independent of src/core/angle.ts', () => {
    expect(AUDITED_ANG180).toBe(0x8000_0000);
  });

  test('AUDITED_ANG270 is exactly 0xC0000000, independent of src/core/angle.ts', () => {
    expect(AUDITED_ANG270).toBe(0xc000_0000);
  });

  test('AUDITED_ANG_MAX is exactly 0xFFFFFFFF (UINT32_MAX), independent of src/core/angle.ts', () => {
    expect(AUDITED_ANG_MAX).toBe(0xffff_ffff);
  });

  test('AUDITED_FULL_CIRCLE is exactly 2^32, independent of src/core/angle.ts', () => {
    expect(AUDITED_FULL_CIRCLE).toBe(0x1_0000_0000);
    expect(AUDITED_FULL_CIRCLE).toBe(AUDITED_ANG_MAX + 1);
  });

  test('audited canonical constants agree with the runtime exports from src/core/angle.ts', () => {
    expect(AUDITED_ANG45).toBe(ANG45);
    expect(AUDITED_ANG90).toBe(ANG90);
    expect(AUDITED_ANG180).toBe(ANG180);
    expect(AUDITED_ANG270).toBe(ANG270);
  });

  test('the four named BAM constants form integer multiples of ANG45', () => {
    expect(AUDITED_ANG90).toBe(AUDITED_ANG45 * 2);
    expect(AUDITED_ANG180).toBe(AUDITED_ANG45 * 4);
    expect(AUDITED_ANG270).toBe(AUDITED_ANG45 * 6);
    expect(AUDITED_ANG45 * 8).toBe(AUDITED_FULL_CIRCLE);
  });
});

describe('audit-angle-type-and-wrap-semantics fact ledger shape', () => {
  test('audits exactly ten facts — six c-source, three wrap-rule, one js-implementation', () => {
    expect(ANGLE_WRAP_AUDIT.length).toBe(10);
    const cSource = ANGLE_WRAP_AUDIT.filter((fact) => fact.category === 'c-source');
    const wrapRule = ANGLE_WRAP_AUDIT.filter((fact) => fact.category === 'wrap-rule');
    const jsImplementation = ANGLE_WRAP_AUDIT.filter((fact) => fact.category === 'js-implementation');
    expect(cSource.length).toBe(6);
    expect(wrapRule.length).toBe(3);
    expect(jsImplementation.length).toBe(1);
  });

  test('every fact id is unique', () => {
    const ids = ANGLE_WRAP_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(ANGLE_WRAP_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of ANGLE_WRAP_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every c-source fact references an upstream Chocolate Doom 2.2.1 file', () => {
    const allowed = new Set(['src/tables.h', 'src/r_main.c', 'src/p_pspr.c']);
    for (const fact of ANGLE_WRAP_AUDIT) {
      if (fact.category === 'c-source') {
        expect(allowed.has(fact.referenceSourceFile)).toBe(true);
      }
    }
  });

  test('the only js-implementation fact references src/core/angle.ts', () => {
    const jsImplementation = ANGLE_WRAP_AUDIT.filter((fact) => fact.category === 'js-implementation');
    expect(jsImplementation.length).toBe(1);
    expect(jsImplementation[0]?.referenceSourceFile).toBe('src/core/angle.ts');
  });

  test('every wrap-rule fact is either marked as derived or pinned to a renderer/player site that exhibits the wrap', () => {
    const allowed = new Set(['derived', 'src/r_main.c', 'src/p_pspr.c']);
    for (const fact of ANGLE_WRAP_AUDIT) {
      if (fact.category === 'wrap-rule') {
        expect(allowed.has(fact.referenceSourceFile)).toBe(true);
      }
    }
  });
});

describe('audit-angle-type-and-wrap-semantics fact ledger values', () => {
  test('C_HEADER_TYPEDEF_ANGLE_T pins the canonical typedef exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_TYPEDEF_ANGLE_T');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('typedef unsigned angle_t;');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DEFINE_ANG45 pins the canonical macro exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_ANG45');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define ANG45           0x20000000');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DEFINE_ANG90 pins the canonical macro exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_ANG90');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define ANG90           0x40000000');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DEFINE_ANG180 pins the canonical macro exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_ANG180');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define ANG180          0x80000000');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DEFINE_ANG270 pins the canonical macro exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_ANG270');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define ANG270          0xc0000000');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DEFINE_ANG_MAX pins the canonical macro exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_ANG_MAX');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define ANG_MAX         0xffffffff');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('RENDERER_FOV_DELTA_RELIES_ON_UNSIGNED_SUBTRACT pins the canonical R_ScaleFromGlobalAngle line exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'RENDERER_FOV_DELTA_RELIES_ON_UNSIGNED_SUBTRACT');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('anglea = ANG90 + (visangle-viewangle);');
    expect(fact?.referenceSourceFile).toBe('src/r_main.c');
  });

  test('PLAYER_HITSCAN_RANDOM_RELIES_ON_UNSIGNED_ADD pins the canonical P_GunShot line exactly', () => {
    const fact = ANGLE_WRAP_AUDIT.find((candidate) => candidate.id === 'PLAYER_HITSCAN_RANDOM_RELIES_ON_UNSIGNED_ADD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('angle += (P_Random()-P_Random())<<18;');
    expect(fact?.referenceSourceFile).toBe('src/p_pspr.c');
  });
});

describe('audit-angle-type-and-wrap-semantics invariant ledger shape', () => {
  test('lists exactly seven derived invariants', () => {
    expect(ANGLE_WRAP_INVARIANTS.length).toBe(7);
  });

  test('every invariant id is unique', () => {
    const ids = ANGLE_WRAP_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(ANGLE_WRAP_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of ANGLE_WRAP_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-angle-type-and-wrap-semantics probe ledger shape', () => {
  test('declares exactly twenty-five probes', () => {
    expect(ANGLE_WRAP_PROBES.length).toBe(25);
  });

  test('every probe id is unique', () => {
    const ids = ANGLE_WRAP_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(ANGLE_WRAP_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe input is a finite Number and every expected value is a uint32', () => {
    for (const probe of ANGLE_WRAP_PROBES) {
      expect(Number.isFinite(probe.input)).toBe(true);
      expect(Number.isInteger(probe.expected)).toBe(true);
      expect(probe.expected).toBeGreaterThanOrEqual(0);
      expect(probe.expected).toBeLessThanOrEqual(0xffff_ffff);
    }
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of ANGLE_WRAP_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every probe category at least once', () => {
    const categories = new Set(ANGLE_WRAP_PROBES.map((probe) => probe.category));
    expect(categories).toEqual(new Set(['preserve', 'sum-wrap', 'negative-wrap', 'subtract-wrap', 'renderer-fov-delta', 'hitscan-random', 'demo-turn-carry']));
  });
});

describe('audit-angle-type-and-wrap-semantics BigInt reference', () => {
  test('agrees with every probe expected value', () => {
    for (const probe of ANGLE_WRAP_PROBES) {
      expect(angleWrapReference(probe.input)).toBe(probe.expected);
    }
  });

  test('models the canonical unsigned wrap bit-for-bit on a sweep of representative integer inputs', () => {
    const sweep = [
      0, 1, -1, 0x2000_0000, -0x2000_0000, 0x4000_0000, -0x4000_0000, 0x8000_0000, -0x8000_0000, 0xc000_0000, -0xc000_0000, 0xffff_ffff, -0xffff_ffff, 0x1_0000_0000, -0x1_0000_0000, 0x1_0000_0001, -0x1_0000_0001, 0x2_0000_0000,
      -0x2_0000_0000,
    ];
    for (const value of sweep) {
      const reference = angleWrapReference(value);

      // Build an independent reference that mirrors the canonical
      // BigInt formula without sharing any code with `angleWrapReference`.
      // The mathematical-modulo formula `((x % m) + m) % m` produces a
      // non-negative result for every signed integer input.
      const truncated = BigInt(Math.trunc(value));
      const modulus = 1n << 32n;
      const independent = Number(((truncated % modulus) + modulus) % modulus);

      expect(reference).toBe(independent);
    }
  });

  test('coerces non-finite inputs (NaN, +Infinity, -Infinity) to zero to match ToInt32 semantics', () => {
    expect(angleWrapReference(Number.NaN)).toBe(0);
    expect(angleWrapReference(Number.POSITIVE_INFINITY)).toBe(0);
    expect(angleWrapReference(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  test('truncates fractional inputs toward zero before wrapping', () => {
    expect(angleWrapReference(1.7)).toBe(1);
    expect(angleWrapReference(-1.7)).toBe(0xffff_ffff);
    expect(angleWrapReference(0x4000_0000 + 0.5)).toBe(0x4000_0000);
  });
});

describe('crossCheckAngleWrapSemantics on the live runtime angleWrap', () => {
  test('reports zero failures', () => {
    expect(crossCheckAngleWrapSemantics(angleWrap)).toEqual([]);
  });

  test('runtime angleWrap matches every probe expected value', () => {
    for (const probe of ANGLE_WRAP_PROBES) {
      expect(angleWrap(probe.input)).toBe(probe.expected);
    }
  });

  test('runtime angleWrap agrees with the BigInt reference for every probe', () => {
    for (const probe of ANGLE_WRAP_PROBES) {
      expect(angleWrap(probe.input)).toBe(angleWrapReference(probe.input));
    }
  });

  test('runtime angleWrap honours WRAP_FULL_CIRCLE_RETURNS_ZERO', () => {
    expect(angleWrap(AUDITED_FULL_CIRCLE)).toBe(0);
  });

  test('runtime angleWrap honours WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX', () => {
    expect(angleWrap(-1)).toBe(AUDITED_ANG_MAX);
  });

  test('runtime angleWrap honours WRAP_INT32_MIN_RETURNS_ANG180 (the parity-critical fact)', () => {
    expect(angleWrap(-0x8000_0000)).toBe(AUDITED_ANG180);
  });

  test('runtime angleWrap honours WRAP_IS_IDEMPOTENT on every probe input', () => {
    for (const probe of ANGLE_WRAP_PROBES) {
      const wrapped = angleWrap(probe.input);
      expect(angleWrap(wrapped)).toBe(wrapped);
    }
  });

  test('runtime angleWrap reproduces the renderer R_ScaleFromGlobalAngle FOV delta on the canonical configurations', () => {
    // anglea = ANG90 + (visangle - viewangle)
    // (vis 0, view ANG90)  → ANG90 + -ANG90  → 0
    // (vis ANG45, view ANG270) → ANG90 + (ANG45 - ANG270) → ANG90 + -ANG225 → ANG225 (= ANG180 + ANG45)
    expect(angleWrap(ANG90 + (0 - ANG90))).toBe(0);
    expect(angleWrap(ANG90 + (ANG45 - ANG270))).toBe(ANG180 + ANG45);
  });

  test('runtime angleWrap reproduces the player P_GunShot random-spread offset add on the worst-case left spread', () => {
    // angle += (P_Random() - P_Random()) << 18; worst-case difference = -255
    // -255 << 18 = -0x3FC0000 in JS int32 arithmetic
    expect(-255 << 18).toBe(-0x3fc_0000);
    expect(angleWrap(ANG90 + (-255 << 18))).toBe(0x3c04_0000);
  });
});

describe('crossCheckAngleWrapSemantics failure modes — tampered candidates', () => {
  test('detects a candidate that uses signed arithmetic right shift instead of unsigned (returns negative for INT32_MIN)', () => {
    const tampered: AngleWrapFunction = (angle) => angle | 0;
    const failures = crossCheckAngleWrapSemantics(tampered);
    expect(failures).toContain('probe:wrap_INT32_MIN_to_ANG180');
    expect(failures).toContain('probe:preserve_ANG_MAX');
    expect(failures).toContain('invariant:WRAP_INT32_MIN_RETURNS_ANG180');
    expect(failures).toContain('invariant:WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX');
  });

  test('detects a candidate that masks with 0x7FFFFFFF (drops the high bit, breaks ANG180/ANG270/ANG_MAX)', () => {
    const tampered: AngleWrapFunction = (angle) => (angle | 0) & 0x7fff_ffff;
    const failures = crossCheckAngleWrapSemantics(tampered);
    expect(failures).toContain('probe:preserve_ANG180');
    expect(failures).toContain('probe:preserve_ANG270');
    expect(failures).toContain('probe:preserve_ANG_MAX');
    expect(failures).toContain('invariant:WRAP_INT32_MIN_RETURNS_ANG180');
  });

  test('detects a candidate that applies Math.abs (breaks the unsigned-subtract wrap for negatives)', () => {
    const tampered: AngleWrapFunction = (angle) => Math.abs(angle | 0);
    const failures = crossCheckAngleWrapSemantics(tampered);
    expect(failures).toContain('probe:wrap_negative_one_to_ANG_MAX');
    expect(failures).toContain('probe:wrap_neg_ANG90_to_ANG270');
    expect(failures).toContain('invariant:WRAP_NEGATIVE_ONE_RETURNS_ANG_MAX');
  });

  test('detects a candidate that returns the value unchanged (skips the wrap entirely)', () => {
    const tampered: AngleWrapFunction = (angle) => angle;
    const failures = crossCheckAngleWrapSemantics(tampered);
    expect(failures).toContain('probe:sum_ANG_MAX_plus_one_to_zero');
    expect(failures).toContain('probe:sum_full_circle_plus_one_to_one');
    expect(failures).toContain('probe:wrap_negative_one_to_ANG_MAX');
    expect(failures).toContain('invariant:WRAP_RESULT_IS_UINT32');
    expect(failures).toContain('invariant:WRAP_FULL_CIRCLE_RETURNS_ZERO');
  });

  test('detects a candidate that subtracts 2^32 once instead of taking modulo (fails on the double-full-circle probe)', () => {
    const tampered: AngleWrapFunction = (angle) => {
      let value = Math.trunc(angle);
      if (value >= 0x1_0000_0000) {
        value -= 0x1_0000_0000;
      } else if (value < 0) {
        value += 0x1_0000_0000;
      }
      return value;
    };
    const failures = crossCheckAngleWrapSemantics(tampered);
    expect(failures).toContain('probe:sum_double_full_circle_to_zero');
    expect(failures).toContain('invariant:WRAP_AGREES_WITH_BIGINT_REFERENCE');
  });

  test('detects a candidate that returns a float result (fails the int32-range / idempotent invariants)', () => {
    const tampered: AngleWrapFunction = (angle) => {
      // Bug: the result is a float that happens to coincide with the
      // expected uint32 by value but is not stored as an integer
      // bit pattern (1.5 instead of an integer for one specific
      // probe input).
      if (angle === 0) {
        return 1.5;
      }
      return angle >>> 0;
    };
    const failures = crossCheckAngleWrapSemantics(tampered);
    expect(failures).toContain('probe:preserve_zero');
    expect(failures).toContain('invariant:WRAP_RESULT_IS_UINT32');
  });

  test('reports an empty failure list for the BigInt reference itself', () => {
    expect(crossCheckAngleWrapSemantics(angleWrapReference)).toEqual([]);
  });
});

describe('audit-angle-type-and-wrap-semantics step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-004-audit-angle-type-and-wrap-semantics.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-angle-type-and-wrap-semantics.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-angle-type-and-wrap-semantics.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-004-audit-angle-type-and-wrap-semantics.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-004-audit-angle-type-and-wrap-semantics.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
