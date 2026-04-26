import type { DemoPlaybackCompletionAction, DemoPlaybackSnapshot } from '../../demo/demoPlayback.ts';
import type { InputScriptEvent, InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';

export const PRESERVE_DEMO_TERMINATION_BEHAVIOR_AUDIT_EVIDENCE = Object.freeze({
  missingSurface: 'input-trace-replay-loader',
  requiredCommand: 'bun run doom.ts',
  sourceManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
  stepId: '13-006',
} as const);

export const PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
} as const);

export interface PreserveDemoTerminationBehaviorEvidence {
  readonly activePlayerCounts: readonly number[];
  readonly auditEvidence: typeof PRESERVE_DEMO_TERMINATION_BEHAVIOR_AUDIT_EVIDENCE;
  readonly commandContract: typeof PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT;
  readonly completionAction: DemoPlaybackCompletionAction;
  readonly completionSnapshot: Readonly<DemoPlaybackSnapshot>;
  readonly inputScript: InputScriptPayload;
  readonly markerBoundary: PreserveDemoTerminationBehaviorMarkerBoundary;
  readonly markerBoundarySnapshot: Readonly<DemoPlaybackSnapshot>;
  readonly replayHash: string;
  readonly ticCommandHashes: readonly string[];
  readonly ticCount: number;
}

export interface PreserveDemoTerminationBehaviorMarkerBoundary {
  readonly completionAction: DemoPlaybackCompletionAction;
  readonly demoplaybackAfterMarker: boolean;
  readonly demoplaybackBeforeMarker: boolean;
  readonly finalReadResult: 'null';
  readonly netDemoAfterMarker: boolean;
  readonly netGameAfterMarker: boolean;
  readonly readAtMarkerTic: number;
  readonly singleDemo: boolean;
}

export interface PreserveDemoTerminationBehaviorOptions {
  readonly command: string;
  readonly demoBuffer: Uint8Array;
  readonly singleDemo?: boolean;
}

/**
 * Preserve Doom demo termination evidence for the Bun playable command.
 *
 * @param options - Demo bytes, command contract, and single-demo mode.
 * @returns Frozen deterministic evidence for the demo marker transition.
 * @example
 * ```ts
 * import { preserveDemoTerminationBehavior } from './src/playable/demo-replay/preserveDemoTerminationBehavior.ts';
 *
 * const demoBuffer = Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0x80]);
 * preserveDemoTerminationBehavior({ command: 'bun run doom.ts', demoBuffer }).completionAction;
 * ```
 */
export function preserveDemoTerminationBehavior(options: PreserveDemoTerminationBehaviorOptions): PreserveDemoTerminationBehaviorEvidence {
  validateProductCommand(options.command);

  const playback = new DemoPlayback(Buffer.from(options.demoBuffer), {
    singleDemo: options.singleDemo === true,
  });
  const activePlayerCounts: number[] = [];
  let markerBoundarySnapshot = playback.snapshot();
  const ticCommandHashes: string[] = [];
  let ticCommands = playback.readNextTic();

  while (ticCommands !== null) {
    activePlayerCounts.push(ticCommands.length);
    ticCommandHashes.push(sha256Hex(JSON.stringify(ticCommands)));
    markerBoundarySnapshot = playback.snapshot();
    ticCommands = playback.readNextTic();
  }

  const completionSnapshot = playback.snapshot();
  const completionAction = completionSnapshot.completionAction;

  if (completionAction !== 'advance-demo' && completionAction !== 'quit') {
    throw new Error('Demo playback did not reach termination marker');
  }

  const inputScript = createInputScript(completionAction, completionSnapshot.ticIndex);
  const markerBoundary = Object.freeze({
    completionAction,
    demoplaybackAfterMarker: completionSnapshot.demoplayback,
    demoplaybackBeforeMarker: markerBoundarySnapshot.demoplayback,
    finalReadResult: 'null',
    netDemoAfterMarker: completionSnapshot.netDemo,
    netGameAfterMarker: completionSnapshot.netGame,
    readAtMarkerTic: completionSnapshot.ticIndex,
    singleDemo: completionSnapshot.singleDemo,
  } satisfies PreserveDemoTerminationBehaviorMarkerBoundary);
  const evidenceWithoutHash = {
    activePlayerCounts: Object.freeze([...activePlayerCounts]),
    auditEvidence: PRESERVE_DEMO_TERMINATION_BEHAVIOR_AUDIT_EVIDENCE,
    commandContract: PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT,
    completionAction,
    completionSnapshot,
    inputScript,
    markerBoundary,
    markerBoundarySnapshot,
    ticCommandHashes: Object.freeze([...ticCommandHashes]),
    ticCount: completionSnapshot.ticIndex,
  };

  return Object.freeze({
    ...evidenceWithoutHash,
    replayHash: sha256Hex(JSON.stringify(evidenceWithoutHash)),
  });
}

function createInputScript(completionAction: DemoPlaybackCompletionAction, ticIndex: number): InputScriptPayload {
  const quitEvent: InputScriptEvent = Object.freeze({
    kind: 'quit',
    tic: ticIndex,
  });
  const inputEvents: readonly InputScriptEvent[] = completionAction === 'quit' ? Object.freeze([quitEvent]) : EMPTY_DEMO_PLAYBACK_SCRIPT.events;

  return Object.freeze({
    description: completionAction === 'quit' ? 'Single-demo quit termination after marker consumption' : 'Attract-loop demo advance after marker consumption',
    events: inputEvents,
    targetRunMode: EMPTY_DEMO_PLAYBACK_SCRIPT.targetRunMode,
    ticRateHz: EMPTY_DEMO_PLAYBACK_SCRIPT.ticRateHz,
    totalTics: ticIndex,
  } satisfies InputScriptPayload);
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

function validateProductCommand(command: string): void {
  if (command !== PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`Expected command ${PRESERVE_DEMO_TERMINATION_BEHAVIOR_COMMAND_CONTRACT.runtimeCommand}, got ${command}`);
  }
}
