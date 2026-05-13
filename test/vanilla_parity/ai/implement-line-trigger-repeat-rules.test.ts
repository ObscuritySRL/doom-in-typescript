import { describe, expect, test } from 'bun:test';

import {
  VANILLA_LINE_TRIGGER_KEY_BLUE_CARD,
  VANILLA_LINE_TRIGGER_KEY_BLUE_SKULL,
  VANILLA_LINE_TRIGGER_KEY_RED_CARD,
  VANILLA_LINE_TRIGGER_KEY_RED_SKULL,
  VANILLA_LINE_TRIGGER_KEY_YELLOW_CARD,
  VANILLA_LINE_TRIGGER_KEY_YELLOW_SKULL,
  classifyLineTriggerType,
  shouldClearLineSpecialAfterFire,
} from '../../../src/ai/implement-line-trigger-repeat-rules.ts';

describe('vanilla key door line specials', () => {
  test('keycards: blue=26, yellow=27, red=28', () => {
    expect(VANILLA_LINE_TRIGGER_KEY_BLUE_CARD).toBe(26);
    expect(VANILLA_LINE_TRIGGER_KEY_YELLOW_CARD).toBe(27);
    expect(VANILLA_LINE_TRIGGER_KEY_RED_CARD).toBe(28);
  });

  test('skull keys: blue=32, red=33, yellow=34', () => {
    expect(VANILLA_LINE_TRIGGER_KEY_BLUE_SKULL).toBe(32);
    expect(VANILLA_LINE_TRIGGER_KEY_RED_SKULL).toBe(33);
    expect(VANILLA_LINE_TRIGGER_KEY_YELLOW_SKULL).toBe(34);
  });
});

describe('classifyLineTriggerType', () => {
  test('produces frozen records of group+repeat', () => {
    const t = classifyLineTriggerType('walk', 'repeat');
    expect(t.group).toBe('walk');
    expect(t.repeat).toBe('repeat');
    expect(Object.isFrozen(t)).toBe(true);
  });
});

describe('shouldClearLineSpecialAfterFire', () => {
  test('once-only walk and gun lines clear their special', () => {
    expect(shouldClearLineSpecialAfterFire('walk', 'once')).toBe(true);
    expect(shouldClearLineSpecialAfterFire('gun', 'once')).toBe(true);
  });

  test('switches do NOT clear (texture flip is the visible state change)', () => {
    expect(shouldClearLineSpecialAfterFire('switch', 'once')).toBe(false);
  });

  test('any repeat trigger leaves the special intact', () => {
    expect(shouldClearLineSpecialAfterFire('walk', 'repeat')).toBe(false);
    expect(shouldClearLineSpecialAfterFire('switch', 'repeat')).toBe(false);
    expect(shouldClearLineSpecialAfterFire('gun', 'repeat')).toBe(false);
  });
});
