export const IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND = 'bun run doom.ts';
export const IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS = Object.freeze(['bun', 'run', 'doom.ts'] as const);
export const PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT = 8;

export interface SfxPriorityEvictionChannelSnapshot {
  readonly active: boolean;
  readonly channelIndex: number;
  readonly origin: number | null;
  readonly priority: number | null;
  readonly soundEffectId: number | null;
}

export type SfxPriorityEvictionDecisionKind = 'assigned-free-channel' | 'dropped' | 'evicted' | 'replaced-same-origin';

export interface SfxPriorityEvictionDroppedResult {
  readonly evidence: SfxPriorityEvictionEvidence;
  readonly kind: 'dropped';
  readonly selectedChannelIndex: null;
  readonly victimSignature: null;
}

export interface SfxPriorityEvictionEvidence {
  readonly afterSignature: string;
  readonly beforeSignature: string;
  readonly command: string;
  readonly decision: SfxPriorityEvictionDecisionKind;
  readonly incomingSignature: string;
  readonly replayChecksum: number;
  readonly selectedChannelIndex: number | null;
  readonly victimSignature: string | null;
}

export interface SfxPriorityEvictionIncomingSound {
  readonly origin: number | null;
  readonly priority: number;
  readonly soundEffectId: number;
}

export interface SfxPriorityEvictionRequest {
  readonly channels: readonly SfxPriorityEvictionChannelSnapshot[];
  readonly incoming: SfxPriorityEvictionIncomingSound;
  readonly runtimeCommand: readonly string[];
}

export interface SfxPriorityEvictionSelectedResult {
  readonly evidence: SfxPriorityEvictionEvidence;
  readonly kind: 'assigned-free-channel' | 'evicted' | 'replaced-same-origin';
  readonly replacementSignature: string;
  readonly selectedChannelIndex: number;
  readonly victimSignature: string | null;
}

export type SfxPriorityEvictionResult = SfxPriorityEvictionDroppedResult | SfxPriorityEvictionSelectedResult;

interface ActiveSfxPriorityEvictionChannelSnapshot {
  readonly active: true;
  readonly channelIndex: number;
  readonly origin: number | null;
  readonly priority: number;
  readonly soundEffectId: number;
}

interface InactiveSfxPriorityEvictionChannelSnapshot {
  readonly active: false;
  readonly channelIndex: number;
  readonly origin: null;
  readonly priority: null;
  readonly soundEffectId: null;
}

interface DroppedSfxPriorityEvictionSelection {
  readonly kind: 'dropped';
  readonly selectedChannelIndex: null;
  readonly victimChannel: null;
}

interface SelectedSfxPriorityEvictionSelection {
  readonly kind: 'assigned-free-channel' | 'evicted' | 'replaced-same-origin';
  readonly selectedChannelIndex: number;
  readonly victimChannel: ActiveSfxPriorityEvictionChannelSnapshot | null;
}

type SfxPriorityEvictionSelection = DroppedSfxPriorityEvictionSelection | SelectedSfxPriorityEvictionSelection;

type NormalizedSfxPriorityEvictionChannelSnapshot = ActiveSfxPriorityEvictionChannelSnapshot | InactiveSfxPriorityEvictionChannelSnapshot;

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer, got ${value}`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  assertInteger(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative, got ${value}`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  assertInteger(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be positive, got ${value}`);
  }
}

function calculateReplayChecksum(value: string): number {
  let checksum = 0x811c9dc5;
  for (let characterIndex = 0; characterIndex < value.length; characterIndex += 1) {
    checksum ^= value.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum;
}

function createChannelSignature(channel: NormalizedSfxPriorityEvictionChannelSnapshot): string {
  if (!channel.active) {
    return `${channel.channelIndex}:inactive`;
  }
  return `${channel.channelIndex}:active:sound=${channel.soundEffectId}:priority=${channel.priority}:origin=${channel.origin ?? 'null'}`;
}

function createIncomingSignature(incoming: SfxPriorityEvictionIncomingSound): string {
  return `incoming:sound=${incoming.soundEffectId}:priority=${incoming.priority}:origin=${incoming.origin ?? 'null'}`;
}

function createReplacementSignature(channelIndex: number, incoming: SfxPriorityEvictionIncomingSound): string {
  return `${channelIndex}:active:sound=${incoming.soundEffectId}:priority=${incoming.priority}:origin=${incoming.origin ?? 'null'}`;
}

function findSelection(channels: readonly NormalizedSfxPriorityEvictionChannelSnapshot[], incoming: SfxPriorityEvictionIncomingSound): SfxPriorityEvictionSelection {
  for (const channel of channels) {
    if (!channel.active) {
      return {
        kind: 'assigned-free-channel',
        selectedChannelIndex: channel.channelIndex,
        victimChannel: null,
      };
    }
    if (incoming.origin !== null && channel.origin === incoming.origin) {
      return {
        kind: 'replaced-same-origin',
        selectedChannelIndex: channel.channelIndex,
        victimChannel: channel,
      };
    }
  }

  for (const channel of channels) {
    if (channel.active && channel.priority >= incoming.priority) {
      return {
        kind: 'evicted',
        selectedChannelIndex: channel.channelIndex,
        victimChannel: channel,
      };
    }
  }

  return {
    kind: 'dropped',
    selectedChannelIndex: null,
    victimChannel: null,
  };
}

function normalizeChannel(channel: SfxPriorityEvictionChannelSnapshot, expectedChannelIndex: number): NormalizedSfxPriorityEvictionChannelSnapshot {
  if (channel.channelIndex !== expectedChannelIndex) {
    throw new RangeError(`channelIndex ${channel.channelIndex} must match its slot ${expectedChannelIndex}`);
  }
  if (expectedChannelIndex < 0 || expectedChannelIndex >= PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT) {
    throw new RangeError(`channelIndex ${expectedChannelIndex} is outside [0, ${PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT - 1}]`);
  }

  if (!channel.active) {
    if (channel.origin !== null || channel.priority !== null || channel.soundEffectId !== null) {
      throw new TypeError(`inactive channel ${expectedChannelIndex} must not carry sound state`);
    }
    return Object.freeze({
      active: false,
      channelIndex: expectedChannelIndex,
      origin: null,
      priority: null,
      soundEffectId: null,
    });
  }

  if (channel.priority === null || channel.soundEffectId === null) {
    throw new TypeError(`active channel ${expectedChannelIndex} requires priority and soundEffectId`);
  }
  assertNonNegativeInteger(channel.priority, `channel ${expectedChannelIndex} priority`);
  assertPositiveInteger(channel.soundEffectId, `channel ${expectedChannelIndex} soundEffectId`);
  validateOrigin(channel.origin, `channel ${expectedChannelIndex} origin`);

  return Object.freeze({
    active: true,
    channelIndex: expectedChannelIndex,
    origin: normalizeOrigin(channel.origin),
    priority: channel.priority,
    soundEffectId: channel.soundEffectId,
  });
}

function normalizeChannels(channels: readonly SfxPriorityEvictionChannelSnapshot[]): readonly NormalizedSfxPriorityEvictionChannelSnapshot[] {
  if (channels.length !== PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT) {
    throw new RangeError(`priority eviction requires exactly ${PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT} channels, got ${channels.length}`);
  }
  const normalizedChannels = channels.map((channel, channelIndex) => normalizeChannel(channel, channelIndex));
  return Object.freeze(normalizedChannels);
}

function normalizeIncoming(incoming: SfxPriorityEvictionIncomingSound): SfxPriorityEvictionIncomingSound {
  assertNonNegativeInteger(incoming.priority, 'incoming priority');
  assertPositiveInteger(incoming.soundEffectId, 'incoming soundEffectId');
  validateOrigin(incoming.origin, 'incoming origin');
  return Object.freeze({
    origin: normalizeOrigin(incoming.origin),
    priority: incoming.priority,
    soundEffectId: incoming.soundEffectId,
  });
}

function normalizeOrigin(origin: number | null): number | null {
  if (origin === 0) {
    return null;
  }
  return origin;
}

function validateOrigin(origin: number | null, name: string): void {
  if (origin === null) {
    return;
  }
  assertNonNegativeInteger(origin, name);
}

function validateRuntimeCommand(runtimeCommand: readonly string[]): void {
  if (runtimeCommand.length !== IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS.length) {
    throw new Error(`runtime command must be exactly "${IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND}"`);
  }
  for (let commandIndex = 0; commandIndex < IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS.length; commandIndex += 1) {
    if (runtimeCommand[commandIndex] !== IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS[commandIndex]) {
      throw new Error(`runtime command must be exactly "${IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND}"`);
    }
  }
}

export function implementSfxPriorityEviction(request: SfxPriorityEvictionRequest): SfxPriorityEvictionResult {
  validateRuntimeCommand(request.runtimeCommand);

  const channels = normalizeChannels(request.channels);
  const incoming = normalizeIncoming(request.incoming);
  const selection = findSelection(channels, incoming);
  const beforeSignature = channels.map(createChannelSignature).join('|');
  const incomingSignature = createIncomingSignature(incoming);
  const afterSignature =
    selection.selectedChannelIndex === null
      ? beforeSignature
      : channels.map((channel) => (channel.channelIndex === selection.selectedChannelIndex ? createReplacementSignature(channel.channelIndex, incoming) : createChannelSignature(channel))).join('|');
  const victimSignature = selection.victimChannel === null ? null : createChannelSignature(selection.victimChannel);
  const evidence = Object.freeze<SfxPriorityEvictionEvidence>({
    afterSignature,
    beforeSignature,
    command: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND,
    decision: selection.kind,
    incomingSignature,
    replayChecksum: calculateReplayChecksum(`${IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND}|${beforeSignature}|${incomingSignature}|${afterSignature}|${victimSignature ?? 'none'}`),
    selectedChannelIndex: selection.selectedChannelIndex,
    victimSignature,
  });

  if (selection.selectedChannelIndex === null) {
    return Object.freeze({
      evidence,
      kind: 'dropped',
      selectedChannelIndex: null,
      victimSignature: null,
    });
  }

  return Object.freeze({
    evidence,
    kind: selection.kind,
    replacementSignature: createReplacementSignature(selection.selectedChannelIndex, incoming),
    selectedChannelIndex: selection.selectedChannelIndex,
    victimSignature,
  });
}
