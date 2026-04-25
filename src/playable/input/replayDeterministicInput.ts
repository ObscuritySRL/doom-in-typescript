import { extractScanCode, isExtendedKey, translateScanCode } from '../../input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';

import type { TicCommand } from '../../input/ticcmd.ts';

const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';
const TRACE_SCHEMA_VERSION = 1;

export interface KeyboardReplayTraceEvent {
  readonly arrivalIndex: number;
  readonly doomKey: number;
  readonly extendedKey: boolean;
  readonly keyTransition: 'keydown' | 'keyup';
  readonly messageLongParameter: number;
  readonly scanCode: number;
  readonly ticIndex: number;
  readonly type: 'keyboard';
}

export interface MouseButtonReplayTraceEvent {
  readonly arrivalIndex: number;
  readonly button: 'left' | 'middle' | 'right';
  readonly buttonTransition: 'buttondown' | 'buttonup';
  readonly ticIndex: number;
  readonly type: 'mouse-button';
}

export interface MouseMotionReplayTraceEvent {
  readonly arrivalIndex: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly ticIndex: number;
  readonly type: 'mouse-motion';
}

export interface ScriptedDoomKeyReplayTraceEvent {
  readonly arrivalIndex: number;
  readonly doomKey: number;
  readonly keyTransition: 'keydown' | 'keyup';
  readonly ticIndex: number;
  readonly type: 'scripted-doom-key';
}

export type ReplayTraceEvent = KeyboardReplayTraceEvent | MouseButtonReplayTraceEvent | MouseMotionReplayTraceEvent | ScriptedDoomKeyReplayTraceEvent;

export interface ReplayInputTraceHeader {
  readonly neutralTicCommand: TicCommand;
  readonly runtimeCommand: string;
  readonly ticCommandSize: number;
  readonly traceSchemaVersion: number;
}

export interface ReplayInputTrace {
  readonly events: readonly ReplayTraceEvent[];
  readonly header: ReplayInputTraceHeader;
}

export interface ReplayDeterministicInputOptions {
  readonly runtimeCommand: string;
  readonly ticIndex: number;
  readonly trace: ReplayInputTrace;
  readonly traceCursor: number;
}

export interface ReplayDeterministicInputResult {
  readonly consumedEvents: readonly ReplayTraceEvent[];
  readonly nextCursor: number;
  readonly ticCommand: TicCommand;
  readonly ticCommandSize: number;
}

export const REPLAY_DETERMINISTIC_INPUT_CONTRACT = Object.freeze({
  domains: Object.freeze(['keyboard', 'mouse-button', 'mouse-motion', 'scripted-doom-key'] as const),
  neutralTicCommand: EMPTY_TICCMD,
  preservesArrivalOrder: true,
  replaysOnlyCurrentTic: true,
  runtimeCommand: REQUIRED_RUNTIME_COMMAND,
  ticCommandSize: TICCMD_SIZE,
  traceSchemaVersion: TRACE_SCHEMA_VERSION,
  validatesKeyboardTranslation: true,
});

function assertInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }
}

function assertKeyboardReplayTraceEvent(event: KeyboardReplayTraceEvent): void {
  assertInteger(event.messageLongParameter, 'Keyboard replay event messageLongParameter');
  assertInteger(event.scanCode, 'Keyboard replay event scanCode');

  if (event.keyTransition !== 'keydown' && event.keyTransition !== 'keyup') {
    throw new Error(`Unsupported keyboard replay transition: ${event.keyTransition}.`);
  }

  if (extractScanCode(event.messageLongParameter) !== event.scanCode) {
    throw new Error(`Keyboard replay event scanCode mismatch at tic ${event.ticIndex}.`);
  }

  if (isExtendedKey(event.messageLongParameter) !== event.extendedKey) {
    throw new Error(`Keyboard replay event extendedKey mismatch at tic ${event.ticIndex}.`);
  }

  if (translateScanCode(event.messageLongParameter) !== event.doomKey) {
    throw new Error(`Keyboard replay event doomKey mismatch at tic ${event.ticIndex}.`);
  }
}

function assertMouseButtonReplayTraceEvent(event: MouseButtonReplayTraceEvent): void {
  if (event.button !== 'left' && event.button !== 'middle' && event.button !== 'right') {
    throw new Error(`Unsupported mouse replay button: ${event.button}.`);
  }

  if (event.buttonTransition !== 'buttondown' && event.buttonTransition !== 'buttonup') {
    throw new Error(`Unsupported mouse replay transition: ${event.buttonTransition}.`);
  }
}

function assertMouseMotionReplayTraceEvent(event: MouseMotionReplayTraceEvent): void {
  assertInteger(event.deltaX, 'Mouse motion replay deltaX');
  assertInteger(event.deltaY, 'Mouse motion replay deltaY');
}

function assertScriptedDoomKeyReplayTraceEvent(event: ScriptedDoomKeyReplayTraceEvent): void {
  if (event.keyTransition !== 'keydown' && event.keyTransition !== 'keyup') {
    throw new Error(`Unsupported scripted Doom key transition: ${event.keyTransition}.`);
  }
}

function assertReplayTraceEvent(event: ReplayTraceEvent): void {
  assertInteger(event.arrivalIndex, `${event.type} replay arrivalIndex`);
  assertInteger(event.ticIndex, `${event.type} replay ticIndex`);

  if (event.ticIndex < 0) {
    throw new Error(`${event.type} replay ticIndex cannot be negative.`);
  }

  switch (event.type) {
    case 'keyboard':
      assertKeyboardReplayTraceEvent(event);
      return;
    case 'mouse-button':
      assertMouseButtonReplayTraceEvent(event);
      return;
    case 'mouse-motion':
      assertMouseMotionReplayTraceEvent(event);
      return;
    case 'scripted-doom-key':
      assertScriptedDoomKeyReplayTraceEvent(event);
      return;
  }
}

function assertReplayInputTraceHeader(header: ReplayInputTraceHeader): void {
  if (header.runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error('Replay trace runtime command mismatch.');
  }

  if (header.traceSchemaVersion !== TRACE_SCHEMA_VERSION) {
    throw new Error(`Replay trace schema version must be ${TRACE_SCHEMA_VERSION}.`);
  }

  if (header.ticCommandSize !== TICCMD_SIZE) {
    throw new Error(`Replay trace ticCommandSize must be ${TICCMD_SIZE}.`);
  }

  if (
    header.neutralTicCommand.angleturn !== EMPTY_TICCMD.angleturn ||
    header.neutralTicCommand.buttons !== EMPTY_TICCMD.buttons ||
    header.neutralTicCommand.chatchar !== EMPTY_TICCMD.chatchar ||
    header.neutralTicCommand.consistancy !== EMPTY_TICCMD.consistancy ||
    header.neutralTicCommand.forwardmove !== EMPTY_TICCMD.forwardmove ||
    header.neutralTicCommand.sidemove !== EMPTY_TICCMD.sidemove
  ) {
    throw new Error('Replay trace neutralTicCommand mismatch.');
  }
}

export function replayDeterministicInput(options: ReplayDeterministicInputOptions): ReplayDeterministicInputResult {
  if (options.runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`Replay deterministic input requires ${REQUIRED_RUNTIME_COMMAND}.`);
  }

  assertInteger(options.ticIndex, 'Replay ticIndex');
  assertInteger(options.traceCursor, 'Replay traceCursor');

  if (options.ticIndex < 0) {
    throw new Error('Replay ticIndex cannot be negative.');
  }

  if (options.traceCursor < 0 || options.traceCursor > options.trace.events.length) {
    throw new Error('Replay traceCursor is outside the trace bounds.');
  }

  assertReplayInputTraceHeader(options.trace.header);

  const consumedEvents: ReplayTraceEvent[] = [];
  let lastArrivalIndex = -1;
  let nextCursor = options.traceCursor;

  while (nextCursor < options.trace.events.length) {
    const event = options.trace.events[nextCursor];
    assertReplayTraceEvent(event);

    if (event.ticIndex < options.ticIndex) {
      throw new Error(`Replay traceCursor skipped pending tic ${event.ticIndex}.`);
    }

    if (event.ticIndex > options.ticIndex) {
      break;
    }

    if (event.arrivalIndex <= lastArrivalIndex) {
      throw new Error(`Replay arrival order must increase within tic ${options.ticIndex}.`);
    }

    consumedEvents.push(event);
    lastArrivalIndex = event.arrivalIndex;
    nextCursor += 1;
  }

  return Object.freeze({
    consumedEvents: Object.freeze([...consumedEvents]),
    nextCursor,
    ticCommand: EMPTY_TICCMD,
    ticCommandSize: TICCMD_SIZE,
  });
}
