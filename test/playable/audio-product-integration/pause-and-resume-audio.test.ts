import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import type { MusicDeviceAction } from '../../../src/audio/musicSystem.ts';
import { createMusicSystem } from '../../../src/audio/musicSystem.ts';
import { PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND, pauseAndResumeAudio } from '../../../src/playable/audio-product-integration/pauseAndResumeAudio.ts';

async function hashWorkspaceFile(workspaceRelativePath: string): Promise<string> {
  const fileBytes = new Uint8Array(await Bun.file(workspaceRelativePath).arrayBuffer());
  return createHash('sha256').update(fileBytes).digest('hex');
}

describe('pauseAndResumeAudio', () => {
  test('locks the command contract, audit linkage, and source hash', async () => {
    const missingLiveAudioAudit = await Bun.file('plan_fps/manifests/01-011-audit-missing-live-audio.json').text();

    expect(PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(missingLiveAudioAudit).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(missingLiveAudioAudit).toContain('"name": "live-audio-host"');
    expect(await hashWorkspaceFile('src/playable/audio-product-integration/pauseAndResumeAudio.ts')).toBe('70ed65511fd1325a11805d1fe84a4c32db66c9ad50b84d4f685143fd63aeccf8');
  });

  test('pauses and resumes the loaded music path with deterministic replay evidence', () => {
    const dispatchedMusicActions: MusicDeviceAction[] = [];
    const musicSystem = createMusicSystem();
    musicSystem.currentMusicNum = 7;

    const pauseEvidence = pauseAndResumeAudio({
      dispatchMusicAction: (action) => {
        dispatchedMusicActions.push(action);
      },
      musicSystem,
      runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
      transition: 'pause',
    });

    expect(pauseEvidence).toEqual({
      dispatchedMusicActionCount: 1,
      musicActionKinds: ['pause-song'],
      musicLoadedAfter: true,
      musicLoadedBefore: true,
      musicPausedAfter: true,
      musicPausedBefore: false,
      replayChecksum: 3_761_865_743,
      replaySignature: 'runtimeCommand=bun run doom.ts|transition=pause|musicLoadedBefore=1|musicLoadedAfter=1|musicPausedBefore=0|musicPausedAfter=1|musicActionKinds=pause-song|soundEffectPolicy=unchanged',
      runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
      soundEffectPolicy: 'unchanged',
      transition: 'pause',
    });
    expect(Object.isFrozen(pauseEvidence)).toBe(true);
    expect(Object.isFrozen(pauseEvidence.musicActionKinds)).toBe(true);
    expect(musicSystem.paused).toBe(true);

    const resumeEvidence = pauseAndResumeAudio({
      dispatchMusicAction: (action) => {
        dispatchedMusicActions.push(action);
      },
      musicSystem,
      runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
      transition: 'resume',
    });

    expect(resumeEvidence).toEqual({
      dispatchedMusicActionCount: 1,
      musicActionKinds: ['resume-song'],
      musicLoadedAfter: true,
      musicLoadedBefore: true,
      musicPausedAfter: false,
      musicPausedBefore: true,
      replayChecksum: 6_529_641,
      replaySignature: 'runtimeCommand=bun run doom.ts|transition=resume|musicLoadedBefore=1|musicLoadedAfter=1|musicPausedBefore=1|musicPausedAfter=0|musicActionKinds=resume-song|soundEffectPolicy=unchanged',
      runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
      soundEffectPolicy: 'unchanged',
      transition: 'resume',
    });
    expect(musicSystem.paused).toBe(false);
    expect(dispatchedMusicActions).toEqual([{ kind: 'pause-song' }, { kind: 'resume-song' }]);
  });

  test('keeps unloaded music pause requests as deterministic no-ops', () => {
    const dispatchedMusicActions: MusicDeviceAction[] = [];
    const musicSystem = createMusicSystem();

    const evidence = pauseAndResumeAudio({
      dispatchMusicAction: (action) => {
        dispatchedMusicActions.push(action);
      },
      musicSystem,
      runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
      transition: 'pause',
    });

    expect(evidence).toEqual({
      dispatchedMusicActionCount: 0,
      musicActionKinds: [],
      musicLoadedAfter: false,
      musicLoadedBefore: false,
      musicPausedAfter: false,
      musicPausedBefore: false,
      replayChecksum: 368_206_884,
      replaySignature: 'runtimeCommand=bun run doom.ts|transition=pause|musicLoadedBefore=0|musicLoadedAfter=0|musicPausedBefore=0|musicPausedAfter=0|musicActionKinds=none|soundEffectPolicy=unchanged',
      runtimeCommand: PAUSE_AND_RESUME_AUDIO_RUNTIME_COMMAND,
      soundEffectPolicy: 'unchanged',
      transition: 'pause',
    });
    expect(dispatchedMusicActions).toEqual([]);
    expect(musicSystem.paused).toBe(false);
  });

  test('rejects non-target runtime commands before mutating or dispatching', () => {
    const dispatchedMusicActions: MusicDeviceAction[] = [];
    const musicSystem = createMusicSystem();
    musicSystem.currentMusicNum = 3;

    expect(() =>
      pauseAndResumeAudio({
        dispatchMusicAction: (action) => {
          dispatchedMusicActions.push(action);
        },
        musicSystem,
        runtimeCommand: 'bun run src/main.ts',
        transition: 'pause',
      }),
    ).toThrow('pauseAndResumeAudio requires bun run doom.ts');
    expect(dispatchedMusicActions).toEqual([]);
    expect(musicSystem.paused).toBe(false);
  });
});
