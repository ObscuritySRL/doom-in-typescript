/**
 * Title and demo attract-loop state machine matching Chocolate Doom 2.2.1.
 *
 * Models the D_DoAdvanceDemo / D_PageTicker / D_AdvanceDemo cycle from
 * d_main.c.  The state machine cycles through 6 states (modulo 6) that
 * alternate between full-screen page displays and demo playbacks.
 *
 * @example
 * ```ts
 * import { TitleLoop } from "../src/bootstrap/titleLoop.ts";
 * const loop = new TitleLoop("shareware");
 * const action = loop.doAdvanceDemo(); // TITLEPIC page
 * ```
 */

import type { GameMode } from './gameMode.ts';

/** Number of states in one full title/demo cycle. */
export const CYCLE_LENGTH = 6;

/**
 * Pagetic value for TITLEPIC in commercial mode (35 * 11 = 385).
 * Commercial Doom II shows the title screen longer than Doom 1.
 */
export const COMMERCIAL_TITLEPIC_PAGETIC = 385;

/** Pagetic value for CREDIT and HELP2 interlude pages. */
export const INTERLUDE_PAGETIC = 200;

/** Pagetic value for TITLEPIC in non-commercial modes. */
export const TITLEPIC_PAGETIC = 170;

/** Action returned when D_DoAdvanceDemo starts a demo playback. */
export interface DemoAction {
  readonly demoLump: string;
  readonly kind: 'demo';
}

/** Action returned when D_DoAdvanceDemo sets a full-screen page. */
export interface PageAction {
  readonly kind: 'page';
  readonly lumpName: string;
  readonly musicLump: string | null;
  readonly pagetic: number;
}

/**
 * Action produced by {@link TitleLoop.doAdvanceDemo}.
 *
 * - `"page"`: caller should set the full-screen page graphic and optionally
 *   start music (when `musicLump` is non-null).
 * - `"demo"`: caller should begin deferred demo playback of the named lump.
 */
export type AdvanceAction = DemoAction | PageAction;

/**
 * Title and demo attract-loop state machine.
 *
 * Faithfully reproduces the D_DoAdvanceDemo state table from Chocolate
 * Doom 2.2.1 d_main.c.  The cycle length is always 6 regardless of game
 * mode; only the page graphics and music differ between modes.
 *
 * Lifecycle:
 * 1. Construct with a {@link GameMode}.  The initial state mirrors
 *    `demosequence = -1; D_AdvanceDemo();` from D_DoomMain.
 * 2. Call {@link doAdvanceDemo} once per loop iteration when
 *    {@link advancedemo} is true.
 * 3. For page states, call {@link pageTicker} once per game tic;
 *    it will set {@link advancedemo} when the page expires.
 * 4. For demo states, call {@link requestAdvance} when the demo ends.
 */
export class TitleLoop {
  #advancedemo: boolean;
  #demosequence: number;
  readonly #gameMode: GameMode;
  #pagename: string;
  #pagetic: number;

  constructor(gameMode: GameMode) {
    this.#gameMode = gameMode;
    this.#demosequence = -1;
    this.#pagetic = 0;
    this.#pagename = '';
    this.#advancedemo = true;
  }

  /** Whether an advance has been requested and is pending. */
  get advancedemo(): boolean {
    return this.#advancedemo;
  }

  /** Current position in the 6-state cycle (0–5, or -1 before first advance). */
  get demosequence(): number {
    return this.#demosequence;
  }

  /** The {@link GameMode} this loop was constructed with. */
  get gameMode(): GameMode {
    return this.#gameMode;
  }

  /** Current page lump name (only meaningful during page states). */
  get pagename(): string {
    return this.#pagename;
  }

  /** Remaining tics for the current page display. */
  get pagetic(): number {
    return this.#pagetic;
  }

  /**
   * D_DoAdvanceDemo equivalent.
   *
   * Advances the state machine if {@link advancedemo} is true.  Returns
   * the action the caller should perform, or `null` if no advance was
   * pending.
   */
  doAdvanceDemo(): AdvanceAction | null {
    if (!this.#advancedemo) {
      return null;
    }

    this.#advancedemo = false;
    this.#demosequence = (this.#demosequence + 1) % CYCLE_LENGTH;

    switch (this.#demosequence) {
      case 0: {
        this.#pagetic = this.#gameMode === 'commercial' ? COMMERCIAL_TITLEPIC_PAGETIC : TITLEPIC_PAGETIC;
        this.#pagename = 'TITLEPIC';
        const musicLump = this.#gameMode === 'commercial' ? 'D_DM2TTL' : 'D_INTRO';
        return Object.freeze({
          kind: 'page',
          lumpName: 'TITLEPIC',
          musicLump,
          pagetic: this.#pagetic,
        });
      }
      case 1:
        return Object.freeze({ demoLump: 'DEMO1', kind: 'demo' });
      case 2:
        this.#pagetic = INTERLUDE_PAGETIC;
        this.#pagename = 'CREDIT';
        return Object.freeze({
          kind: 'page',
          lumpName: 'CREDIT',
          musicLump: null,
          pagetic: INTERLUDE_PAGETIC,
        });
      case 3:
        return Object.freeze({ demoLump: 'DEMO2', kind: 'demo' });
      case 4: {
        this.#pagetic = INTERLUDE_PAGETIC;
        if (this.#gameMode === 'commercial') {
          this.#pagename = 'TITLEPIC';
          return Object.freeze({
            kind: 'page',
            lumpName: 'TITLEPIC',
            musicLump: 'D_DM2TTL',
            pagetic: INTERLUDE_PAGETIC,
          });
        }
        const lumpName = this.#gameMode === 'retail' ? 'CREDIT' : 'HELP2';
        this.#pagename = lumpName;
        return Object.freeze({
          kind: 'page',
          lumpName,
          musicLump: null,
          pagetic: INTERLUDE_PAGETIC,
        });
      }
      case 5:
        return Object.freeze({ demoLump: 'DEMO3', kind: 'demo' });
      default:
        return null;
    }
  }

  /**
   * D_PageTicker equivalent.
   *
   * Decrements {@link pagetic} by one.  When pagetic falls below zero,
   * sets {@link advancedemo} to request the next state transition.
   * Call this once per game tic while in a page-display state.
   */
  pageTicker(): void {
    if (--this.#pagetic < 0) {
      this.#advancedemo = true;
    }
  }

  /**
   * D_AdvanceDemo equivalent.
   *
   * Requests an advance to the next state.  Used externally when a demo
   * playback completes or the player presses a key to skip.
   */
  requestAdvance(): void {
    this.#advancedemo = true;
  }
}
