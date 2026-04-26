import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';
import type { InputScriptPayload } from '../../oracles/inputScript.ts';

export const CONVERT_DEMO_INPUT_STREAM_COMMAND = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
} as const);

export interface ConvertDemoInputStreamAuditEvidence {
  readonly missingSurface: 'input-trace-replay-loader';
  readonly schemaVersion: 1;
  readonly stepIdentifier: '01-015';
}

export interface ConvertDemoInputStreamEvidence {
  readonly activePlayerCounts: readonly number[];
  readonly auditEvidence: Readonly<ConvertDemoInputStreamAuditEvidence>;
  readonly commandContract: typeof CONVERT_DEMO_INPUT_STREAM_COMMAND;
  readonly completionAction: 'advance-demo' | 'quit';
  readonly demoName: string;
  readonly inputScript: Readonly<InputScriptPayload>;
  readonly replayHash: string;
  readonly ticCommandHash: string;
  readonly ticSignatures: readonly Readonly<ConvertedDemoInputStreamTic>[];
  readonly totalTics: number;
}

export interface ConvertDemoInputStreamOptions {
  readonly command?: string;
  readonly demoName?: string;
  readonly description?: string;
  readonly singleDemo?: boolean;
}

export interface ConvertedDemoInputStreamTic {
  readonly activePlayerCount: number;
  readonly commandSignature: string;
  readonly tic: number;
}

const AUDIT_EVIDENCE: ConvertDemoInputStreamAuditEvidence = Object.freeze({
  missingSurface: 'input-trace-replay-loader',
  schemaVersion: 1,
  stepIdentifier: '01-015',
});

const DEFAULT_DEMO_NAME = 'DEMO';

/**
 * Convert a vanilla demo's tic command stream into deterministic replay evidence.
 *
 * @param demoBuffer Parsed through the Bun-run playable demo playback path.
 * @param options Optional command, label, description, and single-demo completion behavior.
 * @returns Frozen replay evidence with an input script duration and stable tic command hashes.
 * @example
 * ```ts
 * import { convertDemoInputStream } from './src/playable/demo-replay/convertDemoInputStream.ts';
 *
 * const evidence = convertDemoInputStream(Buffer.from([109, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0x80]));
 * console.log(evidence.commandContract.runtimeCommand);
 * ```
 */
export function convertDemoInputStream(demoBuffer: Buffer, options: ConvertDemoInputStreamOptions = {}): Readonly<ConvertDemoInputStreamEvidence> {
  const command = options.command ?? CONVERT_DEMO_INPUT_STREAM_COMMAND.runtimeCommand;
  validatePlayableCommand(command);

  const playback = new DemoPlayback(demoBuffer, { singleDemo: options.singleDemo });
  const ticSignatures: Readonly<ConvertedDemoInputStreamTic>[] = [];

  for (;;) {
    const ticCommands = playback.readNextTic();

    if (ticCommands === null) {
      break;
    }

    ticSignatures.push(
      Object.freeze({
        activePlayerCount: ticCommands.length,
        commandSignature: stableSerialize(ticCommands),
        tic: ticSignatures.length,
      }),
    );
  }

  if (ticSignatures.length === 0) {
    throw new RangeError('Demo input stream must contain at least one tic command');
  }

  const snapshot = playback.snapshot();
  const completionAction = snapshot.singleDemo ? 'quit' : 'advance-demo';
  const activePlayerCounts = Object.freeze(ticSignatures.map((ticSignature) => ticSignature.activePlayerCount));
  const inputScript = Object.freeze({
    description: options.description ?? `Converted ${options.demoName ?? DEFAULT_DEMO_NAME} demo input stream`,
    events: EMPTY_DEMO_PLAYBACK_SCRIPT.events,
    targetRunMode: EMPTY_DEMO_PLAYBACK_SCRIPT.targetRunMode,
    ticRateHz: EMPTY_DEMO_PLAYBACK_SCRIPT.ticRateHz,
    totalTics: ticSignatures.length,
  } satisfies InputScriptPayload);
  const ticCommandPayload = stableSerialize(ticSignatures);
  const ticCommandHash = sha256Hex(ticCommandPayload);
  const evidenceWithoutReplayHash = {
    activePlayerCounts,
    auditEvidence: AUDIT_EVIDENCE,
    commandContract: CONVERT_DEMO_INPUT_STREAM_COMMAND,
    completionAction,
    demoName: options.demoName ?? DEFAULT_DEMO_NAME,
    inputScript,
    ticCommandHash,
    ticSignatures: Object.freeze([...ticSignatures]),
    totalTics: ticSignatures.length,
  } satisfies Omit<ConvertDemoInputStreamEvidence, 'replayHash'>;

  return Object.freeze({
    ...evidenceWithoutReplayHash,
    replayHash: sha256Hex(stableSerialize(evidenceWithoutReplayHash)),
  });
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}

function stableSerialize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((arrayValue) => stableSerialize(arrayValue)).join(',')}]`;
  }

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot serialize non-finite number ${value}`);
      }

      return JSON.stringify(value);
    case 'object': {
      const entries = Object.entries(value as Record<string, unknown>).sort(([leftKey], [rightKey]) => {
        if (leftKey < rightKey) {
          return -1;
        }

        if (leftKey > rightKey) {
          return 1;
        }

        return 0;
      });
      return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
    }
    case 'string':
      return JSON.stringify(value);
    default:
      throw new TypeError(`Cannot serialize ${typeof value} value`);
  }
}

function validatePlayableCommand(command: string): void {
  if (command !== CONVERT_DEMO_INPUT_STREAM_COMMAND.runtimeCommand) {
    throw new Error(`convert-demo-input-stream requires bun run doom.ts, got ${command}`);
  }
}
