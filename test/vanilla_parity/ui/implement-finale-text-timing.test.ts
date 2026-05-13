import { describe, expect, test } from 'bun:test';

import {
  VANILLA_FINALE_TEXT_LEAD_IN_TICS,
  VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR,
  VANILLA_FINALE_TEXT_WAIT_TICS,
  computeVanillaFinaleTextStageDurationTics,
  computeVanillaFinaleVisibleCharCount,
  vanillaFinaleTextStageShouldAdvance,
} from '../../../src/ui/implement-finale-text-timing.ts';

describe('finale text timing constants', () => {
  test('TEXTSPEED is 3 tics per char', () => {
    expect(VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR).toBe(3);
  });

  test('TEXTWAIT is 250 tics', () => {
    expect(VANILLA_FINALE_TEXT_WAIT_TICS).toBe(250);
  });

  test('lead-in delay is 10 tics', () => {
    expect(VANILLA_FINALE_TEXT_LEAD_IN_TICS).toBe(10);
  });
});

describe('computeVanillaFinaleVisibleCharCount', () => {
  test('returns 0 during the lead-in (finalecount < 10)', () => {
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 0, textLength: 100 })).toBe(0);
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 9, textLength: 100 })).toBe(0);
  });

  test('returns 0 right at the lead-in boundary (finalecount == 10)', () => {
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 10, textLength: 100 })).toBe(0);
  });

  test('returns 1 char after one TEXTSPEED tic past lead-in (finalecount == 13)', () => {
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 13, textLength: 100 })).toBe(1);
  });

  test('clamps to textLength when fully drawn', () => {
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 1000, textLength: 50 })).toBe(50);
  });

  test('truncates fractional char counts', () => {
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 12, textLength: 100 })).toBe(0);
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 16, textLength: 100 })).toBe(2);
  });
});

describe('computeVanillaFinaleTextStageDurationTics', () => {
  test('100-char text takes 10 + 300 + 250 = 560 tics', () => {
    expect(computeVanillaFinaleTextStageDurationTics({ textLength: 100 })).toBe(560);
  });

  test('empty text still has lead-in + wait = 260 tics', () => {
    expect(computeVanillaFinaleTextStageDurationTics({ textLength: 0 })).toBe(260);
  });

  test('1-char text: 10 + 3 + 250 = 263 tics', () => {
    expect(computeVanillaFinaleTextStageDurationTics({ textLength: 1 })).toBe(263);
  });
});

describe('vanillaFinaleTextStageShouldAdvance', () => {
  test('false when still in text + wait window', () => {
    expect(vanillaFinaleTextStageShouldAdvance({ finalecount: 0, textLength: 100 })).toBe(false);
    expect(vanillaFinaleTextStageShouldAdvance({ finalecount: 550, textLength: 100 })).toBe(false);
  });

  test('true when finalecount > textLength*3 + 250', () => {
    // 100 chars: threshold = 100*3 + 250 = 550, advance fires at 551+
    expect(vanillaFinaleTextStageShouldAdvance({ finalecount: 551, textLength: 100 })).toBe(true);
  });

  test('uses strict greater-than (== threshold does NOT fire)', () => {
    expect(vanillaFinaleTextStageShouldAdvance({ finalecount: 550, textLength: 100 })).toBe(false);
  });
});
