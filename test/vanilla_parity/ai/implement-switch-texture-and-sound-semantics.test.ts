import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BUTTONTIME_TICS,
  VANILLA_SFX_SWTCHN,
  VANILLA_SFX_SWTCHX,
  VANILLA_SWITCH_NAME_PREFIX_OFF,
  VANILLA_SWITCH_NAME_PREFIX_ON,
  classifyVanillaSwitchActivation,
} from '../../../src/ai/implement-switch-texture-and-sound-semantics.ts';

describe('vanilla switch sound and timing constants', () => {
  test('SFX_SWTCHN (press) is 60 and SFX_SWTCHX (revert) is 61', () => {
    expect(VANILLA_SFX_SWTCHN).toBe(60);
    expect(VANILLA_SFX_SWTCHX).toBe(61);
  });

  test('BUTTONTIME is 35 tics (1 second at TICRATE)', () => {
    expect(VANILLA_BUTTONTIME_TICS).toBe(35);
  });

  test('switch texture prefix off=SW1, on=SW2', () => {
    expect(VANILLA_SWITCH_NAME_PREFIX_OFF).toBe('SW1');
    expect(VANILLA_SWITCH_NAME_PREFIX_ON).toBe('SW2');
  });
});

describe('classifyVanillaSwitchActivation', () => {
  test('off->on, repeatable: returns on texture, press sound, revert timer + sound', () => {
    const result = classifyVanillaSwitchActivation({
      currentTextureIndex: 100,
      switchPairs: [[100, 101]],
      isRepeatable: true,
    });
    expect(result.newTextureIndex).toBe(101);
    expect(result.soundOnPress).toBe(VANILLA_SFX_SWTCHN);
    expect(result.resetSoundOnRevert).toBe(VANILLA_SFX_SWTCHX);
    expect(result.resetAfterTics).toBe(VANILLA_BUTTONTIME_TICS);
  });

  test('off->on, once-only: returns on texture, press sound, no revert', () => {
    const result = classifyVanillaSwitchActivation({
      currentTextureIndex: 100,
      switchPairs: [[100, 101]],
      isRepeatable: false,
    });
    expect(result.newTextureIndex).toBe(101);
    expect(result.soundOnPress).toBe(VANILLA_SFX_SWTCHN);
    expect(result.resetSoundOnRevert).toBeNull();
    expect(result.resetAfterTics).toBeNull();
  });

  test('on->off swap also returns press sound (revert path)', () => {
    const result = classifyVanillaSwitchActivation({
      currentTextureIndex: 101,
      switchPairs: [[100, 101]],
      isRepeatable: true,
    });
    expect(result.newTextureIndex).toBe(100);
  });

  test('texture not in switchlist: no-op, no sound', () => {
    const result = classifyVanillaSwitchActivation({
      currentTextureIndex: 999,
      switchPairs: [[100, 101]],
      isRepeatable: true,
    });
    expect(result.newTextureIndex).toBe(999);
    expect(result.soundOnPress).toBe(0);
  });
});
