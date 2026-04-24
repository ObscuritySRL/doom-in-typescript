/**
 * Input script format for oracle reference runs.
 *
 * Defines the event vocabulary and payload shape for scripted input
 * sequences used during deterministic oracle captures.  Input scripts
 * provide raw input events (keyboard scan codes, mouse deltas, mouse
 * buttons) at specific tic timestamps.  The reference executable
 * translates these into ticcmds internally.
 *
 * @example
 * ```ts
 * import { EMPTY_TITLE_LOOP_SCRIPT } from "../src/oracles/inputScript.ts";
 * console.log(EMPTY_TITLE_LOOP_SCRIPT.totalTics); // 0
 * ```
 */

import type { OracleArtifact } from './schema.ts';
import type { RunMode } from './referenceRunManifest.ts';

/** Discriminant tag for input event types. */
export type InputEventKind = 'key-down' | 'key-up' | 'mouse-button-down' | 'mouse-button-up' | 'mouse-move' | 'quit';

/** Frozen, ASCIIbetically sorted list of every valid input event kind. */
export const INPUT_EVENT_KINDS: readonly InputEventKind[] = Object.freeze(['key-down', 'key-up', 'mouse-button-down', 'mouse-button-up', 'mouse-move', 'quit'] as const);

/**
 * Maximum valid Doom internal key code value.
 *
 * Doom's key code space is a single unsigned byte (0x00–0xFF).
 * These are Doom internal codes, not raw hardware scan codes;
 * the reference executable maps platform events to this range.
 */
export const SCANCODE_MAX = 0xff;

/**
 * Maximum valid mouse button index (0-based).
 *
 * Chocolate Doom / SDL supports buttons 0–4:
 * 0 = left, 1 = right, 2 = middle, 3 = extra1, 4 = extra2.
 */
export const MOUSE_BUTTON_MAX = 4;

/** A key-down event at a specific tic. */
export interface KeyDownEvent {
  /** Tic number at which this event fires (0-based). */
  readonly tic: number;
  readonly kind: 'key-down';
  /** Doom internal key code (0 to SCANCODE_MAX). */
  readonly scanCode: number;
}

/** A key-up event at a specific tic. */
export interface KeyUpEvent {
  /** Tic number at which this event fires (0-based). */
  readonly tic: number;
  readonly kind: 'key-up';
  /** Doom internal key code (0 to SCANCODE_MAX). */
  readonly scanCode: number;
}

/** A mouse button press event at a specific tic. */
export interface MouseButtonDownEvent {
  /** Tic number at which this event fires (0-based). */
  readonly tic: number;
  readonly kind: 'mouse-button-down';
  /** Mouse button index (0=left, 1=right, 2=middle, 3=extra1, 4=extra2). */
  readonly button: number;
}

/** A mouse button release event at a specific tic. */
export interface MouseButtonUpEvent {
  /** Tic number at which this event fires (0-based). */
  readonly tic: number;
  readonly kind: 'mouse-button-up';
  /** Mouse button index (0=left, 1=right, 2=middle, 3=extra1, 4=extra2). */
  readonly button: number;
}

/** A mouse movement event at a specific tic. */
export interface MouseMoveEvent {
  /** Tic number at which this event fires (0-based). */
  readonly tic: number;
  readonly kind: 'mouse-move';
  /** Horizontal pixel delta (positive = rightward). */
  readonly deltaX: number;
  /** Vertical pixel delta (positive = forward in Doom's convention). */
  readonly deltaY: number;
}

/** A quit signal event at a specific tic. */
export interface QuitEvent {
  /** Tic number at which this event fires (0-based). */
  readonly tic: number;
  readonly kind: 'quit';
}

/** Discriminated union of all input script event types. */
export type InputScriptEvent = KeyDownEvent | KeyUpEvent | MouseButtonDownEvent | MouseButtonUpEvent | MouseMoveEvent | QuitEvent;

/**
 * Payload for an input-script oracle artifact.
 *
 * Events must be sorted ascending by tic number.  Multiple events
 * at the same tic are permitted and processed in array order.
 * A `totalTics` of 0 means no explicit duration limit; the run
 * mode controls termination (e.g. title-loop cycles indefinitely
 * until externally stopped).
 */
export interface InputScriptPayload {
  /** Human-readable description of what this script tests. */
  readonly description: string;
  /** Which run mode this script targets. */
  readonly targetRunMode: RunMode;
  /**
   * Total number of tics the script spans (exclusive upper bound).
   * 0 means no explicit duration limit.
   */
  readonly totalTics: number;
  /** Tic rate in Hz; must match the reference target (35). */
  readonly ticRateHz: number;
  /** Ordered sequence of input events, sorted ascending by tic. */
  readonly events: readonly InputScriptEvent[];
}

/** Type alias for a complete input-script oracle artifact. */
export type InputScriptArtifact = OracleArtifact<InputScriptPayload>;

/**
 * Frozen empty input script for title-loop captures where no player
 * input is needed.  The title/demo attract loop runs autonomously.
 */
export const EMPTY_TITLE_LOOP_SCRIPT: InputScriptPayload = Object.freeze({
  description: 'Empty input script for autonomous title/demo attract loop capture',
  targetRunMode: 'title-loop',
  totalTics: 0,
  ticRateHz: 35,
  events: Object.freeze([]),
} satisfies InputScriptPayload);

/**
 * Frozen empty input script for demo-playback captures where the
 * pre-recorded demo data supplies all input.  No additional raw
 * input events are needed.
 */
export const EMPTY_DEMO_PLAYBACK_SCRIPT: InputScriptPayload = Object.freeze({
  description: 'Empty input script for pre-recorded demo playback capture',
  targetRunMode: 'demo-playback',
  totalTics: 0,
  ticRateHz: 35,
  events: Object.freeze([]),
} satisfies InputScriptPayload);
