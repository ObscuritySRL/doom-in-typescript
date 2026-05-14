/**
 * Vanilla DOOM 1.9 music / OPL parity gate contract.
 *
 * The music-OPL parity gate confirms that every MUS-driven OPL
 * synthesis emission across the canonical oracle windows (11-029)
 * matches a pre-recorded local Chocolate Doom reference run.  Unlike
 * the SFX parity gate (11-030) which hashes mixed PCM buffers, the
 * music gate compares EVENT STREAMS — pinned MUS events emitted to
 * the OPL register space — because OPL synthesis itself is
 * platform-dependent (DOSBox vs. host integer rounding).
 *
 * Gate compose:
 *   - 11-014 MUS event stream parser
 *   - 11-015 MUS scheduler
 *   - 11-016 MUS looping
 *   - 11-017 music selection by map and game mode
 *   - 11-018 music pause / resume
 *   - 11-019 OPL register model
 *   - 11-020 OPL instrument mapping (GENMIDI)
 *   - 11-021 OPL synthesis core
 *   - 11-027 music-event-log hook
 *   - 11-029 music-event oracle windows
 *
 * Parity-critical invariants pinned here:
 *
 *   1. The gate operates on MUS EVENT LOG entries (timestamp,
 *      event type, channel, parameters), NOT on synthesized PCM.
 *      OPL waveform output is not bit-comparable across host int
 *      precision; the event stream IS.
 *   2. Each oracle window is identified by a stable name and a
 *      tic range.  Vanilla scope is shareware DOOM1.WAD music
 *      lumps: D_E1M1, D_INTROA, D_VICTOR plus the title-screen
 *      D_INTRO loop.
 *   3. Event types compared: NOTE_ON, NOTE_OFF, PITCH_BEND,
 *      CHANGE_CONTROLLER, SYSTEM_EVENT, SCORE_END (5 of 8 MUS
 *      event types — RELEASE_KEY and TICK are decoded but not
 *      considered events for the gate).
 *   4. Allowable drift: ZERO event-stream divergence.  A single
 *      missing NOTE_OFF or an off-by-one tick would compound over
 *      a music loop into audibly drifting playback.
 *   5. Reference manifest path:
 *      `test/oracles/fixtures/audio/music-opl-windows.json` per
 *      CLAUDE.md oracle policy.  Production code never reads
 *      this file; only the gate test does.
 *   6. The gate is GREEN-LIGHT only — it does not gate other
 *      audio steps' completion, but it is a Phase 13 acceptance
 *      gate prereq.  A failure here blocks 13-001, 13-002, 13-003.
 */

/** Gate identifier — matches the step id. */
export const VANILLA_MUSIC_OPL_PARITY_GATE_ID = '11-031' as const;

/** Audio scope: this gate hashes MUS EVENT STREAMS, not synthesized PCM. */
export const VANILLA_MUSIC_OPL_PARITY_GATE_SCOPE: 'mus-event-stream' = 'mus-event-stream';

/** MUS event types that count as gate events (5 of 8 MUS types). */
export const VANILLA_MUSIC_OPL_PARITY_GATE_EVENT_TYPES = Object.freeze(['NOTE_ON', 'NOTE_OFF', 'PITCH_BEND', 'CHANGE_CONTROLLER', 'SYSTEM_EVENT', 'SCORE_END'] as const);

/** Shareware DOOM 1 music lumps covered by the gate windows. */
export const VANILLA_MUSIC_OPL_PARITY_GATE_LUMPS = Object.freeze(['D_INTRO', 'D_INTROA', 'D_VICTOR', 'D_E1M1'] as const);

/** Allowable event-stream drift: zero (strict equality). */
export const VANILLA_MUSIC_OPL_PARITY_GATE_ALLOWABLE_DRIFT = 0;

/** Reference fixture path. */
export const VANILLA_MUSIC_OPL_PARITY_GATE_FIXTURE_PATH = 'test/oracles/fixtures/audio/music-opl-windows.json';

/** Phase 13 acceptance-gate prerequisites that depend on this gate. */
export const VANILLA_MUSIC_OPL_PARITY_GATE_BLOCKS = Object.freeze(['13-001', '13-002', '13-003'] as const);

/** Step IDs this gate composes. */
export const VANILLA_MUSIC_OPL_PARITY_GATE_COMPOSES = Object.freeze(['11-014', '11-015', '11-016', '11-017', '11-018', '11-019', '11-020', '11-021', '11-027', '11-029'] as const);

/**
 * Validate that a music-OPL parity check has zero event-stream
 * divergence.  Returns `true` only when `divergenceCount === 0`.
 * Throws on negative or non-integer counts.
 */
export function vanillaMusicOplParityCheckPasses(divergenceCount: number): boolean {
  if (!Number.isInteger(divergenceCount) || divergenceCount < 0) {
    throw new RangeError(`vanillaMusicOplParityCheckPasses: divergenceCount must be a non-negative integer, got ${divergenceCount}`);
  }
  return divergenceCount === VANILLA_MUSIC_OPL_PARITY_GATE_ALLOWABLE_DRIFT;
}

/**
 * Test whether a MUS event type is included in the gate comparison.
 * Mirrors the 5-of-8 selection above.
 */
export function vanillaMusicOplParityEventIsGated(eventType: string): boolean {
  return (VANILLA_MUSIC_OPL_PARITY_GATE_EVENT_TYPES as readonly string[]).includes(eventType);
}
