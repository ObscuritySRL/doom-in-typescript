/**
 * Oracle schema definitions for the DOOM Codex project.
 *
 * Defines the type vocabulary shared by every oracle artifact, record,
 * and verification gate.  Phase-02 steps define concrete payloads;
 * this module provides the envelope and metadata contracts.
 *
 * @example
 * ```ts
 * import { ORACLE_KINDS, type OracleRecord } from "../src/oracles/schema.ts";
 * console.log(ORACLE_KINDS[0]); // "audio-hash"
 * ```
 */

/** Trust level assigned to an oracle artifact or record. */
export type OracleTrustLevel = 'high' | 'low' | 'medium' | 'unverified';

/** Frozen, ASCIIbetically sorted list of every valid trust level. */
export const ORACLE_TRUST_LEVELS: readonly OracleTrustLevel[] = Object.freeze(['high', 'low', 'medium', 'unverified'] as const);

/** Discriminant tag for the kind of oracle artifact. */
export type OracleKind =
  | 'audio-hash'
  | 'console-log'
  | 'file-hash-manifest'
  | 'framebuffer-hash'
  | 'input-script'
  | 'manual-gate'
  | 'music-event-log'
  | 'package-capability-matrix'
  | 'run-manifest'
  | 'source-catalog'
  | 'state-hash'
  | 'wad-directory-summary';

/** Frozen, ASCIIbetically sorted list of every valid oracle kind. */
export const ORACLE_KINDS: readonly OracleKind[] = Object.freeze([
  'audio-hash',
  'console-log',
  'file-hash-manifest',
  'framebuffer-hash',
  'input-script',
  'manual-gate',
  'music-event-log',
  'package-capability-matrix',
  'run-manifest',
  'source-catalog',
  'state-hash',
  'wad-directory-summary',
] as const);

/**
 * Metadata record for a single oracle entry, mirroring the structure
 * in `REFERENCE_ORACLES.md`.
 *
 * Each record describes *what* an oracle artifact is, *where* it lives,
 * and *who* consumes it — but not the artifact payload itself.
 */
export interface OracleRecord {
  /** Unique identifier, e.g. `"O-001"`. */
  readonly id: string;
  /** Human-readable oracle name, e.g. `"reference-file-hashes"`. */
  readonly oracle: string;
  /** Discriminant tag for the artifact format. */
  readonly kind: OracleKind;
  /** Source references that produced this oracle, e.g. `"S-001 through S-007"`. */
  readonly source: string;
  /** How the artifact was generated. */
  readonly generationMethod: string;
  /** Absolute or workspace-relative path to the artifact file. */
  readonly artifactPath: string;
  /** SHA-256 hash of the artifact, or a generation marker string. */
  readonly hash: string;
  /** Step IDs that consume this oracle. */
  readonly consumers: readonly string[];
  /** Confidence rating for this oracle's correctness. */
  readonly trustLevel: OracleTrustLevel;
}

/**
 * Versioned envelope that wraps every serialized oracle artifact on disk.
 *
 * Phase-02 format steps each define a concrete `TPayload` type.
 * The envelope carries provenance metadata so any artifact can be
 * validated independently of the oracle registry.
 *
 * @typeParam TPayload - The format-specific payload type.
 */
export interface OracleArtifact<TPayload = unknown> {
  /** Discriminant tag matching the artifact format. */
  readonly kind: OracleKind;
  /** Schema version for forward compatibility. Starts at `1`. */
  readonly version: number;
  /** ISO-8601 date string when the artifact was generated. */
  readonly generatedAt: string;
  /** SHA-256 hash of the primary input(s) used to produce this artifact. */
  readonly sourceHash: string;
  /** The format-specific content. */
  readonly payload: TPayload;
}
