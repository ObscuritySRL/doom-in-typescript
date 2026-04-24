/**
 * Framebuffer hash format for oracle visual-parity verification.
 *
 * Defines the entry structure, payload shape, and dimension constants
 * for capturing deterministic framebuffer hashes at specific tic
 * intervals during oracle reference runs.  Each entry records a
 * SHA-256 hash of the raw 320x200 palette-indexed framebuffer and
 * the active PLAYPAL palette index at that tic.
 *
 * @example
 * ```ts
 * import { FRAMEBUFFER_WIDTH, FRAMEBUFFER_HEIGHT } from "../src/oracles/framebufferHash.ts";
 * console.log(FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT); // 64000
 * ```
 */

import type { OracleArtifact } from './schema.ts';
import type { RunMode } from './referenceRunManifest.ts';

/** Doom's fixed internal framebuffer width in pixels. */
export const FRAMEBUFFER_WIDTH = 320;

/** Doom's fixed internal framebuffer height in pixels. */
export const FRAMEBUFFER_HEIGHT = 200;

/**
 * Size of the raw framebuffer in bytes (one byte per pixel,
 * palette-indexed).  320 * 200 = 64000.
 */
export const FRAMEBUFFER_SIZE = FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT;

/**
 * Total number of palettes in PLAYPAL (F-027).
 *
 * Index 0 is normal, 1-8 are damage red, 9-12 are bonus pickup,
 * and 13 is radiation suit.
 */
export const PALETTE_COUNT = 14;

/**
 * Default sampling interval in tics between framebuffer hash captures.
 *
 * 35 tics equals exactly one second at the Doom tic rate (F-010).
 * Use 1 for frame-by-frame parity debugging.
 */
export const DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS = 35;

/**
 * A single framebuffer hash snapshot at a specific tic.
 *
 * The hash covers the raw 320x200 palette-indexed byte array
 * as produced by the renderer before any palette application,
 * aspect correction, or display scaling.  The palette index
 * records which PLAYPAL entry was active at capture time,
 * since two frames with identical pixel data but different
 * palette indices produce different visible output.
 */
export interface FramebufferHashEntry {
  /** Game tic number at which this snapshot was captured (0-based). */
  readonly tic: number;
  /** SHA-256 hash of the raw 320x200 framebuffer byte array. */
  readonly hash: string;
  /**
   * Active PLAYPAL palette index at capture time (0-13).
   *
   * 0 = normal, 1-8 = damage red, 9-12 = bonus pickup, 13 = radiation suit.
   */
  readonly paletteIndex: number;
}

/**
 * Payload for a framebuffer-hash oracle artifact.
 *
 * Entries must be sorted ascending by tic number.  Each entry
 * contains a SHA-256 hash of the raw palette-indexed framebuffer
 * and the active palette index for visual-parity comparison.
 * The sampling interval determines the tic spacing between captures;
 * entries at non-interval tics are permitted for targeted debugging.
 */
export interface FramebufferHashPayload {
  /** Human-readable description of what this framebuffer hash set verifies. */
  readonly description: string;
  /** Which run mode this framebuffer hash set was captured from. */
  readonly targetRunMode: RunMode;
  /**
   * Tic interval between regular hash captures.
   * Use DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS (35) for one-second resolution.
   * Use 1 for frame-by-frame debugging.
   */
  readonly samplingIntervalTics: number;
  /** Tic rate in Hz; must match the reference target (35). */
  readonly ticRateHz: number;
  /** Framebuffer width in pixels (always 320). */
  readonly width: number;
  /** Framebuffer height in pixels (always 200). */
  readonly height: number;
  /** Ordered sequence of framebuffer hash entries, sorted ascending by tic. */
  readonly entries: readonly FramebufferHashEntry[];
}

/** Type alias for a complete framebuffer-hash oracle artifact. */
export type FramebufferHashArtifact = OracleArtifact<FramebufferHashPayload>;

/**
 * Frozen empty framebuffer hash payload for title-loop captures where no
 * frame snapshots have been recorded yet.  Used as a template before
 * the reference capture populates entries.
 */
export const EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH: FramebufferHashPayload = Object.freeze({
  description: 'Empty framebuffer hash template for title/demo attract loop capture',
  targetRunMode: 'title-loop',
  samplingIntervalTics: DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS,
  ticRateHz: 35,
  width: FRAMEBUFFER_WIDTH,
  height: FRAMEBUFFER_HEIGHT,
  entries: Object.freeze([]),
} satisfies FramebufferHashPayload);

/**
 * Frozen empty framebuffer hash payload for demo-playback captures where no
 * frame snapshots have been recorded yet.  Used as a template before
 * the reference capture populates entries.
 */
export const EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH: FramebufferHashPayload = Object.freeze({
  description: 'Empty framebuffer hash template for demo playback capture',
  targetRunMode: 'demo-playback',
  samplingIntervalTics: DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS,
  ticRateHz: 35,
  width: FRAMEBUFFER_WIDTH,
  height: FRAMEBUFFER_HEIGHT,
  entries: Object.freeze([]),
} satisfies FramebufferHashPayload);
