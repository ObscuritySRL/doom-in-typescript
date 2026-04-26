import type { DemoPlaybackCompletionAction } from '../../demo/demoPlayback.ts';
import type { InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';

/** Command contract for the playable long-run drift detector. */
export const DETECT_LONG_RUN_DRIFT_COMMAND = 'bun run doom.ts';

/** Audit linkage for the missing side-by-side replay surface this step fills. */
export interface DetectLongRunDriftAuditEvidence {
  readonly manifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
  readonly missingSurface: 'synchronized-tic-stepper';
  readonly requiredCommand: typeof DETECT_LONG_RUN_DRIFT_COMMAND;
  readonly stepId: '01-015';
}

/** Runtime command contract recorded in drift evidence. */
export interface DetectLongRunDriftCommandContract {
  readonly entryFile: 'doom.ts';
  readonly runtimeCommand: typeof DETECT_LONG_RUN_DRIFT_COMMAND;
}

/** A mismatch between an expected long-run window and the observed replay window. */
export interface LongRunDriftEvent {
  readonly expectedWindowHash: string | null;
  readonly observedWindowHash: string | null;
  readonly windowIndex: number;
}

/** One deterministic replay window used for long-run drift comparison. */
export interface LongRunDriftWindow {
  readonly cumulativeHash: string;
  readonly firstTic: number;
  readonly lastTic: number;
  readonly ticCommandHash: string;
  readonly ticCount: number;
  readonly windowHash: string;
  readonly windowIndex: number;
}

/** Options for replay drift detection. */
export interface DetectLongRunDriftOptions {
  readonly command?: string;
  readonly expectedWindowHashes?: readonly string[];
  readonly singleDemo?: boolean;
  readonly windowTics?: number;
}

/** Replay transition recorded when the demo marker is consumed. */
export interface LongRunDriftTransition {
  readonly completionAction: Exclude<DemoPlaybackCompletionAction, 'none'>;
  readonly from: 'demo-playback';
  readonly markerConsumed: true;
  readonly to: 'long-run-drift-report';
}

/** Frozen evidence for a long-run deterministic replay drift pass. */
export interface DetectLongRunDriftEvidence {
  readonly auditEvidence: DetectLongRunDriftAuditEvidence;
  readonly commandContract: DetectLongRunDriftCommandContract;
  readonly completionAction: Exclude<DemoPlaybackCompletionAction, 'none'>;
  readonly driftEvents: readonly LongRunDriftEvent[];
  readonly driftStatus: 'detected' | 'not-detected';
  readonly inputScript: InputScriptPayload;
  readonly replayHash: string;
  readonly ticCommandHash: string;
  readonly ticCount: number;
  readonly transition: LongRunDriftTransition;
  readonly windowTics: number;
  readonly windows: readonly LongRunDriftWindow[];
}

/**
 * Consume a vanilla demo stream and emit deterministic long-run drift evidence.
 *
 * @param demoBuffer - Vanilla demo bytes to replay through the deterministic marker boundary.
 * @param options - Optional runtime command, expected window hashes, single-demo flag, and window size.
 * @returns Frozen drift evidence with replay-window hashes and detected mismatches.
 *
 * @example
 * ```ts
 * import { detectLongRunDrift } from './src/playable/demo-replay/detectLongRunDrift.ts';
 *
 * const demo = Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4, 0x80]);
 * console.log(detectLongRunDrift(demo).driftStatus);
 * ```
 */
export function detectLongRunDrift(demoBuffer: Buffer, options: DetectLongRunDriftOptions = {}): Readonly<DetectLongRunDriftEvidence> {
  const command = options.command ?? DETECT_LONG_RUN_DRIFT_COMMAND;
  if (command !== DETECT_LONG_RUN_DRIFT_COMMAND) {
    throw new RangeError(`detect-long-run-drift requires ${DETECT_LONG_RUN_DRIFT_COMMAND}`);
  }

  const windowTics = options.windowTics ?? 35;
  if (!Number.isInteger(windowTics) || windowTics <= 0) {
    throw new RangeError(`windowTics must be a positive integer, got ${windowTics}`);
  }

  const playback = new DemoPlayback(demoBuffer, {
    singleDemo: options.singleDemo,
  });
  const ticCommandHashes: string[] = [];
  const windowCommandHashes: string[] = [];
  const windows: LongRunDriftWindow[] = [];
  let cumulativeHash = '';
  let firstWindowTic = 0;
  let ticCommands = playback.readNextTic();

  while (ticCommands !== null) {
    const ticCommandHash = hashStableValue(ticCommands);
    ticCommandHashes.push(ticCommandHash);
    windowCommandHashes.push(ticCommandHash);

    if (windowCommandHashes.length === windowTics) {
      cumulativeHash = pushWindow(windows, firstWindowTic, windowCommandHashes, cumulativeHash);
      firstWindowTic += windowCommandHashes.length;
      windowCommandHashes.length = 0;
    }

    ticCommands = playback.readNextTic();
  }

  if (ticCommandHashes.length === 0) {
    throw new RangeError('detect-long-run-drift requires at least one demo tic before the marker');
  }

  if (windowCommandHashes.length > 0) {
    cumulativeHash = pushWindow(windows, firstWindowTic, windowCommandHashes, cumulativeHash);
  }

  const snapshot = playback.snapshot();
  const completionAction = snapshot.completionAction;
  if (completionAction === 'none') {
    throw new RangeError('detect-long-run-drift did not consume the demo marker');
  }

  const expectedWindowHashes = options.expectedWindowHashes ?? windows.map((window) => window.windowHash);
  const driftEvents = collectDriftEvents(expectedWindowHashes, windows);
  const evidence: DetectLongRunDriftEvidence = {
    auditEvidence: Object.freeze({
      manifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      missingSurface: 'synchronized-tic-stepper',
      requiredCommand: DETECT_LONG_RUN_DRIFT_COMMAND,
      stepId: '01-015',
    }),
    commandContract: Object.freeze({
      entryFile: 'doom.ts',
      runtimeCommand: DETECT_LONG_RUN_DRIFT_COMMAND,
    }),
    completionAction,
    driftEvents: Object.freeze(driftEvents),
    driftStatus: driftEvents.length === 0 ? 'not-detected' : 'detected',
    inputScript: EMPTY_DEMO_PLAYBACK_SCRIPT,
    replayHash: hashStableValue({
      completionAction,
      ticCommandHash: hashStableValue(ticCommandHashes),
      ticCount: ticCommandHashes.length,
      windowHashes: windows.map((window) => window.windowHash),
      windowTics,
    }),
    ticCommandHash: hashStableValue(ticCommandHashes),
    ticCount: ticCommandHashes.length,
    transition: Object.freeze({
      completionAction,
      from: 'demo-playback',
      markerConsumed: true,
      to: 'long-run-drift-report',
    }),
    windowTics,
    windows: Object.freeze(windows),
  };

  return Object.freeze(evidence);
}

function collectDriftEvents(expectedWindowHashes: readonly string[], windows: readonly LongRunDriftWindow[]): readonly LongRunDriftEvent[] {
  const driftEvents: LongRunDriftEvent[] = [];
  const windowCount = Math.max(expectedWindowHashes.length, windows.length);

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const expectedWindowHash = expectedWindowHashes[windowIndex] ?? null;
    const observedWindowHash = windows[windowIndex]?.windowHash ?? null;
    if (expectedWindowHash !== observedWindowHash) {
      driftEvents.push(
        Object.freeze({
          expectedWindowHash,
          observedWindowHash,
          windowIndex,
        }),
      );
    }
  }

  return driftEvents;
}

function hashStableValue(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

function pushWindow(windows: LongRunDriftWindow[], firstTic: number, windowCommandHashes: readonly string[], previousCumulativeHash: string): string {
  const ticCommandHash = hashStableValue(windowCommandHashes);
  const windowHash = hashStableValue({
    firstTic,
    lastTic: firstTic + windowCommandHashes.length - 1,
    ticCommandHash,
    ticCount: windowCommandHashes.length,
    windowIndex: windows.length,
  });
  const cumulativeHash = hashStableValue([previousCumulativeHash, windowHash]);
  windows.push(
    Object.freeze({
      cumulativeHash,
      firstTic,
      lastTic: firstTic + windowCommandHashes.length - 1,
      ticCommandHash,
      ticCount: windowCommandHashes.length,
      windowHash,
      windowIndex: windows.length,
    }),
  );
  return cumulativeHash;
}
