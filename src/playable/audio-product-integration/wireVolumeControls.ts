import type { MusicDeviceAction, MusicSystemState } from '../../audio/musicSystem.ts';
import { MUSIC_VOLUME_MAX, MUSIC_VOLUME_MIN, setMusicVolume } from '../../audio/musicSystem.ts';

export const WIRE_VOLUME_CONTROLS_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';
export const WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND = 'bun run doom.ts';

export const SOUND_EFFECTS_VOLUME_MAX = 15;
export const SOUND_EFFECTS_VOLUME_MIN = 0;

export type VolumeControlKind = 'music' | 'sound-effects';

export interface MusicVolumeControl {
  readonly kind: 'music';
  readonly volume: number;
}

export interface SoundEffectsVolumeAction {
  readonly kind: 'set-sound-effects-volume';
  readonly volume: number;
}

export type SoundEffectsVolumeControl = Omit<SoundEffectsVolumeAction, 'kind'> & {
  readonly kind: 'sound-effects';
};

export type VolumeControl = MusicVolumeControl | SoundEffectsVolumeControl;

export type MusicVolumeDispatcher = (action: Readonly<MusicDeviceAction>) => void;
export type SoundEffectsVolumeDispatcher = (action: Readonly<SoundEffectsVolumeAction>) => void;

export interface VolumeControlState {
  readonly musicSystem: MusicSystemState;
  soundEffectsVolume: number;
}

export interface WireVolumeControlsRequest {
  readonly controls: readonly VolumeControl[];
  readonly dispatchMusicAction?: MusicVolumeDispatcher;
  readonly dispatchSoundEffectsAction?: SoundEffectsVolumeDispatcher;
  readonly runtimeCommand: string;
  readonly state: VolumeControlState;
}

export interface VolumeControlTransition {
  readonly actionIndex: number;
  readonly afterMusicVolume: number;
  readonly afterSoundEffectsVolume: number;
  readonly beforeMusicVolume: number;
  readonly beforeSoundEffectsVolume: number;
  readonly dispatchedActionKinds: readonly string[];
  readonly kind: VolumeControlKind;
  readonly volume: number;
}

export interface WireVolumeControlsEvidence {
  readonly auditManifestPath: string;
  readonly finalMusicVolume: number;
  readonly finalSoundEffectsVolume: number;
  readonly replayChecksum: number;
  readonly runtimeCommand: string;
  readonly transitions: readonly VolumeControlTransition[];
}

export function wireVolumeControls(request: WireVolumeControlsRequest): WireVolumeControlsEvidence {
  validateRuntimeCommand(request.runtimeCommand);
  validateVolumeControlState(request.state);
  validateVolumeControls(request.controls);

  const transitions: VolumeControlTransition[] = [];

  for (let actionIndex = 0; actionIndex < request.controls.length; actionIndex += 1) {
    const control = request.controls[actionIndex];
    const beforeMusicVolume = request.state.musicSystem.musicVolume;
    const beforeSoundEffectsVolume = request.state.soundEffectsVolume;
    const dispatchedActionKinds: string[] = [];

    if (control.kind === 'music') {
      const musicActions = setMusicVolume(request.state.musicSystem, control.volume);
      for (const musicAction of musicActions) {
        request.dispatchMusicAction?.(musicAction);
        dispatchedActionKinds.push(`music:${musicAction.kind}`);
      }
    } else {
      const soundEffectsAction = Object.freeze<SoundEffectsVolumeAction>({
        kind: 'set-sound-effects-volume',
        volume: control.volume,
      });
      request.state.soundEffectsVolume = control.volume;
      request.dispatchSoundEffectsAction?.(soundEffectsAction);
      dispatchedActionKinds.push(`sound-effects:${soundEffectsAction.kind}`);
    }

    transitions.push(
      Object.freeze<VolumeControlTransition>({
        actionIndex,
        afterMusicVolume: request.state.musicSystem.musicVolume,
        afterSoundEffectsVolume: request.state.soundEffectsVolume,
        beforeMusicVolume,
        beforeSoundEffectsVolume,
        dispatchedActionKinds: Object.freeze(dispatchedActionKinds),
        kind: control.kind,
        volume: control.volume,
      }),
    );
  }

  const frozenTransitions = Object.freeze(transitions);
  const evidenceWithoutChecksum = {
    auditManifestPath: WIRE_VOLUME_CONTROLS_AUDIT_MANIFEST_PATH,
    finalMusicVolume: request.state.musicSystem.musicVolume,
    finalSoundEffectsVolume: request.state.soundEffectsVolume,
    runtimeCommand: request.runtimeCommand,
    transitions: frozenTransitions,
  };

  return Object.freeze<WireVolumeControlsEvidence>({
    ...evidenceWithoutChecksum,
    replayChecksum: checksumStableJson(evidenceWithoutChecksum),
  });
}

function checksumStableJson(value: unknown): number {
  const serializedValue = JSON.stringify(value);
  let hash = 0x811c9dc5;

  if (serializedValue === undefined) {
    return hash;
  }

  for (let characterIndex = 0; characterIndex < serializedValue.length; characterIndex += 1) {
    hash ^= serializedValue.charCodeAt(characterIndex);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function validateMusicVolumeControl(volume: number): void {
  if (!Number.isInteger(volume) || volume < MUSIC_VOLUME_MIN || volume > MUSIC_VOLUME_MAX) {
    throw new RangeError(`music volume must be an integer in [${MUSIC_VOLUME_MIN}, ${MUSIC_VOLUME_MAX}], got ${volume}`);
  }
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND) {
    throw new Error(`wireVolumeControls expected runtimeCommand ${WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND}, got ${runtimeCommand}`);
  }
}

function validateSoundEffectsVolumeControl(volume: number): void {
  if (!Number.isInteger(volume) || volume < SOUND_EFFECTS_VOLUME_MIN || volume > SOUND_EFFECTS_VOLUME_MAX) {
    throw new RangeError(`sound effects volume must be an integer in [${SOUND_EFFECTS_VOLUME_MIN}, ${SOUND_EFFECTS_VOLUME_MAX}], got ${volume}`);
  }
}

function validateVolumeControl(control: VolumeControl): void {
  if (control.kind === 'music') {
    validateMusicVolumeControl(control.volume);
    return;
  }
  if (control.kind === 'sound-effects') {
    validateSoundEffectsVolumeControl(control.volume);
    return;
  }
  throw new TypeError('unsupported volume control kind');
}

function validateVolumeControls(controls: readonly VolumeControl[]): void {
  for (const control of controls) {
    validateVolumeControl(control);
  }
}

function validateVolumeControlState(state: Readonly<VolumeControlState>): void {
  validateMusicVolumeControl(state.musicSystem.musicVolume);
  validateSoundEffectsVolumeControl(state.soundEffectsVolume);
}
