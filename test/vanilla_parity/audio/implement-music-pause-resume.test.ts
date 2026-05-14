import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MUSIC_PAUSE_EMITS_NOTE_OFF,
  VANILLA_MUSIC_PAUSE_IS_IDEMPOTENT,
  VANILLA_MUSIC_PAUSE_PRESERVES_CHANNEL_STATE,
  VANILLA_MUSIC_PAUSE_PRESERVES_SCORE_POINTER,
  VANILLA_MUSIC_RESUME_EMITS_NOTE_ON,
  VANILLA_MUSIC_RESUME_IS_IDEMPOTENT,
  applyVanillaMusicCommand,
} from '../../../src/audio/implement-music-pause-resume.ts';

describe('vanilla music pause/resume pin', () => {
  test('pause preserves score pointer and channel state', () => {
    expect(VANILLA_MUSIC_PAUSE_PRESERVES_SCORE_POINTER).toBe(true);
    expect(VANILLA_MUSIC_PAUSE_PRESERVES_CHANNEL_STATE).toBe(true);
  });

  test('pause does not emit NoteOff on active voices', () => {
    expect(VANILLA_MUSIC_PAUSE_EMITS_NOTE_OFF).toBe(false);
  });

  test('resume does not emit NoteOn on the resumed voices', () => {
    expect(VANILLA_MUSIC_RESUME_EMITS_NOTE_ON).toBe(false);
  });

  test('pause and resume are both idempotent', () => {
    expect(VANILLA_MUSIC_PAUSE_IS_IDEMPOTENT).toBe(true);
    expect(VANILLA_MUSIC_RESUME_IS_IDEMPOTENT).toBe(true);
  });

  test('play transitions stopped -> playing', () => {
    expect(applyVanillaMusicCommand('stopped', 'play')).toBe('playing');
  });

  test('play is a no-op on already-playing handle', () => {
    expect(applyVanillaMusicCommand('playing', 'play')).toBe('playing');
  });

  test('pause transitions playing -> paused', () => {
    expect(applyVanillaMusicCommand('playing', 'pause')).toBe('paused');
  });

  test('pause is a no-op on already-paused handle', () => {
    expect(applyVanillaMusicCommand('paused', 'pause')).toBe('paused');
  });

  test('pause is a no-op on stopped handle (no song to pause)', () => {
    expect(applyVanillaMusicCommand('stopped', 'pause')).toBe('stopped');
  });

  test('resume transitions paused -> playing', () => {
    expect(applyVanillaMusicCommand('paused', 'resume')).toBe('playing');
  });

  test('resume is a no-op on already-playing handle', () => {
    expect(applyVanillaMusicCommand('playing', 'resume')).toBe('playing');
  });

  test('stop from any state returns to stopped', () => {
    expect(applyVanillaMusicCommand('playing', 'stop')).toBe('stopped');
    expect(applyVanillaMusicCommand('paused', 'stop')).toBe('stopped');
    expect(applyVanillaMusicCommand('stopped', 'stop')).toBe('stopped');
  });
});
