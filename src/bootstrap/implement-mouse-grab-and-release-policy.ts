/**
 * Vanilla Chocolate Doom 2.2.1 mouse grab and release policy.
 *
 * The grab decision is the conjunction of three conditions: grabmouse=1 in
 * chocolate-doom.cfg, the window is focused, and the window is visible (not
 * minimized). Any false breaks the grab and releases the OS cursor. The grab
 * also suppresses gameplay input from the mouse while the window is unfocused.
 */

/** chocolate-doom.cfg grabmouse default. */
export const VANILLA_GRABMOUSE_DEFAULT = 1;

/** Whether grab is conditional on focus. */
export const VANILLA_GRAB_REQUIRES_FOCUS = true;

/** Whether grab is conditional on visibility. */
export const VANILLA_GRAB_REQUIRES_VISIBILITY = true;

/** Whether unfocused windows release the cursor. */
export const VANILLA_UNFOCUSED_RELEASES_CURSOR = true;

/** Whether vanilla allows mouse-grab override via -nomouse command-line flag. */
export const VANILLA_NOMOUSE_FLAG_DISABLES_GRAB = true;

export interface GrabDecisionInput {
  readonly grabMouseEnabled: boolean;
  readonly windowFocused: boolean;
  readonly windowVisible: boolean;
  readonly nomouseFlagPresent: boolean;
}

export type GrabState = 'grabbed' | 'released';

export function decideMouseGrab(input: GrabDecisionInput): GrabState {
  if (input.nomouseFlagPresent) {
    return 'released';
  }
  if (!input.grabMouseEnabled) {
    return 'released';
  }
  if (!input.windowFocused) {
    return 'released';
  }
  if (!input.windowVisible) {
    return 'released';
  }
  return 'grabbed';
}
