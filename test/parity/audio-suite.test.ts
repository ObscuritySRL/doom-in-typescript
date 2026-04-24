import { describe, expect, it } from 'bun:test';

import { createHash } from 'node:crypto';

import type { MusicDeviceAction } from '../../src/audio/musicSystem.ts';
import { parseMusScore, MusEventKind } from '../../src/audio/musParser.ts';
import { parseSfxLump } from '../../src/audio/sfxLumps.ts';
import { changeHarnessMusic, createAudioParityHarness, pauseHarnessMusic, resumeHarnessMusic, runHarnessTic, setHarnessMusicVolume, startHarnessSfx, stopHarnessMusic, stopHarnessSfxByOrigin } from '../../src/audio/audioParity.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import audioHashesFixture from './fixtures/audioHashes.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const wadHeader = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, wadHeader);
const lookup = new LumpLookup(directory);
const e1m1Score = parseMusScore(lookup.getLumpData('D_E1M1', wadBuffer));
const pistolLump = parseSfxLump(lookup.getLumpData('DSPISTOL', wadBuffer));
const shotgunLump = parseSfxLump(lookup.getLumpData('DSSHOTGN', wadBuffer));

const DOOM_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOM.EXE`;
const DOOMD_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOMD.EXE`;

const listener = Object.freeze({ x: 0, y: 0, angle: 0 });

function sha(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
}

function pistolRequest(harness: ReturnType<typeof createAudioParityHarness>, overrides: Partial<Parameters<typeof startHarnessSfx>[1]['request']> = {}) {
  const origin = overrides.origin !== undefined ? overrides.origin : null;
  const listenerOrigin = overrides.listenerOrigin !== undefined ? overrides.listenerOrigin : origin;
  return {
    sfxId: 1,
    priority: 64,
    pitchClass: 'default' as const,
    sourcePosition: null,
    listener,
    sfxVolume: 15,
    isBossMap: false,
    linkVolumeAdjust: null,
    linkPitch: null,
    rng: new DoomRandom(),
    table: harness.channelTable,
    ...overrides,
    origin,
    listenerOrigin,
  };
}

function summarizeActions(actions: readonly MusicDeviceAction[]) {
  return actions.map((action) => {
    switch (action.kind) {
      case 'play-song':
        return { kind: action.kind, looping: action.looping, musicNum: action.musicNum };
      case 'set-volume':
        return { kind: action.kind, volume: action.volume };
      case 'stop-song':
        return { kind: action.kind, musicNum: action.musicNum };
      default:
        return { kind: action.kind };
    }
  });
}

function summarizeEvent(event: ReturnType<typeof runHarnessTic>['dispatchedMusicEvents'][number]['event']) {
  switch (event.kind) {
    case MusEventKind.ControllerChange:
      return { kind: 'controller-change', channel: event.channel, controller: event.controller, delay: event.delay, value: event.value };
    case MusEventKind.PlayNote:
      return { kind: 'play-note', channel: event.channel, delay: event.delay, note: event.note, velocity: event.velocity };
    case MusEventKind.ReleaseNote:
      return { kind: 'release-note', channel: event.channel, delay: event.delay, note: event.note };
    case MusEventKind.PitchBend:
      return { kind: 'pitch-bend', bend: event.bend, channel: event.channel, delay: event.delay };
    case MusEventKind.SystemEvent:
      return { kind: 'system-event', channel: event.channel, controller: event.controller, delay: event.delay };
    case MusEventKind.ScoreEnd:
      return { kind: 'score-end', channel: event.channel, delay: event.delay };
    default:
      throw new Error('unsupported MUS event kind');
  }
}

function summarizeDispatched(dispatchedMusicEvents: ReturnType<typeof runHarnessTic>['dispatchedMusicEvents']) {
  return dispatchedMusicEvents.map(({ event, musQuicktick }) => ({
    musQuicktick,
    event: summarizeEvent(event),
  }));
}

function buildSoundReplacementTrace() {
  const harness = createAudioParityHarness();
  const initialStart = startHarnessSfx(harness, {
    sfxLump: pistolLump,
    request: pistolRequest(harness, {
      origin: 7,
      listenerOrigin: 1,
      sourcePosition: { x: 500 * 65536, y: 0 },
    }),
  });
  const firstTic = runHarnessTic(harness);
  const replacementStart = startHarnessSfx(harness, {
    sfxLump: shotgunLump,
    request: pistolRequest(harness, {
      origin: 7,
      listenerOrigin: 1,
      sourcePosition: { x: -400 * 65536, y: 0 },
    }),
  });
  const secondTic = runHarnessTic(harness);
  const stopChannel = stopHarnessSfxByOrigin(harness, 7);
  const thirdTic = runHarnessTic(harness);

  const trace = {
    initialStart: initialStart.kind === 'started' ? { kind: initialStart.kind, cnum: initialStart.cnum, separation: initialStart.separation, volume: initialStart.volume } : { kind: initialStart.kind },
    replacementStart: replacementStart.kind === 'started' ? { kind: replacementStart.kind, cnum: replacementStart.cnum, separation: replacementStart.separation, volume: replacementStart.volume } : { kind: replacementStart.kind },
    stopChannel,
    entries: [firstTic, secondTic, thirdTic].map(({ activeChannels, sfxHash, tic }) => ({ activeChannels, hash: sfxHash, tic })),
  };

  return {
    ...trace,
    streamHash: sha(trace),
  };
}

function buildMusicLifecycleTrace() {
  const harness = createAudioParityHarness();
  const actionTrace = [
    { step: 'set-volume', actions: summarizeActions(setHarnessMusicVolume(harness, 12)) },
    { step: 'change-music', actions: summarizeActions(changeHarnessMusic(harness, { musicNum: 1, looping: true, score: e1m1Score })) },
    { step: 'same-track-noop', actions: summarizeActions(changeHarnessMusic(harness, { musicNum: 1, looping: false, score: e1m1Score })) },
  ];

  const ticZero = runHarnessTic(harness);
  const ticOne = runHarnessTic(harness);
  actionTrace.push({ step: 'pause-music', actions: summarizeActions(pauseHarnessMusic(harness)) });
  const ticTwo = runHarnessTic(harness);
  actionTrace.push({ step: 'resume-music', actions: summarizeActions(resumeHarnessMusic(harness)) });
  const ticThree = runHarnessTic(harness);
  const ticFour = runHarnessTic(harness);
  actionTrace.push({ step: 'stop-music', actions: summarizeActions(stopHarnessMusic(harness)) });
  const ticFive = runHarnessTic(harness);

  const trace = {
    actionTrace,
    ticSummaries: [ticZero, ticOne, ticTwo, ticThree, ticFour, ticFive].map(({ activeChannels, dispatchedMusicEvents, sfxHash, tic }) => {
      const eventSummary = summarizeDispatched(dispatchedMusicEvents);
      return {
        activeChannels,
        eventCount: eventSummary.length,
        eventHash: sha(eventSummary),
        firstEvent: eventSummary[0] ?? null,
        hash: sfxHash,
        lastEvent: eventSummary.length === 0 ? null : eventSummary.at(-1),
        tic,
      };
    }),
  };

  return {
    ...trace,
    streamHash: sha(trace),
  };
}

function buildMusicIsolationTrace() {
  const silentHarness = createAudioParityHarness();
  const silentBaseline = runHarnessTic(silentHarness);

  const musicOnlyHarness = createAudioParityHarness();
  void changeHarnessMusic(musicOnlyHarness, { musicNum: 1, looping: true, score: e1m1Score });
  const silentWithMusic = runHarnessTic(musicOnlyHarness);

  const trace = {
    silentBaseline: {
      activeChannels: silentBaseline.activeChannels,
      eventCount: silentBaseline.dispatchedMusicEvents.length,
      hash: silentBaseline.sfxHash,
      tic: silentBaseline.tic,
    },
    silentWithMusic: {
      activeChannels: silentWithMusic.activeChannels,
      eventCount: silentWithMusic.dispatchedMusicEvents.length,
      hash: silentWithMusic.sfxHash,
      tic: silentWithMusic.tic,
    },
  };

  return {
    ...trace,
    streamHash: sha(trace),
  };
}

async function readExecutable(path: string): Promise<Buffer> {
  return Buffer.from(await Bun.file(path).arrayBuffer());
}

describe('audio parity suite fixture', () => {
  it('locks the same-origin SFX replacement trace and post-stop silence hash', () => {
    const trace = buildSoundReplacementTrace();

    expect(JSON.stringify(trace.initialStart)).toBe(JSON.stringify(audioHashesFixture.soundReplacement.initialStart));
    expect(JSON.stringify(trace.replacementStart)).toBe(JSON.stringify(audioHashesFixture.soundReplacement.replacementStart));
    expect(trace.stopChannel).toBe(audioHashesFixture.soundReplacement.stopChannel);
    expect(JSON.stringify(trace.entries)).toBe(JSON.stringify(audioHashesFixture.soundReplacement.entries));
    expect(trace.streamHash).toBe(audioHashesFixture.soundReplacement.streamHash);
    expect(trace.entries[2]!.hash).toBe(audioHashesFixture.musicIsolation.silentBaseline.hash);
  });

  it('locks the music lifecycle trace, including the same-track no-op and paused scheduler boundary', () => {
    const trace = buildMusicLifecycleTrace();

    expect(JSON.stringify(trace.actionTrace)).toBe(JSON.stringify(audioHashesFixture.musicLifecycle.actionTrace));
    expect(JSON.stringify(trace.ticSummaries)).toBe(JSON.stringify(audioHashesFixture.musicLifecycle.ticSummaries));
    expect(trace.streamHash).toBe(audioHashesFixture.musicLifecycle.streamHash);
    expect(trace.actionTrace[2]!.actions).toEqual([]);
    expect(trace.ticSummaries[2]!.eventCount).toBe(0);
    expect(trace.ticSummaries[3]!.eventCount).toBe(0);
    expect(trace.ticSummaries[4]!.eventCount).toBeGreaterThan(0);
  });

  it('locks the SFX/music oracle split so active music does not perturb silent SFX hashes', () => {
    const trace = buildMusicIsolationTrace();

    expect(JSON.stringify(trace.silentBaseline)).toBe(JSON.stringify(audioHashesFixture.musicIsolation.silentBaseline));
    expect(JSON.stringify(trace.silentWithMusic)).toBe(JSON.stringify(audioHashesFixture.musicIsolation.silentWithMusic));
    expect(trace.streamHash).toBe(audioHashesFixture.musicIsolation.streamHash);
    expect(trace.silentBaseline.hash).toBe(trace.silentWithMusic.hash);
    expect(trace.silentBaseline.activeChannels).toBe(0);
    expect(trace.silentWithMusic.activeChannels).toBe(0);
    expect(trace.silentWithMusic.eventCount).toBeGreaterThan(0);
  });

  it('anchors audio config strings back to both bundled DOS executables', async () => {
    const [doomExe, doomdExe] = await Promise.all([readExecutable(DOOM_EXE_PATH), readExecutable(DOOMD_EXE_PATH)]);

    for (const requiredString of audioHashesFixture.binaryAnchors.requiredStrings) {
      const ascii = Buffer.from(requiredString, 'ascii');
      expect(doomExe.includes(ascii)).toBe(true);
      expect(doomdExe.includes(ascii)).toBe(true);
    }
  });
});
