import type { DemoPlaybackSnapshot } from '../../demo/demoPlayback.ts';
import type { InputScriptEvent, InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_TITLE_LOOP_SCRIPT, MOUSE_BUTTON_MAX, SCANCODE_MAX } from '../../oracles/inputScript.ts';

export const ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND = 'bun run doom.ts';

export const ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND,
} as const);

export const ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_STEP_IDENTIFIER = '13-010';

export const SIDE_BY_SIDE_REPLAY_AUDIT_STEP_IDENTIFIER = '01-015';

export interface AcceptCleanLaunchToGameplayReplayAuditEvidence {
  readonly missingSurface: 'side-by-side-replay-command';
  readonly sourceStepIdentifier: typeof SIDE_BY_SIDE_REPLAY_AUDIT_STEP_IDENTIFIER;
}

export interface AcceptCleanLaunchToGameplayReplayCleanLaunchEvidence {
  readonly inputEventCount: number;
  readonly scriptHash: string;
  readonly targetRunMode: InputScriptPayload['targetRunMode'];
  readonly ticRateHz: number;
  readonly totalTics: number;
  readonly transition: 'clean-launch-to-gameplay';
}

export interface AcceptCleanLaunchToGameplayReplayCommandContract {
  readonly entryFile: 'doom.ts';
  readonly runtimeCommand: typeof ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND;
}

export interface AcceptCleanLaunchToGameplayReplayDemoPlaybackEvidence {
  readonly activePlayerCounts: readonly number[];
  readonly completionAction: 'advance-demo';
  readonly demoTicCount: number;
  readonly finalSnapshot: Readonly<DemoPlaybackSnapshot>;
  readonly ticCommandHash: string;
  readonly ticSignatures: readonly string[];
}

export interface AcceptCleanLaunchToGameplayReplayEvidence {
  readonly auditEvidence: Readonly<AcceptCleanLaunchToGameplayReplayAuditEvidence>;
  readonly cleanLaunch: Readonly<AcceptCleanLaunchToGameplayReplayCleanLaunchEvidence>;
  readonly commandContract: Readonly<AcceptCleanLaunchToGameplayReplayCommandContract>;
  readonly demoPlayback: Readonly<AcceptCleanLaunchToGameplayReplayDemoPlaybackEvidence>;
  readonly replayHash: string;
  readonly stepIdentifier: typeof ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_STEP_IDENTIFIER;
}

export interface AcceptCleanLaunchToGameplayReplayOptions {
  readonly demoBuffer: Buffer;
  readonly inputScript?: InputScriptPayload;
  readonly runtimeCommand?: string;
}

const ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_AUDIT_EVIDENCE = Object.freeze({
  missingSurface: 'side-by-side-replay-command',
  sourceStepIdentifier: SIDE_BY_SIDE_REPLAY_AUDIT_STEP_IDENTIFIER,
} satisfies AcceptCleanLaunchToGameplayReplayAuditEvidence);

/**
 * Accept a deterministic clean-launch input script reaching gameplay replay.
 *
 * @param options Demo stream, optional clean-launch input script, and optional runtime command.
 * @returns Frozen deterministic replay acceptance evidence.
 * @example
 * ```ts
 * import { acceptCleanLaunchToGameplayReplay } from './src/playable/demo-replay/acceptCleanLaunchToGameplayReplay.ts';
 *
 * const demoBuffer = Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0, 1, 0, 0x80]);
 * console.log(acceptCleanLaunchToGameplayReplay({ demoBuffer }).commandContract.runtimeCommand);
 * ```
 */
export function acceptCleanLaunchToGameplayReplay(options: AcceptCleanLaunchToGameplayReplayOptions): Readonly<AcceptCleanLaunchToGameplayReplayEvidence> {
  const runtimeCommand = options.runtimeCommand ?? ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND;
  requireBunRuntimeCommand(runtimeCommand);

  const inputScript = options.inputScript ?? EMPTY_TITLE_LOOP_SCRIPT;
  const normalizedInputScript = normalizeInputScript(inputScript);
  validateInputScript(inputScript);

  const playback = new DemoPlayback(options.demoBuffer);
  const activePlayerCounts: number[] = [];
  const ticSignatures: string[] = [];

  while (true) {
    const ticCommands = playback.readNextTic();

    if (ticCommands === null) {
      break;
    }

    activePlayerCounts.push(ticCommands.length);
    ticSignatures.push(hashJson(normalizeUnknown(ticCommands)));
  }

  if (ticSignatures.length === 0) {
    throw new RangeError('Clean launch to gameplay replay requires at least one gameplay tic');
  }

  const finalSnapshot = playback.snapshot();

  if (finalSnapshot.completionAction !== 'advance-demo') {
    throw new RangeError(`Clean launch to gameplay replay must advance demo playback, got ${finalSnapshot.completionAction}`);
  }

  const cleanLaunch = Object.freeze({
    inputEventCount: normalizedInputScript.events.length,
    scriptHash: hashJson(normalizedInputScript),
    targetRunMode: normalizedInputScript.targetRunMode,
    ticRateHz: normalizedInputScript.ticRateHz,
    totalTics: normalizedInputScript.totalTics,
    transition: 'clean-launch-to-gameplay',
  } satisfies AcceptCleanLaunchToGameplayReplayCleanLaunchEvidence);
  const demoPlayback = Object.freeze({
    activePlayerCounts: Object.freeze(activePlayerCounts),
    completionAction: 'advance-demo',
    demoTicCount: ticSignatures.length,
    finalSnapshot,
    ticCommandHash: hashJson(ticSignatures),
    ticSignatures: Object.freeze(ticSignatures),
  } satisfies AcceptCleanLaunchToGameplayReplayDemoPlaybackEvidence);
  const commandContract = ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND_CONTRACT;
  const evidenceWithoutReplayHash = {
    auditEvidence: ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_AUDIT_EVIDENCE,
    cleanLaunch,
    commandContract,
    demoPlayback,
    stepIdentifier: ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_STEP_IDENTIFIER,
  } satisfies Omit<AcceptCleanLaunchToGameplayReplayEvidence, 'replayHash'>;

  return Object.freeze({
    ...evidenceWithoutReplayHash,
    replayHash: hashJson(evidenceWithoutReplayHash),
  });
}

function hashJson(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(value));
  return hasher.digest('hex');
}

function normalizeInputEvent(inputEvent: InputScriptEvent): unknown {
  switch (inputEvent.kind) {
    case 'key-down':
    case 'key-up':
      return {
        kind: inputEvent.kind,
        scanCode: inputEvent.scanCode,
        tic: inputEvent.tic,
      };
    case 'mouse-button-down':
    case 'mouse-button-up':
      return {
        button: inputEvent.button,
        kind: inputEvent.kind,
        tic: inputEvent.tic,
      };
    case 'mouse-move':
      return {
        deltaX: inputEvent.deltaX,
        deltaY: inputEvent.deltaY,
        kind: inputEvent.kind,
        tic: inputEvent.tic,
      };
    case 'quit':
      return {
        kind: inputEvent.kind,
        tic: inputEvent.tic,
      };
  }
}

function normalizeInputScript(inputScript: InputScriptPayload): {
  readonly description: string;
  readonly events: readonly unknown[];
  readonly targetRunMode: InputScriptPayload['targetRunMode'];
  readonly ticRateHz: number;
  readonly totalTics: number;
} {
  return Object.freeze({
    description: inputScript.description,
    events: Object.freeze(inputScript.events.map(normalizeInputEvent)),
    targetRunMode: inputScript.targetRunMode,
    ticRateHz: inputScript.ticRateHz,
    totalTics: inputScript.totalTics,
  });
}

function normalizeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeUnknown);
  }

  if (isRecord(value)) {
    const normalizedRecord: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      normalizedRecord[key] = normalizeUnknown(value[key]);
    }

    return normalizedRecord;
  }

  return value;
}

function requireBunRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND) {
    throw new RangeError(`Expected Bun runtime command ${ACCEPT_CLEAN_LAUNCH_TO_GAMEPLAY_REPLAY_COMMAND}, got ${runtimeCommand}`);
  }
}

function requireIntegerAtLeast(value: number, minimum: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${fieldName} must be an integer >= ${minimum}, got ${value}`);
  }
}

function requireIntegerInRange(value: number, minimum: number, maximum: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${fieldName} must be an integer in ${minimum}..${maximum}, got ${value}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInputEvent(inputEvent: InputScriptEvent): void {
  requireIntegerAtLeast(inputEvent.tic, 0, 'inputScript.events[].tic');

  switch (inputEvent.kind) {
    case 'key-down':
    case 'key-up':
      requireIntegerInRange(inputEvent.scanCode, 0, SCANCODE_MAX, 'inputScript.events[].scanCode');
      return;
    case 'mouse-button-down':
    case 'mouse-button-up':
      requireIntegerInRange(inputEvent.button, 0, MOUSE_BUTTON_MAX, 'inputScript.events[].button');
      return;
    case 'mouse-move':
      requireIntegerAtLeast(inputEvent.deltaX, Number.MIN_SAFE_INTEGER, 'inputScript.events[].deltaX');
      requireIntegerAtLeast(inputEvent.deltaY, Number.MIN_SAFE_INTEGER, 'inputScript.events[].deltaY');
      return;
    case 'quit':
      return;
  }
}

function validateInputScript(inputScript: InputScriptPayload): void {
  if (inputScript.targetRunMode !== EMPTY_TITLE_LOOP_SCRIPT.targetRunMode) {
    throw new RangeError(`Clean launch replay input script must target ${EMPTY_TITLE_LOOP_SCRIPT.targetRunMode}, got ${inputScript.targetRunMode}`);
  }

  if (inputScript.ticRateHz !== 35) {
    throw new RangeError(`inputScript.ticRateHz must be 35, got ${inputScript.ticRateHz}`);
  }

  requireIntegerAtLeast(inputScript.totalTics, 0, 'inputScript.totalTics');

  let previousTic = -1;

  for (const inputEvent of inputScript.events) {
    validateInputEvent(inputEvent);

    if (inputEvent.tic < previousTic) {
      throw new RangeError('Input script events must be sorted by tic');
    }

    previousTic = inputEvent.tic;
  }
}
