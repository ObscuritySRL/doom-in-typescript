/**
 * Audit ledger for the vanilla DOOM 1.9 fixed-point constants exported by
 * `src/core/fixed.ts`.
 *
 * Each entry pins one constant to its upstream Chocolate Doom 2.2.1 source
 * declaration. The accompanying focused test imports `src/core/fixed.ts` and
 * cross-checks every entry against the runtime export. If a future change
 * silently shifts `FRACBITS`, `FRACUNIT`, `FIXED_MIN`, or `FIXED_MAX` away
 * from the canonical 16.16 / int32 layout, the audit ledger and the focused
 * test together reject the change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`m_fixed.h`, `m_fixed.c`, `tables.c`,
 *      `d_main.c`, `g_game.c`).
 *
 * The audit constants below are pinned against authority 5 because the C
 * declarations of `fixed_t`, `FRACBITS`, and `FRACUNIT` are textual constants
 * that DOSBox cannot disagree with — the int32 backing type and the 16.16
 * split are the only representations the integer math in `m_fixed.c`
 * (`FixedMul`, `FixedDiv`) can be consistent with.
 */

/**
 * One audited constant pinned to its upstream C declaration.
 */
export interface FixedPointConstantAuditEntry {
  /** Stable identifier matching the symbol exported from `src/core/fixed.ts`. */
  readonly name: 'FRACBITS' | 'FRACUNIT' | 'FIXED_MAX' | 'FIXED_MIN';
  /** Numeric value as a JavaScript `number`. Must equal the runtime export. */
  readonly value: number;
  /** Hex form of `value`, written exactly the way the C source declares it. */
  readonly hex: string;
  /** Expected integer width in bits of the underlying signed type. */
  readonly underlyingBitWidth: 32;
  /** Verbatim C declaration from the reference source. */
  readonly cDeclaration: string;
  /** Reference source path inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/m_fixed.h' | 'src/doomtype.h' | 'derived';
  /** Plain-language note explaining why the value cannot vary. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every fixed-point constant exported by `src/core/fixed.ts`.
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every runtime export from `src/core/fixed.ts` has exactly one ledger
 * entry and that the values agree bit for bit.
 */
export const FIXED_POINT_CONSTANT_AUDIT: readonly FixedPointConstantAuditEntry[] = [
  {
    name: 'FRACBITS',
    value: 16,
    hex: '0x10',
    underlyingBitWidth: 32,
    cDeclaration: '#define FRACBITS 16',
    referenceSourceFile: 'src/m_fixed.h',
    invariant:
      'Number of fractional bits in the 16.16 fixed-point split. Changing this number changes the meaning of every Fixed value in the codebase, every demo tic, every saved sector floor height, and every projectile trajectory — it is the single load-bearing identity of `fixed_t`.',
  },
  {
    name: 'FRACUNIT',
    value: 65_536,
    hex: '0x10000',
    underlyingBitWidth: 32,
    cDeclaration: '#define FRACUNIT (1<<FRACBITS)',
    referenceSourceFile: 'src/m_fixed.h',
    invariant:
      'Exactly `1 << FRACBITS`. Represents 1.0 in 16.16 fixed-point. The renderer, the physics, the AI, the save format, and every demo ticcmd all multiply and divide by this constant; deviating from `1 << 16` desynchronises every downstream subsystem.',
  },
  {
    name: 'FIXED_MAX',
    value: 0x7fff_ffff,
    hex: '0x7FFFFFFF',
    underlyingBitWidth: 32,
    cDeclaration: '#define INT_MAX 0x7FFFFFFF (limits.h, used by FixedDiv overflow guard)',
    referenceSourceFile: 'derived',
    invariant:
      'Maximum positive int32 value. `FixedDiv` returns this constant on positive overflow; the overflow guard `(abs(a) >> 14) >= abs(b)` together with this clamp must reproduce vanilla `INT_MAX` exactly so demos and physics that pass through pathological denominators stay deterministic.',
  },
  {
    name: 'FIXED_MIN',
    value: -0x8000_0000,
    hex: '-0x80000000',
    underlyingBitWidth: 32,
    cDeclaration: '#define INT_MIN (-INT_MAX-1) (limits.h, used by FixedDiv overflow guard)',
    referenceSourceFile: 'derived',
    invariant:
      'Minimum negative int32 value. `FixedDiv` returns this constant on negative overflow. `abs(FIXED_MIN)` is technically undefined in C but evaluates to `FIXED_MIN` again on x86; the `| 0` truncation in our `fixedDiv` reproduces that behaviour, and the audit pins the value to `-0x8000_0000` so any future replacement of int32 by a wider integer trips the test.',
  },
] as const;

/**
 * Derived bit-level invariants the ledger asserts on top of the raw values.
 * The focused test enforces every entry; failures point at concrete identities
 * that any vanilla parity rebuild must preserve.
 */
export interface FixedPointDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const FIXED_POINT_DERIVED_INVARIANTS: readonly FixedPointDerivedInvariant[] = [
  {
    id: 'FRACUNIT_EQUALS_ONE_SHIFTED_BY_FRACBITS',
    description: '`FRACUNIT === 1 << FRACBITS` so the integer/fraction split is exactly 16/16.',
  },
  {
    id: 'FRACUNIT_IS_POWER_OF_TWO',
    description: '`FRACUNIT > 0 && (FRACUNIT & (FRACUNIT - 1)) === 0` so right-shift by `FRACBITS` is the canonical truncation operation.',
  },
  {
    id: 'FIXED_MAX_IS_INT32_MAX',
    description: '`FIXED_MAX === 0x7FFF_FFFF` so the FixedDiv positive-overflow clamp matches vanilla `INT_MAX`.',
  },
  {
    id: 'FIXED_MIN_IS_INT32_MIN',
    description: '`FIXED_MIN === -0x8000_0000` so the FixedDiv negative-overflow clamp matches vanilla `INT_MIN` and so two-s-complement wrap from `FIXED_MAX + 1` reproduces vanilla wrap.',
  },
  {
    id: 'FIXED_RANGE_SPANS_2_TO_32',
    description: '`FIXED_MAX - FIXED_MIN + 1 === 2 ** 32` so the range covers exactly the int32 numeric line.',
  },
  {
    id: 'FIXED_MAX_INTEGER_PART_IS_INT16_MAX',
    description: '`FIXED_MAX >> FRACBITS === 32_767` so the integer half of `fixed_t` matches signed 16-bit max.',
  },
  {
    id: 'FIXED_MIN_INTEGER_PART_IS_INT16_MIN',
    description: '`FIXED_MIN >> FRACBITS === -32_768` so the integer half of `fixed_t` matches signed 16-bit min.',
  },
  {
    id: 'FIXED_MAX_FRACTIONAL_PART_IS_SATURATED',
    description: '`FIXED_MAX & (FRACUNIT - 1) === 0xFFFF` so the fractional bits of `INT_MAX` are fully set.',
  },
  {
    id: 'FIXED_MIN_FRACTIONAL_PART_IS_ZERO',
    description: '`FIXED_MIN & (FRACUNIT - 1) === 0` so `INT_MIN` lands cleanly on an integer boundary.',
  },
  {
    id: 'INT32_WRAP_AROUND_FROM_MAX_TO_MIN',
    description: '`(FIXED_MAX + 1) | 0 === FIXED_MIN` so two-s-complement wrap is preserved by JavaScript bitwise OR coercion, which all vanilla addition/subtraction relies on.',
  },
  {
    id: 'INT32_WRAP_AROUND_FROM_MIN_TO_MAX',
    description: '`(FIXED_MIN - 1) | 0 === FIXED_MAX` so two-s-complement wrap is symmetric in the negative direction.',
  },
] as const;

/**
 * Snapshot of the fixed-point constants exported by `src/core/fixed.ts`.
 * The cross-check helper consumes this shape so the focused test can both
 * verify the live runtime exports and exercise a deliberately tampered
 * snapshot to prove the failure modes are observable.
 */
export interface FixedPointConstantSnapshot {
  readonly FRACBITS: number;
  readonly FRACUNIT: number;
  readonly FIXED_MAX: number;
  readonly FIXED_MIN: number;
}

/**
 * Cross-check a `FixedPointConstantSnapshot` against
 * `FIXED_POINT_CONSTANT_AUDIT` and `FIXED_POINT_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list means
 * the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `audit:<NAME>:value-mismatch` for a constant whose runtime value
 *    differs from the audit ledger.
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 */
export function crossCheckFixedPointConstants(snapshot: FixedPointConstantSnapshot): readonly string[] {
  const failures: string[] = [];

  for (const entry of FIXED_POINT_CONSTANT_AUDIT) {
    const runtimeValue = snapshot[entry.name];
    if (runtimeValue !== entry.value) {
      failures.push(`audit:${entry.name}:value-mismatch`);
    }
  }

  if (snapshot.FRACUNIT !== 1 << snapshot.FRACBITS) {
    failures.push('derived:FRACUNIT_EQUALS_ONE_SHIFTED_BY_FRACBITS');
  }

  if (!(snapshot.FRACUNIT > 0 && (snapshot.FRACUNIT & (snapshot.FRACUNIT - 1)) === 0)) {
    failures.push('derived:FRACUNIT_IS_POWER_OF_TWO');
  }

  if (snapshot.FIXED_MAX !== 0x7fff_ffff) {
    failures.push('derived:FIXED_MAX_IS_INT32_MAX');
  }

  if (snapshot.FIXED_MIN !== -0x8000_0000) {
    failures.push('derived:FIXED_MIN_IS_INT32_MIN');
  }

  if (snapshot.FIXED_MAX - snapshot.FIXED_MIN + 1 !== 2 ** 32) {
    failures.push('derived:FIXED_RANGE_SPANS_2_TO_32');
  }

  if (snapshot.FIXED_MAX >> snapshot.FRACBITS !== 32_767) {
    failures.push('derived:FIXED_MAX_INTEGER_PART_IS_INT16_MAX');
  }

  if (snapshot.FIXED_MIN >> snapshot.FRACBITS !== -32_768) {
    failures.push('derived:FIXED_MIN_INTEGER_PART_IS_INT16_MIN');
  }

  if ((snapshot.FIXED_MAX & (snapshot.FRACUNIT - 1)) !== 0xffff) {
    failures.push('derived:FIXED_MAX_FRACTIONAL_PART_IS_SATURATED');
  }

  if ((snapshot.FIXED_MIN & (snapshot.FRACUNIT - 1)) !== 0) {
    failures.push('derived:FIXED_MIN_FRACTIONAL_PART_IS_ZERO');
  }

  if (((snapshot.FIXED_MAX + 1) | 0) !== snapshot.FIXED_MIN) {
    failures.push('derived:INT32_WRAP_AROUND_FROM_MAX_TO_MIN');
  }

  if (((snapshot.FIXED_MIN - 1) | 0) !== snapshot.FIXED_MAX) {
    failures.push('derived:INT32_WRAP_AROUND_FROM_MIN_TO_MAX');
  }

  return failures;
}
