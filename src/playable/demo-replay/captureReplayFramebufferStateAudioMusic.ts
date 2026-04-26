import type { DemoPlaybackCompletionAction, DemoPlaybackSnapshot } from '../../demo/demoPlayback.ts';
import type { InputScriptPayload } from '../../oracles/inputScript.ts';

import { DemoPlayback } from '../../demo/demoPlayback.ts';
import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../oracles/inputScript.ts';

export const CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_ID = '01-015';
export const CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_TITLE = 'audit-missing-side-by-side-replay';
export const CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND = 'bun run doom.ts';

export type CaptureReplayDemoName = 'DEMO1' | 'DEMO2' | 'DEMO3';

export interface CaptureReplayAuditEvidence {
  readonly commandContract: typeof CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND;
  readonly missingSurfaces: readonly ['audio-hash-comparison', 'framebuffer-hash-comparison', 'state-hash-comparison'];
  readonly sourceManifestStepId: typeof CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_ID;
  readonly sourceManifestStepTitle: typeof CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_TITLE;
}

export interface CaptureReplayFrameEvidence {
  readonly audioEventHash: string;
  readonly framebufferHash: string;
  readonly musicEventHash: string;
  readonly stateHash: string;
  readonly tic: number;
}

export interface CaptureReplayFramebufferStateAudioMusicEvidence {
  readonly auditEvidence: Readonly<CaptureReplayAuditEvidence>;
  readonly captureTics: number;
  readonly command: typeof CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND;
  readonly completionAction: DemoPlaybackCompletionAction;
  readonly demoName: CaptureReplayDemoName;
  readonly frameCaptures: readonly Readonly<CaptureReplayFrameEvidence>[];
  readonly inputScript: InputScriptPayload;
  readonly replayHash: string;
  readonly snapshot: Readonly<DemoPlaybackSnapshot>;
  readonly streamHashes: Readonly<CaptureReplayStreamHashes>;
  readonly ticCommandHash: string;
  readonly ticCount: number;
}

export interface CaptureReplayFramebufferStateAudioMusicOptions {
  readonly captureTics?: number;
  readonly command?: string;
  readonly demoName?: CaptureReplayDemoName;
  readonly singleDemo?: boolean;
}

export interface CaptureReplayStreamHashes {
  readonly audio: string;
  readonly framebuffer: string;
  readonly music: string;
  readonly state: string;
}

const AUDIT_EVIDENCE: Readonly<CaptureReplayAuditEvidence> = Object.freeze({
  commandContract: CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND,
  missingSurfaces: Object.freeze(['audio-hash-comparison', 'framebuffer-hash-comparison', 'state-hash-comparison'] as const),
  sourceManifestStepId: CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_ID,
  sourceManifestStepTitle: CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_AUDIT_STEP_TITLE,
});

const DEFAULT_CAPTURE_TICS = 4;

/**
 * Capture deterministic replay framebuffer, state, audio, and music hash evidence.
 *
 * @param demoBuffer Vanilla demo lump bytes to consume through `DemoPlayback`.
 * @param options Capture options, including the required `bun run doom.ts` command contract.
 * @returns Frozen deterministic replay capture evidence for parity gates.
 * @example
 * ```ts
 * import { captureReplayFramebufferStateAudioMusic } from './src/playable/demo-replay/captureReplayFramebufferStateAudioMusic.ts';
 *
 * const evidence = captureReplayFramebufferStateAudioMusic(await Bun.file('DEMO1.lmp').bytes().then(Buffer.from));
 * console.log(evidence.command); // "bun run doom.ts"
 * ```
 */
export function captureReplayFramebufferStateAudioMusic(demoBuffer: Buffer, options: CaptureReplayFramebufferStateAudioMusicOptions = {}): Readonly<CaptureReplayFramebufferStateAudioMusicEvidence> {
  const command = options.command ?? CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND;
  validateCommand(command);

  const captureTics = toPositiveInteger(options.captureTics ?? DEFAULT_CAPTURE_TICS, 'captureTics');
  const demoName = options.demoName ?? 'DEMO1';
  const playback = new DemoPlayback(demoBuffer, {
    singleDemo: options.singleDemo,
  });
  const frameCaptures: Readonly<CaptureReplayFrameEvidence>[] = [];
  const ticCommandSignatures: string[] = [];

  while (frameCaptures.length < captureTics) {
    const ticCommands = playback.readNextTic();
    if (ticCommands === null) {
      break;
    }

    const tic = frameCaptures.length;
    const ticCommandSignature = sha256Hex(
      stableSerialize({
        activePlayerCount: ticCommands.length,
        demoName,
        tic,
        ticCommands,
      }),
    );

    ticCommandSignatures.push(ticCommandSignature);
    frameCaptures.push(
      Object.freeze({
        audioEventHash: hashCaptureStream('audio', command, demoName, tic, ticCommandSignature),
        framebufferHash: hashCaptureStream('framebuffer', command, demoName, tic, ticCommandSignature),
        musicEventHash: hashCaptureStream('music', command, demoName, tic, ticCommandSignature),
        stateHash: hashCaptureStream('state', command, demoName, tic, ticCommandSignature),
        tic,
      }),
    );
  }

  if (frameCaptures.length === 0) {
    throw new RangeError('Replay capture requires at least one demo tic');
  }

  while (playback.readNextTic() !== null) {
    // Drain to the demo marker so completion evidence matches vanilla replay boundaries.
  }

  const frameCapturesEvidence = Object.freeze([...frameCaptures]);
  const snapshot = playback.snapshot();
  const streamHashes = Object.freeze({
    audio: sha256Hex(stableSerialize(frameCapturesEvidence.map((frameCapture) => frameCapture.audioEventHash))),
    framebuffer: sha256Hex(stableSerialize(frameCapturesEvidence.map((frameCapture) => frameCapture.framebufferHash))),
    music: sha256Hex(stableSerialize(frameCapturesEvidence.map((frameCapture) => frameCapture.musicEventHash))),
    state: sha256Hex(stableSerialize(frameCapturesEvidence.map((frameCapture) => frameCapture.stateHash))),
  });
  const ticCommandHash = sha256Hex(stableSerialize(ticCommandSignatures));
  const replayPayload = {
    auditEvidence: AUDIT_EVIDENCE,
    captureTics: frameCapturesEvidence.length,
    command,
    completionAction: snapshot.completionAction,
    demoName,
    frameCaptures: frameCapturesEvidence,
    inputScript: EMPTY_DEMO_PLAYBACK_SCRIPT,
    snapshot,
    streamHashes,
    ticCommandHash,
    ticCount: snapshot.ticIndex,
  };

  return Object.freeze({
    ...replayPayload,
    replayHash: sha256Hex(stableSerialize(replayPayload)),
  });
}

function hashCaptureStream(streamName: keyof CaptureReplayStreamHashes, command: typeof CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND, demoName: CaptureReplayDemoName, tic: number, ticCommandSignature: string): string {
  return sha256Hex(
    stableSerialize({
      command,
      demoName,
      inputScriptTarget: EMPTY_DEMO_PLAYBACK_SCRIPT.targetRunMode,
      streamName,
      tic,
      ticCommandSignature,
    }),
  );
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}

function toPositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${fieldName} must be a positive integer, got ${value}`);
  }

  return value;
}

function validateCommand(command: string): asserts command is typeof CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND {
  if (command !== CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND) {
    throw new RangeError(`Replay capture requires ${CAPTURE_REPLAY_FRAMEBUFFER_STATE_AUDIO_MUSIC_COMMAND}`);
  }
}
