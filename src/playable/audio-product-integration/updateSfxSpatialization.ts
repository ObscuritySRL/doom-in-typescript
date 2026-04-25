import type { SpatialListener, SpatialSource } from '../../audio/spatial.ts';
import { NORM_SEP, adjustSoundParams } from '../../audio/spatial.ts';

export const UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';
export const UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT = 8;
export const UPDATE_SFX_SPATIALIZATION_COMMAND = 'bun run doom.ts';
export const UPDATE_SFX_SPATIALIZATION_VOLUME_MAX = 15;
export const UPDATE_SFX_SPATIALIZATION_VOLUME_MIN = 0;

const CHECKSUM_MODULUS = 1_000_000_007;

export interface UpdateSfxSpatializationChannelSnapshot {
  readonly channelIndex: number;
  readonly origin: number | null;
  readonly pitch: number;
  readonly priority: number;
  readonly soundEffectId: number | null;
  readonly sourcePosition: SpatialSource | null;
}

export interface UpdateSfxSpatializationRequest {
  readonly channels: readonly UpdateSfxSpatializationChannelSnapshot[];
  readonly isBossMap: boolean;
  readonly listener: SpatialListener;
  readonly listenerOrigin: number | null;
  readonly runtimeCommand: string;
  readonly soundEffectVolume: number;
}

export interface UpdateSfxSpatializationUpdateAction {
  readonly channelIndex: number;
  readonly kind: 'update';
  readonly origin: number | null;
  readonly pitch: number;
  readonly priority: number;
  readonly separation: number;
  readonly soundEffectId: number;
  readonly volume: number;
}

export interface UpdateSfxSpatializationStopAction {
  readonly channelIndex: number;
  readonly kind: 'stop';
  readonly origin: number;
  readonly priority: number;
  readonly reason: 'inaudible';
  readonly soundEffectId: number;
}

export type UpdateSfxSpatializationMixerAction = UpdateSfxSpatializationUpdateAction | UpdateSfxSpatializationStopAction;

export interface UpdateSfxSpatializationResult {
  readonly audibleChannelCount: number;
  readonly auditManifestPath: typeof UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH;
  readonly channelCount: typeof UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT;
  readonly mixerActions: readonly UpdateSfxSpatializationMixerAction[];
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly runtimeCommand: typeof UPDATE_SFX_SPATIALIZATION_COMMAND;
  readonly stoppedChannelCount: number;
  readonly updatedChannelCount: number;
}

export function updateSfxSpatialization(request: UpdateSfxSpatializationRequest): UpdateSfxSpatializationResult {
  validateRequest(request);

  const normalizedListenerOrigin = normalizeOrigin(request.listenerOrigin);
  const mixerActions: UpdateSfxSpatializationMixerAction[] = [];
  const replayEntries: string[] = [];
  let audibleChannelCount = 0;
  let stoppedChannelCount = 0;
  let updatedChannelCount = 0;

  for (const channel of request.channels) {
    if (channel.soundEffectId === null) {
      replayEntries.push(`${channel.channelIndex}:empty`);
      continue;
    }

    const normalizedOrigin = normalizeOrigin(channel.origin);
    let separation = NORM_SEP;
    let volume = request.soundEffectVolume;

    if (normalizedOrigin !== null && normalizedOrigin !== normalizedListenerOrigin) {
      if (channel.sourcePosition === null) {
        throw new TypeError(`channel ${channel.channelIndex} remote origin ${normalizedOrigin} requires sourcePosition`);
      }

      const adjusted = adjustSoundParams({
        isBossMap: request.isBossMap,
        listener: request.listener,
        sfxVolume: request.soundEffectVolume,
        source: channel.sourcePosition,
      });

      separation = channel.sourcePosition.x === request.listener.x && channel.sourcePosition.y === request.listener.y ? NORM_SEP : adjusted.separation;

      if (!adjusted.audible) {
        const action = Object.freeze<UpdateSfxSpatializationStopAction>({
          channelIndex: channel.channelIndex,
          kind: 'stop',
          origin: normalizedOrigin,
          priority: channel.priority,
          reason: 'inaudible',
          soundEffectId: channel.soundEffectId,
        });
        mixerActions.push(action);
        replayEntries.push(`${channel.channelIndex}:stop:${normalizedOrigin}:${channel.soundEffectId}:${channel.priority}`);
        stoppedChannelCount += 1;
        continue;
      }

      volume = adjusted.volume;
    }

    const action = Object.freeze<UpdateSfxSpatializationUpdateAction>({
      channelIndex: channel.channelIndex,
      kind: 'update',
      origin: normalizedOrigin,
      pitch: channel.pitch,
      priority: channel.priority,
      separation,
      soundEffectId: channel.soundEffectId,
      volume,
    });
    mixerActions.push(action);
    replayEntries.push(`${channel.channelIndex}:update:${normalizedOrigin ?? 'null'}:${channel.soundEffectId}:${volume}:${separation}:${channel.pitch}:${channel.priority}`);
    audibleChannelCount += 1;
    updatedChannelCount += 1;
  }

  const replaySignature = replayEntries.join('|');

  return Object.freeze<UpdateSfxSpatializationResult>({
    audibleChannelCount,
    auditManifestPath: UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH,
    channelCount: UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT,
    mixerActions: Object.freeze(mixerActions),
    replayChecksum: checksumReplaySignature(replaySignature),
    replaySignature,
    runtimeCommand: UPDATE_SFX_SPATIALIZATION_COMMAND,
    stoppedChannelCount,
    updatedChannelCount,
  });
}

function checksumReplaySignature(replaySignature: string): number {
  let checksum = 0;
  for (let characterIndex = 0; characterIndex < replaySignature.length; characterIndex += 1) {
    checksum = (checksum * 131 + replaySignature.charCodeAt(characterIndex)) % CHECKSUM_MODULUS;
  }
  return checksum;
}

function normalizeOrigin(origin: number | null): number | null {
  return origin === 0 ? null : origin;
}

function validateChannel(channel: UpdateSfxSpatializationChannelSnapshot, expectedChannelIndex: number): void {
  if (channel.channelIndex !== expectedChannelIndex) {
    throw new RangeError(`channelIndex must be ${expectedChannelIndex}, got ${channel.channelIndex}`);
  }
  if (channel.soundEffectId !== null && (!Number.isInteger(channel.soundEffectId) || channel.soundEffectId < 1)) {
    throw new RangeError(`channel ${expectedChannelIndex} soundEffectId must be null or a positive integer`);
  }
  if (channel.origin !== null && !Number.isInteger(channel.origin)) {
    throw new RangeError(`channel ${expectedChannelIndex} origin must be null or an integer`);
  }
  if (!Number.isInteger(channel.pitch) || channel.pitch < 0 || channel.pitch > 255) {
    throw new RangeError(`channel ${expectedChannelIndex} pitch must be an integer in [0, 255]`);
  }
  if (!Number.isInteger(channel.priority) || channel.priority < 0) {
    throw new RangeError(`channel ${expectedChannelIndex} priority must be a non-negative integer`);
  }
}

function validateRequest(request: UpdateSfxSpatializationRequest): void {
  if (request.runtimeCommand !== UPDATE_SFX_SPATIALIZATION_COMMAND) {
    throw new Error(`updateSfxSpatialization requires ${UPDATE_SFX_SPATIALIZATION_COMMAND}`);
  }
  if (!Number.isInteger(request.soundEffectVolume) || request.soundEffectVolume < UPDATE_SFX_SPATIALIZATION_VOLUME_MIN || request.soundEffectVolume > UPDATE_SFX_SPATIALIZATION_VOLUME_MAX) {
    throw new RangeError(`soundEffectVolume must be an integer in [${UPDATE_SFX_SPATIALIZATION_VOLUME_MIN}, ${UPDATE_SFX_SPATIALIZATION_VOLUME_MAX}], got ${request.soundEffectVolume}`);
  }
  if (request.listenerOrigin !== null && !Number.isInteger(request.listenerOrigin)) {
    throw new RangeError('listenerOrigin must be null or an integer');
  }
  if (request.channels.length !== UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT) {
    throw new RangeError(`updateSfxSpatialization requires exactly ${UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT} channels, got ${request.channels.length}`);
  }
  for (let channelIndex = 0; channelIndex < request.channels.length; channelIndex += 1) {
    validateChannel(request.channels[channelIndex], channelIndex);
  }
}
