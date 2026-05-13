/**
 * Vanilla Chocolate Doom 2.2.1 clean-launch-to-title-loop contract.
 *
 * A clean launch of doom/DOOM.EXE -iwad doom/DOOM1.WAD with no -file, -warp,
 * -loadgame, or -playdemo flags terminates after I_InitStretchTables by
 * entering the attract title loop: TITLEPIC for TITLETIME tics, then auto-play
 * DEMO1, then CREDIT for PAGETIME tics, then DEMO2, then TITLEPIC again, then
 * DEMO3, then loop. Pinned page durations match d_main.c::D_PageTicker.
 */

/** Time per attract loop page in tics (vanilla TITLETIME / PAGETIME). */
export const VANILLA_PAGE_TIME_TICS = 200;

/** Frozen attract loop sequence. */
export const VANILLA_ATTRACT_LOOP_SEQUENCE = Object.freeze(['titlepic', 'demo1', 'credit', 'demo2', 'titlepic', 'demo3'] as const);

export type AttractLoopPage = (typeof VANILLA_ATTRACT_LOOP_SEQUENCE)[number];

export interface CleanLaunchInput {
  readonly fileArg: string | null;
  readonly warpArg: string | null;
  readonly loadgameArg: string | null;
  readonly playdemoArg: string | null;
}

export type CleanLaunchOutcome = 'title-loop' | 'warped-into-map' | 'loaded-game' | 'played-demo';

export function decideLaunchOutcome(input: CleanLaunchInput): CleanLaunchOutcome {
  if (input.warpArg !== null) {
    return 'warped-into-map';
  }
  if (input.loadgameArg !== null) {
    return 'loaded-game';
  }
  if (input.playdemoArg !== null) {
    return 'played-demo';
  }
  return 'title-loop';
}
