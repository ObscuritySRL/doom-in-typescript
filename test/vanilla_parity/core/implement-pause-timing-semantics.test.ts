import { describe, expect, test } from 'bun:test';

import {
  VANILLA_PAUSE_ALLOWS_SAVE_LOAD,
  VANILLA_PAUSE_BLOCKS_AUTOMAP_REDRAW,
  VANILLA_PAUSE_BLOCKS_THINKERS,
  VANILLA_PAUSE_MUTES_MUSIC,
  VANILLA_PAUSE_MUTES_SFX,
  VANILLA_PAUSE_SCANCODE,
  decidePauseToggle,
  evaluatePausedTic,
} from '../../../src/core/implement-pause-timing-semantics.ts';

describe('vanilla pause timing contract', () => {
  test('pause scancode is 69 (chocolate-doom.cfg key_pause)', () => {
    expect(VANILLA_PAUSE_SCANCODE).toBe(69);
  });

  test('pause mutes sfx and music, blocks thinkers, allows save/load, does not block automap redraw', () => {
    expect(VANILLA_PAUSE_MUTES_SFX).toBe(true);
    expect(VANILLA_PAUSE_MUTES_MUSIC).toBe(true);
    expect(VANILLA_PAUSE_BLOCKS_THINKERS).toBe(true);
    expect(VANILLA_PAUSE_ALLOWS_SAVE_LOAD).toBe(true);
    expect(VANILLA_PAUSE_BLOCKS_AUTOMAP_REDRAW).toBe(false);
  });
});

describe('decidePauseToggle', () => {
  test('PAUSE key toggles from unpaused to paused', () => {
    expect(decidePauseToggle({ keyScanCode: 69, currentPaused: false })).toBe(true);
  });

  test('PAUSE key toggles from paused to unpaused', () => {
    expect(decidePauseToggle({ keyScanCode: 69, currentPaused: true })).toBe(false);
  });

  test('non-PAUSE keys do not change pause state', () => {
    expect(decidePauseToggle({ keyScanCode: 28, currentPaused: false })).toBe(false);
    expect(decidePauseToggle({ keyScanCode: 28, currentPaused: true })).toBe(true);
  });
});

describe('evaluatePausedTic', () => {
  test('paused tic blocks thinkers and sound; allows automap animation', () => {
    const decision = evaluatePausedTic({ paused: true });
    expect(decision.runsThinkers).toBe(false);
    expect(decision.playsSound).toBe(false);
    expect(decision.runsAutomapAnimation).toBe(true);
  });

  test('unpaused tic runs everything', () => {
    const decision = evaluatePausedTic({ paused: false });
    expect(decision.runsThinkers).toBe(true);
    expect(decision.playsSound).toBe(true);
    expect(decision.runsAutomapAnimation).toBe(true);
  });
});
