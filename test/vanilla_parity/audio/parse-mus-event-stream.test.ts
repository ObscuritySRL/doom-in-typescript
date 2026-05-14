import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MUS_DESCRIPTOR_CHANNEL_MASK,
  VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_MASK,
  VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_SHIFT,
  VANILLA_MUS_DESCRIPTOR_LAST_EVENT_FLAG_MASK,
  VANILLA_MUS_EVENT_SPECS,
  VANILLA_MUS_GAMEPLAY_RATE_HZ,
  VANILLA_MUS_NOTE_VALUE_MASK,
  VANILLA_MUS_PERCUSSION_CHANNEL,
  VANILLA_MUS_PLAY_NOTE_VELOCITY_FLAG_MASK,
  VANILLA_MUS_QUICKTICK_RATE_HZ,
  VANILLA_MUS_VLQ_CONTINUATION_FLAG_MASK,
  VANILLA_MUS_VLQ_DATA_MASK,
  decodeVanillaMusDescriptor,
} from '../../../src/audio/parse-mus-event-stream.ts';

describe('vanilla MUS grammar constants', () => {
  test('descriptor byte: bit 7 = last event flag, bits 4..6 = event type, bits 0..3 = channel', () => {
    expect(VANILLA_MUS_DESCRIPTOR_LAST_EVENT_FLAG_MASK).toBe(0x80);
    expect(VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_SHIFT).toBe(4);
    expect(VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_MASK).toBe(0x07);
    expect(VANILLA_MUS_DESCRIPTOR_CHANNEL_MASK).toBe(0x0f);
  });

  test('percussion channel = 15; quicktick rate = 140 Hz; gameplay rate = 35 Hz (music runs 4x gameplay)', () => {
    expect(VANILLA_MUS_PERCUSSION_CHANNEL).toBe(15);
    expect(VANILLA_MUS_QUICKTICK_RATE_HZ).toBe(140);
    expect(VANILLA_MUS_GAMEPLAY_RATE_HZ).toBe(35);
    expect(VANILLA_MUS_QUICKTICK_RATE_HZ / VANILLA_MUS_GAMEPLAY_RATE_HZ).toBe(4);
  });

  test('play-note velocity flag mask = 0x80; note value mask = 0x7f', () => {
    expect(VANILLA_MUS_PLAY_NOTE_VELOCITY_FLAG_MASK).toBe(0x80);
    expect(VANILLA_MUS_NOTE_VALUE_MASK).toBe(0x7f);
  });

  test('VLQ continuation bit = 0x80, data mask = 0x7f', () => {
    expect(VANILLA_MUS_VLQ_CONTINUATION_FLAG_MASK).toBe(0x80);
    expect(VANILLA_MUS_VLQ_DATA_MASK).toBe(0x7f);
  });
});

describe('VANILLA_MUS_EVENT_SPECS table', () => {
  test('event 0 release note: 1 body byte, valid', () => {
    expect(VANILLA_MUS_EVENT_SPECS[0].name).toBe('ReleaseNote');
    expect(VANILLA_MUS_EVENT_SPECS[0].bodyByteCount).toBe(1);
    expect(VANILLA_MUS_EVENT_SPECS[0].valid).toBe(true);
  });

  test('event 1 play note: 1 or 2 body bytes (optional velocity), valid', () => {
    expect(VANILLA_MUS_EVENT_SPECS[1].name).toBe('PlayNote');
    expect(VANILLA_MUS_EVENT_SPECS[1].bodyByteCount).toBe('variable-1-or-2');
    expect(VANILLA_MUS_EVENT_SPECS[1].valid).toBe(true);
  });

  test('event 4 controller change: exactly 2 body bytes, valid', () => {
    expect(VANILLA_MUS_EVENT_SPECS[4].name).toBe('ControllerChange');
    expect(VANILLA_MUS_EVENT_SPECS[4].bodyByteCount).toBe(2);
    expect(VANILLA_MUS_EVENT_SPECS[4].valid).toBe(true);
  });

  test('event 6 score end: 0 body bytes, valid (terminator)', () => {
    expect(VANILLA_MUS_EVENT_SPECS[6].name).toBe('ScoreEnd');
    expect(VANILLA_MUS_EVENT_SPECS[6].bodyByteCount).toBe(0);
    expect(VANILLA_MUS_EVENT_SPECS[6].valid).toBe(true);
  });

  test('events 5 and 7 are reserved and rejected as invalid', () => {
    expect(VANILLA_MUS_EVENT_SPECS[5].valid).toBe(false);
    expect(VANILLA_MUS_EVENT_SPECS[7].valid).toBe(false);
  });
});

describe('decodeVanillaMusDescriptor', () => {
  test('release-note channel 0 without trailing delay (0x00)', () => {
    expect(decodeVanillaMusDescriptor(0x00)).toEqual({ lastEventInGroup: false, eventType: 0, channel: 0 });
  });

  test('play-note percussion channel 15 with trailing delay (0x9f = 0b 1_001_1111)', () => {
    expect(decodeVanillaMusDescriptor(0x9f)).toEqual({ lastEventInGroup: true, eventType: 1, channel: 15 });
  });

  test('controller-change channel 7 without trailing delay (0x47 = 0b 0_100_0111)', () => {
    expect(decodeVanillaMusDescriptor(0x47)).toEqual({ lastEventInGroup: false, eventType: 4, channel: 7 });
  });

  test('score-end channel 0 (0x60 = 0b 0_110_0000)', () => {
    expect(decodeVanillaMusDescriptor(0x60)).toEqual({ lastEventInGroup: false, eventType: 6, channel: 0 });
  });

  test('reserved event 7 still decodes as channel + type pair (validation happens elsewhere)', () => {
    expect(decodeVanillaMusDescriptor(0x70)).toEqual({ lastEventInGroup: false, eventType: 7, channel: 0 });
  });
});
