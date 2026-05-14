import { describe, expect, test } from 'bun:test';

import {
  MUS_EVENT_CONTROLLER,
  MUS_EVENT_PITCH,
  MUS_EVENT_PLAY,
  MUS_EVENT_RELEASE,
  MUS_EVENT_SCORE_END,
  MUS_EVENT_SYSTEM,
  VANILLA_MUSIC_EVENT_LOG_BYTES_PER_EVENT,
  VANILLA_MUSIC_EVENT_LOG_HASH_HEX_LENGTH,
  VANILLA_MUSIC_EVENT_LOG_WINDOW_EVENTS,
} from '../../../src/audio/compare-music-event-oracle-windows.ts';

describe('vanilla music event log constants', () => {
  test('8 bytes per event, 1024 events per window, SHA-256 64-hex hash', () => {
    expect(VANILLA_MUSIC_EVENT_LOG_BYTES_PER_EVENT).toBe(8);
    expect(VANILLA_MUSIC_EVENT_LOG_WINDOW_EVENTS).toBe(1024);
    expect(VANILLA_MUSIC_EVENT_LOG_HASH_HEX_LENGTH).toBe(64);
  });

  test('MUS event type enum: release=0, play=1, pitch=2, system=3, controller=4, end=6', () => {
    expect(MUS_EVENT_RELEASE).toBe(0);
    expect(MUS_EVENT_PLAY).toBe(1);
    expect(MUS_EVENT_PITCH).toBe(2);
    expect(MUS_EVENT_SYSTEM).toBe(3);
    expect(MUS_EVENT_CONTROLLER).toBe(4);
    expect(MUS_EVENT_SCORE_END).toBe(6);
  });
});
