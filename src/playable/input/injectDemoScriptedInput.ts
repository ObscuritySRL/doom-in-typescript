import { KEY_DOWNARROW, KEY_ESCAPE, KEY_LEFTARROW, KEY_PGDN, KEY_PGUP, KEY_RIGHTARROW, KEY_RSHIFT, KEY_TAB, KEY_UPARROW } from '../../input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';
import type { TicCommand } from '../../input/ticcmd.ts';

const DEMO_SCRIPTED_INPUT_RUNTIME_COMMAND = 'bun run doom.ts';

const KEY_A = 0x61;
const KEY_D = 0x64;
const KEY_E = 0x65;
const KEY_F = 0x66;
const KEY_Q = 0x71;
const KEY_S = 0x73;
const KEY_W = 0x77;

export const SUPPORTED_SCRIPTED_DOOM_KEYS = Object.freeze([KEY_W, KEY_S, KEY_UPARROW, KEY_DOWNARROW, KEY_A, KEY_D, KEY_LEFTARROW, KEY_RIGHTARROW, KEY_Q, KEY_E, KEY_RSHIFT, KEY_TAB, KEY_PGUP, KEY_PGDN, KEY_F, KEY_ESCAPE] as const);

const SUPPORTED_SCRIPTED_DOOM_KEY_SET = new Set<number>(SUPPORTED_SCRIPTED_DOOM_KEYS);

export const INJECT_DEMO_SCRIPTED_INPUT_CONTRACT = Object.freeze({
  auditManifestStepId: '01-010',
  injectionStage: 'post-translation-doom-key',
  neutralTicCommandSize: TICCMD_SIZE,
  replayCompatibility: 'deterministic',
  runtimeCommand: DEMO_SCRIPTED_INPUT_RUNTIME_COMMAND,
  scriptedEventTypes: Object.freeze(['keydown', 'keyup'] as const),
  supportedDoomKeys: SUPPORTED_SCRIPTED_DOOM_KEYS,
});

export type DemoScriptedInputEventType = 'keydown' | 'keyup';

export interface DemoScriptedInputEvent {
  readonly doomKey: number;
  readonly tic: number;
  readonly type: DemoScriptedInputEventType;
}

export interface InjectDemoScriptedInputOptions {
  readonly currentTic: number;
  readonly heldKeys: readonly number[];
  readonly nextScriptIndex: number;
  readonly runtimeCommand: string;
  readonly scriptedEvents: readonly DemoScriptedInputEvent[];
}

export interface InjectDemoScriptedInputResult {
  readonly currentTic: number;
  readonly heldKeys: readonly number[];
  readonly injectedEvents: readonly DemoScriptedInputEvent[];
  readonly nextScriptIndex: number;
  readonly ticCommand: TicCommand;
  readonly ticCommandSize: number;
}

export function injectDemoScriptedInput(options: InjectDemoScriptedInputOptions): InjectDemoScriptedInputResult {
  if (options.runtimeCommand !== DEMO_SCRIPTED_INPUT_RUNTIME_COMMAND) {
    throw new Error(`injectDemoScriptedInput requires ${DEMO_SCRIPTED_INPUT_RUNTIME_COMMAND}`);
  }

  if (!Number.isInteger(options.currentTic) || options.currentTic < 0) {
    throw new Error('Demo scripted input requires a non-negative current tic.');
  }

  if (!Number.isInteger(options.nextScriptIndex) || options.nextScriptIndex < 0 || options.nextScriptIndex > options.scriptedEvents.length) {
    throw new Error('Demo scripted input requires a next script index within the scripted event range.');
  }

  const heldKeys = new Set<number>();
  for (const doomKey of options.heldKeys) {
    validateSupportedDoomKey(doomKey);
    heldKeys.add(doomKey);
  }

  const injectedEvents: DemoScriptedInputEvent[] = [];
  let nextScriptIndex = options.nextScriptIndex;

  while (nextScriptIndex < options.scriptedEvents.length) {
    const scriptedEvent = options.scriptedEvents[nextScriptIndex];
    validateScriptedEvent(scriptedEvent);

    if (scriptedEvent.tic < options.currentTic) {
      throw new Error('Demo scripted input events must stay ordered by tic.');
    }

    if (scriptedEvent.tic !== options.currentTic) {
      break;
    }

    injectedEvents.push(
      Object.freeze({
        doomKey: scriptedEvent.doomKey,
        tic: scriptedEvent.tic,
        type: scriptedEvent.type,
      }),
    );

    if (scriptedEvent.type === 'keydown') {
      heldKeys.add(scriptedEvent.doomKey);
    } else {
      heldKeys.delete(scriptedEvent.doomKey);
    }

    nextScriptIndex += 1;
  }

  return Object.freeze({
    currentTic: options.currentTic,
    heldKeys: Object.freeze([...heldKeys].sort(sortNumbersAscending)),
    injectedEvents: Object.freeze(injectedEvents),
    nextScriptIndex,
    ticCommand: EMPTY_TICCMD,
    ticCommandSize: TICCMD_SIZE,
  });
}

function sortNumbersAscending(left: number, right: number): number {
  return left - right;
}

function validateScriptedEvent(scriptedEvent: DemoScriptedInputEvent): void {
  if (!Number.isInteger(scriptedEvent.tic) || scriptedEvent.tic < 0) {
    throw new Error('Demo scripted input events require non-negative integer tic values.');
  }

  if (scriptedEvent.type !== 'keydown' && scriptedEvent.type !== 'keyup') {
    throw new Error('Demo scripted input only supports keydown and keyup events.');
  }

  validateSupportedDoomKey(scriptedEvent.doomKey);
}

function validateSupportedDoomKey(doomKey: number): void {
  if (!SUPPORTED_SCRIPTED_DOOM_KEY_SET.has(doomKey)) {
    throw new Error('Demo scripted input only supports Doom keys from the documented control set.');
  }
}
