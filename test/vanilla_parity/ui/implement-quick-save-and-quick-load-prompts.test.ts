import { describe, expect, test } from 'bun:test';

import {
  VANILLA_QLOADNET_KEY,
  VANILLA_QLPROMPT_KEY,
  VANILLA_QSAVESPOT_KEY,
  VANILLA_QSPROMPT_KEY,
  VANILLA_QUICKSAVE_SENTINEL_NO_SLOT,
  VANILLA_QUICKSAVE_SENTINEL_PICK_SLOT,
  resolveVanillaQuickLoadAction,
  resolveVanillaQuickSaveAction,
} from '../../../src/ui/implement-quick-save-and-quick-load-prompts.ts';

describe('resolveVanillaQuickSaveAction', () => {
  test('not in user game plays sfx_oof', () => {
    expect(resolveVanillaQuickSaveAction({ usergame: false, gamestate: 'GS_LEVEL', quickSaveSlot: 0 })).toBe('play-oof-sound');
  });

  test('not at GS_LEVEL is ignored', () => {
    expect(resolveVanillaQuickSaveAction({ usergame: true, gamestate: 'GS_INTERMISSION', quickSaveSlot: 0 })).toBe('ignored');
    expect(resolveVanillaQuickSaveAction({ usergame: true, gamestate: 'GS_FINALE', quickSaveSlot: 0 })).toBe('ignored');
  });

  test('no quick save slot picked yet opens save menu in pick-slot mode', () => {
    expect(resolveVanillaQuickSaveAction({ usergame: true, gamestate: 'GS_LEVEL', quickSaveSlot: -1 })).toBe('pick-slot');
  });

  test('with a quick save slot picked, shows confirm prompt', () => {
    expect(resolveVanillaQuickSaveAction({ usergame: true, gamestate: 'GS_LEVEL', quickSaveSlot: 3 })).toBe('confirm-prompt');
  });
});

describe('resolveVanillaQuickLoadAction', () => {
  test('netgame shows QLOADNET warning', () => {
    expect(resolveVanillaQuickLoadAction({ isNetgame: true, quickSaveSlot: 0 })).toBe('qloadnet-warning');
    expect(resolveVanillaQuickLoadAction({ isNetgame: true, quickSaveSlot: -1 })).toBe('qloadnet-warning');
  });

  test('no quick save slot picked yet shows QSAVESPOT warning', () => {
    expect(resolveVanillaQuickLoadAction({ isNetgame: false, quickSaveSlot: -1 })).toBe('qsavespot-warning');
  });

  test('valid slot shows confirm prompt', () => {
    expect(resolveVanillaQuickLoadAction({ isNetgame: false, quickSaveSlot: 4 })).toBe('confirm-prompt');
  });
});

describe('DeHackEd message keys', () => {
  test('QSPROMPT, QLPROMPT, QLOADNET, QSAVESPOT', () => {
    expect(VANILLA_QSPROMPT_KEY).toBe('QSPROMPT');
    expect(VANILLA_QLPROMPT_KEY).toBe('QLPROMPT');
    expect(VANILLA_QLOADNET_KEY).toBe('QLOADNET');
    expect(VANILLA_QSAVESPOT_KEY).toBe('QSAVESPOT');
  });
});

describe('quickSaveSlot sentinels', () => {
  test('-1 means no slot picked', () => {
    expect(VANILLA_QUICKSAVE_SENTINEL_NO_SLOT).toBe(-1);
  });

  test('-2 means "next slot picked becomes quick save"', () => {
    expect(VANILLA_QUICKSAVE_SENTINEL_PICK_SLOT).toBe(-2);
  });
});
