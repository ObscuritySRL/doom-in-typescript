import type { InputScriptEvent, InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_TITLE_LOOP_SCRIPT, INPUT_EVENT_KINDS, MOUSE_BUTTON_MAX, SCANCODE_MAX } from '../../oracles/inputScript.ts';

export const ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
export const ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND = 'bun run doom.ts';
export const ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID = '13-011';
export const ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_TITLE = 'accept-attract-loop-and-long-run-replays';

const DEFAULT_LONG_RUN_WINDOW_TIC_COUNT = 2;
const SHA256_HEX_LENGTH = 64;

export interface AcceptAttractLoopAndLongRunReplaysCommandContract {
  readonly entryFile: 'doom.ts';
  readonly runtimeCommand: typeof ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND;
}

export interface AcceptAttractLoopAndLongRunReplaysOptions {
  readonly demoBuffer: Buffer;
  readonly expectedLongRunWindowHashes?: readonly string[];
  readonly inputScript?: InputScriptPayload;
  readonly longRunWindowTicCount?: number;
  readonly runtimeCommand?: string;
  readonly singleDemo?: boolean;
}

export interface AttractLoopMarkerSnapshot {
  readonly completionAction: 'advance-demo' | 'none' | 'quit';
  readonly demoplayback: boolean;
  readonly netGame: boolean;
  readonly playersInGame: readonly boolean[];
  readonly ticIndex: number;
}

export interface AttractLoopMarkerTransitionEvidence {
  readonly afterMarker: AttractLoopMarkerSnapshot;
  readonly beforeMarker: AttractLoopMarkerSnapshot;
  readonly completionAction: 'advance-demo' | 'none' | 'quit';
}

export interface LongRunDriftEvent {
  readonly actualHash: string;
  readonly expectedHash: string;
  readonly windowIndex: number;
}

export interface LongRunWindowEvidence {
  readonly cumulativeHash: string;
  readonly expectedHash?: string;
  readonly hash: string;
  readonly matchesExpected: boolean;
  readonly startTic: number;
  readonly ticCount: number;
  readonly windowIndex: number;
}

export interface AcceptAttractLoopAndLongRunReplaysEvidence {
  readonly acceptanceHash: string;
  readonly auditManifestPath: typeof ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH;
  readonly commandContract: AcceptAttractLoopAndLongRunReplaysCommandContract;
  readonly demoTicCount: number;
  readonly inputScriptHash: string;
  readonly longRunDriftEvents: readonly LongRunDriftEvent[];
  readonly longRunReplayHash: string;
  readonly longRunWindows: readonly LongRunWindowEvidence[];
  readonly markerTransition: AttractLoopMarkerTransitionEvidence;
  readonly stepIdentifier: typeof ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID;
  readonly stepTitle: typeof ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_TITLE;
  readonly ticCommandHash: string;
  readonly ticSignatures: readonly string[];
}

/**
 * Accept deterministic attract-loop replay evidence through the product command path.
 *
 * @param options Replay bytes, optional title-loop script, and optional expected long-run hashes.
 * @returns Frozen deterministic evidence for attract-loop and long-run replay acceptance.
 *
 * @example
 * ```ts
 * import { acceptAttractLoopAndLongRunReplays } from './src/playable/demo-replay/acceptAttractLoopAndLongRunReplays.ts';
 *
 * const evidence = acceptAttractLoopAndLongRunReplays({ demoBuffer: await Bun.file('DEMO1.lmp').bytes().then(Buffer.from) });
 * console.log(evidence.commandContract.runtimeCommand); // "bun run doom.ts"
 * ```
 */
export function acceptAttractLoopAndLongRunReplays(options: AcceptAttractLoopAndLongRunReplaysOptions): Readonly<AcceptAttractLoopAndLongRunReplaysEvidence> {
  validateRuntimeCommand(options.runtimeCommand ?? ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND);

  const inputScript = options.inputScript ?? EMPTY_TITLE_LOOP_SCRIPT;
  validateTitleLoopInputScript(inputScript);

  const expectedLongRunWindowHashes = options.expectedLongRunWindowHashes ?? [];
  validateExpectedHashes(expectedLongRunWindowHashes);

  const longRunWindowTicCount = validatePositiveInteger(options.longRunWindowTicCount ?? DEFAULT_LONG_RUN_WINDOW_TIC_COUNT, 'longRunWindowTicCount');
  const playback = new DemoPlayback(options.demoBuffer, { singleDemo: options.singleDemo ?? false });
  const longRunDriftEvents: LongRunDriftEvent[] = [];
  const longRunWindows: LongRunWindowEvidence[] = [];
  const ticSignatures: string[] = [];
  const windowTicSignatures: string[] = [];

  let cumulativeHash = hashJson({
    inputScriptHash: hashJson(inputScript),
    stepIdentifier: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID,
  });
  let snapshotBeforeMarker = summarizeMarkerSnapshot(playback.snapshot());

  while (true) {
    const ticCommands = playback.readNextTic();

    if (ticCommands === null) {
      break;
    }

    const ticIndex = ticSignatures.length;
    const ticSignature = hashJson({
      ticCommands,
      ticIndex,
    });

    cumulativeHash = hashJson({
      cumulativeHash,
      ticSignature,
      ticIndex,
    });
    snapshotBeforeMarker = summarizeMarkerSnapshot(playback.snapshot());
    ticSignatures.push(ticSignature);
    windowTicSignatures.push(ticSignature);

    if (windowTicSignatures.length === longRunWindowTicCount) {
      pushLongRunWindow({
        cumulativeHash,
        expectedLongRunWindowHashes,
        longRunDriftEvents,
        longRunWindows,
        startTic: ticIndex - windowTicSignatures.length + 1,
        windowTicSignatures,
      });
    }
  }

  if (windowTicSignatures.length > 0) {
    pushLongRunWindow({
      cumulativeHash,
      expectedLongRunWindowHashes,
      longRunDriftEvents,
      longRunWindows,
      startTic: ticSignatures.length - windowTicSignatures.length,
      windowTicSignatures,
    });
  }

  if (ticSignatures.length === 0) {
    throw new RangeError('Attract-loop replay must contain at least one demo tic before the marker');
  }

  const snapshotAfterMarker = summarizeMarkerSnapshot(playback.snapshot());
  const markerTransition = Object.freeze({
    afterMarker: snapshotAfterMarker,
    beforeMarker: snapshotBeforeMarker,
    completionAction: snapshotAfterMarker.completionAction,
  } satisfies AttractLoopMarkerTransitionEvidence);
  const ticCommandHash = hashJson(ticSignatures);
  const longRunReplayHash = hashJson({
    longRunDriftEvents,
    longRunWindows,
    markerTransition,
    ticCommandHash,
  });
  const acceptanceHash = hashJson({
    commandContract: commandContract(),
    inputScriptHash: hashJson(inputScript),
    longRunReplayHash,
    stepIdentifier: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID,
  });

  return Object.freeze({
    acceptanceHash,
    auditManifestPath: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_AUDIT_MANIFEST_PATH,
    commandContract: commandContract(),
    demoTicCount: ticSignatures.length,
    inputScriptHash: hashJson(inputScript),
    longRunDriftEvents: Object.freeze([...longRunDriftEvents]),
    longRunReplayHash,
    longRunWindows: Object.freeze([...longRunWindows]),
    markerTransition,
    stepIdentifier: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_ID,
    stepTitle: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_STEP_TITLE,
    ticCommandHash,
    ticSignatures: Object.freeze([...ticSignatures]),
  });
}

function commandContract(): AcceptAttractLoopAndLongRunReplaysCommandContract {
  return Object.freeze({
    entryFile: 'doom.ts',
    runtimeCommand: ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND,
  });
}

function hashJson(value: unknown): string {
  return sha256Hex(JSON.stringify(value));
}

function isInputEventKind(value: unknown): value is InputScriptEvent['kind'] {
  const inputEventKindValues: readonly string[] = INPUT_EVENT_KINDS;
  return typeof value === 'string' && inputEventKindValues.includes(value);
}

function pushLongRunWindow(options: {
  readonly cumulativeHash: string;
  readonly expectedLongRunWindowHashes: readonly string[];
  readonly longRunDriftEvents: LongRunDriftEvent[];
  readonly longRunWindows: LongRunWindowEvidence[];
  readonly startTic: number;
  readonly windowTicSignatures: string[];
}): void {
  const hash = hashJson({
    cumulativeHash: options.cumulativeHash,
    startTic: options.startTic,
    ticSignatures: options.windowTicSignatures,
  });
  const windowIndex = options.longRunWindows.length;
  const expectedHash = options.expectedLongRunWindowHashes[windowIndex];
  const matchesExpected = expectedHash === undefined || expectedHash === hash;

  if (expectedHash !== undefined && !matchesExpected) {
    options.longRunDriftEvents.push(
      Object.freeze({
        actualHash: hash,
        expectedHash,
        windowIndex,
      }),
    );
  }

  options.longRunWindows.push(
    Object.freeze({
      cumulativeHash: options.cumulativeHash,
      expectedHash,
      hash,
      matchesExpected,
      startTic: options.startTic,
      ticCount: options.windowTicSignatures.length,
      windowIndex,
    }),
  );
  options.windowTicSignatures.length = 0;
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

function summarizeMarkerSnapshot(snapshot: ReturnType<DemoPlayback['snapshot']>): AttractLoopMarkerSnapshot {
  return Object.freeze({
    completionAction: snapshot.completionAction,
    demoplayback: snapshot.demoplayback,
    netGame: snapshot.netGame,
    playersInGame: Object.freeze([...snapshot.playersInGame]),
    ticIndex: snapshot.ticIndex,
  });
}

function validateExpectedHashes(expectedLongRunWindowHashes: readonly string[]): void {
  for (const [hashIndex, expectedHash] of expectedLongRunWindowHashes.entries()) {
    if (typeof expectedHash !== 'string' || expectedHash.length !== SHA256_HEX_LENGTH || !/^[0-9a-f]+$/.test(expectedHash)) {
      throw new RangeError(`expectedLongRunWindowHashes[${hashIndex}] must be a lowercase SHA-256 hex string`);
    }
  }
}

function validateInputEvent(inputEvent: InputScriptEvent, inputEventIndex: number, totalTics: number): void {
  validateNonnegativeInteger(inputEvent.tic, `inputScript.events[${inputEventIndex}].tic`);

  if (totalTics > 0 && inputEvent.tic >= totalTics) {
    throw new RangeError(`inputScript.events[${inputEventIndex}].tic must be less than totalTics`);
  }

  switch (inputEvent.kind) {
    case 'key-down':
    case 'key-up':
      validateUnsignedMaximum(inputEvent.scanCode, `inputScript.events[${inputEventIndex}].scanCode`, SCANCODE_MAX);
      break;
    case 'mouse-button-down':
    case 'mouse-button-up':
      validateUnsignedMaximum(inputEvent.button, `inputScript.events[${inputEventIndex}].button`, MOUSE_BUTTON_MAX);
      break;
    case 'mouse-move':
      validateInteger(inputEvent.deltaX, `inputScript.events[${inputEventIndex}].deltaX`);
      validateInteger(inputEvent.deltaY, `inputScript.events[${inputEventIndex}].deltaY`);
      break;
    case 'quit':
      break;
  }
}

function validateInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${fieldName} must be an integer`);
  }
}

function validateNonnegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a nonnegative integer`);
  }
}

function validatePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${fieldName} must be a positive integer`);
  }

  return value;
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND) {
    throw new Error(`Runtime command must be ${ACCEPT_ATTRACT_LOOP_AND_LONG_RUN_REPLAYS_RUNTIME_COMMAND}`);
  }
}

function validateTitleLoopInputScript(inputScript: InputScriptPayload): void {
  if (inputScript.targetRunMode !== 'title-loop') {
    throw new Error('Attract-loop acceptance requires a title-loop input script');
  }

  if (inputScript.ticRateHz !== 35) {
    throw new RangeError('Attract-loop input script must run at 35 Hz');
  }

  validateNonnegativeInteger(inputScript.totalTics, 'inputScript.totalTics');

  let previousTic = 0;

  for (const [inputEventIndex, inputEvent] of inputScript.events.entries()) {
    if (!isInputEventKind(inputEvent.kind)) {
      throw new Error(`inputScript.events[${inputEventIndex}].kind is not supported`);
    }

    if (inputEventIndex > 0 && inputEvent.tic < previousTic) {
      throw new RangeError('inputScript.events must be sorted by tic');
    }

    validateInputEvent(inputEvent, inputEventIndex, inputScript.totalTics);
    previousTic = inputEvent.tic;
  }
}

function validateUnsignedMaximum(value: number, fieldName: string, maximumValue: number): void {
  if (!Number.isInteger(value) || value < 0 || value > maximumValue) {
    throw new RangeError(`${fieldName} must be an integer in 0..${maximumValue}`);
  }
}
