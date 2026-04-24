import { describe, expect, test } from 'bun:test';

import {
  EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG,
  EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG,
  MIDI_PERCUSSION_CHANNEL,
  MUS_MAX_CHANNELS,
  MUS_PERCUSSION_CHANNEL,
  MUSIC_EVENT_KINDS,
  MUSIC_VOLUME_MAX,
  MUSIC_VOLUME_MIN,
} from '../../src/oracles/musicEventLog.ts';
import type { ChangeMusicEvent, MusicEvent, MusicEventKind, MusicEventLogArtifact, MusicEventLogPayload, PauseMusicEvent, ResumeMusicEvent, StopMusicEvent } from '../../src/oracles/musicEventLog.ts';
import { ORACLE_KINDS } from '../../src/oracles/schema.ts';
import type { OracleArtifact } from '../../src/oracles/schema.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';

describe('music volume constants', () => {
  test('MUSIC_VOLUME_MIN is 0', () => {
    expect(MUSIC_VOLUME_MIN).toBe(0);
  });

  test('MUSIC_VOLUME_MAX is 15', () => {
    expect(MUSIC_VOLUME_MAX).toBe(15);
  });

  test('reference music volume is within valid range', () => {
    expect(REFERENCE_RUN_MANIFEST.audio.musicVolume).toBeGreaterThanOrEqual(MUSIC_VOLUME_MIN);
    expect(REFERENCE_RUN_MANIFEST.audio.musicVolume).toBeLessThanOrEqual(MUSIC_VOLUME_MAX);
  });
});

describe('MUS/MIDI format constants', () => {
  test('MUS_MAX_CHANNELS is 16', () => {
    expect(MUS_MAX_CHANNELS).toBe(16);
  });

  test('MUS_PERCUSSION_CHANNEL is 15', () => {
    expect(MUS_PERCUSSION_CHANNEL).toBe(15);
  });

  test('MIDI_PERCUSSION_CHANNEL is 9', () => {
    expect(MIDI_PERCUSSION_CHANNEL).toBe(9);
  });

  test('percussion channels are within their format bounds', () => {
    expect(MUS_PERCUSSION_CHANNEL).toBeLessThan(MUS_MAX_CHANNELS);
    expect(MIDI_PERCUSSION_CHANNEL).toBeLessThan(MUS_MAX_CHANNELS);
  });
});

describe('MUSIC_EVENT_KINDS', () => {
  test('has exactly 4 event kinds', () => {
    expect(MUSIC_EVENT_KINDS).toHaveLength(4);
  });

  test('contains all expected kinds', () => {
    expect(MUSIC_EVENT_KINDS).toContain('change-music');
    expect(MUSIC_EVENT_KINDS).toContain('pause-music');
    expect(MUSIC_EVENT_KINDS).toContain('resume-music');
    expect(MUSIC_EVENT_KINDS).toContain('stop-music');
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...MUSIC_EVENT_KINDS].sort();
    expect(MUSIC_EVENT_KINDS).toEqual(sorted);
  });

  test('has unique entries', () => {
    const unique = new Set(MUSIC_EVENT_KINDS);
    expect(unique.size).toBe(MUSIC_EVENT_KINDS.length);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(MUSIC_EVENT_KINDS)).toBe(true);
  });
});

describe('ORACLE_KINDS cross-reference', () => {
  test('music-event-log is a registered oracle kind', () => {
    expect(ORACLE_KINDS).toContain('music-event-log');
  });
});

describe('EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG', () => {
  test('targets title-loop run mode', () => {
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.targetRunMode).toBe('title-loop');
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.ticRateHz).toBe(35);
  });

  test('musicDevice matches REFERENCE_RUN_MANIFEST', () => {
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.musicDevice).toBe(REFERENCE_RUN_MANIFEST.audio.musicDevice);
  });

  test('musicVolume matches REFERENCE_RUN_MANIFEST', () => {
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.musicVolume).toBe(REFERENCE_RUN_MANIFEST.audio.musicVolume);
  });

  test('has empty events array', () => {
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.events).toHaveLength(0);
  });

  test('has non-empty description', () => {
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.description.length).toBeGreaterThan(0);
  });

  test('is frozen at top level and events array', () => {
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.events)).toBe(true);
  });
});

describe('EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG', () => {
  test('targets demo-playback run mode', () => {
    expect(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.targetRunMode).toBe('demo-playback');
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('musicDevice matches REFERENCE_RUN_MANIFEST', () => {
    expect(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.musicDevice).toBe(REFERENCE_RUN_MANIFEST.audio.musicDevice);
  });

  test('musicVolume matches REFERENCE_RUN_MANIFEST', () => {
    expect(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.musicVolume).toBe(REFERENCE_RUN_MANIFEST.audio.musicVolume);
  });

  test('has empty events array', () => {
    expect(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.events).toHaveLength(0);
  });

  test('is frozen at top level and events array', () => {
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.events)).toBe(true);
  });
});

describe('MusicEvent discriminated union narrowing', () => {
  test('change-music narrows to ChangeMusicEvent with lumpName and looping', () => {
    const event: MusicEvent = {
      tic: 0,
      kind: 'change-music',
      lumpName: 'D_INTRO',
      looping: true,
    };
    if (event.kind === 'change-music') {
      const narrowed: ChangeMusicEvent = event;
      expect(narrowed.lumpName).toBe('D_INTRO');
      expect(narrowed.looping).toBe(true);
    }
    expect(event.kind).toBe('change-music');
  });

  test('pause-music narrows to PauseMusicEvent', () => {
    const event: MusicEvent = {
      tic: 100,
      kind: 'pause-music',
    };
    if (event.kind === 'pause-music') {
      const narrowed: PauseMusicEvent = event;
      expect(narrowed.tic).toBe(100);
    }
    expect(event.kind).toBe('pause-music');
  });

  test('resume-music narrows to ResumeMusicEvent', () => {
    const event: MusicEvent = {
      tic: 110,
      kind: 'resume-music',
    };
    if (event.kind === 'resume-music') {
      const narrowed: ResumeMusicEvent = event;
      expect(narrowed.tic).toBe(110);
    }
    expect(event.kind).toBe('resume-music');
  });

  test('stop-music narrows to StopMusicEvent', () => {
    const event: MusicEvent = {
      tic: 200,
      kind: 'stop-music',
    };
    if (event.kind === 'stop-music') {
      const narrowed: StopMusicEvent = event;
      expect(narrowed.tic).toBe(200);
    }
    expect(event.kind).toBe('stop-music');
  });
});

describe('MusicEventLogPayload well-formed acceptance', () => {
  test('accepts a multi-event payload with ascending tic order', () => {
    const payload: MusicEventLogPayload = {
      description: 'Title loop music events',
      targetRunMode: 'title-loop',
      ticRateHz: 35,
      musicDevice: 3,
      musicVolume: 8,
      events: [
        { tic: 0, kind: 'change-music', lumpName: 'D_INTRO', looping: true },
        { tic: 170, kind: 'change-music', lumpName: 'D_E1M5', looping: true },
        { tic: 5196, kind: 'stop-music' },
      ],
    };
    expect(payload.events).toHaveLength(3);
    const tics = payload.events.map((event) => event.tic);
    expect(tics).toEqual([0, 170, 5196]);
  });

  test('accepts pause/resume cycle within a demo playback', () => {
    const payload: MusicEventLogPayload = {
      description: 'Demo playback with pause',
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      musicDevice: 3,
      musicVolume: 8,
      events: [
        { tic: 0, kind: 'change-music', lumpName: 'D_E1M5', looping: true },
        { tic: 50, kind: 'pause-music' },
        { tic: 85, kind: 'resume-music' },
      ],
    };
    expect(payload.events).toHaveLength(3);
    expect(payload.events[0].kind).toBe('change-music');
    expect(payload.events[1].kind).toBe('pause-music');
    expect(payload.events[2].kind).toBe('resume-music');
  });

  test('allows multiple events at the same tic', () => {
    const payload: MusicEventLogPayload = {
      description: 'Music change at same tic as stop',
      targetRunMode: 'title-loop',
      ticRateHz: 35,
      musicDevice: 3,
      musicVolume: 8,
      events: [
        { tic: 170, kind: 'stop-music' },
        { tic: 170, kind: 'change-music', lumpName: 'D_E1M5', looping: true },
      ],
    };
    expect(payload.events).toHaveLength(2);
    expect(payload.events[0].tic).toBe(payload.events[1].tic);
  });
});

describe('parity-sensitive edge cases', () => {
  test('title loop D_INTRO starts at tic 0 as first music event (F-025)', () => {
    const event: ChangeMusicEvent = {
      tic: 0,
      kind: 'change-music',
      lumpName: 'D_INTRO',
      looping: true,
    };
    expect(event.tic).toBe(0);
    expect(event.lumpName).toBe('D_INTRO');
    expect(event.looping).toBe(true);
  });

  test('demo-initiated music uses level-init pattern (F-025)', () => {
    // When a demo starts, S_ChangeMusic is called with the level's
    // music lump; this is the "level-init" music change mode from
    // the title sequence reference
    const event: ChangeMusicEvent = {
      tic: 170,
      kind: 'change-music',
      lumpName: 'D_E1M5',
      looping: true,
    };
    expect(event.lumpName).toMatch(/^D_E\dM\d$/);
  });

  test('inherited music means no change-music event is emitted (F-025)', () => {
    // CREDIT and HELP2 pages inherit the preceding demo's music;
    // the parity-critical behavior is that NO change-music event
    // occurs during inherited-music pages
    const titleLoopEvents: MusicEvent[] = [
      { tic: 0, kind: 'change-music', lumpName: 'D_INTRO', looping: true },
      { tic: 170, kind: 'change-music', lumpName: 'D_E1M5', looping: true },
      // No event at CREDIT page start (tic 5196) — music inherited
      { tic: 5396, kind: 'change-music', lumpName: 'D_E1M3', looping: true },
      // No event at HELP2 page start (tic 9232) — music inherited
      { tic: 9432, kind: 'change-music', lumpName: 'D_E1M7', looping: true },
    ];
    // Only 4 change-music events in the full title cycle, not 6,
    // because 2 page states inherit music without triggering S_ChangeMusic
    const changeMusicEvents = titleLoopEvents.filter((event) => event.kind === 'change-music');
    expect(changeMusicEvents).toHaveLength(4);
  });

  test('MUS percussion channel maps to MIDI channel 9 during conversion', () => {
    // MUS channel 15 → MIDI channel 9 is a fixed mapping in mus2mid.c
    expect(MUS_PERCUSSION_CHANNEL).toBe(15);
    expect(MIDI_PERCUSSION_CHANNEL).toBe(9);
    // They differ because MUS and MIDI use different channel numbering
    expect(MUS_PERCUSSION_CHANNEL).not.toBe(MIDI_PERCUSSION_CHANNEL);
  });

  test('music device 3 is the reference default (General MIDI)', () => {
    expect(REFERENCE_RUN_MANIFEST.audio.musicDevice).toBe(3);
    expect(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG.musicDevice).toBe(3);
    expect(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG.musicDevice).toBe(3);
  });

  test('non-looping music track stops at MUS end marker', () => {
    // A change-music event with looping=false means the track plays
    // once and stops; parity requires the exact tic at which playback
    // ends to match
    const event: ChangeMusicEvent = {
      tic: 50,
      kind: 'change-music',
      lumpName: 'D_INTRO',
      looping: false,
    };
    expect(event.looping).toBe(false);
  });
});

describe('compile-time type satisfaction', () => {
  test('MusicEventLogArtifact wraps MusicEventLogPayload in OracleArtifact envelope', () => {
    const artifact: MusicEventLogArtifact = {
      kind: 'music-event-log',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: '0'.repeat(64),
      payload: EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG,
    };
    expect(artifact.kind).toBe('music-event-log');
    expect(artifact.version).toBe(1);
    expect(artifact.payload).toBe(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG);
  });

  test('MusicEventLogArtifact satisfies OracleArtifact<MusicEventLogPayload>', () => {
    const artifact: OracleArtifact<MusicEventLogPayload> = {
      kind: 'music-event-log',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: 'A'.repeat(64),
      payload: EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG,
    };
    expect(artifact.payload.targetRunMode).toBe('demo-playback');
  });

  test('MusicEventKind type covers all MUSIC_EVENT_KINDS entries', () => {
    for (const kind of MUSIC_EVENT_KINDS) {
      const typed: MusicEventKind = kind;
      expect(typed).toBe(kind);
    }
  });
});
