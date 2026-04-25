import { extractScanCode, isExtendedKey, translateScanCode } from '../../input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';

const TRACE_SOURCES = Object.freeze(['keyboard', 'mouse-button', 'mouse-motion', 'scripted-doom-key'] as const);

export const RECORD_INPUT_TRACE_FORMAT_CONTRACT = Object.freeze({
  auditStepId: '01-010',
  auditSurface: 'input-trace-recording',
  deterministicReplayCompatibility: 'tic-indexed-arrival-order',
  keyboardEncoding: 'scan-code-and-doom-key',
  neutralTicCommand: EMPTY_TICCMD,
  runtimeCommand: 'bun run doom.ts',
  schemaVersion: 1,
  ticCommandSize: TICCMD_SIZE,
  traceSources: TRACE_SOURCES,
});

export type InputTraceKeyboardPhase = 'keydown' | 'keyup';
export type InputTraceMouseButton = 'left' | 'middle' | 'right';
export type InputTraceMouseButtonPhase = 'down' | 'up';
export type InputTraceSource = (typeof TRACE_SOURCES)[number];

export interface KeyboardInputTraceSourceEvent {
  readonly lparam: number;
  readonly phase: InputTraceKeyboardPhase;
  readonly source: 'keyboard';
  readonly tic: number;
}

export interface MouseButtonInputTraceSourceEvent {
  readonly button: InputTraceMouseButton;
  readonly phase: InputTraceMouseButtonPhase;
  readonly source: 'mouse-button';
  readonly tic: number;
}

export interface MouseMotionInputTraceSourceEvent {
  readonly mouseX: number;
  readonly mouseY: number;
  readonly source: 'mouse-motion';
  readonly tic: number;
}

export interface ScriptedDoomKeyInputTraceSourceEvent {
  readonly doomKey: number;
  readonly phase: InputTraceKeyboardPhase;
  readonly source: 'scripted-doom-key';
  readonly tic: number;
}

export type InputTraceSourceEvent = KeyboardInputTraceSourceEvent | MouseButtonInputTraceSourceEvent | MouseMotionInputTraceSourceEvent | ScriptedDoomKeyInputTraceSourceEvent;

export interface RecordedKeyboardInputTraceEvent {
  readonly arrivalOrder: number;
  readonly doomKey: number;
  readonly extendedKey: boolean;
  readonly lparam: number;
  readonly phase: InputTraceKeyboardPhase;
  readonly scanCode: number;
  readonly source: 'keyboard';
  readonly tic: number;
}

export interface RecordedMouseButtonInputTraceEvent {
  readonly arrivalOrder: number;
  readonly button: InputTraceMouseButton;
  readonly phase: InputTraceMouseButtonPhase;
  readonly source: 'mouse-button';
  readonly tic: number;
}

export interface RecordedMouseMotionInputTraceEvent {
  readonly arrivalOrder: number;
  readonly mouseX: number;
  readonly mouseY: number;
  readonly source: 'mouse-motion';
  readonly tic: number;
}

export interface RecordedScriptedDoomKeyInputTraceEvent {
  readonly arrivalOrder: number;
  readonly doomKey: number;
  readonly phase: InputTraceKeyboardPhase;
  readonly source: 'scripted-doom-key';
  readonly tic: number;
}

export type RecordedInputTraceEvent = RecordedKeyboardInputTraceEvent | RecordedMouseButtonInputTraceEvent | RecordedMouseMotionInputTraceEvent | RecordedScriptedDoomKeyInputTraceEvent;

export interface RecordedInputTraceHeader {
  readonly neutralTicCommand: typeof EMPTY_TICCMD;
  readonly runtimeCommand: 'bun run doom.ts';
  readonly schemaVersion: 1;
  readonly ticCommandSize: number;
}

export interface RecordedInputTraceSummary {
  readonly keyboardEventCount: number;
  readonly lastTic: number | null;
  readonly mouseButtonEventCount: number;
  readonly mouseMotionEventCount: number;
  readonly recordedEventCount: number;
  readonly scriptedEventCount: number;
}

export interface RecordedInputTrace {
  readonly entries: readonly RecordedInputTraceEvent[];
  readonly header: RecordedInputTraceHeader;
  readonly summary: RecordedInputTraceSummary;
}

export function recordInputTraceFormat(runtimeCommand: string, sourceEvents: readonly InputTraceSourceEvent[]): RecordedInputTrace {
  if (runtimeCommand !== RECORD_INPUT_TRACE_FORMAT_CONTRACT.runtimeCommand) {
    throw new Error('Input trace recording requires `bun run doom.ts`.');
  }

  const entries: RecordedInputTraceEvent[] = [];
  let keyboardEventCount = 0;
  let mouseButtonEventCount = 0;
  let mouseMotionEventCount = 0;
  let previousTic = -1;
  let scriptedEventCount = 0;

  for (const [arrivalOrder, sourceEvent] of sourceEvents.entries()) {
    if (!Number.isInteger(sourceEvent.tic) || sourceEvent.tic < 0) {
      throw new Error('Input trace events must use non-negative integer tics.');
    }

    if (sourceEvent.tic < previousTic) {
      throw new Error('Input trace events must be provided in tic order.');
    }
    previousTic = sourceEvent.tic;

    switch (sourceEvent.source) {
      case 'keyboard': {
        if (sourceEvent.phase !== 'keydown' && sourceEvent.phase !== 'keyup') {
          throw new Error('Keyboard input trace events must use keydown or keyup.');
        }
        if (!Number.isInteger(sourceEvent.lparam)) {
          throw new Error('Keyboard input trace events must use an integer lparam.');
        }

        const doomKey = translateScanCode(sourceEvent.lparam);
        if (doomKey === 0) {
          throw new Error('Input trace recording requires mappable keyboard scan codes.');
        }

        keyboardEventCount += 1;
        entries.push(
          Object.freeze({
            arrivalOrder,
            doomKey,
            extendedKey: isExtendedKey(sourceEvent.lparam),
            lparam: sourceEvent.lparam,
            phase: sourceEvent.phase,
            scanCode: extractScanCode(sourceEvent.lparam),
            source: sourceEvent.source,
            tic: sourceEvent.tic,
          }),
        );
        break;
      }

      case 'mouse-button': {
        if (sourceEvent.button !== 'left' && sourceEvent.button !== 'middle' && sourceEvent.button !== 'right') {
          throw new Error('Mouse button input trace events must use left, middle, or right.');
        }
        if (sourceEvent.phase !== 'down' && sourceEvent.phase !== 'up') {
          throw new Error('Mouse button input trace events must use down or up.');
        }

        mouseButtonEventCount += 1;
        entries.push(
          Object.freeze({
            arrivalOrder,
            button: sourceEvent.button,
            phase: sourceEvent.phase,
            source: sourceEvent.source,
            tic: sourceEvent.tic,
          }),
        );
        break;
      }

      case 'mouse-motion': {
        if (!Number.isInteger(sourceEvent.mouseX) || !Number.isInteger(sourceEvent.mouseY)) {
          throw new Error('Mouse motion input trace events must use integer deltas.');
        }

        mouseMotionEventCount += 1;
        entries.push(
          Object.freeze({
            arrivalOrder,
            mouseX: sourceEvent.mouseX,
            mouseY: sourceEvent.mouseY,
            source: sourceEvent.source,
            tic: sourceEvent.tic,
          }),
        );
        break;
      }

      case 'scripted-doom-key': {
        if (sourceEvent.phase !== 'keydown' && sourceEvent.phase !== 'keyup') {
          throw new Error('Scripted Doom key input trace events must use keydown or keyup.');
        }
        if (!Number.isInteger(sourceEvent.doomKey) || sourceEvent.doomKey <= 0 || sourceEvent.doomKey > 0xff) {
          throw new Error('Scripted Doom key input trace events must use a one-byte Doom key.');
        }

        scriptedEventCount += 1;
        entries.push(
          Object.freeze({
            arrivalOrder,
            doomKey: sourceEvent.doomKey,
            phase: sourceEvent.phase,
            source: sourceEvent.source,
            tic: sourceEvent.tic,
          }),
        );
        break;
      }

      default: {
        const unsupportedSource: never = sourceEvent;
        throw new Error(`Unsupported input trace source: ${String(unsupportedSource)}.`);
      }
    }
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    header: Object.freeze({
      neutralTicCommand: EMPTY_TICCMD,
      runtimeCommand: RECORD_INPUT_TRACE_FORMAT_CONTRACT.runtimeCommand,
      schemaVersion: RECORD_INPUT_TRACE_FORMAT_CONTRACT.schemaVersion,
      ticCommandSize: TICCMD_SIZE,
    }),
    summary: Object.freeze({
      keyboardEventCount,
      lastTic: entries.length === 0 ? null : previousTic,
      mouseButtonEventCount,
      mouseMotionEventCount,
      recordedEventCount: entries.length,
      scriptedEventCount,
    }),
  });
}
