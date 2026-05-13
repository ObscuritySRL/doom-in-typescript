import { describe, expect, test } from 'bun:test';

import { MUS_MAX_CHANNELS, MUS_PERCUSSION_CHANNEL, MUSIC_EVENT_KINDS, MUSIC_VOLUME_MAX, MUSIC_VOLUME_MIN } from '../../../src/oracles/musicEventLog.ts';
import format from './define-music-event-capture-format.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-014-define-music-event-capture-format.md';

describe('format identity and metadata', () => {
  test('declares OR-VP-MUSIC-EVENT-014 oracle id, step 02-014, and oracle lane', () => {
    expect(format.id).toBe('OR-VP-MUSIC-EVENT-014');
    expect(format.stepId).toBe('02-014');
    expect(format.stepTitle).toBe('Define Music Event Capture Format');
    expect(format.lane).toBe('oracle');
  });

  test('points to the existing musicEventLog source module', () => {
    expect(format.sourceModule).toBe('src/oracles/musicEventLog.ts');
  });

  test('scopes the format to music events only and references SFX 02-013', () => {
    expect(format.scopeNote.toLowerCase()).toContain('music');
    expect(format.scopeNote).toContain('02-013');
  });
});

describe('event kinds match source-level MUSIC_EVENT_KINDS', () => {
  test('JSON event kinds equal the source-level list', () => {
    expect(format.eventKinds).toEqual([...MUSIC_EVENT_KINDS]);
  });

  test('event kinds are sorted and unique', () => {
    expect([...format.eventKinds].sort()).toEqual([...format.eventKinds]);
    expect(new Set(format.eventKinds).size).toBe(format.eventKinds.length);
  });
});

describe('music volume and channel constants match source-level constants', () => {
  test('music volume range is [0, 15]', () => {
    expect(format.musicVolumeMin).toBe(MUSIC_VOLUME_MIN);
    expect(format.musicVolumeMax).toBe(MUSIC_VOLUME_MAX);
    expect(format.musicVolumeMin).toBe(0);
    expect(format.musicVolumeMax).toBe(15);
  });

  test('MUS max channels is 16 and percussion channel is 15', () => {
    expect(format.musMaxChannels).toBe(MUS_MAX_CHANNELS);
    expect(format.musMaxChannels).toBe(16);
    expect(format.musPercussionChannel).toBe(MUS_PERCUSSION_CHANNEL);
    expect(format.musPercussionChannel).toBe(15);
  });

  test('MIDI percussion channel is 9 (General MIDI)', () => {
    expect(format.midiPercussionChannel).toBe(9);
  });

  test('entry ordering rule pins ascending-by-tic order', () => {
    expect(format.entryOrderingRule).toBe('ascending-by-tic-number-strict');
  });
});

describe('alignment with plan_vanilla_parity step 02-014', () => {
  test('step file write lock pins the format json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-music-event-capture-format.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-music-event-capture-format.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('event kinds list rejects unknown values', () => {
    const eventKindSet = new Set(format.eventKinds);
    expect(eventKindSet.has('start-music')).toBe(false);
    expect(eventKindSet.has('change')).toBe(false);
  });

  test('volume max of 14 or 16 would not match vanilla', () => {
    expect(format.musicVolumeMax).not.toBe(14);
    expect(format.musicVolumeMax).not.toBe(16);
  });
});
