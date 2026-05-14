/**
 * Vanilla DOOM 1.9 MUS event-stream grammar pin.
 *
 * From Chocolate Doom 2.2.1 mus2mid.c event loop and DMX MUS format:
 *
 *   Each event begins with a single descriptor byte:
 *     bit 7    : last-event-of-group flag (delay follows if set)
 *     bits 4-6 : event-type code 0..7
 *     bits 0-3 : channel number 0..15 (channel 15 is percussion)
 *
 *   Event-type bodies:
 *     0 ReleaseNote      — 1 body byte: note 0..127
 *     1 PlayNote         — 1 or 2 body bytes: note bits 0..6; if note bit 7
 *                          set, second byte is velocity 0..127
 *     2 PitchBend        — 1 body byte: 0..255 (128 = no bend)
 *     3 SystemEvent      — 1 body byte: controller index 10..14
 *     4 ControllerChange — 2 body bytes: controller 0..9, value 0..127
 *     5 (reserved)       — invalid, parse error
 *     6 ScoreEnd         — 0 body bytes, terminates the score
 *     7 (reserved)       — invalid, parse error
 *
 *   Inter-event delays use MIDI variable-length quantity (VLQ) encoding:
 *     delay = (delay << 7) | (byte & 0x7F), continue while bit 7 set.
 *   The delay reported on each event is the gap BEFORE the next event;
 *   summing all delays yields total score quickticks.
 *
 *   Quicktick rate: 140 Hz (MUS native), distinct from DOOM's 35 Hz game
 *   tick.  Music plays at exactly 4x the gameplay rate.
 */

export const VANILLA_MUS_QUICKTICK_RATE_HZ = 140;

export const VANILLA_MUS_GAMEPLAY_RATE_HZ = 35;

export const VANILLA_MUS_PERCUSSION_CHANNEL = 15;

export const VANILLA_MUS_DESCRIPTOR_LAST_EVENT_FLAG_MASK = 0x80;
export const VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_SHIFT = 4;
export const VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_MASK = 0x07;
export const VANILLA_MUS_DESCRIPTOR_CHANNEL_MASK = 0x0f;

export const VANILLA_MUS_PLAY_NOTE_VELOCITY_FLAG_MASK = 0x80;
export const VANILLA_MUS_NOTE_VALUE_MASK = 0x7f;
export const VANILLA_MUS_VLQ_CONTINUATION_FLAG_MASK = 0x80;
export const VANILLA_MUS_VLQ_DATA_MASK = 0x7f;

export type VanillaMusEventCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface VanillaMusEventSpec {
  readonly name: 'ReleaseNote' | 'PlayNote' | 'PitchBend' | 'SystemEvent' | 'ControllerChange' | 'Reserved5' | 'ScoreEnd' | 'Reserved7';
  readonly bodyByteCount: number | 'variable-1-or-2';
  readonly valid: boolean;
}

export const VANILLA_MUS_EVENT_SPECS: Readonly<Record<VanillaMusEventCode, VanillaMusEventSpec>> = Object.freeze({
  0: Object.freeze({ name: 'ReleaseNote', bodyByteCount: 1, valid: true }),
  1: Object.freeze({ name: 'PlayNote', bodyByteCount: 'variable-1-or-2', valid: true }),
  2: Object.freeze({ name: 'PitchBend', bodyByteCount: 1, valid: true }),
  3: Object.freeze({ name: 'SystemEvent', bodyByteCount: 1, valid: true }),
  4: Object.freeze({ name: 'ControllerChange', bodyByteCount: 2, valid: true }),
  5: Object.freeze({ name: 'Reserved5', bodyByteCount: 0, valid: false }),
  6: Object.freeze({ name: 'ScoreEnd', bodyByteCount: 0, valid: true }),
  7: Object.freeze({ name: 'Reserved7', bodyByteCount: 0, valid: false }),
});

export function decodeVanillaMusDescriptor(descriptorByte: number): { readonly lastEventInGroup: boolean; readonly eventType: VanillaMusEventCode; readonly channel: number } {
  const lastEventInGroup = (descriptorByte & VANILLA_MUS_DESCRIPTOR_LAST_EVENT_FLAG_MASK) !== 0;
  const eventType = ((descriptorByte >> VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_SHIFT) & VANILLA_MUS_DESCRIPTOR_EVENT_TYPE_MASK) as VanillaMusEventCode;
  const channel = descriptorByte & VANILLA_MUS_DESCRIPTOR_CHANNEL_MASK;
  return Object.freeze({ lastEventInGroup, eventType, channel });
}
