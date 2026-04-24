/**
 * TryRunTics equivalent for single-player Doom matching Chocolate Doom 2.2.1.
 *
 * Models the TryRunTics / NetUpdate cycle from d_loop.c (single-player path,
 * ticdup=1).  The {@link TicRunner} manages gametic/maketic counters and a
 * circular ticcmd buffer of depth {@link BACKUPTICS}.  Each call to
 * {@link TicRunner.tryRunTics}:
 *
 * 1. Calls {@link TicRunner.netUpdate} to build ticcmds for newly elapsed tics.
 * 2. Runs all available tics (maketic − gametic) by calling the ticker.
 *
 * @example
 * ```ts
 * import { TicRunner, BACKUPTICS } from "../src/bootstrap/tryRunTics.ts";
 * const runner = new TicRunner();
 * const ran = runner.tryRunTics(timeSource, callbacks);
 * ```
 */

import type { TicCommand } from '../input/ticcmd.ts';
import { EMPTY_TICCMD } from '../input/ticcmd.ts';

/**
 * Circular buffer depth for ticcmd storage.
 * Matches BACKUPTICS from Chocolate Doom 2.2.1 d_loop.h.
 */
export const BACKUPTICS = 12;

/**
 * Minimal time source for tic counting.
 *
 * Each call to {@link TicTimeSource.getTime} returns the current absolute
 * tic count since baseline.  The value may advance between successive calls
 * as real time passes, matching I_GetTime() / ticdup semantics in Chocolate
 * Doom.
 *
 * @example
 * ```ts
 * const source: TicTimeSource = { getTime: () => accumulator.totalTics };
 * ```
 */
export interface TicTimeSource {
  /** Return the current absolute tic count. */
  getTime(): number;
}

/**
 * Callbacks for the game systems orchestrated by TryRunTics.
 *
 * The {@link TicRunner} calls these in canonical order:
 * - During netUpdate: {@link startTic} then {@link buildTiccmd} per new tic.
 * - During tic execution: {@link advancedemo} check, then
 *   {@link doAdvanceDemo} if pending, then {@link ticker} per available tic.
 *
 * @example
 * ```ts
 * const callbacks: TicCallbacks = {
 *   startTic() { pump.drain(); },
 *   buildTiccmd() { return packTicCommand(0, 0, 0, 0, 0, 0); },
 *   ticker() { gTicker(); },
 *   get advancedemo() { return titleLoop.advancedemo; },
 *   doAdvanceDemo() { titleLoop.doAdvanceDemo(); },
 * };
 * ```
 */
export interface TicCallbacks {
  /** Process pending input events (I_StartTic + D_ProcessEvents). */
  startTic(): void;
  /** Build a ticcmd for the console player (G_BuildTiccmd). */
  buildTiccmd(): TicCommand;
  /** Run one game tic (M_Ticker + G_Ticker). */
  ticker(): void;
  /** Whether the demo/title loop advance is pending. */
  readonly advancedemo: boolean;
  /** Advance the demo/title loop (D_DoAdvanceDemo). */
  doAdvanceDemo(): void;
}

/**
 * TryRunTics equivalent for single-player Doom.
 *
 * Manages the gametic/maketic counters and the per-player ticcmd circular
 * buffer, orchestrating the build-then-run tic loop from Chocolate Doom
 * 2.2.1 d_loop.c (single-player path, ticdup=1).
 *
 * Lifecycle:
 * 1. Construct a runner.
 * 2. Each frame, call {@link tryRunTics} with a time source and callbacks.
 * 3. The runner builds ticcmds for any newly elapsed tics, then runs all
 *    available tics.
 *
 * @example
 * ```ts
 * import { TicRunner } from "../src/bootstrap/tryRunTics.ts";
 * const runner = new TicRunner();
 * const ran = runner.tryRunTics(timeSource, callbacks);
 * ```
 */
export class TicRunner {
  #gametic = 0;
  #lasttime = 0;
  #maketic = 0;
  readonly #netcmds: TicCommand[];

  constructor() {
    this.#netcmds = [];
    for (let i = 0; i < BACKUPTICS; i++) {
      this.#netcmds[i] = EMPTY_TICCMD;
    }
  }

  /** Current game tic: number of tics fully executed. */
  get gametic(): number {
    return this.#gametic;
  }

  /** Last sampled time from the time source (diagnostic / testing). */
  get lasttime(): number {
    return this.#lasttime;
  }

  /** Next tic to be built: number of ticcmds stored so far. */
  get maketic(): number {
    return this.#maketic;
  }

  /**
   * Read the ticcmd stored for a given tic from the circular buffer.
   *
   * @param tic - Absolute tic number; reduced modulo {@link BACKUPTICS}.
   * @returns The stored {@link TicCommand}.
   */
  getNetcmd(tic: number): TicCommand {
    return this.#netcmds[tic % BACKUPTICS];
  }

  /**
   * NetUpdate equivalent (single-player path).
   *
   * Samples the time source, computes how many new tics have elapsed,
   * and for each new tic: processes input via {@link TicCallbacks.startTic}
   * and builds a ticcmd via {@link TicCallbacks.buildTiccmd}.  Stops early
   * if the circular buffer would overflow
   * (maketic − gametic >= {@link BACKUPTICS}).
   *
   * @param timeSource - Provides the current absolute tic count.
   * @param callbacks  - Game system hooks.
   */
  netUpdate(timeSource: TicTimeSource, callbacks: TicCallbacks): void {
    const nowtime = timeSource.getTime();
    const newtics = nowtime - this.#lasttime;
    this.#lasttime = nowtime;

    if (newtics <= 0) return;

    for (let i = 0; i < newtics; i++) {
      callbacks.startTic();
      if (this.#maketic - this.#gametic >= BACKUPTICS) break;
      this.#netcmds[this.#maketic % BACKUPTICS] = callbacks.buildTiccmd();
      this.#maketic++;
    }
  }

  /**
   * TryRunTics equivalent (single-player path, ticdup=1).
   *
   * Builds ticcmds for any newly elapsed tics via {@link netUpdate}, then
   * runs all available tics.  For each available tic:
   * 1. If {@link TicCallbacks.advancedemo} is true, calls
   *    {@link TicCallbacks.doAdvanceDemo}.
   * 2. Calls {@link TicCallbacks.ticker}.
   * 3. Increments gametic.
   *
   * @param timeSource - Provides the current absolute tic count.
   * @param callbacks  - Game system hooks.
   * @returns Number of tics executed this call.
   */
  tryRunTics(timeSource: TicTimeSource, callbacks: TicCallbacks): number {
    this.netUpdate(timeSource, callbacks);

    const availabletics = this.#maketic - this.#gametic;
    let counts = availabletics;

    while (counts > 0) {
      if (callbacks.advancedemo) {
        callbacks.doAdvanceDemo();
      }
      callbacks.ticker();
      this.#gametic++;
      counts--;
    }

    return availabletics;
  }
}
