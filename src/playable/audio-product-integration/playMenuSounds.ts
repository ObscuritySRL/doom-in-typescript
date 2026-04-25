import type { ChannelTable } from '../../audio/channels.ts';
import { NORM_PRIORITY } from '../../audio/channels.ts';
import type { MusicDeviceAction } from '../../audio/musicSystem.ts';
import type { SfxPitchClass, StartSoundRequest, StartSoundResultKind } from '../../audio/soundSystem.ts';
import { startSound } from '../../audio/soundSystem.ts';

export const PLAY_MENU_SOUNDS_COMMAND_CONTRACT = 'bun run doom.ts';
export const MENU_SOUND_EFFECT_VOLUME_MAX = 15;
export const MENU_SOUND_EFFECT_VOLUME_MIN = 0;

export type MenuSoundEventKind = 'activate' | 'adjust' | 'back' | 'close' | 'move' | 'open';

export interface MenuSoundEvent {
  readonly kind: MenuSoundEventKind;
  readonly menuDepth: number;
  readonly tic: number;
}

export interface MenuSoundDefinition {
  readonly pitchClass: SfxPitchClass;
  readonly priority: number;
  readonly soundEffectId: number;
}

export interface MenuSoundDispatchAction {
  readonly channel: number;
  readonly eventKind: MenuSoundEventKind;
  readonly menuDepth: number;
  readonly pitch: number;
  readonly separation: number;
  readonly soundEffectId: number;
  readonly tic: number;
  readonly volume: number;
}

export type MenuSoundDropReason = Exclude<StartSoundResultKind, 'started'>;

export interface MenuSoundDroppedAction {
  readonly eventKind: MenuSoundEventKind;
  readonly menuDepth: number;
  readonly reason: MenuSoundDropReason;
  readonly tic: number;
}

export interface PlayMenuSoundsEvidence {
  readonly command: typeof PLAY_MENU_SOUNDS_COMMAND_CONTRACT;
  readonly dispatchActions: readonly MenuSoundDispatchAction[];
  readonly dropActions: readonly MenuSoundDroppedAction[];
  readonly eventCount: number;
  readonly eventSignatures: readonly string[];
  readonly musicActions: readonly MusicDeviceAction[];
  readonly replayChecksum: number;
}

export interface PlayMenuSoundsRequest {
  readonly dispatchStartedSound?: (action: MenuSoundDispatchAction) => void;
  readonly events: readonly MenuSoundEvent[];
  readonly rng: StartSoundRequest['rng'];
  readonly runtimeCommand: string;
  readonly soundEffectVolume: number;
  readonly table: ChannelTable;
}

export const MENU_SOUND_DEFINITIONS: Readonly<Record<MenuSoundEventKind, MenuSoundDefinition>> = Object.freeze({
  activate: Object.freeze({ pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 1 }),
  adjust: Object.freeze({ pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 22 }),
  back: Object.freeze({ pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 23 }),
  close: Object.freeze({ pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 24 }),
  move: Object.freeze({ pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 19 }),
  open: Object.freeze({ pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 23 }),
});

/**
 * Play menu sound events through the Bun-run product command path.
 *
 * @param request Menu sound events, caller-owned channel table, and live dispatcher.
 * @returns Handle-free replay evidence for deterministic menu audio checks.
 * @example
 * ```ts
 * import { createChannelTable } from '../../audio/channels.ts';
 * import { DoomRandom } from '../../core/rng.ts';
 * import { PLAY_MENU_SOUNDS_COMMAND_CONTRACT, playMenuSounds } from './playMenuSounds.ts';
 *
 * const evidence = playMenuSounds({
 *   events: [{ kind: 'open', menuDepth: 0, tic: 0 }],
 *   rng: new DoomRandom(),
 *   runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
 *   soundEffectVolume: 15,
 *   table: createChannelTable(),
 * });
 * console.log(evidence.replayChecksum);
 * ```
 */
export function playMenuSounds(request: PlayMenuSoundsRequest): PlayMenuSoundsEvidence {
  validateRuntimeCommand(request.runtimeCommand);
  validateSoundEffectVolume(request.soundEffectVolume);

  for (const event of request.events) {
    validateMenuSoundEvent(event);
  }

  const dispatchActions: MenuSoundDispatchAction[] = [];
  const dropActions: MenuSoundDroppedAction[] = [];
  const eventSignatures: string[] = [];

  for (const event of request.events) {
    const definition = MENU_SOUND_DEFINITIONS[event.kind];
    const result = startSound({
      isBossMap: false,
      linkPitch: null,
      linkVolumeAdjust: null,
      listener: { angle: 0, x: 0, y: 0 },
      listenerOrigin: null,
      origin: null,
      pitchClass: definition.pitchClass,
      priority: definition.priority,
      rng: request.rng,
      sfxId: definition.soundEffectId,
      sfxVolume: request.soundEffectVolume,
      sourcePosition: null,
      table: request.table,
    });

    if (result.kind === 'started') {
      const action = Object.freeze<MenuSoundDispatchAction>({
        channel: result.cnum,
        eventKind: event.kind,
        menuDepth: event.menuDepth,
        pitch: result.pitch,
        separation: result.separation,
        soundEffectId: result.sfxId,
        tic: event.tic,
        volume: result.volume,
      });
      request.dispatchStartedSound?.(action);
      dispatchActions.push(action);
      eventSignatures.push(buildStartedSignature(action));
    } else {
      const action = Object.freeze<MenuSoundDroppedAction>({
        eventKind: event.kind,
        menuDepth: event.menuDepth,
        reason: result.kind,
        tic: event.tic,
      });
      dropActions.push(action);
      eventSignatures.push(buildDroppedSignature(action));
    }
  }

  return Object.freeze<PlayMenuSoundsEvidence>({
    command: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
    dispatchActions: Object.freeze(dispatchActions),
    dropActions: Object.freeze(dropActions),
    eventCount: request.events.length,
    eventSignatures: Object.freeze(eventSignatures),
    musicActions: Object.freeze<MusicDeviceAction[]>([]),
    replayChecksum: computeReplayChecksum(eventSignatures),
  });
}

function buildDroppedSignature(action: MenuSoundDroppedAction): string {
  return `dropped:${action.tic}:${action.eventKind}:${action.menuDepth}:${action.reason}`;
}

function buildStartedSignature(action: MenuSoundDispatchAction): string {
  return `started:${action.tic}:${action.eventKind}:${action.menuDepth}:${action.soundEffectId}:${action.channel}:${action.volume}:${action.separation}:${action.pitch}`;
}

function computeReplayChecksum(signatures: readonly string[]): number {
  let checksum = 0x811c9dc5;
  for (const signature of signatures) {
    for (let index = 0; index < signature.length; index += 1) {
      checksum ^= signature.charCodeAt(index);
      checksum = Math.imul(checksum, 0x01000193) >>> 0;
    }
    checksum ^= 0x0a;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum >>> 0;
}

function isMenuSoundEventKind(value: string): value is MenuSoundEventKind {
  switch (value) {
    case 'activate':
    case 'adjust':
    case 'back':
    case 'close':
    case 'move':
    case 'open':
      return true;
  }
  return false;
}

function validateMenuSoundEvent(event: MenuSoundEvent): void {
  if (!isMenuSoundEventKind(event.kind)) {
    throw new TypeError(`unknown menu sound event kind: ${event.kind}`);
  }
  if (!Number.isInteger(event.menuDepth) || event.menuDepth < 0) {
    throw new RangeError(`menuDepth must be a non-negative integer, got ${event.menuDepth}`);
  }
  if (!Number.isInteger(event.tic) || event.tic < 0) {
    throw new RangeError(`tic must be a non-negative integer, got ${event.tic}`);
  }
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PLAY_MENU_SOUNDS_COMMAND_CONTRACT) {
    throw new TypeError(`playMenuSounds requires runtime command ${PLAY_MENU_SOUNDS_COMMAND_CONTRACT}`);
  }
}

function validateSoundEffectVolume(soundEffectVolume: number): void {
  if (!Number.isInteger(soundEffectVolume) || soundEffectVolume < MENU_SOUND_EFFECT_VOLUME_MIN || soundEffectVolume > MENU_SOUND_EFFECT_VOLUME_MAX) {
    throw new RangeError(`soundEffectVolume must be an integer in [${MENU_SOUND_EFFECT_VOLUME_MIN}, ${MENU_SOUND_EFFECT_VOLUME_MAX}], got ${soundEffectVolume}`);
  }
}
