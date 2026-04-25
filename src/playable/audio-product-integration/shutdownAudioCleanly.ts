import type { MusicDeviceAction, MusicSystemState } from '../../audio/musicSystem.ts';
import { stopMusic } from '../../audio/musicSystem.ts';

export const SHUTDOWN_AUDIO_CLEANLY_AUDIT_SURFACE = 'shutdown-audio-path';
export const SHUTDOWN_AUDIO_CLEANLY_CHANNEL_COUNT = 8;
export const SHUTDOWN_AUDIO_CLEANLY_COMMAND = 'bun run doom.ts';
export const SHUTDOWN_AUDIO_CLEANLY_SOURCE_AUDIT_STEP_ID = '01-011';

export interface ShutdownAudioChannelState {
  handle: number;
  origin: number | null;
  pitch: number;
  priority: number;
  soundEffectId: number | null;
}

export interface ShutdownAudioCleanlyRequest {
  dispatchAction?: ShutdownAudioDeviceDispatcher;
  musicSystem: MusicSystemState;
  runtimeCommand: string;
  soundEffectChannels: ShutdownAudioChannelState[];
}

export interface ShutdownAudioCleanlyResult {
  readonly actions: readonly ShutdownAudioDeviceAction[];
  readonly auditSurface: typeof SHUTDOWN_AUDIO_CLEANLY_AUDIT_SURFACE;
  readonly commandContract: typeof SHUTDOWN_AUDIO_CLEANLY_COMMAND;
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly transition: ShutdownAudioTransitionEvidence;
}

export type ShutdownAudioDeviceAction = MusicDeviceAction | ShutdownSoundEffectDeviceAction;

export type ShutdownAudioDeviceDispatcher = (action: ShutdownAudioDeviceAction) => void;

export interface ShutdownAudioMusicSnapshot {
  readonly currentMusicNum: number | null;
  readonly hasIntroALump: boolean;
  readonly looping: boolean;
  readonly musicDevice: number;
  readonly musicVolume: number;
  readonly paused: boolean;
  readonly schedulerLoaded: boolean;
}

export interface ShutdownAudioSoundEffectChannelSnapshot {
  readonly active: boolean;
  readonly channelIndex: number;
  readonly origin: number | null;
  readonly pitch: number;
  readonly priority: number;
  readonly soundEffectId: number | null;
}

export interface ShutdownAudioStateEvidence {
  readonly music: ShutdownAudioMusicSnapshot;
  readonly soundEffectChannels: readonly ShutdownAudioSoundEffectChannelSnapshot[];
}

export interface ShutdownAudioTransitionEvidence {
  readonly before: ShutdownAudioStateEvidence;
  readonly after: ShutdownAudioStateEvidence;
}

export interface ShutdownSoundEffectDeviceAction {
  readonly channelIndex: number;
  readonly kind: 'stop-sound-channel';
  readonly soundEffectId: number | null;
}

/**
 * Stop all currently loaded audio state through the playable Bun command path.
 *
 * @example
 * ```ts
 * import { createMusicSystem } from '../../audio/musicSystem.ts';
 * import { shutdownAudioCleanly } from './shutdownAudioCleanly.ts';
 *
 * const result = shutdownAudioCleanly({
 *   musicSystem: createMusicSystem(),
 *   runtimeCommand: 'bun run doom.ts',
 *   soundEffectChannels: Array.from({ length: 8 }, () => ({
 *     handle: 0,
 *     origin: null,
 *     pitch: 0,
 *     priority: 0,
 *     soundEffectId: null,
 *   })),
 * });
 * console.log(result.replayChecksum);
 * ```
 */
export function shutdownAudioCleanly(request: ShutdownAudioCleanlyRequest): ShutdownAudioCleanlyResult {
  if (request.runtimeCommand !== SHUTDOWN_AUDIO_CLEANLY_COMMAND) {
    throw new RangeError(`shutdown audio requires ${SHUTDOWN_AUDIO_CLEANLY_COMMAND}`);
  }

  validateSoundEffectChannels(request.soundEffectChannels);

  const before = snapshotAudioState(request.musicSystem, request.soundEffectChannels);
  const actions: ShutdownAudioDeviceAction[] = [];

  for (const musicAction of stopMusic(request.musicSystem)) {
    actions.push(musicAction);
  }

  for (const [channelIndex, channel] of request.soundEffectChannels.entries()) {
    if (isSoundEffectChannelActive(channel)) {
      const action: ShutdownSoundEffectDeviceAction = Object.freeze({
        channelIndex,
        kind: 'stop-sound-channel',
        soundEffectId: channel.soundEffectId,
      });
      actions.push(action);
    }

    channel.handle = 0;
    channel.origin = null;
    channel.pitch = 0;
    channel.priority = 0;
    channel.soundEffectId = null;
  }

  const frozenActions = Object.freeze(actions);

  if (request.dispatchAction !== undefined) {
    for (const action of frozenActions) {
      request.dispatchAction(action);
    }
  }

  const after = snapshotAudioState(request.musicSystem, request.soundEffectChannels);
  const transition = Object.freeze<ShutdownAudioTransitionEvidence>({
    before,
    after,
  });
  const replaySignature = formatReplaySignature(transition, frozenActions);

  return Object.freeze({
    actions: frozenActions,
    auditSurface: SHUTDOWN_AUDIO_CLEANLY_AUDIT_SURFACE,
    commandContract: SHUTDOWN_AUDIO_CLEANLY_COMMAND,
    replayChecksum: checksumReplaySignature(replaySignature),
    replaySignature,
    transition,
  });
}

function checksumReplaySignature(replaySignature: string): number {
  let checksum = 0x811c9dc5;
  for (let characterIndex = 0; characterIndex < replaySignature.length; characterIndex += 1) {
    checksum ^= replaySignature.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum >>> 0;
}

function formatBoolean(value: boolean): string {
  return value ? 'true' : 'false';
}

function formatDeviceAction(action: ShutdownAudioDeviceAction): string {
  switch (action.kind) {
    case 'pause-song':
      return 'pause-song';
    case 'play-song':
      return `play-song:${action.musicNum}:${formatBoolean(action.looping)}`;
    case 'resume-song':
      return 'resume-song';
    case 'set-volume':
      return `set-volume:${action.volume}`;
    case 'stop-song':
      return `stop-song:${action.musicNum}`;
    case 'stop-sound-channel':
      return `stop-sound-channel:${action.channelIndex}:${formatNullableNumber(action.soundEffectId)}`;
  }
}

function formatMusicSnapshot(snapshot: ShutdownAudioMusicSnapshot): string {
  return [
    `currentMusicNum=${formatNullableNumber(snapshot.currentMusicNum)}`,
    `hasIntroALump=${formatBoolean(snapshot.hasIntroALump)}`,
    `looping=${formatBoolean(snapshot.looping)}`,
    `musicDevice=${snapshot.musicDevice}`,
    `musicVolume=${snapshot.musicVolume}`,
    `paused=${formatBoolean(snapshot.paused)}`,
    `schedulerLoaded=${formatBoolean(snapshot.schedulerLoaded)}`,
  ].join(',');
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'null' : `${value}`;
}

function formatReplaySignature(transition: ShutdownAudioTransitionEvidence, actions: readonly ShutdownAudioDeviceAction[]): string {
  return [
    `beforeMusic{${formatMusicSnapshot(transition.before.music)}}`,
    `beforeSoundEffects{${formatSoundEffectSnapshots(transition.before.soundEffectChannels)}}`,
    `actions{${actions.map(formatDeviceAction).join('|')}}`,
    `afterMusic{${formatMusicSnapshot(transition.after.music)}}`,
    `afterSoundEffects{${formatSoundEffectSnapshots(transition.after.soundEffectChannels)}}`,
  ].join('->');
}

function formatSoundEffectSnapshot(snapshot: ShutdownAudioSoundEffectChannelSnapshot): string {
  return [snapshot.channelIndex, snapshot.active ? 'active' : 'empty', formatNullableNumber(snapshot.soundEffectId), formatNullableNumber(snapshot.origin), snapshot.priority, snapshot.pitch].join(':');
}

function formatSoundEffectSnapshots(snapshots: readonly ShutdownAudioSoundEffectChannelSnapshot[]): string {
  return snapshots.map(formatSoundEffectSnapshot).join('|');
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isNullableNonNegativeInteger(value: number | null): boolean {
  return value === null || isNonNegativeInteger(value);
}

function isSoundEffectChannelActive(channel: Readonly<ShutdownAudioChannelState>): boolean {
  return channel.handle !== 0 || channel.soundEffectId !== null || channel.origin !== null;
}

function snapshotAudioState(musicSystem: Readonly<MusicSystemState>, soundEffectChannels: readonly ShutdownAudioChannelState[]): ShutdownAudioStateEvidence {
  return Object.freeze({
    music: snapshotMusicState(musicSystem),
    soundEffectChannels: snapshotSoundEffectChannels(soundEffectChannels),
  });
}

function snapshotMusicState(musicSystem: Readonly<MusicSystemState>): ShutdownAudioMusicSnapshot {
  return Object.freeze({
    currentMusicNum: musicSystem.currentMusicNum,
    hasIntroALump: musicSystem.hasIntroALump,
    looping: musicSystem.looping,
    musicDevice: musicSystem.musicDevice,
    musicVolume: musicSystem.musicVolume,
    paused: musicSystem.paused,
    schedulerLoaded: musicSystem.scheduler !== null,
  });
}

function snapshotSoundEffectChannels(soundEffectChannels: readonly ShutdownAudioChannelState[]): readonly ShutdownAudioSoundEffectChannelSnapshot[] {
  const snapshots: ShutdownAudioSoundEffectChannelSnapshot[] = [];
  for (const [channelIndex, channel] of soundEffectChannels.entries()) {
    snapshots.push(
      Object.freeze({
        active: isSoundEffectChannelActive(channel),
        channelIndex,
        origin: channel.origin,
        pitch: channel.pitch,
        priority: channel.priority,
        soundEffectId: channel.soundEffectId,
      }),
    );
  }
  return Object.freeze(snapshots);
}

function validateSoundEffectChannel(channel: Readonly<ShutdownAudioChannelState>, channelIndex: number): void {
  if (!isNonNegativeInteger(channel.handle)) {
    throw new RangeError(`sound effect channel ${channelIndex} handle must be a non-negative integer`);
  }
  if (!isNullableNonNegativeInteger(channel.origin)) {
    throw new RangeError(`sound effect channel ${channelIndex} origin must be null or a non-negative integer`);
  }
  if (!isNonNegativeInteger(channel.pitch)) {
    throw new RangeError(`sound effect channel ${channelIndex} pitch must be a non-negative integer`);
  }
  if (!isNonNegativeInteger(channel.priority)) {
    throw new RangeError(`sound effect channel ${channelIndex} priority must be a non-negative integer`);
  }
  if (!isNullableNonNegativeInteger(channel.soundEffectId)) {
    throw new RangeError(`sound effect channel ${channelIndex} soundEffectId must be null or a non-negative integer`);
  }
}

function validateSoundEffectChannels(soundEffectChannels: readonly ShutdownAudioChannelState[]): void {
  if (soundEffectChannels.length !== SHUTDOWN_AUDIO_CLEANLY_CHANNEL_COUNT) {
    throw new RangeError(`shutdown audio requires exactly ${SHUTDOWN_AUDIO_CLEANLY_CHANNEL_COUNT} sound effect channels`);
  }

  for (const [channelIndex, channel] of soundEffectChannels.entries()) {
    validateSoundEffectChannel(channel, channelIndex);
  }
}
