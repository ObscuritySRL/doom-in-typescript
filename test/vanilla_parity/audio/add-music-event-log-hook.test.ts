import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MUSIC_EVENT_LOG_CHANNEL_COUNT,
  VANILLA_MUSIC_EVENT_LOG_PERCUSSION_CHANNEL,
  VANILLA_MUSIC_EVENT_LOG_QUICKTICKS_PER_GAMETIC,
  vanillaMusicEventLogEntryIsValid,
  vanillaMusicEventLogsEqual,
} from '../../../src/audio/add-music-event-log-hook.ts';

describe('music event log hook pin', () => {
  test('quickticks per gametic is 4 (140 Hz music / 35 Hz gameplay)', () => {
    expect(VANILLA_MUSIC_EVENT_LOG_QUICKTICKS_PER_GAMETIC).toBe(4);
  });

  test('channel count is 16 with percussion at channel 15', () => {
    expect(VANILLA_MUSIC_EVENT_LOG_CHANNEL_COUNT).toBe(16);
    expect(VANILLA_MUSIC_EVENT_LOG_PERCUSSION_CHANNEL).toBe(15);
  });

  test('empty logs compare equal', () => {
    expect(vanillaMusicEventLogsEqual({ entries: [] }, { entries: [] })).toBe(true);
  });

  test('byte-identical entries compare equal', () => {
    const left = { entries: [{ gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 1, body: new Uint8Array([60, 100]) }] };
    const right = { entries: [{ gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 1, body: new Uint8Array([60, 100]) }] };
    expect(vanillaMusicEventLogsEqual(left, right)).toBe(true);
  });

  test('differing body byte breaks equality', () => {
    const left = { entries: [{ gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 1, body: new Uint8Array([60, 100]) }] };
    const right = { entries: [{ gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 1, body: new Uint8Array([60, 101]) }] };
    expect(vanillaMusicEventLogsEqual(left, right)).toBe(false);
  });

  test('different length logs are unequal', () => {
    const left = { entries: [{ gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 6, body: new Uint8Array(0) }] };
    const right = { entries: [] };
    expect(vanillaMusicEventLogsEqual(left, right)).toBe(false);
  });

  test('differing event order breaks equality (apply-order not captured-order)', () => {
    const a = { gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 4, body: new Uint8Array([0, 127]) };
    const b = { gameTic: 1, quicktickWithinTic: 0, channel: 0, eventType: 1, body: new Uint8Array([60]) };
    expect(vanillaMusicEventLogsEqual({ entries: [a, b] }, { entries: [b, a] })).toBe(false);
  });

  test('validator rejects negative gameTic', () => {
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: -1, quicktickWithinTic: 0, channel: 0, eventType: 0, body: new Uint8Array(0) })).toBe(false);
  });

  test('validator rejects quicktickWithinTic outside 0..3', () => {
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: 0, quicktickWithinTic: 4, channel: 0, eventType: 0, body: new Uint8Array(0) })).toBe(false);
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: 0, quicktickWithinTic: 3, channel: 0, eventType: 0, body: new Uint8Array(0) })).toBe(true);
  });

  test('validator rejects channel outside 0..15', () => {
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: 0, quicktickWithinTic: 0, channel: 16, eventType: 0, body: new Uint8Array(0) })).toBe(false);
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: 0, quicktickWithinTic: 0, channel: 15, eventType: 0, body: new Uint8Array(0) })).toBe(true);
  });

  test('validator rejects eventType outside 0..7', () => {
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: 0, quicktickWithinTic: 0, channel: 0, eventType: 8, body: new Uint8Array(0) })).toBe(false);
    expect(vanillaMusicEventLogEntryIsValid({ gameTic: 0, quicktickWithinTic: 0, channel: 0, eventType: 7, body: new Uint8Array(0) })).toBe(true);
  });
});
