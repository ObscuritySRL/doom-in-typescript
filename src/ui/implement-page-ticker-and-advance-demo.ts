/**
 * Vanilla DOOM 1.9 D_PageTicker and D_AdvanceDemo contracts.
 *
 * From Chocolate Doom 2.2.1 d_main.c:
 *
 *   void D_PageTicker(void)
 *   {
 *       if (--pagetic < 0)
 *           D_AdvanceDemo();
 *   }
 *
 *   void D_AdvanceDemo(void)
 *   {
 *       advancedemo = true;
 *   }
 *
 * Notes for parity:
 *   - The decrement is pre-decrement: pagetic is decremented FIRST, then compared to zero.
 *     The advance triggers when the pre-decremented pagetic is strictly less than 0,
 *     i.e. the page has been displayed for `initialPagetic + 1` tics before the advance fires.
 *   - D_AdvanceDemo is idempotent: it just sets advancedemo to true.
 *   - D_PageTicker only fires during page-display states (gamestate == GS_DEMOSCREEN);
 *     during demo playback the demo subsystem owns the advance trigger.
 */

export interface PageTickerInput {
  readonly pagetic: number;
}

export interface PageTickerResult {
  readonly pageticAfter: number;
  readonly advanceTriggered: boolean;
}

export function tickVanillaPagetic(input: PageTickerInput): PageTickerResult {
  const decremented = input.pagetic - 1;
  return Object.freeze({
    pageticAfter: decremented,
    advanceTriggered: decremented < 0,
  });
}

export interface AdvanceDemoState {
  readonly advancedemo: boolean;
}

export function requestVanillaAdvanceDemo(): AdvanceDemoState {
  return Object.freeze({ advancedemo: true });
}
