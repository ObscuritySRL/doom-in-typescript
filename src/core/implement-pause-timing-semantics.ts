/**
 * Vanilla Chocolate Doom 2.2.1 pause timing semantics.
 *
 * When `paused = true`, P_Ticker still runs but advances thinkers only when
 * `paused` is false at the start of the tic. The pause key (default PAUSE,
 * scancode 69) toggles `paused` immediately at responder time. Music is muted
 * via S_PauseSound on pause and resumed via S_ResumeSound on unpause. Save and
 * load are explicitly permitted while paused; menus open without unpausing.
 */

export interface PauseInput {
  readonly keyScanCode: number;
  readonly currentPaused: boolean;
}

export const VANILLA_PAUSE_SCANCODE = 69;
export const VANILLA_PAUSE_MUTES_SFX = true;
export const VANILLA_PAUSE_MUTES_MUSIC = true;
export const VANILLA_PAUSE_BLOCKS_THINKERS = true;
export const VANILLA_PAUSE_BLOCKS_AUTOMAP_REDRAW = false;
export const VANILLA_PAUSE_ALLOWS_SAVE_LOAD = true;

export function decidePauseToggle(input: PauseInput): boolean {
  if (input.keyScanCode === VANILLA_PAUSE_SCANCODE) {
    return !input.currentPaused;
  }
  return input.currentPaused;
}

export interface PausedTicInput {
  readonly paused: boolean;
}

export interface PausedTicDecision {
  readonly runsThinkers: boolean;
  readonly runsAutomapAnimation: boolean;
  readonly playsSound: boolean;
}

export function evaluatePausedTic(input: PausedTicInput): PausedTicDecision {
  return Object.freeze({
    runsThinkers: !input.paused,
    runsAutomapAnimation: !input.paused || !VANILLA_PAUSE_BLOCKS_AUTOMAP_REDRAW,
    playsSound: !input.paused,
  });
}
