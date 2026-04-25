import { PITCH_CLAMP_MAX, PITCH_CLAMP_MIN, SFX_ID_MAX, SFX_ID_MIN } from '../../audio/soundSystem.ts';
import type { StartSoundResult } from '../../audio/soundSystem.ts';

export const CONNECT_SFX_MIXER_RUNTIME_COMMAND = 'bun run doom.ts';

const CHECKSUM_OFFSET = 0x811c9dc5;
const CHECKSUM_PRIME = 0x01000193;

export interface SfxMixerStartAction {
  readonly channelIndex: number;
  readonly kind: 'start-sfx';
  readonly pitch: number;
  readonly separation: number;
  readonly sfxId: number;
  readonly volume: number;
}

export interface SfxMixerDropAction {
  readonly kind: 'drop-sfx';
  readonly reason: 'link-silenced' | 'inaudible' | 'no-channel';
}

export type SfxMixerReplayAction = SfxMixerDropAction | SfxMixerStartAction;

export interface SfxMixerDispatcher {
  readonly startSound: (action: SfxMixerStartAction) => unknown;
}

export interface ConnectSfxMixerRequest {
  readonly mixer: SfxMixerDispatcher;
  readonly runtimeCommand: string;
  readonly soundResults: readonly StartSoundResult[];
}

export interface ConnectSfxMixerResult {
  readonly dispatchCount: number;
  readonly dropCount: number;
  readonly firstDispatchedChannelIndex: number | null;
  readonly lastDispatchedChannelIndex: number | null;
  readonly replayActions: readonly SfxMixerReplayAction[];
  readonly replayChecksum: number;
  readonly runtimeCommand: string;
}

/**
 * Connect pure `S_StartSound` results to the live SFX mixer.
 *
 * @param request Runtime command, deterministic sound results, and the host mixer dispatcher.
 * @returns Replay-stable SFX mixer evidence with no live device handles.
 *
 * @example
 * ```ts
 * import { connectSfxMixer } from './src/playable/audio-product-integration/connectSfxMixer.ts';
 *
 * const evidence = connectSfxMixer({
 *   runtimeCommand: 'bun run doom.ts',
 *   soundResults: [{ kind: 'started', cnum: 0, sfxId: 1, volume: 15, separation: 128, pitch: 127 }],
 *   mixer: { startSound: () => 1n },
 * });
 * console.log(evidence.dispatchCount);
 * ```
 */
export function connectSfxMixer(request: ConnectSfxMixerRequest): ConnectSfxMixerResult {
  if (request.runtimeCommand !== CONNECT_SFX_MIXER_RUNTIME_COMMAND) {
    throw new RangeError(`connectSfxMixer requires ${CONNECT_SFX_MIXER_RUNTIME_COMMAND}, got ${request.runtimeCommand}`);
  }

  for (const soundResult of request.soundResults) {
    validateSoundResult(soundResult);
  }

  const replayActions: SfxMixerReplayAction[] = [];
  let dispatchCount = 0;
  let dropCount = 0;
  let firstDispatchedChannelIndex: number | null = null;
  let lastDispatchedChannelIndex: number | null = null;

  for (const soundResult of request.soundResults) {
    if (soundResult.kind === 'started') {
      const action = Object.freeze<SfxMixerStartAction>({
        channelIndex: soundResult.cnum,
        kind: 'start-sfx',
        pitch: soundResult.pitch,
        separation: soundResult.separation,
        sfxId: soundResult.sfxId,
        volume: soundResult.volume,
      });

      void request.mixer.startSound(action);
      replayActions.push(action);
      dispatchCount += 1;
      firstDispatchedChannelIndex ??= action.channelIndex;
      lastDispatchedChannelIndex = action.channelIndex;
    } else {
      replayActions.push(
        Object.freeze<SfxMixerDropAction>({
          kind: 'drop-sfx',
          reason: soundResult.kind,
        }),
      );
      dropCount += 1;
    }
  }

  const frozenReplayActions = Object.freeze(replayActions);

  return Object.freeze<ConnectSfxMixerResult>({
    dispatchCount,
    dropCount,
    firstDispatchedChannelIndex,
    lastDispatchedChannelIndex,
    replayActions: frozenReplayActions,
    replayChecksum: checksumReplayActions(frozenReplayActions),
    runtimeCommand: request.runtimeCommand,
  });
}

function checksumReplayActions(replayActions: readonly SfxMixerReplayAction[]): number {
  let checksum = CHECKSUM_OFFSET;

  for (const action of replayActions) {
    checksum = updateChecksum(checksum, action.kind);
    if (action.kind === 'start-sfx') {
      checksum = updateChecksum(checksum, action.channelIndex);
      checksum = updateChecksum(checksum, action.sfxId);
      checksum = updateChecksum(checksum, action.volume);
      checksum = updateChecksum(checksum, action.separation);
      checksum = updateChecksum(checksum, action.pitch);
    } else {
      checksum = updateChecksum(checksum, action.reason);
    }
  }

  return checksum >>> 0;
}

function updateChecksum(checksum: number, value: number | string): number {
  const encodedValue = String(value);
  for (let characterIndex = 0; characterIndex < encodedValue.length; characterIndex += 1) {
    checksum ^= encodedValue.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, CHECKSUM_PRIME);
  }
  checksum ^= 0x7c;
  return Math.imul(checksum, CHECKSUM_PRIME);
}

function validateSoundResult(soundResult: StartSoundResult): void {
  if (soundResult.kind !== 'started') {
    return;
  }

  validateIntegerRange('channelIndex', soundResult.cnum, 0, Number.MAX_SAFE_INTEGER);
  validateIntegerRange('sfxId', soundResult.sfxId, SFX_ID_MIN, SFX_ID_MAX);
  validateIntegerRange('volume', soundResult.volume, 0, 127);
  validateIntegerRange('separation', soundResult.separation, 0, 255);
  validateIntegerRange('pitch', soundResult.pitch, PITCH_CLAMP_MIN, PITCH_CLAMP_MAX);
}

function validateIntegerRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer in [${minimum}, ${maximum}], got ${value}`);
  }
}
