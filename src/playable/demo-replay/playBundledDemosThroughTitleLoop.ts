import type { DemoPlayback, DemoPlaybackCompletionAction } from '../../demo/demoPlayback.ts';

import { EMPTY_DEMO_PLAYBACK_SCRIPT, EMPTY_TITLE_LOOP_SCRIPT } from '../../oracles/inputScript.ts';

export const PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
} as const);

export const BUNDLED_DEMO_LUMP_NAMES = Object.freeze(['DEMO1', 'DEMO2', 'DEMO3'] as const);

export type BundledDemoLumpName = (typeof BUNDLED_DEMO_LUMP_NAMES)[number];
export type TitleLoopLumpName = BundledDemoLumpName | 'TITLEPIC';
export type TitleLoopTransitionAction = 'advance-demo' | 'show-title-page' | 'start-demo' | 'wrap-title-loop';

export interface BundledDemoPlaybackSource {
  readonly lumpName: BundledDemoLumpName;
  readonly playback: Pick<DemoPlayback, 'readNextTic' | 'snapshot'>;
}

export interface PlayBundledDemosThroughTitleLoopOptions {
  readonly demoSources: readonly BundledDemoPlaybackSource[];
  readonly maximumDemoTics?: number;
  readonly runtimeCommand: string;
}

export interface TitleLoopReplayResult {
  readonly completionActions: readonly DemoPlaybackCompletionAction[];
  readonly deterministicReplayHash: string;
  readonly inputScriptDescriptions: readonly string[];
  readonly runtimeCommand: string;
  readonly targetReplayContract: Readonly<TitleLoopReplayTargetContract>;
  readonly ticRateHz: number;
  readonly totalDemoTics: number;
  readonly transitions: readonly Readonly<TitleLoopTransition>[];
}

export interface TitleLoopReplayTargetContract {
  readonly acceptanceMode: 'side-by-side-verifiable replay parity';
  readonly requiredCommand: 'bun run doom.ts';
  readonly sourceAuditStepId: '01-015';
}

export interface TitleLoopTransition {
  readonly action: TitleLoopTransitionAction;
  readonly demoIndex: number;
  readonly lumpName: TitleLoopLumpName;
  readonly scriptDescription: string;
  readonly ticCount: number;
}

interface ReplayHashEvidence {
  readonly completionActions: readonly DemoPlaybackCompletionAction[];
  readonly inputScriptDescriptions: readonly string[];
  readonly runtimeCommand: string;
  readonly targetReplayContract: Readonly<TitleLoopReplayTargetContract>;
  readonly ticRateHz: number;
  readonly totalDemoTics: number;
  readonly transitions: readonly Readonly<TitleLoopTransition>[];
}

const DEFAULT_MAXIMUM_DEMO_TICS = 0xffff;

const TITLE_LOOP_TARGET_CONTRACT: Readonly<TitleLoopReplayTargetContract> = Object.freeze({
  acceptanceMode: 'side-by-side-verifiable replay parity',
  requiredCommand: PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand,
  sourceAuditStepId: '01-015',
});

/**
 * Consume the bundled DEMO1/DEMO2/DEMO3 playback streams as one title-loop pass.
 *
 * @param options Demo playback sources and the runtime command being exercised.
 * @returns Frozen deterministic replay evidence for the title-loop demo pass.
 *
 * @example
 * ```ts
 * import { playBundledDemosThroughTitleLoop } from './src/playable/demo-replay/playBundledDemosThroughTitleLoop.ts';
 *
 * const evidence = playBundledDemosThroughTitleLoop({
 *   demoSources,
 *   runtimeCommand: 'bun run doom.ts',
 * });
 * console.log(evidence.transitions.at(-1)?.action);
 * ```
 */
export function playBundledDemosThroughTitleLoop(options: PlayBundledDemosThroughTitleLoopOptions): Readonly<TitleLoopReplayResult> {
  validateRuntimeCommand(options.runtimeCommand);
  validateBundledDemoSources(options.demoSources);

  const maximumDemoTics = validateMaximumDemoTics(options.maximumDemoTics ?? DEFAULT_MAXIMUM_DEMO_TICS);
  const completionActions: DemoPlaybackCompletionAction[] = [];
  const inputScriptDescriptions = Object.freeze([EMPTY_TITLE_LOOP_SCRIPT.description, EMPTY_DEMO_PLAYBACK_SCRIPT.description] as const);
  const transitions: TitleLoopTransition[] = [
    {
      action: 'show-title-page',
      demoIndex: -1,
      lumpName: 'TITLEPIC',
      scriptDescription: EMPTY_TITLE_LOOP_SCRIPT.description,
      ticCount: 0,
    },
  ];
  let totalDemoTics = 0;

  for (let demoIndex = 0; demoIndex < BUNDLED_DEMO_LUMP_NAMES.length; demoIndex += 1) {
    const demoSource = options.demoSources[demoIndex];
    const expectedLumpName = BUNDLED_DEMO_LUMP_NAMES[demoIndex];
    transitions.push({
      action: 'start-demo',
      demoIndex,
      lumpName: expectedLumpName,
      scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
      ticCount: 0,
    });

    const ticCount = consumeDemoPlayback(demoSource.playback, expectedLumpName, maximumDemoTics);
    const snapshot = demoSource.playback.snapshot();
    validateDemoCompletion(snapshot.completionAction, expectedLumpName);
    completionActions.push('advance-demo');
    totalDemoTics += ticCount;
    transitions.push({
      action: 'advance-demo',
      demoIndex,
      lumpName: expectedLumpName,
      scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
      ticCount,
    });
  }

  transitions.push({
    action: 'wrap-title-loop',
    demoIndex: 0,
    lumpName: 'TITLEPIC',
    scriptDescription: EMPTY_TITLE_LOOP_SCRIPT.description,
    ticCount: 0,
  });

  const frozenCompletionActions = Object.freeze([...completionActions]);
  const frozenTransitions = Object.freeze(transitions.map((transition) => Object.freeze({ ...transition })));
  const hashEvidence: ReplayHashEvidence = {
    completionActions: frozenCompletionActions,
    inputScriptDescriptions,
    runtimeCommand: PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand,
    targetReplayContract: TITLE_LOOP_TARGET_CONTRACT,
    ticRateHz: EMPTY_TITLE_LOOP_SCRIPT.ticRateHz,
    totalDemoTics,
    transitions: frozenTransitions,
  };

  return Object.freeze({
    completionActions: frozenCompletionActions,
    deterministicReplayHash: hashDeterministicEvidence(hashEvidence),
    inputScriptDescriptions,
    runtimeCommand: PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand,
    targetReplayContract: TITLE_LOOP_TARGET_CONTRACT,
    ticRateHz: EMPTY_TITLE_LOOP_SCRIPT.ticRateHz,
    totalDemoTics,
    transitions: frozenTransitions,
  });
}

function consumeDemoPlayback(playback: Pick<DemoPlayback, 'readNextTic' | 'snapshot'>, lumpName: BundledDemoLumpName, maximumDemoTics: number): number {
  let ticCount = 0;

  while (playback.readNextTic() !== null) {
    ticCount += 1;

    if (ticCount > maximumDemoTics) {
      throw new RangeError(`${lumpName} exceeded maximum demo tic limit ${maximumDemoTics}`);
    }
  }

  return ticCount;
}

function hashDeterministicEvidence(evidence: ReplayHashEvidence): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(evidence));
  return hasher.digest('hex');
}

function validateBundledDemoSources(demoSources: readonly BundledDemoPlaybackSource[]): void {
  if (demoSources.length !== BUNDLED_DEMO_LUMP_NAMES.length) {
    throw new RangeError(`Expected ${BUNDLED_DEMO_LUMP_NAMES.length} bundled demo sources, got ${demoSources.length}`);
  }

  for (let demoIndex = 0; demoIndex < BUNDLED_DEMO_LUMP_NAMES.length; demoIndex += 1) {
    const expectedLumpName = BUNDLED_DEMO_LUMP_NAMES[demoIndex];
    const observedLumpName = demoSources[demoIndex]?.lumpName;

    if (observedLumpName !== expectedLumpName) {
      throw new RangeError(`Expected bundled demo ${expectedLumpName} at index ${demoIndex}, got ${observedLumpName ?? 'missing'}`);
    }
  }
}

function validateDemoCompletion(completionAction: DemoPlaybackCompletionAction, lumpName: BundledDemoLumpName): void {
  if (completionAction !== 'advance-demo') {
    throw new RangeError(`${lumpName} completed with ${completionAction}, expected advance-demo for title-loop playback`);
  }
}

function validateMaximumDemoTics(maximumDemoTics: number): number {
  if (!Number.isInteger(maximumDemoTics) || maximumDemoTics < 0) {
    throw new RangeError(`maximumDemoTics must be a non-negative integer, got ${maximumDemoTics}`);
  }

  return maximumDemoTics;
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand) {
    throw new RangeError(`Expected runtime command ${PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand}, got ${runtimeCommand}`);
  }
}
