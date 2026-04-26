import type { DemoPlaybackSnapshot } from '../../demo/demoPlayback.ts';
import type { InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';

export interface ReplayDemo1DeterministicallyCommandContract {
  readonly entryFile: 'doom.ts';
  readonly runtimeCommand: 'bun run doom.ts';
}

export interface ReplayDemo1DeterministicallyEvidence {
  readonly commandContract: ReplayDemo1DeterministicallyCommandContract;
  readonly demoName: 'DEMO1';
  readonly demoPlaybackScript: InputScriptPayload;
  readonly finalSnapshot: DemoPlaybackSnapshot;
  readonly firstTicSignature: string;
  readonly lastTicSignature: string;
  readonly manifestStepId: '01-015';
  readonly parsedDemo: ReplayDemo1ParsedDemoEvidence;
  readonly replayHash: string;
  readonly ticCommandHash: string;
  readonly transition: ReplayDemo1TransitionEvidence;
}

export interface ReplayDemo1DeterministicallyOptions {
  readonly runtimeCommand?: string;
}

export interface ReplayDemo1ParsedDemoEvidence {
  readonly activePlayerCount: number;
  readonly commandByteLength: number;
  readonly durationSeconds: number;
  readonly endMarkerOffset: number;
  readonly episode: number;
  readonly format: string;
  readonly headerByteLength: number;
  readonly map: number;
  readonly playersInGame: readonly boolean[];
  readonly skill: number;
  readonly ticCount: number;
  readonly versionByte: null | number;
}

export interface ReplayDemo1TransitionEvidence {
  readonly completionAction: 'advance-demo';
  readonly initialSnapshot: DemoPlaybackSnapshot;
  readonly markerReadResult: null;
  readonly postCompletionSnapshot: DemoPlaybackSnapshot;
}

export const REPLAY_DEMO1_DETERMINISTICALLY_COMMAND_CONTRACT: ReplayDemo1DeterministicallyCommandContract = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
});

export function replayDemo1Deterministically(demo1Buffer: Buffer, options: ReplayDemo1DeterministicallyOptions = {}): Readonly<ReplayDemo1DeterministicallyEvidence> {
  const runtimeCommand = options.runtimeCommand ?? REPLAY_DEMO1_DETERMINISTICALLY_COMMAND_CONTRACT.runtimeCommand;
  validateRuntimeCommand(runtimeCommand);

  const playback = new DemoPlayback(demo1Buffer);
  const initialSnapshot = playback.snapshot();
  const ticCommandHasher = new Bun.CryptoHasher('sha256');
  let firstTicSignature = '';
  let lastTicSignature = '';
  let replayedTicCount = 0;

  while (true) {
    const ticCommands = playback.readNextTic();
    if (ticCommands === null) {
      break;
    }

    const ticSignature = JSON.stringify(ticCommands);
    if (replayedTicCount === 0) {
      firstTicSignature = ticSignature;
    }

    lastTicSignature = ticSignature;
    ticCommandHasher.update(`${replayedTicCount}:${ticSignature}\n`);
    replayedTicCount += 1;
  }

  const finalSnapshot = playback.snapshot();
  const parsedDemo = playback.parsedDemo;

  if (replayedTicCount === 0) {
    throw new Error('DEMO1 deterministic replay produced no tic commands');
  }

  if (replayedTicCount !== parsedDemo.ticCount || finalSnapshot.ticIndex !== parsedDemo.ticCount) {
    throw new Error('DEMO1 deterministic replay did not consume every parsed tic');
  }

  if (finalSnapshot.completionAction !== 'advance-demo') {
    throw new Error('DEMO1 deterministic replay must advance the title loop on completion');
  }

  const parsedDemoEvidence = Object.freeze({
    activePlayerCount: parsedDemo.activePlayerCount,
    commandByteLength: parsedDemo.commandByteLength,
    durationSeconds: parsedDemo.durationSeconds,
    endMarkerOffset: parsedDemo.endMarkerOffset,
    episode: parsedDemo.episode,
    format: parsedDemo.format,
    headerByteLength: parsedDemo.headerByteLength,
    map: parsedDemo.map,
    playersInGame: Object.freeze([...parsedDemo.playersInGame]),
    skill: parsedDemo.skill,
    ticCount: parsedDemo.ticCount,
    versionByte: parsedDemo.versionByte ?? null,
  } satisfies ReplayDemo1ParsedDemoEvidence);
  const ticCommandHash = ticCommandHasher.digest('hex');
  const transition = Object.freeze({
    completionAction: 'advance-demo',
    initialSnapshot,
    markerReadResult: null,
    postCompletionSnapshot: finalSnapshot,
  } satisfies ReplayDemo1TransitionEvidence);
  const replayPayload = {
    commandContract: REPLAY_DEMO1_DETERMINISTICALLY_COMMAND_CONTRACT,
    demoName: 'DEMO1',
    demoPlaybackScript: EMPTY_DEMO_PLAYBACK_SCRIPT,
    finalSnapshot,
    firstTicSignature,
    lastTicSignature,
    manifestStepId: '01-015',
    parsedDemo: parsedDemoEvidence,
    ticCommandHash,
    transition,
  } satisfies Omit<ReplayDemo1DeterministicallyEvidence, 'replayHash'>;

  return Object.freeze({
    ...replayPayload,
    replayHash: sha256Hex(JSON.stringify(replayPayload)),
  } satisfies ReplayDemo1DeterministicallyEvidence);
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== REPLAY_DEMO1_DETERMINISTICALLY_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error('replay-demo1-deterministically requires bun run doom.ts');
  }
}
