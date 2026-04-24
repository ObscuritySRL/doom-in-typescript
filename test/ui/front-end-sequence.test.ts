import { describe, expect, it } from 'bun:test';

import type { GameMode } from '../../src/bootstrap/gameMode.ts';
import {
  COMMERCIAL_TITLEPIC_PAGETIC,
  CYCLE_LENGTH,
  FRONTEND_KEY_ADVANCE_DEMO,
  FRONTEND_KEY_HELP,
  FRONTEND_KEY_MENU,
  FRONTEND_KEY_NONE,
  FRONTEND_KEY_OPEN_MENU,
  FRONTEND_TICK_IDLE,
  INTERLUDE_PAGETIC,
  TITLEPIC_PAGETIC,
  TitleLoop,
  createFrontEndSequence,
  getInitialHelpLump,
  handleFrontEndKey,
  notifyDemoCompleted,
  setMenuActive,
  tickFrontEnd,
} from '../../src/ui/frontEndSequence.ts';
import type { FrontEndKeyAction, FrontEndSequenceState, FrontEndTickAction, OpenHelpKeyAction, PlayDemoTickAction, ShowPageTickAction } from '../../src/ui/frontEndSequence.ts';
import { KEY_ESCAPE, KEY_F1 } from '../../src/input/keyboard.ts';
import sequence from '../../reference/manifests/title-sequence.json';

function runFullCycle(state: FrontEndSequenceState): FrontEndTickAction[] {
  const emitted: FrontEndTickAction[] = [];
  while (emitted.length < CYCLE_LENGTH) {
    const action = tickFrontEnd(state);
    if (action.kind === 'showPage') {
      emitted.push(action);
      continue;
    }
    if (action.kind === 'playDemo') {
      emitted.push(action);
      notifyDemoCompleted(state);
      continue;
    }
  }
  return emitted;
}

describe('key binding constants', () => {
  it('FRONTEND_KEY_MENU is KEY_ESCAPE (m_menu.c key_menu_activate)', () => {
    expect(FRONTEND_KEY_MENU).toBe(KEY_ESCAPE);
    expect(FRONTEND_KEY_MENU).toBe(27);
  });

  it('FRONTEND_KEY_HELP is KEY_F1 (m_menu.c key_menu_help)', () => {
    expect(FRONTEND_KEY_HELP).toBe(KEY_F1);
    expect(FRONTEND_KEY_HELP).toBe(0xbb);
  });
});

describe('singletons are frozen', () => {
  it('FRONTEND_TICK_IDLE is frozen', () => {
    expect(Object.isFrozen(FRONTEND_TICK_IDLE)).toBe(true);
    expect(FRONTEND_TICK_IDLE.kind).toBe('idle');
  });

  it('FRONTEND_KEY_NONE is frozen', () => {
    expect(Object.isFrozen(FRONTEND_KEY_NONE)).toBe(true);
    expect(FRONTEND_KEY_NONE.kind).toBe('none');
  });

  it('FRONTEND_KEY_OPEN_MENU is frozen', () => {
    expect(Object.isFrozen(FRONTEND_KEY_OPEN_MENU)).toBe(true);
    expect(FRONTEND_KEY_OPEN_MENU.kind).toBe('openMenu');
  });

  it('FRONTEND_KEY_ADVANCE_DEMO is frozen', () => {
    expect(Object.isFrozen(FRONTEND_KEY_ADVANCE_DEMO)).toBe(true);
    expect(FRONTEND_KEY_ADVANCE_DEMO.kind).toBe('advanceDemo');
  });
});

describe('getInitialHelpLump', () => {
  it('shareware shows HELP2 (ReadDef1 drawer)', () => {
    expect(getInitialHelpLump('shareware')).toBe('HELP2');
  });

  it('registered shows HELP2 (pre-Ultimate ReadDef1)', () => {
    expect(getInitialHelpLump('registered')).toBe('HELP2');
  });

  it('retail shows HELP1 (exe_ultimate ReadDef2)', () => {
    expect(getInitialHelpLump('retail')).toBe('HELP1');
  });

  it('commercial shows HELP (M_DrawReadThisCommercial)', () => {
    expect(getInitialHelpLump('commercial')).toBe('HELP');
  });

  it('indetermined shows HELP2 (falls through to shareware/registered path)', () => {
    expect(getInitialHelpLump('indetermined')).toBe('HELP2');
  });
});

describe('createFrontEndSequence', () => {
  it('seeds the underlying TitleLoop at demosequence=-1, advancedemo=true (D_StartTitle)', () => {
    const state = createFrontEndSequence('shareware');
    expect(state.titleLoop.demosequence).toBe(-1);
    expect(state.titleLoop.advancedemo).toBe(true);
  });

  it('wraps a TitleLoop instance', () => {
    const state = createFrontEndSequence('shareware');
    expect(state.titleLoop).toBeInstanceOf(TitleLoop);
    expect(state.titleLoop.gameMode).toBe('shareware');
  });

  it('starts with inDemoPlayback false', () => {
    const state = createFrontEndSequence('shareware');
    expect(state.inDemoPlayback).toBe(false);
  });

  it('starts with menuActive false', () => {
    const state = createFrontEndSequence('shareware');
    expect(state.menuActive).toBe(false);
  });

  it('supports all game modes', () => {
    const modes: GameMode[] = ['commercial', 'indetermined', 'registered', 'retail', 'shareware'];
    for (const mode of modes) {
      const state = createFrontEndSequence(mode);
      expect(state.titleLoop.gameMode).toBe(mode);
    }
  });
});

describe('tickFrontEnd: first tick consumes the pending advance', () => {
  it('emits showPage TITLEPIC for shareware', () => {
    const state = createFrontEndSequence('shareware');
    const action = tickFrontEnd(state) as ShowPageTickAction;
    expect(action.kind).toBe('showPage');
    expect(action.lumpName).toBe('TITLEPIC');
    expect(action.pagetic).toBe(TITLEPIC_PAGETIC);
    expect(action.musicLump).toBe('D_INTRO');
  });

  it('emits showPage TITLEPIC with D_DM2TTL for commercial', () => {
    const state = createFrontEndSequence('commercial');
    const action = tickFrontEnd(state) as ShowPageTickAction;
    expect(action.kind).toBe('showPage');
    expect(action.lumpName).toBe('TITLEPIC');
    expect(action.pagetic).toBe(COMMERCIAL_TITLEPIC_PAGETIC);
    expect(action.musicLump).toBe('D_DM2TTL');
  });

  it('advances demosequence from -1 to 0', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    expect(state.titleLoop.demosequence).toBe(0);
  });

  it('clears advancedemo on the underlying loop', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    expect(state.titleLoop.advancedemo).toBe(false);
  });

  it('sets inDemoPlayback to false for a page emission', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    expect(state.inDemoPlayback).toBe(false);
  });

  it('returns a frozen showPage action', () => {
    const state = createFrontEndSequence('shareware');
    const action = tickFrontEnd(state);
    expect(Object.isFrozen(action)).toBe(true);
  });
});

describe('tickFrontEnd: page state idle ticks decrement pagetic', () => {
  it('returns idle when advancedemo is false and state is page', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    const action = tickFrontEnd(state);
    expect(action).toBe(FRONTEND_TICK_IDLE);
    expect(action.kind).toBe('idle');
  });

  it('decrements pagetic by 1 per idle tick', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    const before = state.titleLoop.pagetic;
    tickFrontEnd(state);
    expect(state.titleLoop.pagetic).toBe(before - 1);
  });

  it('after pagetic+1 idle ticks, next tick advances to the demo state', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    for (let tic = 0; tic < TITLEPIC_PAGETIC + 1; tic++) {
      tickFrontEnd(state);
    }
    expect(state.titleLoop.advancedemo).toBe(true);
    const next = tickFrontEnd(state) as PlayDemoTickAction;
    expect(next.kind).toBe('playDemo');
    expect(next.demoLump).toBe('DEMO1');
  });
});

describe('tickFrontEnd: demo state sets inDemoPlayback and does not tick pagetic', () => {
  function runToDemo1(): FrontEndSequenceState {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    for (let tic = 0; tic < TITLEPIC_PAGETIC + 1; tic++) {
      tickFrontEnd(state);
    }
    tickFrontEnd(state);
    return state;
  }

  it('emits playDemo with DEMO1 lump', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    for (let tic = 0; tic < TITLEPIC_PAGETIC + 1; tic++) {
      tickFrontEnd(state);
    }
    const action = tickFrontEnd(state) as PlayDemoTickAction;
    expect(action.kind).toBe('playDemo');
    expect(action.demoLump).toBe('DEMO1');
  });

  it('sets inDemoPlayback true', () => {
    const state = runToDemo1();
    expect(state.inDemoPlayback).toBe(true);
  });

  it('does not decrement pagetic during demo playback', () => {
    const state = runToDemo1();
    const before = state.titleLoop.pagetic;
    tickFrontEnd(state);
    tickFrontEnd(state);
    tickFrontEnd(state);
    expect(state.titleLoop.pagetic).toBe(before);
  });

  it('returns idle during demo playback when no advance is pending', () => {
    const state = runToDemo1();
    expect(tickFrontEnd(state)).toBe(FRONTEND_TICK_IDLE);
  });

  it('returns frozen playDemo action', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    for (let tic = 0; tic < TITLEPIC_PAGETIC + 1; tic++) {
      tickFrontEnd(state);
    }
    const action = tickFrontEnd(state);
    expect(Object.isFrozen(action)).toBe(true);
  });
});

describe('notifyDemoCompleted', () => {
  it('clears inDemoPlayback', () => {
    const state = createFrontEndSequence('shareware');
    state.inDemoPlayback = true;
    notifyDemoCompleted(state);
    expect(state.inDemoPlayback).toBe(false);
  });

  it('sets advancedemo on the underlying loop', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    expect(state.titleLoop.advancedemo).toBe(false);
    state.inDemoPlayback = true;
    notifyDemoCompleted(state);
    expect(state.titleLoop.advancedemo).toBe(true);
  });

  it('next tickFrontEnd transitions to the next state (CREDIT after DEMO1)', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    for (let tic = 0; tic < TITLEPIC_PAGETIC + 1; tic++) {
      tickFrontEnd(state);
    }
    tickFrontEnd(state);
    notifyDemoCompleted(state);
    const next = tickFrontEnd(state) as ShowPageTickAction;
    expect(next.kind).toBe('showPage');
    expect(next.lumpName).toBe('CREDIT');
    expect(next.pagetic).toBe(INTERLUDE_PAGETIC);
    expect(next.musicLump).toBeNull();
  });
});

describe('handleFrontEndKey: menu + help key dispatch', () => {
  it('KEY_ESCAPE returns openMenu', () => {
    const state = createFrontEndSequence('shareware');
    const action = handleFrontEndKey(state, FRONTEND_KEY_MENU);
    expect(action).toBe(FRONTEND_KEY_OPEN_MENU);
    expect(action.kind).toBe('openMenu');
  });

  it('KEY_ESCAPE does NOT request an advance', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    handleFrontEndKey(state, FRONTEND_KEY_MENU);
    expect(state.titleLoop.advancedemo).toBe(false);
  });

  it('KEY_F1 returns openHelp with the shareware HELP2 lump', () => {
    const state = createFrontEndSequence('shareware');
    const action = handleFrontEndKey(state, FRONTEND_KEY_HELP) as OpenHelpKeyAction;
    expect(action.kind).toBe('openHelp');
    expect(action.lump).toBe('HELP2');
  });

  it('KEY_F1 returns openHelp with the retail HELP1 lump', () => {
    const state = createFrontEndSequence('retail');
    const action = handleFrontEndKey(state, FRONTEND_KEY_HELP) as OpenHelpKeyAction;
    expect(action.kind).toBe('openHelp');
    expect(action.lump).toBe('HELP1');
  });

  it('KEY_F1 returns openHelp with the commercial HELP lump', () => {
    const state = createFrontEndSequence('commercial');
    const action = handleFrontEndKey(state, FRONTEND_KEY_HELP) as OpenHelpKeyAction;
    expect(action.kind).toBe('openHelp');
    expect(action.lump).toBe('HELP');
  });

  it('KEY_F1 does NOT request an advance', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    handleFrontEndKey(state, FRONTEND_KEY_HELP);
    expect(state.titleLoop.advancedemo).toBe(false);
  });

  it('openHelp action is frozen', () => {
    const state = createFrontEndSequence('shareware');
    const action = handleFrontEndKey(state, FRONTEND_KEY_HELP);
    expect(Object.isFrozen(action)).toBe(true);
  });
});

describe('handleFrontEndKey: skip key dispatch', () => {
  it('arbitrary letter key returns advanceDemo', () => {
    const state = createFrontEndSequence('shareware');
    const action = handleFrontEndKey(state, 'a'.charCodeAt(0));
    expect(action).toBe(FRONTEND_KEY_ADVANCE_DEMO);
    expect(action.kind).toBe('advanceDemo');
  });

  it('sets advancedemo=true on the underlying loop', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    expect(state.titleLoop.advancedemo).toBe(false);
    handleFrontEndKey(state, 'a'.charCodeAt(0));
    expect(state.titleLoop.advancedemo).toBe(true);
  });

  it('next tick advances to the demo state', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    handleFrontEndKey(state, 'a'.charCodeAt(0));
    const next = tickFrontEnd(state) as PlayDemoTickAction;
    expect(next.kind).toBe('playDemo');
    expect(next.demoLump).toBe('DEMO1');
  });

  it('any number of repeated skip presses remains idempotent (advancedemo is a bool)', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    handleFrontEndKey(state, 'a'.charCodeAt(0));
    handleFrontEndKey(state, 'b'.charCodeAt(0));
    handleFrontEndKey(state, 'c'.charCodeAt(0));
    expect(state.titleLoop.advancedemo).toBe(true);
  });
});

describe('handleFrontEndKey: menu-active gating', () => {
  it('returns none when menuActive is true', () => {
    const state = createFrontEndSequence('shareware');
    state.menuActive = true;
    const action = handleFrontEndKey(state, 'a'.charCodeAt(0));
    expect(action).toBe(FRONTEND_KEY_NONE);
  });

  it('KEY_ESCAPE returns none when menu is active (menu handles its own ESC)', () => {
    const state = createFrontEndSequence('shareware');
    state.menuActive = true;
    expect(handleFrontEndKey(state, FRONTEND_KEY_MENU)).toBe(FRONTEND_KEY_NONE);
  });

  it('KEY_F1 returns none when menu is active', () => {
    const state = createFrontEndSequence('shareware');
    state.menuActive = true;
    expect(handleFrontEndKey(state, FRONTEND_KEY_HELP)).toBe(FRONTEND_KEY_NONE);
  });

  it('does NOT request an advance while menu is active', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    state.menuActive = true;
    handleFrontEndKey(state, 'a'.charCodeAt(0));
    expect(state.titleLoop.advancedemo).toBe(false);
  });

  it('setMenuActive(state, true) sets menuActive', () => {
    const state = createFrontEndSequence('shareware');
    setMenuActive(state, true);
    expect(state.menuActive).toBe(true);
  });

  it('setMenuActive(state, false) clears menuActive', () => {
    const state = createFrontEndSequence('shareware');
    state.menuActive = true;
    setMenuActive(state, false);
    expect(state.menuActive).toBe(false);
  });

  it('key dispatch resumes after menu closes', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    setMenuActive(state, true);
    handleFrontEndKey(state, 'a'.charCodeAt(0));
    expect(state.titleLoop.advancedemo).toBe(false);
    setMenuActive(state, false);
    const action = handleFrontEndKey(state, 'a'.charCodeAt(0));
    expect(action).toBe(FRONTEND_KEY_ADVANCE_DEMO);
    expect(state.titleLoop.advancedemo).toBe(true);
  });
});

describe('menu does not pause the attract pagetic timer', () => {
  it('pagetic still decrements while menuActive is true (vanilla parity)', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    setMenuActive(state, true);
    const before = state.titleLoop.pagetic;
    tickFrontEnd(state);
    tickFrontEnd(state);
    tickFrontEnd(state);
    expect(state.titleLoop.pagetic).toBe(before - 3);
  });
});

describe('full shareware attract cycle matches title-sequence.json', () => {
  it('emits 3 showPage + 3 playDemo actions in order', () => {
    const state = createFrontEndSequence('shareware');
    const emitted = runFullCycle(state);
    expect(emitted).toHaveLength(CYCLE_LENGTH);
    expect(emitted[0]!.kind).toBe('showPage');
    expect(emitted[1]!.kind).toBe('playDemo');
    expect(emitted[2]!.kind).toBe('showPage');
    expect(emitted[3]!.kind).toBe('playDemo');
    expect(emitted[4]!.kind).toBe('showPage');
    expect(emitted[5]!.kind).toBe('playDemo');
  });

  it('page and demo lumps match the manifest exactly', () => {
    const state = createFrontEndSequence('shareware');
    const emitted = runFullCycle(state);
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      const expected = sequence.states[index]!;
      const action = emitted[index]!;
      const expectedKind = expected.type === 'page' ? 'showPage' : 'playDemo';
      expect(action.kind).toBe(expectedKind);
      if (action.kind === 'showPage') {
        expect(action.lumpName).toBe(expected.lumpName!);
        expect(action.pagetic).toBe(expected.durationTics);
        expect(action.musicLump).toBe(expected.musicLump);
      } else if (action.kind === 'playDemo') {
        expect(action.demoLump).toBe(expected.demoLump!);
      }
    }
  });

  it('second cycle wraps back to TITLEPIC', () => {
    const state = createFrontEndSequence('shareware');
    runFullCycle(state);
    const emitted: FrontEndTickAction[] = [];
    while (emitted.length === 0) {
      const action = tickFrontEnd(state);
      if (action.kind === 'showPage' || action.kind === 'playDemo') {
        emitted.push(action);
      }
    }
    expect(emitted[0]!.kind).toBe('showPage');
    expect((emitted[0]! as ShowPageTickAction).lumpName).toBe('TITLEPIC');
  });
});

describe('parity-sensitive edge cases', () => {
  it('retail state 4 emits CREDIT page (F-030), not HELP2', () => {
    const state = createFrontEndSequence('retail');
    const emitted = runFullCycle(state);
    const state4 = emitted[4]! as ShowPageTickAction;
    expect(state4.kind).toBe('showPage');
    expect(state4.lumpName).toBe('CREDIT');
    expect(state4.pagetic).toBe(INTERLUDE_PAGETIC);
  });

  it('commercial state 4 emits TITLEPIC page with D_DM2TTL music, pagetic=INTERLUDE_PAGETIC', () => {
    const state = createFrontEndSequence('commercial');
    const emitted = runFullCycle(state);
    const state4 = emitted[4]! as ShowPageTickAction;
    expect(state4.kind).toBe('showPage');
    expect(state4.lumpName).toBe('TITLEPIC');
    expect(state4.musicLump).toBe('D_DM2TTL');
    expect(state4.pagetic).toBe(INTERLUDE_PAGETIC);
  });

  it('registered state 4 emits HELP2 page (same as shareware, pre-Ultimate)', () => {
    const state = createFrontEndSequence('registered');
    const emitted = runFullCycle(state);
    const state4 = emitted[4]! as ShowPageTickAction;
    expect(state4.kind).toBe('showPage');
    expect(state4.lumpName).toBe('HELP2');
  });

  it('KEY_ESCAPE while menu is NOT active still returns openMenu (does not request advance)', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    const action = handleFrontEndKey(state, FRONTEND_KEY_MENU);
    expect(action.kind).toBe('openMenu');
    expect(state.titleLoop.advancedemo).toBe(false);
  });

  it('sequence of page->skip->demo->notifyDemoCompleted->page reproduces manifest states 0-2', () => {
    const state = createFrontEndSequence('shareware');
    const first = tickFrontEnd(state) as ShowPageTickAction;
    expect(first.lumpName).toBe('TITLEPIC');

    handleFrontEndKey(state, 'z'.charCodeAt(0));
    const second = tickFrontEnd(state) as PlayDemoTickAction;
    expect(second.demoLump).toBe('DEMO1');

    notifyDemoCompleted(state);
    const third = tickFrontEnd(state) as ShowPageTickAction;
    expect(third.lumpName).toBe('CREDIT');
  });

  it('skip during a demo state does not produce two back-to-back advances', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    for (let tic = 0; tic < TITLEPIC_PAGETIC + 1; tic++) {
      tickFrontEnd(state);
    }
    tickFrontEnd(state);
    expect(state.inDemoPlayback).toBe(true);
    handleFrontEndKey(state, 'a'.charCodeAt(0));
    const next = tickFrontEnd(state) as ShowPageTickAction;
    expect(next.kind).toBe('showPage');
    expect(next.lumpName).toBe('CREDIT');
    expect(state.inDemoPlayback).toBe(false);
  });

  it('tickFrontEnd returns FRONTEND_TICK_IDLE singleton for idle ticks', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    const a = tickFrontEnd(state);
    const b = tickFrontEnd(state);
    expect(a).toBe(FRONTEND_TICK_IDLE);
    expect(b).toBe(FRONTEND_TICK_IDLE);
  });

  it('handleFrontEndKey returns FRONTEND_KEY_NONE singleton when menu gate blocks', () => {
    const state = createFrontEndSequence('shareware');
    setMenuActive(state, true);
    const a = handleFrontEndKey(state, 65);
    const b = handleFrontEndKey(state, 66);
    expect(a).toBe(FRONTEND_KEY_NONE);
    expect(b).toBe(FRONTEND_KEY_NONE);
  });

  it('KEY_ESCAPE returns FRONTEND_KEY_OPEN_MENU singleton', () => {
    const state = createFrontEndSequence('shareware');
    const a = handleFrontEndKey(state, FRONTEND_KEY_MENU);
    const b = handleFrontEndKey(state, FRONTEND_KEY_MENU);
    expect(a).toBe(FRONTEND_KEY_OPEN_MENU);
    expect(b).toBe(FRONTEND_KEY_OPEN_MENU);
  });

  it('demo skip-key consecutively returns FRONTEND_KEY_ADVANCE_DEMO singleton', () => {
    const state = createFrontEndSequence('shareware');
    tickFrontEnd(state);
    const a: FrontEndKeyAction = handleFrontEndKey(state, 65);
    const b: FrontEndKeyAction = handleFrontEndKey(state, 66);
    expect(a).toBe(FRONTEND_KEY_ADVANCE_DEMO);
    expect(b).toBe(FRONTEND_KEY_ADVANCE_DEMO);
  });
});
