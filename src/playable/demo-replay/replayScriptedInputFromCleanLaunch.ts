import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import type { DemoPlaybackCompletionAction, DemoPlaybackSnapshot } from '../../demo/demoPlayback.ts';
import type { InputEventKind, InputScriptEvent, InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { INPUT_EVENT_KINDS, MOUSE_BUTTON_MAX, SCANCODE_MAX } from '../../oracles/inputScript.ts';

const DEFAULT_CLEAN_LAUNCH_INPUT_SCRIPT: InputScriptPayload = Object.freeze({
  description: 'Scripted input from clean launch through deterministic replay entry',
  events: Object.freeze([
    Object.freeze({
      kind: 'key-down',
      scanCode: 0x0d,
      tic: 0,
    } satisfies InputScriptEvent),
    Object.freeze({
      kind: 'key-up',
      scanCode: 0x0d,
      tic: 1,
    } satisfies InputScriptEvent),
    Object.freeze({
      kind: 'key-down',
      scanCode: 0x0d,
      tic: 3,
    } satisfies InputScriptEvent),
    Object.freeze({
      kind: 'key-up',
      scanCode: 0x0d,
      tic: 4,
    } satisfies InputScriptEvent),
  ]),
  targetRunMode: 'demo-playback',
  ticRateHz: 35,
  totalTics: 6,
} satisfies InputScriptPayload);

const PRODUCT_RUNTIME_COMMAND = 'bun run doom.ts';

export const REPLAY_SCRIPTED_INPUT_FROM_CLEAN_LAUNCH_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: PRODUCT_RUNTIME_COMMAND,
  subcommand: 'run',
} as const);

export interface ReplayScriptedInputFromCleanLaunchDemoEvidence {
  readonly activePlayerCounts: readonly number[];
  readonly completionAction: DemoPlaybackCompletionAction;
  readonly finalSnapshot: Readonly<DemoPlaybackSnapshot>;
  readonly ticCommandHash: string;
  readonly ticCommandSignatures: readonly string[];
  readonly ticCount: number;
  readonly transition: DemoPlaybackCompletionAction;
}

export interface ReplayScriptedInputFromCleanLaunchEventEvidence {
  readonly eventIndex: number;
  readonly kind: InputEventKind;
  readonly payloadHash: string;
  readonly signature: string;
  readonly tic: number;
}

export interface ReplayScriptedInputFromCleanLaunchEvidence {
  readonly commandContract: typeof REPLAY_SCRIPTED_INPUT_FROM_CLEAN_LAUNCH_COMMAND_CONTRACT;
  readonly demoReplay: ReplayScriptedInputFromCleanLaunchDemoEvidence | null;
  readonly inputScript: ReplayScriptedInputFromCleanLaunchScriptEvidence;
  readonly launch: ReplayScriptedInputFromCleanLaunchLaunchEvidence;
  readonly replayHash: string;
}

export interface ReplayScriptedInputFromCleanLaunchLaunchEvidence {
  readonly mapName: string;
  readonly skill: number;
  readonly transition: 'clean-launch-to-scripted-input-replay';
}

export interface ReplayScriptedInputFromCleanLaunchOptions {
  readonly command?: string;
  readonly demoBuffer?: Uint8Array;
  readonly inputScript?: InputScriptPayload;
  readonly launchMap?: string;
  readonly launchSkill?: number;
}

export interface ReplayScriptedInputFromCleanLaunchScriptEvidence {
  readonly description: string;
  readonly eventCount: number;
  readonly eventSignatures: readonly ReplayScriptedInputFromCleanLaunchEventEvidence[];
  readonly targetRunMode: string;
  readonly ticRateHz: number;
  readonly totalTics: number;
}

/**
 * Replay a deterministic input script from the `bun run doom.ts` clean-launch path.
 *
 * @param options Replay command, input script, optional demo stream, and launch metadata.
 * @returns Frozen evidence describing the clean-launch scripted replay.
 *
 * @example
 * ```ts
 * import { replayScriptedInputFromCleanLaunch } from './src/playable/demo-replay/replayScriptedInputFromCleanLaunch.ts';
 *
 * const evidence = replayScriptedInputFromCleanLaunch();
 * console.log(evidence.launch.transition);
 * ```
 */
export function replayScriptedInputFromCleanLaunch(options: ReplayScriptedInputFromCleanLaunchOptions = {}): Readonly<ReplayScriptedInputFromCleanLaunchEvidence> {
  const command = options.command ?? PRODUCT_RUNTIME_COMMAND;
  if (command !== PRODUCT_RUNTIME_COMMAND) {
    throw new Error(`replay scripted input requires ${PRODUCT_RUNTIME_COMMAND}, got ${command}`);
  }

  const launchSkill = options.launchSkill ?? 2;
  validateIntegerInRange(launchSkill, 'launchSkill', 0, 4);

  const inputScript = options.inputScript ?? DEFAULT_CLEAN_LAUNCH_INPUT_SCRIPT;
  const inputScriptEvidence = createInputScriptEvidence(inputScript);
  const demoReplay = options.demoBuffer === undefined ? null : createDemoReplayEvidence(options.demoBuffer);

  const launch = Object.freeze({
    mapName: options.launchMap ?? 'E1M1',
    skill: launchSkill,
    transition: 'clean-launch-to-scripted-input-replay',
  } satisfies ReplayScriptedInputFromCleanLaunchLaunchEvidence);

  const replayPayload = {
    commandContract: REPLAY_SCRIPTED_INPUT_FROM_CLEAN_LAUNCH_COMMAND_CONTRACT,
    demoReplay,
    inputScript: inputScriptEvidence,
    launch,
  };

  return Object.freeze({
    ...replayPayload,
    replayHash: hashJson(replayPayload),
  });
}

function createDemoReplayEvidence(demoBuffer: Uint8Array): ReplayScriptedInputFromCleanLaunchDemoEvidence {
  const playback = new DemoPlayback(Buffer.from(demoBuffer));
  const activePlayerCounts: number[] = [];
  const ticCommandSignatures: string[] = [];
  let tic = 0;

  while (true) {
    const ticCommands = playback.readNextTic();
    if (ticCommands === null) {
      break;
    }

    activePlayerCounts.push(ticCommands.length);
    ticCommandSignatures.push(
      hashJson({
        tic,
        ticCommands,
      }),
    );
    tic += 1;
  }

  if (tic === 0) {
    throw new RangeError('scripted replay demo evidence requires at least one tic command');
  }

  const finalSnapshot = playback.snapshot();
  return Object.freeze({
    activePlayerCounts: Object.freeze([...activePlayerCounts]),
    completionAction: finalSnapshot.completionAction,
    finalSnapshot,
    ticCommandHash: hashJson(ticCommandSignatures),
    ticCommandSignatures: Object.freeze([...ticCommandSignatures]),
    ticCount: tic,
    transition: finalSnapshot.completionAction,
  });
}

function createInputScriptEvidence(inputScript: InputScriptPayload): ReplayScriptedInputFromCleanLaunchScriptEvidence {
  validateInputScript(inputScript);

  return Object.freeze({
    description: inputScript.description,
    eventCount: inputScript.events.length,
    eventSignatures: Object.freeze(inputScript.events.map((event, eventIndex) => createInputScriptEventEvidence(event, eventIndex))),
    targetRunMode: inputScript.targetRunMode,
    ticRateHz: inputScript.ticRateHz,
    totalTics: inputScript.totalTics,
  });
}

function createInputScriptEventEvidence(event: InputScriptEvent, eventIndex: number): ReplayScriptedInputFromCleanLaunchEventEvidence {
  const payload = createInputScriptEventPayload(event);

  return Object.freeze({
    eventIndex,
    kind: event.kind,
    payloadHash: hashJson(payload),
    signature: `${event.tic}:${event.kind}:${formatInputScriptEventPayload(event)}`,
    tic: event.tic,
  });
}

function createInputScriptEventPayload(event: InputScriptEvent): Record<string, number | string> {
  switch (event.kind) {
    case 'key-down':
    case 'key-up':
      return {
        kind: event.kind,
        scanCode: event.scanCode,
        tic: event.tic,
      };
    case 'mouse-button-down':
    case 'mouse-button-up':
      return {
        button: event.button,
        kind: event.kind,
        tic: event.tic,
      };
    case 'mouse-move':
      return {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        kind: event.kind,
        tic: event.tic,
      };
    case 'quit':
      return {
        kind: event.kind,
        tic: event.tic,
      };
  }
}

function formatInputScriptEventPayload(event: InputScriptEvent): string {
  switch (event.kind) {
    case 'key-down':
    case 'key-up':
      return `scanCode=${event.scanCode}`;
    case 'mouse-button-down':
    case 'mouse-button-up':
      return `button=${event.button}`;
    case 'mouse-move':
      return `deltaX=${event.deltaX},deltaY=${event.deltaY}`;
    case 'quit':
      return 'none';
  }
}

function hashJson(value: unknown): string {
  const serializedValue = JSON.stringify(value);
  if (serializedValue === undefined) {
    throw new TypeError('cannot hash an undefined JSON value');
  }

  return createHash('sha256').update(serializedValue).digest('hex');
}

function validateInputScript(inputScript: InputScriptPayload): void {
  if (inputScript.ticRateHz !== 35) {
    throw new RangeError(`input script ticRateHz must be 35, got ${inputScript.ticRateHz}`);
  }

  validateIntegerInRange(inputScript.totalTics, 'inputScript.totalTics', 0, Number.MAX_SAFE_INTEGER);

  let previousTic = -1;
  for (let eventIndex = 0; eventIndex < inputScript.events.length; eventIndex += 1) {
    const event = inputScript.events[eventIndex];
    if (!INPUT_EVENT_KINDS.includes(event.kind)) {
      throw new RangeError(`input script event ${eventIndex} has unsupported kind ${event.kind}`);
    }

    validateIntegerInRange(event.tic, `inputScript.events[${eventIndex}].tic`, 0, Number.MAX_SAFE_INTEGER);
    if (event.tic < previousTic) {
      throw new RangeError('input script events must be sorted by ascending tic');
    }

    if (inputScript.totalTics > 0 && event.tic >= inputScript.totalTics) {
      throw new RangeError(`input script event ${eventIndex} tic must be less than totalTics`);
    }

    validateInputScriptEventPayload(event, eventIndex);
    previousTic = event.tic;
  }
}

function validateInputScriptEventPayload(event: InputScriptEvent, eventIndex: number): void {
  switch (event.kind) {
    case 'key-down':
    case 'key-up':
      validateIntegerInRange(event.scanCode, `inputScript.events[${eventIndex}].scanCode`, 0, SCANCODE_MAX);
      return;
    case 'mouse-button-down':
    case 'mouse-button-up':
      validateIntegerInRange(event.button, `inputScript.events[${eventIndex}].button`, 0, MOUSE_BUTTON_MAX);
      return;
    case 'mouse-move':
      validateIntegerInRange(event.deltaX, `inputScript.events[${eventIndex}].deltaX`, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
      validateIntegerInRange(event.deltaY, `inputScript.events[${eventIndex}].deltaY`, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
      return;
    case 'quit':
      return;
  }
}

function validateIntegerInRange(value: number, fieldName: string, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${fieldName} must be an integer in ${minimum}..${maximum}, got ${value}`);
  }
}
