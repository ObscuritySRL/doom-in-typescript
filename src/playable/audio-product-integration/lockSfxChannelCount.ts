export const LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND = 'bun run doom.ts';
export const LOCKED_SFX_CHANNEL_COUNT = 8;
export const SFX_CHANNEL_INDEX_MAXIMUM = LOCKED_SFX_CHANNEL_COUNT - 1;
export const SFX_CHANNEL_INDEX_MINIMUM = 0;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SIGNATURE_SEPARATOR_CODE = 0x0a;

export interface SfxChannelSnapshot {
  readonly channelIndex: number;
  readonly origin: number | null;
  readonly sfxId: number | null;
}

export interface LockSfxChannelCountRequest {
  readonly channelSnapshots: readonly SfxChannelSnapshot[];
  readonly runtimeCommand: string;
}

export interface SfxChannelCountReplayEvidence {
  readonly channelCount: number;
  readonly channelIndexMaximum: number;
  readonly channelIndexMinimum: number;
  readonly deviceHandlesIncluded: false;
  readonly replayChecksum: number;
  readonly slotSignatures: readonly string[];
}

export interface LockSfxChannelCountResult {
  readonly channelCount: number;
  readonly emptyChannelCount: number;
  readonly occupiedChannelCount: number;
  readonly replayEvidence: SfxChannelCountReplayEvidence;
  readonly runtimeCommand: typeof LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND;
}

/**
 * Lock the playable SFX mixer to vanilla's eight deterministic channels.
 *
 * @param request Runtime command and the current deterministic channel table snapshot.
 * @returns Replay-stable channel-count evidence with no live device handles.
 *
 * @example
 * ```ts
 * import { lockSfxChannelCount } from './src/playable/audio-product-integration/lockSfxChannelCount.ts';
 *
 * const result = lockSfxChannelCount({
 *   runtimeCommand: 'bun run doom.ts',
 *   channelSnapshots: Array.from({ length: 8 }, (_, channelIndex) => ({
 *     channelIndex,
 *     origin: null,
 *     sfxId: null,
 *   })),
 * });
 * console.log(result.channelCount);
 * ```
 */
export function lockSfxChannelCount(request: LockSfxChannelCountRequest): LockSfxChannelCountResult {
  if (request.runtimeCommand !== LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND) {
    throw new Error(`lockSfxChannelCount requires ${LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND}`);
  }

  if (request.channelSnapshots.length !== LOCKED_SFX_CHANNEL_COUNT) {
    throw new RangeError(`SFX channel table must contain exactly ${LOCKED_SFX_CHANNEL_COUNT} channels, got ${request.channelSnapshots.length}`);
  }

  const slotSignatures: string[] = [];
  let occupiedChannelCount = 0;

  for (let channelIndex = SFX_CHANNEL_INDEX_MINIMUM; channelIndex <= SFX_CHANNEL_INDEX_MAXIMUM; channelIndex += 1) {
    const snapshot = request.channelSnapshots[channelIndex];
    if (snapshot === undefined) {
      throw new RangeError(`SFX channel slot ${channelIndex} is missing`);
    }

    validateChannelSnapshot(snapshot, channelIndex);

    if (snapshot.sfxId !== null) {
      occupiedChannelCount += 1;
    }

    slotSignatures.push(`channel=${snapshot.channelIndex};origin=${snapshot.origin ?? 'null'};sfx=${snapshot.sfxId ?? 'null'}`);
  }

  const frozenSlotSignatures = Object.freeze(slotSignatures);

  return Object.freeze({
    channelCount: LOCKED_SFX_CHANNEL_COUNT,
    emptyChannelCount: LOCKED_SFX_CHANNEL_COUNT - occupiedChannelCount,
    occupiedChannelCount,
    replayEvidence: Object.freeze({
      channelCount: LOCKED_SFX_CHANNEL_COUNT,
      channelIndexMaximum: SFX_CHANNEL_INDEX_MAXIMUM,
      channelIndexMinimum: SFX_CHANNEL_INDEX_MINIMUM,
      deviceHandlesIncluded: false,
      replayChecksum: computeReplayChecksum(frozenSlotSignatures),
      slotSignatures: frozenSlotSignatures,
    }),
    runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
  });
}

function computeReplayChecksum(slotSignatures: readonly string[]): number {
  let replayChecksum = FNV_OFFSET_BASIS;

  for (const slotSignature of slotSignatures) {
    for (let characterIndex = 0; characterIndex < slotSignature.length; characterIndex += 1) {
      replayChecksum ^= slotSignature.charCodeAt(characterIndex);
      replayChecksum = Math.imul(replayChecksum, FNV_PRIME) >>> 0;
    }

    replayChecksum ^= SIGNATURE_SEPARATOR_CODE;
    replayChecksum = Math.imul(replayChecksum, FNV_PRIME) >>> 0;
  }

  return replayChecksum >>> 0;
}

function validateChannelSnapshot(snapshot: SfxChannelSnapshot, expectedChannelIndex: number): void {
  if (snapshot.channelIndex !== expectedChannelIndex) {
    throw new RangeError(`SFX channel index ${snapshot.channelIndex} must match slot ${expectedChannelIndex}`);
  }

  if (snapshot.origin !== null && !Number.isInteger(snapshot.origin)) {
    throw new TypeError(`SFX channel ${expectedChannelIndex} origin must be an integer or null`);
  }

  if (snapshot.sfxId !== null && !Number.isInteger(snapshot.sfxId)) {
    throw new TypeError(`SFX channel ${expectedChannelIndex} sfxId must be an integer or null`);
  }
}
