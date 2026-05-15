/**
 * Vanilla DOOM 1.9 RNG + demo-stream wiring facade.
 *
 * Plan_final step `04-006` (lane: runtime-core) wires the two
 * deterministic random streams (`P_Random` gameplay / `M_Random`
 * menu) and the demo ticcmd read/write path so a recorded demo
 * replays bit-for-bit, over the read-only `src/core/rng.ts` and the
 * `src/demo/` file / record / playback modules.
 *
 * Those modules already implement the byte-exact m_random.c LCG
 * (the 256-entry `rndtable`) and the g_game.c demo format, and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.  The shared `DEMO_*` constants are surfaced
 * from `demoFile.ts` only; the demoParse / compare-demo-N modules
 * are not re-exported (their `DEMO_END_MARKER` / `DEMO_MAX_PLAYERS`
 * / `DEMO_TIC_RATE` would duplicate demoFile's).
 *
 * Five parity invariants this step pins:
 *
 *   1. `RNG_TABLE` is the frozen 256-entry vanilla `rndtable`.
 *   2. `DoomRandom` is deterministic: two instances produce the
 *      identical `pRandom()` sequence with no seeding.
 *   3. `P_Random` (`prndindex`) and `M_Random` (`rndindex`) walk
 *      independent indices over the same table — calling `mRandom`
 *      never perturbs the `pRandom` sequence (no cross-stream
 *      drift), which is what keeps demos in sync.
 *   4. A demo ticcmd is `DEMO_TIC_SIZE` = 4 bytes; the header is
 *      `DEMO_HEADER_SIZE` = 13 bytes and the version is
 *      `DEMO_VERSION_19` = 109, terminated by `DEMO_END_MARKER`
 *      = `0x80`.
 *   5. `DemoRecorder` writes and `DemoPlayback` reads the same
 *      4-byte-per-tic stream at `DEMO_TIC_RATE` = 35 Hz for up to
 *      `DEMO_MAX_PLAYERS` = 4 players.
 *
 * @example
 * ```ts
 * import { DoomRandom, DEMO_TIC_SIZE, VANILLA_RNG_DEMO_INVARIANTS } from './wireRngAndDemoStreams.ts';
 * new DoomRandom().pRandom();                  // 0..255
 * DEMO_TIC_SIZE;                               // 4
 * VANILLA_RNG_DEMO_INVARIANTS.length;          // 5
 * ```
 */

export { DoomRandom, RNG_TABLE } from '../core/rng.ts';
export { DEMO_END_MARKER, DEMO_HEADER_SIZE, DEMO_MAX_PLAYERS, DEMO_TIC_RATE, DEMO_TIC_SIZE, DEMO_VERSION_19, parseDemoLump } from '../demo/demoFile.ts';
export type { DemoFile, DemoTicCommand } from '../demo/demoFile.ts';
export { DEMO_RECORD_DEFAULT_MAXIMUM_SIZE, DEMO_RECORD_WRITE_HEADROOM, DemoRecorder } from '../demo/demoRecord.ts';
export { DEMO_PLAYBACK_DEFAULT_VERSION, DemoPlayback } from '../demo/demoPlayback.ts';

/**
 * One pinned RNG / demo-stream parity invariant.
 */
export interface VanillaRngDemoInvariant {
  readonly id: 'DEMO_RECORD_AND_PLAYBACK_SHARE_4_BYTE_TIC_STREAM' | 'DEMO_TICCMD_HEADER_AND_VERSION_ARE_VANILLA' | 'DOOMRANDOM_IS_DETERMINISTIC_WITHOUT_SEED' | 'P_AND_M_RANDOM_ARE_INDEPENDENT_STREAMS' | 'RNG_TABLE_IS_256_FROZEN_ENTRIES';
  readonly rule: string;
}

/**
 * Frozen manifest of the five RNG / demo-stream parity invariants
 * this step pins.  A later step that wires the live demo loop must
 * preserve all five.
 */
export const VANILLA_RNG_DEMO_INVARIANTS: readonly VanillaRngDemoInvariant[] = Object.freeze([
  Object.freeze({
    id: 'DEMO_RECORD_AND_PLAYBACK_SHARE_4_BYTE_TIC_STREAM',
    rule: 'DemoRecorder writes and DemoPlayback reads the same DEMO_TIC_SIZE = 4-byte-per-tic stream at DEMO_TIC_RATE = 35 Hz for up to DEMO_MAX_PLAYERS = 4 players.',
  } satisfies VanillaRngDemoInvariant),
  Object.freeze({
    id: 'DEMO_TICCMD_HEADER_AND_VERSION_ARE_VANILLA',
    rule: 'A vanilla demo has a DEMO_HEADER_SIZE = 13-byte header, DEMO_VERSION_19 = 109, a DEMO_TIC_SIZE = 4-byte ticcmd, and a DEMO_END_MARKER = 0x80 terminator (parseDemoLump enforces this).',
  } satisfies VanillaRngDemoInvariant),
  Object.freeze({
    id: 'DOOMRANDOM_IS_DETERMINISTIC_WITHOUT_SEED',
    rule: 'DoomRandom needs no seed: two fresh instances produce the identical pRandom() sequence (the LCG walks the fixed rndtable from index 0), which is what makes a recorded demo replay bit-for-bit.',
  } satisfies VanillaRngDemoInvariant),
  Object.freeze({
    id: 'P_AND_M_RANDOM_ARE_INDEPENDENT_STREAMS',
    rule: 'P_Random (prndindex, gameplay) and M_Random (rndindex, menus) advance independent indices over the same RNG_TABLE; calling mRandom never perturbs the pRandom sequence, preventing cross-stream demo drift.',
  } satisfies VanillaRngDemoInvariant),
  Object.freeze({
    id: 'RNG_TABLE_IS_256_FROZEN_ENTRIES',
    rule: 'RNG_TABLE is the frozen 256-entry vanilla m_random.c rndtable; every entry is a 0..255 byte.',
  } satisfies VanillaRngDemoInvariant),
]);
