/**
 * Manual A/B gate policy for oracle parity verification.
 *
 * Defines the gate vocabulary, verdict types, entry structure, and
 * payload shape for human-verified parity checkpoints.  Manual gates
 * cover perceptual and behavioral aspects that automated oracle
 * comparison cannot fully evaluate: visual appearance, audible
 * quality, input responsiveness, timing smoothness, and title/demo
 * loop behavioral correctness.
 *
 * Each gate has a domain (what category of parity it covers), a
 * verdict (pass / fail / inconclusive), and free-text notes for
 * the observer.  Gate results are collected into a payload alongside
 * the run mode and observer metadata.
 *
 * @example
 * ```ts
 * import { MANUAL_GATE_DOMAINS, MANUAL_GATE_VERDICTS } from "../src/oracles/manualGatePolicy.ts";
 * console.log(MANUAL_GATE_DOMAINS[0]); // "audio"
 * ```
 */

import type { OracleArtifact } from './schema.ts';
import type { RunMode } from './referenceRunManifest.ts';

/**
 * Category of parity that a manual gate evaluates.
 *
 * - `audio`: Sound effect audible quality and mix correctness.
 * - `input`: Keyboard and mouse responsiveness and feel.
 * - `music`: Music playback quality and track transitions.
 * - `timing`: Game speed, tic rate smoothness, and frame pacing.
 * - `title-loop`: Title/demo attract loop behavioral correctness.
 * - `visual`: Rendered output appearance and palette accuracy.
 */
export type ManualGateDomain = 'audio' | 'input' | 'music' | 'timing' | 'title-loop' | 'visual';

/**
 * Frozen, ASCIIbetically sorted list of every valid manual gate domain.
 *
 * The six domains partition the perceptual and behavioral surface
 * that cannot be fully evaluated by automated hash comparison.
 */
export const MANUAL_GATE_DOMAINS: readonly ManualGateDomain[] = Object.freeze(['audio', 'input', 'music', 'timing', 'title-loop', 'visual'] as const);

/**
 * Outcome of a manual gate evaluation.
 *
 * - `fail`: The observer determined the reimplementation does not
 *   match the reference behavior in this domain.
 * - `inconclusive`: The observer could not determine parity with
 *   confidence (e.g. insufficient observation time, ambiguous
 *   reference behavior, environmental interference).
 * - `pass`: The observer confirmed the reimplementation matches
 *   the reference behavior in this domain.
 */
export type ManualGateVerdict = 'fail' | 'inconclusive' | 'pass';

/**
 * Frozen, ASCIIbetically sorted list of every valid manual gate verdict.
 *
 * Three outcomes cover the complete decision space: confirmed match,
 * confirmed mismatch, or unable to determine.
 */
export const MANUAL_GATE_VERDICTS: readonly ManualGateVerdict[] = Object.freeze(['fail', 'inconclusive', 'pass'] as const);

/**
 * A single manual gate evaluation result.
 *
 * Each entry records an observer's verdict for one parity domain
 * at a specific point in time.  The description explains what
 * specific behavior was checked, and the notes field captures
 * free-text observations for traceability.
 */
export interface ManualGateEntry {
  /** Parity domain this gate evaluates. */
  readonly domain: ManualGateDomain;
  /** Human-readable description of the specific check performed. */
  readonly description: string;
  /** Observer's parity verdict. */
  readonly verdict: ManualGateVerdict;
  /** Free-text observation notes (empty string if none). */
  readonly notes: string;
  /** ISO-8601 date-time string when the observer recorded this verdict. */
  readonly evaluatedAt: string;
}

/**
 * Payload for a manual-gate oracle artifact.
 *
 * Collects all gate evaluation results for a single reference run
 * comparison.  Entries are ordered by domain (ASCIIbetically), then
 * by evaluatedAt within each domain.  The observer field identifies
 * who performed the evaluation for accountability.
 */
export interface ManualGatePayload {
  /** Human-readable description of what this gate set verifies. */
  readonly description: string;
  /** Which run mode this gate set was evaluated against. */
  readonly targetRunMode: RunMode;
  /** Tic rate in Hz; must match the reference target (35). */
  readonly ticRateHz: number;
  /** Identifier of the observer who performed the evaluation. */
  readonly observer: string;
  /** Ordered sequence of gate evaluation results. */
  readonly entries: readonly ManualGateEntry[];
}

/** Type alias for a complete manual-gate oracle artifact. */
export type ManualGateArtifact = OracleArtifact<ManualGatePayload>;

/**
 * Frozen empty manual gate payload for title-loop evaluations where
 * no gate checks have been recorded yet.  Used as a template before
 * an observer populates entries.
 */
export const EMPTY_TITLE_LOOP_MANUAL_GATE: ManualGatePayload = Object.freeze({
  description: 'Empty manual gate template for title/demo attract loop evaluation',
  targetRunMode: 'title-loop',
  ticRateHz: 35,
  observer: '',
  entries: Object.freeze([]),
} satisfies ManualGatePayload);

/**
 * Frozen empty manual gate payload for demo-playback evaluations where
 * no gate checks have been recorded yet.  Used as a template before
 * an observer populates entries.
 */
export const EMPTY_DEMO_PLAYBACK_MANUAL_GATE: ManualGatePayload = Object.freeze({
  description: 'Empty manual gate template for demo playback evaluation',
  targetRunMode: 'demo-playback',
  ticRateHz: 35,
  observer: '',
  entries: Object.freeze([]),
} satisfies ManualGatePayload);

/**
 * Policy: the minimum set of gate domains required for a run mode
 * evaluation to be considered complete.
 *
 * Title-loop runs require all 6 domains because the attract loop
 * exercises every observable subsystem.  Demo-playback runs require
 * 4 domains (audio, music, timing, visual) because the input is
 * scripted and the title-loop state machine is not exercised.
 */
export const REQUIRED_DOMAINS_BY_RUN_MODE: Readonly<Record<RunMode, readonly ManualGateDomain[]>> = Object.freeze({
  'demo-playback': Object.freeze(['audio', 'music', 'timing', 'visual'] as const),
  'title-loop': Object.freeze(['audio', 'input', 'music', 'timing', 'title-loop', 'visual'] as const),
});

/**
 * Check whether a manual gate payload covers all required domains
 * for its target run mode with a passing verdict.
 *
 * Returns `true` only when every required domain has at least one
 * entry with a `"pass"` verdict.  Entries with `"fail"` or
 * `"inconclusive"` verdicts do not satisfy the requirement.
 *
 * @param payload - The manual gate payload to evaluate.
 * @returns `true` if all required domains have a passing entry.
 *
 * @example
 * ```ts
 * import { isGateSetComplete, EMPTY_TITLE_LOOP_MANUAL_GATE } from "../src/oracles/manualGatePolicy.ts";
 * console.log(isGateSetComplete(EMPTY_TITLE_LOOP_MANUAL_GATE)); // false
 * ```
 */
export function isGateSetComplete(payload: ManualGatePayload): boolean {
  const requiredDomains = REQUIRED_DOMAINS_BY_RUN_MODE[payload.targetRunMode];
  const passingDomains = new Set<ManualGateDomain>();
  for (const entry of payload.entries) {
    if (entry.verdict === 'pass') {
      passingDomains.add(entry.domain);
    }
  }
  for (const domain of requiredDomains) {
    if (!passingDomains.has(domain)) {
      return false;
    }
  }
  return true;
}
