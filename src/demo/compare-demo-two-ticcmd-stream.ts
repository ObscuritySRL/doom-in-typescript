/**
 * Vanilla DEMO2 ticcmd stream comparator.
 *
 * DEMO2 is the second attract-loop demo. Same byte-level format as DEMO1
 * (04-024), different expected map. Validates a candidate DEMO2 byte stream
 * against the vanilla DOOM 1.9 demo format and DEMO2 metadata.
 */

import { parseDemoHeader } from '../core/implement-demo-lump-header-parser.ts';
import { parseDemoTiccmdStream } from '../core/implement-demo-ticcmd-parser.ts';

export const VANILLA_DEMO2_EXPECTED_EPISODE = 1;
export const VANILLA_DEMO2_EXPECTED_VERSION = 109;
export const VANILLA_DEMO_HEADER_BYTES = 13;

export interface Demo2ComparisonInput {
  readonly demoBytes: Uint8Array;
  readonly expectedTicCount: number | null;
}

export type Demo2ComparisonViolation = 'header_parse_failed' | 'wrong_episode' | 'wrong_version' | 'tic_count_mismatch' | 'missing_terminator';

export interface Demo2ComparisonDecision {
  readonly accepted: boolean;
  readonly observedTicCount: number;
  readonly violations: readonly Demo2ComparisonViolation[];
}

export function compareDemo2(input: Demo2ComparisonInput): Demo2ComparisonDecision {
  const violations = new Set<Demo2ComparisonViolation>();
  const headerResult = parseDemoHeader(input.demoBytes);
  if (headerResult.header === null) {
    violations.add('header_parse_failed');
    return Object.freeze({
      accepted: false,
      observedTicCount: 0,
      violations: Object.freeze([...violations].sort()),
    });
  }
  if (headerResult.header.version !== VANILLA_DEMO2_EXPECTED_VERSION) {
    violations.add('wrong_version');
  }
  if (headerResult.header.episode !== VANILLA_DEMO2_EXPECTED_EPISODE) {
    violations.add('wrong_episode');
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
