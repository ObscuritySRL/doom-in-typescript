/**
 * Vanilla DOOM 1.9 demo-lump playback wiring facade.
 *
 * Plan_final step `12-006` (lane: save-config-demo) wires DEMO lump
 * playback from the title attract loop and the `-playdemo`
 * command-line path through the runtime ticcmd stream, over the
 * read-only `src/demo/demoParse.ts` and `src/demo/demoPlayback.ts`
 * modules.
 *
 * Those modules already implement the byte-exact `G_DoPlayDemo` /
 * `G_ReadDemoTiccmd` / `G_CheckDemoStatus` behavior from Chocolate
 * Doom 2.2.1 and are SHA-pinned by the inventory; this module does
 * NOT modify them. It is a pure re-export barrel (value/type split
 * for `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest. Only the two read-only playback modules are
 * surfaced; the `demoFile` / `demoRecord` constants stay behind the
 * RNG/record facades so the demo-stream surface is not duplicated.
 *
 * Five parity invariants this step pins:
 *
 *   1. `parseDemo` dispatches the header flavor from the first byte
 *      exactly like `G_DoPlayDemo`: a leading byte `<=`
 *      `DEMO_OLD_FORMAT_MAX_SKILL` (4) is a pre-v1.4 no-version
 *      demo, `DEMO_LONG_TICS_VERSION` (111) is the longtics format,
 *      and anything else is a versioned vanilla demo.
 *   2. The shareware `DOOM1.WAD` attract-loop DEMO lumps are
 *      `DEMO_VANILLA_VERSION_19` (109) with a
 *      `DEMO_VANILLA_HEADER_SIZE` (13) byte header,
 *      `DEMO_VANILLA_COMMAND_SIZE` (4) byte per-player ticcmds, and
 *      a `DEMO_END_MARKER` (`0x80`) terminator.
 *   3. `DemoPlayback.readNextTic()` yields one tic's active-player
 *      ticcmd array per call in `playeringame[]` index order, which
 *      is the runtime ticcmd source for both the title attract loop
 *      and `-playdemo`.
 *   4. The final real tic is returned normally; `readNextTic()`
 *      returns `null` only on the read that crosses the
 *      `DEMO_END_MARKER` boundary, preserving `G_ReadDemoTiccmd`
 *      marker timing with no off-by-one.
 *   5. On completion `DemoPlayback` runs `G_CheckDemoStatus`:
 *      `completionAction` is `quit` for the `-playdemo` /
 *      `singledemo` path and `advance-demo` for the title attract
 *      loop, and the net / deathmatch / monster-flag state resets
 *      to `0`.
 *
 * @example
 * ```ts
 * import { DemoPlayback, parseDemo, VANILLA_DEMO_PLAYBACK_INVARIANTS } from './wireDemoPlaybackRuntime.ts';
 * const demoBytes = await Bun.file('DEMO1.lmp').bytes().then(Buffer.from);
 * parseDemo(demoBytes).format;                       // 'vanilla'
 * const playback = new DemoPlayback(demoBytes);
 * playback.readNextTic();                            // first tic's ticcmds
 * VANILLA_DEMO_PLAYBACK_INVARIANTS.length;           // 5
 * ```
 */

export {
  DEMO_END_MARKER,
  DEMO_LONG_TICS_COMMAND_SIZE,
  DEMO_LONG_TICS_VERSION,
  DEMO_MAX_PLAYERS,
  DEMO_OLD_FORMAT_HEADER_SIZE,
  DEMO_OLD_FORMAT_MAX_SKILL,
  DEMO_TIC_RATE,
  DEMO_VANILLA_COMMAND_SIZE,
  DEMO_VANILLA_HEADER_SIZE,
  DEMO_VANILLA_VERSION_19,
  parseDemo,
} from '../demo/demoParse.ts';
export type { DemoFormat, DemoTicCommand, ParsedDemo } from '../demo/demoParse.ts';
export { DEMO_PLAYBACK_DEFAULT_VERSION, DemoPlayback } from '../demo/demoPlayback.ts';
export type { DemoPlaybackCompletionAction, DemoPlaybackOptions, DemoPlaybackSnapshot } from '../demo/demoPlayback.ts';

/**
 * One pinned demo-playback parity invariant.
 */
export interface VanillaDemoPlaybackInvariant {
  readonly id:
    | 'COMPLETION_ACTION_IS_QUIT_FOR_SINGLEDEMO_ELSE_ADVANCE'
    | 'DEMO_HEADER_FORMAT_DISPATCHES_ON_FIRST_BYTE'
    | 'MARKER_TIMING_RETURNS_FINAL_TIC_BEFORE_COMPLETION'
    | 'READNEXTTIC_YIELDS_ONE_TIC_PER_CALL_IN_PLAYER_ORDER'
    | 'SHAREWARE_ATTRACT_DEMOS_ARE_VANILLA_VERSION_19';
  readonly rule: string;
}

/**
 * Frozen manifest of the five demo-playback parity invariants this
 * step pins. A later step that drives the live attract loop or
 * `-playdemo` must preserve all five.
 */
export const VANILLA_DEMO_PLAYBACK_INVARIANTS: readonly VanillaDemoPlaybackInvariant[] = Object.freeze([
  Object.freeze({
    id: 'COMPLETION_ACTION_IS_QUIT_FOR_SINGLEDEMO_ELSE_ADVANCE',
    rule: 'On completion DemoPlayback runs G_CheckDemoStatus: completionAction is quit for the -playdemo / singledemo path and advance-demo for the title attract loop, and the net / deathmatch / monster-flag state resets to 0.',
  } satisfies VanillaDemoPlaybackInvariant),
  Object.freeze({
    id: 'DEMO_HEADER_FORMAT_DISPATCHES_ON_FIRST_BYTE',
    rule: 'parseDemo dispatches the header flavor from the first byte exactly like G_DoPlayDemo: a leading byte <= DEMO_OLD_FORMAT_MAX_SKILL = 4 is a pre-v1.4 no-version demo, DEMO_LONG_TICS_VERSION = 111 is the longtics format, and anything else is a versioned vanilla demo.',
  } satisfies VanillaDemoPlaybackInvariant),
  Object.freeze({
    id: 'MARKER_TIMING_RETURNS_FINAL_TIC_BEFORE_COMPLETION',
    rule: 'The final real tic is returned normally; readNextTic() returns null only on the read that crosses the DEMO_END_MARKER = 0x80 boundary, preserving G_ReadDemoTiccmd marker timing with no off-by-one.',
  } satisfies VanillaDemoPlaybackInvariant),
  Object.freeze({
    id: 'READNEXTTIC_YIELDS_ONE_TIC_PER_CALL_IN_PLAYER_ORDER',
    rule: 'DemoPlayback.readNextTic() yields one tic active-player ticcmd array per call in playeringame[] index order, which is the runtime ticcmd source for both the title attract loop and -playdemo.',
  } satisfies VanillaDemoPlaybackInvariant),
  Object.freeze({
    id: 'SHAREWARE_ATTRACT_DEMOS_ARE_VANILLA_VERSION_19',
    rule: 'The shareware DOOM1.WAD attract-loop DEMO lumps are DEMO_VANILLA_VERSION_19 = 109 with a DEMO_VANILLA_HEADER_SIZE = 13-byte header, DEMO_VANILLA_COMMAND_SIZE = 4-byte per-player ticcmds, and a DEMO_END_MARKER = 0x80 terminator.',
  } satisfies VanillaDemoPlaybackInvariant),
]);
