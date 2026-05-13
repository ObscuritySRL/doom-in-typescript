import { describe, expect, test } from 'bun:test';

import { VANILLA_HUD_MESSAGE_INITIAL_STATE, VANILLA_HU_MSGTIMEOUT_TICS, VANILLA_HU_MSGX, VANILLA_HU_MSGY, tickVanillaHudMessageQueue } from '../../../src/ui/implement-hud-message-queue.ts';

describe('HUD message constants', () => {
  test('HU_MSGTIMEOUT is 140 tics (4*TICRATE)', () => {
    expect(VANILLA_HU_MSGTIMEOUT_TICS).toBe(140);
  });

  test('HU_MSGX and HU_MSGY are 0 (top-left)', () => {
    expect(VANILLA_HU_MSGX).toBe(0);
    expect(VANILLA_HU_MSGY).toBe(0);
  });

  test('initial state has zero counter, off, unlocked', () => {
    expect(VANILLA_HUD_MESSAGE_INITIAL_STATE.messageCounter).toBe(0);
    expect(VANILLA_HUD_MESSAGE_INITIAL_STATE.messageOn).toBe(false);
    expect(VANILLA_HUD_MESSAGE_INITIAL_STATE.messageNotToBeReplaced).toBe(false);
  });
});

describe('tickVanillaHudMessageQueue — no pending message', () => {
  test('decrements counter when positive', () => {
    const result = tickVanillaHudMessageQueue({
      state: { messageCounter: 5, messageOn: true, messageNotToBeReplaced: false },
      pendingMessage: null,
      showMessagesPref: true,
      messageIsCritical: false,
    });
    expect(result.state.messageCounter).toBe(4);
    expect(result.state.messageOn).toBe(true);
  });

  test('clears messageOn and lock when counter reaches 0', () => {
    const result = tickVanillaHudMessageQueue({
      state: { messageCounter: 1, messageOn: true, messageNotToBeReplaced: true },
      pendingMessage: null,
      showMessagesPref: true,
      messageIsCritical: false,
    });
    expect(result.state.messageCounter).toBe(0);
    expect(result.state.messageOn).toBe(false);
    expect(result.state.messageNotToBeReplaced).toBe(false);
  });
});

describe('tickVanillaHudMessageQueue — new message accepted', () => {
  test('non-critical message accepted when messages are on and no lock', () => {
    const result = tickVanillaHudMessageQueue({
      state: VANILLA_HUD_MESSAGE_INITIAL_STATE,
      pendingMessage: 'You got the rocket launcher!',
      showMessagesPref: true,
      messageIsCritical: false,
    });
    expect(result.displayedMessage).toBe('You got the rocket launcher!');
    expect(result.state.messageCounter).toBe(140);
    expect(result.state.messageOn).toBe(true);
    expect(result.state.messageNotToBeReplaced).toBe(false);
    expect(result.consumedPending).toBe(true);
  });

  test('critical message accepted even when showMessages is off', () => {
    const result = tickVanillaHudMessageQueue({
      state: VANILLA_HUD_MESSAGE_INITIAL_STATE,
      pendingMessage: 'You got the BLUE keycard!',
      showMessagesPref: false,
      messageIsCritical: true,
    });
    expect(result.displayedMessage).toBe('You got the BLUE keycard!');
    expect(result.state.messageNotToBeReplaced).toBe(true);
  });

  test('non-critical message dropped when showMessages is off', () => {
    const result = tickVanillaHudMessageQueue({
      state: VANILLA_HUD_MESSAGE_INITIAL_STATE,
      pendingMessage: 'Picked up a stimpack.',
      showMessagesPref: false,
      messageIsCritical: false,
    });
    expect(result.displayedMessage).toBeNull();
    expect(result.consumedPending).toBe(false);
  });
});

describe('tickVanillaHudMessageQueue — locked critical message', () => {
  test('non-critical message cannot replace locked critical message', () => {
    const lockedState = { messageCounter: 50, messageOn: true, messageNotToBeReplaced: true };
    const result = tickVanillaHudMessageQueue({
      state: lockedState,
      pendingMessage: 'Picked up a stimpack.',
      showMessagesPref: true,
      messageIsCritical: false,
    });
    expect(result.displayedMessage).toBeNull();
    expect(result.consumedPending).toBe(false);
  });

  test('critical message DOES replace locked critical message', () => {
    const lockedState = { messageCounter: 50, messageOn: true, messageNotToBeReplaced: true };
    const result = tickVanillaHudMessageQueue({
      state: lockedState,
      pendingMessage: 'You got the RED keycard!',
      showMessagesPref: true,
      messageIsCritical: true,
    });
    expect(result.displayedMessage).toBe('You got the RED keycard!');
    expect(result.state.messageCounter).toBe(140);
  });
});

describe('tickVanillaHudMessageQueue — frozen results', () => {
  test('state and result are frozen', () => {
    const result = tickVanillaHudMessageQueue({
      state: VANILLA_HUD_MESSAGE_INITIAL_STATE,
      pendingMessage: 'test',
      showMessagesPref: true,
      messageIsCritical: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.state)).toBe(true);
  });
});
