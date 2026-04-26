import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';

import type { DemoPlaybackSnapshot } from '../../demo/demoPlayback.ts';
import type { InputScriptPayload } from '../../oracles/inputScript.ts';

export const REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND = 'bun run doom.ts';

export interface ReplayDemo3DeterministicallyEvidence {
  readonly auditManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
  readonly commandContract: typeof REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND;
  readonly demoName: 'DEMO3';
  readonly finalSnapshot: Readonly<DemoPlaybackSnapshot>;
  readonly inputScript: InputScriptPayload;
  readonly replayHash: string;
  readonly ticCommandHash: string;
  readonly ticCount: number;
  readonly ticSignatures: readonly ReplayDemo3TicSignature[];
}

export interface ReplayDemo3DeterministicallyOptions {
  readonly runtimeCommand?: string;
}

export interface ReplayDemo3TicSignature {
  readonly activePlayerCount: number;
  readonly commandHash: string;
  readonly ticIndex: number;
}

/**
 * Replay a DEMO3-compatible vanilla demo buffer through the Bun product command contract.
 *
 * @param demoBuffer - Versioned vanilla demo bytes from the bundled DEMO3 lump.
 * @param options - Optional runtime command override for command-contract validation.
 * @returns Frozen deterministic evidence for DEMO3 replay parity.
 *
 * @example
 * ```ts
 * import { replayDemo3Deterministically } from './src/playable/demo-replay/replayDemo3Deterministically.ts';
 *
 * const evidence = replayDemo3Deterministically(await Bun.file('DEMO3.lmp').bytes().then(Buffer.from));
 * console.log(evidence.demoName);
 * ```
 */
export function replayDemo3Deterministically(demoBuffer: Buffer, options: ReplayDemo3DeterministicallyOptions = {}): Readonly<ReplayDemo3DeterministicallyEvidence> {
  validateRuntimeCommand(options.runtimeCommand ?? REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND);

  const playback = new DemoPlayback(demoBuffer);
  const ticSignatures: ReplayDemo3TicSignature[] = [];

  for (;;) {
    const ticCommands = playback.readNextTic();

    if (ticCommands === null) {
      break;
    }

    const serializedCommands = JSON.stringify(ticCommands);
    ticSignatures.push(
      Object.freeze({
        activePlayerCount: ticCommands.length,
        commandHash: sha256Hex(serializedCommands),
        ticIndex: ticSignatures.length,
      }),
    );
  }

  if (ticSignatures.length === 0) {
    throw new RangeError('DEMO3 deterministic replay requires at least one tic');
  }

  const finalSnapshot = playback.snapshot();

  if (finalSnapshot.completionAction !== 'advance-demo') {
    throw new Error(`DEMO3 deterministic replay finished with ${finalSnapshot.completionAction}`);
  }

  const frozenTicSignatures = Object.freeze([...ticSignatures]);
  const ticCommandHash = sha256Hex(JSON.stringify(frozenTicSignatures));
  const replayPayload = {
    auditManifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    commandContract: REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND,
    demoName: 'DEMO3',
    finalSnapshot,
    inputScript: EMPTY_DEMO_PLAYBACK_SCRIPT,
    ticCommandHash,
    ticCount: frozenTicSignatures.length,
    ticSignatures: frozenTicSignatures,
  } satisfies Omit<ReplayDemo3DeterministicallyEvidence, 'replayHash'>;

  return Object.freeze({
    ...replayPayload,
    replayHash: sha256Hex(JSON.stringify(replayPayload)),
  });
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND) {
    throw new Error(`DEMO3 deterministic replay requires ${REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND}`);
  }
}
