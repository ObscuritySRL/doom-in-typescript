/**
 * Vanilla DOOM 1.9 reference savegame byte oracle contract.
 *
 * The acceptance gate for save/load parity is byte-level equality
 * between the TypeScript implementation's output and a known-good
 * Chocolate Doom 2.2.1 `.dsg` file produced from a tightly-scoped
 * scenario (e.g. "E1M1, no enemies killed, leveltime=35 tics, default
 * inventory"). This module provides the comparison primitive that
 * the byte-parity tests use.
 *
 * Reference files live under `test/oracles/fixtures/savegames/`
 * (per CLAUDE.md: oracle artifacts must be under
 * `test/oracles/fixtures/`, `test/parity/fixtures/`, or
 * `plan_fps/manifests/`; NEVER inside `doom/`, `iwad/`, or
 * `reference/`).
 *
 * Parity-critical details:
 *   - Compare byte-by-byte with `===`. Vanilla writes raw fixed-width
 *     records; there is no checksum or alignment slack that could
 *     differ between identical states.
 *   - Lengths MUST match exactly. A trailing 0x00 byte difference is
 *     a real discrepancy (often missing PADSAVEP), not "close
 *     enough".
 *   - Hexdump diffs in the failure message should include the offset
 *     (so the developer can map it to a section: 0..49=header,
 *     50..1169=players, 1170..K=world, K..K+L=thinkers, etc.).
 *   - If the implementation emits MORE bytes than the reference, the
 *     diff reports the first divergent offset; the trailing extra is
 *     a separate failure mode caught by length mismatch.
 */

export interface VanillaSaveByteOracleDiff {
  readonly matches: boolean;
  readonly firstDivergentOffset: number;
  readonly expectedByte: number | null;
  readonly actualByte: number | null;
  readonly expectedLength: number;
  readonly actualLength: number;
}

export function compareVanillaSaveBytes(expected: Uint8Array, actual: Uint8Array): VanillaSaveByteOracleDiff {
  const minLength = Math.min(expected.length, actual.length);
  for (let i = 0; i < minLength; i++) {
    if (expected[i] !== actual[i]) {
      return Object.freeze({
        matches: false,
        firstDivergentOffset: i,
        expectedByte: expected[i] ?? null,
        actualByte: actual[i] ?? null,
        expectedLength: expected.length,
        actualLength: actual.length,
      });
    }
  }
  if (expected.length !== actual.length) {
    return Object.freeze({
      matches: false,
      firstDivergentOffset: minLength,
      expectedByte: expected[minLength] ?? null,
      actualByte: actual[minLength] ?? null,
      expectedLength: expected.length,
      actualLength: actual.length,
    });
  }
  return Object.freeze({
    matches: true,
    firstDivergentOffset: -1,
    expectedByte: null,
    actualByte: null,
    expectedLength: expected.length,
    actualLength: actual.length,
  });
}

export function describeVanillaSaveDiffSection(offset: number): string {
  if (offset < 0) return 'no-divergence';
  if (offset < 50) return `header[+${offset}]`;
  return `body[+${offset}]`;
}
