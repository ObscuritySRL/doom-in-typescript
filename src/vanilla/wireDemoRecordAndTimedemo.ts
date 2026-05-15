/**
 * Vanilla DOOM 1.9 demo record / playdemo / timedemo facade.
 *
 * Plan_final step `12-007` (lane: save-config-demo) wires the
 * `-record`, `-playdemo`, `-timedemo`, demo-termination, and
 * deterministic-output paths through one re-export barrel.  The
 * read-only `src/demo/demoRecord.ts` (G_BeginRecording /
 * G_WriteDemoTiccmd / G_CheckDemoStatus) and `src/demo/demoFile.ts`
 * (the demo-lump parser used by `-playdemo` / `-timedemo`) modules
 * already implement vanilla `g_game.c` demo behavior and are
 * SHA-pinned by the `plan_vanilla_parity` demo-and-replay
 * inventory; this module does NOT modify them.  Neither module
 * exports a `const enum`, so every value and structural type is
 * surfaced (values via `export`, types via `export type`) under
 * `verbatimModuleSyntax`.
 *
 * @example
 * ```ts
 * import { DemoRecorder, parseDemoLump, VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS } from './wireDemoRecordAndTimedemo.ts';
 * VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS.length; // 5
 * ```
 */

export { DEMO_RECORD_DEFAULT_MAXIMUM_SIZE, DEMO_RECORD_WRITE_HEADROOM, DemoRecorder } from '../demo/demoRecord.ts';
export type { DemoRecordCommand, DemoRecorderOptions } from '../demo/demoRecord.ts';
export { DEMO_END_MARKER, DEMO_HEADER_SIZE, DEMO_MAX_PLAYERS, DEMO_TIC_RATE, DEMO_TIC_SIZE, DEMO_VERSION_19, parseDemoLump } from '../demo/demoFile.ts';
export type { DemoFile, DemoTicCommand } from '../demo/demoFile.ts';

/** One pinned vanilla `g_game.c` demo record/playback invariant. */
export interface VanillaDemoRecordAndTimedemoInvariant {
  /** Stable ASCII-sortable identifier. */
  readonly id: string;
  /** Human-readable parity rule the demo path preserves. */
  readonly rule: string;
}

/**
 * Frozen manifest of the five parity rules the wired demo
 * record / playdemo / timedemo path preserves.  Ids are
 * ASCII-sorted.
 */
export const VANILLA_DEMO_RECORD_AND_TIMEDEMO_INVARIANTS: readonly VanillaDemoRecordAndTimedemoInvariant[] = Object.freeze([
  Object.freeze({
    id: 'DEMO_HEADER_IS_THIRTEEN_BYTES_FOR_VERSION_19',
    rule: 'A versioned (vanilla / longtics) demo header is DEMO_HEADER_SIZE (13) bytes with version byte DEMO_VERSION_19 (109); the legacy old format uses a 7-byte header. The header always encodes exactly DEMO_MAX_PLAYERS (4) playeringame slots.',
  }),
  Object.freeze({
    id: 'DETERMINISTIC_OUTPUT_REQUIRES_FROZEN_PLAYERSINGAME_AND_VANILLA_LIMIT',
    rule: 'The recorder freezes the playersInGame array, requires exactly DEMO_MAX_PLAYERS (4) slots with at least one active player (RangeError otherwise), and defaults vanillaDemoLimit true so the fixed-size DEMO_RECORD_DEFAULT_MAXIMUM_SIZE (0x20000) buffer produces byte-identical deterministic output.',
  }),
  Object.freeze({
    id: 'PLAYDEMO_PARSES_HEADER_THEN_TIC_STREAM_AT_35HZ',
    rule: 'parseDemoLump requires the lump to be at least DEMO_HEADER_SIZE (13) bytes, reads the nine header bytes plus the four playeringame flags, then DEMO_TIC_SIZE (4) byte tic commands per active player, and derives durationSeconds = ticCount / DEMO_TIC_RATE (35); the stream ends at DEMO_END_MARKER (0x80).',
  }),
  Object.freeze({
    id: 'RECORDER_STOPS_BEFORE_A_TIC_WITH_LESS_THAN_16_BYTES',
    rule: 'DemoRecorder honors DEMO_RECORD_WRITE_HEADROOM (16): recording stops before a tic is written whenever fewer than 16 bytes remain in the vanilla fixed buffer, matching G_CheckDemoStatus so a demo never overruns its -maxdemo allocation.',
  }),
  Object.freeze({
    id: 'RECORD_COMMAND_QUANTIZES_AND_RETURNS_NULL_ON_TERMINATION',
    rule: 'recordCommand quantizes the ticcmd to the active demo format (vanilla command size vs longtics) with the signed turn-carry, returns the written Readonly<DemoTicCommand>, and returns null once the demo has terminated (buffer exhausted or finish() already called).',
  }),
]);
