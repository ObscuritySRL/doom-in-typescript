import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { createMusicSystem } from '../../../src/audio/musicSystem.ts';
import type { ShutdownAudioChannelState, ShutdownAudioDeviceAction } from '../../../src/playable/audio-product-integration/shutdownAudioCleanly.ts';
import {
  SHUTDOWN_AUDIO_CLEANLY_AUDIT_SURFACE,
  SHUTDOWN_AUDIO_CLEANLY_CHANNEL_COUNT,
  SHUTDOWN_AUDIO_CLEANLY_COMMAND,
  SHUTDOWN_AUDIO_CLEANLY_SOURCE_AUDIT_STEP_ID,
  shutdownAudioCleanly,
} from '../../../src/playable/audio-product-integration/shutdownAudioCleanly.ts';

function createChannelStates(): ShutdownAudioChannelState[] {
  return [
    { handle: 41_001, origin: 7, pitch: 127, priority: 64, soundEffectId: 1 },
    { handle: 0, origin: null, pitch: 0, priority: 0, soundEffectId: null },
    { handle: 41_002, origin: 9, pitch: 132, priority: 80, soundEffectId: 48 },
    { handle: 0, origin: 11, pitch: 120, priority: 72, soundEffectId: null },
    { handle: 0, origin: null, pitch: 0, priority: 0, soundEffectId: null },
    { handle: 41_005, origin: null, pitch: 128, priority: 90, soundEffectId: 87 },
    { handle: 0, origin: null, pitch: 0, priority: 0, soundEffectId: null },
    { handle: 0, origin: null, pitch: 0, priority: 0, soundEffectId: null },
  ];
}

function createLoadedMusicSystem() {
  const musicSystem = createMusicSystem({
    hasIntroALump: true,
    initialVolume: 12,
  });
  musicSystem.currentMusicNum = 35;
  musicSystem.looping = true;
  musicSystem.paused = true;
  musicSystem.scheduler = null;
  return musicSystem;
}

async function sha256(path: string): Promise<string> {
  const sourceText = await Bun.file(path).text();
  return createHash('sha256').update(sourceText).digest('hex');
}

describe('shutdownAudioCleanly', () => {
  test('locks command contract, source audit linkage, manifest schema, and formatted source hash', async () => {
    const manifest = await Bun.file('plan_fps/manifests/01-011-audit-missing-live-audio.json').json();
    const shutdownSurface = manifest.explicitNullSurfaces.find((surface: { name: string }) => surface.name === SHUTDOWN_AUDIO_CLEANLY_AUDIT_SURFACE);

    expect(SHUTDOWN_AUDIO_CLEANLY_COMMAND).toBe('bun run doom.ts');
    expect(SHUTDOWN_AUDIO_CLEANLY_SOURCE_AUDIT_STEP_ID).toBe('01-011');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.step.id).toBe(SHUTDOWN_AUDIO_CLEANLY_SOURCE_AUDIT_STEP_ID);
    expect(manifest.commandContracts.target.runtimeCommand).toBe(SHUTDOWN_AUDIO_CLEANLY_COMMAND);
    expect(shutdownSurface).toEqual({
      name: 'shutdown-audio-path',
      path: null,
      reason: 'No audio shutdown route is exposed by src/main.ts.',
    });
    expect(await sha256('src/playable/audio-product-integration/shutdownAudioCleanly.ts')).toBe('8089bd9f5000915071a9230a9eed68957ca0ee4f688094c9d839c38f6c9227db');
  });

  test('stops paused music, clears active sound-effect channels, dispatches replay-safe actions, and locks evidence', () => {
    const dispatchedActions: ShutdownAudioDeviceAction[] = [];
    const musicSystem = createLoadedMusicSystem();
    const soundEffectChannels = createChannelStates();

    const result = shutdownAudioCleanly({
      dispatchAction: (action) => {
        dispatchedActions.push(action);
      },
      musicSystem,
      runtimeCommand: SHUTDOWN_AUDIO_CLEANLY_COMMAND,
      soundEffectChannels,
    });

    expect(result.commandContract).toBe(SHUTDOWN_AUDIO_CLEANLY_COMMAND);
    expect(result.auditSurface).toBe(SHUTDOWN_AUDIO_CLEANLY_AUDIT_SURFACE);
    expect(result.actions).toEqual([
      { kind: 'resume-song' },
      { kind: 'stop-song', musicNum: 35 },
      { channelIndex: 0, kind: 'stop-sound-channel', soundEffectId: 1 },
      { channelIndex: 2, kind: 'stop-sound-channel', soundEffectId: 48 },
      { channelIndex: 3, kind: 'stop-sound-channel', soundEffectId: null },
      { channelIndex: 5, kind: 'stop-sound-channel', soundEffectId: 87 },
    ]);
    expect(dispatchedActions).toEqual(Array.from(result.actions));
    expect(musicSystem).toMatchObject({
      currentMusicNum: null,
      looping: false,
      paused: false,
      scheduler: null,
    });
    expect(soundEffectChannels).toEqual(
      Array.from({ length: SHUTDOWN_AUDIO_CLEANLY_CHANNEL_COUNT }, () => ({
        handle: 0,
        origin: null,
        pitch: 0,
        priority: 0,
        soundEffectId: null,
      })),
    );
    expect(result.transition.before.music).toEqual({
      currentMusicNum: 35,
      hasIntroALump: true,
      looping: true,
      musicDevice: 3,
      musicVolume: 12,
      paused: true,
      schedulerLoaded: false,
    });
    expect(result.transition.after.music).toEqual({
      currentMusicNum: null,
      hasIntroALump: true,
      looping: false,
      musicDevice: 3,
      musicVolume: 12,
      paused: false,
      schedulerLoaded: false,
    });
    expect(result.transition.before.soundEffectChannels.filter((channel) => channel.active).map((channel) => channel.channelIndex)).toEqual([0, 2, 3, 5]);
    expect(result.transition.after.soundEffectChannels.every((channel) => !channel.active)).toBe(true);
    expect(result.replaySignature).toBe(
      'beforeMusic{currentMusicNum=35,hasIntroALump=true,looping=true,musicDevice=3,musicVolume=12,paused=true,schedulerLoaded=false}->beforeSoundEffects{0:active:1:7:64:127|1:empty:null:null:0:0|2:active:48:9:80:132|3:active:null:11:72:120|4:empty:null:null:0:0|5:active:87:null:90:128|6:empty:null:null:0:0|7:empty:null:null:0:0}->actions{resume-song|stop-song:35|stop-sound-channel:0:1|stop-sound-channel:2:48|stop-sound-channel:3:null|stop-sound-channel:5:87}->afterMusic{currentMusicNum=null,hasIntroALump=true,looping=false,musicDevice=3,musicVolume=12,paused=false,schedulerLoaded=false}->afterSoundEffects{0:empty:null:null:0:0|1:empty:null:null:0:0|2:empty:null:null:0:0|3:empty:null:null:0:0|4:empty:null:null:0:0|5:empty:null:null:0:0|6:empty:null:null:0:0|7:empty:null:null:0:0}',
    );
    expect(result.replayChecksum).toBe(3_712_582_611);
    expect(JSON.stringify(result)).not.toContain('41001');
    expect(JSON.stringify(result)).not.toContain('41002');
    expect(JSON.stringify(result)).not.toContain('41005');
  });

  test('returns replay-stable no-op evidence when no audio is loaded', () => {
    const result = shutdownAudioCleanly({
      musicSystem: createMusicSystem(),
      runtimeCommand: SHUTDOWN_AUDIO_CLEANLY_COMMAND,
      soundEffectChannels: Array.from({ length: SHUTDOWN_AUDIO_CLEANLY_CHANNEL_COUNT }, () => ({
        handle: 0,
        origin: null,
        pitch: 0,
        priority: 0,
        soundEffectId: null,
      })),
    });

    expect(result.actions).toEqual([]);
    expect(result.transition.before).toEqual(result.transition.after);
    expect(result.replayChecksum).toBe(1_410_886_380);
  });

  test('rejects the wrong command before mutating audio state or dispatching actions', () => {
    const dispatchedActions: ShutdownAudioDeviceAction[] = [];
    const musicSystem = createLoadedMusicSystem();
    const soundEffectChannels = createChannelStates();

    expect(() =>
      shutdownAudioCleanly({
        dispatchAction: (action) => {
          dispatchedActions.push(action);
        },
        musicSystem,
        runtimeCommand: 'bun run src/main.ts',
        soundEffectChannels,
      }),
    ).toThrow(RangeError);

    expect(dispatchedActions).toEqual([]);
    expect(musicSystem.currentMusicNum).toBe(35);
    expect(musicSystem.paused).toBe(true);
    expect(soundEffectChannels).toEqual(createChannelStates());
  });

  test('rejects invalid channel state before mutating audio state or dispatching actions', () => {
    const dispatchedActions: ShutdownAudioDeviceAction[] = [];
    const musicSystem = createLoadedMusicSystem();
    const soundEffectChannels = createChannelStates();
    soundEffectChannels[2].handle = -1;

    expect(() =>
      shutdownAudioCleanly({
        dispatchAction: (action) => {
          dispatchedActions.push(action);
        },
        musicSystem,
        runtimeCommand: SHUTDOWN_AUDIO_CLEANLY_COMMAND,
        soundEffectChannels,
      }),
    ).toThrow(RangeError);

    expect(dispatchedActions).toEqual([]);
    expect(musicSystem.currentMusicNum).toBe(35);
    expect(musicSystem.paused).toBe(true);
    expect(soundEffectChannels[0]).toEqual({ handle: 41_001, origin: 7, pitch: 127, priority: 64, soundEffectId: 1 });
    expect(soundEffectChannels[2]).toEqual({ handle: -1, origin: 9, pitch: 132, priority: 80, soundEffectId: 48 });
  });
});
