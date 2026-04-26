import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';

export const REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
} satisfies ReplayDemo2DeterministicallyCommandContract);

export interface ReplayDemo2DeterministicallyCommandContract {
  readonly entryFile: 'doom.ts';
  readonly runtimeCommand: 'bun run doom.ts';
}

export interface ReplayDemo2DeterministicallyEvidence {
  readonly auditManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
  readonly commandContract: ReplayDemo2DeterministicallyCommandContract;
  readonly completionAction: 'advance-demo';
  readonly demoName: 'DEMO2';
  readonly inputScriptDescription: typeof EMPTY_DEMO_PLAYBACK_SCRIPT.description;
  readonly inputScriptTargetRunMode: typeof EMPTY_DEMO_PLAYBACK_SCRIPT.targetRunMode;
  readonly playerCount: number;
  readonly replayHash: string;
  readonly ticCommandHash: string;
  readonly ticCount: number;
  readonly ticSignatures: readonly string[];
}

export interface ReplayDemo2DeterministicallyOptions {
  readonly runtimeCommand?: string;
}

/**
 * Replay a DEMO2 stream through the Bun-run playable command contract.
 *
 * @param demoBuffer Vanilla demo bytes for DEMO2.
 * @param options Optional runtime-command override used by boundary tests.
 * @returns Frozen deterministic replay evidence for DEMO2.
 * @example
 * ```ts
 * import { replayDemo2Deterministically } from './src/playable/demo-replay/replayDemo2Deterministically.ts';
 *
 * const evidence = replayDemo2Deterministically(await Bun.file('DEMO2.lmp').bytes().then(Buffer.from));
 * console.log(evidence.replayHash);
 * ```
 */
export function replayDemo2Deterministically(demoBuffer: Buffer, options: ReplayDemo2DeterministicallyOptions = {}): Readonly<ReplayDemo2DeterministicallyEvidence> {
  const runtimeCommand = options.runtimeCommand ?? REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT.runtimeCommand;
  if (runtimeCommand !== REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error('replay-demo2-deterministically requires bun run doom.ts');
  }

  const playback = new DemoPlayback(demoBuffer);
  const ticSignatures: string[] = [];

  for (;;) {
    const ticCommands = playback.readNextTic();
    if (ticCommands === null) {
      break;
    }

    ticSignatures.push(sha256Text(JSON.stringify(ticCommands)));
  }

  const snapshot = playback.snapshot();
  if (snapshot.ticIndex === 0) {
    throw new RangeError('DEMO2 replay must contain at least one tic');
  }

  if (snapshot.completionAction !== 'advance-demo') {
    throw new Error(`DEMO2 replay completion must advance the attract loop, got ${snapshot.completionAction}`);
  }

  const evidenceWithoutReplayHash = {
    auditManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    commandContract: REPLAY_DEMO2_DETERMINISTICALLY_COMMAND_CONTRACT,
    completionAction: 'advance-demo',
    demoName: 'DEMO2',
    inputScriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
    inputScriptTargetRunMode: EMPTY_DEMO_PLAYBACK_SCRIPT.targetRunMode,
    playerCount: snapshot.playersInGame.length,
    ticCommandHash: sha256Text(ticSignatures.join('\n')),
    ticCount: snapshot.ticIndex,
    ticSignatures: Object.freeze([...ticSignatures]),
  } satisfies Omit<ReplayDemo2DeterministicallyEvidence, 'replayHash'>;

  return Object.freeze({
    ...evidenceWithoutReplayHash,
    replayHash: sha256Text(JSON.stringify(evidenceWithoutReplayHash)),
  });
}

function sha256Text(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
