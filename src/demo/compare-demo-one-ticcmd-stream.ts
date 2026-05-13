/**
 * Vanilla DEMO1 ticcmd stream comparator.
 *
 * Validates a candidate DEMO1 byte stream against the vanilla DOOM 1.9 demo
 * format: 13-byte header (parsed by 04-019) followed by N 4-byte ticcmds
 * (parsed by 04-020) terminated by 0x80. DEMO1 is the title-loop attract
 * playback of E1M5 (Romero's original recording).
 *
 * The comparator is data-only: it does not require DOOM1.WAD to be present.
 * Future captures populate the expected SHA-256 hash and tic count.
 */

import { parseDemoHeader } from '../core/implement-demo-lump-header-parser.ts';
import { parseDemoTiccmdStream } from '../core/implement-demo-ticcmd-parser.ts';

export const VANILLA_DEMO1_EXPECTED_EPISODE = 1;
export const VANILLA_DEMO1_EXPECTED_MAP = 5;
export const VANILLA_DEMO1_EXPECTED_VERSION = 109;
export const VANILLA_DEMO_HEADER_BYTES = 13;

export interface Demo1ComparisonInput {
  readonly demoBytes: Uint8Array;
  readonly expectedTicCount: number | null;
}

export type Demo1ComparisonViolation = 'header_parse_failed' | 'wrong_episode' | 'wrong_map' | 'wrong_version' | 'tic_count_mismatch' | 'missing_terminator';

export interface Demo1ComparisonDecision {
  readonly accepted: boolean;
  readonly observedTicCount: number;
  readonly violations: readonly Demo1ComparisonViolation[];
}

export function compareDemo1(input: Demo1ComparisonInput): Demo1ComparisonDecision {
  const violations = new Set<Demo1ComparisonViolation>();
  const headerResult = parseDemoHeader(input.demoBytes);
  if (headerResult.header === null) {
    violations.add('header_parse_failed');
    return Object.freeze({
      accepted: false,
      observedTicCount: 0,
      violations: Object.freeze([...violations].sort()),
    });
  }
  if (headerResult.header.version !== VANILLA_DEMO1_EXPECTED_VERSION) {
    violations.add('wrong_version');
  }
  if (headerResult.header.episode !== VANILLA_DEMO1_EXPECTED_EPISODE) {
    violations.add('wrong_episode');
  }
  if (headerResult.header.map !== VANILLA_DEMO1_EXPECTED_MAP) {
    violations.add('wrong_map');
  }
  const ticStream = parseDemoTiccmdStream(input.demoBytes, VANILLA_DEMO_HEADER_BYTES);
  if (!ticStream.endedAtTerminator) {
    violations.add('missing_terminator');
  }
  if (input.expectedTicCount !== null && ticStream.ticcmds.length !== input.expectedTicCount) {
    violations.add('tic_count_mismatch');
  }
  return Object.freeze({
    accepted: violations.size === 0,
    observedTicCount: ticStream.ticcmds.length,
    violations: Object.freeze([...violations].sort()),
  });
}
